"use client";
import { useActionState } from "react";
import { changePassword, updateName } from "@/app/actions/settings";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateName, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" type="text" defaultValue={name} autoComplete="name" required />
      </div>
      <SubmitButton className="btn btn-ghost" pendingText="Saving…">Save name</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <span className="hint">At least 8 characters.</span>
      </div>
      <SubmitButton className="btn btn-ghost" pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}
