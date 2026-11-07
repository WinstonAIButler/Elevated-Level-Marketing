import "server-only";
import type { Business, Campaign, Prisma, PublishItem, Provider } from "@prisma/client";
import { db } from "./db";
import { adCreative, budgetAllocation, type CampaignOutput } from "./ai";
import { dailyBudgetCents, looksB2B, maxChannels, normalizeSplits, proposeSplit, startOfMonth, type Split } from "./allocation";
import { CHANNELS, PAID_PROVIDERS, USABLE_STATUSES, managedAdsConfigured, providerForPlatform } from "./channels";
import { addDays } from "./format";
import { logActivity } from "./usage";
import { recordWalletEntry } from "./wallet";
import { fundedDays, LAUNCH_MIN_DAYS, LOW_BALANCE_DAYS } from "./wallet-math";
import { PlatformError } from "./publishers/http";
import { liveConnection, markConnectionBroken, PUBLISHERS } from "./publishers";
import type { AdPayload, AdTarget, PostPayload } from "./publishers/types";

// The pipeline: content and budget proposals are queued as PENDING_APPROVAL. Nothing
// is posted or spent until the client approves it. Approved items are published by the
// hourly cron (or immediately on approval when they're already due). Ad spend is synced
// daily, debited from the wallet, and ads pause automatically when the wallet runs low.

const LOW_FUNDS = "LOW_FUNDS";
const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Budget allocation

export async function channelPerformance(businessId: string, days = 30) {
  const rows = await db.channelMetric.groupBy({
    by: ["provider"],
    where: { businessId, date: { gte: addDays(new Date(), -days) } },
    _sum: { spendCents: true, clicks: true, conversions: true, impressions: true },
  });
  return rows.map((r) => ({
    provider: r.provider,
    spendCents: r._sum.spendCents ?? 0,
    clicks: r._sum.clicks ?? 0,
    conversions: r._sum.conversions ?? 0,
    impressions: r._sum.impressions ?? 0,
  }));
}

/** Proposes how to split this month's ad budget. Replaces any earlier unanswered proposal. */
export async function proposeAllocation(business: Business, clientNote?: string | null) {
  const totalCents = business.monthlyBudget * 100;
  if (totalCents <= 0) throw new Error("Set a monthly ad budget on the Ad spend page first.");
  const perf = await channelPerformance(business.id);
  const plan = await db.marketingPlan.findFirst({ where: { businessId: business.id, active: true }, orderBy: { createdAt: "desc" } });
  const b2b = looksB2B(`${business.targetAudience} ${business.industry} ${business.description}`);
  const baseline = proposeSplit({ totalCents, candidates: PAID_PROVIDERS, perf, b2b });

  let splits: Split[] = baseline;
  let summary = `We split your $${business.monthlyBudget.toLocaleString()} monthly ad budget across ${baseline.length} channel${baseline.length === 1 ? "" : "s"}, weighted toward where your customers are most likely to act${perf.length ? " and where your ads have performed best so far" : ""}.`;
  let aiGenerated = false;
  try {
    const ai = await budgetAllocation(business, {
      totalCents,
      maxChannels: maxChannels(totalCents),
      baseline: baseline.map((s) => ({ provider: s.provider, percent: s.percent })),
      perf,
      plan: ((plan?.channelStrategy as { channel: string; role: string }[]) ?? []).slice(0, 8),
      clientNote,
    });
    if (ai) {
      const normalized = normalizeSplits(ai.splits, totalCents, PAID_PROVIDERS);
      if (normalized.length) {
        splits = normalized;
        summary = ai.summary;
        aiGenerated = true;
      }
    }
  } catch (err) {
    console.error("AI allocation failed, using rule-based split", err);
  }

  const month = startOfMonth();
  await db.budgetAllocation.updateMany({ where: { businessId: business.id, status: "PROPOSED" }, data: { status: "SUPERSEDED" } });
  const allocation = await db.budgetAllocation.create({
    data: { businessId: business.id, month, totalCents, summary, splits, basedOn: { perf, b2b }, aiGenerated },
  });
  await logActivity(business.id, "allocation", `New ad budget split proposed for your approval: ${splits.map((s) => `${CHANNELS[s.provider].name} ${s.percent}%`).join(", ")}`);
  return allocation;
}

