import { trackAllLeads } from "@/lib/crm";

export const maxDuration = 300;

// Daily: follow every lead Elevated sent to a client CRM (stage, deals/jobs, won value).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await trackAllLeads());
}
