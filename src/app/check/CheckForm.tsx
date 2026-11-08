"use client";
import { useActionState } from "react";
import { runCheck } from "@/app/actions/check";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function CheckForm() {
  const [state, action] = useActionState(runCheck, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" inputMode="url" placeholder="yourbusiness.com" autoComplete="url" spellCheck={false} required />
        </div>
        <div className="field">
          <label htmlFor="businessName">Business name</label>
          <input id="businessName" name="businessName" type="text" autoComplete="organization" required />
        </div>
        <div className="field">
          <label htmlFor="city">City or service area</label>
          <input id="city" name="city" type="text" placeholder="e.g. Tampa, FL" required />
        </div>
        <div className="field">
          <label htmlFor="industry">What you do</label>
          <input id="industry" name="industry" type="text" placeholder="e.g. coffee shop, HVAC repair, dental clinic" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">Email (optional)</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="So we can send you the report" />
      </div>
      <SubmitButton className="btn btn-primary btn-lg" pendingText="Checking your website and asking AI search… (about a minute)">
        Run my free check
      </SubmitButton>
      <p className="small muted">We look at your public website and run a few real searches. Nothing is posted or changed.</p>
    </form>
  );
}
