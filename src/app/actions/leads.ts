"use server";
import { revalidatePath } from "next/cache";
import type { LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { recordLead } from "@/lib/leads";
import { CHANNELS, normalizeSource, parseMoneyToCents } from "@/lib/leads-core";
import { CONNECTORS, isCrmProvider, saveCrmConnection, sendLeadToCrm, trackAllLeads, trackLead } from "@/lib/crm";
import { encryptionEnabled } from "@/lib/crypto";
import { logActivity } from "@/lib/usage";
import type { ActionState } from "./adspend";

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "WON", "LOST"];
const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

function refresh() {
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/results");
  revalidatePath("/dashboard");
}

export async function addLead(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const name = get("name");
  if (name.length < 2) return { error: "Add the lead's name." };
  const status = STATUSES.includes(get("status") as LeadStatus) ? (get("status") as LeadStatus) : "NEW";
  const source = (CHANNELS as readonly string[]).includes(get("source")) ? get("source") : normalizeSource(get("source"));
  await recordLead(business, {
    name,
    email: get("email") || null,
    phone: get("phone") || null,
    source,
    elevated: form.get("elevated") === "on",
    status,
    valueCents: parseMoneyToCents(get("value")),
    notes: get("notes") || null,
    origin: "manual",
  });
  refresh();
  return { ok: "Lead added." };
}

export async function updateLead(form: FormData) {
  const { business } = await requireBusiness();
  const id = String(form.get("id"));
  const lead = await db.lead.findFirst({ where: { id, businessId: business.id } });
  if (!lead) return;
  const status = String(form.get("status") ?? lead.status) as LeadStatus;
  const value = form.get("value");
  await db.lead.update({
    where: { id },
    data: {
      status: STATUSES.includes(status) ? status : lead.status,
      valueCents: value === null ? lead.valueCents : parseMoneyToCents(String(value)),
      wonAt: status === "WON" ? lead.wonAt ?? new Date() : null,
    },
  });
  refresh();
}

export async function deleteLead(form: FormData) {
  const { business } = await requireBusiness();
  await db.lead.deleteMany({ where: { id: String(form.get("id")), businessId: business.id } });
  refresh();
}

export async function connectCrmToken(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const provider = String(form.get("provider"));
  const token = String(form.get("token") ?? "").trim();
  if (!isCrmProvider(provider) || !CONNECTORS[provider].methods.includes("token")) return { error: "Unknown CRM." };
  if (!encryptionEnabled()) return { error: "CRM connections aren't available yet. Please try again later." };
  if (token.length < 10) return { error: `Paste your ${CONNECTORS[provider].tokenLabel ?? "key"}.` };
  try {
    await saveCrmConnection(business.id, provider, { method: "token", accessToken: token });
    refresh();
    revalidatePath("/dashboard/leads/connect");
    return { ok: `${CONNECTORS[provider].name} connected. New leads from Elevated will go there, and we'll follow each one to a sale.` };
  } catch (err) {
    return { error: `Couldn't connect: ${errorText(err)}. Check the key and its permissions.` };
  }
}

/** Re-checks every lead this business sent to its CRM. */
export async function checkCrmNow(_: ActionState): Promise<ActionState> {
  const { business } = await requireBusiness();
  try {
    const r = await trackAllLeads(business.id);
    refresh();
    revalidatePath("/dashboard/leads/connect");
    if (r.errors.length) return { error: `Checked ${r.checked}; some couldn't be read: ${r.errors[0]}` };
    return { ok: `Checked ${r.checked} lead${r.checked === 1 ? "" : "s"} in your CRM.` };
  } catch (err) {
    return { error: errorText(err) };
  }
}

/** Sends one lead to the CRM by hand (when automatic sending is off, or it failed). */
export async function sendToCrm(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const lead = await db.lead.findFirst({ where: { id: String(form.get("id")), businessId: business.id } });
  if (!lead) return { error: "Lead not found." };
  try {
    const r = await sendLeadToCrm(lead);
    if (!r.sent) return { error: r.reason };
    const fresh = await db.lead.findUnique({ where: { id: lead.id } });
    const conn = fresh?.crm ? await db.crmConnection.findFirst({ where: { businessId: business.id, provider: fresh.crm } }) : null;
    if (fresh && conn) await trackLead(fresh, conn).catch(() => {});
  } catch (err) {
    return { error: errorText(err) };
  }
  refresh();
  return { ok: "Sent." };
}

export async function setCrmPush(form: FormData) {
  const { business } = await requireBusiness();
  await db.crmConnection.updateMany({ where: { id: String(form.get("id")), businessId: business.id }, data: { pushNewLeads: form.get("push") === "on" } });
  revalidatePath("/dashboard/leads/connect");
}

export async function disconnectCrm(form: FormData) {
  const { business } = await requireBusiness();
  const conn = await db.crmConnection.findFirst({ where: { id: String(form.get("id")), businessId: business.id } });
  if (!conn) return;
  await db.crmConnection.delete({ where: { id: conn.id } });
  await logActivity(business.id, "crm", `Disconnected ${CONNECTORS[conn.provider].name}. Imported contacts were kept.`);
  revalidatePath("/dashboard/leads/connect");
}
