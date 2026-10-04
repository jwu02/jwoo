# Research: pixi.js v8 in Next.js 16 and this repo's pattern — Pacman application mount

Resolves the wayfinder ticket [jwu02/jwoo#31](https://github.com/jwu02/jwoo/issues/31) for the map [jwu02/jwoo#29](https://github.com/jwu02/jwoo/issues/29).

> **Note on output location:** the task asked for `/tmp/wayfinder-research/pixi-nextjs-pattern.md`; the runtime for this run is configured to persist findings at this path instead. Copy this file to the `/tmp` path if the tracker workflow needs it there.

## Summary

The Pacman game should follow ADR 0001's two-file split — a pixi-free adapter (`pacman-scene.tsx`) plus a lazily loaded implementation (`pacman-canvas.tsx`) behind `next/dynamic({ ssr: false })` from a client component — with the implementation reusing the knowledge graph's `usePixiApp` lifecycle verbatim: dynamic-init under a `cancelled` flag, `app.destroy({ removeView: true }, { children: true, texture: true })` in cleanup, and manual `app.resize()` for any container resize that isn't a window resize (pixi 8's ResizePlugin listens only to `globalThis` resize). Keep pixi's default WebGL preference (WebGPU is opt-in via `preference: 'webgpu'` and falls back automatically through webgl → canvas), and add an eager-graph guardrail test for `pixi.js` mirroring `tests/lib/three/eager-graph-is-three-free.test.ts`.

## Findings

### A. Local facts (repo, read-only)

1. **Claim:** The knowledge graph initializes pixi inside a `useEffect` hook: dynamic `await import("pixi.js")`, then `new PIXI.Application()` + `await created.init({ resizeTo: container, backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true })`; the canvas is appended manually with `container.appendChild(created.canvas)` and the app is exposed through React state.
   **Sources:** `components/knowledge-graph/use-pixi-app.ts`. **Support:** direct evidence. **Confidence:** high.

2. **Claim:** The hook already handles the two async teardown races that matter under React Strict Mode: (a) an unmount that lands while `init()` is in flight is caught by a `cancelled` flag which destroys the app after init resolves (`created.destroy({ removeView: true }, { children: true, texture: true })`), and (b) the effect cleanup destroys the app synchronously. Only type-only pixi imports exist at module scope (`import type { Application } from "pixi.js"`), which are erased at compile time.
   **Sources:** `components/knowledge-graph/use-pixi-app.ts`. **Support:** direct evidence. **Confidence:** high.

3. **Claim:** The knowledge graph's renderer keeps everything pixi-related out of React's render cycle: the app is mirrored into `appRef` by an effect, camera-driven viewport changes call `appRef.current?.resize()`, and a teardown guard exists for effect-ordering — "On unmount, usePixiApp's cleanup destroys the Application before this effect's cleanup runs. Application.destroy() nulls app.stage" — hence the `if (app?.stage)` guard before touching the world container.
   **Sources:** `components/knowledge-graph/force-graph.tsx`. **Support:** direct evidence (comments are load-bearing documentation, not speculation). **Confidence:** high.

4. **Claim:** The knowledge-graph route statically imports its renderer component (`ForceGraph`) and does **not** use the `next/dynamic` boundary; pixi is kept out of the eager graph solely by the dynamic import inside the hook. A page comment also documents that "resizeTo only hears about window resizes (pixi 8 has no ResizeObserver on the container)", which is why a panel toggle compensates via an explicit resize call.
   **Sources:** `app/knowledge-graph/page.tsx`. **Support:** direct evidence. **Confidence:** high.

5. **Claim:** The three.js isolation pattern (ADR 0001) is: a three-free adapter (`*-scene.tsx`) holding a module-scope loader `() => import("./…-canvas").then(m => ({ default: m.HomeCanvas }))`, rendered through `SceneGate`, which wraps `dynamic(load, { ssr: false, loading: () => null })` (in `useMemo`), does a mount-time WebGL capability check, and wraps the loaded canvas in an error boundary that swaps to a fallback. The ADR states the `next/dynamic({ ssr: false })` boundary "has to sit *outside* the implementation for that boundary to hold" and that a scene costs two files "deliberately".
   **Sources:** `docs/adr/0001-scene-chunk-isolation.md`, `components/three/scene-gate.tsx`, `components/home/home-scene.tsx`. **Support:** direct evidence. **Confidence:** high.

