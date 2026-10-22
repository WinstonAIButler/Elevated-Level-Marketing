"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/usage";
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
  revalidatePath("/dashboard");
  if (isNew) redirect("/dashboard/assessment");
  return { ok: "Saved." };
}
