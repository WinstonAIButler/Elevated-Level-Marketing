# Elevated Digital Marketing

A self-serve marketing platform: clients sign up, get an automated marketing assessment, receive a 12-week marketing plan that is tracked task by task, and generate complete campaigns (ads, social posts, emails, landing page copy) with Claude. A weekly autopilot job keeps executing the plan for each client.

## What's in the MVP

| Area | What it does |
| --- | --- |
| Accounts | Email/password sign-up and login (bcrypt + signed session cookie). Each account has one business profile. |
| Business profile | Industry, audience, goals, brand voice, competitors, budget. Feeds every AI prompt. |
| Assessment | 16 questions across 8 areas (website, SEO, social, email, paid, content, reviews, analytics), scored by rules (`src/lib/assessment.ts`), then Claude writes the summary, strengths, gaps and prioritized recommendations. |
| Marketing plan | Claude turns the profile + latest assessment into a 12-week plan: objectives, channel strategy, budget split, KPIs and 20–36 dated tasks, each owned by *Automated*, *You* or *Elevated team*. Clients move tasks through To do → In progress → Done. |
| Campaigns | One-sentence brief + channels → headlines, ad copy, dated social posts with hashtags and visual ideas, emails, landing page copy and KPIs, each with a copy button. Status flow: draft → approved → scheduled → live → completed. |
| Autopilot | `GET /api/cron/autopilot` (weekly via Vercel Cron) drafts each paying client's weekly content batch from their plan, starts that week's automated tasks and flags tasks waiting on the client. Clients can also run it from the dashboard. |
| Billing | Free trial plus Starter / Growth / Elite tiers with monthly usage limits (`src/lib/tiers.ts`). Stripe Checkout, customer portal and webhook keep the tier in sync. |
| Brand | Logo rebuilt as vector SVG plus PNGs in `public/brand/` (see below). |

**Demo mode:** with no `ANTHROPIC_API_KEY`, everything still works using template content (`src/lib/demo-content.ts`) and the dashboard shows a "Demo mode" notice. Without Stripe keys, everyone stays on the free trial and the upgrade buttons are disabled.

## Running locally

Requires Node 20+ and PostgreSQL.

```bash
cp .env.example .env          # then fill in DATABASE_URL and AUTH_SECRET at minimum
npm install
npx prisma migrate deploy     # creates the tables
npm run dev                   # http://localhost:3000
```

Other scripts: `npm test` (unit tests), `npm run lint` (type check), `npm run build`.

## Accounts and keys you need to supply

| Service | Why | Env vars |
| --- | --- | --- |
| **Hosting** – [Render](https://render.com) (`render.yaml`) or [Vercel](https://vercel.com) (`vercel.json`) | Runs the site and the weekly autopilot job. On Vercel, the Pro plan is recommended so AI requests can run up to 5 minutes. | `APP_URL` (your domain), `AUTH_SECRET` (`openssl rand -base64 32`), `CRON_SECRET` |
| **Database** – any Postgres, e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com) | Stores accounts, assessments, plans, campaigns. | `DATABASE_URL` |
| **AI** – [Anthropic Console](https://console.anthropic.com) API key with billing enabled | Generates assessments, plans and campaigns (model `claude-opus-5-5` by default). | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` |
| **Payments** – [Stripe](https://dashboard.stripe.com) account | Subscriptions. Create three monthly recurring prices (Starter $149, Growth $399, Elite $899 or your own), enable the customer portal, and add a webhook to `https://<your-domain>/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.*`. | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_ELITE` |
| **Domain** | Your public URL, pointed at the host. | `APP_URL` |

### Deploying

**Render (one click):** `render.yaml` is a Render Blueprint that creates the website, a Postgres database and the weekly autopilot job, and generates `AUTH_SECRET` and `CRON_SECRET`. In Render choose *New → Blueprint*, pick this repo, then fill in `ANTHROPIC_API_KEY` (optional, demo mode without it) and `APP_URL` (the site's public URL). Database migrations run automatically on each deploy.

**Vercel:** import the repo, add the env vars above, set the build command to `prisma migrate deploy && npm run build`, and deploy. `vercel.json` schedules the autopilot job.

## Logo files

`public/brand/` holds the cleaned-up logo, rebuilt as vectors from the original artwork (green/gray arrow mark, ELEVATED / DIGITAL MARKETING wordmark set in Inter):

- `logo.svg`, `logo.png`, `logo@4x.png`: full-color horizontal logo, transparent background
- `logo-white.svg`, `logo-white.png`: for dark backgrounds
- `logo-mark.svg`, `logo-mark-512.png`, `logo-mark-192.png`: icon only (social avatars, app icons)
- `logo-mark-mono.svg`: single-color white icon
- `public/favicon-32.png`, `public/apple-touch-icon.png`

Regenerate with `python3 scripts/build-logo.py` (needs `pip install fonttools` and the Inter font) and `node scripts/render-logo-png.mjs`.

## What comes next

The MVP generates and tracks the marketing; publishing is still copy-and-paste. Natural next steps are direct integrations so autopilot can post and launch on its own: Meta (Facebook/Instagram) and Google Business Profile posting, Google Ads and Meta Ads campaign creation, Mailchimp/Klaviyo for email, plus reporting pulled back from Google Analytics and the ad platforms. Each one needs its own developer app/account approval from that platform.

## Project layout

```
prisma/schema.prisma          data model (User, Business, Assessment, MarketingPlan, Task, Campaign, Activity)
src/lib/ai.ts                 Claude calls with structured outputs (zod schemas)
src/lib/assessment.ts         questionnaire and scoring
src/lib/autopilot.ts          weekly automation
src/lib/tiers.ts              pricing tiers and limits
src/app/actions/              server actions (auth, business, assessment, plan, campaigns, billing)
src/app/dashboard/            client dashboard pages
src/app/api/                  Stripe webhook and autopilot cron
```
