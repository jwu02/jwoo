# Controllers feed per-Tick intents

Status: accepted

The Engine consumes play through a Controller interface: per Tick, the held directions and the one-shot actions performed since the last Tick. Keyboard and touch Controllers translate their devices into that shape today; an AI Controller (Laya) implements the same interface later, which is the whole point — the seam is the action space, fixed now so that plugging an AI in later is a swap, not a rewrite.

DAS, ARR and soft-drop speed are modelled inside the Engine, from the held flags — not in the keyboard layer. They are game behaviour with Guideline values, and keeping them engine-side means a human Controller and a future AI Controller play under identical rules. The AI read surface is separate from the drive surface: `observe()` (the serialized Observation) and the Placement helpers (`legalPlacements`, `applyPlacement`) let kevala enumerate and score candidate placements without driving anything. Placements reachable only through wall kicks are not enumerated — a documented ceiling, not an oversight.

## Considered options

**A timestamped event queue** — press/release events carrying times. Rejected: more machinery to keep deterministic, and repeat/hold logic would run against a clock the Engine is forbidden to read. Held flags plus edges per Tick carry the same information with none of the plumbing.

**Raw key events straight into the Engine.** Rejected: that welds the action space to a keyboard — exactly the coupling the AI seam exists to prevent.

## Consequences

- A new input method (gamepad, an AI) implements one small interface and touches nothing else; pause mutes all Controllers uniformly.
- The intent vocabulary is deliberately small — held left/right/down, rotate CW/CCW, hard drop, hold. Anything richer must be expressed as combinations, not new Engine concepts.
- The Observation and Placement helpers ship as pure Engine API from v1 with no AI attached; an unused seam is the price of the seam being ready.
