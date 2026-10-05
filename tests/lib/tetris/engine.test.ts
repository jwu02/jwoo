/**
 * @jest-environment node
 */
import { join, resolve } from "node:path"
import { readdirSync, readFileSync } from "node:fs"
import {
  createBag,
  createEngine,
  clearScore,
  type Engine,
} from "@/lib/tetris/engine"
import { NO_INTENT, type Intent } from "@/lib/tetris/controller"
import { DEFAULT_CONFIG, type TetrisConfig } from "@/lib/tetris/config"
import {
  PIECE_KEYS,
  SPAWN_X,
  SPAWN_Y,
  pieceCells,
  type PieceKey,
  type Rotation,
} from "@/lib/tetris/pieces"

function input(partial: Partial<Intent>): Intent {
  return { ...NO_INTENT, ...partial }
}

function newGame(seed = 1, config?: Partial<TetrisConfig>): Engine {
  const engine = createEngine({ seed, config })
  engine.start()
  return engine
}

/** A fresh game whose first pieces are `keys`: the bag decides, so search seeds. */
function gameWithSequence(
  keys: PieceKey[],
  config?: Partial<TetrisConfig>
): Engine {
  for (let seed = 1; seed <= 2000; seed++) {
    const engine = newGame(seed, config)
    if (engine.active?.key !== keys[0]) continue
    const upcoming = keys.slice(1)
    if (upcoming.every((key, i) => engine.readout.next[i] === key)) {
      return engine
    }
  }
  throw new Error(`no seed within 2000 deals ${keys.join(" ")}`)
}

function gameWith(key: PieceKey, config?: Partial<TetrisConfig>): Engine {
  return gameWithSequence([key], config)
}

function activePiece(engine: Engine) {
  const piece = engine.active
  if (piece === null) throw new Error("no active piece")
  return piece
}

/** Soft-drop Ticks until the piece cannot fall any further. */
function settle(engine: Engine) {
  for (let guard = 0; guard < 2000; guard++) {
    const piece = activePiece(engine)
    if (engine.ghostY === piece.y) return
    engine.tick(input({ down: true }))
  }
  throw new Error("piece never settled")
}

/**
 * Play the piece into the lowest reachable landing, leftmost first — a stand-in
 * player whose only purpose is to fill rows the same way twice.
 */
function packLowest(engine: Engine) {
  const placements = engine.legalPlacements()
  const best = placements.reduce((a, b) =>
    b.y > a.y || (b.y === a.y && b.x < a.x) ? b : a
  )
  engine.applyPlacement(best)
}

/**
 * Whether the active piece can reach a placement's rotation and column by
 * shifting and rotating in place, never taking a wall kick (the documented
 * ceiling of legalPlacements).
 */
function reachableWithoutKick(
  engine: Engine,
  placement: { rotation: Rotation; x: number }
): boolean {
  const piece = activePiece(engine)
  const fits = (rotation: Rotation, x: number) =>
    pieceCells(piece.key, rotation, x, piece.y).every(
      ([cx, cy]) =>
        cx >= 0 &&
        cx < DEFAULT_CONFIG.columns &&
        cy >= 0 &&
        cy < DEFAULT_CONFIG.visibleRows + DEFAULT_CONFIG.bufferRows &&
        engine.board[cy][cx] === null
    )
  const seen = new Set([`${piece.rotation},${piece.x}`])
  const queue: [Rotation, number][] = [[piece.rotation, piece.x]]
  while (queue.length > 0) {
    const [rotation, x] = queue.shift()!
    if (rotation === placement.rotation && x === placement.x) return true
    const neighbours: [Rotation, number][] = [
      [rotation, x - 1],
      [rotation, x + 1],
      [((rotation + 1) % 4) as Rotation, x],
      [((rotation + 3) % 4) as Rotation, x],
    ]
    for (const [next, column] of neighbours) {
      const key = `${next},${column}`
      if (column < 0 || column >= DEFAULT_CONFIG.columns) continue
      if (seen.has(key) || !fits(next, column)) continue
      seen.add(key)
      queue.push([next, column])
    }
  }
  return false
}

