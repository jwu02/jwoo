# Keep three out of every route's eager module graph

Status: accepted

Every 3D scene is split in two: a three-free adapter that decides *whether* and *where* the scene mounts, and a lazily loaded implementation that owns the camera, model, lighting and overlays. The shared rig (`SceneCanvas`) is reachable only from the second half. The server must never evaluate three.js, and the WebGL stack must stay out of a route's first client chunk — so `next/dynamic({ ssr: false })` is the boundary, and it has to sit *outside* the implementation for that boundary to hold.

A scene therefore costs two files (`-scene.tsx` for the adapter, `-canvas.tsx` for the implementation) where one would look natural. That is the price of the invariant, and it is deliberate.

## Considered options

**`React.lazy` inside the scene.** Would place the boundary inside R3F's custom reconciler rather than React DOM's, where it loses the framework's proven chunk-splitting and SSR suppression. Rejected: no upside over `next/dynamic`, and a much less certain failure mode.

**Folding the gate into the lazily loaded chunk.** Would make the rig one file per scene again, but the WebGL capability check and the fallback would then only exist *after* the chunk loads — a visitor without WebGL would download the entire three stack just to be told there is no WebGL. Rejected: that is exactly the visitor the gate exists for.

## Consequences

`tests/lib/eager-graph-is-renderer-free.test.ts` walks static imports from every route entry and stops at dynamic ones, asserting no renderer package is reachable — three's, and pixi's for the Tetris cabinet. When it fails, the fix is to move the offending import below the boundary — never to relax the test.

The fallback renders *outside* the scene's box, because a scene's container is a clipped viewport (home's is `absolute inset-0 isolate overflow-hidden`, filling the desktop the OS shell hands it) while its fallback is ordinary scrolling content.
