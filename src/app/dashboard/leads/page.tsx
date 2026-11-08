import Link from "next/link";
import type { LeadStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CHANNEL_LABELS, type Channel } from "@/lib/leads-core";
import { CONNECTORS } from "@/lib/crm";
import { deleteLead, updateLead } from "@/app/actions/leads";
import { AddLeadForm, SendToCrmButton } from "./Forms";

export const metadata = { title: "Leads" };

const STATUS_LABEL: Record<LeadStatus, string> = { NEW: "New", CONTACTED: "Contacted", WON: "Customer", LOST: "Lost" };
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; source?: string; q?: string }> }) {
  const { business } = await requireBusiness();
  const { status, source, q } = await searchParams;
  const where: Prisma.LeadWhereInput = {
    businessId: business.id,
    ...(status && status in STATUS_LABEL ? { status: status as LeadStatus } : {}),
    ...(source === "elevated" ? { elevated: true } : source ? { source } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
  };
  const [leads, total, counts, crm] = await Promise.all([
    db.lead.findMany({ where, orderBy: { occurredAt: "desc" }, take: 200 }),
    db.lead.count({ where }),
    db.lead.groupBy({ by: ["status"], where: { businessId: business.id }, _count: true }),
    db.crmConnection.findFirst({ where: { businessId: business.id, status: "active" }, orderBy: { createdAt: "asc" } }),
  ]);
  const count = (s: LeadStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const all = counts.reduce((a, c) => a + c._count, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="muted">Everyone who reached out and every customer, with where they came from. This is how we show what your marketing is earning.</p>
        </div>
        <div className="row">
          <Link href="/dashboard/results" className="btn btn-ghost">See results</Link>
          <Link href="/dashboard/leads/connect" className="btn btn-primary">Connect</Link>
        </div>
      </div>

      {all === 0 && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <strong>Start here:</strong> import your existing customers and leads (spreadsheet or CRM) so we have a “before” to compare against,
          add the Elevated form to your website so new leads arrive here automatically, and connect your CRM so we can follow them to a sale. <Link href="/dashboard/leads/connect">Connect →</Link>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {(["NEW", "CONTACTED", "WON", "LOST"] as LeadStatus[]).map((s) => (
          <Link key={s} href={status === s ? "/dashboard/leads" : `/dashboard/leads?status=${s}`} className="card" style={{ textDecoration: "none", outline: status === s ? "2px solid var(--green)" : undefined }}>
            <div className="muted small">{STATUS_LABEL[s]}</div><div className="stat">{count(s)}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-2x" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)", gap: 20, alignItems: "start" }}>
        <div className="card">
          <form className="row" style={{ marginBottom: 12 }}>
            <input name="q" defaultValue={q} placeholder="Search name, email or phone" aria-label="Search leads" style={{ flex: "1 1 200px" }} />
            <select name="source" defaultValue={source ?? ""} aria-label="Filter by source">
              <option value="">All sources</option>
              <option value="elevated">Via Elevated</option>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {status && <input type="hidden" name="status" value={status} />}
            <button className="btn btn-ghost btn-sm">Filter</button>
          </form>
          {leads.length ? (
            <table className="simple">
              <thead><tr><th>Lead</th><th>Source</th><th>Status &amp; value</th><th></th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.name}</strong>
                      <div className="small muted">{[l.email, l.phone].filter(Boolean).join(" · ")}</div>
                      <div className="small muted">{formatDate(l.occurredAt)}{l.crm ? ` · ${CONNECTORS[l.crm].name}` : l.origin === "import" ? " · imported" : l.origin === "form" ? " · website form" : ""}</div>
                    </td>
                    <td className="small">
                      {CHANNEL_LABELS[l.source as Channel] ?? l.source}
                      {l.elevated && <div><span className="badge badge-good">via Elevated</span></div>}
                      {l.crm ? <div className="muted">In {CONNECTORS[l.crm].name}{l.crmStage ? ` · ${l.crmStage}` : ""}</div> : crm ? <SendToCrmButton id={l.id} crmName={CONNECTORS[crm.provider].name} /> : null}
                    </td>
                    <td>
                      <form action={updateLead} className="row" style={{ gap: 6 }}>
                        <input type="hidden" name="id" value={l.id} />
                        <select name="status" defaultValue={l.status} aria-label={`Status for ${l.name}`}>
                          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <input name="value" defaultValue={l.valueCents ? (l.valueCents / 100).toString() : ""} placeholder="$ value" inputMode="decimal" aria-label={`Value for ${l.name}`} style={{ width: 90 }} />
                        <button className="btn btn-ghost btn-sm">Save</button>
                      </form>
                    </td>
                    <td>
                      <form action={deleteLead}><input type="hidden" name="id" value={l.id} /><button className="btn btn-ghost btn-sm" aria-label={`Delete ${l.name}`}>✕</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No leads {status || source || q ? "match these filters" : "yet"}.</p>
          )}
          {total > leads.length && <p className="small muted">Showing the newest {leads.length} of {total}.</p>}
          {crm && <p className="small muted">Leads sent to {CONNECTORS[crm.provider].name} update from it every day.</p>}
        </div>
        <div className="card">
          <h2>Add a lead</h2>
          <p className="small muted">Got a call or walk-in? Add it here so it counts.</p>
          <AddLeadForm />
        </div>
      </div>
    </>
  );
}
