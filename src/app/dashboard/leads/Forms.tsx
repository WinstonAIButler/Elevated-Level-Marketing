"use client";
import { useActionState } from "react";
import { addLead, checkCrmNow, connectCrmToken, sendToCrm } from "@/app/actions/leads";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { CHANNEL_LABELS, CHANNELS } from "@/lib/leads-core";

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
      <SubmitButton pendingText="Connecting…">Connect</SubmitButton>
    </form>
  );
}

export function CheckButton() {
  const [state, action] = useActionState(checkCrmNow, undefined);
  return (
    <form action={action} className="row">
      <SubmitButton className="btn btn-ghost btn-sm" pendingText="Checking…">Check now</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function SendToCrmButton({ id, crmName }: { id: string; crmName: string }) {
  const [state, action] = useActionState(sendToCrm, undefined);
  if (state?.ok) return <span className="small muted">Sent to {crmName}</span>;
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-ghost btn-sm" pendingText="Sending…">Send to {crmName}</SubmitButton>
      {state?.error && <div className="small" style={{ color: "var(--bad)", maxWidth: 260 }}>{state.error}</div>}
    </form>
  );
}
