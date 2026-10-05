// The play a Controller feeds the Engine, one intent per Tick (ADR 0006).
//
// Held directions and one-shot actions are separate on purpose: DAS, ARR and
// soft-drop speed are game behaviour the Engine models from the held flags, so
// a new input device — a touch layer today, an AI later — is a swap of this
// small object, not a change to the Engine.

export interface Intent {
  left: boolean
  right: boolean
  down: boolean
  rotateCW: boolean
  rotateCCW: boolean
  hardDrop: boolean
  hold: boolean
}

export const NO_INTENT: Intent = {
  left: false,
  right: false,
  down: false,
  rotateCW: false,
  rotateCCW: false,
  hardDrop: false,
  hold: false,
}

export type Direction = "left" | "right" | "down"
export type Action = "rotateCW" | "rotateCCW" | "hardDrop" | "hold"

export interface Controller {
  /** Hold or release a direction, from a key's down and up. */
  setDirection(direction: Direction, held: boolean): void
  /** Queue a one-shot action, to be paid on the next Tick. */
  press(action: Action): void
  /** The intent for one Tick, consuming what has been queued. */
  nextIntent(): Intent
  /** Forget everything held or queued — for focus loss, pause, and a new game. */
  reset(): void
}

/**
 * A keyboard-shaped Controller.
 *
 * A direction key that goes down and up between two Ticks still counts: the
 * press is remembered until the Tick that consumes it, so a fast tap cannot
 * fall between frames. The Engine sees it as one Tick of that direction held,
 * which is exactly the shift the tap asked for.
 */
export function createController(): Controller {
  const held: Record<Direction, boolean> = {
    left: false,
    right: false,
    down: false,
  }
  const tapped: Record<"left" | "right", boolean> = {
    left: false,
    right: false,
  }
  const queued: Record<Action, boolean> = {
    rotateCW: false,
    rotateCCW: false,
    hardDrop: false,
    hold: false,
  }

  return {
    setDirection(direction, isHeld) {
      held[direction] = isHeld
      if (isHeld && direction !== "down") tapped[direction] = true
    },
    press(action) {
      queued[action] = true
    },
    nextIntent() {
      const intent: Intent = {
        left: held.left || tapped.left,
        right: held.right || tapped.right,
        down: held.down,
        rotateCW: queued.rotateCW,
        rotateCCW: queued.rotateCCW,
        hardDrop: queued.hardDrop,
        hold: queued.hold,
      }
      tapped.left = false
      tapped.right = false
      queued.rotateCW = false
      queued.rotateCCW = false
      queued.hardDrop = false
      queued.hold = false
      return intent
    },
    reset() {
      held.left = false
      held.right = false
      held.down = false
      tapped.left = false
      tapped.right = false
      queued.rotateCW = false
      queued.rotateCCW = false
      queued.hardDrop = false
      queued.hold = false
    },
  }
}
