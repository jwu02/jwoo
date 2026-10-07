/**
 * @jest-environment node
 */
import { createAutopilot } from "@/lib/tetris/autopilot"
import type { TetrisConfig } from "@/lib/tetris/config"
import { createController } from "@/lib/tetris/controller"
import {
  createEngine,
  type Observation,
  type Placement,
} from "@/lib/tetris/engine"
import {
  createKevalaJudge,
  type KevalaJudgeRequest,
  type KevalaRequest,
  type KevalaResponse,
} from "@/lib/tetris/kevala-judge"

/**
 * A game whose pieces are down in seconds of Ticks rather than minutes: the
 * whole-game test needs a top-out, not a marathon.
 */
const FAST: Partial<TetrisConfig> = { tickHz: 5, lockDelayTicks: 3 }

/** The Autopilot fires at most one judgment per Tick: let its answer land. */
const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const PLACEMENTS: Placement[] = [
  { rotation: 0, x: 2, y: 12 },
  { rotation: 1, x: 4, y: 10 },
  { rotation: 2, x: 6, y: 14 },
]

function observation(): Observation {
  const engine = createEngine({ seed: 1 })
  engine.start()
  return engine.observe()
}

/**
 * A Worker the test scripts: what it is posted, and what it answers. `answer`
 * runs synchronously inside postMessage, so a judgment resolves without a
 * browser, WebGPU or weights — the protocol is the seam, not the model.
 */
function workerDouble(
  answer?: (request: KevalaJudgeRequest) => KevalaResponse | null
) {
  const messages: ((event: { data: KevalaResponse }) => void)[] = []
  const deaths: (() => void)[] = []
  const posted: KevalaRequest[] = []
  let terminated = false

  const reply = (response: KevalaResponse) => {
    for (const listener of [...messages]) listener({ data: response })
  }

  const worker = {
    postMessage(request: KevalaRequest) {
      posted.push(request)
      if (request.type !== "judge") return
      const response = answer?.(request)
      if (response) reply(response)
    },
    addEventListener(type: string, listener: unknown) {
      if (type === "message")
        messages.push(listener as (event: { data: KevalaResponse }) => void)
      else if (type === "error" || type === "messageerror")
        deaths.push(listener as () => void)
    },
    removeEventListener(type: string, listener: unknown) {
      const registered: unknown[] = type === "message" ? messages : deaths
      const at = registered.indexOf(listener)
      if (at >= 0) registered.splice(at, 1)
    },
    terminate() {
      terminated = true
    },
  } as unknown as Worker

  return {
    worker,
    posted,
    reply,
    /** The worker the browser was never able to start, or one that crashed. */
    die() {
      for (const listener of [...deaths]) listener()
    },
    terminated: () => terminated,
  }
}

/** A session up and warm, with whatever the double answers. */
async function openSession(
  answer?: (request: KevalaJudgeRequest) => KevalaResponse | null
) {
  const double = workerDouble(answer)
  const session = createKevalaJudge(double.worker)
  const warm = session.warm()
  double.reply({ type: "ready" })
  await warm
  return { double, session }
}

/** A judgment that is expected to reject later, with its handler attached now. */
function rejecting(promise: Promise<unknown>, message: string) {
  return expect(promise).rejects.toThrow(message)
}

