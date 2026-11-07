import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Owners Hub", robots: { index: false, follow: false } };
export const maxDuration = 300;

const LINKS = [
  { href: "/hub", label: "Overview" },
  { href: "/hub#queue", label: "Team queue" },
  { href: "/hub#access", label: "Account access" },
  { href: "/hub#clients", label: "Clients" },
  { href: "/hub#stripe", label: "Client Stripe accounts" },
];

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOwner();
  return (
    <div className="dash">
      <aside className="sidebar">
        <Logo href="/hub" />
        <div className="small" style={{ color: "var(--green)", fontWeight: 700, letterSpacing: ".08em", margin: "-8px 12px 12px" }}>OWNERS HUB</div>
        {LINKS.map((l) => <Link key={l.href} href={l.href} className="nav">{l.label}</Link>)}
        <Link href="/dashboard" className="nav" style={{ marginTop: 8 }}>Client portal →</Link>
        <a href="/jarvis" className="nav">Jarvis →</a>
        <div className="spacer" />
        <div className="account">
          <div style={{ color: "#fff", fontWeight: 600 }}>{user.name}</div>
          <div>{user.email}</div>
          <form action={logout} style={{ marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ color: "#cfd6dd", borderColor: "rgba(255,255,255,.2)" }}>Log out</button>
          </form>
        </div>
      </aside>
      <main className="main" id="main">{children}</main>
    </div>
  );
}
