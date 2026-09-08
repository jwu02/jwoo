# 3D Keyboard Heatmap

## Context

The activity-telemetry dashboard (`app/activity-telemetry/page.tsx`) renders an
all-time key-press heatmap as a hand-built SVG keyboard
(`components/telemetry/keyboard-heatmap.tsx`, 609 lines). The user authored a
Blender-exported 3D keyboard (`public/keyboard.glb`) and wants the SVG replaced:
a **fixed straight top-down camera**, keycaps **tinted by press count at rest**,
and **hover a key → press-down animation + count tooltip, spring back on
un-hover**.

The repo already runs the exact R3F stack on the home scene (`three@0.185`,
`@react-three/fiber@9`, `@react-three/drei@10`, self-hosted Draco decoder in
`public/draco/`). We mirror the `components/home/` architecture: scene shell
(WebGL gate + `ssr:false` dynamic import) → canvas → in-scene model, with
decision logic in pure, unit-tested modules.

**User-confirmed decisions:** keep the resting heatmap tint · straight top-down
camera (no orbit) · delete the SVG implementation and its tests entirely.

## Model facts (verified against `public/keyboard.glb`)

- 79 nodes: `chassis` + **78 `key_<snake_case>` nodes**. `PHYSICAL_KEYS` has 79
  ids. Exactly one id has no node: **`Section` (the §/± key)** — the model is
  ANSI-style, where the number-row leftmost node `key_backquote` is the
  `` ` ``/`~` key (the user confirmed the backquote moved to the top-left and
  §/± was removed). `Backtick` therefore maps to `key_backquote`.
- Each key node's cap is the **first Mesh in its subtree** (76 keys = Group
  `[cap, legend]`; `key_space` = bare cap Mesh; `key_touchid` = Group
  `[cap, ring, sensor]`). Never assume `material` arrays.
- **The chassis' second primitive shares the cap material instance** → clone the
  cap material per key before any mutation.
- No lights / cameras / animations in the GLB. Meter scale (world units).
- Draco-compressed (KHR_draco mesh compression), one shared PNG normal map on
  the chassis only.
- `THREE.Color.setStyle("oklch(…)")` silently returns WHITE in r185 — the ramp
  must convert oklch → sRGB hex in a pure helper, fed to `Color.set(hex)`.

## Goals

- Render the keyboard as an interactive 3D model, fixed straight-top-down, in
  the existing activity-telemetry column.
- Resting keycap tint = the old SVG oklch ramp (charcoal → warm orange).
- Hover a key: press-down approx. 1.5 mm + emissive lift + count tooltip;
  un-hover: spring back off-hover with a small visible bounce.
- A11y: 79 tabbable buttons (one per physical key, incl. `Section`/`Backtick`),
  same `aria-label` contract, driving the same hover pipeline — so focus and
  pointer stay in lock-step, and it works even without WebGL.
- Degrade gracefully: no WebGL → muted note + a11y buttons still work.

## Non-Goals

- No orbit / pan / zoom — the view is fixed top-down.
- Caps Lock LED click-toggle is dropped (may return as an emissive toggle).
- No change to the count-aggregation semantics of `lib/telemetry/key-layout.ts`
  (label coverage guardrail test is the invariant we preserve).
- `public/keyboard.blend` stays in `public/` (precedent: `homepage.blend`).

## Architecture

```
app/activity-telemetry/page.tsx                        UNCHANGED (same import/props)
components/telemetry/keyboard-heatmap.tsx              REWRITTEN (wrapper: state, tooltip, a11y)
components/telemetry/keyboard-scene.tsx                NEW — WebGL gate shell
components/telemetry/keyboard-canvas.tsx               NEW — <Canvas>, lights
components/telemetry/keyboard-model.tsx                NEW — useGLTF, registry, tint, pointers, spring
components/telemetry/keyboard-camera.ts                NEW — pure fitTopDown framing
components/telemetry/keyboard-spring.ts                NEW — pure damped spring integrator
components/telemetry/keyboard-projection.ts            NEW — projectKeyAnchor
lib/telemetry/key-node-map.ts                          NEW — id ↔ GLB node mapping
lib/telemetry/heatmap-colors.ts                        NEW — intensity → sRGB hex ramp
lib/telemetry/key-layout.ts, tooltip-position.ts       KEPT (comment-only fix in key-layout)
```

- **Wrapper** (`keyboard-heatmap.tsx`) owns `hovered` (single source of truth),
  computes `tints`, renders the scene + tooltip + a11y buttons.
- **Model** maps ids → nodes, snapshots `restY`, clones cap materials, applies
  tints, resolves hover, and runs the spring in `useFrame` (no React state per
  frame).
- **Pure helpers** (TDD): `heatmap-colors`, `key-node-map` (parses the real GLB
  to assert coverage), `keyboard-camera`, `keyboard-spring`, `keyboard-projection`.

## Config / tuning

- Camera: `fitTopDown({ bounds, fovDeg: 40, aspect, margin: 1.15 })`, `up=(0,0,−1)`
  (set before first lookAt — default up is parallel, would degenerate).
- Spring: `stiffness 900`, `damping 30` (ω=30 rad/s, ζ≈0.33 → ~11% overshoot,
  ~400 ms settle at 60 fps). `KEY_PRESS_DEPTH_M = 0.0015`. Hover emissive `0.35`.
- Lights: hemisphere + directional (GLB ships none). `<Canvas flat>` (NoToneMapping)
  is a deliberate deviation to preserve tint fidelity.

## Known limitation

`Section` (§/±) has no GLB node — its count is only in the a11y layer (focusable,
tooltip via degenerate anchor), not tinted in 3D. Fixing requires a re-export.

## Verification

See the plan doc — automated tests (pure helpers + wrapper) via `npm test`,
`npm run lint`, `npm run typecheck`, `npm run build`, plus a manual QA pass.
