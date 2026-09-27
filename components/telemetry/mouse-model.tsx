"use client"

import { useCursor, useGLTF } from "@react-three/drei"
import { useThree, type ThreeEvent } from "@react-three/fiber"
import { useCallback, useEffect, useRef } from "react"
import * as THREE from "three"

import { projectNodeSpan } from "@/components/three/scene-span";
import {
  MOUSE_DRACO_PATH,
  MOUSE_MODEL_URL,
  MOUSE_REGION_NODES,
  resolveMouseRegion,
  type MouseRegion,
} from "@/lib/telemetry/mouse-node-map"
import type { TooltipAnchor } from "@/lib/ui/tooltip-position"

import { fitTopDown, type Bounds3 } from "./keyboard-camera"

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

// The hover look, shared by every region mesh: the textures are simply absent
// (not tinted over), so the region reads as a solid matte orange. One material
// instance is enough because the look carries no per-mesh state — hover swaps
// each mesh's material to this and back to its own rest material.
const MOUSE_HOVER_MATERIAL = new THREE.MeshStandardMaterial({
  color: new THREE.Color(MOUSE_HOVER_HEX),
  metalness: 0,
  roughness: 1,
})

// One region mesh plus the isolated copy of its GLB material. Each mesh gets its
// own clone so a hovered region never writes over a shared primitive used by its
// neighbour (the left/right buttons ship one shared material).
interface RegionMesh {
  mesh: THREE.Mesh
  rest: THREE.MeshStandardMaterial
}

/** Point one region mesh at the shared highlight, or back at its rest material. */
function applyRegionState(entry: RegionMesh, active: boolean) {
  entry.mesh.material = active ? MOUSE_HOVER_MATERIAL : entry.rest
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

  // Resolve each region's meshes (descendants of its node) once and keep an
  // isolated clone of each mesh's GLB material as its rest state, so hover can
  // swap the mesh's material between the two. Keyed on the GLB scene so it is
  // captured once, never re-walked.
  const regionMeshesRef = useRef<Map<MouseRegion, RegionMesh[]>>(new Map())
  useEffect(() => {
    const resolved = new Map<MouseRegion, RegionMesh[]>()
    for (const region of Object.keys(MOUSE_REGION_NODES) as MouseRegion[]) {
      const meshes: RegionMesh[] = []
      for (const name of MOUSE_REGION_NODES[region]) {
        const node = scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name))
        if (!node) continue
        node.traverse((object) => {
          const mesh = object as THREE.Mesh
          if (!mesh.isMesh) return
          const material = mesh.material as THREE.MeshStandardMaterial
          if (!material?.color) return
          // Clone per mesh so adjacent regions (the left/right buttons ship one
          // shared primitive) never fight over the same material — the clone is
          // this mesh's rest material and is restored verbatim, so one region
          // can never leave its highlight on another.
          const isolated = material.clone()
          mesh.material = isolated
          meshes.push({ mesh, rest: isolated })
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
    const bodyNode = scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName("Body"))
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
        const node = scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name))
        if (!node) return null
        // The region's on-screen silhouette: the tooltip sits above its top edge
        // and flips below using its height.
        const span = projectNodeSpan(node, camera, size);
        return (
          span && { centerX: span.centerX, keyTop: span.top, keyHeight: span.bottom - span.top }
        );
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

  // Hover highlight: swap each region mesh's material between the shared flat
  // orange highlight and its own rest material. A plain React effect on
  // `hovered` (no per-frame loop) — hover changes colour rather than pressing
  // down.
  useEffect(() => {
    for (const [region, meshes] of regionMeshesRef.current) {
      const active = region === hovered
      for (const entry of meshes) applyRegionState(entry, active)
    }
  }, [hovered])

  return (
    <group onPointerMove={handlePointerMove} onPointerOut={handlePointerOut}>
      <primitive object={scene} />
    </group>
  )
}
