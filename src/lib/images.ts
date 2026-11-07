import "server-only";
import type { Business, Prisma } from "@prisma/client";
import { db } from "./db";
import { appUrl } from "./stripe";
import { fetchJson } from "./publishers/http";
import { assertWithinLimit } from "./usage";

// AI images for posts and ads. Uses the same keys as the other Joslin Enterprises
// apps: OPENAI_API_KEY (tried first) and GOOGLE_AI_API_KEY (Gemini, fallback).
// Images are stored in MediaAsset and served at /api/media/<id>.

export const imagesEnabled = () => Boolean(process.env.OPENAI_API_KEY || process.env.GOOGLE_AI_API_KEY);

export function imagePrompt(business: Business, idea: string) {
  return [
    `Professional social media marketing photo for ${business.name}, a ${business.industry} business${business.location ? ` in ${business.location}` : ""}.`,
    `Scene: ${idea}`,
    business.brandVoice ? `Mood should match this brand voice: ${business.brandVoice}.` : "",
    "Photorealistic, natural light, warm and inviting, square composition with clear space, high quality.",
    "No text, words, letters, logos, watermarks or brand names in the image. No recognisable real people or celebrities. Nothing that implies a customer review or a before/after result.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function viaOpenAI(prompt: string) {
  const res = await fetchJson<any>("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
    signal: AbortSignal.timeout(120_000),
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  return { data: Buffer.from(b64, "base64"), contentType: "image/png", source: "openai" };
}

async function viaGemini(prompt: string) {
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const res = await fetchJson<any>(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GOOGLE_AI_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
    signal: AbortSignal.timeout(120_000),
  });
  const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
  if (!part) throw new Error("Gemini returned no image");
  return { data: Buffer.from(part.inlineData.data, "base64"), contentType: part.inlineData.mimeType || "image/png", source: "gemini" };
}

/** Generates and stores an image; returns its public URL. */
export async function generateImage(business: Business, idea: string) {
  const prompt = imagePrompt(business, idea);
  const errors: string[] = [];
  for (const [enabled, fn] of [
    [Boolean(process.env.OPENAI_API_KEY), viaOpenAI],
    [Boolean(process.env.GOOGLE_AI_API_KEY), viaGemini],
  ] as const) {
    if (!enabled) continue;
    try {
      const img = await fn(prompt);
      const asset = await db.mediaAsset.create({
        data: { businessId: business.id, contentType: img.contentType, data: img.data, prompt, source: img.source },
        select: { id: true },
      });
      return `${appUrl()}/api/media/${asset.id}`;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(errors.length ? `Image generation failed: ${errors.join("; ")}` : "No image provider configured");
}

/** Adds an image to a queued item that doesn't have one yet. */
export async function addImageToItem(itemId: string, force = false) {
  const item = await db.publishItem.findUnique({ where: { id: itemId }, include: { business: { include: { user: true } } } });
  if (!item) return;
  await assertWithinLimit(item.business.user, item.businessId, "images");
  const payload = item.payload as Record<string, unknown>;
  if (payload.imageUrl && !force) return;
  const idea = String(payload.visualIdea ?? payload.imageIdea ?? item.title);
  const url = await generateImage(item.business, idea);
  await db.publishItem.update({
    where: { id: item.id },
    data: { payload: { ...payload, imageUrl: url, imageGenerated: true } as Prisma.InputJsonValue },
  });
  return url;
}

/** Cron helper: give pending posts/ads that need a picture one, a few per run. */
export async function fillMissingImages(limit = 8) {
  if (!imagesEnabled()) return 0;
  const pending = await db.publishItem.findMany({
    where: { status: "PENDING_APPROVAL", provider: { in: ["META", "GOOGLE_BUSINESS"] } },
    orderBy: { createdAt: "asc" },
    take: limit * 3,
  });
  let done = 0;
  for (const item of pending) {
    if (done >= limit) break;
    const p = item.payload as Record<string, unknown>;
    if (p.imageUrl || p.imageFailed) continue;
    try {
      await addImageToItem(item.id);
      done++;
    } catch (err) {
      console.error("image generation failed", item.id, err);
      await db.publishItem.update({ where: { id: item.id }, data: { payload: { ...p, imageFailed: true } as Prisma.InputJsonValue } });
    }
  }
  return done;
}
