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
