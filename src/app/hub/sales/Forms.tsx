"use client";
import { useActionState } from "react";
import { assessProspect, refreshBrief, saveLeadNotes } from "@/app/actions/hub";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function AssessForm() {
  const [state, action] = useActionState(assessProspect, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="grid grid-2">
        <div className="field"><label htmlFor="website">Their website</label><input id="website" name="website" type="text" placeholder="theirbusiness.com" required /></div>
        <div className="field"><label htmlFor="businessName">Business name</label><input id="businessName" name="businessName" type="text" required /></div>
        <div className="field"><label htmlFor="city">City or service area</label><input id="city" name="city" type="text" required /></div>
        <div className="field"><label htmlFor="industry">What they do</label><input id="industry" name="industry" type="text" required /></div>
      </div>
      <div className="field"><label htmlFor="email">Their email (optional)</label><input id="email" name="email" type="email" /></div>
      <SubmitButton pendingText="Checking their site, running AI searches and writing the brief… (1–2 minutes)">Assess prospect</SubmitButton>
    </form>
  );
}

export function RefreshBrief({ id, has }: { id: string; has: boolean }) {
  const [state, action] = useActionState(refreshBrief, undefined);
  return (
    <form action={action} className="row">
      <input type="hidden" name="id" value={id} />
      <SubmitButton className={has ? "btn btn-ghost btn-sm" : "btn btn-primary"} pendingText="Writing the brief… (about a minute)">
        {has ? "Rewrite brief" : "Write sales brief"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function NotesForm({ id, notes }: { id: string; notes: string }) {
  const [state, action] = useActionState(saveLeadNotes, undefined);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <textarea name="notes" defaultValue={notes} placeholder="Call notes, budget, decision maker, follow-up date…" aria-label="Notes" />
      <div className="row"><SubmitButton className="btn btn-ghost btn-sm" pendingText="Saving…">Save notes</SubmitButton><FormMessage state={state} /></div>
    </form>
  );
}
