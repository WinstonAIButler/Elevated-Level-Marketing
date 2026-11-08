import { db } from "@/lib/db";
import { recordLead } from "@/lib/leads";
import { isElevatedCampaign, normalizeSource } from "@/lib/leads-core";

// Public lead capture for a client's website form, the Elevated form snippet, or any
// tool that can send a webhook (Zapier, Make, Typeform, Jotform...). The key in the URL
// identifies the business. Accepts JSON or regular form posts.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const PER_HOUR = 60;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const pick = (d: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = d[k] ?? d[k.toLowerCase()];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const business = await db.business.findUnique({ where: { leadFormKey: key }, select: { id: true, name: true } });
  if (!business) return Response.json({ ok: false, error: "Unknown form" }, { status: 404, headers: CORS });

  let data: Record<string, unknown> = {};
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) data = (await req.json()) ?? {};
    else data = Object.fromEntries((await req.formData()).entries());
  } catch {
    return Response.json({ ok: false, error: "Couldn't read the form" }, { status: 400, headers: CORS });
  }
  const htmlPost = !type.includes("application/json") && (req.headers.get("accept") ?? "").includes("text/html");
  const done = (status = 200) =>
    htmlPost
      ? new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Thanks</title><body style="font-family:system-ui;padding:40px;text-align:center"><h1>Thanks! We'll be in touch soon.</h1>${typeof data.redirect === "string" && /^https?:\/\//.test(data.redirect) ? `<p><a href="${String(data.redirect).replace(/"/g, "")}">Back to the site</a></p>` : ""}</body>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } })
      : Response.json({ ok: true }, { status, headers: CORS });

  // Bots fill hidden fields; pretend it worked.
  if (pick(data, "_gotcha", "website_url_confirm")) return done();

  const recent = await db.lead.count({ where: { businessId: business.id, origin: { in: ["form", "webhook"] }, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= PER_HOUR) return Response.json({ ok: false, error: "Too many submissions, try again later" }, { status: 429, headers: CORS });

  const name = pick(data, "name", "full_name", "fullName", "Name") ?? [pick(data, "first_name", "firstName", "First Name"), pick(data, "last_name", "lastName", "Last Name")].filter(Boolean).join(" ");
  const email = pick(data, "email", "Email", "email_address", "emailAddress");
  const phone = pick(data, "phone", "Phone", "phone_number", "phoneNumber", "mobile");
  if (!name && !email && !phone) return Response.json({ ok: false, error: "Add a name, email or phone" }, { status: 400, headers: CORS });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ ok: false, error: "That email doesn't look right" }, { status: 400, headers: CORS });

  const utmSource = pick(data, "utm_source");
  const utmCampaign = pick(data, "utm_campaign");
  const message = pick(data, "message", "Message", "comments", "notes", "details");
  const page = pick(data, "page", "page_url");
  await recordLead(business, {
    name: (name || email || phone)!,
    email,
    phone,
    company: pick(data, "company", "Company", "business"),
    source: normalizeSource(utmSource, pick(data, "source", "lead_source", "how_did_you_hear"), pick(data, "referrer"), "website"),
    sourceDetail: utmCampaign ?? page,
    elevated: isElevatedCampaign(utmCampaign),
    notes: [message, page && `Page: ${page}`].filter(Boolean).join("\n") || null,
    origin: data._via === "elevated-form" || data._via === "elevated-capture" ? "form" : "webhook",
  });
  return done();
}
