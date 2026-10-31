// Website audit: rule-based checks for search (SEO) and AI-assistant visibility
// (ChatGPT, Claude, Perplexity, Google AI Overviews). Pure functions only, so
// the scoring is deterministic and unit-tested. Fetching lives in
// site-audit-fetch.ts.

export type AuditCategory = "seo" | "ai" | "technical" | "conversion";

export type AuditCheck = {
  id: string;
  label: string;
  category: AuditCategory;
  weight: number;
  passed: boolean;
  detail: string;
  fix: string;
};

export type AuditInput = {
  /** URL that was finally loaded after redirects. */
  url: string;
  html: string;
  /** robots.txt body, or null when the site has none. */
  robotsTxt: string | null;
  hasSitemap: boolean;
  hasLlmsTxt: boolean;
};

export const AUDIT_CATEGORIES: Record<AuditCategory, string> = {
  seo: "Search basics",
  ai: "AI search visibility",
  technical: "Technical health",
  conversion: "Conversion",
};

/** Crawlers that feed AI assistants and AI search answers. */
export const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

const BUSINESS_TYPES =
  /"@type"\s*:\s*\[?\s*"(LocalBusiness|Organization|Corporation|ProfessionalService|Store|Restaurant|MedicalBusiness|Dentist|Physician|LegalService|HomeAndConstructionBusiness|AutomotiveBusiness|HealthAndBeautyBusiness|FinancialService|RealEstateAgent|FoodEstablishment|LodgingBusiness|SportsActivityLocation|EntertainmentBusiness|Plumber|Electrician|HVACBusiness|RoofingContractor|GeneralContractor|Locksmith|MovingCompany|HairSalon|BeautySalon|DaySpa|AutoRepair|Attorney|Accountant|InsuranceAgency|VeterinaryCare|ChildCare|EducationalOrganization|NGO)"/;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const n = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    if (n === key) return attr(tag, "content");
  }
  return null;
}

