import type { FocusPreset, Vec3 } from "./scene-focus"

export type HomeSceneModel = {
  id: string
  url: string
  position: Vec3
  scale: Vec3
  rotation?: Vec3
  label?: string
  target?: string
  focus: FocusPreset
}

export const HOME_SCENE_MODELS: HomeSceneModel[] = [
  {
    id: "macbook",
    url: "/macbook_pro_14-inch_m5.glb",
    label: "Activity Telemetry",
    target: "/activity-telemetry",
    // Seated on the desk top (desk bbox top y≈0.736; MacBook bbox base sits at
    // local y≈-0.009, so exact seat is 0.736 + 0.009 ≈ 0.745; 0.75 lands within
    // ~5mm). Initial value pending the human browser pass.
    position: [0, 0.75, 0],
    scale: [1, 1, 1],
    // Overhead-forward keyboard view: camera in front (+z), raised so its gaze
    // drops ~15° below horizontal onto the keyboard (atan of
    // (cameraY - targetY) / cameraZ ≈ atan(0.17 / 0.65) ≈ 15°), showing the
    // keys with the typed greeting staying above in frame. This preset also
    // sets the scene's initial camera/target/hero on load (see home-canvas).
    // Tunable in dev.
    focus: {
      type: "framing",
      target: [0, 0.78, 0],
      cameraPos: [0, 0.95, 0.65],
      hero: "macbook",
    },
  },
  {
    id: "desk",
    url: "/computer_desk.glb",
    label: "Computer Desk",
    position: [0, 0, 0],
    scale: [1, 1, 1],
    // Front, angled-overhead view of the desk surface: camera up in front (+z)
    // looking down at ~30° with a slight side offset, so the surface (and the
    // MacBook on it) reads at a diagonal. Tunable in dev.
    focus: {
      type: "framing",
      target: [0, 0.7, 0],
      cameraPos: [0.5, 1.7, 1.6],
      hero: "intro",
    },
  },
  {
    id: "car",
    url: "/2025_xiaomi_su7_ultra.glb",
    label: "2025 Xiaomi SU7 Ultra",
    // Native bbox is 0.022 × 0.015 × 0.051 (x/y/z); the long axis is z, so at
    // scale 100 it becomes 2.2 × 1.5 × 5.1 units — z-length ≈ 2.8× the desk's
    // 1.8-unit length (matches "~3× a desk's length"). Parked to the left (-x)
    // of the desk and rotated ~45° around Y (+π/4 swings the nose toward +x/+z,
    // i.e. toward the desk/camera), so it reads at a diagonal instead of facing
    // the camera head-on. Base at y≈0 sits on the ground plane like the desk.
    // Initial values pending the human browser pass.
    position: [-3.5, 0, -3.5],
    rotation: [0, Math.PI / 4, 0],
    scale: [100, 100, 100],
    // Low, front-right camera aimed at the car's right headlight. The nose is
    // local +z (rotated to world +x/+z); facing the nose, the driver's right
    // is -x, so the right headlight sits at the front-right corner, ~world
    // (-2.48, 0.55, -0.92). Target = that headlight; the camera is ~2.8 units
    // out in front-right at headlight height, so the headlight is the focal
    // point with the front-right fender filling the frame. Tunable in dev.
    focus: {
      type: "framing",
      target: [-2.48, 0.55, -0.92],
      cameraPos: [-1.44, 0.9, 1.7],
      hero: "intro",
    },
  },
]
