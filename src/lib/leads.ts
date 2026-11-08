import "server-only";
import type { Business, LeadStatus } from "@prisma/client";
import { db } from "./db";
import { addDays } from "./format";
import { logActivity } from "./usage";
import { CHANNEL_LABELS, normalizeSource, resultsSummary, type Channel } from "./leads-core";
import { TIERS } from "./tiers";
import { autoSendLead } from "./crm";

export type NewLead = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  sourceDetail?: string | null;
  elevated?: boolean;
  status?: LeadStatus;
  valueCents?: number;
  notes?: string | null;
  origin: "manual" | "form" | "webhook" | "import" | "crm";
  occurredAt?: Date | null;
};

/**
 * Saves a new lead. A repeat from the same email within 30 days is treated as the same
 * lead (the note is appended) rather than a duplicate. New leads are sent to the
 * client's CRM when they've asked for that, and followed there until they buy.
 */
export async function recordLead(business: Pick<Business, "id" | "name">, lead: NewLead) {
  const email = lead.email?.trim().toLowerCase() || null;
  if (email) {
    const recent = await db.lead.findFirst({
      where: { businessId: business.id, email, occurredAt: { gte: addDays(new Date(), -30) } },
      orderBy: { occurredAt: "desc" },
    });
    if (recent) {
      if (lead.notes) {
        await db.lead.update({
          where: { id: recent.id },
          data: { notes: [recent.notes, `${new Date().toLocaleDateString("en-US")}: ${lead.notes}`].filter(Boolean).join("\n").slice(0, 5000) },
        });
      }
      return { lead: recent, duplicate: true };
    }
  }
  const status = lead.status ?? "NEW";
  const created = await db.lead.create({
    data: {
      businessId: business.id,
      name: lead.name.slice(0, 200),
      email,
      phone: lead.phone?.slice(0, 50) || null,
      company: lead.company?.slice(0, 200) || null,
      source: normalizeSource(lead.source),
      sourceDetail: lead.sourceDetail?.slice(0, 200) || null,
      elevated: Boolean(lead.elevated),
      status,
      valueCents: Math.max(0, Math.round(lead.valueCents ?? 0)),
      wonAt: status === "WON" ? new Date() : null,
      notes: lead.notes?.slice(0, 5000) || null,
      origin: lead.origin,
      occurredAt: lead.occurredAt ?? new Date(),
    },
  });
  // Leads Elevated brought in go to the client's CRM (when they've turned that on) so we can follow them to a sale.
  if (lead.origin === "form" || lead.origin === "webhook" || lead.elevated) await autoSendLead(created);
  if (lead.origin === "form" || lead.origin === "webhook") {
    await logActivity(
      business.id,
      "leads",
      `New lead: ${created.name}${created.source !== "other" ? ` from ${CHANNEL_LABELS[created.source as Channel] ?? created.source}` : ""}${created.elevated ? " (via Elevated)" : ""}`,
    );
  }
  return { lead: created, duplicate: false };
}

/** Results for one business: before vs since Elevated, from leads plus spend. */
export async function businessResults(business: Business & { user: { tier: keyof typeof TIERS; subscriptionStatus: string | null } }) {
  const startedAt = business.createdAt;
  const [leads, adSpend, firstAudit, lastAudit, check] = await Promise.all([
    db.lead.findMany({
      where: { businessId: business.id, occurredAt: { gte: addDays(startedAt, -7 * 12) } },
      select: { occurredAt: true, status: true, valueCents: true, wonAt: true, source: true, elevated: true },
    }),
    db.channelMetric.aggregate({ where: { businessId: business.id, date: { gte: startedAt } }, _sum: { spendCents: true } }),
    db.websiteAudit.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: "asc" } }),
    db.websiteAudit.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: "desc" } }),
    db.visibilityCheck.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const tier = TIERS[business.user.tier];
  const months = Math.max(1, Math.ceil((Date.now() - startedAt.getTime()) / (30 * 86_400_000)));
  const planCents = tier.id !== "TRIAL" && business.user.subscriptionStatus ? tier.price * 100 * months : 0;
  const adCents = adSpend._sum.spendCents ?? 0;
  const summary = resultsSummary(leads, { startedAt, spendCents: planCents + adCents });
  return {
    ...summary,
    startedAt,
    planCents,
    adCents,
    websiteScoreBefore: check?.siteScore ?? firstAudit?.score ?? null,
    websiteScoreNow: lastAudit?.score ?? null,
    aiScoreBefore: check?.aiScore ?? null,
  };
}
