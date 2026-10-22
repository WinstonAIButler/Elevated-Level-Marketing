import "server-only";
import type { Business, User } from "@prisma/client";
import { db } from "./db";
import { campaign as generateCampaignContent } from "./ai";
import { addDays, currentPlanWeek } from "./format";
import { assertWithinLimit, logActivity } from "./usage";

export type AutopilotResult = { businessId: string; actions: string[]; skipped?: string };

const SOCIAL = /instagram|facebook|tiktok|linkedin|social|\bx\b|twitter|youtube|pinterest/i;

/**
 * One weekly autopilot pass for a client:
 *  1. Drafts this week's social content batch from the active plan's channels.
 *  2. Moves this week's AI-owned plan tasks into progress (they are now in review).
 *  3. Logs reminders for overdue tasks that are waiting on the client.
 */
export async function runAutopilot(user: User, business: Business): Promise<AutopilotResult> {
  const actions: string[] = [];
  const plan = await db.marketingPlan.findFirst({
    where: { businessId: business.id, active: true },
    include: { tasks: true },
  });
  if (!plan) return { businessId: business.id, actions, skipped: "No active marketing plan" };

  const week = currentPlanWeek(plan.startDate, plan.durationWeeks);
  const recent = await db.campaign.findFirst({
    where: { businessId: business.id, autopilot: true, createdAt: { gte: addDays(new Date(), -6) } },
  });

  if (!recent) {
    const planChannels = (plan.channelStrategy as { channel: string }[]).map((c) => c.channel);
    const channels = planChannels.filter((c) => SOCIAL.test(c));
    const brief = {
      objective: `Week ${week} content batch: keep ${business.name} visible and drive enquiries`,
      channels: channels.length ? channels : ["Instagram", "Facebook"],
      budget: 0,
      durationDays: 7,
      notes: `This week's plan tasks: ${plan.tasks
        .filter((t) => t.week === week)
        .map((t) => t.title)
        .join("; ") || "none"}`,
    };
    try {
      await assertWithinLimit(user, business.id, "campaigns");
      const { campaign, ai } = await generateCampaignContent(business, brief);
      const start = new Date();
      await db.campaign.create({
        data: {
          businessId: business.id,
          planId: plan.id,
          name: `Week ${week} content batch`,
          objective: brief.objective,
          channels: brief.channels,
          audience: campaign.audience,
          budget: 0,
          startDate: start,
          endDate: addDays(start, 7),
          content: campaign,
          aiGenerated: ai,
          autopilot: true,
        },
      });
      actions.push(`Drafted week ${week} content batch`);
    } catch (err) {
      actions.push(`Content batch skipped: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  const due = plan.tasks.filter((t) => t.owner === "AI" && t.status === "TODO" && t.week <= week);
  if (due.length) {
    await db.task.updateMany({ where: { id: { in: due.map((t) => t.id) } }, data: { status: "IN_PROGRESS" } });
    actions.push(`Started ${due.length} automated task${due.length === 1 ? "" : "s"}`);
  }

  const overdue = plan.tasks.filter((t) => t.owner === "CLIENT" && t.status !== "DONE" && t.dueDate < new Date());
  if (overdue.length) actions.push(`${overdue.length} task${overdue.length === 1 ? "" : "s"} waiting on you`);

  for (const message of actions) await logActivity(business.id, "autopilot", message);
  return { businessId: business.id, actions };
}

/** Run autopilot for every paying client who has it switched on. */
export async function runAutopilotForAll() {
  const users = await db.user.findMany({
    where: { autopilot: true, tier: { not: "TRIAL" }, business: { isNot: null } },
    include: { business: true },
  });
  const results: AutopilotResult[] = [];
  for (const u of users) {
    if (u.business) results.push(await runAutopilot(u, u.business));
  }
  return results;
}
