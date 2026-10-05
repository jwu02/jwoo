// The deterministic Tetris simulation.
//
// Pure TypeScript: no React, no pixi, no DOM, no clock (ADR 0005). It advances
// only when `tick` is called, and the only things that change a game are the
// seed it was built with and the intents fed to it, so one seed plus one input
// log replays one game exactly.
//
// It has two read paths, and the split is the point:
//
//  - `board`, `active` and `ghostY` are pulled once per frame by the renderer —
//    live state, read as it stands.
//  - `readout` is republished only when one of its fields changes, and `subscribe`
//    tells React when that happens, so the HUD re-renders on game events rather
//    than on frames.
//
// Coordinates: rows count from the top of a `visibleRows + bufferRows` matrix,
// row 0 being the highest. The top `bufferRows` rows are the spawn buffer the
// well never shows; a piece may be kicked above row 0, which the matrix has no
// room for, so those cells are simply out of play (a documented ceiling of the
// two-row buffer).

import {
  DEFAULT_CONFIG,
  gravityTicksPerRow,
  levelForLines,
  type TetrisConfig,
} from "./config"
import {
  PIECE_KEYS,
  SPAWN_X,
  SPAWN_Y,
  kickTests,
  pieceCells,
  rotateState,
  type PieceKey,
  type Rotation,
} from "./pieces"
import type { Intent } from "./controller"

export type Phase = "ready" | "playing" | "over"

/** The HUD-facing slice of the game: republished only when one of these changes. */
export interface Readout {
  phase: Phase
  score: number
  lines: number
  level: number
  /** The next pieces the previews show. A new array only when the queue changes. */
  next: readonly PieceKey[]
  hold: PieceKey | null
  /** Consecutive clearing placements; −1 is "no combo running". */
  combo: number
  /** Whether the last line-clearing placement was a difficult one. */
  backToBack: boolean
}

/** The active piece as the renderer needs it: a box position, not a cell list. */
export interface ActivePiece {
  key: PieceKey
  rotation: Rotation
  x: number
  y: number
}

/**
 * The plain-JSON snapshot an AI reads (the Observation of CONTEXT.md): the
 * visible well, the active piece, the queue and the progress counters. Board
 * rows here are the well's own — row 0 is the top visible row — so a spawning
 * piece's cells sit above it at negative rows.
 */
export interface Observation {
  phase: Phase
  score: number
  lines: number
  level: number
  tick: number
  combo: number
  backToBack: boolean
  hold: PieceKey | null
  next: readonly PieceKey[]
  board: readonly (readonly (PieceKey | null)[])[]
  active: ActivePiece | null
  ghostY: number | null
}

/**
 * What a line-clearing placement scores: the line score for the number of rows
 * cleared × the level before the clear, ×1.5 when a Tetris follows a Tetris,
 * plus 50 × combo × level for a run of consecutive clearing placements
 * (Scoring — TetrisWiki).
 */
export function clearScore(
  count: number,
  level: number,
  combo: number,
  backToBack: boolean,
  config: TetrisConfig
): number {
  const difficult = count === 4
  let total = config.lineScores[count] * level
  if (difficult && backToBack) total *= config.backToBackMultiplier
  const running = combo + 1
  if (running > 0) total += config.comboBonus * running * level
  return total
}

/**
 * One candidate destination for the active piece: a rotation and a column it can
 * be hard-dropped into. Rows are the Engine's board rows — the two spawn buffer
 * rows included, the same frame `applyPlacement` consumes — not the visible
 * well's frame the Observation uses.
 */
export interface Placement {
  rotation: Rotation
  x: number
  y: number
}

export interface Engine {
  readonly readout: Readout
  /** The renderer's per-frame pull. Live arrays — read, never write. */
  readonly board: readonly (readonly (PieceKey | null)[])[]
  readonly active: ActivePiece | null
  /** Where the active piece would land if hard-dropped now. */
  readonly ghostY: number | null
  readonly ticks: number
  /** Called when the Readout changes; React's subscription point. */
  subscribe(listener: () => void): () => void
  /** Deal a fresh game: the same seed deals the same pieces again. */
  start(): void
  tick(intent: Intent): void
  observe(): Observation
  legalPlacements(): Placement[]
  applyPlacement(placement: Placement): void
}

/**
 * The Seeded 7-bag of the Random Generator: every seven draws are the seven
 * tetrominoes in a random order. The RNG is the injectable seam — seed it and
 * the sequence is fixed, which is what makes a game replayable.
 */
