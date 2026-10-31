"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function SignupForm() {
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <span className="hint">At least 8 characters.</span>
      </div>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      <p className="small muted">
        By creating an account you agree to our <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <p className="small muted">Already have an account? <Link href="/login">Log in</Link></p>
    </form>
  );
}
