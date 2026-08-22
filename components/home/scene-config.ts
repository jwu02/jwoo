export type HomeSceneModel = {
  id: string
  url: string
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
  label?: string
  target?: string
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
  },
  {
    id: "desk",
    url: "/computer_desk.glb",
    label: "Computer Desk",
    position: [0, 0, 0],
    scale: [1, 1, 1],
  },
  {
    id: "car",
    url: "/2025_xiaomi_su7_ultra.glb",
    label: "2025 Xiaomi SU7 Ultra",
    // Native bbox is 0.022 × 0.015 × 0.051 (x/y/z); the long axis is z, so at
    // scale 100 it becomes 2.2 × 1.5 × 5.1 units — z-length ≈ 2.8× the desk's
    // 1.8-unit length (matches "~3× a desk's length"). Placed 5 units behind
    // the desk (base at y≈0 sits on the ground plane like the desk). Initial
    // values pending the human browser pass.
    position: [0, 0, -5],
    scale: [100, 100, 100],
  },
]