/** Every line-clearing placement of a flat-pack game, as `[lines, score gained]`. */
function clears(
  seed: number,
  config: Partial<TetrisConfig> = {},
  limit = 60
): [number, number, number][] {
  const engine = newGame(seed, config)
  const events: [number, number, number][] = []
  for (let n = 0; n < limit && engine.readout.phase === "playing"; n++) {
    const before = engine.readout
    packLowest(engine)
    const after = engine.readout
    if (after.lines > before.lines) {
      events.push([
        after.lines - before.lines,
        after.score - before.score,
        before.level,
      ])
    }
  }
  return events
}

describe("a fresh engine", () => {
  it("starts Ready: an empty well and no piece until start()", () => {
    const engine = createEngine({ seed: 1 })
    expect(engine.readout.phase).toBe("ready")
    expect(engine.readout.score).toBe(0)
    expect(engine.active).toBeNull()
    expect(engine.ghostY).toBeNull()
    expect(
      engine.board.every((row) => row.every((cell) => cell === null))
    ).toBe(true)

    engine.tick(input({ hardDrop: true, rotateCW: true }))
    expect(engine.ticks).toBe(0)
    expect(engine.readout.phase).toBe("ready")

    engine.start()
    expect(engine.readout.phase).toBe("playing")
    expect(engine.active).not.toBeNull()
  })

  it("spawns every piece in the buffer rows at its own spawn column", () => {
    for (const key of PIECE_KEYS) {
      const engine = gameWith(key)
      // The spawn drop has already been paid, so a piece reads one row above
      // the well's own row 0 (see ActivePiece).
      expect(engine.observe().active).toEqual({
        key,
        rotation: 0,
        x: SPAWN_X[key],
        y: SPAWN_Y[key] + 1 - DEFAULT_CONFIG.bufferRows,
      })
    }
  })

  it("shows three upcoming pieces from the queue", () => {
    const engine = newGame(1)
    expect(engine.readout.next).toHaveLength(DEFAULT_CONFIG.previewCount)
    expect(engine.readout.next).toHaveLength(3)
  })
})

describe("the seeded 7-bag", () => {
  it("deals the same order twice for one seed, and a different one otherwise", () => {
    const draws = (seed: number) => {
      const bag = createBag(seed)
      return Array.from({ length: 21 }, () => bag.next())
    }
    expect(draws(7)).toEqual(draws(7))
    expect(draws(7)).not.toEqual(draws(8))
  })

  it("deals each piece exactly once per seven, and never starves a piece", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const bag = createBag(seed)
      const draws = Array.from({ length: 700 }, () => bag.next())
      // Per-bag permutation.
      for (let i = 0; i + 7 <= draws.length; i += 7) {
        expect(new Set(draws.slice(i, i + 7)).size).toBe(7)
      }
      // Global bounds the Guideline bag promises (TetrisWiki §Random Generator).
      expect([...new Set(draws)].sort()).toEqual([...PIECE_KEYS].sort())
      let sinceI = 0
      let run = 0
      let maxSinceI = 0
      let maxRun = 0
      for (const key of draws) {
        sinceI = key === "I" ? 0 : sinceI + 1
        run = key === "S" || key === "Z" ? run + 1 : 0
        maxSinceI = Math.max(maxSinceI, sinceI)
        maxRun = Math.max(maxRun, run)
      }
      expect(maxSinceI).toBeLessThanOrEqual(12)
      expect(maxRun).toBeLessThanOrEqual(4)
    }
  })
})

