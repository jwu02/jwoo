import { topSkills, SKILL_ROW_LIMIT } from "@/lib/ai-usage/skills";

// Twelve skills, each invoked one fewer time than the last, so the tail past
// the tenth is worth 2 + 1.
const ranked = Array.from({ length: 12 }, (_, i) => ({
  skill: String.fromCharCode(97 + i),
  invocations: 12 - i,
}));

describe("topSkills", () => {
  it("keeps the ranking's head and drops the tail", () => {
    const rows = topSkills(ranked);

    // Deep equality, not just a length: the dropped 2 + 1 is nowhere — no row
    // stands for the rest.
    expect(rows).toEqual(ranked.slice(0, SKILL_ROW_LIMIT));
    expect(rows.at(-1)).toEqual({ skill: "j", invocations: 3 });
  });

  it("keeps a list no longer than the limit whole", () => {
    const short = ranked.slice(0, SKILL_ROW_LIMIT);
    expect(topSkills(short)).toEqual(short);
  });

  it("returns an empty list for an empty list", () => {
    expect(topSkills([])).toEqual([]);
  });
});
