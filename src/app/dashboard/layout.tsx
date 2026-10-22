import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { TIERS } from "@/lib/tiers";

// AI generation (plans, campaigns) can take a minute or two.
export const maxDuration = 300;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="dash">
      <aside className="sidebar">
        <Logo variant="white" href="/dashboard" />
        <NavLinks />
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
          <form action={logout}>
            <button className="btn btn-ghost btn-sm" style={{ color: "#cfd6dd", borderColor: "rgba(255,255,255,.2)" }}>
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