describe("gravity", () => {
  it("falls one row every 60 Ticks at level 1", () => {
    const engine = newGame(1)
    const y = activePiece(engine).y
    for (let i = 0; i < 59; i++) engine.tick(NO_INTENT)
    expect(activePiece(engine).y).toBe(y)
    engine.tick(NO_INTENT)
    expect(activePiece(engine).y).toBe(y + 1)
  })

  it("soft drops at 20× gravity, a point a cell", () => {
    const engine = newGame(1)
    const y = activePiece(engine).y
    for (let i = 0; i < 3; i++) engine.tick(input({ down: true }))
    expect(activePiece(engine).y).toBe(y + 1)
    expect(engine.readout.score).toBe(DEFAULT_CONFIG.softDropPoints)
  })

  it("pays several rows in one Tick once a Tick is worth more than a row", () => {
    // Level 13 is the first that falls faster than a row a Tick, and no fixture
    // climbs that far, so the multi-row path is reached through the soft-drop
    // multiple instead: at 200× gravity a Tick owes three and a third rows.
    const engine = newGame(1, { softDropFactor: 200 })
    const from = activePiece(engine).y
    const ghost = engine.ghostY!
    engine.tick(input({ down: true }))
    expect(activePiece(engine).y).toBe(from + 3)
    expect(engine.readout.score).toBe(3)

    // It stops at the floor rather than passing through it, and the remainder
    // does not carry into a lock.
    for (let i = 0; i < 20; i++) engine.tick(input({ down: true }))
    expect(activePiece(engine).y).toBe(ghost)
    expect(engine.readout.phase).toBe("playing")
  })

  it("hard drops to the ghost and pays two points a cell", () => {
    const engine = newGame(1)
    const from = activePiece(engine).y
    const ghost = engine.ghostY!
    expect(ghost).toBeGreaterThan(from)
    engine.tick(input({ hardDrop: true }))
    expect(engine.readout.score).toBe(
      (ghost - from) * DEFAULT_CONFIG.hardDropPoints
    )
  })

  it("parks a grounded piece instead of accumulating fall between rows", () => {
    const engine = newGame(1)
    settle(engine)
    const rested = activePiece(engine).y
    // Grounded Ticks neither move the piece nor lose the remainder.
    for (let i = 0; i < 5; i++) engine.tick(NO_INTENT)
    expect(activePiece(engine).y).toBe(rested)
  })
})

describe("SRS rotation", () => {
  it("kicks a T off the floor upwards and leftwards rotating CW", () => {
    const engine = gameWith("T")
    settle(engine)
    expect(activePiece(engine)).toMatchObject({ rotation: 0, x: 3, y: 20 })

    engine.tick(input({ rotateCW: true }))
    expect(activePiece(engine)).toMatchObject({
      key: "T",
      rotation: 1,
      x: 2,
      y: 19,
    })
  })

  it("kicks a T off the floor upwards and rightwards rotating CCW", () => {
    const engine = gameWith("T")
    settle(engine)

    engine.tick(input({ rotateCCW: true }))
    expect(activePiece(engine)).toMatchObject({
      key: "T",
      rotation: 3,
      x: 4,
      y: 19,
    })
  })

  it("treats an O rotation as a no-op that is still a move", () => {
    const engine = gameWith("O")
    settle(engine)
    const before = activePiece(engine)
    engine.tick(input({ rotateCW: true }))
    expect(activePiece(engine)).toEqual(before)
  })
})

describe("DAS and ARR", () => {
  it("shifts at once, again after ten Ticks, then every two", () => {
    const engine = gameWith("T")
    while (activePiece(engine).x > 0) engine.tick(input({ left: true }))
    engine.tick(NO_INTENT)

    // A fresh press shifts immediately…
    engine.tick(input({ right: true }))
    expect(activePiece(engine).x).toBe(1)
    // …then DAS holds it for ten Ticks…
    for (let i = 0; i < 9; i++) engine.tick(input({ right: true }))
    expect(activePiece(engine).x).toBe(1)
    engine.tick(input({ right: true }))
    expect(activePiece(engine).x).toBe(2)
    // …and ARR repeats every two.
    engine.tick(input({ right: true }))
    expect(activePiece(engine).x).toBe(2)
    engine.tick(input({ right: true }))
    expect(activePiece(engine).x).toBe(3)
    engine.tick(input({ right: true }))
    expect(activePiece(engine).x).toBe(3)
    engine.tick(input({ right: true }))
    expect(activePiece(engine).x).toBe(4)
  })

  it("moves nowhere while both directions are held", () => {
    const engine = gameWith("T")
    const x = activePiece(engine).x
    for (let i = 0; i < 12; i++) {
      engine.tick(input({ left: true, right: true }))
    }
    expect(activePiece(engine).x).toBe(x)
  })
})

