"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { runWebsiteAudit } from "@/lib/site-audit-fetch";
import type { FormState } from "./auth";

const COOLDOWN_MS = 5 * 60 * 1000;

export async function auditMyWebsite(_: FormState): Promise<FormState> {
  const { business } = await requireBusiness();
  if (!business.website) return { error: "Add your website address in your business profile first." };
  const recent = await db.websiteAudit.findFirst({
    where: { businessId: business.id, createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) } },
  });
  if (recent) return { error: "Your website was audited in the last few minutes. Make your fixes, then try again shortly." };
  try {
    await runWebsiteAudit(business);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The audit failed. Please try again." };
  }
  revalidatePath("/dashboard/website");
  revalidatePath("/dashboard");
  return { ok: "Audit complete." };
}