/** Client approved the split: write the ads for each channel and queue them for approval. */
export async function approveAllocation(business: Business, allocationId: string) {
  const allocation = await db.budgetAllocation.findFirst({ where: { id: allocationId, businessId: business.id, status: "PROPOSED" } });
  if (!allocation) throw new Error("That budget proposal is no longer open.");
  await db.$transaction([
    db.budgetAllocation.updateMany({ where: { businessId: business.id, status: "APPROVED" }, data: { status: "SUPERSEDED" } }),
    db.budgetAllocation.update({ where: { id: allocation.id }, data: { status: "APPROVED", decidedAt: new Date() } }),
    // Ads from an older split that were never approved are dropped.
    db.publishItem.updateMany({
      where: { businessId: business.id, kind: "AD", status: "PENDING_APPROVAL" },
      data: { status: "REJECTED", error: "Replaced by a newer budget split", decidedAt: new Date() },
    }),
  ]);

  const latest = await db.campaign.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: "desc" } });
  const source = (latest?.content as CampaignOutput | undefined) ?? null;
  const link = business.website ? normalizeUrl(business.website) : "";
  for (const split of allocation.splits as Split[]) {
    const { creative } = await adCreative(business, split.provider, split.cents, source);
    const payload: AdPayload & { imageIdea: string; reason: string } = {
      campaignName: creative.campaignName,
      headlines: creative.headlines,
      descriptions: creative.descriptions,
      primaryText: creative.primaryText,
      callToAction: creative.callToAction,
      keywords: creative.keywords,
      link,
      imageIdea: creative.imageIdea,
      reason: split.reason,
    };
    await db.publishItem.create({
      data: {
        businessId: business.id,
        allocationId: allocation.id,
        campaignId: latest?.id,
        provider: split.provider,
        kind: "AD",
        title: `${CHANNELS[split.provider].name} ads – $${(split.cents / 100).toLocaleString()}/month`,
        payload,
        dailyBudgetCents: dailyBudgetCents(split.cents),
        scheduledFor: new Date(),
      },
    });
  }
  await logActivity(business.id, "allocation", "Ad budget split approved. Your ads are ready to review in Approvals.");
}

export async function rejectAllocation(business: Business, allocationId: string, note: string) {
  const res = await db.budgetAllocation.updateMany({
    where: { id: allocationId, businessId: business.id, status: "PROPOSED" },
    data: { status: "REJECTED", clientNote: note || null, decidedAt: new Date() },
  });
  if (!res.count) throw new Error("That budget proposal is no longer open.");
  return proposeAllocation(business, note || "The owner asked for a different split.");
}

