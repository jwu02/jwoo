// kevala's encoding for the pivot the latency spike fired (#53): the Observation
// and its Placements rendered into the one question the stock transformers.js
// zero-shot pipeline reads (ADR-0009). Laya proper would have needed the
// vendored laya encoding — a per-candidate sequence builder and a batch
// collation. The pivot needs neither: the pipeline takes one premise, scores a
// list of candidate hypotheses against it, and returns a probability per
// hypothesis, so the whole encoding is two renderings and one re-ordering.
//
// Both renderings are pure and order-preserving, because the Judge's contract
// is exact: it answers with an index into the Placements it was given, so a
// score that lands on the wrong candidate is a wrong Placement, silently. The
// premise is fixed per judgment; the labels are the candidates in the order the
// Autopilot enumerated them.
//
// The phrasing is the question #49 would have answered and this ticket did not:
// entailment phrasing and any temperature fit are unmeasured, so what is here
// is a defensible default, not a tuned one. The Margin it produces is honest
// about that — which is why the Margin is shown and acted on by nothing.

import type { Observation, Placement } from "./engine"
import type { PieceKey } from "./pieces"

/** What the pipeline reads: one premise, and one hypothesis per candidate. */
export interface ScoreQuestion {
  premise: string
  labels: string[]
}

/**
 * The hypothesis template the pipeline fills each candidate into. The candidate
 * is a noun phrase ("dropping the T piece..."), so the sentence it completes has
 * to be one an NLI model has seen the shape of.
 */
export const HYPOTHESIS_TEMPLATE = "The best move is {}."

/** The premise: the position as text, the way a judge reads a board. */
export function boardText(observation: Observation): string {
  const active = observation.active
  const lines = [
    `level ${observation.level} lines ${observation.lines} score ${observation.score}`,
    active === null
      ? "active empty"
      : `active ${active.key} rotation ${active.rotation} column ${active.x} row ${active.y}`,
    `next ${observation.next.join(" ")}`,
    `hold ${observation.hold ?? "empty"}`,
    "board:",
    ...observation.board.map((row) =>
      row.map((cell) => (cell === null ? "." : "#")).join("")
    ),
  ]
  return lines.join("\n")
}

/**
 * One candidate as a phrase, from where the piece stands: the rotation and the
 * column the engine would hard-drop it into. `null` is a sighting with no
 * active piece — a state the Engine cannot hand out a Placement in, so the
 * placeholder never reaches a real question.
 */
export function placementLabel(
  piece: PieceKey | null,
  placement: Placement
): string {
  return `dropping the ${piece ?? "?"} piece rotated ${placement.rotation} into column ${placement.x}`
}

/** The premise and the candidates, in the order the Judge was given them. */
export function scoreQuestion(
  observation: Observation,
  placements: readonly Placement[]
): ScoreQuestion {
  return {
    premise: boardText(observation),
    labels: placements.map((placement) =>
      placementLabel(observation.active?.key ?? null, placement)
    ),
  }
}

/**
 * The pipeline answers sorted by score — the winner first — while the Judge's
 * candidate order is the contract. This is the un-sorting, and the last place a
 * wrong index can still be caught: a candidate the pipeline did not score, or a
 * score that is not a finite number, rejects the judgment rather than quietly
 * handing the autopilot the first Placement instead.
 */
export function candidateOrder(
  labels: readonly string[],
  ranked: { labels: readonly string[]; scores: readonly number[] }
): number[] {
  const scored = new Map(
    ranked.labels.map((label, i) => [label, ranked.scores[i]])
  )
  return labels.map((label) => {
    const score = scored.get(label)
    if (score === undefined)
      throw new Error(`the pipeline scored no candidate: ${label}`)
    if (!Number.isFinite(score))
      throw new Error(`the pipeline scored ${label} as ${score}`)
    return score
  })
}