6. **Claim:** The eager-graph test walks static imports from each page entry (`app/page.tsx`, activity-telemetry, ai-usage, knowledge-graph, resume), stops at dynamic `import()` forms, erases `import type`, and asserts no package in `["three", "@react-three/fiber", "@react-three/drei"]` is reachable. **pixi.js is not on the guarded list today** — though the knowledge-graph page would pass a pixi guard too, since its pixi imports are type-only (erased) or dynamic (walk stops).
   **Sources:** `tests/lib/three/eager-graph-is-three-free.test.ts`. **Support:** direct evidence; the "knowledge-graph would pass a pixi guard" part is researcher inference from the same file's mechanics. **Confidence:** high.

7. **Claim:** Bundler config has no pixi-specific entries: `next.config.ts` transpiles `three` and the `d3-*` packages for Jest/ESM compatibility and pins the Turbopack root; pixi.js ships both CJS (`lib/index.js`) and ESM (`lib/index.mjs`) entry points so no transpile entry is currently needed.
   **Sources:** `next.config.ts`, `node_modules/pixi.js/package.json` (v8.19.0: `"main": "lib/index.js"`, `"module": "lib/index.mjs"`). **Support:** direct evidence; the "no transpile entry currently needed" clause is researcher inference from the dual entry points. **Confidence:** high (inference: medium).

8. **Claim:** Exact versions: `pixi.js ^8.19.0` (installed 8.19.0), `next 16.2.6`, `react 19.2.4`, `three ^0.185.1`. The Pacman app will register in `components/os/apps.tsx`, the single list the Dock reads. CLAUDE.md's referenced local Next docs (`node_modules/next/dist/docs/`) are **not present** in the installed 16.2.6 tarball (its `files` list ships no docs directory; targeted reads all ENOENT'd), so nextjs.org was used.
   **Sources:** `package.json`, `components/os/apps.tsx`, `node_modules/next/package.json`. **Support:** direct evidence. **Confidence:** high.

### B. Pixi.js v8 lifecycle (primary sources)

