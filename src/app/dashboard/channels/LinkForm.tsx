"use client";
import { useActionState } from "react";
import { linkChannel } from "@/app/actions/channels";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import type { LinkField } from "@/lib/channels";

export function LinkForm({
  provider,
  account,
  extra,
  steps,
  current,
}: {
  provider: string;
  account: LinkField;
  extra?: LinkField;
  steps: string[];
  current?: { account?: string | null; extra?: string | null; accessGranted?: boolean };
}) {
  const [state, action] = useActionState(linkChannel, undefined);
  const id = provider.toLowerCase();
  return (
    <form action={action} className="stack link-form">
      <input type="hidden" name="provider" value={provider} />
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor={`${id}-account`}>{account.label}</label>
        <input id={`${id}-account`} name="account" type="text" placeholder={account.placeholder} defaultValue={current?.account ?? ""} autoComplete="off" spellCheck={false} required />
        {account.hint && <span className="hint">{account.hint}</span>}
      </div>
      {extra && (
        <div className="field">
          <label htmlFor={`${id}-extra`}>{extra.label}</label>
          <input id={`${id}-extra`} name="extra" type="text" placeholder={extra.placeholder} defaultValue={current?.extra ?? ""} autoComplete="off" spellCheck={false} />
        </div>
      )}
      <div className="field">
        <span className="label">Give Elevated access</span>
        <ol className="steps">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      </div>
      <label className="check">
        <input type="checkbox" name="accessGranted" defaultChecked={current?.accessGranted} />
        <span>I&apos;ve given Elevated access (you can link now and do this later)</span>
      </label>
      <SubmitButton pendingText="Saving…">{current?.account ? "Save changes" : "Link account"}</SubmitButton>
    </form>
  );
}
