import { syncAllCrms } from "@/lib/crm";

export const maxDuration = 300;

// Daily: pull new contacts and won deals/jobs from every connected CRM.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const results = await syncAllCrms();
  return Response.json({ synced: results.length, results });
}
