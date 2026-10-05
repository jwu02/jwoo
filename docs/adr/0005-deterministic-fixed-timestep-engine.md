# A deterministic fixed-timestep engine the renderer only reads

Status: accepted

The Tetris Engine is a deterministic simulation advancing in fixed Ticks (60 Hz): it never reads the clock, the DOM or the network, and the only things that change a game are its seed and the inputs the Controllers feed it. Real elapsed time is accumulated outside the Engine and paid out in whole Ticks, so a throttled tab, a 144 Hz display and a headless test all play the identical game, and one seed plus one input log replays it.

React never runs the loop, and the loop never runs React. The pixi Ticker is the sole driver: each animation frame it pays any Ticks that are due and redraws straight from Engine state. The HUD does not subscribe to that loop at all — the Engine republishes a Readout (score, lines, level, next queue, hold, combo, back-to-back) only when one of those fields changes, a few times a second at most, so React re-renders on game events rather than on frames.

## Considered options

**An event-driven React loop** — effects and state updates driving the simulation. Rejected: React's render cycle becomes the game clock, coupling simulation rate to component churn, making the loop untestable without a DOM, and re-rendering the HUD sixty times a second for a board that changed once.

**An immutable Engine returning a fresh snapshot each step.** Rejected: pure-in/pure-out reads nicely but buys nothing here — the Tick contract already seals the Engine off from React, and a mutable engine with two read paths (per-frame pull for the renderer, change-driven Readout for the HUD) is the smaller machine.

## Consequences

- The Engine (`lib/tetris/`) imports no React, no pixi, no DOM. It is unit-tested by calling `tick()` with scripted inputs and an injected seeded RNG.
- Frame-rate independence is structural, not a feature: the accumulator owes Ticks and nothing else.
- Pausing is not Engine machinery: the driver stops paying Ticks. Esc and auto-pause (tab hidden, window blur) are driver concerns; leaving the application unmounts it and the run is lost — honest to ADR 0004's one-application-at-a-time.
- Rendering is a pure read. Nothing in the Engine knows it is being watched.