function visibleText(html: string) {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

/** True when robots.txt stops `agent` from crawling the whole site. */
export function robotsBlocks(robotsTxt: string, agent: string): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const name = agent.toLowerCase();
  const group =
    groups.find((g) => g.agents.some((a) => a !== "*" && name.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return false;
  const blocksRoot = group.rules.some((r) => !r.allow && r.path === "/");
  const allowsRoot = group.rules.some((r) => r.allow && (r.path === "/" || r.path === "/$"));
  return blocksRoot && !allowsRoot;
}

export function analyzeWebsite(input: AuditInput): AuditCheck[] {
  const { html } = input;
  // Some frameworks stream metadata after </head>, so search the whole document.
  const head = html;
  const checks: AuditCheck[] = [];
  const add = (c: AuditCheck) => checks.push(c);

  const https = input.url.startsWith("https://");
  add({
    id: "https",
    label: "Secure (HTTPS) connection",
    category: "technical",
    weight: 10,
    passed: https,
    detail: https ? "The site loads over HTTPS." : "The site loads over plain HTTP.",
    fix: "Install an SSL certificate (free with most hosts) and redirect every http:// address to https://.",
  });

  const robotsMeta = (metaContent(head, "robots") ?? "").toLowerCase();
  const noindex = robotsMeta.includes("noindex");
  add({
    id: "indexable",
    label: "Page can appear in search results",
    category: "seo",
    weight: 10,
    passed: !noindex,
    detail: noindex ? "A robots meta tag tells search engines not to index this page." : "No noindex tag found.",
    fix: 'Remove `<meta name="robots" content="noindex">` from the home page (it is often left on after a site launch).',
  });

  const title = decode(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  add({
    id: "title",
    label: "Page title (15-65 characters)",
    category: "seo",
    weight: 10,
    passed: title.length >= 15 && title.length <= 65,
    detail: title ? `"${title}" (${title.length} characters).` : "The page has no <title>.",
    fix: "Write a title that names your main service and city plus your business name, e.g. \"Emergency Plumber in Austin | Smith Plumbing\".",
  });

  const description = metaContent(head, "description") ?? "";
  add({
    id: "description",
    label: "Meta description (50-160 characters)",
    category: "seo",
    weight: 8,
    passed: description.length >= 50 && description.length <= 160,
    detail: description ? `${description.length} characters.` : "No meta description.",
    fix: "Add a one-sentence summary of what you do, for whom and where, ending with a reason to click.",
  });

  const h1s = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) ?? [];
  add({
    id: "h1",
    label: "One main heading (H1)",
    category: "seo",
    weight: 6,
    passed: h1s.length === 1,
    detail: `${h1s.length} H1 heading${h1s.length === 1 ? "" : "s"} found.`,
    fix: "Use exactly one H1 that states what the business does, and use H2/H3 for sections.",
  });

  const canonical = (head.match(/<link\b[^>]*>/gi) ?? []).some((t) => (attr(t, "rel") ?? "").toLowerCase() === "canonical");
  add({
    id: "canonical",
    label: "Canonical URL",
    category: "seo",
    weight: 4,
    passed: canonical,
    detail: canonical ? "A canonical link is set." : "No canonical link.",
    fix: 'Add `<link rel="canonical" href="https://yourdomain.com/">` so search engines know the preferred address.',
  });

  add({
    id: "sitemap",
    label: "XML sitemap",
    category: "seo",
    weight: 6,
    passed: input.hasSitemap,
    detail: input.hasSitemap ? "A sitemap was found." : "No sitemap at /sitemap.xml or in robots.txt.",
    fix: "Publish /sitemap.xml (most website builders have a setting for it) and submit it in Google Search Console.",
  });

  const ogTitle = metaContent(head, "og:title");
  const ogImage = metaContent(head, "og:image");
  add({
    id: "social-preview",
    label: "Social share preview (Open Graph)",
    category: "seo",
    weight: 4,
    passed: Boolean(ogTitle && ogImage),
    detail: ogTitle && ogImage ? "Open Graph title and image are set." : "Missing og:title or og:image.",
    fix: "Add og:title, og:description and a 1200x630 og:image so links shared on Facebook, LinkedIn and texts show a rich preview.",
  });

  const jsonLd = html.match(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  add({
    id: "structured-data",
    label: "Structured data (schema.org JSON-LD)",
    category: "ai",
    weight: 10,
    passed: jsonLd.length > 0,
    detail: jsonLd.length ? `${jsonLd.length} JSON-LD block${jsonLd.length === 1 ? "" : "s"} found.` : "No JSON-LD structured data.",
    fix: "Add schema.org JSON-LD so search engines and AI assistants can read your business facts reliably.",
  });

  const businessSchema = jsonLd.some((block) => BUSINESS_TYPES.test(block));
  add({
    id: "business-schema",
    label: "Business details in structured data",
    category: "ai",
    weight: 8,
    passed: businessSchema,
    detail: businessSchema ? "LocalBusiness/Organization markup found." : "No LocalBusiness or Organization markup.",
    fix: "Add LocalBusiness (or Organization) JSON-LD with your name, address, phone, hours, service area and social profiles.",
  });

  const faqSchema = jsonLd.some((block) => /"FAQPage"/.test(block));
  add({
    id: "faq",
    label: "Question-and-answer content",
    category: "ai",
    weight: 4,
    passed: faqSchema || /<h[23]\b[^>]*>[^<]*\?\s*<\/h[23]>/i.test(html),
    detail: faqSchema ? "FAQPage markup found." : "No FAQ-style questions found on the page.",
    fix: "Add an FAQ answering the questions customers ask (price, area served, timing). AI assistants quote clear answers.",
  });

  const blockedBots = input.robotsTxt ? AI_CRAWLERS.filter((bot) => robotsBlocks(input.robotsTxt!, bot)) : [];
  const blockedAll = input.robotsTxt ? robotsBlocks(input.robotsTxt, "Googlebot") : false;
  add({
    id: "crawlers",
    label: "Search and AI crawlers allowed",
    category: "ai",
    weight: 8,
    passed: blockedBots.length === 0 && !blockedAll,
    detail: blockedAll
      ? "robots.txt blocks search engines from the whole site."
      : blockedBots.length
        ? `robots.txt blocks ${blockedBots.join(", ")}.`
        : "No search or AI crawlers are blocked.",
    fix: "Edit robots.txt so it does not `Disallow: /` for Googlebot, GPTBot, ClaudeBot, PerplexityBot or Google-Extended, unless you deliberately want to stay out of AI answers.",
  });

  add({
    id: "llms-txt",
    label: "llms.txt summary for AI assistants",
    category: "ai",
    weight: 3,
    passed: input.hasLlmsTxt,
    detail: input.hasLlmsTxt ? "An llms.txt file was found." : "No /llms.txt file.",
    fix: "Publish a short /llms.txt describing who you are, what you offer, where, and links to your key pages.",
  });

  const words = visibleText(html).split(" ").filter((w) => /[a-z]/i.test(w)).length;
  add({
    id: "content-depth",
    label: "Enough text to describe the business",
    category: "ai",
    weight: 5,
    passed: words >= 250,
    detail: `About ${words} words of visible text on the home page.`,
    fix: "Aim for 300+ words on the home page covering your services, the areas you serve and why customers choose you.",
  });

  const viewport = Boolean(metaContent(head, "viewport"));
  add({
    id: "mobile",
    label: "Mobile friendly (viewport tag)",
    category: "technical",
    weight: 8,
    passed: viewport,
    detail: viewport ? "A viewport meta tag is set." : "No viewport meta tag, so phones show a zoomed-out desktop page.",
    fix: 'Add `<meta name="viewport" content="width=device-width, initial-scale=1">`.',
  });

  const lang = /<html\b[^>]*\blang\s*=/i.test(html);
  add({
    id: "lang",
    label: "Page language declared",
    category: "technical",
    weight: 2,
    passed: lang,
    detail: lang ? "The <html> tag declares a language." : "No lang attribute on <html>.",
    fix: 'Add `lang="en"` (or your language) to the <html> tag for accessibility and correct search targeting.',
  });

  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const withAlt = imgs.filter((t) => attr(t, "alt") !== null).length;
  const altShare = imgs.length ? withAlt / imgs.length : 1;
  add({
    id: "alt-text",
    label: "Images have alt text",
    category: "technical",
    weight: 4,
    passed: altShare >= 0.9,
    detail: imgs.length ? `${withAlt} of ${imgs.length} images have alt text.` : "No images on the page.",
    fix: "Describe each meaningful image in its alt text (and use alt=\"\" for decorative ones). It helps accessibility and image search.",
  });

  const phone = /href\s*=\s*["']tel:/i.test(html) || /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(visibleText(html));
  add({
    id: "contact",
    label: "Phone number or click-to-call",
    category: "conversion",
    weight: 5,
    passed: phone,
    detail: phone ? "A phone number or tel: link was found." : "No phone number found on the home page.",
    fix: "Show your phone number near the top of the page as a tap-to-call link (`<a href=\"tel:+15555555555\">`).",
  });

  const cta = /<form\b/i.test(html) || /(book|schedule|get a quote|free quote|contact us|call now|request|order now|buy now|reserve)/i.test(visibleText(html));
  add({
    id: "cta",
    label: "Clear call to action",
    category: "conversion",
    weight: 5,
    passed: cta,
    detail: cta ? "A form or call-to-action wording was found." : "No form or call to action found.",
    fix: "Add one obvious next step above the fold, such as \"Book a free estimate\" or \"Get a quote\".",
  });

  return checks;
}

export function scoreChecks(checks: AuditCheck[]): number {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  return total ? Math.round((earned / total) * 100) : 0;
}

/** Failed checks, most important first. */
export function topFixes(checks: AuditCheck[], limit = 5): AuditCheck[] {
  return checks.filter((c) => !c.passed).sort((a, b) => b.weight - a.weight).slice(0, limit);
}

/** Normalises what a client typed ("acme.com", "http://acme.com/") into a URL, or null. */
export function normalizeWebsite(raw: string | null | undefined): URL | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/** True for loopback, private, link-local and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}
