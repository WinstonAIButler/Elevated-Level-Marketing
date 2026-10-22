import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Get started" };

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1 style={{ fontSize: "1.6rem" }}>Start your free trial</h1>
          <p className="muted">Get your marketing assessment, plan and first campaigns. No card required.</p>
          <SignupForm />
        </div>
      </div>
    </>
  );
}
