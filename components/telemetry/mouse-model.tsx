"use client"

import { useCursor, useGLTF } from "@react-three/drei"
import { useThree, type ThreeEvent } from "@react-three/fiber"
import { useCallback, useEffect, useRef } from "react"
import * as THREE from "three"

import {
  MOUSE_DRACO_PATH,
  MOUSE_MODEL_URL,
  MOUSE_REGION_NODES,
  resolveMouseRegion,
  runtimeMouseNodeName,
  type MouseRegion,
} from "@/lib/telemetry/mouse-node-map"
import type { TooltipAnchor } from "@/lib/telemetry/tooltip-position"

import { fitTopDown, type Bounds3 } from "./keyboard-camera"
import { projectKeyAnchor } from "./keyboard-projection"

export interface MouseCanvasApi {
  /** Project a region's node into a tooltip anchor (container-content px). */
  getAnchor(region: MouseRegion): TooltipAnchor | null
}

interface MouseModelProps {
  hovered: MouseRegion | null
  onHover: (region: MouseRegion | null) => void
  canvasApiRef: React.MutableRefObject<MouseCanvasApi | null>
}

// Hover highlight colour: the same warm orange the keycaps were filled with
// before — Claude brand orange, matching the --claude-orange in globals.css
// (identical in light & dark, so a plain hex stays in sync without a per-theme
// skin). THREE.Color.set() parses the "#rrggbb" string directly.
const MOUSE_HOVER_HEX = "#d97757"

// The material surface values to restore when a mesh leaves hover, so the same
// isolated material can be toggled in place between its textured GLB look and a
// flat orange highlight (peels off every texture-backed channel, not just
// `color`, because setting only `color` leaves the baseColor texture tinting
// the whole surface).
interface MaterialRest {
  colorHex: number
  emissiveHex: number
  metalness: number
  roughness: number
  map: THREE.Texture | null
  metalnessMap: THREE.Texture | null
  roughnessMap: THREE.Texture | null
  emissiveMap: THREE.Texture | null
}

// One region mesh and the isolated material it keeps mounted regardless of hover.
// Each mesh gets its own clone of the GLB primitive so a hovered region never
// writes over a shared primitive used by its neighbour (the left/right buttons
// ship one shared material).
interface RegionMesh {
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  rest: MaterialRest
}

// Apply either the flat hover highlight or the captured rest state onto a mesh's
// material. The hover look strips the colour/roughness/emissive maps and zeroes
// metallicity so the region reads as a solid matte orange instead of an orange
// tint blended over the original texture.
function applyRegionState(
  material: THREE.MeshStandardMaterial,
  active: boolean,
  rest: MaterialRest,
) {
  if (active) {
    material.map = null
    material.metalnessMap = null
    material.roughnessMap = null
    material.emissiveMap = null
    material.emissive.setHex(0)
    material.metalness = 0
    material.roughness = 1
    material.color.set(MOUSE_HOVER_HEX)
    return
  }
  material.map = rest.map
  material.metalnessMap = rest.metalnessMap
  material.roughnessMap = rest.roughnessMap
  material.emissiveMap = rest.emissiveMap
  material.emissive.setHex(rest.emissiveHex)
  material.metalness = rest.metalness
  material.roughness = rest.roughness
  material.color.setHex(rest.colorHex)
}