describe("the kevala judge client", () => {
  it("posts the Observation and its Placements, and answers with the argmax and Margin", async () => {
    const { double, session } = await openSession((request) => ({
      type: "scored",
      id: request.id,
      scores: [0.2, 0.7, 0.3],
    }))
    const sighting = observation()

    const judgment = await session.judge(sighting, PLACEMENTS)
    expect(judgment.index).toBe(1)
    expect(judgment.margin).toBeCloseTo(0.4)
    expect(double.posted).toEqual([
      { type: "load" },
      { type: "judge", id: 0, observation: sighting, placements: PLACEMENTS },
    ])
  })

  it("keeps an exact tie on the first candidate, the order it was given them in", async () => {
    const { session } = await openSession((request) => ({
      type: "scored",
      id: request.id,
      scores: [0.5, 0.5, 0.5],
    }))
    expect(await session.judge(observation(), PLACEMENTS)).toEqual({
      index: 0,
      margin: 0,
    })
  })

  it("holds a judgment until the session is warm, and loads once", async () => {
    const double = workerDouble((request) => ({
      type: "scored",
      id: request.id,
      scores: [0.1, 0.2, 0.3],
    }))
    const session = createKevalaJudge(double.worker)

    const judgment = session.judge(observation(), PLACEMENTS)
    await settle()
    // Nothing has been scored: the worker has only been told to load.
    expect(double.posted).toEqual([{ type: "load" }])

    double.reply({ type: "ready" })
    const scored = await judgment
    expect(scored.index).toBe(2)
    expect(scored.margin).toBeCloseTo(0.1)
    await session.warm()
    expect(double.posted.filter((r) => r.type === "load")).toHaveLength(1)
    expect(double.posted.filter((r) => r.type === "judge")).toHaveLength(1)
  })

  it("rejects the judgment the worker reported failed", async () => {
    const { double, session } = await openSession()
    const judgment = session.judge(observation(), PLACEMENTS)
    const failed = rejecting(judgment, "out of memory")
    await settle()
    const request = double.posted.at(-1) as KevalaJudgeRequest
    double.reply({ type: "failed", id: request.id, error: "out of memory" })
    await failed

    // One failed judgment leaves the session usable: the next one is scored.
    const next = session.judge(observation(), PLACEMENTS)
    await settle()
    const retry = double.posted.at(-1) as KevalaJudgeRequest
    double.reply({ type: "scored", id: retry.id, scores: [1, 0, 0] })
    await expect(next).resolves.toEqual({ index: 0, margin: 1 })
  })

  it("rejects the session and everything in it when the load fails, never hanging", async () => {
    const double = workerDouble()
    const session = createKevalaJudge(double.worker)
    const warm = session.warm()
    const judgment = session.judge(observation(), PLACEMENTS)
    const failed = rejecting(judgment, "no WebGPU adapter")
    await settle()
    double.reply({ type: "failed", error: "no WebGPU adapter" })

    await rejecting(warm, "no WebGPU adapter")
    await failed
    // A dead session answers at once rather than posting into the void.
    await rejecting(
      session.judge(observation(), PLACEMENTS),
      "no WebGPU adapter"
    )
    expect(double.posted.filter((r) => r.type === "judge")).toEqual([])
  })

  it("rejects what is outstanding when the worker itself dies", async () => {
    const double = workerDouble()
    const session = createKevalaJudge(double.worker)
    const warm = session.warm()
    const judgment = session.judge(observation(), PLACEMENTS)
    const failed = rejecting(judgment, "kevala worker failed")
    await settle()
    double.die()

    await rejecting(warm, "kevala worker failed")
    await failed
    await rejecting(
      session.judge(observation(), PLACEMENTS),
      "kevala worker failed"
    )
  })

  it("disposes the worker and rejects what it was still scoring", async () => {
    const { double, session } = await openSession()
    const judgment = session.judge(observation(), PLACEMENTS)
    const failed = rejecting(judgment, "closed")
    await settle()

    session.dispose()
    await failed
    expect(double.terminated()).toBe(true)
    await rejecting(session.judge(observation(), PLACEMENTS), "closed")
  })

  it("drives the Autopilot through the client, worker and Engine together", async () => {
    // A crude judge — the highest landing wins — with the scores produced on the
    // far side of the worker protocol, exactly as the model's would be.
    const { session } = await openSession((request) => ({
      type: "scored",
      id: request.id,
      scores: request.placements.map((placement) => -placement.y),
    }))
    const engine = createEngine({ seed: 7, config: FAST })
    const autopilot = createAutopilot(createController(), {
      engine,
      judge: session,
    })
    engine.start()
    autopilot.setEnabled(true)

    const drops: number[] = []
    for (let tick = 0; tick < 6000 && engine.readout.phase !== "over"; tick++) {
      const intent = autopilot.nextIntent()
      if (intent.hardDrop) drops.push(tick)
      engine.tick(intent)
      await settle()
    }

    expect(engine.readout.phase).toBe("over")
    expect(drops.length).toBeGreaterThan(4)
    expect(autopilot.margin).not.toBeNull()
    session.dispose()
  })
})
