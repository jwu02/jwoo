# Give the graph camera an interface

Status: accepted

## Context

The knowledge graph's camera existed only inside its renderer. The zoom, the pan, the framing in flight and the viewer's claim on the camera lived in closures in `force-graph.tsx`, and every way of observing them from outside was a proxy for one of them: the transform read back off the wrapper's DOM node through `d3.zoomTransform`, which is d3's own binding on that element rather than the graph's state; a walk into the Pixi stage for the node and link sprites the assertions were really about; and a mocked simulation whose tick and end handlers stood in for the graph's own drives of the camera. Six test files each carried their own copy of that harness. Every change near the camera — a framing, a focus flight, the note list's re-anchor — landed in the same file, which is why the 2026-09-27 architecture review named the camera the repo's hot spot.

## Decision

One `lib/knowledge-graph/camera.ts` module owns the graph's whole relationship with the viewport: d3-zoom and the selection it is bound to, the transitions, the yield rule (a fit yields to a viewer who has moved the camera), the focus-flight dedupe, the viewport-width tracking, and the framing orchestration around the plans `planFit` returns. The arithmetic stays pure in `framing.ts`. The renderer keeps what is its own: the simulation and its forces, the Pixi world, press and click semantics, hover and emphasis painting, the labels, and the page's belief in the Focus. It tells the camera what the graph is doing — this snapshot's layout, the note the page has taken — and the camera decides where the viewport stands.

The interface is the camera's vocabulary, not the renderer's: a transform is `{x, y, k}`, the same shape the framing arithmetic returns, and every change carries its cause — `gesture` for the visitor's own hand, `program` for the graph's own moves — because only a gesture may take the camera off a framing the visitor asked for.

## Considered options

**Keeping d3's transitions, rather than an owned tween.** The camera could have interpolated transforms itself, which would drop d3 to a zoom-behaviour dependency and put the animation under test. Rejected: the gesture-versus-transition interrupt discipline is d3's and has already been debugged once — a gesture interrupts the element's transitions before it emits its first zoom, a transition started inside a wheel's live gesture window reuses that gesture rather than being cancelled by it. An owned tween re-derives that race from scratch, and the camera's behaviour is not what makes tests hard to write; the missing interface was.

**Keeping the renderer's primitives and exposing a facade over them.** Would leave the camera's decisions split across the boundary, so the yield rule and the flight dedupe would still be observed through the renderer. Rejected: it moves the tests without moving the hot spot.

## Consequences

A camera change now pays once, at the interface, instead of in every path that reached into the renderer for it. What the camera decides is asserted on the camera — a real `d3.zoom` bound to a plain `div`, no Pixi and no simulation — and the six renderer files that each kept their own copy of the harness now share one. The renderer's own effects on the camera are still read off the wrapper through `d3.zoomTransform`, which is the honest way to ask what the page did *to* the camera as opposed to what the camera decided.

d3 now enters `lib/knowledge-graph`. This is allowed, and deliberately so: the eager-graph rule (ADR-0001) polices three, and d3 is not three — the constraint is that the WebGL stack never reaches a route's first client chunk, not that the knowledge graph's own libraries may not. A future reader who finds d3 sitting next to `framing.ts` should read it as this decision rather than as drift.