describe("Extended Placement lock delay", () => {
  it("locks a landed piece on the thirtieth grounded Tick", () => {
    const engine = newGame(1)
    settle(engine)
    const landed = activePiece(engine)
    for (let i = 0; i < DEFAULT_CONFIG.lockDelayTicks - 1; i++) {
      engine.tick(NO_INTENT)
    }
    expect(activePiece(engine)).toEqual(landed)
    engine.tick(NO_INTENT)
    expect(activePiece(engine)).not.toEqual(landed)
  })

  it("resets the delay for a move, at most fifteen times, and not a sixteenth", () => {
    const engine = newGame(1)
    settle(engine)

    // Fifteen grounded shifts, each on a fresh press, spend the whole budget.
    for (let i = 0; i < DEFAULT_CONFIG.lockMoveResets; i++) {
      engine.tick(input(i % 2 === 0 ? { left: true } : { right: true }))
    }
    // The last shift zeroed the timer, and this same Tick's gravity step left
    // it at one; twenty idle Ticks put it at twenty-one.
    for (let i = 0; i < 20; i++) engine.tick(NO_INTENT)

    // The budget is spent, so this shift is not a reset. The timer was at
    // twenty-one; this Tick took it to twenty-two, leaving seven safe Ticks.
    engine.tick(input({ left: true }))
    const moved = activePiece(engine)
    for (let i = 0; i < 7; i++) {
      engine.tick(NO_INTENT)
    }
    expect(activePiece(engine)).toEqual(moved)
    engine.tick(NO_INTENT)
    expect(activePiece(engine)).not.toEqual(moved)
  })

  it("restores the move budget when the piece reaches a new lowest row", () => {
    // A ledge one row above the floor under the spawn column, then a T landing
    // on it: stepping off the ledge is a descent into a new lowest row.
    const engine = gameWithSequence(["I", "T"])
    while (activePiece(engine).x > 0) engine.tick(input({ left: true }))
    engine.tick(input({ hardDrop: true }))
    settle(engine)
    const ledge = activePiece(engine).y

    for (let i = 0; i < DEFAULT_CONFIG.lockMoveResets; i++) {
      engine.tick(input(i % 2 === 0 ? { left: true } : { right: true }))
    }
    expect(activePiece(engine).y).toBe(ledge)

    // Off the ledge and down: the descent restores the budget.
    while (activePiece(engine).x < 4) engine.tick(input({ right: true }))
    settle(engine)
    expect(activePiece(engine).y).toBe(ledge + 1)

    // A move now defers the lock again, where before the descent it would not.
    for (let i = 0; i < 25; i++) engine.tick(NO_INTENT)
    engine.tick(input({ right: true }))
    const restored = activePiece(engine)
    for (let i = 0; i < 25; i++) engine.tick(NO_INTENT)
    expect(activePiece(engine)).toEqual(restored)
  })
})

describe("line clears and scoring", () => {
  it("scores a single, a double and a triple at the level before the clear", () => {
    // Golden fixtures: the drop points (2 a cell) are part of the gain.
    // The packer tops out after its fifth clear — the reachable placements are
    // a subset of the columns it used to teleport into (see legalPlacements).
    expect(clears(1)).toEqual([
      [1, 134, 1],
      [1, 126, 1],
      [1, 114, 1],
      // A combo of 1 adds 50 × 1 × level to the second clear in a row.
      [1, 166, 1],
      [1, 104, 1],
    ])
    expect(clears(6, {}, 24)).toEqual([
      [1, 136, 1],
      [2, 324, 1],
    ])
    expect(clears(8, { columns: 7 }, 30)).toEqual([
      [1, 136, 1],
      [1, 136, 1],
      [1, 134, 1],
      [1, 126, 1],
      [1, 124, 1],
      [1, 124, 1],
      [3, 520, 1],
    ])
  })

  it("multiplies by the level before the clear, capped at maxLevel", () => {
    expect(clears(1, { linesPerLevel: 1 })).toEqual([
      [1, 134, 1],
      [1, 226, 2],
      [1, 314, 3],
      [1, 616, 4],
      [1, 504, 5],
    ])
    expect(clears(1, { linesPerLevel: 1, maxLevel: 2 })).toEqual([
      [1, 134, 1],
      [1, 226, 2],
      [1, 214, 2],
      [1, 316, 2],
      [1, 204, 2],
    ])
  })

  it("prices the clears the fixtures cannot reach: Tetrises and back-to-back", () => {
    const config = DEFAULT_CONFIG
    const score = (count: number, level = 1, combo = -1, b2b = false) =>
      clearScore(count, level, combo, b2b, config)
    expect(score(1)).toBe(100)
    expect(score(2)).toBe(300)
    expect(score(3)).toBe(500)
    expect(score(4)).toBe(800)
    expect(score(4, 3)).toBe(2400)
    // Back-to-back applies to a Tetris only, before the combo.
    expect(score(4, 1, -1, true)).toBe(1200)
    expect(score(4, 5, -1, true)).toBe(6000)
    expect(score(3, 1, -1, true)).toBe(500)
    // The combo counts the clear just made: combo n is 50 × n × level.
    expect(score(1, 2, 0)).toBe(300)
    expect(score(2, 1, 2)).toBe(450)
  })

  it("clears rows instantly and keeps the well's height", () => {
    const engine = newGame(1)
    for (let n = 0; n < 7; n++) packLowest(engine)
    expect(engine.readout.lines).toBe(1)
    expect(engine.observe().board).toHaveLength(DEFAULT_CONFIG.visibleRows)
  })
})

