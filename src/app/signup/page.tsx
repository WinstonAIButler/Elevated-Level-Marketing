import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SignupForm } from "./SignupForm";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Start Your Free Marketing Assessment",
  description: "Create a free account to get your marketing score, a 12-week marketing plan and your first AI-written campaigns. No card required.",
  alternates: { canonical: "/signup" },
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ check?: string }> }) {
  const { check } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap" id="main">
        <div className="card auth-card">
          <h1 style={{ fontSize: "1.6rem" }}>Start your free trial</h1>
          <p className="muted">Get your marketing assessment, plan and first campaigns. No card required.</p>
          {check ? (
            <div className="alert alert-ok" style={{ marginBottom: 16 }}>Your visibility report will be added to your new account.</div>
          ) : (
            <p className="small" style={{ marginTop: -4 }}>
              Not sure yet? <Link href="/check">Run a free website &amp; AI visibility check</Link> first. It takes about a minute.
            </p>
          )}
          <SignupForm check={check} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
