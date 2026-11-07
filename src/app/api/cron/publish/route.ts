import { publishDue } from "@/lib/publishing";
import { fillMissingImages } from "@/lib/images";

export const maxDuration = 300;

// Hourly: adds AI images to queued posts and ads, publishes approved items that are due,
// and resumes ads once a wallet is topped up.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const images = await fillMissingImages();
  return Response.json({ ...(await publishDue()), images });
}
