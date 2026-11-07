"use client";
import { useActionState } from "react";
import { createImage, decideItem } from "@/app/actions/approvals";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function ItemForm({
  id,
  text,
  textLabel,
  imageUrl,
  needsImage,
  visualIdea,
}: {
  id: string;
  text: string;
  textLabel: string;
  imageUrl?: string;
  needsImage: boolean;
  visualIdea?: string;
}) {
  const [state, action] = useActionState(decideItem, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor={`text-${id}`}>{textLabel} (edit if you like)</label>
        <textarea id={`text-${id}`} name="text" defaultValue={text} />
      </div>
      <div className="field">
        <label htmlFor={`img-${id}`}>Image link{needsImage ? " (required for Instagram)" : " (optional)"}</label>
        <input id={`img-${id}`} name="imageUrl" type="url" defaultValue={imageUrl} placeholder="https://… link to a photo you own" />
        {visualIdea && <span className="hint">Suggested visual: {visualIdea}</span>}
      </div>
      <div className="row">
        <SubmitButton pendingText="Approving…">Approve</SubmitButton>
        <button className="btn btn-ghost" name="decision" value="reject" type="submit">Reject</button>
      </div>
    </form>
  );
}

export function ImageButton({ id, has }: { id: string; has: boolean }) {
  const [state, action] = useActionState(createImage, undefined);
  return (
    <form action={action} className="row">
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-ghost btn-sm" pendingText="Creating image… (up to a minute)">
        {has ? "Try a different image" : "Create an image"}
      </SubmitButton>
      {state?.error && <span className="small" style={{ color: "var(--bad)" }}>{state.error}</span>}
    </form>
  );
}