export function createBag(seed: number): {
  next(): PieceKey
  reset(): void
} {
  let rng = mulberry32(seed)
  const bag: PieceKey[] = []

  return {
    next() {
      if (bag.length === 0) {
        bag.push(...PIECE_KEYS)
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1))
          const swap = bag[i]
          bag[i] = bag[j]
          bag[j] = swap
        }
      }
      return bag.pop()!
    },
    reset() {
      bag.length = 0
      rng = mulberry32(seed)
    },
  }
}

/** mulberry32, a small seeded PRNG. Only its reproducibility matters here. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createEngine({
  seed = 1,
  config: overrides,
}: {
  seed?: number
  config?: Partial<TetrisConfig>
} = {}): Engine {
  const config: TetrisConfig = { ...DEFAULT_CONFIG, ...overrides }
  const rows = config.visibleRows + config.bufferRows
  const bag = createBag(seed)
  const listeners = new Set<() => void>()

  let board: (PieceKey | null)[][] = emptyBoard()
  let queue: PieceKey[] = []
  let active: ActivePiece | null = null
  let hold: PieceKey | null = null
  let holdUsed = false

  let phase: Phase = "ready"
  let score = 0
  let lines = 0
  let level = 1
  let combo = -1
  let backToBack = false
  let ticks = 0

  let fall = 0
  let lockTimer = 0
  let moveResets = 0
  let lowestRow = 0
  let dasTimer = 0
  let arrTimer = 0
  let heldDirection: -1 | 0 | 1 = 0
  let wasLeft = false
  let wasRight = false

  let readout: Readout

  function emptyBoard(): (PieceKey | null)[][] {
    return Array.from({ length: rows }, () =>
      new Array<PieceKey | null>(config.columns).fill(null)
    )
  }

  function collides(
    key: PieceKey,
    rotation: Rotation,
    x: number,
    y: number
  ): boolean {
    for (const [cx, cy] of pieceCells(key, rotation, x, y)) {
      if (cx < 0 || cx >= config.columns) return true
      if (cy >= rows) return true
      // The matrix is the well plus its buffer rows and there is nothing above
      // them: above the matrix is blocked, so a kick cannot leave the board and
      // lock with cells that have nowhere to be written.
      if (cy < 0 || board[cy][cx] !== null) return true
    }
    return false
  }

  function grounded(): boolean {
    return (
      active !== null &&
      collides(active.key, active.rotation, active.x, active.y + 1)
    )
  }

  /**
   * After any successful move or rotation: a landed piece's lock timer is reset
   * (Extended Placement), at most `lockMoveResets` times per piece. Movement in
   * the air costs nothing — the budget is not consumed until there is a landing
   * to defer.
   */
  function afterMove() {
    if (!grounded()) return
    if (moveResets < config.lockMoveResets) {
      moveResets += 1
      lockTimer = 0
    }
  }

  /** Reaching a new lowest row restores the move budget (the dossier's flagged default). */
  function noteDescent() {
    if (active !== null && active.y > lowestRow) {
      lowestRow = active.y
      moveResets = 0
    }
  }

  function refill() {
    while (queue.length < config.refillAt) queue.push(bag.next())
  }

  function spawn(key?: PieceKey) {
    const next = key ?? queue.shift()!
    refill()
    active = {
      key: next,
      rotation: 0,
      x: SPAWN_X[next],
      y: SPAWN_Y[next],
    }
    holdUsed = false
    fall = 0
    lockTimer = 0
    moveResets = 0
    lowestRow = active.y
    if (collides(next, 0, active.x, active.y)) {
      active = null
      phase = "over"
      return
    }
    // "They must start with their flat side down, and move down immediately
    // after appearing" — the spawn drop, before any player input.
    if (!collides(next, 0, active.x, active.y + 1)) {
      active.y += 1
      lowestRow = active.y
    }
  }

  function holdPiece() {
    if (active === null || holdUsed) return
    const incoming = hold
    hold = active.key
    spawn(incoming ?? undefined)
    holdUsed = true
  }

  function rotate(direction: 1 | -1) {
    if (active === null) return
    // O has no kick data; its four states occupy the same cells, so a rotation
    // is observable as a no-op — and still counts as a move for the lock timer.
    if (active.key === "O") {
      afterMove()
      return
    }
    const to = rotateState(active.rotation, direction)
    for (const [dx, dy] of kickTests(active.key, active.rotation, to)) {
      if (!collides(active.key, to, active.x + dx, active.y + dy)) {
        active.rotation = to
        active.x += dx
        active.y += dy
        noteDescent()
        afterMove()
        return
      }
    }
  }

  function shift(dx: -1 | 1): boolean {
    if (
      active === null ||
      collides(active.key, active.rotation, active.x + dx, active.y)
    ) {
      return false
    }
    active.x += dx
    afterMove()
    return true
  }

  /**
   * Held horizontal movement, DAS and ARR in Ticks: a fresh press shifts at
   * once and starts the delay; the delay gone, the piece shifts every ARR Ticks
   * for as long as the direction is held. Modelled here rather than in the
   * keyboard layer so every Controller plays under the same rules (ADR 0006).
   */
  function stepHorizontal(intent: Intent) {
    const leftEdge = intent.left && !wasLeft
    const rightEdge = intent.right && !wasRight
    wasLeft = intent.left
    wasRight = intent.right

    const direction: -1 | 0 | 1 =
      intent.left && !intent.right ? -1 : intent.right && !intent.left ? 1 : 0

    if (direction === 0) {
      heldDirection = 0
      return
    }
    if (direction !== heldDirection || leftEdge || rightEdge) {
      heldDirection = direction
      shift(direction)
      dasTimer = config.dasTicks
      arrTimer = config.arrTicks
      return
    }
    if (dasTimer > 0) {
      dasTimer -= 1
      if (dasTimer === 0) {
        shift(direction)
        arrTimer = config.arrTicks
      }
      return
    }
    arrTimer -= 1
    if (arrTimer <= 0) {
      shift(direction)
      arrTimer = config.arrTicks
    }
  }

  function stepVertical(intent: Intent) {
    if (active === null) return
    if (grounded()) {
      fall = 0
      lockTimer += 1
      if (lockTimer >= config.lockDelayTicks) lock()
      return
    }
    lockTimer = 0
    // Soft drop is a multiple of the current gravity, not a fixed speed, so it
    // stays proportionally ahead of the level's pace — and once the level is
    // faster than a row per Tick it stays ahead of that too.
    const ticksPerRow = intent.down
      ? gravityTicksPerRow(level, config) / config.softDropFactor
      : gravityTicksPerRow(level, config)
    // Rows owed, not Ticks owed: a level past ~level 13 pays several rows a Tick.
    fall += 1 / ticksPerRow
    while (fall >= 1) {
      if (active === null || grounded()) {
        fall = 0
        break
      }
      fall -= 1
      active.y += 1
      if (intent.down) score += config.softDropPoints
      noteDescent()
    }
  }

  function hardDrop() {
    if (active === null) return
    let distance = 0
    while (!collides(active.key, active.rotation, active.x, active.y + 1)) {
      active.y += 1
      distance += 1
    }
    score += distance * config.hardDropPoints
    lock()
  }

  function lock() {
    if (active === null) return
    const piece = active
    const cells = pieceCells(piece.key, piece.rotation, piece.x, piece.y)
    // Lock out: every cell came to rest above the visible well.
    const lockedOut = cells.every(([, y]) => y < config.bufferRows)
    for (const [x, y] of cells) board[y][x] = piece.key
    active = null
    if (lockedOut) {
      phase = "over"
      return
    }
    clearLines()
    spawn()
  }

  function clearLines() {
    const cleared: number[] = []
    for (let y = 0; y < rows; y++) {
      if (board[y].every((cell) => cell !== null)) cleared.push(y)
    }
    if (cleared.length === 0) {
      combo = -1
      return
    }

    const count = cleared.length
    // The level is the one before the clear, for the line score and the combo
    // alike (Scoring — TetrisWiki).
    score += clearScore(count, level, combo, backToBack, config)
    combo += 1
    backToBack = count === 4

    lines += count
    level = levelForLines(lines, config)

    board = board.filter((row, y) => !cleared.includes(y))
    while (board.length < rows) {
      board.unshift(new Array<PieceKey | null>(config.columns).fill(null))
    }
  }

  function publish() {
    const next = queue.slice(0, config.previewCount)
    if (readout !== undefined && sameReadout(readout, next)) return
    readout = { phase, score, lines, level, next, hold, combo, backToBack }
    for (const listener of listeners) listener()
  }

  function sameReadout(current: Readout, next: readonly PieceKey[]): boolean {
    return (
      current.phase === phase &&
      current.score === score &&
      current.lines === lines &&
      current.level === level &&
      current.hold === hold &&
      current.combo === combo &&
      current.backToBack === backToBack &&
      current.next.length === next.length &&
      current.next.every((key, i) => key === next[i])
    )
  }

  function reset() {
    board = emptyBoard()
    queue = []
    bag.reset()
    refill()
    active = null
    hold = null
    holdUsed = false
    score = 0
    lines = 0
    level = 1
    combo = -1
    backToBack = false
    ticks = 0
    fall = 0
    lockTimer = 0
    moveResets = 0
    dasTimer = 0
    arrTimer = 0
    heldDirection = 0
    wasLeft = false
    wasRight = false
  }

  const engine: Engine = {
    get readout() {
      return readout
    },
    get board() {
      return board
    },
    get active() {
      return active
    },
    get ghostY() {
      if (active === null) return null
      let y = active.y
      while (!collides(active.key, active.rotation, active.x, y + 1)) y += 1
      return y
    },
    get ticks() {
      return ticks
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      reset()
      phase = "playing"
      spawn()
      publish()
    },
    tick(intent: Intent) {
      if (phase !== "playing" || active === null) return
      ticks += 1
      if (intent.hold) holdPiece()
      if (intent.rotateCW) rotate(1)
      if (intent.rotateCCW) rotate(-1)
      stepHorizontal(intent)
      if (intent.hardDrop) {
        hardDrop()
        publish()
        return
      }
      stepVertical(intent)
      publish()
    },
    observe() {
      return {
        phase,
        score,
        lines,
        level,
        tick: ticks,
        combo,
        backToBack,
        hold,
        next: queue.slice(0, config.previewCount),
        board: board.slice(config.bufferRows).map((row) => row.slice()),
        // Rows are the well's own, so a piece still in the spawn buffer reads
        // as negative — above the well rather than in it.
        active: active
          ? {
              key: active.key,
              rotation: active.rotation,
              x: active.x,
              y: active.y - config.bufferRows,
            }
          : null,
        ghostY:
          engine.ghostY === null ? null : engine.ghostY - config.bufferRows,
      }
    },
    legalPlacements() {
      if (active === null) return []
      // Walk the (rotation, column) states reachable from where the piece stands
      // by shifting and rotating in place — a rotation only counts when its
      // un-kicked position (kick test [0,0]) fits. Landings reachable only
      // through a wall kick are therefore not enumerated (ADR 0006): the
      // enumeration is sound, and its ceiling is documented.
      const visited = new Set([`${active.rotation},${active.x}`])
      const frontier: [Rotation, number][] = [[active.rotation, active.x]]
      const seen = new Set<string>()
      const placements: Placement[] = []
      while (frontier.length > 0) {
        const [rotation, x] = frontier.shift()!
        let y = active.y
        while (!collides(active.key, rotation, x, y + 1)) y += 1
        const cells = pieceCells(active.key, rotation, x, y)
        // The same landing from two rotations (O, and S/Z's repeats) is one placement.
        const landing = cells
          .map(([cx, cy]) => `${cx},${cy}`)
          .sort()
          .join("|")
        if (!seen.has(landing)) {
          seen.add(landing)
          placements.push({ rotation, x, y })
        }

        // A neighbour is one more column over, or one rotation step — both at
        // the piece's own row, so neither is a wall kick.
        const neighbours: [Rotation, number][] = [
          [rotation, x - 1],
          [rotation, x + 1],
          [rotateState(rotation, 1), x],
          [rotateState(rotation, -1), x],
        ]
        for (const [next, column] of neighbours) {
          const key = `${next},${column}`
          if (column < 0 || column >= config.columns) continue
          if (visited.has(key)) continue
          if (collides(active.key, next, column, active.y)) continue
          visited.add(key)
          frontier.push([next, column])
        }
      }
      return placements
    },
    applyPlacement(placement) {
      if (active === null) return
      const distance = placement.y - active.y
      if (distance > 0) score += distance * config.hardDropPoints
      active = {
        key: active.key,
        rotation: placement.rotation,
        x: placement.x,
        y: placement.y,
      }
      lock()
      publish()
    },
  }

  // The Readout exists before the first Tick: a subscriber mounting on the
  // start screen reads a ready game, not an undefined one.
  publish()
  return engine
}