describe("hold", () => {
  it("swaps the piece out, once, until it locks", () => {
    const engine = newGame(1)
    const first = activePiece(engine).key
    const second = engine.readout.next[0]
    const third = engine.readout.next[1]

    engine.tick(input({ hold: true }))
    expect(engine.readout.hold).toBe(first)
    expect(activePiece(engine).key).toBe(second)
    // A held piece comes back to the spawn state, spawn drop included.
    expect(activePiece(engine)).toEqual({
      key: second,
      rotation: 0,
      x: SPAWN_X[second],
      y: SPAWN_Y[second] + 1,
    })

    engine.tick(input({ hold: true }))
    expect(activePiece(engine).key).toBe(second)

    engine.tick(input({ hardDrop: true }))
    expect(activePiece(engine).key).toBe(third)
    engine.tick(input({ hold: true }))
    expect(engine.readout.hold).toBe(third)
    expect(activePiece(engine).key).toBe(first)
    expect(activePiece(engine).rotation).toBe(0)
  })
})

describe("the end of a game", () => {
  it("ends by block out when the stack reaches the spawn rows", () => {
    const engine = newGame(1)
    let placements = 0
    while (engine.readout.phase === "playing" && placements < 200) {
      // Packing leftmost builds a tower under the spawn column…
      const placements_ = engine.legalPlacements()
      engine.applyPlacement(
        placements_.reduce((a, b) =>
          b.x < a.x || (b.x === a.x && b.y > a.y) ? b : a
        )
      )
      placements += 1
    }
    // …which ends the game on the lock that spawns into it, not after a wait.
    expect(engine.readout.phase).toBe("over")
    expect(placements).toBe(13)
    expect(engine.active).toBeNull()
  })

  it("ends by lock out when a piece cannot leave the hidden rows", () => {
    // A one-row well: the first piece fills the only visible row under the
    // spawn column, so the next piece spawns clear but can never descend.
    const engine = gameWith("I", { visibleRows: 1 })
    engine.tick(input({ hardDrop: true }))
    expect(engine.readout.phase).toBe("playing")

    for (let i = 0; i < DEFAULT_CONFIG.lockDelayTicks - 1; i++) {
      engine.tick(NO_INTENT)
      expect(engine.readout.phase).toBe("playing")
    }
    engine.tick(NO_INTENT)
    expect(engine.readout.phase).toBe("over")
  })

  it("stops ticking once it is over, and starts over from the same pieces", () => {
    const engine = newGame(1, { visibleRows: 1 })
    engine.tick(input({ hardDrop: true }))
    for (let i = 0; i < 40; i++) engine.tick(NO_INTENT)
    expect(engine.readout.phase).toBe("over")
    const over = engine.observe()

    for (let i = 0; i < 10; i++) engine.tick(input({ hardDrop: true }))
    expect(engine.observe()).toEqual(over)

    engine.start()
    expect(engine.readout).toMatchObject({
      phase: "playing",
      score: 0,
      lines: 0,
    })
    expect(engine.ticks).toBe(0)
    // The same seed deals the same opening piece again.
    expect(activePiece(engine).key).toBe(activePiece(newGame(1)).key)
  })
})

