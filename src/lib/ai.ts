import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Business } from "@prisma/client";
import { CATEGORIES, type CategoryId, type CategoryScores, QUESTIONS, type Answers } from "./assessment";
import * as demo from "./demo-content";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic({ timeout: 5 * 60 * 1000 });
  return client;
}

const SYSTEM = `You are the strategy engine behind Elevated Digital Marketing, an agency that runs marketing for small and mid-sized businesses.
Write for the business owner: plain language, specific to their industry, location, audience and budget, and immediately actionable.
Never invent facts about the business (awards, statistics, customer counts, prices) that were not provided. Where a detail is unknown, write copy with a clearly marked placeholder in square brackets, e.g. [your phone number].
Keep recommendations realistic for the stated monthly budget.

Compliance rules for everything you write (the client publishes it under their name):
- No guarantees of results, rankings, income or outcomes, and no "best", "#1" or "cheapest" claims unless the business supplied proof.
- No invented testimonials, reviews, ratings, customer names, before/after results or endorsements. Use a placeholder like [customer review] instead.
- No fake urgency or scarcity (countdowns, "only 2 left") unless the brief states a real deadline or limit.
- Health, medical, legal, financial, insurance, housing, employment and credit offers: avoid outcome promises and follow ad-platform special-category rules (no targeting by age, gender, ZIP or other protected traits for housing, employment or credit ads).
- Marketing emails must end with a footer placeholder: [Business name, postal address] and [Unsubscribe link].
- Influencer or partner posts must include a clear #ad or "Paid partnership" disclosure.
- Respect platform ad policies (Google, Meta, TikTok) and do not mention a person's personal attributes in ad copy ("Are you struggling with debt?").`;