export function MouseModel({ hovered, onHover, canvasApiRef }: MouseModelProps) {
  const { scene } = useGLTF(MOUSE_MODEL_URL, MOUSE_DRACO_PATH)
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const size = useThree((state) => state.size)

  // Scene-derived geometry, captured once after the GLB loads. Held in refs so
  // camera framing and the hover-colour walk never re-render the component.
  const fitBoundsRef = useRef<Bounds3 | null>(null)
  // The look target: the mouse SHELL centre. The full scene bbox is pulled off
  // the body by the cable, side buttons, power switch and glide plate, so the
  // camera centres that box and the mouse drifts to one side — the fix is to
  // look at the shell while still framing the full box (for the clip distance).
  const bodyCenterRef = useRef<THREE.Vector3 | null>(null)

  // Resolve each region's meshes (descendants of its node) once and snapshot the
  // original material surface, so hover can toggle each mesh's isolated material
  // in place between its textured look and a flat orange highlight. Keyed on the
  // GLB scene so it is captured once, never re-walked.
  const regionMeshesRef = useRef<Map<MouseRegion, RegionMesh[]>>(new Map())
  useEffect(() => {
    const resolved = new Map<MouseRegion, RegionMesh[]>()
    for (const region of Object.keys(MOUSE_REGION_NODES) as MouseRegion[]) {
      const meshes: RegionMesh[] = []
      for (const name of MOUSE_REGION_NODES[region]) {
        const node = scene.getObjectByName(runtimeMouseNodeName(name))
        if (!node) continue
        node.traverse((object) => {
          const mesh = object as THREE.Mesh
          if (!mesh.isMesh) return
          const material = mesh.material as THREE.MeshStandardMaterial
          if (!material?.color) return
          // Clone per mesh so adjacent regions (the left/right buttons ship one
          // shared primitive) never fight over the same material — without this
          // isolation the last write wins: hovering one button tints the other,
          // and the region restored first wipes its own tint.
          const isolated = material.clone()
          mesh.material = isolated
          meshes.push({
            mesh,
            material: isolated,
            rest: {
              colorHex: isolated.color.getHex(),
              emissiveHex: isolated.emissive.getHex(),
              metalness: isolated.metalness,
              roughness: isolated.roughness,
              map: isolated.map,
              metalnessMap: isolated.metalnessMap,
              roughnessMap: isolated.roughnessMap,
              emissiveMap: isolated.emissiveMap,
            },
          })
        })
      }
      resolved.set(region, meshes)
    }
    regionMeshesRef.current = resolved
  }, [scene])

  // Frame the fixed top-down camera to fit the whole model, then re-fit on
  // resize. up=(0,0,1) puts the mouse's front (+Z) at the top, matching the old
  // SVG's buttons-at-top layout. The camera stands back far enough to fit the
  // full scene box (so no part clips) but LOOKS at the shell centre, keeping the
  // body centred on screen.
  const applyFrame = useCallback(() => {
    const bounds = fitBoundsRef.current
    const bodyCenter = bodyCenterRef.current
    if (!bounds || !bodyCenter) return
    const aspect = size.width / Math.max(size.height, 1)
    const frame = fitTopDown({
      bounds,
      fovDeg: camera.fov,
      aspect,
      up: { x: 0, y: 0, z: 1 },
      // Fit the mouse to the canvas — near-zero headroom (1 = touches the edges),
      // so the model scales up to fill the card. The tooltip flips below the
      // button when there's no room above, so framing close never clips it.
      margin: 1.02,
    })
    const distance = frame.cameraPos.y - frame.target.y
    camera.up.set(frame.up.x, frame.up.y, frame.up.z)
    camera.position.set(bodyCenter.x, bodyCenter.y + distance, bodyCenter.z)
    camera.lookAt(bodyCenter.x, bodyCenter.y, bodyCenter.z)
  }, [camera, size])

  // Resolve the scene bounds once and frame to the mouse's own footprint. The
  // fit box is the full scene (for the standoff distance) while the look target
  // is the shell's own centre, so the body sits centred and the cable / side
  // buttons / power switch hang off the frame edge rather than pulling the mouse
  // off-centre.
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    if (box.isEmpty()) return
    fitBoundsRef.current = box
    const bodyNode = scene.getObjectByName(runtimeMouseNodeName("Body"))
    bodyCenterRef.current = bodyNode
      ? new THREE.Box3().setFromObject(bodyNode).getCenter(new THREE.Vector3())
      : box.getCenter(new THREE.Vector3())
    applyFrame()
  }, [scene, applyFrame])

  useEffect(() => {
    applyFrame()
  }, [size, applyFrame])

  // Expose the tooltip anchor projection via the api ref the wrapper owns.
  useEffect(() => {
    canvasApiRef.current = {
      getAnchor: (region: MouseRegion): TooltipAnchor | null => {
        const name = MOUSE_REGION_NODES[region][0]
        const node = scene.getObjectByName(runtimeMouseNodeName(name))
        if (!node) return null
        return projectKeyAnchor(node, camera, size)
      },
    }
    return () => {
      canvasApiRef.current = null
    }
  }, [scene, camera, size, canvasApiRef])

  // The body is not draggable, so a hover shows a pointer cursor (a "grab"
  // cursor would imply a slide interaction that no longer exists).
  useCursor(hovered != null, "pointer")

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      onHover(resolveMouseRegion(event.object, scene))
    },
    [scene, onHover],
  )
  const handlePointerOut = useCallback(() => onHover(null), [onHover])

  // Hover highlight: toggle each region mesh's material between a flat orange
  // highlight and its captured textured state. A plain React effect on
  // `hovered` (no per-frame loop) — hover changes colour rather than pressing
  // down. The highlight is flat because the active state strips the map channels
  // (not just `color`), so the original texture no longer shows through the tint.
  useEffect(() => {
    const regionMeshes = regionMeshesRef.current
    for (const [region, meshes] of regionMeshes) {
      const active = region === hovered
      for (const { material, rest } of meshes) {
        applyRegionState(material, active, rest)
      }
    }
  }, [hovered])

  return (
    <group onPointerMove={handlePointerMove} onPointerOut={handlePointerOut}>
      <primitive object={scene} />
    </group>
  )
}
