import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/ai";
import { appConfigured, managedAdsConfigured, PROVIDERS } from "@/lib/channels";
import { encryptionEnabled } from "@/lib/crypto";
import { imagesEnabled } from "@/lib/images";

export const dynamic = "force-dynamic";

// Setup check: shows which services are configured, without revealing any values.
export async function GET() {
  let database = "missing DATABASE_URL";
  if (process.env.DATABASE_URL) {
    try {
      await db.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
      database = "ok";
    } catch {
      database = "cannot connect or tables missing (redeploy to run migrations)";
    }
  }
  const status = {
    database,
    auth: (process.env.AUTH_SECRET?.length ?? 0) >= 16 ? "ok" : "missing AUTH_SECRET (16+ characters)",
    ai: aiEnabled() ? `live (${process.env.ANTHROPIC_MODEL || "claude-opus-5-5"})` : "demo mode (add ANTHROPIC_API_KEY)",
    // Only the key's mode is reported (from its prefix), never the key.
    payments: !process.env.STRIPE_SECRET_KEY
      ? "off"
      : /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY)
        ? "live"
        : /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY)
          ? "TEST MODE (not live)"
          : "configured (unrecognized key type)",
    autopilot: process.env.CRON_SECRET ? "ok" : "missing CRON_SECRET",
    images: imagesEnabled() ? `on (${[process.env.OPENAI_API_KEY && "OpenAI", process.env.GOOGLE_AI_API_KEY && "Gemini"].filter(Boolean).join(" → ")})` : "off (add OPENAI_API_KEY or GOOGLE_AI_API_KEY)",
    tokenEncryption: encryptionEnabled() ? "ok" : "missing TOKEN_ENCRYPTION_KEY or CONNECTIONS_ENCRYPTION_KEY (needed to connect channels)",
    channels: Object.fromEntries(PROVIDERS.map((p) => [p, appConfigured(p) ? "app configured" : "no developer app"])),
    managedAds: { META: managedAdsConfigured("META") ? "ok" : "off", GOOGLE_ADS: managedAdsConfigured("GOOGLE_ADS") ? "ok" : "off" },
  };
  const ready = status.database === "ok" && status.auth === "ok";
  return Response.json({ ready, ...status }, { status: ready ? 200 : 503 });
}
