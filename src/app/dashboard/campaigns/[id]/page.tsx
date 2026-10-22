import Link from "next/link";
import { notFound } from "next/navigation";
import type { CampaignStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { addDays, formatDate } from "@/lib/format";
import type { CampaignOutput } from "@/lib/ai";
import { deleteCampaign, setCampaignStatus } from "@/app/actions/campaigns";
import { CopyButton } from "@/components/CopyButton";

export const metadata = { title: "Campaign" };

const FLOW: CampaignStatus[] = ["DRAFT", "APPROVED", "SCHEDULED", "LIVE", "COMPLETED"];

function Copy({ text }: { text: string }) {
  return (
    <div className="copy-block">
      <CopyButton text={text} />
      {text}
    </div>
  );
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const c = await db.campaign.findFirst({ where: { id, businessId: business.id } });
  if (!c) notFound();
  const content = c.content as CampaignOutput;
  const nextStatus = FLOW[FLOW.indexOf(c.status) + 1];

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/dashboard/campaigns" className="small muted">← All campaigns</Link>
          <h1 style={{ marginTop: 6 }}>{c.name}</h1>
          <p className="muted">
            {c.channels.join(", ")} · {formatDate(c.startDate)} – {formatDate(c.endDate)}
            {c.budget ? ` · $${c.budget} ad budget` : ""}
          </p>
        </div>
        <div className="row">
          <span className="badge badge-dark">{c.status.toLowerCase()}</span>
          {nextStatus && (
            <form action={setCampaignStatus}>
              <input type="hidden" name="campaignId" value={c.id} />
              <input type="hidden" name="status" value={nextStatus} />
              <button className="btn btn-primary btn-sm">Mark {nextStatus.toLowerCase()}</button>
            </form>
          )}
          <form action={deleteCampaign}>
            <input type="hidden" name="campaignId" value={c.id} />
            <button className="btn btn-ghost btn-sm">Delete</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Big idea</h2>
        <p style={{ fontSize: "1.1rem" }}>{content.bigIdea}</p>
        <p className="muted small" style={{ margin: 0 }}><strong>Objective:</strong> {c.objective} · <strong>Audience:</strong> {content.audience}</p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Headline options</h2>
          <div className="stack">{content.headlines.map((h) => <Copy key={h} text={h} />)}</div>
        </div>
        <div className="card">
          <h2>Landing page</h2>
          <Copy
            text={`${content.landingPage.headline}\n${content.landingPage.subheadline}\n\n${content.landingPage.bullets
              .map((b) => `• ${b}`)
              .join("\n")}\n\n[${content.landingPage.cta}]`}
          />
          <h3 style={{ marginTop: 20 }}>KPIs</h3>
          <table className="simple">
            <tbody>
              {content.kpis.map((k) => (
                <tr key={k.metric}><td>{k.metric}</td><td style={{ textAlign: "right" }}><strong>{k.target}</strong></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {content.adCopy.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Ad copy</h2>
          <div className="grid grid-2">
            {content.adCopy.map((ad, i) => (
              <div key={i}>
                <span className="badge">{ad.channel}</span>
                <div style={{ marginTop: 8 }}><Copy text={`${ad.headline}\n\n${ad.body}\n\n[${ad.cta}]`} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.socialPosts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Social posts</h2>
          <div className="grid grid-2">
            {[...content.socialPosts]
              .sort((a, b) => a.dayOffset - b.dayOffset)
              .map((p, i) => (
                <div key={i}>
                  <div className="row small">
                    <span className="badge">{p.platform}</span>
                    {c.startDate && <span className="muted">{formatDate(addDays(c.startDate, p.dayOffset))}</span>}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Copy text={`${p.caption}\n\n${p.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`} />
                  </div>
                  <p className="muted small" style={{ marginTop: 6 }}><strong>Visual:</strong> {p.visualIdea}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {content.emails.length > 0 && (
        <div className="card">
          <h2>Emails</h2>
          <div className="stack">
            {content.emails.map((e, i) => (
              <div key={i}>
                <div><strong>Subject:</strong> {e.subject}</div>
                <div className="muted small" style={{ marginBottom: 8 }}>Preview: {e.previewText}</div>
                <Copy text={e.body} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
