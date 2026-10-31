import Link from "next/link";
import { Logo } from "./Logo";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Logo />
          <p className="small" style={{ marginTop: 12, maxWidth: "34ch" }}>
            AI-powered marketing assessments, plans and campaigns for small and mid-sized businesses.
          </p>
        </div>
        <nav aria-label="Product">
          <h2 className="footer-head">Product</h2>
          <Link href="/#how">How it works</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/signup">Start free assessment</Link>
        </nav>
        <nav aria-label="Company">
          <h2 className="footer-head">Company</h2>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/llms.txt" prefetch={false}>llms.txt</Link>
        </nav>
      </div>
      <div className="container footer-legal small">
        © {new Date().getFullYear()} <span translate="no">{SITE_NAME}</span>. All rights reserved. Plan prices do not include ad spend.
      </div>
    </footer>
  );
}
