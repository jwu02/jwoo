import type { FocusPreset } from "./scene-focus"

/** The single combined scene model, replacing the five individual per-model GLBs. */
export const HOME_SCENE_MODEL = {
  url: "/homepage.glb",
} as const

export type HomeSceneHotspot = {
  id: string
  /** Top-level node name inside homepage.glb that this hotspot maps to. */
  node: string
  label?: string
  target?: string
  /**
   * Name of a camera node authored inside homepage.glb (e.g. "Camera_Xiaomi").
   * When present and found in the loaded scene, its world position and rotation
   * override the framing preset's cameraPos: the camera flies to the authored
   * position and the orbit target is where the camera's gaze passes nearest the
   * node (see resolveFocus). Falls back to the preset when the node is absent
   * (e.g. the export hasn't included cameras yet).
   */
  camera?: string
  focus: FocusPreset
}

// All five models (plus the Garage and AI Usage props) are combined into one
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
    // Overhead-forward keyboard view: camera in front (+z), raised so its gaze
    // drops ~15° below horizontal onto the keyboard, keeping the typed greeting
    // above in frame. Also sets the scene's initial camera/target/hero on load
    // (see home-canvas). Tunable in dev.
    focus: {
      type: "framing",
      target: [0, 0.78, 0],
      cameraPos: [0, 0.95, 0.65],
      hero: "macbook",
    },
  },
  {
    id: "desk",
    node: "Desk",
    label: "Computer Desk",
    // GLB-authored camera view (fallback: the hand-tuned preset below).
    camera: "Camera_Desk",
    // Front, angled-overhead view of the desk surface: camera up in front (+z)
    // looking down at ~30° with a slight side offset. Tunable in dev.
    focus: {
      type: "framing",
      target: [0, 0.7, 0],
      cameraPos: [0.5, 1.7, 1.6],
      hero: "intro",
    },
  },
  {
    id: "flask",
    node: "Water Flask",
    label: "Water Flask",
    // Bbox-fit view of the flask node alone (fit is computed per-node, not the
    // whole combined scene). Tunable in dev.
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
    id: "car",
    node: "Xiaomi",
    label: "2025 Xiaomi SU7 Ultra",
    // GLB-authored camera view (fallback: the hand-tuned preset below).
    camera: "Camera_Xiaomi",
    // Low, front-right camera aimed at the car's right headlight, so the
    // front-right fender fills the frame. Tunable in dev.
    focus: {
      type: "framing",
      target: [-2.48, 0.55, -0.92],
      cameraPos: [-1.44, 0.9, 1.7],
      hero: "intro",
    },
  },
]
