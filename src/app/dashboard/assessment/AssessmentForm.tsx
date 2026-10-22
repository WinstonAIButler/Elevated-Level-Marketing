"use client";
import { useActionState } from "react";
import { submitAssessment } from "@/app/actions/assessment";
import type { Question } from "@/lib/assessment";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function AssessmentForm({ groups }: { groups: { id: string; label: string; questions: Question[] }[] }) {
  const [state, action] = useActionState(submitAssessment, undefined);
  return (
    <form action={action} className="stack">
      {groups.map((g) => (
        <fieldset className="card" key={g.id} style={{ border: "1px solid var(--line)" }}>
          <legend className="badge badge-dark" style={{ padding: "4px 12px" }}>{g.label}</legend>
          {g.questions.map((q) => (
            <div className="question" key={q.id}>
              <div className="label">{q.text}</div>
              <div className="options" role="radiogroup">
                {q.options.map((o, i) => (
                  <label className="option" key={o.label}>
                    <input type="radio" name={q.id} value={i} required />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ))}
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-lg" pendingText="Analyzing your marketing...">Get my score</SubmitButton>
    </form>
  );
}
