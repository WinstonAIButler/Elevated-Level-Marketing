import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { currentPlanWeek, formatDate } from "@/lib/format";
import { TIERS } from "@/lib/tiers";
import { usageThisMonth } from "@/lib/usage";
import { runAutopilotNow, toggleAutopilot } from "@/app/actions/account";
import { ScoreRing } from "@/components/Score";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Dashboard" };

export default async function Overview() {
  const user = await requireUser();
  const business = user.business;

  if (!business) {
    return (
      <div className="card" style={{ maxWidth: 640 }}>
        <h1>Welcome, {user.name.split(" ")[0]}!</h1>
        <p className="muted">Start by telling us about your business. It takes about five minutes and powers everything else.</p>
        <Link href="/dashboard/business" className="btn btn-primary">Set up business profile</Link>
      </div>
    );
  }

  const [assessment, plan, campaigns, activity, usage] = await Promise.all([
    db.assessment.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: "desc" } }),
    db.marketingPlan.findFirst({ where: { businessId: business.id, active: true }, include: { tasks: true } }),
    db.campaign.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.activity.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    usageThisMonth(business.id),
  ]);

  const done = plan?.tasks.filter((t) => t.status === "DONE").length ?? 0;
  const total = plan?.tasks.length ?? 0;
  const week = plan ? currentPlanWeek(plan.startDate, plan.durationWeeks) : 0;
  const waiting = plan?.tasks.filter((t) => t.owner === "CLIENT" && t.status !== "DONE" && t.week <= week) ?? [];
  const limits = TIERS[user.tier].limits;

  const next = !assessment
    ? { href: "/dashboard/assessment", label: "Take your marketing assessment" }
    : !plan
      ? { href: "/dashboard/plan", label: "Generate your marketing plan" }
      : campaigns.length === 0
        ? { href: "/dashboard/campaigns/new", label: "Create your first campaign" }
        : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{business.name}</h1>
          <p className="muted">Here&apos;s where your marketing stands this week.</p>
        </div>
        {next && <Link href={next.href} className="btn btn-primary">{next.label} →</Link>}
      </div>

      {!aiEnabled() && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          Demo mode: no Claude API key is configured, so assessments, plans and campaigns use template content.
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="muted small">Marketing score</div>
          {assessment ? (
            <div className="row" style={{ marginTop: 8 }}>
              <ScoreRing score={assessment.overallScore} size={84} />
              <Link href={`/dashboard/assessment/${assessment.id}`} className="small">View report</Link>
            </div>
          ) : (
            <p style={{ marginTop: 8 }}><Link href="/dashboard/assessment">Not assessed yet</Link></p>
          )}
        </div>
        <div className="card">
          <div className="muted small">Plan progress</div>
          <div className="stat">{total ? Math.round((done / total) * 100) : 0}%</div>
          <div className="muted small">{plan ? `Week ${week} of ${plan.durationWeeks} · ${done}/${total} tasks` : "No active plan"}</div>
        </div>
        <div className="card">
          <div className="muted small">Campaigns this month</div>
          <div className="stat">{usage.campaigns}</div>
          <div className="muted small">of {limits.campaignsPerMonth >= 1000 ? "unlimited" : limits.campaignsPerMonth} on {TIERS[user.tier].name}</div>
        </div>
        <div className="card">
          <div className="muted small">Waiting on you</div>
          <div className="stat">{waiting.length}</div>
          <div className="muted small">{waiting.length ? <Link href="/dashboard/plan">See tasks</Link> : "You're all caught up"}</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Autopilot</h2>
            <span className={`badge ${user.autopilot ? "badge-good" : ""}`}>{user.autopilot ? "On" : "Off"}</span>
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            Every Monday, autopilot drafts a fresh content batch from your plan, starts this week&apos;s automated tasks and
            flags anything waiting on you.{user.tier === "TRIAL" && " Weekly runs are included with paid plans; you can still run it manually."}
          </p>
          <div className="row">
            <form action={toggleAutopilot}>
              <SubmitButton className="btn btn-ghost btn-sm" pendingText="Saving...">
                Turn {user.autopilot ? "off" : "on"}
              </SubmitButton>
            </form>
            {plan && (
              <form action={runAutopilotNow}>
                <SubmitButton className="btn btn-dark btn-sm" pendingText="Running... (this can take a minute)">Run now</SubmitButton>
              </form>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Recent activity</h2>
          {activity.length ? (
            <ul className="feed">
              {activity.map((a) => (
                <li key={a.id} className="row between">
                  <span>{a.message}</span>
                  <span className="muted small">{formatDate(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing yet.</p>
          )}
        </div>

        <div className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Latest campaigns</h2>
            <Link href="/dashboard/campaigns/new" className="btn btn-primary btn-sm">New campaign</Link>
          </div>
          {campaigns.length ? (
            <ul className="feed" style={{ marginTop: 10 }}>
              {campaigns.map((c) => (
                <li key={c.id} className="row between">
                  <Link href={`/dashboard/campaigns/${c.id}`}>{c.name}</Link>
                  <span className="badge">{c.status.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ marginTop: 10 }}>No campaigns yet.</p>
          )}
        </div>

        {plan && (
          <div className="card">
            <h2>This week (week {week})</h2>
            <ul className="feed">
              {plan.tasks.filter((t) => t.week === week).map((t) => (
                <li key={t.id} className="row between">
                  <span>{t.title}</span>
                  <span className="badge">{t.status.replace("_", " ").toLowerCase()}</span>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/plan" className="small">Open full plan →</Link>
          </div>
        )}
      </div>
    </>
  );
}
