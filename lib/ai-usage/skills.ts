// How many skills the AI-usage page names.

import { BySkill } from "./types";

/** The most skill rows the list draws. */
export const SKILL_ROW_LIMIT = 10;

/**
 * The list's rows: the head of the ranking, and nothing folded behind it — a
 * row past the limit is dropped, not summed into a row standing for the rest.
 *
 * Rows arrive already ranked by invocations — the aggregation ranks them, so
 * the cut never re-sorts and the ranking has one source.
 */
export function topSkills(rows: BySkill[]): BySkill[] {
  return rows.slice(0, SKILL_ROW_LIMIT);
}
