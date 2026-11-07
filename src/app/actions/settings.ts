"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, requireUser } from "@/lib/auth";
import { refreshStripeStatus } from "@/lib/connect";
import type { ActionState } from "./adspend";

export async function updateName(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (name.length < 2) return { error: "Please enter your name." };
  await db.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/dashboard", "layout");
  return { ok: "Saved." };
}

export async function changePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Your current password is incorrect." };
  if (next.length < 8) return { error: "Your new password must be at least 8 characters." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  return { ok: "Password changed." };
}

export async function checkStripe() {
  const { business } = await requireBusiness();
  try {
    await refreshStripeStatus(business);
  } catch (err) {
    console.error("Stripe status check failed", err);
  }
  revalidatePath("/dashboard/settings");
}