describe("legalPlacements and applyPlacement", () => {
  it("enumerates each landing once, at rest below the current row", () => {
    const engine = gameWith("T")
    const piece = activePiece(engine)
    const placements = engine.legalPlacements()
    expect([...new Set(placements.map((p) => p.rotation))].sort()).toEqual([
      0, 1, 2, 3,
    ])

    const seen = new Set(
      placements.map((p) =>
        pieceCells(piece.key, p.rotation, p.x, p.y)
          .map((cell) => cell.join(","))
          .sort()
          .join("|")
      )
    )
    expect(seen.size).toBe(placements.length)
    for (const placement of placements) {
      expect(placement.y).toBeGreaterThanOrEqual(piece.y)
      expect(placement.x).toBeGreaterThanOrEqual(0)
      expect(placement.x).toBeLessThan(DEFAULT_CONFIG.columns)
    }
  })

  it("locks the piece exactly where a hard drop would have", () => {
    const engine = newGame(1)
    const from = activePiece(engine)
    engine.applyPlacement({
      rotation: from.rotation,
      x: from.x,
      y: engine.ghostY!,
    })
    const dropped = newGame(1)
    dropped.tick(input({ hardDrop: true }))
    expect(engine.observe().board).toEqual(dropped.observe().board)
    expect(engine.readout.score).toBe(dropped.readout.score)
  })

  it("lands a rotated placement exactly as a scripted rotation, shift and hard drop do", () => {
    for (const key of ["I", "J", "L", "S", "T", "Z"] as PieceKey[]) {
      const engine = gameWith(key)
      const piece = activePiece(engine)
      const target = engine
        .legalPlacements()
        .find((p) => p.rotation === 1 && p.x !== piece.x)!
      engine.applyPlacement(target)

      // The same destination driven by the Controller's vocabulary: rotate once
      // (no kick at spawn), shift a column at a time, hard-drop.
      const scripted = gameWith(key)
      scripted.tick(input({ rotateCW: true }))
      const direction = target.x > piece.x ? "right" : "left"
      while (activePiece(scripted).x !== target.x) {
        scripted.tick(input({ [direction]: true }))
        scripted.tick(NO_INTENT)
      }
      scripted.tick(input({ hardDrop: true }))

      expect(engine.observe().board).toEqual(scripted.observe().board)
      expect(engine.readout.score).toBe(scripted.readout.score)
    }
  })

  it("enumerates only destinations reachable by shifting and rotating in place", () => {
    // The documented ceiling (ADR 0006): a landing a wall kick alone reaches is
    // not enumerated, and neither is a column the piece cannot slide to.
    for (const seed of [1, 2, 3, 5, 8, 13]) {
      const engine = newGame(seed)
      for (let i = 0; i < 150 && engine.readout.phase === "playing"; i++) {
        for (const placement of engine.legalPlacements()) {
          expect(reachableWithoutKick(engine, placement)).toBe(true)
        }
        engine.tick(
          input({
            left: i % 3 === 0,
            right: i % 5 === 0,
            down: i % 2 === 0,
            rotateCW: i % 7 === 0,
            hardDrop: i % 11 === 0,
            hold: i % 13 === 0,
          })
        )
      }
    }
  })

  it("excludes the landing a settled T can only reach by a wall kick", () => {
    // Rotating a T on the floor is refused; the Engine kicks it up and to the
    // side. That kicked destination is not among the Placements, which are
    // plain drops at the piece's own row.
    const engine = gameWith("T")
    settle(engine)

    const kicked = gameWith("T")
    settle(kicked)
    kicked.tick(input({ rotateCW: true }))
    expect(activePiece(kicked)).toMatchObject({ rotation: 1, x: 2, y: 19 })

    expect(
      engine.legalPlacements().some((p) => p.rotation === 1 && p.x === 2)
    ).toBe(false)
  })
})

