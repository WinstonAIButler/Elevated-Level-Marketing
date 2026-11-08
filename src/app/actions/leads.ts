"use server";
import { revalidatePath } from "next/cache";
import type { LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { importLeadDrafts, recordLead } from "@/lib/leads";
import { CHANNELS, IMPORT_FIELDS, normalizeSource, parseMoneyToCents, rowsToLeads, type Mapping } from "@/lib/leads-core";
import { CONNECTORS, isCrmProvider, saveCrmConnection, syncCrm } from "@/lib/crm";
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

/** Spreadsheet import: the browser parses the file and sends rows plus the confirmed column mapping. */
export async function importCsv(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  let rows: string[][];
  let mapping: Mapping;
  try {
    rows = JSON.parse(String(form.get("rows") ?? "[]"));
    mapping = JSON.parse(String(form.get("mapping") ?? "{}"));
  } catch {
    return { error: "Couldn't read that file. Please try again." };
  }
  if (!Array.isArray(rows) || !rows.length) return { error: "No rows to import." };
  if (rows.length > 10_000) return { error: "That's more than 10,000 rows. Split the file and import it in parts." };
  const clean: Mapping = {};
  for (const f of IMPORT_FIELDS) if (Number.isInteger(mapping[f])) clean[f] = mapping[f];
  if (clean.name === undefined && clean.firstName === undefined && clean.email === undefined && clean.phone === undefined) {
    return { error: "Match at least one column to Name, Email or Phone." };
  }
  const drafts = rowsToLeads(rows.map((r) => (Array.isArray(r) ? r.map(String) : [])), clean);
  const { imported, skipped } = await importLeadDrafts(business.id, drafts);
  await logActivity(business.id, "leads", `Imported ${imported} contact${imported === 1 ? "" : "s"} from a spreadsheet`);
  refresh();
  return { ok: `Imported ${imported} contact${imported === 1 ? "" : "s"}${skipped ? `; skipped ${skipped} already on file or blank` : ""}.` };
}

export async function connectCrmToken(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const provider = String(form.get("provider"));
  const token = String(form.get("token") ?? "").trim();
  if (!isCrmProvider(provider) || !CONNECTORS[provider].methods.includes("token")) return { error: "Unknown CRM." };
  if (!encryptionEnabled()) return { error: "CRM connections aren't available yet. Please try again later." };
  if (token.length < 10) return { error: `Paste your ${CONNECTORS[provider].tokenLabel ?? "key"}.` };
  try {
    const conn = await saveCrmConnection(business.id, provider, { method: "token", accessToken: token });
    const r = await syncCrm(conn);
    refresh();
    revalidatePath("/dashboard/leads/connect");
    return { ok: `${CONNECTORS[provider].name} connected. Imported ${r.total} contact${r.total === 1 ? "" : "s"}.` };
  } catch (err) {
    return { error: `Couldn't connect: ${errorText(err)}. Check the key and its permissions.` };
  }
}

export async function syncCrmNow(_: ActionState, form: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const conn = await db.crmConnection.findFirst({ where: { id: String(form.get("id")), businessId: business.id } });
  if (!conn) return { error: "Connection not found." };
  try {
    const r = await syncCrm(conn);
    refresh();
    revalidatePath("/dashboard/leads/connect");
    return { ok: `Synced ${r.total} records (${r.created} new).` };
  } catch (err) {
    revalidatePath("/dashboard/leads/connect");
    return { error: errorText(err) };
  }
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