9. **Claim:** v8 initialization is async by design ("With the introduction of the WebGPU renderer PixiJS will now need to be awaited before being used"): `const app = new Application(); await app.init({ ... });` — options moved from the constructor into `init()`. `init()` returns `Promise<void>` "that resolves when initialization is complete".
   **Sources:** [v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8), [Application guide](https://pixijs.com/8.x/guides/components/application), [Application API](https://pixijs.download/release/docs/app.Application.html). **Support:** direct evidence. **Confidence:** high.

10. **Claim:** Teardown is `app.destroy(rendererDestroyOptions?, options?)`: `false`/`undefined` (first arg) preserves the canvas element, `true` or `{ removeView: true }` removes it; the second argument takes `DestroyOptions` (`children`, `texture`, …) for the scene graph and its textures. The repo's `destroy({ removeView: true }, { children: true, texture: true })` matches the documented API exactly.
    **Sources:** [Application API (v8.17.1 doc text)](https://pixijs.download/v8.17.1/docs/app.Application.html), confirmed by repo usage in `components/knowledge-graph/use-pixi-app.ts`. **Support:** direct evidence. **Confidence:** high.

11. **Claim:** Renderer selection: `preference` defaults to `webgl`; the installed 8.19.0 source defines priority `["webgl", "webgpu", "canvas"]`. A single-string preference keeps its position and appends the remaining candidates — so `preference: 'webgpu'` tries WebGPU, then **automatically falls back to WebGL, then Canvas** (`isWebGPUSupported()` / `isWebGLSupported(...)` gate each step; it throws only if every candidate fails, and canvas is unconditional). Per-renderer option overrides are available via the `webgl: {}` / `webgpu: {}` keys.
    **Sources:** [Application guide (preference default `webgl`)](https://pixijs.com/8.x/guides/components/application), installed source `node_modules/pixi.js/lib/rendering/renderers/autoDetectRenderer.mjs`, [autoDetectRenderer API](https://pixijs.download/release/docs/rendering.autoDetectRenderer.html). **Support:** direct evidence. **Confidence:** high.

12. **Claim:** pixi itself dynamically imports the selected renderer class (`await import('./gpu/WebGPURenderer.mjs')` etc.), and the official docs say "The selected renderer's code is then dynamically imported… This will place the renderer code in a separate chunk, which is loaded only when needed." So the heavy WebGPU/WebGL renderer code is never in the eager chunk and only the selected renderer's chunk is ever fetched.
    **Sources:** installed source `node_modules/pixi.js/lib/rendering/renderers/autoDetectRenderer.mjs`, [autoDetectRenderer API](https://pixijs.download/release/docs/rendering.autoDetectRenderer.html). **Support:** direct evidence. **Confidence:** high.

13. **Claim:** Resize behavior: the built-in ResizePlugin listens **only** to `globalThis` `"resize"` events (even when `resizeTo` is an HTMLElement — it reads `clientWidth`/`clientHeight` at event time, rAF-debounced, then calls `renderer.resize(width, height)` and re-renders). There is **no ResizeObserver on the container**, exactly as the knowledge-graph page comment claims. Consequence: any layout change that resizes the container without a window resize must call `app.resize()` manually.
    **Sources:** installed source `node_modules/pixi.js/lib/app/ResizePlugin.mjs`, [ResizePlugin guide](https://pixijs.com/8.x/guides/components/application/resize-plugin). **Support:** direct evidence. **Confidence:** high.

14. **Claim:** Resolution/DPR: `resolution` + `autoDensity` are init options (`autoDensity` "Adjusts canvas size based on resolution. Applies only to HTMLCanvasElement"); v8's `renderer.resize(w, h, resolution?)` accepts an optional resolution and `renderer.resolution` has a setter, so a mid-session DPR change (window moved between displays) can be applied without rebuilding the renderer.
    **Sources:** [Application guide options table](https://pixijs.com/8.x/guides/components/application), [WebGPURenderer API](https://pixijs.download/release/docs/rendering.WebGPURenderer.html). **Support:** direct evidence. **Confidence:** high.

### C. React and Next.js 16 integration (primary sources)

15. **Claim:** React Strict Mode "will also run one extra setup+cleanup cycle in development for every Effect" (setup → cleanup → setup). All Strict Mode checks are development-only. This is precisely the double-mount the repo's `cancelled`-flag + destroy-in-cleanup hook is built to survive: in dev the first app is created and destroyed before the second is created, and the hook leaves exactly one live app.
    **Sources:** [react.dev `<StrictMode>`](https://react.dev/reference/react/StrictMode), `components/knowledge-graph/use-pixi-app.ts`. **Support:** direct evidence (react.dev quote) + interpretation that the hook satisfies it. **Confidence:** high.

16. **Claim:** In Next.js App Router (docs current as of 2026-03-10, applicable to the installed 16.2.6): "`ssr: false` option is not supported in Server Components. You will see an error if you try to use it in Server Components" — it must sit in a Client Component. Also: "When a Server Component dynamically imports a Client Component, automatic code splitting is currently **not** supported", and `next/dynamic` is a composite of `React.lazy()` + Suspense. Hence the repo's shape — a Server Component page statically importing a `"use client"` adapter that itself calls `dynamic(..., { ssr: false })` (`app/page.tsx` → `components/home/home-scene.tsx`) — is the correct pattern to copy.
    **Sources:** [nextjs.org Lazy Loading guide](https://nextjs.org/docs/app/guides/lazy-loading), `app/page.tsx`, `components/home/home-scene.tsx`. **Support:** direct evidence. **Confidence:** high.

17. **Claim:** For imperative React integration, pixi's ecosystem has no official reconciler to lean on; `@pixi/react` (community, now v8-compatible) exposes `destroyOptions` / `rendererDestroyOptions` for unmount, but real-world reports show the destroy path is where v8 + React breaks when done carelessly (a v8 crash destroying from a React effect hook with async init — pixijs#10331; strict-mode destroy crashes in pixi-react — #602). The repo's hand-rolled hook already embodies the safe shape: create in effect, destroy in cleanup, guard the async race.
    **Sources:** [pixi-react README](https://github.com/pixijs/pixi-react/blob/main/README.md), [pixijs#10331](https://github.com/pixijs/pixijs/issues/10331), [pixi-react#602](https://github.com/pixijs/pixi-react/issues/602). **Support:** direct evidence for the issue reports; the recommendation is researcher synthesis. **Confidence:** medium.

18. **Claim:** Bundle implications of a second pixi consumer: v8 is a single package (the v7 `@pixi/*` multi-package version-skew problem is gone), ships tree-shakeable subpath imports (`pixi.js/accessibility`, `pixi.js/graphics`, …) plus `manageImports: false` for custom builds, and both consumers dynamically importing the same `pixi.js` module share one module instance/chunk — the game adds only its own game code plus a second reference to an already-lazy chunk. pixi's internal per-renderer dynamic imports (finding 12) mean the game opting into `preference: 'webgpu'` adds no eager weight and fetches only the WebGPU chunk.
    **Sources:** [v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8), installed source `autoDetectRenderer.mjs`. **Support:** direct evidence for single-package + subpaths + renderer chunks; the shared-chunk claim is researcher interpretation of standard bundler behavior for a shared dynamic import. **Confidence:** medium (inference flagged).

## Recommended mount pattern for the Pacman application

**Chunk boundary — yes, mirror ADR 0001's two-file split.**

- `components/pacman/pacman-scene.tsx` — `"use client"`, **no pixi import anywhere**; module-scope loader `const loadPacman = () => import("./pacman-canvas").then((m) => ({ default: m.PacmanCanvas }))`; renders `dynamic(loadPacman, { ssr: false, loading: () => <loading box/> })`. This is `app/page.tsx` → `home-scene.tsx` exactly, minus three.
- `components/pacman/pacman-canvas.tsx` — the *only* file that imports `pixi.js` (a static import here is fine: the file is reachable only through the dynamic boundary, same as `home-canvas.tsx` with three).
- `app/pacman/page.tsx` — Server Component that statically imports the adapter (the working Home shape; do **not** call `dynamic(..., { ssr: false })` from the Server Component page — Next 16 rejects it).
- Register `{ href: "/pacman", label: "Pacman", icon: … }` in `components/os/apps.tsx`.
- **Do not reuse `SceneGate` as-is:** its mount-time `isWebGLAvailable()` check is WebGL-specific and would show the fallback on a WebGPU-capable/no-WebGL machine that pixi itself could render for (pixi auto-detects webgl → webgpu → canvas in 8.19). Give pacman a smaller gate: the same `dynamic({ ssr: false })` + error-boundary skeleton *without* the WebGL capability check, or extend `SceneGate` to make the capability check injectable. (Researcher recommendation, derived from findings 5 and 11.)

**Init/destroy lifecycle under Strict Mode — reuse the knowledge-graph hook, don't reinvent it.**

- Copy `use-pixi-app.ts`'s shape: `cancelled` flag, destroy-after-init race branch, cleanup `created.destroy({ removeView: true }, { children: true, texture: true })`, manual `appendChild(created.canvas)`. Strict Mode's extra setup→cleanup→setup cycle then leaves exactly one live app.
- Since the hook now has two consumers, consider lifting it to the lib root (repo convention: "shared code sits at the lib root"; `lib/telemetry/` and `lib/ai-usage/` never import each other — a shared pixi hook belongs at `lib/` or `hooks/`, not inside either feature). Game-specific extras pacman must add: remove its own `document`/`window` listeners (keyboard controls!) in the *same* cleanup that destroys the app, and copy force-graph's `if (app?.stage)` guard into any effect whose cleanup touches pixi objects after the app may already be destroyed.

**Resize — init options as today, manual resize for non-window changes.**

- Init with `resizeTo: container, autoDensity: true, resolution: window.devicePixelRatio || 1` (identical to the knowledge graph).
- ResizePlugin hears only window resizes (finding 13). If Pacman's surface can change size without a window resize (OS-shell chrome, sidebars), wire explicit `app.resize()` calls the way force-graph does (`onViewportChange: () => appRef.current?.resize()`), or attach your own `ResizeObserver` on the container calling `app.resize()`. The knowledge graph also takes the canvas out of the wrapper's flow (`[&>canvas]:absolute`) so pixi's explicit canvas width can't widen the page — keep that CSS trick.
- Optional polish: a `matchMedia(`(resolution: ${dpr}dppx)`)` listener calling `renderer.resize(w, h, newDPR)` to survive monitor switches.

**WebGPU fallback — keep pixi's default; the game needs no detection code.**

- Default `preference` is `webgl` and pixi's own docs say it "will prioritize the WebGL renderer as it is the most tested safe API to use" — the knowledge graph doesn't set `preference`, and neither should Pacman. If WebGPU is opted into later, `preference: 'webgpu'` degrades automatically webgl → canvas (finding 11), and per-renderer tuning goes in the `webgl: {}` / `webgpu: {}` option blocks. No adapter-level capability gate required.

**Guardrail test — mirror the three test, add `pixi.js`.**

- New `tests/lib/pixi/eager-graph-is-pixi-free.test.ts` (or add to the existing file): same import-walk over `PAGE_ENTRIES` + `"app/pacman/page.tsx"`, with the guarded package list `["pixi.js"]` (include `specifier === pkg || specifier.startsWith("pixi.js/")` so subpath imports are caught). The walk must keep stopping at dynamic imports — that stopping rule *is* the invariant being tested (the adapter's `import("./pacman-canvas")` is the one allowed pixi path). Per ADR 0001's consequence clause: when it fails, move the import below the boundary — never relax the test.

## Contradictions

- **SceneGate's WebGL gate vs pixi's auto-detection** (design tension, not an evidence conflict): the three-scene gate hard-fails without WebGL, while pixi 8.19 can render via WebGPU or Canvas in that situation. Resolved in the recommendation by not reusing the WebGL check for pacman. Sources: `components/three/scene-gate.tsx` vs `node_modules/pixi.js/lib/rendering/renderers/autoDetectRenderer.mjs`.
- **Validation limitation:** `source_check` on the destroy/fallback claim returned status "unclear" (automated assessment unavailable; confidence 0.30). Per protocol, the claim was instead verified by direct inspection of the official API docs ([Application](https://pixijs.download/release/docs/app.Application.html)) and the installed package source (`autoDetectRenderer.mjs`), which agree. No contradicting evidence found.
- Otherwise none found.

## Missing evidence

- No measured bundle sizes for pixi.js 8.19 (no decision hinges on it; renderer code is chunk-split regardless — finding 12).
- Whether next/jest + jsdom can transform/init pixi for component tests is untested; jsdom has no WebGL/WebGPU context, so pacman tests should mock `pixi.js` rather than init a renderer. (Inference, unverified.)
- `TickerPlugin.destroy()` stopping the private ticker is implied by the docs' "Destroys the application and all of its resources" but was not separately verified.
- Local Next 16 docs (`node_modules/next/dist/docs/`) are absent from the installed tarball, so the local-vs-online cross-check CLAUDE.md usually enables wasn't possible; nextjs.org (updated 2026-03-10) was used as the sole Next source.

## Sources

**Kept:**
- `components/knowledge-graph/use-pixi-app.ts`, `force-graph.tsx`, `app/knowledge-graph/page.tsx` — the working v8 mount/teardown pattern this repo already ships.
- `docs/adr/0001-scene-chunk-isolation.md`, `components/three/scene-gate.tsx`, `components/home/home-scene.tsx` — the chunk-isolation invariant and its canonical implementation.
- `tests/lib/three/eager-graph-is-three-free.test.ts`, `next.config.ts`, `package.json`, `components/os/apps.tsx` — guardrail mechanics, bundler config, exact versions, app registry.
- `node_modules/pixi.js/lib/rendering/renderers/autoDetectRenderer.mjs`, `node_modules/pixi.js/lib/app/ResizePlugin.mjs` — installed 8.19.0 source; the authoritative word on fallback and resize (exact version the site will ship).
- [PixiJS v8 Application guide](https://pixijs.com/8.x/guides/components/application), [v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8), [Application API](https://pixijs.download/release/docs/app.Application.html), [autoDetectRenderer API](https://pixijs.download/release/docs/rendering.autoDetectRenderer.html), [ResizePlugin guide](https://pixijs.com/8.x/guides/components/application/resize-plugin), [WebGPURenderer API](https://pixijs.download/release/docs/rendering.WebGPURenderer.html) — official v8 primary docs.
- [nextjs.org Lazy Loading guide](https://nextjs.org/docs/app/guides/lazy-loading) — `ssr: false` Client-Component restriction, current for Next 16.
- [react.dev `<StrictMode>`](https://react.dev/reference/react/StrictMode) — the double-mount contract the lifecycle must satisfy.
- [pixijs#10331](https://github.com/pixijs/pixijs/issues/10331), [pixi-react#602](https://github.com/pixijs/pixi-react/issues/602) — real-world evidence that async-destroy races are the failure mode to design against (secondary/supporting).

**Rejected/deprioritized:**
- StackOverflow "React 18 and Pixijs 7" — v7 class-component pattern, stale.
- api.pixijs.io `Application.ts` page — redundant with pixijs.download docs and installed source.
- Generic blog/SEO hits surfaced in discovery — superseded by the official docs and installed source above.

## Next steps

- Implement: `components/pacman/pacman-scene.tsx` (adapter) + `pacman-canvas.tsx` (implementation) + `app/pacman/page.tsx`, extract `use-pixi-app` to a lib-root shared location, register the app in `components/os/apps.tsx`.
- Add the `tests/lib/pixi/` eager-graph guardrail test, then run `npm test -- tests/lib/pixi` and `npm run dev` and confirm the Strict Mode double-mount leaves one live renderer (single canvas in the DOM).
- Optional follow-up research: measure production chunk sizes after build to confirm pixi lands in one shared async chunk.

## Supervisor coordination

No supervisor contact was needed: the task was self-contained research with no scope ambiguity, and no decision beyond what the ticket itself specifies.