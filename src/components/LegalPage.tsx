import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export const LEGAL_UPDATED = "October 31, 2026";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <article className="container prose">
          <h1>{title}</h1>
          <p className="muted small">Last updated {LEGAL_UPDATED}</p>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
