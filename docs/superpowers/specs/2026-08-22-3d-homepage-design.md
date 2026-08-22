# 3D Homepage

## Context

The homepage (`app/page.tsx`) currently shows a "Hello, I'm Tony Wu" hero heading
plus a grid of four cards linking to Activity Telemetry, AI Usage, Knowledge Graph,
and Resume. The user wants the homepage to present three 3D models — a MacBook Pro,
a computer desk, and a 2025 Xiaomi SU7 Ultra — as an interactive scene: clicking the
MacBook navigates to `/activity-telemetry`. The desk and car render ambiently for
now. The scene renders inside the existing sidebar + content frame (not full
viewport), with the hero heading overlaid on top of the canvas. Click-to-navigate is
driven by a config registry so the desk and car can be wired to routes later.

The three GLB files already live in `public/`: `macbook_pro_14-inch_m5.glb`
(9.3MB), `computer_desk.glb` (4.8MB), `2025_xiaomi_su7_ultra.glb` (28MB). No
three.js stack is installed yet.

## Goals

- Replace the homepage card grid with an interactive 3D scene rendered by
  React Three Fiber (R3F) + drei, inside the existing layout frame.
- Render all three models from `/public`, compressed with Draco so the 28MB car is
  practical to serve.
- Keep the "Hello, I'm Tony Wu" hero + tagline overlaid on the 3D canvas.
- Clicking the MacBook navigates to `/activity-telemetry`; desk and car are
  hoverable but do not navigate yet.
- Model → route mapping lives in a pure config module so wiring the desk/car later
  is a one-line change.
- Degrade gracefully: if WebGL is unsupported or model loading fails, fall back to
  the existing card grid so navigation always works.
- Bundle the Draco decoder locally so there is no runtime CDN dependency.

## Non-Goals

- Navigating from the desk or car (deferred to a later iteration).
- Immersive/full-screen homepage (the scene stays in the sidebar frame).
- AR or `<model-viewer>`.
- Runtime HDR environment lighting fetched from a CDN.
- Camera fly-to on click, or per-model animations (beyond a subtle hover highlight).
- Server-side rendering of the 3D scene (client-only by design).
- Deciding deployment/version-control policy for the large GLB binaries.

## Design

### 1. Rendering stack & dependencies

- Add `three`, `@types/three`, `@react-three/fiber` (v9, React 19 compatible), and
  `@react-three/drei` (v10). Add `@gltf-transform/cli` as a devDependency for the
  one-time compression step.
- The Canvas renders client-side only. `app/page.tsx` stays a server component; the
  scene is pulled in via `next/dynamic(() => import("@/components/home/home-scene"),
  { ssr: false })`.

### 2. File layout

```
app/page.tsx                      → server component: hero overlay + <HomeScene /> + <HomeFallback />
components/home/
├── home-scene.tsx                → "use client" wrapper; contains WebGL support check + ErrorBoundary
├── home-canvas.tsx               → R3F <Canvas>: camera, lights, OrbitControls, Suspense, <SceneModels />
├── scene-models.tsx              → renders one <ModelObject /> per scene-config entry
├── model-object.tsx              → useGLTF + transform + hover/click wiring
├── scene-config.ts               → pure registry: url, transform, label, target route
└── home-fallback.tsx             → the current 4-card grid (graceful degradation)
```

### 3. Scene config (the extensible registry)

`scene-config.ts` is pure data — unit-testable with no WebGL:

```ts
export type HomeSceneModel = {
  id: string
  url: string
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
  label?: string   // hover label
  target?: string  // route to navigate to on click; undefined = no navigation
}

export const HOME_SCENE_MODELS: HomeSceneModel[] = [
  {
    id: "macbook",
    url: "/macbook_pro_14-inch_m5.glb",
    label: "Activity Telemetry",
    target: "/activity-telemetry",
    position: [0, 0, 0],
    scale: [1, 1, 1],
  },
  { id: "desk", url: "/computer_desk.glb", label: "Computer Desk", position: [...], scale: [...] },
  { id: "car", url: "/2025_xiaomi_su7_ultra.glb", label: "2025 Xiaomi SU7 Ultra", position: [...], scale: [...] },
]
```

Exact `position`/`scale`/`rotation` values are tuned during development — GLB
geometry cannot be inspected statically, so the camera framing and per-model
transforms are eyeballed in `npm run dev`.

### 4. Canvas, camera & lighting

