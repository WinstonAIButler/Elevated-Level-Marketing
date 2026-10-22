"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { CampaignStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { campaign as generateCampaignContent, CampaignBrief } from "@/lib/ai";
import { addDays } from "@/lib/format";
import { assertWithinLimit, logActivity } from "@/lib/usage";
import type { FormState } from "./auth";

export async function generateCampaign(_: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness();
  const channels = form.getAll("channels").map(String).filter(Boolean);
  const parsed = CampaignBrief.safeParse({
    objective: String(form.get("objective") ?? "").trim(),
    channels,
    offer: String(form.get("offer") ?? "").trim() || undefined,
    audience: String(form.get("audience") ?? "").trim() || undefined,
    budget: Number(form.get("budget") || 0),
    durationDays: Number(form.get("durationDays") || 14),
    notes: String(form.get("notes") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    return { error: channels.length ? "Please describe the campaign objective." : "Pick at least one channel." };
  }

  let id: string;
  try {
    await assertWithinLimit(user, business.id, "campaigns");
    const brief = parsed.data;
    const { campaign, ai } = await generateCampaignContent(business, brief);
    const plan = await db.marketingPlan.findFirst({ where: { businessId: business.id, active: true } });
    const start = new Date();
    const saved = await db.campaign.create({
      data: {
        businessId: business.id,
        planId: plan?.id,
        name: campaign.name,
        objective: brief.objective,
        channels: brief.channels,
        audience: campaign.audience,
        offer: brief.offer,
        budget: brief.budget,
        startDate: start,
        endDate: addDays(start, brief.durationDays),
        content: campaign,
        aiGenerated: ai,
      },
    });
    await logActivity(business.id, "campaign", `Campaign drafted: ${campaign.name}`);
    id = saved.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
  redirect(`/dashboard/campaigns/${id}`);
}

const STATUSES: CampaignStatus[] = ["DRAFT", "APPROVED", "SCHEDULED", "LIVE", "COMPLETED"];

export async function setCampaignStatus(form: FormData) {
  const { business } = await requireBusiness();
  const id = String(form.get("campaignId"));
  const status = String(form.get("status")) as CampaignStatus;
  if (!STATUSES.includes(status)) return;
  const found = await db.campaign.findFirst({ where: { id, businessId: business.id } });
  if (!found) return;
  await db.campaign.update({ where: { id }, data: { status } });
  await logActivity(business.id, "campaign", `${found.name} marked ${status.toLowerCase()}`);
  revalidatePath(`/dashboard/campaigns/${id}`);
  revalidatePath("/dashboard/campaigns");
}

export async function deleteCampaign(form: FormData) {
  const { business } = await requireBusiness();
  const id = String(form.get("campaignId"));
  await db.campaign.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/dashboard/campaigns");
  redirect("/dashboard/campaigns");
}
