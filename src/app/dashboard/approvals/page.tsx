import Link from "next/link";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { CHANNELS } from "@/lib/channels";
import { formatDate } from "@/lib/format";
import { approveAllPosts, retryItem } from "@/app/actions/approvals";
import { imagesEnabled } from "@/lib/images";
import { ImageButton, ItemForm } from "./ItemForm";

export const metadata = { title: "Approvals" };

const STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: "Scheduled", cls: "badge-good" },
  PUBLISHING: { label: "Sending", cls: "badge-warn" },
  PUBLISHED: { label: "Live", cls: "badge-good" },
  PAUSED: { label: "Paused", cls: "badge-warn" },
  FAILED: { label: "Failed", cls: "badge-bad" },
  NEEDS_TEAM: { label: "With Elevated team", cls: "badge-dark" },
  REJECTED: { label: "Rejected", cls: "badge-dark" },
};

export default async function ApprovalsPage() {
  const { business } = await requireBusiness();
  const [pending, recent] = await Promise.all([
    db.publishItem.findMany({ where: { businessId: business.id, status: "PENDING_APPROVAL" }, orderBy: [{ kind: "desc" }, { scheduledFor: "asc" }] }),
    db.publishItem.findMany({
      where: { businessId: business.id, status: { not: "PENDING_APPROVAL" } },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      take: 40,
    }),
  ]);
  const posts = pending.filter((p) => p.kind === "POST");
  const canImage = imagesEnabled();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p className="muted">Everything we&apos;ve prepared for you, with images. Nothing is posted or spent until you approve it.</p>
        </div>
        {posts.length > 1 && (
          <form action={approveAllPosts}><button className="btn btn-primary">Approve all {posts.length} posts</button></form>
        )}
      </div>

      {pending.length === 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p style={{ margin: 0 }}>You&apos;re all caught up. New posts arrive with each weekly content batch, and ads arrive after you approve a budget split on <Link href="/dashboard/ad-spend">Ad spend</Link>.</p>
        </div>
      )}

      {pending.map((item) => {
        const p = item.payload as Record<string, any>;
        const ad = item.kind === "AD";
        const where = item.provider === "META" && !ad ? (p.placement === "instagram" ? "Instagram" : "Facebook") : CHANNELS[item.provider].name;
        return (
          <div className="queue-item" key={item.id}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{item.title}</h3>
              <span className="badge badge-warn">{ad ? "Ad" : `${where} post`} · {ad ? `${(item.dailyBudgetCents / 100).toFixed(2)}/day` : formatDate(item.scheduledFor)}</span>
            </div>
            {ad && p.reason && <p className="small muted" style={{ marginTop: 8 }}>Why this channel: {p.reason}</p>}
            {ad && (
              <div className="preview" style={{ margin: "10px 0" }}>
                <strong>Headlines:</strong> {p.headlines?.join(" · ")}
                {"\n"}<strong>Descriptions:</strong> {p.descriptions?.join(" · ")}
                {p.keywords?.length > 0 && <>{"\n"}<strong>Keywords:</strong> {p.keywords.map((k: string) => <span className="kw" key={k}>{k}</span>)}</>}
                {"\n"}<strong>Sends people to:</strong> {p.link || "add your website on the Business profile page"}
              </div>
            )}
            {!ad && p.hashtags?.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>{p.hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>}
            {(ad ? !CHANNELS[item.provider].autoAds : !CHANNELS[item.provider].autoPosts) && (
              <p className="small muted">{CHANNELS[item.provider].manualNote}. Once you approve, the team takes it from here.</p>
            )}
            {(p.imageUrl || canImage) && (item.provider === "META" || item.provider === "GOOGLE_BUSINESS") && (
              <div className="row" style={{ alignItems: "flex-end", margin: "10px 0" }}>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={`Image for ${item.title}`} width={180} height={180} style={{ borderRadius: 10, objectFit: "cover", border: "1px solid var(--line)" }} />
                ) : (
                  <span className="small muted">{p.imageFailed ? "We couldn't create an image automatically." : "An image is being created for this post."}</span>
                )}
                {canImage && <ImageButton id={item.id} has={Boolean(p.imageUrl)} />}
              </div>
            )}
            <ItemForm
              id={item.id}
              text={ad ? p.primaryText : p.text}
              textLabel={ad ? "Main ad text" : "Caption"}
              imageUrl={p.imageUrl}
              needsImage={p.placement === "instagram"}
              visualIdea={p.visualIdea ?? p.imageIdea}
            />
          </div>
        );
      })}

      {recent.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>History</h2>
          <table className="simple">
            <thead><tr><th>Item</th><th>Status</th><th>When</th><th></th></tr></thead>
            <tbody>
              {recent.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.title}
                    {item.error && item.status !== "PUBLISHED" && <div className="small muted">{item.error.replace(/^LOW_FUNDS: /, "")}</div>}
                  </td>
                  <td><span className={`badge ${STATUS[item.status]?.cls ?? ""}`}>{STATUS[item.status]?.label ?? item.status}</span></td>
                  <td className="small">{formatDate(item.publishedAt ?? item.scheduledFor)}</td>
                  <td>
                    {item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer" className="small">View</a>}
                    {item.status === "FAILED" && (
                      <form action={retryItem}><input type="hidden" name="id" value={item.id} /><button className="btn btn-ghost btn-sm">Retry</button></form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
