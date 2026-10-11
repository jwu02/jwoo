import { foldSkillTail, SKILL_ROW_LIMIT } from "@/lib/ai-usage/skills";
import { OTHERS_SEGMENT } from "@/lib/ai-usage/breakdown";

// Twelve skills, each invoked one fewer time than the last: the tail past the
// tenth is worth 2 + 1.
const ranked = Array.from({ length: 12 }, (_, i) => ({
  skill: String.fromCharCode(97 + i),
  invocations: 12 - i,
}));

describe("foldSkillTail", () => {
  it("keeps the top rows and folds the rest into one Others row", () => {
    const rows = foldSkillTail(ranked);

    expect(rows.map((row) => row.skill)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      OTHERS_SEGMENT,
    ]);
    expect(rows.at(-1)).toEqual({ skill: OTHERS_SEGMENT, invocations: 3 });
  });

  it("adds no others row when the list is no longer than the limit", () => {
    const rows = foldSkillTail(ranked.slice(0, SKILL_ROW_LIMIT));

    expect(rows).toHaveLength(SKILL_ROW_LIMIT);
    expect(rows.some((row) => row.skill === OTHERS_SEGMENT)).toBe(false);
  });

  it("returns an empty list for an empty list", () => {
    expect(foldSkillTail([])).toEqual([]);
  });

  it("folds a skill already called Others instead of ranking it", () => {
    const rows = foldSkillTail([
      ...ranked,
      { skill: OTHERS_SEGMENT, invocations: 40 },
    ]);

    // Ten named rows, and the one already called Others joins the tail: the
    // folded k and l (2 + 1 = 3) plus that row's own 40.
    expect(rows).toHaveLength(SKILL_ROW_LIMIT + 1);
    expect(rows.at(-1)).toEqual({
      skill: OTHERS_SEGMENT,
      invocations: 43,
    });
  });
});
