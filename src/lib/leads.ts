import "server-only";
import type { Business, CrmProvider, LeadStatus } from "@prisma/client";
import { db } from "./db";
import { addDays } from "./format";
import { logActivity } from "./usage";
import { CHANNEL_LABELS, normalizeSource, resultsSummary, type Channel, type LeadDraft } from "./leads-core";
import { TIERS } from "./tiers";
import { pushLeadToCrms } from "./crm";

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
 * lead (the note is appended) rather than a duplicate. New leads are pushed to the
 * client's CRM when they've asked for that.
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
  if (lead.origin === "form" || lead.origin === "webhook" || lead.origin === "manual") {
    await pushLeadToCrms(business.id, created).catch((err) => console.error("CRM push failed", err));
  }
  if (lead.origin === "form" || lead.origin === "webhook") {
    await logActivity(
      business.id,
      "leads",
      `New lead: ${created.name}${created.source !== "other" ? ` from ${CHANNEL_LABELS[created.source as Channel] ?? created.source}` : ""}${created.elevated ? " (via Elevated)" : ""}`,
    );
  }
  return { lead: created, duplicate: false };
}

/** Bulk import from a spreadsheet. Skips rows whose email (or name + phone) is already on file. */
export async function importLeadDrafts(businessId: string, drafts: LeadDraft[]) {
  const existing = await db.lead.findMany({ where: { businessId }, select: { email: true, name: true, phone: true } });
  const seen = new Set(existing.flatMap((l) => [l.email ?? "", `${l.name.toLowerCase()}|${l.phone ?? ""}`]).filter(Boolean));
  const fresh = drafts.filter((d) => {
    const keys = [d.email ?? "", `${d.name.toLowerCase()}|${d.phone ?? ""}`].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
  const now = new Date();
  for (let i = 0; i < fresh.length; i += 500) {
    await db.lead.createMany({
      data: fresh.slice(i, i + 500).map((d) => ({
        businessId,
        name: d.name,
        email: d.email,
        phone: d.phone,
        company: d.company,
        source: d.source,
        status: d.status,
        valueCents: d.valueCents,
        wonAt: d.status === "WON" ? d.occurredAt ?? now : null,
        origin: "import",
        occurredAt: d.occurredAt ?? now,
      })),
    });
  }
  return { imported: fresh.length, skipped: drafts.length - fresh.length };
}

/** Upserts leads coming from a CRM sync, keyed by the CRM's own id. */
export async function upsertCrmLeads(businessId: string, crm: CrmProvider, items: (LeadDraft & { externalId: string })[]) {
  let created = 0;
  for (const d of items) {
    const res = await db.lead.upsert({
      where: { businessId_crm_externalId: { businessId, crm, externalId: d.externalId } },
      create: {
        businessId,
        crm,
        externalId: d.externalId,
        name: d.name,
        email: d.email,
        phone: d.phone,
        company: d.company,
        source: d.source,
        status: d.status,
        valueCents: d.valueCents,
        wonAt: d.status === "WON" ? d.occurredAt ?? new Date() : null,
        origin: "crm",
        occurredAt: d.occurredAt ?? new Date(),
      },
      // The CRM is the source of truth for status and value; keep our source/elevated tags.
      update: { status: d.status, valueCents: d.valueCents, ...(d.status === "WON" ? { wonAt: d.occurredAt ?? undefined } : {}) },
      select: { createdAt: true, updatedAt: true },
    });
    if (res.createdAt.getTime() === res.updatedAt.getTime()) created++;
  }
  return created;
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
