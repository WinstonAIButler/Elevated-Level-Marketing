"use client";
import { useActionState } from "react";
import { generatePlan } from "@/app/actions/plan";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function GeneratePlanForm({ label, subtle }: { label: string; subtle?: boolean }) {
  const [state, action] = useActionState(generatePlan, undefined);
  return (
    <form
      action={action}
      className="stack"
      onSubmit={(e) => {
        if (subtle && !confirm("Replace the current plan with a new one? Task progress on the current plan is archived.")) {
          e.preventDefault();
        }
      }}
    >
      <FormMessage state={state} />
      <SubmitButton className={subtle ? "btn btn-ghost" : "btn btn-primary btn-lg"} pendingText="Building your plan... (about a minute)">
        {label}
      </SubmitButton>
    </form>
  );
}
