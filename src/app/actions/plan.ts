"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { marketingPlan } from "@/lib/ai";
import type { CategoryScores } from "@/lib/assessment";
import { addDays } from "@/lib/format";
import { assertWithinLimit, logActivity } from "@/lib/usage";
import type { FormState } from "./auth";

export async function generatePlan(_: FormState): Promise<FormState> {
  const { user, business } = await requireBusiness();
  try {
    await assertWithinLimit(user, business.id, "plans");
    const assessment = await db.assessment.findFirst({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    });
    const { plan, ai } = await marketingPlan(
      business,
      assessment && {
        scores: assessment.scores as CategoryScores,
        overallScore: assessment.overallScore,
        recommendations: assessment.recommendations,
      },
    );
    const start = new Date();
    await db.$transaction([
      db.marketingPlan.updateMany({ where: { businessId: business.id, active: true }, data: { active: false } }),
      db.marketingPlan.create({
        data: {
          businessId: business.id,
          assessmentId: assessment?.id,
          title: plan.title,
          summary: plan.summary,
          objectives: plan.objectives,
          channelStrategy: plan.channelStrategy,
          budgetAllocation: plan.budgetAllocation,
          kpis: plan.kpis,
          startDate: start,
          aiGenerated: ai,
          tasks: {
            create: plan.tasks.map((t) => ({
              title: t.title,
              description: t.description,
              channel: t.channel,
              week: t.week,
              owner: t.owner,
              dueDate: addDays(start, t.week * 7 - 1),
            })),
          },
        },
      }),
    ]);
    await logActivity(business.id, "plan", `New 12-week marketing plan created with ${plan.tasks.length} tasks`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
  redirect("/dashboard/plan");
}

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

export async function setTaskStatus(form: FormData) {
  const { business } = await requireBusiness();
  const taskId = String(form.get("taskId"));
  const status = String(form.get("status")) as TaskStatus;
  if (!STATUSES.includes(status)) return;

  const task = await db.task.findFirst({ where: { id: taskId, plan: { businessId: business.id } } });
  if (!task) return;
  await db.task.update({
    where: { id: task.id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  if (status === "DONE") await logActivity(business.id, "task", `Completed: ${task.title}`);
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
}
