# Plan: 3D Keyboard Heatmap

Replace the SVG keyboard heatmap with the Draco-compressed `public/keyboard.glb`
rendered top-down via the repo's existing R3F stack. This records the executed
steps; the design rationale lives in
`docs/superpowers/specs/2026-09-08-3d-keyboard-heatmap-design.md`.

## Steps (executed)

1. **Spec doc** — `docs/superpowers/specs/2026-09-08-3d-keyboard-heatmap-design.md`.
2. **Draco-compress the asset** — `npx @gltf-transform/cli draco public/keyboard.glb
   public/keyboard.glb` (3 MB → 690 KB). Used the standalone `draco` command, NOT
   `optimize` — its join/weld/prune could merge per-key nodes. Verified 79 nodes
   and `KHR_draco_mesh_compression` survived; the PNG normal map is intact.
3. **Pure helpers (TDD)** — test-first, then implementation:
   - `lib/telemetry/heatmap-colors.ts` (`keyIntensity`, `oklchToSrgbHex`,
     `keycapColor`) — reproduces the legacy ramp; pinned to `#222222` /
     `#78442d` / `#d8662a`.
   - `lib/telemetry/key-node-map.ts` — `PHYSICAL_KEY_NODE` (78 entries),
     `NO_NODE_IDS = {Section}`, `glbNodeName`, `physicalIdForNode`, `hasNode`.
     Test parses the real `public/keyboard.glb` and asserts 1:1 coverage.
   - `components/telemetry/keyboard-camera.ts` (`fitTopDown`) — top-down framing.
   - `components/telemetry/keyboard-spring.ts` — damped spring integrator, pure.
   - `components/telemetry/keyboard-projection.ts` (`projectKeyAnchor`) — key →
     on-screen tooltip anchor.
4. **Static 3D render** — `keyboard-model.tsx` (useGLTF, registry, tint, camera
   frame, pointer handlers), `keyboard-canvas.tsx` (Canvas + lights), `keyboard-scene.tsx`
   (WebGL gate), and the rewritten `keyboard-heatmap.tsx` wrapper (container +
   tints). Old SVG body deleted in place.
5. **Hover + tooltip** — pointer/focus converge on the wrapper `hovered`; tooltip
   positioned in `useLayoutEffect` from `canvasApiRef.getAnchor()`, clamped/flipped
   by `computeTooltipPosition`.
6. **Spring + emissive** — `useFrame` advances active springs, writes
   `node.position.y` and `material.emissiveIntensity`; no React state per frame.
   Constants tuned for a visible bounce at 60 fps (stiffness 900, damping 30).
7. **A11y layer + fallback + tests** — 79 tabbable buttons (inside `sr-only`),
   `React.memo`-style memoised on counts; `keyboard-scene.tsx` fallback note for
   no-WebGL. Replaced the old SVG test with wrapper tests at the same path.
8. **Cleanup + verification** — `key-layout.ts` comment fix (arrow-key comment no
   longer references the deleted `KEY_ICONS`); full `npm test` / `npm run lint` /
   `npm run typecheck` / `npm run build` pass.

## Mapping reconciliation

`Backtick` (`` ` ``/`~`) → `key_backquote` (the model's top-left node); `Section`
(§/±) → no node (removed from the model). The §/± press labels map to `Section`
in `key-layout.ts` (which also carries `Grave`), so the top-left node still
shows the `` ` ``/`~`/`Grave` count; §/± is announced in the a11y layer but not
tinted in 3D.

## Manual QA (dev)

`npm run dev` → `/activity-telemetry`: tint ramp matches the old SVG; hover =
press-down + emissive lift + tooltip; un-hover springs back with a small bounce;
Esc/F-row tooltips flip below; Tab through sr-only buttons animates keys and
shows tooltips; `d` theme toggle (canvas transparent over both); narrow viewport
scales without horizontal scroll; 60 s poll updates tints; touch tap = hover;
WebGL disabled → note + a11y buttons work.

## Verification status

- `npm test` — all telemetry suites (18 suites, 204 tests) pass. Two unrelated
  pre-existing failures remain (`resume/sections` reflecting WIP resume changes;
  `knowledge-graph/force-graph` flaky under parallel load — passes in isolation).
- `npm run lint` — clean on all new/changed files.
- `npm run typecheck` — clean.
- `npm run build` — succeeds; `/activity-telemetry` prerenders statically.
