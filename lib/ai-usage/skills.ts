// How much of the skill ranking the AI-usage page names before it folds the
// tail, and the fold itself.

import { BySkill } from "./types";
import { OTHERS_SEGMENT } from "./breakdown";

/** The most skill rows the list draws: this many named, then one Others. */
export const SKILL_ROW_LIMIT = 10;

/**
 * Fold a ranked skill list into at most {@link SKILL_ROW_LIMIT} named rows plus
 * one `Others` row worth the rest.
 *
 * Rows arrive already ranked by invocations — the aggregation ranks them, so
 * the fold never re-sorts and the ranking has one source. A skill already
 * called `Others` never ranks on its own, the same rule the donuts' fold
 * keeps: it is already "not named individually", so it joins the folded tail
 * instead of sitting beside the segment that means it.
 */
export function foldSkillTail(rows: BySkill[]): BySkill[] {
  const named = rows
    .filter((row) => row.skill !== OTHERS_SEGMENT)
    .slice(0, SKILL_ROW_LIMIT);
  const namedSkills = new Set(named.map((row) => row.skill));

  const folded = rows
    .filter((row) => !namedSkills.has(row.skill))
    .reduce((sum, row) => sum + row.invocations, 0);

  // A list with no tail gains no `Others` row.
  return folded === 0
    ? named
    : [...named, { skill: OTHERS_SEGMENT, invocations: folded }];
}
