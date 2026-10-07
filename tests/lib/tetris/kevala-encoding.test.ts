/**
 * @jest-environment node
 */
import type { Observation, Placement } from "@/lib/tetris/engine"
import {
  HYPOTHESIS_TEMPLATE,
  boardText,
  candidateOrder,
  placementLabel,
  scoreQuestion,
} from "@/lib/tetris/kevala-encoding"
import type { PieceKey } from "@/lib/tetris/pieces"

function observation(overrides: Partial<Observation> = {}): Observation {
  const rows = ["..........", "..........", "...II.....", "..IIII...."]
  return {
    phase: "playing",
    score: 400,
    lines: 12,
    level: 3,
    tick: 42,
    combo: 0,
    backToBack: false,
    hold: null,
    next: ["J", "L", "O", "S", "Z", "I", "T"],
    board: rows.map((row) =>
      [...row].map((cell): PieceKey | null => (cell === "." ? null : "I"))
    ),
    active: { key: "T", rotation: 0, x: 4, y: 6 },
    ghostY: 14,
    ...overrides,
  }
}

const PLACEMENTS: Placement[] = [
  { rotation: 0, x: 3, y: 16 },
  { rotation: 2, x: 6, y: 17 },
]

describe("the pivot's encoding", () => {
  it("renders the position as the premise: counters, piece, queue and well", () => {
    const lines = boardText(observation()).split("\n")
    expect(lines).toEqual([
      "level 3 lines 12 score 400",
      "active T rotation 0 column 4 row 6",
      "next J L O S Z I T",
      "hold empty",
      "board:",
      "..........",
      "..........",
      "...##.....",
      "..####....",
    ])
  })

  it("says so when there is no held piece", () => {
    expect(boardText(observation({ hold: "S" }))).toContain("hold S")
  })

  it("names one candidate per Placement, rotation and column, in the order given", () => {
    const placements: Placement[] = [
      { rotation: 1, x: 0, y: 15 },
      { rotation: 0, x: 4, y: 18 },
      { rotation: 2, x: 2, y: 16 },
    ]
    const { labels } = scoreQuestion(observation(), placements)
    expect(labels).toEqual([
      "dropping the T piece rotated 1 into column 0",
      "dropping the T piece rotated 0 into column 4",
      "dropping the T piece rotated 2 into column 2",
    ])
    // Unique by construction: the un-sorting maps the pipeline's answer back by
    // label, so two candidates sharing one would be a silent wrong Placement.
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("fills a candidate into a sentence an NLI model can read", () => {
    const { premise, labels } = scoreQuestion(observation(), PLACEMENTS)
    expect(HYPOTHESIS_TEMPLATE).toBe("The best move is {}.")
    expect(HYPOTHESIS_TEMPLATE.replace("{}", labels[0])).toContain(
      "dropping the T piece rotated 0 into column 3"
    )
    expect(premise).toBe(boardText(observation()))
  })

  it("restores the candidate order the pipeline's ranking undid", () => {
    const labels = scoreQuestion(observation(), PLACEMENTS).labels
    // The pipeline answers best-first; the Judge's contract is the order given.
    const ranked = {
      labels: [labels[1], labels[0]],
      scores: [0.7, 0.3],
    }
    expect(candidateOrder(labels, ranked)).toEqual([0.3, 0.7])
  })

  it("rejects a score that never happened, rather than handing back a Placement", () => {
    const labels = scoreQuestion(observation(), PLACEMENTS).labels
    expect(() =>
      candidateOrder(labels, { labels: [labels[0]], scores: [0.5] })
    ).toThrow(labels[1])
    expect(() =>
      candidateOrder(labels, {
        labels: [labels[0], labels[1]],
        scores: [0.5, Number.NaN],
      })
    ).toThrow(labels[1])
  })

  it("renders the placement label from the piece's rotation and column", () => {
    expect(placementLabel("S", { rotation: 3, x: 9, y: 1 })).toBe(
      "dropping the S piece rotated 3 into column 9"
    )
  })
})
