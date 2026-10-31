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

async function generate<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T>> {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
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
