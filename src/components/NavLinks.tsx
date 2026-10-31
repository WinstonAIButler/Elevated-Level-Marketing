"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/business", label: "Business profile" },
  { href: "/dashboard/assessment", label: "Assessment" },
  { href: "/dashboard/plan", label: "Marketing plan" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/website", label: "Website & AI visibility" },
  { href: "/dashboard/billing", label: "Billing" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {LINKS.map((l) => {
        const active = l.href === "/dashboard" ? path === l.href : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`nav ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
