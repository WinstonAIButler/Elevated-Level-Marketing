import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { CONNECTORS, CRM_OAUTH_COOKIE, exchangeCrmCode, isCrmProvider, saveCrmConnection, syncCrm } from "@/lib/crm";

export const maxDuration = 300;

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { user, business } = await requireBusiness();
  const provider = (await ctx.params).provider.toUpperCase();
  const url = new URL(req.url);
  const back = (q: string) => redirect(`/dashboard/leads/connect?${q}`);
  if (!isCrmProvider(provider)) return back("error=unknown");
  if (url.searchParams.get("error")) return back(`error=${encodeURIComponent(`${CONNECTORS[provider].name} sign-in was cancelled`)}`);

  const store = await cookies();
  const nonce = store.get(CRM_OAUTH_COOKIE)?.value;
  store.delete(CRM_OAUTH_COOKIE);
  try {
    const { payload } = await jwtVerify(url.searchParams.get("state") ?? "", new TextEncoder().encode(process.env.AUTH_SECRET!));
    if (payload.sub !== user.id || payload.p !== provider || !nonce || payload.n !== nonce) throw new Error("state");
  } catch {
    return back("error=That+sign-in+link+expired.+Please+try+again.");
  }

  let message = "";
  try {
    // Zoho tells us which data centre the account lives in.
    const extra = provider === "ZOHO" && url.searchParams.get("accounts-server") ? { accountsServer: url.searchParams.get("accounts-server") } : {};
    const t = await exchangeCrmCode(provider, url.searchParams.get("code") ?? "", extra);
    const conn = await saveCrmConnection(business.id, provider, { method: "oauth", accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt, extra: t.extra });
    await syncCrm(conn).catch(() => {});
  } catch (err) {
    message = err instanceof Error ? err.message : "Connection failed";
  }
  if (message) return back(`error=${encodeURIComponent(message)}`);
  redirect(`/dashboard/leads/connect?connected=${provider}`);
}
