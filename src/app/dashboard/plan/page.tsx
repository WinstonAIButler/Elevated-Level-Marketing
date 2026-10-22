import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { currentPlanWeek, formatDate } from "@/lib/format";
import { setTaskStatus } from "@/app/actions/plan";
import { GeneratePlanForm } from "./GeneratePlanForm";

export const metadata = { title: "Marketing plan" };

type Strategy = { channel: string; role: string; tactics: string[] }[];
type Budget = { channel: string; percent: number }[];
type Kpis = { metric: string; target: string }[];

const OWNER_LABEL = { AI: "Automated", CLIENT: "You", TEAM: "Elevated team" } as const;
const NEXT_STATUS = { TODO: "IN_PROGRESS", IN_PROGRESS: "DONE", DONE: "TODO" } as const;
const STATUS_ACTION = { TODO: "Start", IN_PROGRESS: "Mark done", DONE: "Reopen" } as const;

export default async function PlanPage() {
  const { business } = await requireBusiness();
  const [plan, hasAssessment] = await Promise.all([
    db.marketingPlan.findFirst({
      where: { businessId: business.id, active: true },
      include: { tasks: { orderBy: [{ week: "asc" }, { owner: "asc" }] } },
    }),
    db.assessment.count({ where: { businessId: business.id } }),
  ]);

  if (!plan) {
    return (
      <div className="card" style={{ maxWidth: 680 }}>
        <h1>Your marketing plan</h1>
        <p className="muted">
          We&apos;ll turn {hasAssessment ? "your assessment results" : "your business profile"} into a 12-week plan with
          objectives, channel strategy, budget split and a task list we track with you.
        </p>
        {!hasAssessment && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Tip: take the assessment first for a sharper plan.
          </div>
        )}
        <GeneratePlanForm label="Generate my 12-week plan" />
      </div>
    );
  }

  const week = currentPlanWeek(plan.startDate, plan.durationWeeks);
  const weeks = Array.from({ length: plan.durationWeeks }, (_, i) => i + 1);
  const done = plan.tasks.filter((t) => t.status === "DONE").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{plan.title}</h1>
          <p className="muted">
            Started {formatDate(plan.startDate)} · Week {week} of {plan.durationWeeks} · {done}/{plan.tasks.length} tasks done
          </p>
        </div>
        <GeneratePlanForm label="Regenerate plan" subtle />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: "1.05rem" }}>{plan.summary}</p>
        <div className="grid grid-3">
          <div>
            <h3>Objectives</h3>
            <ul>{(plan.objectives as string[]).map((o) => <li key={o}>{o}</li>)}</ul>
          </div>
          <div>
            <h3>Budget split</h3>
            <table className="simple">
              <tbody>
                {(plan.budgetAllocation as Budget).map((b) => (
                  <tr key={b.channel}>
                    <td>{b.channel}</td>
                    <td style={{ textAlign: "right" }}>
                      {b.percent}%{business.monthlyBudget ? ` · $${Math.round((business.monthlyBudget * b.percent) / 100)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3>KPIs</h3>
            <table className="simple">
              <tbody>
                {(plan.kpis as Kpis).map((k) => (
                  <tr key={k.metric}><td>{k.metric}</td><td style={{ textAlign: "right" }}><strong>{k.target}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 28 }}>
        {(plan.channelStrategy as Strategy).map((s) => (
          <div className="card card-flat" key={s.channel}>
            <h3>{s.channel}</h3>
            <p className="muted small">{s.role}</p>
            <ul className="small">{s.tactics.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        ))}
      </div>

      <h2>Execution timeline</h2>
      {weeks.map((w) => {
        const tasks = plan.tasks.filter((t) => t.week === w);
        if (!tasks.length) return null;
        return (
          <div className="week" key={w}>
            <div className="week-head">
              <strong>Week {w}</strong>
              {w === week && <span className="badge badge-good">This week</span>}
              <span className="muted small">due {formatDate(tasks[0].dueDate)}</span>
            </div>
            {tasks.map((t) => (
              <div className={`task ${t.status === "DONE" ? "done" : ""}`} key={t.id}>
                <div>
                  <div className="task-title">{t.title}</div>
                  <div className="muted small">{t.description}</div>
                  <div className="row small" style={{ marginTop: 4, gap: 8 }}>
                    <span className="badge">{t.channel}</span>
                    <span className={`badge ${t.owner === "CLIENT" ? "badge-warn" : ""}`}>{OWNER_LABEL[t.owner]}</span>
                    {t.status === "IN_PROGRESS" && <span className="badge badge-good">In progress</span>}
                  </div>
                </div>
                <form action={setTaskStatus}>
                  <input type="hidden" name="taskId" value={t.id} />
                  <input type="hidden" name="status" value={NEXT_STATUS[t.status]} />
                  <button className="btn btn-ghost btn-sm">{STATUS_ACTION[t.status]}</button>
                </form>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
