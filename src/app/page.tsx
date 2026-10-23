import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Logo } from "@/components/Logo";
import { AD_SPEND_NOTE, PAID_TIERS, TIERS } from "@/lib/tiers";

const STEPS = [
  { title: "Sign up & tell us about your business", body: "A five-minute profile: what you sell, who you sell to, your goals and budget." },
  { title: "Get your automated assessment", body: "We score your marketing across 8 areas, from local SEO to reviews, and pinpoint what's holding you back." },
  { title: "Receive a 12-week marketing plan", body: "A week-by-week plan with objectives, channel strategy, budget split and every task needed to execute it." },
  { title: "AI builds and runs your campaigns", body: "Ad copy, social posts, emails and landing pages generated for you, with a fresh content batch every week on autopilot." },
];

const FEATURES = [
  { title: "Marketing assessment", body: "An 8-category scorecard with a plain-English summary, strengths, gaps and prioritized fixes." },
  { title: "Plan & execution tracking", body: "Every task has a week, an owner and a status, so you always know what's done and what's next." },
  { title: "AI campaign studio", body: "Brief it in one sentence. Get headlines, ads, social posts, emails and landing page copy in minutes." },
  { title: "Weekly autopilot", body: "Each week we draft new content from your plan, start the automated tasks and flag anything waiting on you." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <section className="hero">
        <div className="container">
          <span className="badge badge-dark" style={{ background: "rgba(168,217,50,.15)", color: "var(--green)" }}>
            Marketing that runs itself
          </span>
          <h1 style={{ marginTop: 16 }}>
            Your marketing, <em>elevated</em> and on autopilot.
          </h1>
          <p className="lead">
            Elevated Digital Marketing assesses your business, builds your marketing plan and generates your campaigns
            with AI, then keeps executing week after week so you can get back to running your business.
          </p>
          <div className="row" style={{ marginTop: 28 }}>
            <Link href="/signup" className="btn btn-primary btn-lg">Start free assessment</Link>
            <Link href="#how" className="btn btn-ghost btn-lg" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <div className="section-title">
            <h2 style={{ fontSize: "2rem" }}>From sign-up to running campaigns in one sitting</h2>
            <p className="muted">No agency retainers, no long onboarding calls. The platform does the heavy lifting.</p>
          </div>
          <div className="grid grid-4">
            {STEPS.map((s, i) => (
              <div className="card" key={s.title}>
                <div className="step-num">{i + 1}</div>
                <h3>{s.title}</h3>
                <p className="muted small">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "#fff", borderBlock: "1px solid var(--line)" }}>
        <div className="container">
          <div className="section-title">
            <h2 style={{ fontSize: "2rem" }}>Everything a marketing department does</h2>
            <p className="muted">Built for local service businesses, retailers, clinics, restaurants and growing brands.</p>
          </div>
          <div className="grid grid-2x">
            {FEATURES.map((f) => (
              <div className="card card-flat" key={f.title}>
                <h3>{f.title}</h3>
                <p className="muted" style={{ margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="container">
          <div className="section-title">
            <h2 style={{ fontSize: "2rem" }}>Simple monthly pricing</h2>
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
                  Start with a free trial
                </Link>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ textAlign: "center", marginTop: 20 }}>
            {TIERS.TRIAL.name}: {TIERS.TRIAL.features.join(", ")}. No card required.
          </p>
          <p className="muted small" style={{ textAlign: "center", maxWidth: 640, margin: "8px auto 0" }}>{AD_SPEND_NOTE}</p>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container row between">
          <Logo variant="white" />
          <span>© {new Date().getFullYear()} Elevated Digital Marketing. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
}
