"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { CHANNELS, isProvider } from "@/lib/channels";
import { logActivity } from "@/lib/usage";

export async function disconnectChannel(form: FormData) {
  const { business } = await requireBusiness();
  const provider = String(form.get("provider"));
  if (!isProvider(provider)) return;
  const res = await db.channelConnection.deleteMany({ where: { businessId: business.id, provider } });
  if (res.count) await logActivity(business.id, "channels", `Disconnected ${CHANNELS[provider].name}`);
  revalidatePath("/dashboard/channels");
}
