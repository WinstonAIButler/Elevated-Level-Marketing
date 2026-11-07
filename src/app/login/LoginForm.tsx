"use client";
import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordInput } from "@/components/PasswordInput";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <PasswordInput autoComplete="current-password" />
      </div>
      <SubmitButton className="btn btn-dark" pendingText="Logging in…">Log in</SubmitButton>
      <p className="small muted">New here? <Link href="/signup">Create an account</Link></p>
    </form>
  );
}
