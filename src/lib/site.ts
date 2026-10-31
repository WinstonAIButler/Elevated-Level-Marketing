// Public facts about the company, shared by page metadata, structured data,
// llms.txt and the legal pages so they never drift apart.
import { PAID_TIERS, TIERS } from "./tiers";

export const SITE_NAME = "Elevated Digital Marketing";
export const SITE_URL = (process.env.APP_URL || "https://elevatedlevel.app").replace(/\/$/, "");
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "support@elevatedlevel.app";

export const SITE_DESCRIPTION =
  "Elevated Digital Marketing is an AI-powered marketing service for small and mid-sized businesses. It scores your marketing, builds a 12-week plan, writes your campaigns and keeps producing new content every week.";

export const SITE_TAGLINE = "Marketing that runs itself";

/** Answer-first FAQ. Rendered on the home page and emitted as FAQPage structured data. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Elevated Digital Marketing?",
    a: "Elevated Digital Marketing is an AI-powered marketing service for small and mid-sized businesses. You answer a short questionnaire, and the platform scores your marketing, builds a 12-week marketing plan, writes ready-to-use campaigns and keeps drafting new content every week on autopilot.",
  },
  {
    q: "How much does it cost?",
    a: `There is a free trial with no card required. Paid plans are ${PAID_TIERS.map((t) => `${t.name} at $${t.price}`).join(", ")} per month. Plan prices do not include ad spend: you pay Google, Meta and other ad platforms directly for any ads you choose to run.`,
  },
  {
    q: "Who is it for?",
    a: "Local service businesses, retailers, clinics, restaurants, home services, professional firms and growing brands that need consistent marketing but do not have a full-time marketing team or an agency retainer.",
  },
  {
    q: "What does the marketing assessment cover?",
    a: "The assessment scores your marketing from 0 to 100 across 8 areas, including local SEO, your website, social media, reviews, email, paid ads and tracking. It explains your strengths, your biggest gaps and the fixes that will matter most.",
  },
  {
    q: "What happens on autopilot each week?",
    a: "Every week the platform drafts a new content batch from your plan, starts the tasks it can do automatically, re-checks your website for SEO and AI search visibility issues and lists anything that is waiting on you. Nothing is published to your accounts without your approval.",
  },
  {
    q: "Does it help my business show up in AI search like ChatGPT and Google AI Overviews?",
    a: "Yes. The website audit checks the signals AI assistants and search engines rely on, such as structured data, crawlability, clear page titles and an llms.txt file, and tells you exactly what to fix.",
  },
  {
    q: "Do you guarantee results?",
    a: "No. Marketing results depend on your market, offer, budget and follow-through, so no honest provider can guarantee rankings, leads or revenue. We give you a clear plan, the content to execute it and a weekly score so you can see progress.",
  },
  {
    q: "Can I cancel anytime?",
    a: `Yes. Paid plans renew monthly until you cancel, and you can cancel online at any time from the Billing page. ${TIERS.TRIAL.name} accounts are never charged.`,
  },
];
