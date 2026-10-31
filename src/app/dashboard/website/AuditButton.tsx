"use client";
import { useActionState } from "react";
import { auditMyWebsite } from "@/app/actions/website";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function AuditButton({ label }: { label: string }) {
  const [state, action] = useActionState(auditMyWebsite, undefined);
  return (
    <form action={action} className="stack" aria-live="polite">
      <SubmitButton pendingText="Checking your website…">{label}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