// ---------------------------------------------------------------------------
// Queueing content

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Queues a campaign's social posts for every connected platform that can publish them. */
export async function queueCampaignPosts(business: Business, campaign: Campaign) {
  const content = campaign.content as CampaignOutput;
  const connected = new Set(
    (await db.channelConnection.findMany({ where: { businessId: business.id, status: { in: USABLE_STATUSES } }, select: { provider: true } })).map((c) => c.provider),
  );
  const already = await db.publishItem.count({ where: { campaignId: campaign.id, kind: "POST" } });
  if (already) return 0;

  const start = campaign.startDate && campaign.startDate > new Date() ? campaign.startDate : new Date();
  const link = business.website ? normalizeUrl(business.website) : undefined;
  const items: { provider: Provider; title: string; payload: PostPayload & { visualIdea?: string }; scheduledFor: Date }[] = [];

  for (const post of content.socialPosts ?? []) {
    const provider = providerForPlatform(post.platform);
    if (!provider || !connected.has(provider) || provider === "GOOGLE_ADS") continue;
    const when = addDays(start, Math.max(0, post.dayOffset));
    when.setUTCHours(15, 0, 0, 0); // ~10am US Eastern
    items.push({
      provider,
      title: `${post.platform} post – ${campaign.name}`,
      payload: {
        text: post.caption,
        hashtags: post.hashtags,
        link,
        visualIdea: post.visualIdea,
        ...(provider === "META" ? { placement: /instagram|\big\b/i.test(post.platform) ? "instagram" : "facebook" } : {}),
      },
      scheduledFor: when,
    });
  }
  // A weekly Google Business Profile update from the campaign's first post.
  const first = content.socialPosts?.[0];
  if (connected.has("GOOGLE_BUSINESS") && first) {
    items.push({
      provider: "GOOGLE_BUSINESS",
      title: `Google Business Profile update – ${campaign.name}`,
      payload: { text: first.caption, link, visualIdea: first.visualIdea },
      scheduledFor: start,
    });
  }
  if (items.length) {
    await db.publishItem.createMany({
      data: items.map((i) => ({ ...i, businessId: business.id, campaignId: campaign.id, kind: "POST" as const })),
    });
    await logActivity(business.id, "approvals", `${items.length} post${items.length === 1 ? "" : "s"} from "${campaign.name}" are waiting for your approval`);
  }
  return items.length;
}

// ---------------------------------------------------------------------------
// Publishing

function adTarget(business: Business, item?: Pick<PublishItem, "payload">): AdTarget {
  // A live ad stays with the account it was launched from, even if the client later switches modes.
  const launched = (item?.payload as Record<string, unknown> | undefined)?.managed;
  const managed = typeof launched === "boolean" ? launched : business.adSpendMode === "WALLET";
  return { managed, businessId: business.id, businessName: business.name };
}

async function liveAdDailySpend(businessId: string) {
  const r = await db.publishItem.aggregate({
    where: { businessId, kind: "AD", status: "PUBLISHED" },
    _sum: { dailyBudgetCents: true },
  });
  return r._sum.dailyBudgetCents ?? 0;
}

