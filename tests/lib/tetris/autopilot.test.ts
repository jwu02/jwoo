/**
 * @jest-environment node
 */
import {
  argmax,
  createAutopilot,
  type Autopilot,
  type Judge,
  type Judgment,
} from "@/lib/tetris/autopilot"
import {
  createController,
  NO_INTENT,
  type Intent,
} from "@/lib/tetris/controller"
import { DEFAULT_CONFIG, type TetrisConfig } from "@/lib/tetris/config"
import {
  createEngine,
  type Engine,
  type Observation,
  type Placement,
} from "@/lib/tetris/engine"
import { pieceCells, type PieceKey } from "@/lib/tetris/pieces"

/**
 * A game whose pieces are down in seconds of Ticks rather than minutes, so the
 * tests that need locks, line clears and a top-out get them without simulating
 * a level-1 marathon.
 */
const FAST: Partial<TetrisConfig> = {
  tickHz: 5,
  lockDelayTicks: 3,
}

interface Run {
  intents: Intent[]
  /** The active piece the Engine held while each Intent was emitted. */
  pieces: (PieceKey | null)[]
}

/** Drive the Engine through the Autopilot's own intents, as the cabinet does. */
function play(
  engine: Engine,
  autopilot: Autopilot,
  until: (run: Run) => boolean,
  cap = 20000
): Run {
  const run: Run = { intents: [], pieces: [] }
  while (run.intents.length < cap && !until(run)) {
    run.pieces.push(engine.active?.key ?? null)
    const intent = autopilot.nextIntent()
    run.intents.push(intent)
    engine.tick(intent)
  }
  return run
}

/** The Autopilot over the human composition, as the cabinet mounts it. */
function compose(engine: Engine, judge: Judge): Autopilot {
  return createAutopilot(createController(), { engine, judge })
}

function setUp({
  judge,
  config,
  seed = 1,
}: {
  judge: Judge
  config?: Partial<TetrisConfig>
  seed?: number
}) {
  const engine = createEngine({ seed, config })
  return { engine, autopilot: compose(engine, judge) }
}

interface ManualJudge {
  judge: Judge
  /** Every sighting the Autopilot fired, in order. */
  calls: { observation: Observation; placements: readonly Placement[] }[]
  /** Hand back the answer to the oldest outstanding call. */
  answer(index: number, margin?: number): void
  outstanding(): number
}

/** A Judge that thinks for exactly as long as the test wants it to. */
function manualJudge(): ManualJudge {
  const calls: ManualJudge["calls"] = []
  const answers: ((judgment: Judgment) => void)[] = []
  return {
    judge: {
      judge(observation, placements) {
        calls.push({ observation, placements })
        return new Promise<Judgment>((resolve) => answers.push(resolve))
      },
    },
    calls,
    answer(index, margin = 0) {
      const resolve = answers.shift()
      if (resolve === undefined) throw new Error("no judgment outstanding")
      resolve({ index, margin })
    },
    outstanding: () => answers.length,
  }
}

/** The Judge a test scripts: argmax over the score it gives each Placement. */
function picking(
  score: (placement: Placement, observation: Observation) => number
) {
  const chosen: Placement[] = []
  const judge: Judge = {
    judge(observation, placements) {
      const judgment = argmax(placements.map((p) => score(p, observation)))
      chosen.push(placements[judgment.index])
      return judgment
    },
  }
  return { judge, chosen }
}

/** The rotation steps a Plan would spend to reach this Placement, the short way. */
function turn(placement: Placement, active: Observation["active"]): number {
  return (placement.rotation - active!.rotation + 4) % 4
}

describe("argmax", () => {
  it("takes the highest score, with its gap to the runner-up as the Margin", () => {
    expect(argmax([0.25, 0.75, 0.5])).toEqual({ index: 1, margin: 0.25 })
  })

  it("breaks an exact tie to the first candidate in the order given", () => {
    expect(argmax([0.5, 0.5, 0.2])).toEqual({ index: 0, margin: 0 })
    expect(argmax([1, 1, 1])).toEqual({ index: 0, margin: 0 })
  })

  it("has no gap to report when there is no runner-up", () => {
    expect(argmax([0.9])).toEqual({ index: 0, margin: 0 })
  })
})

