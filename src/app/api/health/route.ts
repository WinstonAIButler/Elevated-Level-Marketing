import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/ai";

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
    payments: process.env.STRIPE_SECRET_KEY ? "configured" : "off",
    autopilot: process.env.CRON_SECRET ? "ok" : "missing CRON_SECRET",
  };
  const ready = status.database === "ok" && status.auth === "ok";
  return Response.json({ ready, ...status }, { status: ready ? 200 : 503 });
}
