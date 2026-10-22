// Template content used when no ANTHROPIC_API_KEY is configured, so the whole
// product can be demoed end to end without AI. Output has the same shape as
// the AI schemas in ai.ts.
import type { Business } from "@prisma/client";
import { CATEGORIES, type CategoryId, type CategoryScores, weakestCategories } from "./assessment";
import type { AssessmentInsight, CampaignBrief, CampaignOutput, PlanOutput } from "./ai";

const PLAYBOOK: Record<CategoryId, { fix: string; detail: string; channel: string; tasks: [string, string][] }> = {
  website: {
    fix: "Turn your website into a lead machine",
    detail: "Add a click-to-call button and a single, obvious offer above the fold on every page, then speed up mobile load times.",
    channel: "Website",
    tasks: [
      ["Website conversion audit", "Review every page for a clear call to action and mobile usability."],
      ["Rewrite home page hero", "New headline, subheadline and offer focused on the core audience."],
      ["Add lead capture form", "Short quote/booking form with instant email confirmation."],
    ],
  },
  seo: {
    fix: "Own your local search results",
    detail: "Fully complete your Google Business Profile, post weekly, and build service-area pages targeting your top searches.",
    channel: "Local SEO",
    tasks: [
      ["Optimize Google Business Profile", "Categories, services, hours, photos and Q&A completed."],
      ["Keyword map for top services", "Pick 10 high-intent local searches to target."],
      ["Publish service-area pages", "One page per core service and city."],
    ],
  },
  social: {
    fix: "Post consistently where your customers scroll",
    detail: "Commit to three posts a week on your two best platforms using a repeatable content mix: proof, education, offer.",
    channel: "Social Media",
    tasks: [
      ["Social profile refresh", "Consistent bio, links, cover images and highlights."],
      ["Weekly social content batch", "Three ready-to-post captions with visual ideas."],
      ["Engagement routine", "Reply to comments and DMs daily within 2 hours."],
    ],
  },
  email: {
    fix: "Start a simple email & SMS program",
    detail: "Capture contacts at every touchpoint and send a monthly value email plus a welcome sequence for new leads.",
    channel: "Email",
    tasks: [
      ["Set up email platform and sign-up form", "Connect the website form to the email list."],
      ["Write 3-part welcome sequence", "Introduce the brand, share proof, make an offer."],
      ["Monthly newsletter", "Tips, a customer story and one clear offer."],
    ],
  },
  paid: {
    fix: "Launch tightly targeted paid ads",
    detail: "Start with a small always-on search campaign on your highest-intent keywords and retarget website visitors on Meta.",
    channel: "Paid Ads",
    tasks: [
      ["Set up ad accounts and conversion tracking", "Google Ads and Meta with conversions firing."],
      ["Launch search campaign", "High-intent keywords with call extensions."],
      ["Launch retargeting campaign", "Remind recent visitors of the offer."],
    ],
  },
  content: {
    fix: "Build a recognizable, consistent brand",
    detail: "Document your brand voice, colors and key messages, then publish one helpful piece of content each week.",
    channel: "Content",
    tasks: [
      ["One-page brand guide", "Voice, colors, fonts, logo usage and key messages."],
      ["Content calendar", "12 weeks of topics tied to customer questions."],
      ["Publish helpful article or video", "Answer a top customer question in depth."],
    ],
  },
  reputation: {
    fix: "Turn happy customers into 5-star reviews",
    detail: "Send an automatic review request after every job or purchase and respond to every review within 48 hours.",
    channel: "Reputation",
    tasks: [
      ["Automated review requests", "Text/email with a direct review link after each sale."],
      ["Review response templates", "Friendly responses for positive and negative reviews."],
      ["Showcase reviews on site", "Add a testimonials section to key pages."],
    ],
  },
  analytics: {
    fix: "Measure what's working",
    detail: "Install analytics with conversion tracking and review a simple weekly dashboard of leads, cost per lead and revenue.",
    channel: "Analytics",
    tasks: [
      ["Install analytics and conversion tracking", "Track calls, forms and purchases."],
      ["Build weekly KPI dashboard", "Leads, cost per lead, conversion rate, revenue."],
      ["Monthly results review", "Decide what to scale, fix or stop."],
    ],
  },
};

export function assessmentInsight(b: Business, scores: CategoryScores): AssessmentInsight {
  const order = weakestCategories(scores);
  const strongest = [...order].reverse().slice(0, 2);
  const weakest = order.slice(0, 3);
  return {
    summary: `${b.name} has a foundation to build on, with ${CATEGORIES[strongest[0]].toLowerCase()} as the strongest area. The biggest opportunities are in ${weakest
      .map((c) => CATEGORIES[c].toLowerCase())
      .join(", ")}. Fixing these first will have the fastest impact on ${b.goals.toLowerCase().slice(0, 120)}.`,
    strengths: strongest.map((c) => `${CATEGORIES[c]} scored ${scores[c]}/100, ahead of most areas.`),
    weaknesses: weakest.map((c) => `${CATEGORIES[c]} scored ${scores[c]}/100 and is holding growth back.`),
    recommendations: order.slice(0, 6).map((c, i) => ({
      title: PLAYBOOK[c].fix,
      detail: PLAYBOOK[c].detail,
      category: c,
      priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
    })),
  };
}

