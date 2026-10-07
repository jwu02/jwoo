// The Autopilot: the machine that plays, as a Controller (ADR 0006).
//
// It wraps the human composition and hides it when on. The inner Controllers go
// on absorbing keys and gestures — nothing accumulates in them while the machine
// drives — but their intents are not consumed, and the Engine sees only what a
// private base Controller emits on the machine's behalf. Those are the same
// Intents a pair of hands emits, so the rules, DAS and lock delay are the
// Engine's own and nothing underneath changes.
//
// Judging and driving are separate concerns. A Judge is handed an Observation
// and the legal Placements and answers with the one to play and the Margin it
// won by; the Autopilot turns that into a Plan — the piece, its rotation and its
// column — and realizes it target-relatively: each Tick it re-derives the
// rotation and shift still owed from where the piece stands and taps them out,
// hard-dropping on the Tick both reach zero. A pause is interpolated, never
// invalidated: only the board a Plan was judged on can void one.
//
// At most one judgment is in flight, and the Judge may answer asynchronously —
// the model behind one Judge lives off the main thread. Acceptance is the only
// validation point: if the world moved under the answer — the generation bumped,
// the game stopped playing, a different piece took the board, the board is no
// longer the judged one — it is discarded and the next sighting fires fresh.

import { createController, type Controller } from "./controller"
import type { ActivePiece, Engine, Observation, Placement } from "./engine"
import type { PieceKey } from "./pieces"

/** The Judge's answer: which Placement won, and by how much. */
export interface Judgment {
  /** Index into the Placements the Judge was given. */
  index: number
  /** The gap between the top two probabilities — recorded, acted on by nothing. */
  margin: number
}

/**
 * The decision-maker over Placements: an Observation and the legal Placements
 * in, the one to play and the Margin it won by out. A model, a heuristic or dice
 * all sit behind this seam; the Autopilot is judge-agnostic.
 */
export interface Judge {
  judge(
    observation: Observation,
    placements: readonly Placement[]
  ): Judgment | Promise<Judgment>
}

/**
 * Argmax over a candidate's scores: the highest wins, an exact tie goes to the
 * first candidate in the order given — so the same board judged twice is the
 * same game — and the Margin is the gap to the runner-up.
 */
export function argmax(scores: readonly number[]): Judgment {
  let index = 0
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[index]) index = i
  }
  let runnerUp = -Infinity
  for (let i = 0; i < scores.length; i++) {
    if (i !== index && scores[i] > runnerUp) runnerUp = scores[i]
  }
  return {
    index,
    margin: runnerUp === -Infinity ? 0 : scores[index] - runnerUp,
  }
}

/** The Autopilot: a Controller the cabinet toggles, plus the Margin it last decided by. */
export interface Autopilot extends Controller {
  /** Whether the machine is driving — the toggle reads it; nothing else does. */
  readonly enabled: boolean
  /** The Margin of the last accepted judgment, or null before the first. */
  readonly margin: number | null
  /** Hand the game to the machine, or take it back. Either way, a fresh start. */
  setEnabled(on: boolean): void
}

export interface AutopilotOptions {
  /** The read surface the Judge consumes and the board a judgment is checked against. */
  engine: Engine
  judge: Judge
}

/** What a judgment was made of, so it can be checked against the world later. */
interface Sighting {
  generation: number
  piece: PieceKey
  board: Observation["board"]
  placements: readonly Placement[]
}

/** Where the active piece is going: judged for this board, this rotation, this column. */
interface Plan {
  piece: PieceKey
  board: Observation["board"]
  placement: Placement
}

