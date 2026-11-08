import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { currentPlanWeek, formatDate } from "@/lib/format";
import { TIERS } from "@/lib/tiers";
import { CHANNELS } from "@/lib/channels";
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

  const [assessment, plan, campaigns, activity, usage, pendingCount, liveAds, connections, allocation] = await Promise.all([
    db.assessment.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: "desc" } }),
    db.marketingPlan.findFirst({ where: { businessId: business.id, active: true }, include: { tasks: true } }),
    db.campaign.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.activity.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    usageThisMonth(business.id),
    db.publishItem.count({ where: { businessId: business.id, status: "PENDING_APPROVAL" } }),
    db.publishItem.count({ where: { businessId: business.id, kind: "AD", status: "PUBLISHED" } }),
    db.channelConnection.findMany({ where: { businessId: business.id, status: { in: ["active", "linked"] } }, select: { provider: true } }),
    db.budgetAllocation.findFirst({ where: { businessId: business.id, status: { in: ["PROPOSED", "APPROVED"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const leadCount = await db.lead.count({ where: { businessId: business.id } });

  const done = plan?.tasks.filter((t) => t.status === "DONE").length ?? 0;
  const total = plan?.tasks.length ?? 0;
  const week = plan ? currentPlanWeek(plan.startDate, plan.durationWeeks) : 0;
  const waiting = plan?.tasks.filter((t) => t.owner === "CLIENT" && t.status !== "DONE" && t.week <= week) ?? [];
  const limits = TIERS[user.tier].limits;

  // Onboarding checklist, in the order a new client should do things.
  const steps = [
    { done: true, href: "/dashboard/business", label: "Tell us about your business" },
    { done: Boolean(assessment), href: "/dashboard/assessment", label: "Take your marketing assessment" },
    { done: Boolean(plan), href: "/dashboard/plan", label: "Get your 12-week marketing plan" },
    { done: connections.length > 0, href: "/dashboard/channels", label: "Add your social and Google accounts" },
    { done: leadCount > 0, href: "/dashboard/leads/connect", label: "Import your customers or connect your CRM" },
    { done: Boolean(allocation), href: "/dashboard/ad-spend", label: "Set your ad budget" },
    { done: campaigns.length > 0, href: "/dashboard/campaigns/new", label: "Create your first campaign" },
  ];
  const todo = steps.filter((s) => !s.done);
  const next = todo[0] ?? null;

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

      {todo.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>Getting started</h2>
            <span className="muted small">{steps.length - todo.length} of {steps.length} done</span>
          </div>
          <ol className="checklist">
            {steps.map((s) => (
              <li key={s.label} className={s.done ? "done" : ""}>
                {s.done ? <span>{s.label}</span> : <Link href={s.href}>{s.label}</Link>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <strong>{pendingCount} item{pendingCount === 1 ? " is" : "s are"} waiting for your approval.</strong>{" "}
          <Link href="/dashboard/approvals">Review now →</Link>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="muted small">Waiting for approval</div>
          <div className="stat">{pendingCount}</div>
          <div className="muted small"><Link href="/dashboard/approvals">{pendingCount ? "Review posts and ads" : "Nothing to review"}</Link></div>
        </div>
        <div className="card">
          <div className="muted small">{business.adSpendMode === "WALLET" ? "Ad wallet" : "Monthly ad budget"}</div>
          <div className="stat">${business.adSpendMode === "WALLET" ? (business.walletBalanceCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 }) : business.monthlyBudget.toLocaleString()}</div>
          <div className="muted small"><Link href="/dashboard/ad-spend">{liveAds} ad campaign{liveAds === 1 ? "" : "s"} live</Link></div>
        </div>
        <div className="card">
          <div className="muted small">Budget split</div>
          <div className="stat" style={{ fontSize: "1.1rem", marginTop: 8 }}>{allocation ? (allocation.status === "APPROVED" ? "Approved" : "Needs your OK") : "Not set"}</div>
          <div className="muted small"><Link href="/dashboard/ad-spend">See where it goes</Link></div>
        </div>
        <div className="card">
          <div className="muted small">Connected channels</div>
          <div className="stat">{connections.length}<small className="muted"> / {Object.keys(CHANNELS).length}</small></div>
          <div className="muted small"><Link href="/dashboard/channels">{connections.length ? connections.map((c) => CHANNELS[c.provider].name).join(", ") : "Connect accounts"}</Link></div>
        </div>
      </div>

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
          <div className="muted small">of {limits.campaignsPerMonth} on {TIERS[user.tier].name}</div>
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
            Every Monday, autopilot writes a fresh content batch from your plan and sends it to Approvals, proposes your
            monthly ad budget split, starts this week&apos;s automated tasks and flags anything waiting on you. Approved
            posts and ads publish to your connected channels automatically.{user.tier === "TRIAL" && " Weekly runs are included with paid plans; you can still run it manually."}
          </p>
          <div className="row">
            <form action={toggleAutopilot}>
              <SubmitButton className="btn btn-ghost btn-sm" pendingText="Saving…">
                Turn {user.autopilot ? "off" : "on"}
              </SubmitButton>
            </form>
            {plan && (
              <form action={runAutopilotNow}>
                <SubmitButton className="btn btn-dark btn-sm" pendingText="Running… (this can take a minute)">Run now</SubmitButton>
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