/** Turns API failures into a message clients can read; the details go to the server log. */
function friendlyAiError(err: unknown): Error {
  if (err instanceof Anthropic.APIError) {
    console.error("Claude API error", err.status, err.message);
    if (err.status === 429 || err.status === 529) return new Error("Our AI is busy right now. Please try again in a minute.");
    if (err.status === 401 || err.status === 403) return new Error("Our AI service isn't available right now. Please try again later or contact support.");
    return new Error("Our AI service had a problem. Please try again in a moment.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    console.error("Claude connection error", err.message);
    return new Error("We couldn't reach our AI service. Please try again in a moment.");
  }
  return err instanceof Error ? err : new Error("Something went wrong. Please try again.");
}

async function generate<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T>> {
  let response;
  try {
    response = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    throw friendlyAiError(err);
  }
  if (response.stop_reason === "refusal") {
    throw new Error("The AI declined this request. Try rewording your business details or campaign brief.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("The AI response was incomplete. Please try again.");
  }
  return response.parsed_output as z.infer<T>;
}

function describeBusiness(b: Business) {
  return [
    `Business: ${b.name}`,
    `Industry: ${b.industry}`,
    b.location && `Location / service area: ${b.location}`,
    b.website && `Website: ${b.website}`,
    `What they do: ${b.description}`,
    `Target audience: ${b.targetAudience}`,
    `Goals: ${b.goals}`,
    b.brandVoice && `Brand voice: ${b.brandVoice}`,
    b.competitors && `Competitors: ${b.competitors}`,
    `Monthly marketing budget (USD, excluding our fee): ${b.monthlyBudget}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Assessment insight

const Priority = z.enum(["high", "medium", "low"]);
const CategoryEnum = z.enum(Object.keys(CATEGORIES) as [CategoryId, ...CategoryId[]]);

export const AssessmentInsight = z.object({
  summary: z.string().describe("3-5 sentence executive summary of where their marketing stands"),
  strengths: z.array(z.string()).describe("2-4 strengths"),
  weaknesses: z.array(z.string()).describe("2-4 biggest gaps"),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string().describe("What to do and why, 1-3 sentences"),
        category: CategoryEnum,
        priority: Priority,
      }),
    )
    .describe("5-8 recommendations, highest impact first"),
});
export type AssessmentInsight = z.infer<typeof AssessmentInsight>;

export async function assessmentInsight(
  business: Business,
  answers: Answers,
  scores: CategoryScores,
  overall: number,
): Promise<{ insight: AssessmentInsight; ai: boolean }> {
  if (!aiEnabled()) return { insight: demo.assessmentInsight(business, scores), ai: false };

  const answered = QUESTIONS.map((q) => {
    const idx = answers[q.id];
    return `- [${CATEGORIES[q.category]}] ${q.text} -> ${idx === undefined ? "No answer" : q.options[idx].label}`;
  }).join("\n");
  const scoreLines = (Object.keys(scores) as CategoryId[])
    .map((id) => `- ${CATEGORIES[id]}: ${scores[id]}/100`)
    .join("\n");

  const insight = await generate(
    AssessmentInsight,
    `Analyze this marketing assessment.\n\n${describeBusiness(business)}\n\nQuestionnaire answers:\n${answered}\n\nCategory scores:\n${scoreLines}\nOverall: ${overall}/100`,
  );
  return { insight, ai: true };
}

// ---------------------------------------------------------------------------
// Marketing plan

export const PlanOutput = z.object({
  title: z.string(),
  summary: z.string().describe("2-4 sentence overview of the strategy"),
  objectives: z.array(z.string()).describe("3-5 measurable objectives for the 12 weeks"),
  channelStrategy: z.array(
    z.object({
      channel: z.string(),
      role: z.string().describe("Why this channel, in one sentence"),
      tactics: z.array(z.string()),
    }),
  ),
  budgetAllocation: z
    .array(z.object({ channel: z.string(), percent: z.number() }))
    .describe("Split of the monthly budget; percents sum to 100"),
  kpis: z.array(z.object({ metric: z.string(), target: z.string() })),
  tasks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        channel: z.string(),
        week: z.number().int().describe("Week number 1-12"),
        owner: z.enum(["AI", "CLIENT", "TEAM"]).describe(
          "AI = content/copy we generate automatically, CLIENT = needs the owner (photos, approvals, access), TEAM = Elevated staff setup work",
        ),
      }),
    )
    .describe("20-36 concrete tasks spread across the 12 weeks"),
});
export type PlanOutput = z.infer<typeof PlanOutput>;

export async function marketingPlan(
  business: Business,
  assessment: { scores: CategoryScores; overallScore: number; recommendations: unknown } | null,
): Promise<{ plan: PlanOutput; ai: boolean }> {
  if (!aiEnabled()) return { plan: demo.marketingPlan(business, assessment?.scores ?? null), ai: false };

  const assessmentText = assessment
    ? `Latest assessment (overall ${assessment.overallScore}/100):\n${(Object.keys(assessment.scores) as CategoryId[])
        .map((id) => `- ${CATEGORIES[id]}: ${assessment.scores[id]}/100`)
        .join("\n")}\nRecommendations: ${JSON.stringify(assessment.recommendations)}`
    : "No assessment has been completed yet; infer priorities from the business profile.";

  const plan = await generate(
    PlanOutput,
    `Create a 12-week marketing plan we will execute for this client.\n\n${describeBusiness(business)}\n\n${assessmentText}`,
  );
  plan.tasks = plan.tasks.map((t) => ({ ...t, week: Math.min(12, Math.max(1, Math.round(t.week))) }));
  return { plan, ai: true };
}

// ---------------------------------------------------------------------------
// Campaigns

export const CampaignBrief = z.object({
  objective: z.string().min(3),
  channels: z.array(z.string()).min(1),
  offer: z.string().optional(),
  audience: z.string().optional(),
  budget: z.number().int().nonnegative().default(0),
  durationDays: z.number().int().positive().default(14),
  notes: z.string().optional(),
});
export type CampaignBrief = z.infer<typeof CampaignBrief>;

export const CampaignOutput = z.object({
  name: z.string(),
  bigIdea: z.string().describe("The campaign concept in one or two sentences"),
  audience: z.string(),
  headlines: z.array(z.string()).describe("5 headline options"),
  adCopy: z.array(
    z.object({ channel: z.string(), headline: z.string(), body: z.string(), cta: z.string() }),
  ),
  socialPosts: z.array(
    z.object({
      platform: z.string(),
      dayOffset: z.number().int().describe("Days after campaign start to publish"),
      caption: z.string(),
      visualIdea: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
  emails: z.array(z.object({ subject: z.string(), previewText: z.string(), body: z.string() })),
  landingPage: z.object({
    headline: z.string(),
    subheadline: z.string(),
    bullets: z.array(z.string()),
    cta: z.string(),
  }),
  kpis: z.array(z.object({ metric: z.string(), target: z.string() })),
  complianceNotes: z
    .array(z.string())
    .describe("2-5 short things the owner must check or fill in before publishing (claims to verify, placeholders, required disclosures, ad-policy risks)"),
});
export type CampaignOutput = z.infer<typeof CampaignOutput>;

export async function campaign(
  business: Business,
  brief: CampaignBrief,
): Promise<{ campaign: CampaignOutput; ai: boolean }> {
  if (!aiEnabled()) return { campaign: demo.campaign(business, brief), ai: false };

  const out = await generate(
    CampaignOutput,
    `Create a ready-to-launch marketing campaign.\n\n${describeBusiness(business)}\n\nCampaign brief:\n- Objective: ${brief.objective}\n- Channels: ${brief.channels.join(", ")}\n- Offer: ${brief.offer || "none specified"}\n- Audience focus: ${brief.audience || "the business's core audience"}\n- Ad budget: $${brief.budget}\n- Duration: ${brief.durationDays} days\n- Notes: ${brief.notes || "none"}\n\nOnly include ad copy, social posts and emails for the channels listed (an email channel means emails; social platforms mean posts; Google/Meta/TikTok ads mean ad copy). Spread social posts across the campaign duration.`,
  );
  return { campaign: out, ai: true };
}

// ---------------------------------------------------------------------------
// Ad budget allocation

const ProviderEnum = z.enum(["META", "GOOGLE_ADS", "LINKEDIN", "TIKTOK", "X"]);

export const AllocationOutput = z.object({
  summary: z.string().describe("2-3 sentences for the owner: how the budget is split and why, in plain language"),
  splits: z.array(
    z.object({
      provider: ProviderEnum,
      percent: z.number().describe("Share of the monthly ad budget, whole number; all splits sum to 100"),
      reason: z.string().describe("1-2 sentences: why this channel gets this share, citing their goals, audience or the performance numbers given"),
      expectedResult: z.string().describe("What this money should produce, e.g. 'calls and quote requests from local searchers'. No guaranteed numbers."),
    }),
  ),
});
export type AllocationOutput = z.infer<typeof AllocationOutput>;

export async function budgetAllocation(
  business: Business,
  context: {
    totalCents: number;
    maxChannels: number;
    baseline: { provider: string; percent: number }[];
    perf: { provider: string; spendCents: number; clicks: number; conversions: number }[];
    plan: { channel: string; role: string }[];
    clientNote?: string | null;
  },
): Promise<AllocationOutput | null> {
  if (!aiEnabled()) return null;
  const perfText = context.perf.length
    ? context.perf
        .map((p) => `- ${p.provider}: spent $${(p.spendCents / 100).toFixed(2)}, ${p.clicks} clicks, ${p.conversions} conversions`)
        .join("\n")
    : "No ad results yet (first month).";
  return generate(
    AllocationOutput,
    `Split this client's monthly ad budget across ad platforms so it does the most for their goals.\n\n${describeBusiness(business)}\n\nMonthly ad budget: $${(context.totalCents / 100).toFixed(2)}. Use at most ${context.maxChannels} platform(s); a platform needs at least $150/month to learn, so concentrate small budgets.\nAvailable platforms: META (Facebook + Instagram ads), GOOGLE_ADS (Search ads), LINKEDIN, TIKTOK (needs video), X.\n\nTheir marketing plan's channel strategy:\n${context.plan.map((c) => `- ${c.channel}: ${c.role}`).join("\n") || "none yet"}\n\nLast 30 days of ad results:\n${perfText}\n\nRule-based starting point (adjust it if you have a good reason):\n${context.baseline.map((b) => `- ${b.provider}: ${b.percent}%`).join("\n") || "none"}\n${context.clientNote ? `\nThe owner rejected the last split and said: "${context.clientNote}". Address this directly.` : ""}\nThe owner approves this before any money is spent, so explain each share clearly.`,
  );
}

// ---------------------------------------------------------------------------
// Ad creative for one platform

export const AdCreativeOutput = z.object({
  campaignName: z.string(),
  headlines: z.array(z.string()).describe("Google: 8-15 headlines, each 30 characters or fewer. Others: 3-5 headlines, 40 characters or fewer"),
  descriptions: z.array(z.string()).describe("Google: 3-4 descriptions, each 90 characters or fewer. Others: 2-3"),
  primaryText: z.string().describe("Main ad text for social ads, 125 characters or fewer ideally"),
  callToAction: z.enum(["LEARN_MORE", "CONTACT_US", "SIGN_UP", "BOOK_NOW", "GET_QUOTE", "SHOP_NOW", "CALL_NOW"]),
  keywords: z.array(z.string()).describe("Google only: 10-20 phrase-match keywords people would search; empty for other platforms"),
  imageIdea: z.string().describe("Description of the image or video to use"),
});
export type AdCreativeOutput = z.infer<typeof AdCreativeOutput>;

export async function adCreative(
  business: Business,
  provider: string,
  monthlyCents: number,
  source: CampaignOutput | null,
): Promise<{ creative: AdCreativeOutput; ai: boolean }> {
  if (!aiEnabled()) return { creative: demo.adCreative(business, provider, source), ai: false };
  const sourceText = source
    ? `Use the client's current campaign as the starting point:\nBig idea: ${source.bigIdea}\nHeadlines: ${source.headlines.join(" | ")}\nLanding page: ${source.landingPage.headline}: ${source.landingPage.subheadline}`
    : "No campaign yet; write from the business profile.";
  const creative = await generate(
    AdCreativeOutput,
    `Write ready-to-launch ${provider} ad creative for a $${(monthlyCents / 100).toFixed(0)}/month budget.\n\n${describeBusiness(business)}\n\n${sourceText}\n\nThe ad sends people to ${business.website || "[website URL]"}. Respect the character limits exactly.`,
  );
  if (provider === "GOOGLE_ADS") {
    creative.headlines = creative.headlines.map((h) => h.slice(0, 30)).filter(Boolean).slice(0, 15);
    creative.descriptions = creative.descriptions.map((d) => d.slice(0, 90)).filter(Boolean).slice(0, 4);
  }
  return { creative, ai: true };
}

// ---------------------------------------------------------------------------
// AI search visibility test: does the business come up when customers ask an AI
// assistant? Claude runs real web searches the way an assistant would and reports
// who it would recommend.

export const AiVisibility = z.object({
  queries: z
    .array(
      z.object({
        query: z.string(),
        mentioned: z.boolean(),
        rank: z.number().nullable(),
        recommended: z.array(z.string()),
      }),
    )
    .min(1),
  competitors: z.array(z.object({ name: z.string(), why: z.string() })),
  summary: z.string(),
  reasons: z.array(z.string()),
});
export type AiVisibility = z.infer<typeof AiVisibility>;

export function aiVisibilityScore(r: AiVisibility) {
  const per: number[] = r.queries.map((q) => (!q.mentioned ? 0 : q.rank === 1 ? 100 : q.rank && q.rank <= 3 ? 80 : 55));
  return Math.round(per.reduce((a, b) => a + b, 0) / per.length);
}

export async function aiVisibilityTest(input: { businessName: string; domain: string; city: string; industry: string }) {
  if (!aiEnabled()) return null;
  const system = `You test how visible a local business is when potential customers ask AI assistants and search engines for recommendations. Be factual: only name businesses that actually appear in your search results. Never invent rankings or businesses.`;
  const prompt = `Business: ${input.businessName}
Website: ${input.domain}
Location: ${input.city}
What they do: ${input.industry}

1. Write 3 realistic questions a potential customer in ${input.city} would ask an AI assistant when looking for this kind of business. Don't use the business's name. Mix a "best ${input.industry} in ${input.city}" style question with more specific needs.
2. For each question, use web search the way an AI assistant would, and decide which businesses you would recommend (up to 5, best first).
3. For each question, note whether ${input.businessName} (or ${input.domain}) is among them and at what rank.
4. List the competitors that come up most and briefly why they appear (reviews, listings, content, directories).
5. Give 2-4 likely reasons ${input.businessName} is or isn't showing up.

Reply with only this JSON inside <result></result> tags:
{"queries":[{"query":"...","mentioned":false,"rank":null,"recommended":["..."]}],"competitors":[{"name":"...","why":"..."}],"summary":"2 sentences for the business owner","reasons":["..."]}`;

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  let text = "";
  try {
    for (let turn = 0; turn < 4; turn++) {
      const res = await anthropic().beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
        messages,
      });
      if (res.stop_reason === "refusal") return null;
      text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      if (res.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: res.content });
    }
  } catch (err) {
    throw friendlyAiError(err);
  }
  const json = text.match(/<result>([\s\S]*?)<\/result>/)?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  const parsed = AiVisibility.safeParse(JSON.parse(json));
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Sales brief for the owner (Owners Hub → Sales)

const Phase = z.object({
  focus: z.string().describe("One line: what this phase is about"),
  actions: z.array(z.string()).describe("3-5 concrete things Elevated's platform and team do in this phase, named after real features: AI plan, weekly content batches, approvals, Google Business Profile posts, Meta/Google ads from the wallet, website & AI visibility fixes, budget split by performance"),
  targets: z.array(z.string()).describe("2-4 measurable targets to aim for, phrased as targets or leading indicators, never guarantees (e.g. 'Appear in at least 1 of 3 AI searches', 'Google Business Profile posting weekly')"),
});

export const SalesBriefOutput = z.object({
  headline: z.string().describe("One sentence the owner can open the sales call with"),
  weaknesses: z.array(z.object({ area: z.string(), finding: z.string(), impact: z.string().describe("What it likely costs them, in plain words") })).describe("3-5, most important first, based only on the check results given"),
  needs: z.array(z.string()).describe("3-5 likely needs or goals to confirm on the call"),
  recommendedTier: z.enum(["STARTER", "GROWTH", "ELITE"]),
  tierReason: z.string(),
  suggestedMonthlyAdBudget: z.number().int().describe("USD per month, realistic for this kind of local business; 0 if ads aren't a fit yet"),
  day30: Phase,
  day60: Phase,
  day90: Phase,
  talkingPoints: z.array(z.string()).describe("4-6 short points for the call"),
  objections: z.array(z.object({ objection: z.string(), response: z.string() })).describe("3-4 likely objections with honest responses"),
});
export type SalesBriefOutput = z.infer<typeof SalesBriefOutput>;

export async function salesBrief(input: {
  businessName: string;
  domain: string;
  city: string;
  industry: string;
  siteScore: number | null;
  aiScore: number | null;
  failedChecks: { label: string; detail: string }[];
  ai: AiVisibility | null;
  prices: Record<"STARTER" | "GROWTH" | "ELITE", number>;
}): Promise<{ brief: SalesBriefOutput; ai: boolean }> {
  if (!aiEnabled()) return { brief: demo.salesBrief(input), ai: false };
  const aiText = input.ai
    ? `AI search test (score ${input.aiScore}/100):\n${input.ai.queries
        .map((q) => `- "${q.query}": ${q.mentioned ? `shown at #${q.rank ?? "?"}` : "not shown"}; recommended: ${q.recommended.join(", ")}`)
        .join("\n")}\nCompetitors: ${input.ai.competitors.map((c) => `${c.name} (${c.why})`).join("; ")}\nReasons: ${input.ai.reasons.join("; ")}`
    : "AI search test: not available.";
  const brief = await generate(
    SalesBriefOutput,
    `Write a sales brief for Elevated's owner, who is about to pitch this prospect. Be specific to their results and honest: no guaranteed outcomes, no invented numbers about the prospect.

Prospect: ${input.businessName} (${input.domain}), ${input.industry} in ${input.city}
Website score: ${input.siteScore ?? "not checked"}/100
Failed website checks:
${input.failedChecks.map((c) => `- ${c.label}: ${c.detail}`).join("\n") || "- none recorded"}
${aiText}

Elevated plans (monthly, ad spend separate):
- Starter $${input.prices.STARTER}: assessment, 12-week AI plan, 8 AI campaigns/mo, weekly autopilot content, 60 AI images, 12% ad management fee
- Growth $${input.prices.GROWTH}: everything in Starter, 30 campaigns/mo, ad budget split across channels by performance, 200 images, 10% ad fee
- Elite $${input.prices.ELITE}: everything in Growth, up to 200 campaigns, monthly strategy review with the Elevated team, TikTok/LinkedIn/X ads run by the team, 500 images, 8% ad fee

Lay out what Elevated would do in the first 30, 60 and 90 days using the platform, building on each phase.`,
  );
  return { brief, ai: true };
}