/** Publishes one approved item. Safe to call twice: only one caller can claim it. */
export async function publishItem(itemId: string) {
  const claimed = await db.publishItem.updateMany({
    where: { id: itemId, status: "APPROVED", scheduledFor: { lte: new Date() } },
    data: { status: "PUBLISHING", attempts: { increment: 1 } },
  });
  if (!claimed.count) return;
  const item = (await db.publishItem.findUnique({ where: { id: itemId }, include: { business: true } }))!;
  const { business } = item;
  const info = CHANNELS[item.provider];
  const publisher = PUBLISHERS[item.provider];

  const linkedByHand = async () =>
    (await db.channelConnection.count({ where: { businessId: business.id, provider: item.provider, method: "manual", status: "linked" } })) > 0;
  const notConnected = async (fallback: string) =>
    (await linkedByHand()) ? `the Elevated team publishes to your linked ${info.name} account` : fallback;

  const toTeam = async (why: string) => {
    await db.publishItem.update({ where: { id: item.id }, data: { status: "NEEDS_TEAM", error: why } });
    await logActivity(business.id, "publishing", `${item.title}: handed to the Elevated team (${why})`);
  };

  try {
    if (item.kind === "POST") {
      if (!info.autoPosts || !publisher.publishPost) return toTeam(info.manualNote ?? "this platform isn't automated yet");
      const conn = await liveConnection(business.id, item.provider);
      if (!conn) return toTeam(await notConnected(`${info.name} isn't connected`));
      const res = await publisher.publishPost(conn, item.payload as PostPayload);
      await markPublished(item, res);
      return;
    }

    // Ads
    const target = adTarget(business);
    if (!info.autoAds || !publisher.launchAd) return toTeam(info.manualNote ?? "ads on this platform are launched by the team");
    if (target.managed && !managedAdsConfigured(item.provider)) return toTeam("Elevated's managed ad account for this platform isn't set up yet");
    if (target.managed) {
      const needed = (await liveAdDailySpend(business.id)) + item.dailyBudgetCents;
      if (fundedDays(business.walletBalanceCents, needed) < LAUNCH_MIN_DAYS) {
        await db.publishItem.update({
          where: { id: item.id },
          data: { status: "APPROVED", attempts: { decrement: 1 }, error: `Waiting for wallet funds: add at least $${((needed * LAUNCH_MIN_DAYS - business.walletBalanceCents) / 100).toFixed(2)} to launch.` },
        });
        return;
      }
    }
    const conn = await liveConnection(business.id, item.provider);
    if (item.provider === "META" && !conn) return toTeam(await notConnected("connect the Facebook Page the ads should run under"));
    if (!target.managed && !conn) return toTeam(await notConnected(`${info.name} isn't connected`));
    const res = await publisher.launchAd(conn, item.payload as AdPayload, item.dailyBudgetCents, target);
    await db.publishItem.update({
      where: { id: item.id },
      data: { payload: { ...(item.payload as Record<string, unknown>), managed: target.managed } as Prisma.InputJsonValue },
    });
    await markPublished(item, res);

    // The new campaign replaces any older one on the same platform.
    const older = await db.publishItem.findMany({
      where: { businessId: business.id, provider: item.provider, kind: "AD", status: { in: ["PUBLISHED", "PAUSED"] }, id: { not: item.id } },
    });
    for (const o of older) {
      await publisher.setAdStatus?.(conn, o.externalId!, false, adTarget(business, o)).catch(() => {});
      await db.publishItem.update({ where: { id: o.id }, data: { status: "PAUSED", error: "Replaced by a newer campaign" } });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const auth = err instanceof PlatformError && err.authProblem;
    if (auth) {
      const conn = await db.channelConnection.findUnique({ where: { businessId_provider: { businessId: business.id, provider: item.provider } } });
      if (conn) await markConnectionBroken(conn.id, message);
    }
    const final = auth || item.attempts >= MAX_ATTEMPTS;
    await db.publishItem.update({ where: { id: item.id }, data: { status: final ? "FAILED" : "APPROVED", error: message.slice(0, 1000) } });
    if (final) await logActivity(business.id, "publishing", `${item.title} failed: ${message.slice(0, 200)}`);
  }
}

async function markPublished(item: PublishItem & { business: Business }, res: { externalId: string; externalUrl?: string }) {
  await db.publishItem.update({
    where: { id: item.id },
    data: { status: "PUBLISHED", externalId: res.externalId, externalUrl: res.externalUrl ?? null, publishedAt: new Date(), error: null },
  });
  await logActivity(item.businessId, "publishing", `${item.kind === "AD" ? "Launched" : "Published"}: ${item.title}`);
}

/** Hourly: publish everything approved and due, and resume ads paused for low funds once topped up. */
export async function publishDue() {
  const due = await db.publishItem.findMany({
    where: { status: "APPROVED", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: 100,
    select: { id: true },
  });
  for (const { id } of due) await publishItem(id);

  const paused = await db.publishItem.findMany({
    where: { status: "PAUSED", kind: "AD", error: { startsWith: LOW_FUNDS } },
    include: { business: true },
  });
  let resumed = 0;
  for (const item of paused) {
    const needed = (await liveAdDailySpend(item.businessId)) + item.dailyBudgetCents;
    if (fundedDays(item.business.walletBalanceCents, needed) < LAUNCH_MIN_DAYS) continue;
    try {
      const conn = await liveConnection(item.businessId, item.provider);
      await PUBLISHERS[item.provider].setAdStatus?.(conn, item.externalId!, true, adTarget(item.business, item));
      await db.publishItem.update({ where: { id: item.id }, data: { status: "PUBLISHED", error: null } });
      await logActivity(item.businessId, "wallet", `Wallet topped up: resumed ${item.title}`);
      resumed++;
    } catch (err) {
      console.error("resume failed", item.id, err);
    }
  }
  return { attempted: due.length, resumed };
}

// ---------------------------------------------------------------------------
// Spend sync

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Daily: pull spend/results for live ads, debit wallets, and pause ads when a wallet runs low. */
export async function syncSpend() {
  const days = [isoDay(addDays(new Date(), -1)), isoDay(new Date())];
  const ads = await db.publishItem.findMany({
    where: {
      kind: "AD",
      externalId: { not: null },
      // Paused ads are included so the spend from the day they paused is still counted.
      status: { in: ["PUBLISHED", "PAUSED"] },
      publishedAt: { gte: addDays(new Date(), -45) },
    },
    include: { business: true },
  });
  const totals = new Map<string, { businessId: string; provider: Provider; date: string; spendCents: number; impressions: number; clicks: number; conversions: number }>();
  const errors: string[] = [];

  for (const item of ads) {
    const target = adTarget(item.business, item);
    const publisher = PUBLISHERS[item.provider];
    if (!publisher.adMetrics) continue;
    try {
      const conn = await liveConnection(item.businessId, item.provider);
      for (const day of days) {
        const m = await publisher.adMetrics(conn, item.externalId!, day, target);
        const key = `${item.businessId}|${item.provider}|${day}`;
        const t = totals.get(key) ?? { businessId: item.businessId, provider: item.provider, date: day, spendCents: 0, impressions: 0, clicks: 0, conversions: 0 };
        t.spendCents += m.spendCents;
        t.impressions += m.impressions;
        t.clicks += m.clicks;
        t.conversions += m.conversions;
        totals.set(key, t);
        if (target.managed) {
          await recordWalletEntry({
            businessId: item.businessId,
            kind: "SPEND",
            amountCents: -m.spendCents,
            provider: item.provider,
            reference: `spend:${item.id}:${day}`,
            note: `${CHANNELS[item.provider].name} ad spend ${day}`,
          });
        }
      }
    } catch (err) {
      errors.push(`${item.id}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  for (const t of totals.values()) {
    const { businessId, provider, date, ...m } = t;
    await db.channelMetric.upsert({
      where: { businessId_provider_date: { businessId, provider, date: new Date(date) } },
      create: { businessId, provider, date: new Date(date), ...m },
      update: m,
    });
  }

  const paused = await pauseLowFundAds();
  return { ads: ads.length, metrics: totals.size, paused, errors };
}

/** Pauses every live wallet-funded ad for businesses whose balance won't cover the next couple of days. */
export async function pauseLowFundAds() {
  const businesses = await db.business.findMany({
    where: { adSpendMode: "WALLET", publishItems: { some: { kind: "AD", status: "PUBLISHED" } } },
  });
  let paused = 0;
  for (const b of businesses) {
    const daily = await liveAdDailySpend(b.id);
    if (fundedDays(b.walletBalanceCents, daily) >= LOW_BALANCE_DAYS) continue;
    const live = await db.publishItem.findMany({ where: { businessId: b.id, kind: "AD", status: "PUBLISHED" } });
    for (const item of live) {
      try {
        const conn = await liveConnection(b.id, item.provider);
        await PUBLISHERS[item.provider].setAdStatus?.(conn, item.externalId!, false, adTarget(b, item));
        await db.publishItem.update({ where: { id: item.id }, data: { status: "PAUSED", error: `${LOW_FUNDS}: paused because the ad wallet is running low` } });
        paused++;
      } catch (err) {
        console.error("pause failed", item.id, err);
      }
    }
    await logActivity(b.id, "wallet", `Ads paused: your ad wallet has $${(b.walletBalanceCents / 100).toFixed(2)} left. Add funds on the Ad spend page and they'll restart automatically.`);
  }
  return paused;
}