describe("the Observation", () => {
  it("returns the visible well, active piece, queue, hold and counters", () => {
    const engine = gameWith("T")
    const observation = engine.observe()
    expect(observation).toMatchObject({
      phase: "playing",
      score: 0,
      lines: 0,
      level: 1,
      tick: 0,
      combo: -1,
      backToBack: false,
      hold: null,
    })
    expect(observation.next).toEqual(engine.readout.next)
    expect(observation.next).toHaveLength(DEFAULT_CONFIG.previewCount)
    expect(observation.board).toHaveLength(DEFAULT_CONFIG.visibleRows)
    expect(
      observation.board.every((row) => row.length === DEFAULT_CONFIG.columns)
    ).toBe(true)
    expect(
      observation.board.every((row) => row.every((cell) => cell === null))
    ).toBe(true)
    expect(observation.active).toEqual({
      key: "T",
      rotation: 0,
      x: SPAWN_X.T,
      y: SPAWN_Y.T + 1 - DEFAULT_CONFIG.bufferRows,
    })
    expect(observation.ghostY).toBe(engine.ghostY! - DEFAULT_CONFIG.bufferRows)
  })

  it("carries the held piece and the progress counters as they move", () => {
    const engine = newGame(1)
    engine.tick(input({ hold: true }))
    expect(engine.observe().hold).toBe(engine.readout.hold)
    expect(engine.observe().hold).not.toBeNull()

    engine.tick(input({ hardDrop: true }))
    expect(engine.observe().score).toBeGreaterThan(0)
    expect(engine.observe().tick).toBe(2)
  })

  it("keeps React, pixi and three out of the Engine's sources", () => {
    // The read surface is plain data in a headless module (this file's node
    // environment): a renderer or React sneaking in would break that contract.
    // Pixi and three are also guarded from the page by the eager-graph walk.
    const renderers = ["react", "react-dom", "pixi.js", "three"]
    const dir = resolve(__dirname, "../../../lib/tetris")
    const offenders = readdirSync(dir)
      .filter((name) => name.endsWith(".ts"))
      .flatMap((name) => {
        const source = readFileSync(join(dir, name), "utf8")
        return [
          ...source.matchAll(
            /^\s*import\s+(?!type\s)(?:[^"']*?from\s+)?["']([^"']+)["']/gm
          ),
        ]
          .map((match) => match[1])
          .filter((specifier) =>
            renderers.some(
              (pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`)
            )
          )
          .map((specifier) => `lib/tetris/${name} imports ${specifier}`)
      })
    expect(offenders).toEqual([])
  })
})

describe("the Readout", () => {
  it("republishes only when a field changes, and notifies subscribers", () => {
    const engine = newGame(1)
    const first = engine.readout
    const seen: number[] = []
    const off = engine.subscribe(() => seen.push(engine.ticks))

    for (let i = 0; i < 5; i++) engine.tick(NO_INTENT)
    expect(engine.readout).toBe(first)
    expect(seen).toEqual([])

    engine.tick(input({ hardDrop: true }))
    expect(engine.readout).not.toBe(first)
    expect(seen).toEqual([6])

    off()
    engine.tick(input({ hardDrop: true }))
    expect(seen).toEqual([6])
  })

  it("publishes a Ready game before the first Tick, and JSON snapshots", () => {
    const engine = createEngine({ seed: 1 })
    expect(engine.readout.phase).toBe("ready")
    const observation = engine.observe()
    expect(JSON.parse(JSON.stringify(observation))).toEqual(observation)
  })
})

describe("replayability", () => {
  const log: Intent[] = Array.from({ length: 600 }, (_, i) =>
    input({
      left: i % 13 === 0,
      right: i % 17 === 0,
      down: i % 3 === 0,
      rotateCW: i % 7 === 0,
      rotateCCW: i % 23 === 0,
      hardDrop: i % 29 === 0,
      hold: i % 31 === 0,
    })
  )

  const play = (seed: number) => {
    const engine = newGame(seed)
    for (const intent of log) engine.tick(intent)
    return engine
  }

  it("replays a game exactly from its seed and input log", () => {
    const a = play(1234)
    const b = play(1234)
    expect(a.observe()).toEqual(b.observe())
    expect(a.ticks).toBeGreaterThan(0)
    // The board is the live array; the observation is a copy of it.
    expect(a.observe().board).not.toBe(a.board)
    expect(play(4321).observe()).not.toEqual(a.observe())
  })

  it("keeps every piece inside the well, kicks included", () => {
    // The matrix is the well plus its two buffer rows and there is nothing above
    // them, so a rotation that would kick a cell out of the top is refused
    // rather than granted and then dropped when the piece locks.
    for (let seed = 1; seed <= 12; seed++) {
      const engine = newGame(seed)
      for (const intent of log) {
        engine.tick(intent)
        const piece = engine.active
        if (piece === null) continue
        for (const [x, y] of pieceCells(
          piece.key,
          piece.rotation,
          piece.x,
          piece.y
        )) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThan(DEFAULT_CONFIG.columns)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThan(
            DEFAULT_CONFIG.visibleRows + DEFAULT_CONFIG.bufferRows
          )
        }
      }
    }
  })

  it("keeps the same bag order across a restart", () => {
    const engine = newGame(1)
    const opening = engine.readout.next
    const first = activePiece(engine).key
    engine.tick(input({ hardDrop: true }))
    engine.start()
    expect(engine.readout.next).toEqual(opening)
    expect(activePiece(engine).key).toBe(first)
  })
})