export function createAutopilot(
  controller: Controller,
  { engine, judge }: AutopilotOptions
): Autopilot {
  const machine = createController()
  let enabled = false
  let generation = 0
  let pending: Sighting | null = null
  let plan: Plan | null = null
  let margin: number | null = null
  // Whether a column of walk may be paid this Tick: two Ticks of one direction
  // read to the Engine as a held key and start DAS, so the Tick between two
  // taps is what keeps every tap a fresh press (touch.ts gates a drag the same
  // way). Rotations have no such memory and are paid on any Tick.
  let shiftArmed = true

  /** The world every judgment was made against is gone: nothing outlives it. */
  function restart() {
    generation += 1
    pending = null
    plan = null
    shiftArmed = true
    machine.reset()
  }

  /** Whether the Observation is a game still being played, with a piece to play. */
  function playing(
    observation: Observation
  ): observation is Observation & { active: ActivePiece } {
    return observation.phase === "playing" && observation.active !== null
  }

  /** Whether the piece a judgment was made for is still the live one, on the judged board. */
  function alive(
    observation: Observation,
    piece: PieceKey,
    board: Observation["board"]
  ): boolean {
    return (
      playing(observation) &&
      observation.active.key === piece &&
      sameBoard(observation.board, board)
    )
  }

  /** The world moved, or it did not: a deep compare of the well, cell by cell. */
  function sameBoard(
    live: Observation["board"],
    judged: Observation["board"]
  ): boolean {
    if (live.length !== judged.length) return false
    for (let y = 0; y < live.length; y++) {
      if (live[y].length !== judged[y].length) return false
      for (let x = 0; x < live[y].length; x++) {
        if (live[y][x] !== judged[y][x]) return false
      }
    }
    return true
  }

  function judgeOnce(observation: Observation, piece: PieceKey) {
    const placements = engine.legalPlacements()
    if (placements.length === 0) return
    const sighting: Sighting = {
      generation,
      piece,
      board: observation.board,
      placements,
    }
    pending = sighting
    const answer = judge.judge(observation, placements)
    // Fire and forget: an answer that arrives after its sighting was voided is
    // dropped on identity, so a stale one can never land on a newer piece.
    if (answer instanceof Promise)
      answer.then((result) => accept(sighting, result))
    else accept(sighting, answer)
  }

  function accept(sighting: Sighting, answer: Judgment) {
    if (pending !== sighting) return
    pending = null
    if (sighting.generation !== generation) return
    const placement = sighting.placements[answer.index]
    if (placement === undefined) return
    if (!alive(engine.observe(), sighting.piece, sighting.board)) return
    margin = answer.margin
    plan = { piece: sighting.piece, board: sighting.board, placement }
    shiftArmed = true
  }

  /**
   * One Tick of a Plan: at most one rotation and one column of walk, with the
   * hard drop on the Tick both reach their destination. Every step is derived
   * from where the piece stands *now*, so a pause, a gravity row or a wall kick
   * changes how long the trip takes and nothing about where it ends.
   *
   * Two ceilings. A column the landed piece can no longer be shifted out of
   * stalls the trip until the lock takes it — the plan dies with the board, at
   * the board's own pace. And the Engine rotates before it shifts, so a kick on
   * the final Tick's rotation can carry the piece a column past the shift
   * written from the pre-kick position: the drop lands where the Engine put it,
   * and the two agree whenever the rotation the enumeration promised is still
   * un-kicked — which it is until the stack climbs into the piece's own row.
   */
  function drive(placement: Placement, active: ActivePiece) {
    // O has one state, so a rotation would leave the deltas standing still.
    let turn =
      active.key === "O" ? 0 : (placement.rotation - active.rotation + 4) % 4
    if (turn === 3) turn = -1 // the shorter way round
    const shift = placement.x - active.x

    const rotate = Math.sign(turn)
    const step = shiftArmed ? Math.sign(shift) : 0
    shiftArmed = step === 0

    if (rotate > 0) machine.press("rotateCW")
    if (rotate < 0) machine.press("rotateCCW")
    if (step !== 0) {
      // A tap-pair: down and up inside the Tick, so the Engine reads one Tick of
      // the direction — and a quiet Tick before the next tap keeps it an edge
      // rather than a hold.
      const direction = step < 0 ? "left" : "right"
      machine.setDirection(direction, true)
      machine.setDirection(direction, false)
    }
    // This Tick's play finishes both: land it now, on the Tick of the last
    // rotation and the last shift together.
    if (turn - rotate === 0 && shift - step === 0) machine.press("hardDrop")
  }

  return {
    get enabled() {
      return enabled
    },
    get margin() {
      return margin
    },

    setEnabled(on) {
      if (on === enabled) return
      enabled = on
      restart()
    },

    setDirection(direction, held) {
      controller.setDirection(direction, held)
    },

    press(action) {
      controller.press(action)
    },

    nextIntent() {
      if (!enabled) return controller.nextIntent()

      // The human layer keeps taking its own input — held flags stay physically
      // true and queued taps are consumed here — but none of it reaches the
      // Engine while the machine drives.
      controller.nextIntent()

      const observation = engine.observe()
      if (!playing(observation)) {
        // A game that ended, or a fresh one about to: the world these were
        // judged against is gone.
        if (plan !== null || pending !== null) restart()
        return machine.nextIntent()
      }

      if (plan !== null && !alive(observation, plan.piece, plan.board)) {
        plan = null
      }
      if (plan !== null) {
        drive(plan.placement, observation.active)
      } else if (pending === null) {
        // One decision per sighting, on first sight with no plan. While a
        // judgment is in flight the piece falls under gravity, untouched.
        judgeOnce(observation, observation.active.key)
      }
      return machine.nextIntent()
    },

    reset() {
      restart()
      controller.reset()
    },
  }
}
