import { isOwner, requireUser } from "@/lib/auth";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { MobileMenu } from "@/components/MobileMenu";
import { TIERS } from "@/lib/tiers";

// AI generation (plans, campaigns) can take a minute or two.
export const maxDuration = 300;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const logoutButton = () => (
    <form action={logout}>
      <button className="btn btn-ghost btn-sm" style={{ color: "#cfd6dd", borderColor: "rgba(255,255,255,.2)" }}>
        Log out
      </button>
    </form>
  );
  return (
    <div className="dash">
      <MobileMenu logo={<Logo href="/dashboard" />}>
        <NavLinks />
        {isOwner(user) && <Link href="/hub" className="nav" style={{ color: "var(--green)" }}>Owners Hub →</Link>}
        <div className="mobile-account">
          <div>
            <div style={{ color: "#fff", fontWeight: 600 }}>{user.business?.name ?? user.name}</div>
            <div className="small">{user.email} · {TIERS[user.tier].name}</div>
          </div>
          {logoutButton()}
        </div>
      </MobileMenu>
      <aside className="sidebar">
        <Logo href="/dashboard" />
        <NavLinks />
        {isOwner(user) && <Link href="/hub" className="nav" style={{ marginTop: 8, color: "var(--green)" }}>Owners Hub →</Link>}
        <div className="spacer" />
        <div className="account">
          <div>
            <div style={{ color: "#fff", fontWeight: 600 }}>{user.name}</div>
            <div>{user.business?.name ?? user.email}</div>
          </div>
          <div style={{ margin: "8px 0" }}>
            <span className="badge" style={{ background: "rgba(168,217,50,.15)", color: "var(--green)" }}>
              {TIERS[user.tier].name}
            </span>
          </div>
          {logoutButton()}
        </div>
      </aside>
      <main className="main" id="main">{children}</main>
    </div>
  );
}
