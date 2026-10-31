"use client";
import { useActionState } from "react";
import type { Business } from "@prisma/client";
import { saveBusiness } from "@/app/actions/business";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

type FieldDef = { name: keyof Business; label: string; hint?: string; long?: boolean; required?: boolean; type?: string; autoComplete?: string; inputMode?: "url" | "numeric" };

const FIELDS: FieldDef[] = [
  { name: "name", label: "Business name", required: true, autoComplete: "organization" },
  { name: "industry", label: "Industry", hint: "e.g. HVAC, dental clinic, boutique fitness, e-commerce apparel", required: true },
  { name: "website", label: "Website", hint: "Optional, e.g. yourbusiness.com. We use it for your weekly website & AI visibility audit.", autoComplete: "url", inputMode: "url" },
  { name: "location", label: "Location / service area", hint: "e.g. Tampa Bay, FL or Nationwide" },
  { name: "description", label: "What do you sell?", hint: "Your main products or services and what makes you different.", long: true, required: true },
  { name: "targetAudience", label: "Who are your ideal customers?", hint: "Age, location, needs, the problem they want solved.", long: true, required: true },
  { name: "goals", label: "Marketing goals", hint: "e.g. 40 more booked jobs per month, launch a new service, grow online sales 25%.", long: true, required: true },
  { name: "brandVoice", label: "Brand voice", hint: "e.g. friendly and local, premium and polished, bold and funny" },
  { name: "competitors", label: "Main competitors", hint: "Optional, comma separated" },
  { name: "monthlyBudget", label: "Monthly ad & tools budget (USD)", hint: "What you can spend on ads and tools, not counting your Elevated plan.", type: "number", inputMode: "numeric" },
];

export function BusinessForm({ business }: { business: Business | null }) {
  const [state, action] = useActionState(saveBusiness, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="grid grid-2">
        {FIELDS.map((f) => {
          const value = business?.[f.name];
          const defaultValue = value === null || value === undefined ? "" : String(value);
          return (
            <div className="field" key={f.name} style={f.long ? { gridColumn: "1 / -1" } : undefined}>
              <label htmlFor={f.name}>{f.label}</label>
              {f.long ? (
                <textarea id={f.name} name={f.name} defaultValue={defaultValue} required={f.required} />
              ) : (
                <input id={f.name} name={f.name} type={f.type ?? "text"} min={f.type === "number" ? 0 : undefined} autoComplete={f.autoComplete ?? "off"} inputMode={f.inputMode} spellCheck={f.inputMode === "url" ? false : undefined} defaultValue={defaultValue} required={f.required} />
              )}
              {f.hint && <span className="hint">{f.hint}</span>}
            </div>
          );
        })}
      </div>
      <SubmitButton pendingText="Saving…">{business ? "Save changes" : "Save and continue to assessment"}</SubmitButton>
    </form>
  );
}
