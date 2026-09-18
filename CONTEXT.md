# jwoo

A personal site: a 3D home scene, an activity-telemetry dashboard, AI-usage charts, a knowledge graph, and a resume.

## Language

### 3D scenes

**Scene**:
One place 3D appears: the home desk, the keyboard heatmap, the mouse telemetry. A scene is one adapter, one implementation and one fallback.
_Avoid_: canvas (for the whole unit), viewer

**SceneCanvas**:
The one Canvas every scene's implementation mounts through, carrying what all scenes share (pixel-ratio cap, antialiasing, ambient hemisphere light, Suspense) and customized only through props. That three is reachable at all from here is what the WebGL gate and the lazy boundary exist to prevent.
_Avoid_: rig, WebGL setup

**Adapter**:
The thin per-scene entry point deciding *whether* and *where* a scene mounts: it names the scene's implementation, its fallback, and the box the scene occupies. Contains no three.js imports — three reaches a scene only through the implementation it names.
_Avoid_: wrapper, scene file

**Implementation**:
The lazily loaded half of a scene: camera framing, model, lighting overrides and overlays, mounted through SceneCanvas. These are the only files that import three.
_Avoid_: canvas (for the implementation), model

**WebGL gate**:
The mount-time capability check that decides whether a scene renders its real canvas or its fallback.
_Avoid_: probe, capability check

**Fallback**:
What replaces a scene when WebGL is missing or the scene crashed. Per-scene content, rendered in the scene's place.
_Avoid_: error state

**Overlay**:
DOM layered above a live scene (progress bar, view switcher), rendered by the implementation alongside SceneCanvas. Being inside the lazy chunk is what makes an overlay exist only while its scene is up.
_Avoid_: HUD, chrome

**Anchor**:
A 3D node's projected on-screen position, used to place a tooltip beside it.
_Avoid_: projection (that is the act of computing one)

**Hover**:
The single per-scene hovered-id state that both the 3D pointer and the focusable a11y layer drive, so tooltip, tint and focus stay in agreement.
_Avoid_: highlight, active key/region

### Home scene interaction

**Hotspot**:
An authored point of interest in the home scene (macbook, desk, bottle, car, …) with an id, a focus (framing or fit) and optionally a hero.
_Avoid_: point of interest, marker

**View**:
One switchable authored camera state of the home scene, selected from the view switcher; the desk view is the initial one.
_Avoid_: preset, camera pose

**Hero**:
The greeting/label layer above the home scene, shown in modes (`intro`, `macbook`, …) and set by hotspot resolution and camera movement.
_Avoid_: greeting (that is one mode)

**Fly-to**:
The damped camera tween from the current pose to a hotspot's framing, cancelled by user take-over.
_Avoid_: tween, camera animation

### Knowledge graph

**Fit**:
The transform that frames the whole graph inside its viewport. A rough fit frames the graph on first paint, before the layout has settled; a precise fit reframes it once it has. Both yield to the viewer as soon as they zoom or pan.
_Avoid_: reframe, zoom-to-fit

**Label threshold**:
The zoom level above which every node's label shows; below it, only the hovered node's.
_Avoid_: label zoom, reveal zoom

**Leaf**:
A node with exactly one unique neighbor. A reciprocal pair (A→B and B→A) does not make either a leaf — degree alone would double-count the pair and hide a true leaf's tint.
_Avoid_: degree-1 node, end node

**Hub**:
Any node that is not a leaf — isolated nodes included. Hubs share the base node tint; only leaves are drawn distinct. The word does not imply many connections.
_Avoid_: high-degree node

**Emphasis**:
The visual state hover gives a node: hovered, neighbor, or dimmed — idle when nothing is hovered. It layers over the node's base role (leaf or hub).
_Avoid_: highlight, dim rule

**Graph**:
The nodes and edges of the knowledge graph as one immutable set — what the builder produces, the cache stores, and the renderer draws. A snapshot pairs a graph with its cache provenance.
_Avoid_: response, payload

**Snapshot**:
A graph plus its cache provenance: when it was written and how long it has left. What the API serves, and what the page's clock counts down — the first request after a snapshot expires rebuilds it.
_Avoid_: payload, response, cached graph

**Cache clock**:
The page's view of a snapshot's remaining life: how much window the server reported was left, re-anchored to the local moment that answer arrived, and recomputed from wall-clock elapsed time on every tick rather than decremented. A throttled tab therefore comes back correct instead of minutes behind.
_Avoid_: timer, countdown (that is the string it renders)

**Expiry**:
The moment a snapshot's window runs out. The page notices it on the cache clock and asks for a fresh snapshot once per snapshot — a failed ask is not retried on every tick.
_Avoid_: timeout, cache invalidation

### Dashboards

**Activity telemetry**:
The feature answering "how active was I": mouse and keyboard behaviour over a range — totals, the key heatmap, and the activity time series. Sibling to AI usage: the two share infrastructure, never domain logic.
_Avoid_: telemetry (unqualified), activity dashboard

**AI usage**:
The feature answering "where did AI spend go": cost, tokens and session counts over a range, broken down by model, project and harness. Sibling to Activity telemetry: the two share infrastructure, never domain logic.
_Avoid_: AI dashboard, usage (on its own)

**Range**:
How far back a dashboard looks — what the range selector picks. The type and the lookback start are shared; the bucket interval and the option list are each dashboard's own, so a dashboard can re-bucket or add a range without touching its sibling.
_Avoid_: period, timeframe; interval (that is the bucket size, not the range)

**Harness**:
The tool that drove an AI-usage session — the agent runtime the session ran under. One of the three breakdowns; sessions recorded before the collector captured it show as `unknown`.
_Avoid_: client, agent, tool

**Project**:
The repository an AI-usage session's working directory was inferred to belong to. The cwd is matched against ordered substrings, and anything matching none aggregates into `others` — so the order is load-bearing: a project nested under a broader key must be listed first, or its rows fall into the broader one.
_Avoid_: repo, workspace

### Polled pages

**Polled page**:
A page whose data the browser refetches on an interval while it is open. Activity telemetry and AI usage are the polled pages.
_Avoid_: live page, auto-refresh

**Poll**:
The interval-driven background refresh of a polled page's data. A poll replaces the data on screen in place and never shows loading; a failed poll reports its error alongside the data it failed to replace. The knowledge graph is not polled — its refresh is expiry-driven.
_Avoid_: background refresh, sync, heartbeat

**Foreground load**:
A load the viewer caused — first arrival, a range change, or a retry — as opposed to a poll. It may show the loading skeleton, but only where there is no data on screen yet.
_Avoid_: initial load, manual refresh

**Last updated**:
The moment the data currently on screen was received. Every successful response updates it; a failed one leaves it alone.
_Avoid_: refresh time, sync time
