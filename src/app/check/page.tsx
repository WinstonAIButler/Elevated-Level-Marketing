import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CheckForm } from "./CheckForm";

export const metadata: Metadata = {
  title: "Free Website & AI Visibility Check",
  description: "See whether AI assistants and search recommend your business, which competitors show up instead, and the fixes that matter most. Free, about a minute.",
  alternates: { canonical: "/check" },
};

// The check runs a website scan and live AI searches; give it time.
export const maxDuration = 300;

export default function CheckPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <h1>Do customers find you when they ask AI?</h1>
          <p className="muted" style={{ fontSize: "1.1rem" }}>
            More and more customers ask ChatGPT, Google&apos;s AI answers and other assistants for a recommendation instead of
            scrolling search results. This free check shows whether your business comes up, who shows up instead, and what
            to fix first.
          </p>
          <div className="card" style={{ margin: "24px 0" }}>
            <CheckForm />
          </div>
          <div className="grid grid-3">
            <div className="card card-flat"><h3>AI search test</h3><p className="small muted">We ask the questions your customers ask and see which businesses get recommended.</p></div>
            <div className="card card-flat"><h3>Website scan</h3><p className="small muted">Search basics, whether AI crawlers can read your site, technical health and how easy it is to contact you.</p></div>
            <div className="card card-flat"><h3>Your top fixes</h3><p className="small muted">The changes that would make the biggest difference, in plain language.</p></div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
