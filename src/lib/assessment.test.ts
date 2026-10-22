import { describe, expect, it } from "vitest";
import { answersFromForm, QUESTIONS, scoreAssessment, scoreBand, weakestCategories } from "./assessment";

const all = (idx: number) => Object.fromEntries(QUESTIONS.map((q) => [q.id, idx]));

describe("scoreAssessment", () => {
  it("scores the best answers as 100 everywhere", () => {
    const { scores, overall } = scoreAssessment(all(3));
    expect(overall).toBe(100);
    expect(Object.values(scores).every((s) => s === 100)).toBe(true);
  });

  it("scores the worst answers and missing answers as 0", () => {
    expect(scoreAssessment(all(0)).overall).toBe(0);
    expect(scoreAssessment({}).overall).toBe(0);
  });

  it("scores categories independently", () => {
    const answers = { ...all(3), seo_gbp: 0, seo_rank: 0 };
    const { scores, overall } = scoreAssessment(answers);
    expect(scores.seo).toBe(0);
    expect(scores.website).toBe(100);
    expect(overall).toBe(Math.round((7 * 100) / 8));
    expect(weakestCategories(scores)[0]).toBe("seo");
  });
});

describe("answersFromForm", () => {
  it("keeps only valid option indexes for known questions", () => {
    const form = new FormData();
    form.set("web_mobile", "2");
    form.set("web_cta", "9");
    form.set("seo_gbp", "abc");
    form.set("unknown", "1");
    expect(answersFromForm(form)).toEqual({ web_mobile: 2 });
  });
});

describe("scoreBand", () => {
  it("bands scores", () => {
    expect(scoreBand(80).tone).toBe("good");
    expect(scoreBand(50).tone).toBe("warn");
    expect(scoreBand(10).tone).toBe("bad");
  });
});
