import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses and protects your information.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what information {SITE_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects when you use our website and
        marketing platform, how we use it and the choices you have. Questions? Email {mail}.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and a securely hashed password.</li>
        <li>
          <strong>Business information you give us:</strong> your business profile (name, industry, website, location, audience,
          goals, brand voice, competitors and budget), your assessment answers, and the plans and campaigns you create.
        </li>
        <li>
          <strong>Your public website:</strong> if you add a website address, we fetch its public pages (plus robots.txt,
          sitemap.xml and llms.txt) to run your website audit. We do not log in to your site.
        </li>
        <li>
          <strong>Billing details:</strong> payments are processed by Stripe. We receive your subscription status and a customer
          ID; we never see or store your full card number.
        </li>
        <li>
          <strong>Technical data:</strong> standard server logs (such as IP address, browser type and pages requested) kept by our
          hosting provider for security and troubleshooting.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use one essential cookie to keep you signed in. We do not use advertising or cross-site tracking cookies, and we do
        not run third-party analytics on the platform.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the service: score your marketing, build your plan, write your campaigns and run weekly autopilot.</li>
        <li>To process payments and manage your subscription.</li>
        <li>To send service messages, such as security notices and changes to these terms.</li>
        <li>To keep the platform secure, prevent abuse and fix problems.</li>
      </ul>
      <p>We do not sell your personal information, and we do not share it for cross-context behavioral advertising.</p>

      <h2>AI processing</h2>
      <p>
        Assessments, plans and campaigns are generated with Anthropic&apos;s Claude AI models. To do this we send your business
        profile, assessment results and campaign briefs to Anthropic&apos;s API. Anthropic processes this data to return results to
        us and, under its commercial terms, does not use API inputs or outputs to train its models by default. Please don&apos;t put
        sensitive personal information (for example, customer health or financial records) into your profile or briefs.
      </p>

      <h2>Service providers</h2>
      <p>We share information only with providers that help us run the service, under contracts that limit their use of it:</p>
      <ul>
        <li>Vercel (website hosting)</li>
        <li>Our managed PostgreSQL database provider (data storage)</li>
        <li>Anthropic (AI content generation)</li>
        <li>Stripe (payments)</li>
      </ul>
      <p>We may also disclose information if required by law, or as part of a merger or sale of the business with notice to you.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and business data while your account is open. When you ask us to delete your account, we delete it
        and the related business data within 30 days, except for records we must keep for tax, accounting or legal reasons.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can update your business profile at any time from your dashboard. You can ask us to access, correct, export or
        delete your personal information by emailing {mail}. Depending on where you live (for example, California or the
        European Economic Area), you may have additional rights, including the right to know what we hold, to opt out of sales
        or sharing (we do neither), and not to be discriminated against for using your rights. We will respond within the time
        required by applicable law.
      </p>

      <h2>Security</h2>
      <p>
        We use HTTPS everywhere, hash passwords with bcrypt, sign session cookies and restrict access to production systems. No
        method of storage or transmission is completely secure, so we cannot guarantee absolute security.
      </p>

      <h2>Children</h2>
      <p>The service is for businesses and is not directed to anyone under 18. We do not knowingly collect children&apos;s data.</p>

      <h2>Changes</h2>
      <p>
        If we make material changes we will update the date above and, where appropriate, notify you by email or in your
        dashboard before the changes take effect.
      </p>

      <h2>Contact</h2>
      <p>Email {mail} with any privacy question or request.</p>
    </LegalPage>
  );
}
