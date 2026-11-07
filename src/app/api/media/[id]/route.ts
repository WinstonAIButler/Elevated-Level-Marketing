import { db } from "@/lib/db";

// Public image URLs for generated post/ad images. Ids are unguessable cuids; the
// platforms (Instagram, Meta, Google) fetch the image from here when publishing.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { data: true, contentType: true } });
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
