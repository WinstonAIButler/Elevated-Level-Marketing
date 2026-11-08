"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/usage";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { CHECK_COOKIE } from "@/lib/visibility";
import type { FormState } from "./auth";

const text = (min = 0) => z.string().trim().min(min);
const BusinessSchema = z.object({
  name: text(2),
  industry: text(2),
  website: text().optional(),
  location: text().optional(),
  description: text(10),
  targetAudience: text(5),
  goals: text(5),
  brandVoice: text().optional(),
  competitors: text().optional(),
  monthlyBudget: z.coerce.number().int().nonnegative().default(0),
});

export async function saveBusiness(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = BusinessSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `Please check "${String(issue.path[0])}": ${issue.message}` };
  }
  const isNew = !user.business;
  const business = await db.business.upsert({
    where: { userId: user.id },
    create: { ...parsed.data, userId: user.id },
    update: parsed.data,
  });
  await logActivity(business.id, "profile", isNew ? "Business profile created" : "Business profile updated");
  if (isNew) await claimVisibilityCheck(business.id);
  revalidatePath("/dashboard");
  if (isNew) redirect("/dashboard/assessment");
  return { ok: "Saved." };
}

/** Attaches the free visibility check this browser ran before sign-up to the new business. */
async function claimVisibilityCheck(businessId: string) {
  const store = await cookies();
  const id = store.get(CHECK_COOKIE)?.value;
  if (!id) return;
  store.delete(CHECK_COOKIE);
  const claimed = await db.visibilityCheck.updateMany({ where: { id, businessId: null }, data: { businessId } });
  if (!claimed.count) return;
  const check = await db.visibilityCheck.findUnique({ where: { id } });
  if (check?.siteScore != null && check.checks) {
    await db.websiteAudit.create({
      data: { businessId, url: check.url, score: check.siteScore, checks: check.checks as Prisma.InputJsonValue, createdAt: check.createdAt },
    });
  }
  await logActivity(
    businessId,
    "website",
    `Free visibility check added: website ${check?.siteScore ?? "–"}/100${check?.aiScore != null ? `, AI search ${check.aiScore}/100` : ""}`,
  );
}
