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
An authored point of interest in the home scene (macbook, desk, bottle, car, …) with an id and what selecting it does: the view the camera takes (a framing or a fit), or a page it navigates to instead. A hotspot may be scenery with no click behaviour of its own.
_Avoid_: point of interest, marker

**View**:
One switchable authored camera state of the home scene, selected from the view switcher; the desk view is the initial one. A hotspot that authors a camera of its own *is* a view — the switcher's buttons are read off the scene's hotspots rather than listed separately, so a new authored camera is reachable the moment it exists.
_Avoid_: preset, camera pose

**Greeting**:
The words the home scene types above its MacBook, and the same words the WebGL-less fallback renders as a heading. Declared once; a *view* decides whether it shows — the load view engages it, so a fresh page greets without a click, and flying to another view dismisses it. The greeting's anchor is a fixed node of the scene, not the hotspot that happens to engage it.
_Avoid_: hero (the component's former name), intro mode

**Take-over**:
The visitor moving the camera themselves. It cancels any fly-to in progress, so the tween never fights the drag — and a take-over that moves the camera clears the selection with it, so the switcher stops claiming a view the visitor has left. What must *not* clear the selection is the flight's own motion: a fly-to's per-frame camera updates are discounted while it runs, or the view would be dismissed the instant it was chosen. The selection therefore survives a press that doesn't move the camera, and only that.
_Avoid_: interaction, cancellation

**Fly-to**:
The damped camera tween from the current pose to a hotspot's framing, cancelled by user take-over.
_Avoid_: tween, camera animation

### Knowledge graph

**Fit**:
The transform that frames the whole graph inside its viewport. A rough fit frames the graph on first paint, before the layout has settled; a precise fit reframes it once it has. Both yield to the viewer as soon as they zoom or pan.
_Avoid_: reframe, zoom-to-fit

**Focus**:
The persistent selection of one note: the camera flies to frame the note's neighborhood — the note and its neighbors — instead of the whole graph. While it lasts the row stays marked and the node keeps its hovered emphasis. It ends on Esc (an Escape in the search field clears the query first), on the panel's clear affordance, or by clicking the focused row again — and it ends where it stands, the camera never returning to where it was. A viewer-driven camera move cancels the flight and clears the focus; a snapshot that no longer holds the note clears it quietly.
_Avoid_: highlight, pin, zoom-to-node

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

**Note**:
The content one node of the graph represents — a note whose title is that node's id. Notes are what the list and search speak of; nodes are what the renderer draws. One thing, two words for two roles.
_Avoid_: entry, document

**Note list**:
The side panel listing every note, newest first, searchable by title. Hovering a row gives its node Emphasis exactly as pointing at the node does; clicking one takes the Focus. On desktop it shares the row with the graph and can be collapsed; below the desktop breakpoint it is an overlay behind a toggle, and the graph keeps the full width.
_Avoid_: sidebar, index, notes panel

**Re-anchor**:
The compensation a layout change makes to the camera: the note list appeared or went, so the graph's viewport is a different width. The zoom is kept and the graph point the viewer had at the centre is put back at the centre, so the change never reframes or clips what they were looking at. It answers to nothing — not the fit's yield-to-viewer rule, since it is compensation for a change the viewer made — and a change that leaves the viewport alone, the note list's overlay, is owed none.
_Avoid_: reframe, resize (that is the browser's), fit (that is the whole graph)

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

**Cache hit rate**:
The share of an AI-usage range's prompt tokens that the prompt cache served. Hit and miss partition the prompt tokens, so the rate is the hit share of that pair; completion tokens are never counted against the cache.
_Avoid_: cache ratio, cache effectiveness

**Harness**:
The tool that drove an AI-usage session — the agent runtime the session ran under. One of the three breakdowns; sessions recorded before the collector captured it show as `unknown`.
_Avoid_: client, agent, tool

**Project**:
The repository an AI-usage session's working directory was inferred to belong to. The cwd is matched against ordered substrings, and anything matching none aggregates into `others` — so the order is load-bearing: a project nested under a broader key must be listed first, or its rows fall into the broader one.
_Avoid_: repo, workspace

### Keyboard heatmap

**Physical key**:
One key position on the tracked MacBook, named for where it sits rather than what it prints — `Left Cmd`, `Touch ID`. Counts aggregate onto these positions, because the heatmap tints key positions rather than the labels a key emits.
_Avoid_: key, keycap, button

**Key label**:
A string the telemetry client emits for a single press — `!`, `Forward Delete`, `Section`. One physical key emits several labels depending on the modifiers held, which is why labels are folded onto keys before anything is counted or drawn.
_Avoid_: key name, character, keycode

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

### Resume

**Section**:
One titled block of the resume — education, languages, technical skills, interests, work experience, personal projects, self evaluation. Each is about one part of the document and nothing else; only the page sees the whole of it.
_Avoid_: panel, block

**Contact**:
A way to reach the person — email, phone, GitHub, WeChat — supplied by the deployment rather than written into the resume. A contact that is not configured simply does not appear. Its value is deployment configuration and never localized; how it is labelled is copy, and localizes with the rest.
_Avoid_: social link, contact detail

**Locale parity**:
The invariant that the two locales are one document: the same sections, the same entries, and the same number of bullets within each. Only the words themselves differ.
_Avoid_: translation sync, i18n completeness
