import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { aiEnabled, aiVisibilityScore, aiVisibilityTest, salesBrief, type AiVisibility } from "./ai";
import { displayPrices } from "./stripe-prices";
import { auditWebsite } from "./site-audit-fetch";
import { normalizeWebsite, topFixes, type AuditCheck } from "./site-audit";

// Free visibility check for prospects: the rule-based website audit plus a live AI search
// test. Limited per visitor and cached per website so it can't be abused or run up costs.

export const CHECK_COOKIE = "edm_check";
export const CHECKS_PER_HOUR = 5;
const REUSE_HOURS = 24;

export function hashIp(ip: string) {
  return createHash("sha256").update(`${ip}|${process.env.AUTH_SECRET ?? ""}`).digest("hex").slice(0, 32);
}

export type CheckInput = { website: string; businessName: string; city: string; industry: string; email?: string };

/** Runs a check (or reuses a recent one for the same website) and returns its id. */
export async function runVisibilityCheck(input: CheckInput, ipHash: string, opts: { owner?: boolean } = {}) {
  const url = normalizeWebsite(input.website);
  if (!url) throw new Error("Enter your website address, like yourbusiness.com.");
  const domain = url.hostname.replace(/^www\./, "").toLowerCase();

  const recent = await db.visibilityCheck.findFirst({
    where: { domain, error: null, createdAt: { gte: new Date(Date.now() - REUSE_HOURS * 3600_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent && !opts.owner && recent.businessName.toLowerCase() === input.businessName.toLowerCase()) {
    if (input.email && !recent.email) await db.visibilityCheck.update({ where: { id: recent.id }, data: { email: input.email } });
    return recent.id;
  }

  const lastHour = await db.visibilityCheck.count({ where: { ipHash, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (!opts.owner && lastHour >= CHECKS_PER_HOUR) throw new Error("You've run several checks in the last hour. Please try again a little later.");

  const [site, ai] = await Promise.allSettled([
    auditWebsite(url.toString()),
    aiVisibilityTest({ businessName: input.businessName, domain, city: input.city, industry: input.industry }),
  ]);

  const siteOk = site.status === "fulfilled" ? site.value : null;
  const aiOk = ai.status === "fulfilled" ? ai.value : null;
  const errors = [
    site.status === "rejected" ? `Website: ${site.reason instanceof Error ? site.reason.message : "couldn't be checked"}` : null,
    ai.status === "rejected" ? "AI search test couldn't run" : null,
  ].filter(Boolean);
  if (ai.status === "rejected") console.error("AI visibility test failed", ai.reason);

  const check = await db.visibilityCheck.create({
    data: {
      url: siteOk?.url ?? url.toString(),
      domain,
      businessName: input.businessName,
      city: input.city,
      industry: input.industry,
      email: input.email || null,
      siteScore: siteOk?.score ?? null,
      checks: (siteOk?.checks ?? undefined) as Prisma.InputJsonValue | undefined,
      aiScore: aiOk ? aiVisibilityScore(aiOk) : null,
      ai: (aiOk ?? undefined) as Prisma.InputJsonValue | undefined,
      error: siteOk || aiOk ? (errors.length ? errors.join(" · ") : null) : errors.join(" · ") || "The check couldn't run.",
      ipHash,
      source: opts.owner ? "owner" : "public",
    },
  });
  return check.id;
}

export function overallScore(siteScore: number | null, aiScore: number | null) {
  if (siteScore == null && aiScore == null) return null;
  if (siteScore == null) return aiScore;
  if (aiScore == null) return siteScore;
  return Math.round(siteScore * 0.5 + aiScore * 0.5);
}

export function checkSummary(check: { checks: unknown; ai: unknown }) {
  const checks = (check.checks as AuditCheck[] | null) ?? [];
  return { checks, fixes: topFixes(checks, 5), ai: (check.ai as AiVisibility | null) ?? null, aiAvailable: aiEnabled() };
}

/** Writes (or rewrites) the owner's sales brief for a lead and stores it on the check. */
export async function generateSalesBrief(checkId: string) {
  const check = await db.visibilityCheck.findUnique({ where: { id: checkId } });
  if (!check) throw new Error("Lead not found.");
  const { checks, ai } = checkSummary(check);
  const prices = await displayPrices();
  const { brief } = await salesBrief({
    businessName: check.businessName,
    domain: check.domain,
    city: check.city,
    industry: check.industry,
    siteScore: check.siteScore,
    aiScore: check.aiScore,
    failedChecks: topFixes(checks, 8).map((c) => ({ label: c.label, detail: c.detail })),
    ai,
    prices: { STARTER: prices.STARTER, GROWTH: prices.GROWTH, ELITE: prices.ELITE },
  });
  await db.visibilityCheck.update({ where: { id: checkId }, data: { salesBrief: brief as Prisma.InputJsonValue, salesBriefAt: new Date() } });
  return brief;
}
