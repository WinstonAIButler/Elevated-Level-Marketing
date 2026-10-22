import { runAutopilotForAll } from "@/lib/autopilot";

export const maxDuration = 300;

// Weekly autopilot. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`
// (schedule in vercel.json); any other scheduler can do the same.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results = await runAutopilotForAll();
  return Response.json({ ran: results.length, results });
}
