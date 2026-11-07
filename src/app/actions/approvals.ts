"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { publishItem, queueCampaignPosts } from "@/lib/publishing";
import { addImageToItem } from "@/lib/images";
import { logActivity } from "@/lib/usage";
import type { ActionState } from "./adspend";

function validImageUrl(url: string) {
  return /^https:\/\/\S+$/i.test(url);
}

function refresh() {
  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard");
}

/** Approve (optionally with edits) or reject one queued post or ad. */
export async function decideItem(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const id = String(form.get("id"));
  const item = await db.publishItem.findFirst({ where: { id, businessId: business.id, status: "PENDING_APPROVAL" } });
  if (!item) return { error: "This item was already handled." };

  if (form.get("decision") === "reject") {
    await db.publishItem.update({ where: { id }, data: { status: "REJECTED", decidedAt: new Date() } });
    await logActivity(business.id, "approvals", `Rejected: ${item.title}`);
    refresh();
    return { ok: "Rejected." };
  }

  const payload = { ...(item.payload as Record<string, unknown>) };
  const text = form.get("text");
  if (typeof text === "string" && text.trim()) payload[item.kind === "AD" ? "primaryText" : "text"] = text.trim();
  const image = String(form.get("imageUrl") ?? "").trim();
  if (image) {
    if (!validImageUrl(image)) return { error: "The image link must be a full https:// address." };
    payload.imageUrl = image;
  }
  if (payload.placement === "instagram" && !payload.imageUrl) {
    return { error: "Instagram needs an image. Paste a link to the photo you want to use, then approve." };
  }
  if (item.kind === "AD" && !payload.link) {
    return { error: "Ads need your website address. Add it on the Business profile page first." };
  }

  await db.publishItem.update({
    where: { id },
    data: { status: "APPROVED", decidedAt: new Date(), payload: payload as Prisma.InputJsonValue, error: null },
  });
  await logActivity(business.id, "approvals", `Approved: ${item.title}`);
  if (item.scheduledFor <= new Date()) await publishItem(id);
  refresh();
  return { ok: item.scheduledFor <= new Date() ? "Approved and sent." : "Approved. It will go out on schedule." };
}

/** Approve every pending post that doesn't need anything else from the client. */
export async function approveAllPosts() {
  const { business } = await requireBusiness();
  const pending = await db.publishItem.findMany({ where: { businessId: business.id, status: "PENDING_APPROVAL", kind: "POST" } });
  const ready = pending.filter((i) => {
    const p = i.payload as Record<string, unknown>;
    return !(p.placement === "instagram" && !p.imageUrl);
  });
  if (!ready.length) return;
  await db.publishItem.updateMany({ where: { id: { in: ready.map((i) => i.id) } }, data: { status: "APPROVED", decidedAt: new Date() } });
  await logActivity(business.id, "approvals", `Approved ${ready.length} post${ready.length === 1 ? "" : "s"}`);
  for (const i of ready) if (i.scheduledFor <= new Date()) await publishItem(i.id);
  refresh();
}

export async function retryItem(form: FormData) {
  const { business } = await requireBusiness();
  await db.publishItem.updateMany({
    where: { id: String(form.get("id")), businessId: business.id, status: "FAILED" },
    data: { status: "APPROVED", attempts: 0, error: null, scheduledFor: new Date() },
  });
  await publishItem(String(form.get("id")));
  refresh();
}

export async function sendCampaignToQueue(form: FormData) {
  const { business } = await requireBusiness();
  const campaign = await db.campaign.findFirst({ where: { id: String(form.get("id")), businessId: business.id } });
  if (campaign) await queueCampaignPosts(business, campaign);
  revalidatePath(`/dashboard/campaigns/${campaign?.id}`);
  refresh();
}

export async function createImage(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const item = await db.publishItem.findFirst({ where: { id: String(form.get("id")), businessId: business.id, status: "PENDING_APPROVAL" } });
  if (!item) return { error: "This item was already handled." };
  try {
    await addImageToItem(item.id, true);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't create an image" };
  }
  refresh();
  return { ok: "New image ready." };
}
