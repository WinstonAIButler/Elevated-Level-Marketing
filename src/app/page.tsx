import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { AD_SPEND_NOTE, PAID_TIERS, TIERS } from "@/lib/tiers";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const STEPS = [
  { title: "Tell us about your business", body: "A five-minute profile: what you sell, who you sell to, your goals and your budget." },
  { title: "Get your marketing score", body: "We score your marketing from 0 to 100 across 8 areas, from local SEO to reviews, and pinpoint what's holding you back." },
  { title: "Receive a 12-week plan", body: "A week-by-week plan with objectives, channel strategy, budget split and every task needed to execute it." },
  { title: "Campaigns run on autopilot", body: "Ad copy, social posts, emails and landing pages written for you, with a fresh content batch every week for your approval." },
];

const FEATURES = [
  { title: "Marketing assessment", body: "An 8-category scorecard with a plain-English summary, strengths, gaps and prioritized fixes." },
  { title: "Plan & execution tracking", body: "Every task has a week, an owner and a status, so you always know what's done and what's next." },
  { title: "AI campaign studio", body: "Brief it in one sentence. Get headlines, ads, social posts, emails and landing page copy in minutes, with a pre-publish compliance checklist." },
  { title: "Website & AI search visibility", body: "A weekly audit of the signals Google, ChatGPT, Claude and Perplexity use to find and recommend you, with the exact fix for each gap." },
  { title: "Weekly autopilot", body: "Each week we draft new content from your plan, start the automated tasks, re-check your website and flag anything waiting on you." },
  { title: "You stay in control", body: "Nothing is posted to your accounts without your approval, and you can pause autopilot or cancel online at any time." },
];

const AUDIENCES = ["Home services", "Clinics & dental", "Restaurants & cafés", "Retail & e-commerce", "Fitness & wellness", "Professional services"];

const structuredData = {
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
        price: t.price,
        priceCurrency: "USD",
        description: t.features.join(", "),
        url: `${SITE_URL}/signup`,
        ...(t.price > 0 && {
          priceSpecification: { "@type": "UnitPriceSpecification", price: t.price, priceCurrency: "USD", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } },
        }),
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <SiteHeader />
      <JsonLd data={structuredData} />
      <main id="main">
        <section className="hero">
          <div className="container">
            <span className="badge badge-dark" style={{ background: "rgba(168,217,50,.15)", color: "var(--green)" }}>
              Marketing that runs itself
            </span>
            <h1 style={{ marginTop: 16 }}>
              Your marketing, <em>elevated</em> and on autopilot.
            </h1>
            <p className="lead">
              <span translate="no">Elevated Digital Marketing</span> is an AI marketing service for small businesses. It scores
              your marketing, builds your 12-week plan and writes your campaigns, then keeps producing fresh content every week so
              you can get back to running your business.
            </p>
            <div className="row" style={{ marginTop: 28 }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Start Free Assessment</Link>
              <Link href="#how" className="btn btn-ghost btn-lg btn-on-dark">See How It Works</Link>
            </div>
            <p className="small hero-note">Free trial · No card required · Cancel anytime</p>
          </div>
        </section>

        <section className="section" id="how" aria-labelledby="how-title">
          <div className="container">
            <div className="section-title">
              <h2 id="how-title" className="h2-lg">From sign-up to running campaigns in one sitting</h2>
              <p className="muted">No agency retainers, no long onboarding calls. The platform does the heavy lifting.</p>
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

        <section className="section section-white" aria-labelledby="features-title">
          <div className="container">
            <div className="section-title">
              <h2 id="features-title" className="h2-lg">The core work of a marketing team, automated</h2>
              <p className="muted">Strategy, content and weekly follow-through in one place, for less than a part-time hire.</p>
            </div>
            <div className="grid grid-3x">
              {FEATURES.map((f) => (
                <div className="card card-flat" key={f.title}>
                  <h3>{f.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{f.body}</p>
                </div>
              ))}
            </div>
            <p className="muted small" style={{ textAlign: "center", marginTop: 32 }}>Built for</p>
            <ul className="chips audience-chips" aria-label="Industries we serve">
              {AUDIENCES.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        </section>

        <section className="section" id="pricing" aria-labelledby="pricing-title">
          <div className="container">
            <div className="section-title">
              <h2 id="pricing-title" className="h2-lg">Simple monthly pricing</h2>
              <p className="muted">Start free with an assessment, a plan and two campaigns. Upgrade when you&apos;re ready.</p>
              <p className="ad-spend-note">Plan prices do not include ad spend.</p>
            </div>
            <div className="grid grid-3">
              {PAID_TIERS.map((t) => (
                <div className={`card ${t.id === "GROWTH" ? "featured" : ""}`} key={t.id}>
                  {t.id === "GROWTH" && <span className="badge badge-good">Most popular</span>}
                  <h3 style={{ marginTop: 8 }}>{t.name}</h3>
                  <div className="price">${t.price}<small>/month</small></div>
                  <p className="small" style={{ margin: "2px 0 8px", fontWeight: 600 }}>+ your own ad spend</p>
                  <p className="muted small">{t.tagline}</p>
                  <ul className="feature-list">{t.features.map((f) => <li key={f}>{f}</li>)}</ul>
                  <Link href="/signup" className={`btn ${t.id === "GROWTH" ? "btn-primary" : "btn-ghost"}`} style={{ width: "100%" }}>
                    Start With a Free Trial
                  </Link>
                </div>
              ))}
            </div>
            <p className="muted small" style={{ textAlign: "center", marginTop: 20 }}>
              {TIERS.TRIAL.name}: {TIERS.TRIAL.features.join(", ")}. No card required.
            </p>
            <p className="muted small" style={{ textAlign: "center", maxWidth: 640, margin: "8px auto 0" }}>
              {AD_SPEND_NOTE} Paid plans renew monthly until you cancel; cancel online anytime.
            </p>
          </div>
        </section>

        <section className="section section-white" id="faq" aria-labelledby="faq-title">
          <div className="container faq">
            <div className="section-title">
              <h2 id="faq-title" className="h2-lg">Frequently asked questions</h2>
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
            <h2 className="h2-lg">See your marketing score in five minutes</h2>
            <p className="lead" style={{ margin: "0 auto 24px" }}>Free assessment, free 12-week plan, two free campaigns.</p>
            <Link href="/signup" className="btn btn-primary btn-lg">Start Free Assessment</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
