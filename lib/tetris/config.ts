// Every number the Guideline rules turn on, in one place.
//
// The dossier (docs/research/tetris-guideline-rules.md) is the source of these
// values, and it closes by asking for its implementation-safe defaults to be
// configuration rather than magic numbers: a handful of them (spawn rows, next
// queue count, the move-reset restore, the soft-drop factor, the 20G clamp) are
// interpretations the wiki does not pin down, so they are named and tunable
// here rather than buried in the engine. A test that wants a three-Tick lock
// delay overrides one of these, not the engine.

export interface TetrisConfig {
  /** Ticks per second the Engine advances in. Real time is accumulated outside. */
  tickHz: number
  /** Visible well: the Guideline's 10×20. */
  columns: number
  visibleRows: number
  /**
   * Rows above the well the matrix keeps. Pieces spawn here and may lock here;
   * the dossier's Guideline default is a 20-row buffer, of which only the two
   * spawn rows are ever used by this Engine's bottom-out rules.
   */
  bufferRows: number
  /** How many pieces the Next queue shows. Three — the dossier's lower end of official practice, the mobile titles' choice — keeps the overlaid HUD compact. */
  previewCount: number
  /** Refill a whole bag whenever the queue drops below this, so previews never see a seam. */
  refillAt: number
  /** Gravity curve: seconds per row = (base − (level−1)·step)^(level−1). */
  gravityBase: number
  gravityStep: number
  /** G in Guideline terms are cells per 60 Hz frame; the curve is clamped here. */
  maxGravity: number
  /** Soft drop is this multiple of the current level's gravity (Guideline convention). */
  softDropFactor: number
  softDropPoints: number
  hardDropPoints: number
  /** Extended Placement: a landed piece waits this long before locking. */
  lockDelayTicks: number
  /** …and a successful move or rotation may reset that wait this many times. */
  lockMoveResets: number
  /** DAS/ARR, measured in Ticks (167 ms and 33 ms at 60 Hz). */
  dasTicks: number
  arrTicks: number
  /** Marathon progression: fixed goal, every 10 lines, capped. */
  linesPerLevel: number
  maxLevel: number
  /** Base line-clear scores, indexed by lines cleared; multiplied by the level before the clear. */
  lineScores: readonly number[]
  /** A combo of n is worth this × n × level (Combo — TetrisWiki). */
  comboBonus: number
  /** A difficult clear chained onto another is worth this much of its score. */
  backToBackMultiplier: number
}

export const DEFAULT_CONFIG: TetrisConfig = {
  tickHz: 60,
  columns: 10,
  visibleRows: 20,
  bufferRows: 2,
  previewCount: 3,
  refillAt: 7,
  gravityBase: 0.8,
  gravityStep: 0.007,
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
}

/**
 * The Guideline Marathon curve: (0.8 − (level−1)·0.007)^(level−1) seconds per
 * row, from the *Tetris Worlds* curve the dossier verified against the wiki's
 * frame-accurate table.
 */
export function gravitySecondsPerRow(
  level: number,
  config: TetrisConfig = DEFAULT_CONFIG
): number {
  return Math.pow(
    config.gravityBase - (level - 1) * config.gravityStep,
    level - 1
  )
}

/**
 * The same curve in Ticks per row, clamped at `maxGravity` G — a G being one cell
 * per 60 Hz frame, so 20 G is a row every twentieth of a Tick and the Engine's
 * fall accumulator pays rows rather than Ticks. The clamp only bites past level
 * 19 (level 19 is 20.23 G), which a Marathon capped at level 15 never reaches;
 * it is the dossier's flagged default for the post-level-19 gap.
 */
export function gravityTicksPerRow(
  level: number,
  config: TetrisConfig = DEFAULT_CONFIG
): number {
  const ticks = gravitySecondsPerRow(level, config) * config.tickHz
  return Math.max(ticks, 1 / config.maxGravity)
}

/** Marathon's fixed goal: a level every 10 lines, capped. */
export function levelForLines(
  lines: number,
  config: TetrisConfig = DEFAULT_CONFIG
): number {
  return Math.min(config.maxLevel, Math.floor(lines / config.linesPerLevel) + 1)
}
