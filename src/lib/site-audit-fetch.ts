import "server-only";
import { lookup } from "node:dns/promises";
import type { Business } from "@prisma/client";
import { db } from "./db";
import { analyzeWebsite, isPrivateAddress, normalizeWebsite, scoreChecks, type AuditCheck } from "./site-audit";
import { logActivity } from "./usage";

const USER_AGENT = "ElevatedAuditBot/1.0 (+https://elevatedlevel.app/llms.txt)";
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 4;

/** Refuses anything that resolves to a private or loopback address (SSRF guard). */
async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https websites can be audited.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Websites on custom ports can't be audited.");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => {
    throw new Error(`We couldn't find ${url.hostname}. Check the website address in your business profile.`);
  });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("That website address points to a private network and can't be audited.");
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

/** GET with manual redirects so every hop is checked against the SSRF guard. */
async function safeGet(start: URL, timeoutMs = 12_000): Promise<{ status: number; url: URL; body: string } | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain,application/xml;q=0.9,*/*;q=0.5" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch {
      return null;
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return { status: res.status, url, body: await readCapped(res) };
  }
  throw new Error("The website redirects too many times to audit.");
}

export type WebsiteAuditResult = { url: string; score: number; checks: AuditCheck[] };

export async function auditWebsite(raw: string): Promise<WebsiteAuditResult> {
  const start = normalizeWebsite(raw);
  if (!start) throw new Error("Add a valid website address (like yourbusiness.com) to your business profile first.");

  const page = await safeGet(start);
  if (!page) throw new Error(`We couldn't reach ${start.host}. Check that the site is online and try again.`);
  if (page.status >= 400) throw new Error(`${page.url.host} responded with an error (HTTP ${page.status}).`);

  const origin = page.url.origin;
  const [robots, sitemap, llms] = await Promise.all([
    safeGet(new URL("/robots.txt", origin), 6000).catch(() => null),
    safeGet(new URL("/sitemap.xml", origin), 6000).catch(() => null),
    safeGet(new URL("/llms.txt", origin), 6000).catch(() => null),
  ]);
  const ok = (r: typeof robots) => Boolean(r && r.status >= 200 && r.status < 300 && !/^\s*<!doctype html|^\s*<html/i.test(r.body));
  const robotsTxt = robots && ok(robots) ? robots.body : null;
  const hasSitemap = Boolean((sitemap && ok(sitemap) && /<(urlset|sitemapindex)\b/i.test(sitemap.body)) || /^\s*sitemap\s*:/im.test(robotsTxt ?? ""));
  const hasLlmsTxt = Boolean(llms && ok(llms) && llms.body.trim().length > 20);

  const checks = analyzeWebsite({ url: page.url.toString(), html: page.body, robotsTxt, hasSitemap, hasLlmsTxt });
  return { url: page.url.toString(), score: scoreChecks(checks), checks };
}

/** Audits the business website, saves the result and logs the score change. */
export async function runWebsiteAudit(business: Business) {
  const previous = await db.websiteAudit.findFirst({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
  });
  const result = await auditWebsite(business.website ?? "");
  const audit = await db.websiteAudit.create({
    data: { businessId: business.id, url: result.url, score: result.score, checks: result.checks },
  });
  const delta = previous ? result.score - previous.score : null;
  await logActivity(
    business.id,
    "website",
    `Website audit: ${result.score}/100${delta ? ` (${delta > 0 ? "+" : ""}${delta} since last check)` : ""}`,
  );
  return audit;
}