export function marketingPlan(b: Business, scores: CategoryScores | null): PlanOutput {
  const focus = scores ? weakestCategories(scores).slice(0, 4) : (["seo", "social", "reputation", "email"] as CategoryId[]);
  const share = [40, 25, 20, 15];
  const tasks: PlanOutput["tasks"] = [];
  focus.forEach((c, i) => {
    PLAYBOOK[c].tasks.forEach(([title, description], j) => {
      tasks.push({
        title,
        description,
        channel: PLAYBOOK[c].channel,
        week: Math.min(12, 1 + i + j * 3),
        owner: j === 0 ? "TEAM" : "AI",
      });
    });
  });
  tasks.push({ title: "Send brand photos and logo files", description: "Upload 10-20 photos of your team, work and space.", channel: "Content", week: 1, owner: "CLIENT" });
  tasks.push({ title: "Approve week-1 content", description: "Review and approve the first batch of posts and copy.", channel: "Social Media", week: 2, owner: "CLIENT" });
  tasks.sort((a, b) => a.week - b.week);

  return {
    title: `${b.name}: 12-Week Growth Plan`,
    summary: `A focused plan for ${b.name} that fixes the biggest gaps first (${focus
      .slice(0, 2)
      .map((c) => CATEGORIES[c].toLowerCase())
      .join(" and ")}) and then builds steady, measurable lead flow from ${b.targetAudience.slice(0, 80)}.`,
    objectives: [
      "Increase qualified leads by 30% within 12 weeks",
      "Publish consistently on every active channel each week",
      "Grow online reviews by 15 or more",
      "Track cost per lead for every paid channel",
    ],
    channelStrategy: focus.map((c) => ({
      channel: PLAYBOOK[c].channel,
      role: PLAYBOOK[c].detail,
      tactics: PLAYBOOK[c].tasks.map(([t]) => t),
    })),
    budgetAllocation: focus.map((c, i) => ({ channel: PLAYBOOK[c].channel, percent: share[i] })),
    kpis: [
      { metric: "Qualified leads / month", target: "+30%" },
      { metric: "Cost per lead", target: "Under $40" },
      { metric: "Google reviews", target: "+15" },
      { metric: "Website conversion rate", target: "3%+" },
    ],
    tasks,
  };
}

export function campaign(b: Business, brief: CampaignBrief): CampaignOutput {
  const offer = brief.offer || "a free consultation";
  const audience = brief.audience || b.targetAudience;
  const has = (k: string) => brief.channels.some((c) => c.toLowerCase().includes(k));
  const social = brief.channels.filter((c) => /instagram|facebook|tiktok|linkedin|\bx\b|twitter|social/i.test(c));
  const ads = brief.channels.filter((c) => /ads|google|meta/i.test(c));
  return {
    name: `${b.name} | ${brief.objective.slice(0, 40)}`,
    bigIdea: `Show ${audience.slice(0, 60)} exactly how ${b.name} solves their problem, and make ${offer} the easy next step.`,
    audience,
    headlines: [
      `${b.name}: ${b.industry} done right`,
      `Claim ${offer} this month`,
      `Why locals choose ${b.name}`,
      `Stop settling. Start with ${b.name}.`,
      `${offer.charAt(0).toUpperCase() + offer.slice(1)}, no strings attached`,
    ],
    adCopy: (ads.length ? ads : ["Google Ads"]).map((channel) => ({
      channel,
      headline: `${b.name} | ${offer}`,
      body: `${b.description.slice(0, 110)} Book today and get ${offer}.`,
      cta: "Book now",
    })),
    socialPosts: (social.length ? social : ["Instagram"]).flatMap((platform) =>
      [0, 3, 7, 10].filter((d) => d < brief.durationDays).map((dayOffset, i) => ({
        platform,
        dayOffset,
        caption: [
          `Meet ${b.name}. ${b.description.slice(0, 120)}`,
          `Here's what our customers say about us. [add a recent review]`,
          `Limited time: ${offer}. Tap the link in our bio to claim it.`,
          `Last chance for ${offer}! Ends soon.`,
        ][i],
        visualIdea: ["Team photo at work", "Customer review graphic", "Offer graphic in brand colors", "Countdown story"][i],
        hashtags: [b.industry.replace(/\W+/g, ""), b.location?.replace(/\W+/g, "") || "SmallBusiness", "ShopLocal"],
      })),
    ),
    emails: has("email")
      ? [
          { subject: `A little something from ${b.name}`, previewText: `Claim ${offer}`, body: `Hi [first name],\n\n${b.description}\n\nFor a limited time we're offering ${offer}. Reply to this email or book online to claim it.\n\nThanks,\nThe ${b.name} team` },
          { subject: `Last chance: ${offer}`, previewText: "Ends this week", body: `Hi [first name],\n\nJust a reminder that ${offer} ends soon. Book now: [link]\n\nThe ${b.name} team` },
        ]
      : [],
    landingPage: {
      headline: `${offer.charAt(0).toUpperCase() + offer.slice(1)} from ${b.name}`,
      subheadline: b.description.slice(0, 160),
      bullets: ["Trusted by local customers", "Fast, friendly service", "No-pressure consultation"],
      cta: `Claim ${offer}`,
    },
    kpis: [
      { metric: "Leads", target: "25+" },
      { metric: "Cost per lead", target: brief.budget ? `$${Math.max(10, Math.round(brief.budget / 25))}` : "n/a" },
      { metric: "Landing page conversion", target: "8%+" },
    ],
  };
}
