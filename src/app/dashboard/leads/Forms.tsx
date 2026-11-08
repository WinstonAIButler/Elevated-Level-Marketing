"use client";
import { useActionState, useMemo, useState } from "react";
import { addLead, connectCrmToken, importCsv, syncCrmNow } from "@/app/actions/leads";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { CHANNEL_LABELS, CHANNELS, guessMapping, IMPORT_FIELDS, parseCsv, rowsToLeads, type ImportField, type Mapping } from "@/lib/leads-core";

export function AddLeadForm() {
  const [state, action] = useActionState(addLead, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field"><label htmlFor="lead-name">Name</label><input id="lead-name" name="name" required /></div>
        <div className="field"><label htmlFor="lead-email">Email</label><input id="lead-email" name="email" type="email" /></div>
        <div className="field"><label htmlFor="lead-phone">Phone</label><input id="lead-phone" name="phone" type="tel" /></div>
        <div className="field">
          <label htmlFor="lead-source">Where they found you</label>
          <select id="lead-source" name="source" defaultValue="other">
            {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lead-status">Status</label>
          <select id="lead-status" name="status" defaultValue="NEW">
            <option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="WON">Became a customer</option><option value="LOST">Lost</option>
          </select>
        </div>
        <div className="field"><label htmlFor="lead-value">Sale value (USD)</label><input id="lead-value" name="value" inputMode="decimal" placeholder="0" /></div>
      </div>
      <label className="check"><input type="checkbox" name="elevated" /><span>They came from something Elevated posted or advertised</span></label>
      <div className="field"><label htmlFor="lead-notes">Notes</label><textarea id="lead-notes" name="notes" rows={2} /></div>
      <SubmitButton pendingText="Saving…">Add lead</SubmitButton>
    </form>
  );
}

const FIELD_LABEL: Record<ImportField, string> = {
  name: "Full name", firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", company: "Company",
  source: "Lead source", status: "Status / stage", value: "Sale value", date: "Date added",
};

export function ImportCsv() {
  const [state, action] = useActionState(importCsv, undefined);
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [fileError, setFileError] = useState("");
  const preview = useMemo(() => (headers ? rowsToLeads(rows.slice(0, 5), mapping) : []), [headers, rows, mapping]);
  // Send only the columns being imported, so big exports stay under the upload limit.
  const compact = useMemo(() => {
    const cols = [...new Set(Object.values(mapping).filter((v): v is number => v !== undefined))];
    const map: Mapping = {};
    for (const [f, i] of Object.entries(mapping)) if (i !== undefined) map[f as ImportField] = cols.indexOf(i);
    return { rows: JSON.stringify(rows.map((r) => cols.map((c) => r[c] ?? ""))), mapping: JSON.stringify(map) };
  }, [rows, mapping]);

  function onFile(file: File | undefined) {
    setFileError("");
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return setFileError("That file is over 15 MB. Split it and import it in parts.");
    const reader = new FileReader();
    reader.onload = () => {
      const all = parseCsv(String(reader.result ?? ""));
      if (all.length < 2) return setFileError("That file doesn't have any rows. Export it from your CRM or spreadsheet as CSV and try again.");
      setHeaders(all[0]);
      setRows(all.slice(1));
      setMapping(guessMapping(all[0]));
    };
    reader.readAsText(file);
  }

  if (state?.ok) return <FormMessage state={state} />;
  return (
    <div className="stack">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="csv">Spreadsheet (.csv)</label>
        <input id="csv" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
        <span className="hint">In Excel, Google Sheets or your CRM choose Export or Download as CSV. Customers and past leads both help: they become your “before Elevated” baseline.</span>
        {fileError && <span className="small" style={{ color: "var(--bad)" }}>{fileError}</span>}
      </div>
      {headers && (
        <form action={action} className="stack">
          <input type="hidden" name="rows" value={compact.rows} />
          <input type="hidden" name="mapping" value={compact.mapping} />
          <p className="small"><strong>{rows.length.toLocaleString()} rows.</strong> Check which column is which:</p>
          <div className="grid grid-3" style={{ gap: 10 }}>
            {IMPORT_FIELDS.map((f) => (
              <div className="field" key={f}>
                <label htmlFor={`map-${f}`}>{FIELD_LABEL[f]}</label>
                <select
                  id={`map-${f}`}
                  value={mapping[f] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                >
                  <option value="">Not in this file</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </div>
            ))}
          </div>
          {preview.length > 0 && (
            <table className="simple">
              <thead><tr><th>Name</th><th>Email</th><th>Source</th><th>Status</th><th>Value</th></tr></thead>
              <tbody>
                {preview.map((l, i) => (
                  <tr key={i}><td>{l.name}</td><td className="small">{l.email}</td><td className="small">{CHANNEL_LABELS[l.source]}</td><td className="small">{l.status.toLowerCase()}</td><td className="small">{l.valueCents ? `$${(l.valueCents / 100).toLocaleString()}` : ""}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <SubmitButton pendingText="Importing…">Import {rows.length.toLocaleString()} rows</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function CrmTokenForm({ provider, label }: { provider: string; label: string }) {
  const [state, action] = useActionState(connectCrmToken, undefined);
  return (
    <form action={action} className="stack" style={{ marginTop: 8 }}>
      <input type="hidden" name="provider" value={provider} />
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor={`tok-${provider}`}>{label}</label>
        <input id={`tok-${provider}`} name="token" type="password" autoComplete="off" spellCheck={false} required />
      </div>
      <SubmitButton pendingText="Connecting and importing… (up to a minute)">Connect</SubmitButton>
    </form>
  );
}

export function SyncButton({ id }: { id: string }) {
  const [state, action] = useActionState(syncCrmNow, undefined);
  return (
    <form action={action} className="row">
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-ghost btn-sm" pendingText="Syncing…">Sync now</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