- Container: full-bleed within the sidebar content frame (`-mx-4 -mb-4`, matching
  the knowledge-graph page's bleed pattern), height `h-[calc(100vh-3.5rem)]` to fill
  the area under the 14-height header (`h-14`).
- Camera: perspective, framed on the desk + MacBook.
- `OrbitControls` (damped, limited polar angle) so the scene is browsable; R3F's
  built-in click-vs-drag delta check keeps clicks from firing after a drag.
- Lights: ambient + directional key + rim. No `<Environment preset>` (it fetches an
  HDR from a CDN at runtime); can be added later as polish if reflections look flat.
- `gl={{ antialias: true, alpha: true }}` so the page background (light/dark) shows
  through; `dpr` capped to `[1, 2]` for performance.

### 5. Model loading & Draco compression

- One-time compression: `npx @gltf-transform/cli optimize <file>.glb --compress draco`
  on all three GLBs in `public/` (car 28MB → roughly 8–12MB; MacBook and desk shrink
  too). Back up the originals (they are not in git yet) before compressing in place.
- Bundle the Draco decoder locally: copy `draco_decoder.wasm`, `draco_wasm_wrapper.js`,
  and `draco_decoder.js` from `node_modules/three/examples/jsm/libs/draco/` into
  `public/draco/`.
- Configure `useGLTF(url, ...)` to use the local decoder. Exact option shape is
  verified against the installed drei/three-stdlib at implementation time (goal:
  decoder path `/draco/` with no CDN fetch).
- Each model wrapped in `<Suspense>` with a lightweight fallback; `useProgress` for a
  thin loading indicator; `<Preload>` to fetch remaining models after the first frame.

### 6. Interaction & navigation

- `ModelObject`:
  - `onPointerOver` / `onPointerOut` → drei `useCursor` (pointer icon) + a subtle
    group scale highlight.
  - `onClick` → if `target` is set, `router.push(target)` via `useRouter` (client
    component). No-op for models without a target.
- Hover label via drei `<Html>` above the MacBook: "Activity Telemetry".
- Keyboard accessibility is out of scope for the 3D canvas; the fallback card grid
  provides keyboard-accessible navigation whenever it is shown.

### 7. Error handling & fallback

- `home-scene.tsx` checks for WebGL support before mounting the Canvas; on failure it
  renders `<HomeFallback />` (the current card grid).
- An error boundary around the Canvas catches model-load or render failures and also
  renders `<HomeFallback />`. Navigation never breaks.
- The site is JS-dependent (all pages are client components), so no-JS is not a
  supported mode; the fallback covers the realistic failure cases.

## Components

### New

- `components/home/home-scene.tsx` — client wrapper: WebGL support check, error
  boundary, dynamic mounting of the Canvas.
- `components/home/home-canvas.tsx` — R3F `<Canvas>` with camera, lights,
  OrbitControls, Suspense, and `<SceneModels />`.
- `components/home/scene-models.tsx` — maps `HOME_SCENE_MODELS` to `<ModelObject />`.
- `components/home/model-object.tsx` — `useGLTF` + transform + hover/click wiring.
- `components/home/scene-config.ts` — pure model registry (id, url, transform, label,
  target).
- `components/home/home-fallback.tsx` — the current 4-card grid, extracted from
  `app/page.tsx`.
- `scripts/compress-glb.mjs` — one-time Draco compression for `public/*.glb`
  (idempotent; backs up originals).
- `public/draco/*` — bundled Draco decoder files.

### Modified

- `app/page.tsx` — hero heading (overlaid, `pointer-events-none`) + `<HomeScene />`.
- `package.json` — add `three`, `@react-three/fiber`, `@react-three/drei`,
  `@types/three`; add `@gltf-transform/cli` devDependency; add a
  `compress:glb` script.

## Error Handling

- **WebGL unsupported** → `<HomeFallback />` (card grid).
- **Model fetch/parse failure** → error boundary → `<HomeFallback />`.
- **Loading** → thin progress indicator from `useProgress`; per-model Suspense
  fallback while each GLB streams in.

## Testing

- `tests/components/home/scene-config.test.ts` — registry shape: exactly three
  models, unique ids, every model has a url; `macbook` maps to
  `/activity-telemetry`; `desk`/`car` have no `target`.
- `npm run typecheck`, `npm run lint`, and `npm test` must pass.
- Manual verification in `npm run dev`:
  - All three models load and are positioned/framed well.
  - Clicking the MacBook navigates to `/activity-telemetry`.
  - Hovering desk/car shows a pointer/highlight but clicking does not navigate.
  - The card-grid fallback renders when WebGL is disabled (e.g. via devtools).
- Note: the R3F canvas cannot be unit-tested in jsdom (no WebGL); 3D visuals and
  picking are verified manually.

## Out of Scope

- Wiring the desk/car to routes.
- Immersive/full-screen homepage.
- HDR environment lighting from a CDN.
- Camera fly-to on click or model animations.
- AR / mobile-specific 3D controls.
- Git/deployment policy for the GLB binaries.
