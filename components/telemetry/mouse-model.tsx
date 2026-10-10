"use client"

import { useCursor, useGLTF } from "@react-three/drei"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
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

// The hover look, shared by every region mesh as a TEMPLATE: the textures are
// simply absent (not tinted over), so the region reads as a solid matte orange.
// Each region mesh gets its own clone so the faded-in opacity is per-part.
const MOUSE_HOVER_MATERIAL = new THREE.MeshStandardMaterial({
  color: new THREE.Color(MOUSE_HOVER_HEX),
  metalness: 0,
  roughness: 1,
})

/** Exponential approach rate (per second) for a part's hover fade. */
const MOUSE_FADE_RATE = 9

/** An unfaded part's opacity below this snaps to its target, so a settled part
 *  costs nothing per frame. */
const MOUSE_FADE_EPSILON = 0.01

/** Ease one overlay's opacity toward its target (0 or 1), snapping on arrival. */
function stepFade(
  material: THREE.MeshStandardMaterial,
  target: number,
  blend: number,
) {
  if (material.opacity === target) return
  material.opacity += (target - material.opacity) * blend
  if (Math.abs(target - material.opacity) < MOUSE_FADE_EPSILON) {
    material.opacity = target
  }
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

  // Resolve each region's meshes (descendants of its node) once, and hang a
  // highlight overlay off every one: a copy of the region's own geometry at
  // local identity (so it tracks the parent transform exactly) whose material
  // is a per-mesh clone of MOUSE_HOVER_MATERIAL, transparent and fully faded
  // out. Hover animates that opacity instead of swapping `mesh.material`, which
  // is what turns the old instant tint into a cross-fade — and the GLB's own
  // (possibly shared) materials are never touched. Keyed on the GLB scene so it
  // is captured once, never re-walked.
  const regionOverlaysRef = useRef<Map<MouseRegion, THREE.MeshStandardMaterial[]>>(
    new Map(),
  )
  useEffect(() => {
    const resolved = new Map<MouseRegion, THREE.MeshStandardMaterial[]>()
    for (const region of Object.keys(MOUSE_REGION_NODES) as MouseRegion[]) {
      const overlays: THREE.MeshStandardMaterial[] = []
      for (const name of MOUSE_REGION_NODES[region]) {
        const node = scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name))
        if (!node) continue
        // Collect the meshes before adding overlays — traverse() would otherwise
        // descend into the overlay it just saw added.
        const meshes: THREE.Mesh[] = []
        node.traverse((object) => {
          const mesh = object as THREE.Mesh
          if (!mesh.isMesh) return
          const material = mesh.material as THREE.MeshStandardMaterial
          if (!material?.color) return
          meshes.push(mesh)
        })
        for (const mesh of meshes) {
          const material = MOUSE_HOVER_MATERIAL.clone()
          material.transparent = true
          material.opacity = 0
          material.depthWrite = false
          const overlay = new THREE.Mesh(mesh.geometry, material)
          // Hover resolution walks up from the hit mesh, so a no-op raycast keeps
          // the hit set identical to the GLB's own meshes.
          overlay.raycast = () => {}
          mesh.add(overlay)
          overlays.push(material)
        }
      }
      resolved.set(region, overlays)
    }
    regionOverlaysRef.current = resolved
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

  // Hover fade: ease every part's overlay opacity toward 1 (this region) or 0
  // (everything else). Runs per frame — no React state — and a part already at
  // its target is skipped, so an idle mouse does no work.
  useFrame((_state, delta) => {
    const blend = 1 - Math.exp(-delta * MOUSE_FADE_RATE)
    for (const [region, materials] of regionOverlaysRef.current) {
      const target = region === hovered ? 1 : 0
      for (const material of materials) stepFade(material, target, blend)
    }
  })

  return (
    <group onPointerMove={handlePointerMove} onPointerOut={handlePointerOut}>
      <primitive object={scene} />
    </group>
  )
}
