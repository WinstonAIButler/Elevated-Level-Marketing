import { syncSpend } from "@/lib/publishing";

export const maxDuration = 300;

// Every few hours: pulls ad spend and results, debits wallets, pauses ads when a wallet runs low.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await syncSpend());
}
