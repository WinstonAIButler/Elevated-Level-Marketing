import { displayPrices } from "@/lib/stripe-prices";
import type { Metadata } from "next";
import type { Tier } from "@prisma/client";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CheckForm } from "./check/CheckForm";
import { JsonLd } from "@/components/JsonLd";
import { FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { AD_SPEND_NOTE, PAID_TIERS, TIERS } from "@/lib/tiers";

export const metadata: Metadata = { alternates: { canonical: "/" } };
// Re-render every 5 minutes so plan prices follow Stripe.
export const revalidate = 300;

const SHIFT = [
  {
    title: "Customers ask AI now",
    body: "Instead of scrolling ten blue links, people ask ChatGPT, Google's AI answers or Siri: “Who's the best plumber near me?” They get back two or three names.",
  },
  {
    title: "Two or three names. Is yours one?",
    body: "AI assistants recommend the businesses they can read about: clear websites, active Google profiles, fresh posts and reviews. Everyone else is left out of the answer.",
  },
  {
    title: "Most owners have never checked",
    body: "You can't fix what you can't see. Our free check runs those searches for your business and shows exactly where you stand, and who's getting your customers instead.",
  },
];

const OUTCOMES = [
  { kicker: "Get found", title: "Show up where customers decide", body: "We fix what's keeping you out of Google and AI answers, then keep feeding them fresh content about your business every week." },
  { kicker: "Stay consistent", title: "Marketing that never takes a week off", body: "A 12-week plan, then a new batch of posts, Google Business Profile updates and campaigns every Monday, written in your voice." },
  { kicker: "Spend smarter", title: "Every ad dollar where it works", body: "Set one monthly budget. We split it across Google, Facebook and Instagram, tell you why, and move money toward whatever brings in customers." },
  { kicker: "Stay in control", title: "Nothing goes out without your OK", body: "Approve posts and ads in one tap from your dashboard. Your accounts, your Stripe, your data stay yours. Cancel online anytime." },
];

const STEPS = [
  { title: "Run your free check", body: "See whether AI and Google recommend you, who shows up instead, and your top fixes. About a minute." },
  { title: "Get your plan", body: "Your marketing score across 8 areas and a week-by-week 12-week plan built for your business and budget." },
  { title: "Approve, we publish", body: "Each week your posts, profile updates and ads land in Approvals. Tap approve and they go out to your connected accounts." },
  { title: "Watch it climb", body: "We re-check your website and AI visibility every week and shift your ad budget toward what's working." },
];

const COMPARE: { row: string; us: string; agency: string; diy: string }[] = [
  { row: "Monthly cost", us: "$PRICE_RANGE", agency: "Often $1,500–$5,000+ retainer", diy: "Your evenings and weekends" },
  { row: "Ad management fee", us: "8–12% of ad spend, no minimum", agency: "Often 15–20%, with minimums", diy: "None, but no expertise either" },
  { row: "Time to a full marketing plan", us: "Minutes", agency: "Weeks of onboarding calls", diy: "Whenever you get to it" },
  { row: "Fresh content every week", us: "Yes, automatically", agency: "Depends on the package", diy: "If you find the time" },
  { row: "Tracks your AI search visibility", us: "Every week", agency: "Rarely", diy: "No" },
  { row: "You approve everything first", us: "Always", agency: "Sometimes", diy: "Yes" },
  { row: "Contract", us: "Month to month, cancel online", agency: "Often 6–12 months", diy: "None" },
];

const AUDIENCES = ["Home services", "Clinics & dental", "Restaurants & cafés", "Retail & e-commerce", "Fitness & wellness", "Professional services"];

const structuredData = (prices: Record<Tier, number>) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "@id": `${SITE_URL}/#service`,
      name: `${SITE_NAME} platform`,
      serviceType: "AI-powered digital marketing",
      description: SITE_DESCRIPTION,
      provider: { "@id": `${SITE_URL}/#organization` },
      areaServed: { "@type": "Country", name: "United States" },
      audience: { "@type": "BusinessAudience", name: "Small and mid-sized businesses" },
      offers: [TIERS.TRIAL, ...PAID_TIERS].map((t) => ({
        "@type": "Offer",
        name: t.name,
        price: prices[t.id],
        priceCurrency: "USD",
        description: t.features.join(", "),
        url: `${SITE_URL}/signup`,
        ...(prices[t.id] > 0 && {
          priceSpecification: { "@type": "UnitPriceSpecification", price: prices[t.id], priceCurrency: "USD", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } },
        }),
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
});

export default async function Home() {
  const prices = await displayPrices();
  const priceRange = `$${prices.STARTER}–$${prices.ELITE}/month`;
  return (
    <>
      <SiteHeader />
      <JsonLd data={structuredData(prices)} />
      <main id="main">
        <section className="hero hero-split">
          <div className="container hero-grid">
            <div>
              <span className="badge badge-dark" style={{ background: "rgba(168,217,50,.15)", color: "var(--green)" }}>
                Free AI visibility check · about 60 seconds
              </span>
              <h1 style={{ marginTop: 16 }}>
                Your next customer is asking AI who to hire. <em>Will it say your name?</em>
              </h1>
              <p className="lead">
                <span translate="no">Elevated</span> shows you in one minute whether ChatGPT, Google and other AI assistants
                recommend your business, then does the marketing that gets you recommended: weekly content, Google, Facebook,
                Instagram and ads. You approve everything.
              </p>
              <ul className="hero-points">
                <li>See who&apos;s getting your customers instead</li>
                <li>Agency-level marketing from ${prices.STARTER}/month</li>
                <li>No contract. Free trial, no card required</li>
              </ul>
            </div>
            <div className="card hero-card" id="check">
              <h2 style={{ fontSize: "1.25rem", marginBottom: 4 }}>Is AI recommending your business?</h2>
              <p className="muted small" style={{ marginTop: 0 }}>Enter your details. We run real searches and show you the results.</p>
              <CheckForm compact />
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="shift-title">
          <div className="container">
            <div className="section-title">
              <p className="eyebrow">What changed</p>
              <h2 id="shift-title" className="h2-lg">Search has changed. Most small businesses haven&apos;t.</h2>
            </div>
            <div className="grid grid-3">
              {SHIFT.map((s, i) => (
                <div className="card shift-card" key={s.title}>
                  <div className="step-num" aria-hidden="true">{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{s.body}</p>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 32 }}>
              <Link href="#check" className="btn btn-primary btn-lg">Find out where you stand</Link>
            </div>
          </div>
        </section>

        <section className="section section-white" aria-labelledby="outcomes-title">
          <div className="container">
            <div className="section-title">
              <p className="eyebrow">What Elevated does</p>
              <h2 id="outcomes-title" className="h2-lg">A full marketing team that works every week, for less than a part-time hire</h2>
            </div>
            <div className="grid grid-2">
              {OUTCOMES.map((o) => (
                <div className="card card-flat outcome" key={o.title}>
                  <p className="eyebrow" style={{ margin: 0 }}>{o.kicker}</p>
                  <h3 style={{ fontSize: "1.25rem", marginTop: 6 }}>{o.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{o.body}</p>
                </div>
              ))}
            </div>
            <p className="muted small" style={{ textAlign: "center", marginTop: 32 }}>Built for local and growing businesses</p>
            <ul className="chips audience-chips" aria-label="Industries we serve">
              {AUDIENCES.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        </section>

        <section className="section" id="how" aria-labelledby="how-title">
          <div className="container">
            <div className="section-title">
              <p className="eyebrow">How it works</p>
              <h2 id="how-title" className="h2-lg">From invisible to recommended, in four steps</h2>
              <p className="muted">No onboarding calls, no long setup. Most owners have their plan the same day.</p>
            </div>
            <ol className="grid grid-4 plain-list">
              {STEPS.map((s, i) => (
                <li className="card" key={s.title}>
                  <div className="step-num" aria-hidden="true">{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p className="muted small">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section section-white" aria-labelledby="compare-title">
          <div className="container" style={{ maxWidth: 980 }}>
            <div className="section-title">
              <p className="eyebrow">Compare</p>
              <h2 id="compare-title" className="h2-lg">Why owners choose Elevated</h2>
            </div>
            <div className="compare-wrap">
              <table className="compare">
                <thead>
                  <tr><th scope="col"><span className="sr-only">Feature</span></th><th scope="col" className="us">Elevated</th><th scope="col">Typical agency</th><th scope="col">Doing it yourself</th></tr>
                </thead>
                <tbody>
                  {COMPARE.map((c) => (
                    <tr key={c.row}>
                      <th scope="row">{c.row}</th>
                      <td className="us">{c.us === "$PRICE_RANGE" ? priceRange : c.us}</td>
                      <td>{c.agency}</td>
                      <td>{c.diy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ textAlign: "center", marginTop: 12 }}>Agency figures are typical published ranges for small-business marketing in 2026; individual agencies vary.</p>
          </div>
        </section>

        <section className="section" id="pricing" aria-labelledby="pricing-title">
          <div className="container">
            <div className="section-title">
              <p className="eyebrow">Pricing</p>
              <h2 id="pricing-title" className="h2-lg">Agency-level marketing without the agency bill</h2>
              <p className="muted">Start free with your check, assessment, plan and two campaigns. Upgrade when you&apos;re ready.</p>
              <p className="ad-spend-note">Plan prices do not include ad spend.</p>
            </div>
            <div className="grid grid-3">
              {PAID_TIERS.map((t) => (
                <div className={`card ${t.id === "GROWTH" ? "featured" : ""}`} key={t.id}>
                  {t.id === "GROWTH" && <span className="badge badge-good">Most popular</span>}
                  <h3 style={{ marginTop: 8 }}>{t.name}</h3>
                  <div className="price">${prices[t.id].toLocaleString()}<small>/month</small></div>
                  <p className="small" style={{ margin: "2px 0 8px", fontWeight: 600 }}>+ ad spend, at the budget you set</p>
                  <p className="muted small">{t.tagline}</p>
                  <ul className="feature-list">{t.features.map((f) => <li key={f}>{f}</li>)}</ul>
                  <Link href="/signup" className={`btn ${t.id === "GROWTH" ? "btn-primary" : "btn-ghost"}`} style={{ width: "100%" }}>
                    Start With a Free Trial
                  </Link>
                </div>
              ))}
            </div>
            <ul className="promise-row" aria-label="Our promises">
              <li><strong>No contract.</strong> Month to month, cancel online.</li>
              <li><strong>You approve everything.</strong> Nothing posts without your OK.</li>
              <li><strong>Your accounts stay yours.</strong> Social, Google and Stripe.</li>
              <li><strong>Free to start.</strong> No card required.</li>
            </ul>
            <p className="muted small" style={{ textAlign: "center", maxWidth: 640, margin: "16px auto 0" }}>
              {TIERS.TRIAL.name}: {TIERS.TRIAL.features.join(", ")}. {AD_SPEND_NOTE} Paid plans renew monthly until you cancel.
            </p>
          </div>
        </section>

        <section className="section section-white" id="faq" aria-labelledby="faq-title">
          <div className="container faq">
            <div className="section-title">
              <h2 id="faq-title" className="h2-lg">Questions owners ask</h2>
            </div>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary><h3>{f.q}</h3></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section cta-band">
          <div className="container" style={{ textAlign: "center" }}>
            <h2 className="h2-lg">Your competitors are already being recommended.</h2>
            <p className="lead" style={{ margin: "0 auto 24px" }}>Find out in one minute whether you are. It&apos;s free.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <Link href="#check" className="btn btn-primary btn-lg">Check my visibility, free</Link>
              <Link href="/signup" className="btn btn-ghost btn-lg btn-on-dark">Start free trial</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
