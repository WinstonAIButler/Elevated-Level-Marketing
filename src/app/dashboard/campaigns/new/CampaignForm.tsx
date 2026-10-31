"use client";
import { useActionState } from "react";
import { generateCampaign } from "@/app/actions/campaigns";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

const CHANNELS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "Google Ads", "Meta Ads", "Email", "SMS", "Google Business Profile"];

export function CampaignForm({ defaultAudience }: { defaultAudience: string }) {
  const [state, action] = useActionState(generateCampaign, undefined);
  return (
    <form action={action} className="stack">
      <FormMessage state={state} />
      <div className="field">
        <label htmlFor="objective">Campaign objective</label>
        <input id="objective" name="objective" type="text" required placeholder="e.g. Book 30 spring AC tune-ups, launch our new menu, grow email list" />
      </div>
      <div className="field">
        <span className="label">Channels</span>
        <div className="chips">
          {CHANNELS.map((c, i) => (
            <label className="chip" key={c}>
              <input type="checkbox" name="channels" value={c} defaultChecked={i < 2} />
              <span>{c}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="offer">Offer</label>
          <input id="offer" name="offer" type="text" placeholder="e.g. $49 tune-up, 15% off first order" />
        </div>
        <div className="field">
          <label htmlFor="audience">Audience focus</label>
          <input id="audience" name="audience" type="text" defaultValue={defaultAudience} />
        </div>
        <div className="field">
          <label htmlFor="budget">Ad budget for this campaign (USD)</label>
          <input id="budget" name="budget" type="number" min={0} defaultValue={0} />
          <span className="hint">Paid directly to the ad platforms. Not part of your Elevated plan.</span>
        </div>
        <div className="field">
          <label htmlFor="durationDays">Duration</label>
          <select id="durationDays" name="durationDays" defaultValue="14">
            <option value="7">1 week</option>
            <option value="14">2 weeks</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="notes">Anything else?</label>
        <textarea id="notes" name="notes" placeholder="Seasonality, must-mention details, things to avoid…" />
      </div>
      <SubmitButton className="btn btn-primary btn-lg" pendingText="Writing your campaign… (about a minute)">Generate campaign</SubmitButton>
    </form>
  );
}
