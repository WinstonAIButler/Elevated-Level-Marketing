"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CHECK_COOKIE, hashIp, runVisibilityCheck } from "@/lib/visibility";
import type { FormState } from "./auth";

const CheckSchema = z.object({
  website: z.string().trim().min(4, "Enter your website address.").max(300),
  businessName: z.string().trim().min(2, "Enter your business name.").max(120),
  city: z.string().trim().min(2, "Enter your city or service area.").max(120),
  industry: z.string().trim().min(2, "Tell us what your business does.").max(120),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email or leave it blank.")]).optional(),
});

export async function runCheck(_: FormState, form: FormData): Promise<FormState> {
  const parsed = CheckSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  let id: string;
  try {
    id = await runVisibilityCheck({ ...parsed.data, email: parsed.data.email || undefined }, hashIp(ip));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The check couldn't run. Please try again." };
  }
  // Remember the check in this browser so it carries into the account if they sign up.
  (await cookies()).set(CHECK_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect(`/check/${id}`);
}
