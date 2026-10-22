import Link from "next/link";
import { Logo } from "./Logo";
import { currentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="site-header">
      <div className="container">
        <Logo />
        <nav>
          <Link href="/#how" className="hide-sm">How it works</Link>
          <Link href="/#pricing" className="hide-sm">Pricing</Link>
          {user ? (
            <Link href="/dashboard" className="btn btn-dark btn-sm">Dashboard</Link>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
