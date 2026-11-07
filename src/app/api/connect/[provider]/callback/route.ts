import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { CHANNELS, isProvider } from "@/lib/channels";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, OAUTH_COOKIE } from "@/lib/oauth";
import { PUBLISHERS } from "@/lib/publishers";
import { logActivity } from "@/lib/usage";

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { user, business } = await requireBusiness();
  const provider = (await ctx.params).provider.toUpperCase();
  const url = new URL(req.url);
  const fail = (msg: string) => redirect(`/dashboard/channels?error=${encodeURIComponent(msg)}`);
  if (!isProvider(provider)) return fail("Unknown platform");
  if (url.searchParams.get("error")) return fail(`${CHANNELS[provider].name} sign-in was cancelled`);

  const store = await cookies();
  const cookie = JSON.parse(store.get(OAUTH_COOKIE)?.value ?? "{}") as { n?: string; v?: string };
  store.delete(OAUTH_COOKIE);
  try {
    const { payload } = await jwtVerify(url.searchParams.get("state") ?? "", new TextEncoder().encode(process.env.AUTH_SECRET!));
    if (payload.sub !== user.id || payload.p !== provider || !cookie.n || payload.n !== cookie.n) throw new Error("state mismatch");
  } catch {
    return fail("That sign-in link expired. Please try connecting again.");
  }

  let saved = false;
  let message = "";
  try {
    const tokens = await exchangeCode(provider, url.searchParams.get("code") ?? "", cookie.v);
    const found = await PUBLISHERS[provider].discover(tokens);
    const extra = { ...(found.extra ?? {}) };
    // Meta: post with the Page token; keep the user token (encrypted in extra) for ads.
    let accessToken = tokens.accessToken;
    if (provider === "META" && extra.pageToken) {
      accessToken = extra.pageToken;
      delete extra.pageToken;
    }
    const data = {
      accountId: found.accountId,
      accountName: found.accountName,
      adAccountId: found.adAccountId ?? null,
      extra: extra as Prisma.InputJsonValue,
      accessTokenEnc: encrypt(accessToken),
      refreshTokenEnc: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      expiresAt: provider === "META" ? null : (tokens.expiresAt ?? null),
      scopes: tokens.scope ?? null,
      status: "active",
      lastError: null,
    };
    await db.channelConnection.upsert({
      where: { businessId_provider: { businessId: business.id, provider } },
      create: { businessId: business.id, provider, ...data },
      update: data,
    });
    await logActivity(business.id, "channels", `Connected ${CHANNELS[provider].name}${found.accountName ? ` (${found.accountName})` : ""}`);
    saved = true;
  } catch (err) {
    message = err instanceof Error ? err.message : "Connection failed";
  }
  if (!saved) return fail(message);
  redirect(`/dashboard/channels?connected=${provider}`);
}
