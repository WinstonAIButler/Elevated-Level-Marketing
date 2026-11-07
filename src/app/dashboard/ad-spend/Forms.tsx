"use client";
import { useActionState, useState } from "react";
import { decideAllocation, requestAllocation, setBudget } from "@/app/actions/adspend";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function BudgetForm({ budget, mode }: { budget: number; mode: "WALLET" | "OWN_ACCOUNTS" }) {
  const [state, action] = useActionState(setBudget, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="monthlyBudget">Monthly ad budget (USD)</label>
        <input id="monthlyBudget" name="monthlyBudget" type="number" min={0} step={1} defaultValue={budget} required />
        <span className="hint">What you want spent on ads each month across all channels. We propose the split; you approve it.</span>
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">How ads are paid for</legend>
        <label className="option">
          <input type="radio" name="adSpendMode" value="WALLET" defaultChecked={mode === "WALLET"} />
          <span><strong>Elevated ad wallet</strong>: add funds here and we run the ads from our ad accounts. Simplest setup.</span>
        </label>
        <label className="option">
          <input type="radio" name="adSpendMode" value="OWN_ACCOUNTS" defaultChecked={mode === "OWN_ACCOUNTS"} />
          <span><strong>My own ad accounts</strong>: connect your Google Ads and Meta ad accounts; the platforms bill your card directly.</span>
        </label>
      </fieldset>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}

export function RequestSplit({ label }: { label: string }) {
  const [state, action] = useActionState(requestAllocation, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="note">Anything we should know? (optional)</label>
        <input id="note" name="note" type="text" placeholder="e.g. focus on Google, we don't have video for TikTok" />
      </div>
      <SubmitButton pendingText="Working out the best split…">{label}</SubmitButton>
    </form>
  );
}

export function DecideSplit({ id }: { id: string }) {
  const [state, action] = useActionState(decideAllocation, undefined);
  const [rejecting, setRejecting] = useState(false);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      {rejecting ? (
        <>
          <div className="field">
            <label htmlFor="reject-note">What would you change?</label>
            <textarea id="reject-note" name="note" required placeholder="e.g. less on Meta, we get most customers from Google" />
          </div>
          <div className="row">
            <input type="hidden" name="decision" value="reject" />
            <SubmitButton pendingText="Revising…">Send feedback and get a new split</SubmitButton>
            <button type="button" className="btn btn-ghost" onClick={() => setRejecting(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="row">
          <input type="hidden" name="decision" value="approve" />
          <SubmitButton pendingText="Writing your ads… (about a minute)">Approve this split</SubmitButton>
          <button type="button" className="btn btn-ghost" onClick={() => setRejecting(true)}>Request changes</button>
        </div>
      )}
    </form>
  );
}
