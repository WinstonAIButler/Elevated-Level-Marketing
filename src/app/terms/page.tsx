import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms that apply when you use ${SITE_NAME}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you (and the business you represent) and {SITE_NAME} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). By creating an account or using the service you agree to them. If you don&apos;t agree, please don&apos;t
        use the service.
      </p>

      <h2>1. The service</h2>
      <p>
        {SITE_NAME} provides an online platform that assesses your marketing, generates marketing plans and campaign content with
        artificial intelligence, audits your public website, and runs a weekly autopilot that drafts new content and tracks your
        plan. Features vary by plan and are described on our <Link href="/#pricing">pricing section</Link>.
      </p>

      <h2>2. Your account</h2>
      <p>
        You must be at least 18 and using the service for a business. Keep your login details secure and give us accurate
        information. You are responsible for activity under your account.
      </p>

      <h2>3. Free trial, subscriptions and cancellation</h2>
      <ul>
        <li>The Free Trial requires no payment card and is never charged.</li>
        <li>
          <strong>Paid plans renew automatically every month</strong> at the price shown when you subscribe until you cancel.
          Your card is charged at the start of each billing period.
        </li>
        <li>
          You can cancel at any time online from the Billing page (&ldquo;Manage subscription&rdquo;). Cancellation takes effect at
          the end of the current billing period, and you keep access until then. We don&apos;t refund partial months unless the law
          requires it.
        </li>
        <li>We will give you notice before any price change takes effect, and you can cancel before it applies.</li>
        <li>
          <strong>Ad spend is not included.</strong> You pay advertising platforms (such as Google or Meta) directly for any ads
          you run, and you control that budget.
        </li>
      </ul>

      <h2>4. AI-generated content and your responsibilities</h2>
      <p>
        Content is produced by AI and may contain errors, out-of-date information or placeholders. You are responsible for
        reviewing it and for everything you choose to publish, including making sure it is accurate, that any claims, offers,
        reviews or endorsements are truthful and substantiated, and that it complies with the laws and platform policies that
        apply to your business (for example, advertising, email (CAN-SPAM), text messaging, privacy and industry rules). We do not
        publish anything to your channels without your approval.
      </p>

      <h2>5. No guarantee of results</h2>
      <p>
        Marketing outcomes depend on many factors outside our control. We do not guarantee any particular ranking, traffic, lead,
        sales or revenue result. Scores, KPIs and targets are estimates to guide your work, not promises.
      </p>

      <h2>6. Website audits</h2>
      <p>
        By adding a website address you confirm you are authorized to have it audited, and you allow us to fetch its public pages
        and files periodically for that purpose.
      </p>

      <h2>7. Acceptable use</h2>
      <p>
        Don&apos;t use the service to create unlawful, deceptive, defamatory, discriminatory or infringing content, to send spam,
        to impersonate others, or to attack, overload or reverse engineer the platform. We may suspend accounts that do.
      </p>

      <h2>8. Ownership</h2>
      <p>
        You own your business information and, as between you and us, the content generated for you, which you may use for any
        lawful purpose. We own the platform, software and brand. You give us permission to process your information to provide
        and improve the service as described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>9. Disclaimers and limitation of liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, to the extent the
        law allows. To the extent the law allows, we are not liable for indirect, incidental, special, consequential or punitive
        damages, or for lost profits or revenue, and our total liability for any claim is limited to the amount you paid us in the
        three months before the claim arose.
      </p>

      <h2>10. Ending the agreement</h2>
      <p>
        You can stop using the service and cancel at any time. We may suspend or end access for a material breach of these terms.
        You can ask us to delete your data as described in the Privacy Policy.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms. For material changes we will notify you by email or in your dashboard at least 14 days before
        they take effect. Continuing to use the service after that means you accept the new terms.
      </p>

      <h2>12. Contact</h2>
      <p>Questions about these terms? Email {mail}.</p>
    </LegalPage>
  );
}
