import Link from "next/link";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CONNECTORS, CRM_PROVIDERS, isCrmProvider, oauthAvailable } from "@/lib/crm";
import { SITE_URL } from "@/lib/site";
import { disconnectCrm, setCrmPush } from "@/app/actions/leads";
import { CopyButton } from "@/components/CopyButton";
import { CrmTokenForm, ImportCsv, SyncButton } from "../Forms";

export const metadata = { title: "Import & connect" };
export const maxDuration = 300;

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const { business } = await requireBusiness();
  const { connected, error } = await searchParams;
  const conns = await db.crmConnection.findMany({ where: { businessId: business.id } });
  const byProvider = new Map(conns.map((c) => [c.provider, c]));
  const endpoint = `${SITE_URL}/api/leads/${business.leadFormKey}`;
  const snippet = `<script src="${SITE_URL}/lead-form.js" data-key="${business.leadFormKey}" data-capture="true" defer></script>`;

  return (
    <>
      <Link href="/dashboard/leads" className="small muted">← Leads</Link>
      <div className="page-head" style={{ marginTop: 6 }}>
        <div>
          <h1>Import &amp; connect</h1>
          <p className="muted">Bring in the customers and leads you already have, and send new ones here automatically.</p>
        </div>
      </div>
      {connected && isCrmProvider(connected) && <div className="alert alert-ok" style={{ marginBottom: 20 }}>{CONNECTORS[connected].name} connected and imported.</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error === "not-available" ? "One-click sign-in for that CRM isn't available yet." : error}</div>}

      <h2>Connect your CRM</h2>
      <p className="muted small">We import your contacts and closed deals or paid jobs (so we can see revenue), re-sync every day, and add new leads from Elevated into your CRM.</p>
      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        {CRM_PROVIDERS.map((p) => {
          const info = CONNECTORS[p];
          const conn = byProvider.get(p);
          const oauth = oauthAvailable(p);
          const token = info.methods.includes("token");
          return (
            <div className="card" key={p}>
              <div className="row between">
                <h3 style={{ margin: 0 }}>{info.name}</h3>
                {conn ? <span className={`badge ${conn.status === "active" ? "badge-good" : "badge-bad"}`}>{conn.status === "active" ? "Connected" : "Needs attention"}</span> : <span className="badge badge-dark">Not connected</span>}
              </div>
              {conn ? (
                <>
                  <p className="small" style={{ marginTop: 8 }}>
                    <strong>{conn.accountName}</strong><br />
                    <span className="muted">{conn.lastSyncAt ? `Last synced ${formatDate(conn.lastSyncAt)} · ${conn.lastSyncCount ?? 0} records` : "Not synced yet"}</span>
                    {conn.lastError && <><br /><span style={{ color: "var(--bad)" }}>{conn.lastError}</span></>}
                  </p>
                  {info.push ? (
                    <form action={setCrmPush} className="row" style={{ marginBottom: 8 }}>
                      <input type="hidden" name="id" value={conn.id} />
                      <label className="check"><input type="checkbox" name="push" defaultChecked={conn.pushNewLeads} /><span>Add new Elevated leads to {info.name}</span></label>
                      <button className="btn btn-ghost btn-sm">Save</button>
                    </form>
                  ) : (
                    <p className="small muted">Import only: new leads stay in Elevated.</p>
                  )}
                  <div className="row">
                    <SyncButton id={conn.id} />
                    <form action={disconnectCrm}><input type="hidden" name="id" value={conn.id} /><button className="btn btn-ghost btn-sm">Disconnect</button></form>
                  </div>
                </>
              ) : (
                <>
                  {oauth && <a className="btn btn-primary" style={{ marginTop: 10 }} href={`/api/crm/connect/${p.toLowerCase()}`}>Sign in with {info.name}</a>}
                  {token && (
                    <details style={{ marginTop: 10 }} open={!oauth}>
                      <summary className="small" style={{ cursor: "pointer", fontWeight: 600 }}>{oauth ? "Or paste a key" : `Connect with your ${info.tokenLabel}`}</summary>
                      <ol className="steps">{info.tokenSteps?.map((s) => <li key={s}>{s}</li>)}</ol>
                      <CrmTokenForm provider={p} label={info.tokenLabel ?? "Key"} />
                    </details>
                  )}
                  {!oauth && !token && <p className="small muted" style={{ marginTop: 10 }}>Coming soon. In the meantime, export a CSV from {info.name} and import it below.</p>}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Import a spreadsheet</h2>
        <p className="muted small">Use any CSV: an export from another CRM, your booking system, QuickBooks customers, or a list you keep yourself.</p>
        <ImportCsv />
      </div>

      <div className="card">
        <h2>Capture leads from your website</h2>
        <p className="muted small">Add this line to every page of your website (or ask whoever manages it). It remembers which Elevated post or ad a visitor came from, copies submissions from your existing contact forms here, and lets you place our form anywhere with <code>&lt;div id=&quot;elevated-lead-form&quot;&gt;&lt;/div&gt;</code>.</p>
        <div className="copy-block"><CopyButton text={snippet} />{snippet}</div>
        <h3 style={{ marginTop: 20 }}>Using Zapier, Typeform, Jotform or another tool?</h3>
        <p className="muted small">Send new submissions to this address (POST, JSON or form fields: name, email, phone, message, source):</p>
        <div className="copy-block"><CopyButton text={endpoint} />{endpoint}</div>
      </div>
    </>
  );
}
