import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Start Your Free Marketing Assessment",
  description: "Create a free account to get your marketing score, a 12-week marketing plan and your first AI-written campaigns. No card required.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap" id="main">
        <div className="card auth-card">
          <h1 style={{ fontSize: "1.6rem" }}>Start your free trial</h1>
          <p className="muted">Get your marketing assessment, plan and first campaigns. No card required.</p>
          <SignupForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
