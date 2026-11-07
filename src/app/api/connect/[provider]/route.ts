import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { appConfigured, isProvider } from "@/lib/channels";
import { encryptionEnabled } from "@/lib/crypto";
import { authorizeUrl, OAUTH, OAUTH_COOKIE, pkcePair } from "@/lib/oauth";

// Starts the platform's sign-in. The callback checks the signed state and the cookie nonce.
export async function GET(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { user } = await requireBusiness();
  const provider = (await ctx.params).provider.toUpperCase();
  if (!isProvider(provider)) redirect("/dashboard/channels?error=unknown");
  if (!appConfigured(provider) || !encryptionEnabled()) redirect(`/dashboard/channels?error=not-configured&p=${provider}`);

  const nonce = randomBytes(16).toString("base64url");
  const pkce = OAUTH[provider].pkce ? pkcePair() : null;
  const state = await new SignJWT({ p: provider, n: nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

  const store = await cookies();
  store.set(OAUTH_COOKIE, JSON.stringify({ n: nonce, v: pkce?.verifier }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/connect",
    maxAge: 900,
  });
  redirect(authorizeUrl(provider, state, pkce?.challenge));
}
