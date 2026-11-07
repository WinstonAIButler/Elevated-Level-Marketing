"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { CHANNELS, isProvider } from "@/lib/channels";
import { logActivity } from "@/lib/usage";
import type { ActionState } from "./adspend";

export async function disconnectChannel(form: FormData) {
  const { business } = await requireBusiness();
  const provider = String(form.get("provider"));
  if (!isProvider(provider)) return;
  const res = await db.channelConnection.deleteMany({ where: { businessId: business.id, provider } });
  if (res.count) await logActivity(business.id, "channels", `Removed ${CHANNELS[provider].name}`);
  revalidatePath("/dashboard/channels");
  revalidatePath("/dashboard");
}

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 300);

function normalizeHandle(v: string) {
  if (!v) return v;
  if (/^https?:\/\//i.test(v) || v.includes("/") || v.includes(" ")) return v;
  return v.startsWith("@") ? v : `@${v}`;
}

/** The client links an account by entering it and giving Elevated access. */
export async function linkChannel(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const provider = String(form.get("provider"));
  if (!isProvider(provider)) return { error: "Unknown platform." };
  const info = CHANNELS[provider];

  let account = clean(form.get("account"));
  const extra = clean(form.get("extra"));
  if (account.length < 2) return { error: `Enter your ${info.name} account.` };

  let adAccountId: string | null = null;
  if (provider === "GOOGLE_ADS") {
    const digits = account.replace(/\D/g, "");
    if (digits.length !== 10) return { error: "A Google Ads customer ID has 10 digits, like 123-456-7890." };
    account = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    adAccountId = digits;
  }
  if (provider === "TIKTOK" || provider === "X") account = normalizeHandle(account);
  if (/^(facebook|linkedin)\./i.test(account) || /^www\./i.test(account)) account = `https://${account}`;

  const existing = await db.channelConnection.findUnique({ where: { businessId_provider: { businessId: business.id, provider } } });
  if (existing?.method === "oauth" && existing.status === "active") {
    return { error: `${info.name} is already connected with one-click sign-in.` };
  }

  const data = {
    method: "manual",
    status: "linked",
    profileUrl: account,
    accountName: account,
    adAccountId,
    accessTokenEnc: null,
    refreshTokenEnc: null,
    expiresAt: null,
    lastError: null,
    extra: {
      ...(extra ? { secondary: provider === "META" ? normalizeHandle(extra) : extra } : {}),
      accessGranted: form.get("accessGranted") === "on",
      linkedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue,
  };
  await db.channelConnection.upsert({
    where: { businessId_provider: { businessId: business.id, provider } },
    create: { businessId: business.id, provider, ...data },
    update: data,
  });
  await logActivity(
    business.id,
    "channels",
    `Linked ${info.name} (${account})${form.get("accessGranted") === "on" ? ", access given to Elevated" : ", waiting for access"}`,
  );
  revalidatePath("/dashboard/channels");
  revalidatePath("/dashboard");
  return { ok: `${info.name} linked.` };
}
