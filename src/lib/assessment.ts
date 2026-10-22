// The automated marketing assessment: a fixed questionnaire scored by rules,
// so every client gets a consistent, comparable baseline. The AI layer adds a
// narrative and recommendations on top of these scores (see ai.ts).

export type CategoryId =
  | "website"
  | "seo"
  | "social"
  | "email"
  | "paid"
  | "content"
  | "reputation"
  | "analytics";

export const CATEGORIES: Record<CategoryId, string> = {
  website: "Website & Conversion",
  seo: "Search & Local SEO",
  social: "Social Media",
  email: "Email & Retention",
  paid: "Paid Advertising",
  content: "Content & Brand",
  reputation: "Reviews & Reputation",
  analytics: "Tracking & Analytics",
};

export type Question = {
  id: string;
  category: CategoryId;
  text: string;
  options: { label: string; points: number }[];
};

const SCALE = (labels: [string, string, string, string]) =>
  labels.map((label, i) => ({ label, points: i }));

export const QUESTIONS: Question[] = [
  {
    id: "web_mobile",
    category: "website",
    text: "How well does your website work on phones?",
    options: SCALE(["No website", "Hard to use on mobile", "Works, but dated", "Fast and mobile-first"]),
  },
  {
    id: "web_cta",
    category: "website",
    text: "Does every page have a clear call to action (call, book, buy, quote)?",
    options: SCALE(["No", "Only the home page", "Most pages", "Every page, tested"]),
  },
  {
    id: "seo_gbp",
    category: "seo",
    text: "Is your Google Business Profile claimed and kept current?",
    options: SCALE(["Not claimed / not sure", "Claimed, rarely updated", "Updated monthly", "Updated weekly with posts and photos"]),
  },
  {
    id: "seo_rank",
    category: "seo",
    text: "When customers search for what you sell in your area, where do you show up?",
    options: SCALE(["Not at all", "Page 2 or lower", "Page 1, below the fold", "Top 3 / map pack"]),
  },
  {
    id: "social_freq",
    category: "social",
    text: "How often do you post on social media?",
    options: SCALE(["Never", "A few times a month", "Weekly", "Several times a week"]),
  },
  {
    id: "social_engage",
    category: "social",
    text: "How engaged is your social audience?",
    options: SCALE(["No following", "Small, little engagement", "Steady likes and comments", "Active community and DMs"]),
  },
  {
    id: "email_list",
    category: "email",
    text: "Do you collect customer emails or phone numbers for marketing?",
    options: SCALE(["No", "Informally", "Yes, with a sign-up form", "Yes, segmented lists"]),
  },
  {
    id: "email_send",
    category: "email",
    text: "How often do you send email or SMS campaigns?",
    options: SCALE(["Never", "A few times a year", "Monthly", "Weekly with automations"]),
  },
  {
    id: "paid_use",
    category: "paid",
    text: "Do you run paid ads (Google, Meta, TikTok, etc.)?",
    options: SCALE(["Never", "Tried it, stopped", "Occasionally", "Always-on, optimized"]),
  },
  {
    id: "paid_roi",
    category: "paid",
    text: "Do you know your return on ad spend or cost per lead?",
    options: SCALE(["No idea", "Rough guess", "Tracked for some campaigns", "Tracked for every campaign"]),
  },
  {
    id: "content_brand",
    category: "content",
    text: "How consistent is your brand (logo, colors, voice) across channels?",
    options: SCALE(["Inconsistent", "Somewhat consistent", "Mostly consistent", "Documented brand guide"]),
  },
  {
    id: "content_publish",
    category: "content",
    text: "Do you publish helpful content (blogs, videos, guides)?",
    options: SCALE(["Never", "Rarely", "Monthly", "Weekly on a calendar"]),
  },
  {
    id: "rep_reviews",
    category: "reputation",
    text: "How many online reviews do you have, and how strong are they?",
    options: SCALE(["Few or none", "Some, mixed", "Many, mostly positive", "Lots, 4.7+ stars"]),
  },
  {
    id: "rep_ask",
    category: "reputation",
    text: "Do you ask happy customers for reviews?",
    options: SCALE(["Never", "Sometimes", "Usually", "Automatically after every sale"]),
  },
  {
    id: "an_tracking",
    category: "analytics",
    text: "Is website analytics and conversion tracking installed?",
    options: SCALE(["No", "Not sure", "Analytics only", "Analytics + conversion tracking"]),
  },
  {
    id: "an_review",
    category: "analytics",
    text: "How often do you review marketing results?",
    options: SCALE(["Never", "When something breaks", "Monthly", "Weekly dashboard"]),
  },
];

export type Answers = Record<string, number>;
export type CategoryScores = Record<CategoryId, number>;

const MAX_POINTS = 3;

/** Score answers (option index per question) into 0-100 per category and overall. */
export function scoreAssessment(answers: Answers): { scores: CategoryScores; overall: number } {
  const totals = {} as Record<CategoryId, { got: number; max: number }>;
  for (const id of Object.keys(CATEGORIES) as CategoryId[]) totals[id] = { got: 0, max: 0 };

  for (const q of QUESTIONS) {
    const idx = answers[q.id];
    const option = typeof idx === "number" ? q.options[idx] : undefined;
    totals[q.category].max += MAX_POINTS;
    totals[q.category].got += option ? option.points : 0;
  }

  const scores = {} as CategoryScores;
  let sum = 0;
  for (const id of Object.keys(totals) as CategoryId[]) {
    const { got, max } = totals[id];
    scores[id] = max === 0 ? 0 : Math.round((got / max) * 100);
    sum += scores[id];
  }
  return { scores, overall: Math.round(sum / Object.keys(scores).length) };
}

export function scoreBand(score: number) {
  if (score >= 75) return { label: "Strong", tone: "good" as const };
  if (score >= 45) return { label: "Developing", tone: "warn" as const };
  return { label: "Needs work", tone: "bad" as const };
}

/** Category ids ordered weakest first. */
export function weakestCategories(scores: CategoryScores): CategoryId[] {
  return (Object.keys(scores) as CategoryId[]).sort((a, b) => scores[a] - scores[b]);
}

/** Parse a submitted form into answers, ignoring anything that isn't a known question/option. */
export function answersFromForm(form: FormData): Answers {
  const answers: Answers = {};
  for (const q of QUESTIONS) {
    const raw = form.get(q.id);
    const idx = raw === null ? NaN : Number(raw);
    if (Number.isInteger(idx) && idx >= 0 && idx < q.options.length) answers[q.id] = idx;
  }
  return answers;
}
