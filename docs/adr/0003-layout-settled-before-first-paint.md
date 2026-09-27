# Run the graph's layout to rest before the first paint

Status: accepted

## Context

The knowledge graph used to be drawn while its layout was still moving. The camera made two framings to cover that: a rough snap of the seeded positions on the simulation's first tick, and a second, animated fit when the simulation ended (~300 ticks later). The cost was a second adjustment the viewer never asked for — a camera move roughly twenty-five seconds after the page loaded, over a graph they had probably started reading by then. The frame it moved away from was also often wrong by the time it moved: the layout grows outward as it settles, so it outgrows the rough snap long before the fit corrects it.

## Decision

The renderer steps the simulation to rest by hand — `simulation.tick()`, which advances the forces without firing the tick handler — before it draws any of it, sliced by a per-frame time budget so the page stays responsive, and hides the world until the run is done. The camera then frames the resting layout once, in the same turn as the first draw of it, and never moves on its own again: the fit is a snap rather than a transition, because there is no unframed frame for an animation to cover. `Camera.layoutReady` is that moment, and `computeFitTransform` is the only framing it makes.

A drag still reheats the layout and the nodes still move, but nothing reframes them: the graph moving is not the camera moving, and the viewer is holding the camera by then anyway.

## Considered options

**A tracking fit — the camera following the layout's changing bounds every tick, eased, so the reframe is never discrete.** Rejected: it is more camera logic than the single fit it replaces, the camera would be in near-constant motion for the whole settle (the very thing being complained about, only smoother), and a frame that is always chasing the layout is never a frame the viewer can trust.

**Baking settled positions into the server's snapshot.** Rejected: layout would be stable across reloads within a snapshot's window, but the client keeps its simulation regardless — a drag needs it — and the snapshot's shape is not worth widening for that.

## Consequences

The page waits for the layout instead of watching it form: ~1.5 seconds on the current graph (674 notes, 300 steps), covered by the page's own loading state rather than a blank box, which is why the renderer reports readiness (`onReady`) and the page overlays that state on the mounted graph instead of branching around it — a graph that is not mounted cannot report that it is drawn. The tunable is `SETTLE_STEPS` and the per-frame budget in `force-graph.tsx`; a graph much larger than this one would want a smaller step count rather than a longer wait.
