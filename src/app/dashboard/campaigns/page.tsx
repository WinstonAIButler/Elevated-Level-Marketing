import Link from "next/link";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const { business } = await requireBusiness();
  const campaigns = await db.campaign.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Campaigns</h1>
          <p className="muted">AI-generated campaigns with ad copy, social posts, emails and landing page copy.</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="btn btn-primary">New campaign</Link>
      </div>
      {campaigns.length === 0 ? (
        <div className="card">
          <p className="muted">No campaigns yet. Describe a goal and we&apos;ll write the whole campaign for you.</p>
          <Link href="/dashboard/campaigns/new" className="btn btn-primary">Create your first campaign</Link>
        </div>
      ) : (
        <div className="card">
          <table className="simple">
            <thead>
              <tr><th>Campaign</th><th>Channels</th><th>Runs</th><th>Status</th></tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/dashboard/campaigns/${c.id}`}><strong>{c.name}</strong></Link>
                    {c.autopilot && <span className="badge badge-good" style={{ marginLeft: 8 }}>Autopilot</span>}
                  </td>
                  <td className="small">{c.channels.join(", ")}</td>
                  <td className="small">{formatDate(c.startDate)} – {formatDate(c.endDate)}</td>
                  <td><span className="badge">{c.status.toLowerCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
