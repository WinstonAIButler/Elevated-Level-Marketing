"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { answersFromForm, QUESTIONS, scoreAssessment } from "@/lib/assessment";
import { assessmentInsight } from "@/lib/ai";
import { assertWithinLimit, logActivity } from "@/lib/usage";
import type { FormState } from "./auth";

export async function submitAssessment(_: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness();
  const answers = answersFromForm(form);
  if (Object.keys(answers).length < QUESTIONS.length) {
    return { error: "Please answer every question so the score is accurate." };
  }

  let id: string;
  try {
    await assertWithinLimit(user, business.id, "assessments");
    const { scores, overall } = scoreAssessment(answers);
    const { insight, ai } = await assessmentInsight(business, answers, scores, overall);
    const saved = await db.assessment.create({
      data: {
        businessId: business.id,
        answers,
        scores,
        overallScore: overall,
        summary: insight.summary,
        strengths: insight.strengths,
        weaknesses: insight.weaknesses,
        recommendations: insight.recommendations,
        aiGenerated: ai,
      },
    });
    await logActivity(business.id, "assessment", `Marketing assessment completed: ${overall}/100`);
    id = saved.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
  redirect(`/dashboard/assessment/${id}`);
}
