// GET/POST /api/jarvis: Jarvis, Elevated Level Marketing's operations chief of staff (page at /jarvis).
// Reads Stripe and GitHub (never writes) and has Claude write the briefing and answer questions.
// Environment variables:
//   JARVIS_ACCESS_CODE  optional; if set, the page asks for it (Jarvis is open without it)
//   ANTHROPIC_API_KEY   Claude, for briefings and questions
//   JARVIS_STRIPE_KEY   a restricted, read-only Stripe key (falls back to STRIPE_SECRET_KEY)
//   GITHUB_TOKEN        a fine-grained, read-only token for this repo
//   JARVIS_MODEL        optional, default claude-sonnet-5-5
import { companyConfig, handleJarvis, type JarvisCompany } from "@/lib/jarvis/jarvis-core";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const COMPANY: JarvisCompany = {
  "id": "elm",
  "name": "Elevated Level Marketing",
  "repo": "WinstonAIButler/elevated-level-marketing",
  "context": "Elevated Level Marketing (Elevated Digital Marketing) is a self-serve marketing platform for small-business owners: an automated marketing assessment, a 12-week marketing plan tracked task by task, AI-generated campaigns (ads, social, email, landing pages) and a weekly autopilot. Free trial, then Starter $149, Growth $399 and Elite $899 per month via Stripe."
};

async function respond(request: Request) {
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : undefined;
  const out = await handleJarvis(
    { method: request.method, headers: request.headers, body },
    companyConfig(process.env, COMPANY),
  );
  return Response.json(out.body, { status: out.status, headers: { "Cache-Control": "no-store" } });
}

export const GET = respond;
export const POST = respond;
