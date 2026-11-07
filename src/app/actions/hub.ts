"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { CHANNELS, isProvider } from "@/lib/channels";
import { publishItem } from "@/lib/publishing";
import { logActivity } from "@/lib/usage";

/** The team published an item by hand: record it as live for the client. */
export async function markPublished(form: FormData) {
  await requireOwner();
  const id = String(form.get("id"));
  const link = String(form.get("link") ?? "").trim();
  const item = await db.publishItem.findUnique({ where: { id } });
  if (!item || !["NEEDS_TEAM", "FAILED"].includes(item.status)) return;
  await db.publishItem.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), externalUrl: /^https?:\/\//.test(link) ? link : item.externalUrl, error: null },
  });
  await logActivity(item.businessId, "publishing", `Published by the Elevated team: ${item.title}`);
  revalidatePath("/hub");
}

/** Send a failed or handed-off item back through automatic publishing. */
export async function retryFromHub(form: FormData) {
  await requireOwner();
  const id = String(form.get("id"));
  const res = await db.publishItem.updateMany({
    where: { id, status: { in: ["FAILED", "NEEDS_TEAM"] } },
    data: { status: "APPROVED", attempts: 0, error: null, scheduledFor: new Date() },
  });
  if (res.count) await publishItem(id);
  revalidatePath("/hub");
}

/** The team confirmed it has access to an account the client linked by hand. */
export async function confirmAccess(form: FormData) {
  await requireOwner();
  const businessId = String(form.get("businessId"));
  const provider = String(form.get("provider"));
  if (!isProvider(provider)) return;
  const conn = await db.channelConnection.findUnique({ where: { businessId_provider: { businessId, provider } } });
  if (!conn) return;
  const extra = { ...((conn.extra as Record<string, unknown>) ?? {}), accessGranted: true, accessConfirmedAt: new Date().toISOString() };
  await db.channelConnection.update({ where: { id: conn.id }, data: { extra: extra as Prisma.InputJsonValue } });
  await logActivity(businessId, "channels", `Elevated confirmed access to your ${CHANNELS[provider].name} account`);
  revalidatePath("/hub");
}
