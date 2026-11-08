import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { CRM_OAUTH_COOKIE, crmAuthorizeUrl, isCrmProvider, oauthAvailable } from "@/lib/crm";
import { encryptionEnabled } from "@/lib/crypto";

// Starts one-click CRM sign-in. The callback checks the signed state and the cookie nonce.
export async function GET(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { user } = await requireBusiness();
  const provider = (await ctx.params).provider.toUpperCase();
  if (!isCrmProvider(provider) || !oauthAvailable(provider) || !encryptionEnabled()) redirect("/dashboard/leads/connect?error=not-available");
  const nonce = randomBytes(16).toString("base64url");
  const state = await new SignJWT({ p: provider, n: nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  (await cookies()).set(CRM_OAUTH_COOKIE, nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/crm", maxAge: 900 });
  redirect(crmAuthorizeUrl(provider, state));
}
