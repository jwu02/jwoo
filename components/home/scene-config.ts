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
    position: [0, 1.1, 0],
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
    position: [0, 0, -4],
    scale: [1, 1, 1],
  },
]
