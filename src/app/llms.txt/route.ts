import { CONTACT_EMAIL, FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { AD_SPEND_NOTE, PAID_TIERS, TIERS } from "@/lib/tiers";

export const dynamic = "force-static";

// llms.txt (https://llmstxt.org): a plain summary AI assistants can quote accurately.
export function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} is built for local service businesses, retailers, clinics, restaurants, professional firms and growing brands that need consistent marketing without a full-time marketing team or agency retainer.

## What it does

- Marketing assessment: scores a business's marketing 0-100 across 8 areas (website and conversion, search and local SEO, social media, email, paid advertising, content and brand, reviews, tracking and analytics) with prioritized fixes.
- 12-week marketing plan: objectives, channel strategy, budget split, KPIs and a week-by-week task list.
- AI campaign studio: ad copy, social posts, emails and landing page copy from a one-sentence brief.
- Weekly autopilot: drafts a new content batch, starts automated plan tasks, re-audits the client's website for SEO and AI search visibility, and flags tasks waiting on the owner. Nothing is published without the owner's approval.
- Website and AI visibility audit: checks the signals search engines and AI assistants use (structured data, crawler access, titles, sitemap, llms.txt, mobile, calls to action).

## Pricing (USD per month)

- ${TIERS.TRIAL.name}: free, no card required (${TIERS.TRIAL.features.join(", ")})
${PAID_TIERS.map((t) => `- ${t.name}: $${t.price} (${t.features.join(", ")})`).join("\n")}

${AD_SPEND_NOTE}

## FAQ

${FAQ.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}

## Links

- [Home](${SITE_URL}/)
- [Pricing](${SITE_URL}/#pricing)
- [Start a free assessment](${SITE_URL}/signup)
- [Privacy Policy](${SITE_URL}/privacy)
- [Terms of Service](${SITE_URL}/terms)
- Contact: ${CONTACT_EMAIL}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
