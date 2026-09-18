import type { FocusPreset, FramingPreset } from "./scene-focus"

/** The single combined scene model, replacing the five individual per-model GLBs. */
export const HOME_SCENE_MODEL = {
  url: "/homepage.glb",
} as const

/**
 * The greeting typed in-scene above a hotspot's node once a view engages it (see
 * `greeting` on the hotspot). Declared once here rather than on the hotspot that
 * happens to be the greeting's anchor: the anchor node and the view that shows
 * it are different things — the desk view engages the greeting, but the greeting
 * floats above the MacBook.
 *
 * Shared with the WebGL-less fallback, which renders the same words as a static
 * heading (see home-greeting).
 */
export const HOME_GREETING = {
  /** Top-level node name inside homepage.glb the greeting floats above. */
  node: "MacBook",
  text: "Hi, I'm Tony.",
} as const

export type HomeSceneHotspot = {
  id: string
  /** Top-level node name inside homepage.glb that this hotspot maps to. */
  node: string
  label?: string
  target?: string
  /**
   * Short label for the view switcher pill, set on the hotspots that are views
   * (see HOME_VIEWS). The full `label` is the hover tooltip's copy; the pill
   * needs something that reads as a button ("Desk", not "Computer Desk").
   */
  viewLabel?: string
  /**
   * Whether this view engages the greeting (HOME_GREETING) while it is the
   * selected one. Only the loaded view does, so a scene-loading visitor is
   * greeted without a click; selecting another view dismisses it.
   */
  greeting?: boolean
  /**
   * Marks the view a freshly loaded scene starts framed on. Exactly one hotspot
   * sets it — see HOME_INITIAL_VIEW.
   */
  initial?: boolean
  /**
   * Whether the hotspot is interactive (hover tooltip + click action). Defaults
   * to true; set to false for a hotspot that only supplies a camera view for the
   * switcher / initial frame and should not make the object itself hoverable or
   * clickable (e.g. the desk, which is scenery rather than a clickable object).
   */
  interactive?: boolean
  /**
   * Name of a camera node authored inside homepage.glb (e.g. "CameraXiaomi").
   * When present and found in the loaded scene, its world position and rotation
   * override the framing preset's cameraPos: the camera flies to the authored
   * position and the orbit target is where the camera's gaze passes nearest the
   * node (see resolveFocus). Falls back to the preset when the node is absent
   * (e.g. the export hasn't included cameras yet).
   */
  camera?: string
  /**
   * Where the camera goes when this hotspot is clicked or selected. Absent on a
   * hotspot that has no view of its own — the MacBook navigates to its page
   * instead of being framed, so there is nothing to fly to.
   */
  focus?: FocusPreset
}

