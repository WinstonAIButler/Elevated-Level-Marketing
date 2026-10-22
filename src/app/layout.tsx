import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Elevated Digital Marketing", template: "%s | Elevated Digital Marketing" },
  description:
    "Automated marketing assessments, 12-week marketing plans and AI-generated campaigns that run your marketing for you.",
  icons: { icon: [{ url: "/brand/logo-mark.svg", type: "image/svg+xml" }, { url: "/favicon-32.png" }], apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