describe("the Autopilot", () => {
  it("is off by default and a pure pass-through", () => {
    const { engine, autopilot } = setUp({
      judge: { judge: () => ({ index: 0, margin: 0 }) },
    })
    engine.start()
    expect(autopilot.enabled).toBe(false)

    // Human input reaches the Engine exactly as the plain Controller's would.
    autopilot.setDirection("left", true)
    expect(autopilot.nextIntent()).toEqual({ ...NO_INTENT, left: true })
    autopilot.press("rotateCW")
    autopilot.press("hardDrop")
    expect(autopilot.nextIntent()).toEqual({
      ...NO_INTENT,
      left: true,
      rotateCW: true,
      hardDrop: true,
    })
    autopilot.reset()
    expect(autopilot.nextIntent()).toEqual(NO_INTENT)
  })

  it("judges nothing while off", () => {
    const manual = manualJudge()
    const { engine, autopilot } = setUp({ judge: manual.judge, config: FAST })
    engine.start()
    play(engine, autopilot, () => false, 200)
    expect(manual.calls).toHaveLength(0)
    expect(autopilot.margin).toBeNull()
  })

  it("decides once per sighting, never twice outstanding, and falls while it waits", async () => {
    const manual = manualJudge()
    const { engine, autopilot } = setUp({ judge: manual.judge })
    engine.start()
    autopilot.setEnabled(true)

    // The first sighting fires one judgment and nothing else.
    expect(autopilot.nextIntent()).toEqual(NO_INTENT)
    expect(manual.calls).toHaveLength(1)
    const spawnedY = engine.observe().active!.y

    // While the Judge thinks, the piece is gravity's: no machine intent, no
    // second judgment, no held flags of its own.
    for (let i = 0; i < 60; i++) {
      expect(autopilot.nextIntent()).toEqual(NO_INTENT)
      engine.tick(NO_INTENT)
    }
    expect(manual.calls).toHaveLength(1)
    expect(engine.observe().active!.y).toBeGreaterThan(spawnedY)

    // …and accepting the answer turns it into play for that piece.
    manual.answer(0, 0.25)
    await Promise.resolve()
    expect(autopilot.margin).toBe(0.25)
    expect(autopilot.nextIntent()).not.toEqual(NO_INTENT)
  })

  it("takes an exact tie to the first Placement in the order given", () => {
    const first: Placement[] = []
    const judge: Judge = {
      judge(observation, placements) {
        first.push(placements[0])
        return argmax(placements.map(() => 1))
      },
    }
    const { engine, autopilot } = setUp({ judge })
    engine.start()
    autopilot.setEnabled(true)

    const run = play(engine, autopilot, (run) =>
      run.intents.some((i) => i.hardDrop)
    )
    expect(autopilot.margin).toBe(0)
    const key = run.pieces[0]!
    const landed = pieceCells(key, first[0].rotation, first[0].x, first[0].y)
    expect(engine.board.flat().filter((cell) => cell !== null)).toHaveLength(
      landed.length
    )
    for (const [x, y] of landed) expect(engine.board[y][x]).toBe(key)
  })

  it("carries the turn, the shift and the hard drop on one Tick", () => {
    // One rotation step and one column of walk from where the piece stands: the
    // whole trip fits a single Tick, and that Tick carries all three.
    const scripted = picking((placement, observation) => {
      const active = observation.active!
      return turn(placement, active) === 1 && placement.x - active.x === 1
        ? 1
        : 0
    })
    const { engine, autopilot } = setUp({ judge: scripted.judge })
    engine.start()
    autopilot.setEnabled(true)
    const key = engine.active!.key

    const run = play(engine, autopilot, (run) =>
      run.intents.some((i) => i.hardDrop)
    )
    const drop = run.intents[run.intents.length - 1]
    expect(drop).toMatchObject({ rotateCW: true, right: true, hardDrop: true })
    expect(run.intents).toHaveLength(2) // the sighting's own Tick, then the trip

    const placement = scripted.chosen[0]
    const landed = pieceCells(key, placement.rotation, placement.x, placement.y)
    expect(engine.board.flat().filter((cell) => cell !== null)).toHaveLength(
      landed.length
    )
    for (const [x, y] of landed) expect(engine.board[y][x]).toBe(key)
  })

  it("walks a column at a time, never two Ticks running the Engine could read as a hold", () => {
    // The longest walk the enumeration offers.
    const scripted = picking((placement, observation) =>
      Math.abs(placement.x - observation.active!.x)
    )
    const { engine, autopilot } = setUp({ judge: scripted.judge })
    engine.start()
    autopilot.setEnabled(true)
    const key = engine.active!.key

    // The column the piece stands in, Tick by Tick, until it is dropped.
    const columns: number[] = []
    while (engine.observe().active !== null) {
      columns.push(engine.observe().active!.x)
      const intent = autopilot.nextIntent()
      engine.tick(intent)
      if (intent.hardDrop) break
    }
    const placement = scripted.chosen[0]
    const steps = columns.slice(1).map((x, i) => x - columns[i])
    expect(steps.filter((step) => step !== 0).length).toBeGreaterThan(2)
    // Every shift is a fresh press: two Ticks running in one direction would be
    // a held key, and would start DAS instead of paying one column a tap.
    expect(steps.some((step) => step !== 0 && step !== 1)).toBe(false)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i] === 0 || steps[i - 1] === 0).toBe(true)
    }
    // One column is all a tap-pair pays before the last one, which lands it.
    expect(Math.abs(placement.x - columns[columns.length - 1])).toBe(1)
    for (const [x, y] of pieceCells(
      key,
      placement.rotation,
      placement.x,
      placement.y
    )) {
      expect(engine.board[y][x]).toBe(key)
    }
  })

  it("turns the shorter way round", () => {
    const scripted = picking((placement, observation) => {
      const active = observation.active!
      return turn(placement, active) === 3 && placement.x === active.x ? 1 : 0
    })
    const { engine, autopilot } = setUp({ judge: scripted.judge })
    engine.start()
    autopilot.setEnabled(true)

    const run = play(engine, autopilot, (run) =>
      run.intents.some((i) => i.hardDrop)
    )
    expect(run.intents.some((intent) => intent.rotateCCW)).toBe(true)
    expect(run.intents.some((intent) => intent.rotateCW)).toBe(false)
  })

  it("finishes the worst case plan well inside the lock delay", () => {
    // The longest trip the enumeration can ask for: as far across the well as it
    // offers, with a turn on top of it.
    const scripted = picking((placement, observation) => {
      const active = observation.active!
      const wanted = turn(placement, active) !== 0 && placement.x !== active.x
      return wanted ? Math.abs(placement.x - active.x) : -1
    })
    const { engine, autopilot } = setUp({ judge: scripted.judge })
    engine.start()
    autopilot.setEnabled(true)
    const from = engine.active!.x

    const run = play(engine, autopilot, (run) =>
      run.intents.some((i) => i.hardDrop)
    )
    const placement = scripted.chosen[0]
    const walk = Math.abs(placement.x - from)
    const spent = run.intents.length - 1 // the sighting's own Tick drove nothing
    expect(spent).toBeLessThanOrEqual(walk * 2 + 2)
    expect(spent).toBeLessThan(DEFAULT_CONFIG.lockDelayTicks)
    const key = run.pieces[0]!
    for (const [x, y] of pieceCells(
      key,
      placement.rotation,
      placement.x,
      placement.y
    )) {
      expect(engine.board[y][x]).toBe(key)
    }
  })

  it("drives a complete game, judged once per piece, with no hold and no soft drop", () => {
    const calls: {
      observation: Observation
      placements: readonly Placement[]
    }[] = []
    const judge: Judge = {
      judge(observation, placements) {
        calls.push({ observation, placements })
        return argmax(placements.map((placement) => -placement.y))
      },
    }
    const { engine, autopilot } = setUp({ judge, config: FAST })
    engine.start()
    autopilot.setEnabled(true)

    const run = play(engine, autopilot, () => engine.readout.phase === "over")
    expect(engine.readout.phase).toBe("over")

    const drops = run.intents.filter((intent) => intent.hardDrop).length
    expect(drops).toBeGreaterThan(4)
    expect(calls.length).toBeGreaterThanOrEqual(drops)

    // One judgment per piece: no two sightings were the same piece on the same board.
    for (let i = 1; i < calls.length; i++) {
      const samePiece =
        calls[i - 1].observation.active!.key ===
        calls[i].observation.active!.key
      const sameBoard =
        JSON.stringify(calls[i - 1].observation.board) ===
        JSON.stringify(calls[i].observation.board)
      expect(samePiece && sameBoard).toBe(false)
    }

    // No hold, no soft drop, and no Tick spent rotating an O — which cannot come
    // up, because the enumeration offers O only the one state it is already in.
    expect(run.intents.some((intent) => intent.hold || intent.down)).toBe(false)
    expect(
      run.intents.some(
        (intent, i) =>
          (intent.rotateCW || intent.rotateCCW) && run.pieces[i] === "O"
      )
    ).toBe(false)
    const oPieces = calls.filter((call) => call.observation.active!.key === "O")
    expect(oPieces.length).toBeGreaterThan(0)
    for (const { observation, placements } of oPieces) {
      expect(
        placements.every((p) => p.rotation === observation.active!.rotation)
      ).toBe(true)
    }
  })

  it("discards a judgment whose piece died while the Judge thought", async () => {
    const manual = manualJudge()
    const { engine, autopilot } = setUp({ judge: manual.judge, config: FAST })
    engine.start()
    autopilot.setEnabled(true)
    autopilot.nextIntent()
    const judged = JSON.stringify(manual.calls[0].observation.board)

    // The judged piece falls and locks untouched; a successor takes the board.
    const empty = JSON.stringify(engine.board)
    play(engine, autopilot, () => JSON.stringify(engine.board) !== empty, 800)
    expect(JSON.stringify(engine.board)).not.toBe(empty)

    // The answer lands on a world that no longer exists: discarded, unrecorded.
    manual.answer(0, 0.42)
    await Promise.resolve()
    expect(autopilot.margin).toBeNull()

    // The next sighting fires fresh, and its answer is the one that counts.
    expect(autopilot.nextIntent()).toEqual(NO_INTENT)
    expect(manual.calls).toHaveLength(2)
    expect(JSON.stringify(manual.calls[1].observation.board)).not.toBe(judged)
    manual.answer(0, 0.1)
    await Promise.resolve()
    expect(autopilot.margin).toBe(0.1)
  })

  it("discards a judgment a same-key successor took the board from", async () => {
    const manual = manualJudge()
    const { engine, autopilot } = setUp({ judge: manual.judge, config: FAST })
    engine.start()
    autopilot.setEnabled(true)
    autopilot.nextIntent()
    const judged = manual.calls[0].observation
    const key = judged.active!.key
    const empty = JSON.stringify(engine.board)

    // The judged piece falls out of play, and the next piece of the same kind
    // spawns: only the board tells the two apart.
    play(
      engine,
      autopilot,
      () =>
        JSON.stringify(engine.board) !== empty && engine.active?.key === key,
      4000
    )
    expect(engine.active!.key).toBe(key)

    manual.answer(0, 0.42)
    await Promise.resolve()
    expect(autopilot.margin).toBeNull()
  })

  it("discards a judgment a new game invalidated", async () => {
    const manual = manualJudge()
    const { engine, autopilot } = setUp({ judge: manual.judge })
    engine.start()
    autopilot.setEnabled(true)
    autopilot.nextIntent()

    autopilot.reset()
    engine.start()
    manual.answer(0, 0.9)
    await Promise.resolve()
    expect(autopilot.margin).toBeNull()

    // The fresh game's own first sighting fires with the new generation.
    autopilot.nextIntent()
    expect(manual.calls).toHaveLength(2)
    expect(manual.calls[1].observation.tick).toBe(0)
  })

  it("discards a judgment that failed, and the next sighting fires fresh", async () => {
    let broken = true
    const judge: Judge = {
      judge(observation, placements) {
        // A dead worker: the seam's failure is a rejected judgment, not a hang.
        if (broken) return Promise.reject(new Error("the worker died"))
        return argmax(placements.map((placement) => -placement.y))
      },
    }
    const { engine, autopilot } = setUp({ judge, config: FAST })
    engine.start()
    autopilot.setEnabled(true)

    // The failure voids the sighting without leaving it outstanding — the piece
    // is gravity's, and the gate reopens.
    autopilot.nextIntent()
    await Promise.resolve()
    broken = false

    const run = play(engine, autopilot, (run) =>
      run.intents.some((intent) => intent.hardDrop)
    )
    expect(run.intents.some((intent) => intent.hardDrop)).toBe(true)
    expect(autopilot.margin).not.toBeNull()
  })

  it("voids its plan when it is switched off, and starts fresh when switched on", () => {
    // The farthest column: a plan with several Ticks of walking in it.
    const scripted = picking((placement, observation) =>
      Math.abs(placement.x - observation.active!.x)
    )
    const { engine, autopilot } = setUp({ judge: scripted.judge })
    engine.start()
    autopilot.setEnabled(true)

    play(engine, autopilot, () => scripted.chosen.length === 1)
    expect(autopilot.nextIntent()).not.toEqual(NO_INTENT) // one Tick of the plan
    expect(scripted.chosen).toHaveLength(1)

    autopilot.setEnabled(false)
    // Off, the human is back: their press passes straight through.
    autopilot.press("rotateCW")
    expect(autopilot.nextIntent()).toEqual({ ...NO_INTENT, rotateCW: true })

    // On again, the piece as it stands is a sighting of its own — judged fresh,
    // not the tail of the old plan.
    autopilot.setEnabled(true)
    expect(autopilot.nextIntent()).toEqual(NO_INTENT)
    expect(scripted.chosen).toHaveLength(2)
  })

  it("keeps a plan, and an answer still in flight, through a pause", async () => {
    const manual = manualJudge()
    const { engine, autopilot } = setUp({ judge: manual.judge })
    engine.start()
    autopilot.setEnabled(true)
    autopilot.nextIntent()

    // Paused before the Judge answered: the cabinet simply stops calling, so
    // the answer still counts when play resumes.
    const sighting = manual.calls[0]
    const far = sighting.placements.findIndex(
      (placement) => Math.abs(placement.x - sighting.observation.active!.x) >= 2
    )
    const placement = sighting.placements[far]
    const key = sighting.observation.active!.key
    manual.answer(far)
    await Promise.resolve()
    expect(autopilot.margin).toBe(0)
    expect(autopilot.nextIntent()).not.toEqual(NO_INTENT) // a Tick of the plan

    // Resumed after the pause, the same plan finishes where it was going.
    const run = play(engine, autopilot, (run) =>
      run.intents.some((i) => i.hardDrop)
    )
    expect(run.intents[run.intents.length - 1].hardDrop).toBe(true)
    expect(manual.calls).toHaveLength(1)
    expect(manual.outstanding()).toBe(0)
    for (const [x, y] of pieceCells(
      key,
      placement.rotation,
      placement.x,
      placement.y
    )) {
      expect(engine.board[y][x]).toBe(key)
    }
  })

  it("never lets the human's held flags into machine intents", () => {
    const manual = manualJudge()
    const { engine, autopilot } = setUp({ judge: manual.judge })
    engine.start()
    autopilot.setEnabled(true)
    autopilot.nextIntent()

    // The human fights the machine the whole time it thinks.
    autopilot.setDirection("left", true)
    autopilot.press("hold")
    for (let i = 0; i < 10; i++) {
      expect(autopilot.nextIntent()).toEqual(NO_INTENT)
      engine.tick(NO_INTENT)
    }

    // Hand-off: the physically held key is honoured at once, the stale queued
    // press is not.
    autopilot.setEnabled(false)
    expect(autopilot.nextIntent()).toEqual({ ...NO_INTENT, left: true })
  })
})