// All five models (plus the Garage and AiUsage props) are combined into one
// homepage.glb with their transforms baked in by Blender, so the scene loads a
// single model and the hotspots reference its top-level node names. The framing
// camera positions were tuned against the old per-model layout; they may need a
// browser pass against the combined arrangement (tunable in dev).
export const HOME_SCENE_HOTSPOTS: HomeSceneHotspot[] = [
  {
    id: "macbook",
    node: "MacBook",
    label: "Activity Telemetry",
    target: "/activity-telemetry",
  },
  {
    id: "desk",
    node: "Desk",
    label: "Computer Desk",
    viewLabel: "Desk",
    // The loaded view: a fresh scene is framed on the desk and greets without a
    // click. The greeting is anchored above the MacBook (HOME_GREETING.node),
    // which is why the desk's own node name isn't the greeting's.
    initial: true,
    greeting: true,
    // The desk is scenery, not a clickable object, so it is not interactive: it
    // supplies only the initial frame and its switcher view, and is excluded
    // from hover tooltips and click actions.
    interactive: false,
    // GLB-authored camera view (fallback: the hand-tuned preset below).
    camera: "CameraDesk",
    // Front, angled-overhead view of the desk surface: camera up in front (+z)
    // looking down at ~30° with a slight side offset. Tunable in dev.
    focus: {
      type: "framing",
      target: [0, 0.7, 0],
      cameraPos: [0.5, 1.7, 1.6],
    },
  },
  {
    id: "bottle",
    node: "WaterBottle",
    label: "Water Bottle",
    // Bbox-fit view of the bottle node alone (fit is computed per-node, not the
    // whole combined scene). Tunable in dev.
    focus: { type: "fit" },
  },
  {
    id: "bonsai",
    node: "Bonsai",
    label: "Bonsai",
    // Bbox-fit view of the bonsai tree node alone. Tunable in dev.
    focus: { type: "fit" },
  },
  {
    id: "resume",
    node: "Resume",
    label: "Resume",
    target: "/resume",
    // Bbox-fit view of the resume node alone. Tunable in dev.
    focus: { type: "fit" },
  },
  {
    id: "ai-usage",
    node: "AiUsage",
    label: "AI Usage",
    target: "/ai-usage",
    // Bbox-fit view of the AI Usage prop alone. Tunable in dev.
    focus: { type: "fit" },
  },
  {
    id: "car",
    node: "XiaomiSu7Ultra",
    label: "2025 Xiaomi SU7 Ultra",
    viewLabel: "Xiaomi SU7",
    // GLB-authored camera view (fallback: the hand-tuned preset below).
    camera: "CameraXiaomi",
    // Low, front-right camera aimed at the car's right headlight, so the
    // front-right fender fills the frame. Tunable in dev.
    focus: {
      type: "framing",
      target: [-2.48, 0.55, -0.92],
      cameraPos: [-1.44, 0.9, 1.7],
    },
  },
]

/** The hotspot with this id, or undefined. The one by-id lookup the scene shares. */
export function findHotspot(id: string): HomeSceneHotspot | undefined {
  return HOME_SCENE_HOTSPOTS.find((hotspot) => hotspot.id === id)
}

export type HomeView = { id: string; label: string }

/**
 * The preset camera views surfaced as buttons in the home view switcher pill,
 * derived from the hotspots rather than hand-maintained: a hotspot backed by an
 * authored GLB camera is a view a visitor can jump to, so adding a camera to a
 * hotspot adds a button with no second list to keep in step.
 *
 * A camera-backed hotspot without a `viewLabel` has no pill copy and is skipped
 * rather than silently labelled with its full tooltip name; scene-config's test
 * asserts that never happens.
 */
export const HOME_VIEWS: HomeView[] = HOME_SCENE_HOTSPOTS.flatMap((hotspot) =>
  hotspot.camera && hotspot.viewLabel
    ? [{ id: hotspot.id, label: hotspot.viewLabel }]
    : [],
)

/**
 * The view a freshly loaded scene starts framed on: the hotspot marked
 * `initial`. Its cameraPos/target seat the camera and the orbit controls before
 * the GLB resolves, and the controller marks it selected so the greeting types
 * without a click.
 *
 * It must be a framing hotspot — a bbox fit has no camera position to seat the
 * camera at until the model has loaded, which is exactly what the preset is for.
 */
function requireInitialView(): { hotspot: HomeSceneHotspot; framing: FramingPreset } {
  const initial = HOME_SCENE_HOTSPOTS.filter((hotspot) => hotspot.initial)
  const [hotspot] = initial
  // Both halves are load-bearing: none leaves the scene with no camera to seat,
  // and two or more makes "the" initial view ambiguous — `find` would silently
  // pick the first, so the count is checked rather than the first match.
  if (initial.length !== 1 || hotspot.focus?.type !== "framing") {
    throw new Error(
      "home scene config: exactly one hotspot must set `initial` and carry a framing focus preset",
    )
  }
  return { hotspot, framing: hotspot.focus }
}

export const HOME_INITIAL_VIEW = requireInitialView()
