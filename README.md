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
| **Payments** – [Stripe](https://dashboard.stripe.com) account | Subscriptions. Create three products named "Elevated Starter", "Elevated Growth" and "Elevated Elite", each with a monthly price (the app finds them by name; to change a price later, add a new monthly price on the product and make it the default), enable the customer portal, and add a webhook to `https://<your-domain>/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.*`. | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_ELITE` |
| **Domain** | Your public URL, pointed at the host. | `APP_URL` |

### Deploying

**Render (one click):** `render.yaml` is a Render Blueprint that creates the website, a Postgres database and the weekly autopilot job, and generates `AUTH_SECRET` and `CRON_SECRET`. In Render choose *New → Blueprint*, pick this repo, then fill in `ANTHROPIC_API_KEY` (optional, demo mode without it) and `APP_URL` (the site's public URL). Database migrations run automatically on each deploy.

**Vercel:** import the repo, add a Neon Postgres database from the project's *Storage* tab (it sets `DATABASE_URL`), add `AUTH_SECRET` and `CRON_SECRET` (plus `ANTHROPIC_API_KEY` to switch on AI), and deploy. The `vercel-build` script runs database migrations on every deploy (and skips them with a warning if no database is connected yet), and `vercel.json` schedules the autopilot job.

**Setup check:** open `/api/health` on the live site. It reports whether the database, login secret, AI key, payments and autopilot are configured, without showing any values.

## Jarvis

`/jarvis` is Elevated Level Marketing's operations chief of staff: live Stripe revenue (balance, last 30 days, monthly recurring, open and overdue invoices), dev status from GitHub (open pull requests, latest deploys, recent commits), and a Claude-written briefing with today's priorities and sales and marketing moves. You can also ask it questions. It only reads: it can't move money, merge code or email anyone. It's not linked from the site and isn't indexed.

The page is `public/jarvis.html` (served at `/jarvis` by a rewrite in `next.config.mjs`), the API is `src/app/api/jarvis/route.ts`, and the engine is `src/lib/jarvis/jarvis-core.js`, an identical copy in every Joslin Enterprises repo, so change it there and copy it across. Environment variables:

- `JARVIS_ACCESS_CODE` (optional): leave it empty and Jarvis opens for anyone with the link; set it to require a passphrase.
- `ANTHROPIC_API_KEY`: Claude, for briefings and questions (the same key the app already uses).
- `JARVIS_STRIPE_KEY`: a restricted Stripe key with Read on Balance, Charges, Subscriptions and Invoices. Without it, Jarvis reads with `STRIPE_SECRET_KEY`.
- `GITHUB_TOKEN`: a fine-grained token with read-only Contents, Pull requests and Deployments on this repo.
- `JARVIS_MODEL` (optional): default `claude-sonnet-5-5`.

## Logo files

`public/brand/` holds the cleaned-up logo, rebuilt as vectors from the original artwork (green/gray arrow mark, ELEVATED / DIGITAL MARKETING wordmark set in Inter):

- `logo.svg`, `logo.png`, `logo@4x.png`: full-color horizontal logo, transparent background
- `logo-white.svg`, `logo-white.png`: for dark backgrounds
- `logo-mark.svg`, `logo-mark-512.png`, `logo-mark-192.png`: icon only (social avatars, app icons)
- `logo-mark-mono.svg`: single-color white icon
- `public/favicon-32.png`, `public/apple-touch-icon.png`

Regenerate with `python3 scripts/build-logo.py` (needs `pip install fonttools` and the Inter font) and `node scripts/render-logo-png.mjs`.

## Publishing, ad spend and approvals

The client portal now runs the marketing end to end. **Nothing is posted or spent without the client's approval.**

| Portal page | What the client does |
| --- | --- |
| **Channels** (`/dashboard/channels`) | Connects Facebook/Instagram, Google Business Profile, Google Ads, LinkedIn, X and TikTok with one click each (OAuth; tokens encrypted at rest). |
| **Ad spend** (`/dashboard/ad-spend`) | Sets a monthly ad budget and picks how it's paid: the **Elevated ad wallet** (prepay by card; we run the ads from Elevated's ad accounts and deduct actual spend) or **their own ad accounts** (platforms bill them). Claude proposes the split across channels with a reason and expected result for each; the client approves or asks for changes. Splits shift toward channels with a lower cost per result as data comes in. |
| **Approvals** (`/dashboard/approvals`) | Reviews every post and ad, with an AI-generated image, edits the text, and approves or rejects it. Approved items publish on schedule. |

How it runs:

- **Weekly autopilot** writes the content batch and sends its posts to Approvals for each connected channel, and proposes the month's budget split.
- **Hourly** (`/api/cron/publish`): adds AI images to queued posts and ads, publishes approved items that are due, and restarts paused ads once a wallet is topped up.
- **Every 4 hours** (`/api/cron/spend-sync`): pulls spend and results from Meta and Google Ads, debits wallets (idempotent per ad per day) and pauses wallet-funded ads when the balance covers less than 2 days.
- New ads only launch when the wallet covers at least 3 days of spend.

What's automated vs handled by the team:

| Platform | Posts | Ads |
| --- | --- | --- |
| Facebook & Instagram | automatic (Instagram needs an image, generated automatically) | automatic (Traffic campaigns) |
| Google Business Profile | automatic | n/a (free) |
| Google Ads | n/a | automatic (Search, Maximize Clicks, RSA + phrase keywords) |
| LinkedIn, X | automatic (text + link) | Elevated team |
| TikTok | Elevated team (needs video) | Elevated team |

Items the system can't do automatically land in the client's history as "With Elevated team" with the reason.

### Pricing and margins

`src/lib/pricing-model.ts` models the cost of each plan at full usage (Claude Opus 5.5 at $4/$20 per million tokens, $0.20 per image, Stripe fees, $3/client infrastructure, team time at $50/hour) and `pricing-model.test.ts` fails if any plan drops below a 40% margin. Current numbers at full usage: Starter 68%, Growth 64%, Elite 54%. Wallet management fees are 12% / 10% / 8% by plan (agency norm is 10–20% of spend, often with minimums) and net 53–73% after card fees.

### Setting up the platforms (one time, by Elevated)

Every platform needs a developer app. Register `<APP_URL>/api/connect/<provider>/callback` (provider = `meta`, `google_ads`, `google_business`, `linkedin`, `tiktok`, `x`) as the redirect URI and set the env vars in `.env.example`.

1. **Keys shared with the other Joslin Enterprises apps:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY` (images), and the Winston app's Google OAuth client (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`): add ELM's two Google redirect URIs to it. `CONNECTIONS_ENCRYPTION_KEY` (Winston's name) works in place of `TOKEN_ENCRYPTION_KEY`.
2. **Meta:** create an app at developers.facebook.com (Business type), add Facebook Login, Instagram and Marketing API, complete Business Verification and App Review for `pages_manage_posts`, `instagram_content_publish`, `ads_management`. For wallet ads, create a System User in Elevated's Business Manager with access to Elevated's ad account (`META_SYSTEM_USER_TOKEN`, `META_AD_ACCOUNT_ID`). Clients must give Elevated's Business Manager access to their Page for wallet-funded ads.
3. **Google Ads:** apply for a developer token (Basic access) from Elevated's manager (MCC) account; set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC), `GOOGLE_ADS_MANAGED_CUSTOMER_ID` (the account wallet ads run in) and `GOOGLE_ADS_REFRESH_TOKEN` (an OAuth refresh token for the MCC with the `adwords` scope).
4. **Google Business Profile:** request Business Profile API access in Google Cloud for the same project.
5. **LinkedIn / X / TikTok:** create apps; LinkedIn company-page posting needs Community Management API approval (then add its scopes to `LINKEDIN_SCOPES`).
6. Stripe: add `checkout.session.async_payment_succeeded` to the webhook events (wallet top-ups).

Check `/api/health` for what's configured. Until a platform's app is set, its Connect button shows "Coming soon".

## Project layout

```
prisma/schema.prisma          data model (+ WalletEntry, ChannelConnection, BudgetAllocation, PublishItem, ChannelMetric, MediaAsset)
src/lib/ai.ts                 Claude calls with structured outputs (zod schemas)
src/lib/assessment.ts         questionnaire and scoring
src/lib/autopilot.ts          weekly automation
src/lib/tiers.ts              pricing tiers, limits and ad fees
src/lib/pricing-model.ts      unit economics per plan (tested to stay above 40% margin)
src/lib/allocation.ts         budget split math (tested)
src/lib/publishing.ts         approval queue, publishing, spend sync, wallet pauses
src/lib/publishers/           Meta, Google Ads, Google Business Profile, LinkedIn, X, TikTok
src/lib/images.ts             AI images (OpenAI, Gemini fallback)
src/lib/wallet.ts             ad wallet ledger
src/app/actions/              server actions (auth, business, assessment, plan, campaigns, billing)
src/app/dashboard/            client dashboard pages
src/app/api/                  Stripe webhook, crons (autopilot, publish, spend-sync), channel OAuth, media
```
