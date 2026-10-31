import type { Metadata, Viewport } from "next";
import { JsonLd } from "@/components/JsonLd";
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | AI Marketing for Small Business`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Get a free marketing assessment, a 12-week marketing plan and AI-written campaigns that keep running every week. Built for small and mid-sized businesses.",
  applicationName: SITE_NAME,
  keywords: [
    "AI marketing for small business",
    "automated marketing plan",
    "marketing assessment",
    "AI marketing agency",
    "local SEO",
    "AI search visibility",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/",
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME}: ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
  icons: { icon: [{ url: "/brand/logo-mark.svg", type: "image/svg+xml" }, { url: "/favicon-32.png" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#1f252c",
  colorScheme: "light",
};

const organization = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/brand/logo-mark-512.png`,
      description: SITE_DESCRIPTION,
      email: CONTACT_EMAIL,
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: CONTACT_EMAIL, availableLanguage: "English" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <JsonLd data={organization} />
        {children}
      </body>
    </html>
  );
}
