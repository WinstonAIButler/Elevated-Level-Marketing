import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";

export async function startSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function currentUser() {
  const store = await cookies();
  const userId = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId }, include: { business: true } });
}

/** For pages and actions behind login. Redirects to /login when signed out. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Like requireUser, but also requires a completed business profile. */
export async function requireBusiness() {
  const user = await requireUser();
  if (!user.business) redirect("/dashboard/business");
  return { user, business: user.business };
}

/** Owners Hub access: emails in OWNER_EMAILS (comma separated). */
export function ownerEmails() {
  return (process.env.OWNER_EMAILS || "justin.joslin@joslinholdings.biz")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwner(user: { email: string } | null | undefined) {
  return Boolean(user && ownerEmails().includes(user.email.toLowerCase()));
}

/** For the Owners Hub. Signed-out people go to login; signed-in non-owners get a 404. */
export async function requireOwner() {
  const user = await requireUser();
  if (!isOwner(user)) notFound();
  return user;
}
