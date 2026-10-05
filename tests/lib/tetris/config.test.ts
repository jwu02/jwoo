/**
 * @jest-environment node
 */
import {
  DEFAULT_CONFIG,
  gravitySecondsPerRow,
  gravityTicksPerRow,
  levelForLines,
} from "@/lib/tetris/config"

describe("the Guideline numbers", () => {
  it("carries the dossier's implementation-safe defaults", () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      tickHz: 60,
      columns: 10,
      visibleRows: 20,
      previewCount: 6,
      maxGravity: 20,
      softDropFactor: 20,
      softDropPoints: 1,
      hardDropPoints: 2,
      lockDelayTicks: 30,
      lockMoveResets: 15,
      dasTicks: 10,
      arrTicks: 2,
      linesPerLevel: 10,
      maxLevel: 15,
      lineScores: [0, 100, 300, 500, 800],
      comboBonus: 50,
      backToBackMultiplier: 1.5,
    })
    // 167 ms of DAS and 33 ms of ARR at 60 Hz.
    expect(DEFAULT_CONFIG.dasTicks / DEFAULT_CONFIG.tickHz).toBeCloseTo(
      0.1667,
      3
    )
    expect(DEFAULT_CONFIG.arrTicks / DEFAULT_CONFIG.tickHz).toBeCloseTo(
      0.033,
      3
    )
    expect(DEFAULT_CONFIG.lockDelayTicks / DEFAULT_CONFIG.tickHz).toBeCloseTo(
      0.5,
      6
    )
  })

  it("walks the Tetris Worlds gravity curve", () => {
    // (0.8 − (level−1)·0.007)^(level−1) seconds a row, per TetrisWiki §Gravity.
    const curve = (level: number) =>
      Math.pow(0.8 - (level - 1) * 0.007, level - 1)
    expect(gravitySecondsPerRow(1)).toBeCloseTo(1, 9)
    expect(gravitySecondsPerRow(2)).toBeCloseTo(curve(2), 9)
    expect(gravitySecondsPerRow(5)).toBeCloseTo(curve(5), 9)
    expect(gravitySecondsPerRow(15)).toBeCloseTo(curve(15), 9)
    expect(gravityTicksPerRow(1)).toBeCloseTo(60, 9)
    expect(gravityTicksPerRow(2) / DEFAULT_CONFIG.tickHz).toBeCloseTo(
      curve(2),
      9
    )
    expect(gravityTicksPerRow(5) / DEFAULT_CONFIG.tickHz).toBeCloseTo(
      curve(5),
      9
    )
  })

  it("matches the wiki's frame-accurate G table", () => {
    // The dossier's table, in G: one cell per 60 Hz frame. A Tick is a frame, so
    // G is simply the reciprocal of the Ticks a row costs — an independent check
    // on the formula's arithmetic rather than on itself.
    const table = [
      [1, 0.01667],
      [2, 0.021017],
      [3, 0.026977],
      [4, 0.035256],
      [5, 0.04693],
      [6, 0.06361],
      [7, 0.0879],
      [8, 0.1236],
      [9, 0.1775],
      [10, 0.2598],
      [11, 0.388],
      [12, 0.59],
      [13, 0.92],
      [14, 1.46],
      [15, 2.36],
    ]
    for (const [level, g] of table) {
      expect(1 / gravityTicksPerRow(level)).toBeCloseTo(g, 2)
    }
  })

  it("clamps gravity at 20 G, past the level a Marathon reaches", () => {
    // 20 G is twenty rows a Tick, so a row every twentieth of a Tick.
    expect(gravityTicksPerRow(19)).toBeCloseTo(1 / 20, 9)
    expect(gravityTicksPerRow(20)).toBeCloseTo(1 / 20, 9)
    // The cap is level 15, whose 2.36 G is nowhere near the clamp: the clamp is
    // the dossier's default for the post-19 gap, not a Marathon speed.
    expect(gravityTicksPerRow(15)).toBeGreaterThan(1 / 20)
    expect(1 / gravityTicksPerRow(15)).toBeCloseTo(2.36, 2)
  })

  it("levels up every ten lines, capped", () => {
    expect(levelForLines(0)).toBe(1)
    expect(levelForLines(9)).toBe(1)
    expect(levelForLines(10)).toBe(2)
    expect(levelForLines(19)).toBe(2)
    expect(levelForLines(140)).toBe(15)
    expect(levelForLines(150)).toBe(15)
    expect(levelForLines(10_000)).toBe(15)
  })
})
