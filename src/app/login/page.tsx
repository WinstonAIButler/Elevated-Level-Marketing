import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: true } };

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap" id="main">
        <div className="card auth-card">
          <h1 style={{ fontSize: "1.6rem" }}>Welcome back</h1>
          <p className="muted">Log in to your marketing dashboard.</p>
          <LoginForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
