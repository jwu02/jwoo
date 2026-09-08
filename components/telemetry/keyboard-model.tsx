"use client"

import { useCursor, useGLTF } from "@react-three/drei"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import { resolveTopLevelNode } from "@/components/home/scene-hit"
import { keyIntensity, keycapColor } from "@/lib/telemetry/heatmap-colors"
import {
  heatAlpha,
  hexRgba,
  mapNodeToUv,
  uvToCanvas,
  type Footprint,
} from "@/lib/telemetry/key-heatmap-layer"
import {
  KEYBOARD_DRACO_PATH,
  KEYBOARD_MODEL_URL,
  PHYSICAL_KEY_NODE,
  glbNodeName,
  physicalIdForNode,
} from "@/lib/telemetry/key-node-map"
import type { TooltipAnchor } from "@/lib/telemetry/tooltip-position"

import { fitTopDown, type Bounds3 } from "./keyboard-camera"
import { projectKeyAnchor } from "./keyboard-projection"
import {
  KEY_PRESS_DEPTH_M,
  createSpring,
  springIsSettled,
  stepSpring,
  type SpringState,
} from "./keyboard-spring"

/** Hover read-from-above: emissive lift added to the pressed keycap. Tunable in dev. */
const HOVER_EMISSIVE = 0.35

/** Warm glow colour for the hovered keycap (the ramp's hot orange). */
const HOVER_EMISSIVE_HEX = "#ff8a50"

/** Texture width (px) for the heatmap overlay; height scales with footprint. */
const OVERLAY_CANVAS_WIDTH = 1024

/** Approximate key-column pitch in texture px, used for blob radius + blur. */
const OVERLAY_KEY_COLUMNS = 14

/** Blob radius as a fraction of one key column → overlap fills inter-key gaps. */
const OVERLAY_RADIUS_SCALE = 0.9

/** Blur radius as a fraction of one key column → continuous spectrum, no dots. */
const OVERLAY_BLUR_SCALE = 0.4

/** Overlay plane lifts off the caps by a small fraction of the model height. */
const OVERLAY_LIFT_SCALE = 0.05

export interface KeyboardCanvasApi {
  /** Project a key's 3D node into a tooltip anchor (container-content px). */
  getAnchor(physicalId: string): TooltipAnchor | null
}

interface KeyDef {
  node: THREE.Object3D
  cap: THREE.Mesh
  restY: number
  material: THREE.MeshStandardMaterial
}

interface OverlayInfo {
  texture: THREE.CanvasTexture
  x: number
  y: number
  z: number
  width: number
  depth: number
}

interface KeyboardModelProps {
  /** physical id → press count, recomputed on each poll. */
  counts: Map<string, number>
  /** Highest count across all keys, floored at 1 (see keyboard-heatmap). */
  maxCount: number
  /** Whether the continuous heatmap overlay is shown above the caps. */
  showOverlay: boolean
  /** The currently hovered physical id, or null. */
  hovered: string | null
  /** Called with the hovered physical id (or null) on pointer/focus changes. */
  onHover: (id: string | null) => void
  canvasApiRef: React.MutableRefObject<KeyboardCanvasApi | null>
}

/** Depth-first search for the first actual Mesh in a subtree (the keycap). */
function findFirstMesh(object: THREE.Object3D): THREE.Mesh | null {
  if ((object as THREE.Mesh).isMesh) return object as THREE.Mesh
  for (const child of object.children) {
    const mesh = findFirstMesh(child)
    if (mesh) return mesh
  }
  return null
}

export function KeyboardModel({
  counts,
  maxCount,
  showOverlay,
  hovered,
  onHover,
  canvasApiRef,
}: KeyboardModelProps) {
  const { scene } = useGLTF(KEYBOARD_MODEL_URL, KEYBOARD_DRACO_PATH)
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const size = useThree((state) => state.size)

  // Resolve each physical id's GLB node once, snapshot its rest height, and
  // clone the shared cap material so the hover glow on one keycap never affects
  // the chassis (whose second primitive reuses the same cap material). The caps
  // keep their natural GLB colour — the heatmap is a separate overlay layer.
  const registry = useMemo(() => {
    const byId = new Map<string, KeyDef>()
    for (const id of Object.keys(PHYSICAL_KEY_NODE)) {
      const nodeName = glbNodeName(id)
      if (!nodeName) continue
      const node = scene.getObjectByName(nodeName)
      if (!node) continue
      const cap = findFirstMesh(node)
      if (!cap) continue
      const source = cap.material as THREE.MeshStandardMaterial
      const material = source.clone() as THREE.MeshStandardMaterial
      material.emissive = new THREE.Color(HOVER_EMISSIVE_HEX)
      material.emissiveIntensity = 0
      cap.material = material
      byId.set(id, { node, cap, restY: node.position.y, material })
    }
    return byId
  }, [scene])

  // Spring state per key (persistent, so a re-hover resumes from the current
  // value instead of snapping to the target).
  const springsRef = useRef(new Map<string, SpringState>())
  const activeRef = useRef(new Set<string>())
  const hoveredRef = useRef<string | null>(hovered)
  const prevHoveredRef = useRef<string | null>(null)

  useEffect(() => {
    hoveredRef.current = hovered
    // Wake the spring for the newly-backed-off key (target 0) and the newly
    // pressed key (target 1) so both animate; the animator settles and drops
    // each once it reaches its target.
    const prev = prevHoveredRef.current
    if (prev !== hovered) {
      if (prev) activeRef.current.add(prev)
      if (hovered) activeRef.current.add(hovered)
      prevHoveredRef.current = hovered
    }
  }, [hovered])

  // Frame the top-down camera to fit the whole keyboard, and re-fit on resize.
  const boundsRef = useRef<Bounds3 | null>(null)
  const applyFrame = useCallback(() => {
    const bounds = boundsRef.current
    if (!bounds) return
    const aspect = size.width / Math.max(size.height, 1)
    const frame = fitTopDown({ bounds, fovDeg: camera.fov, aspect })
    // The default up (+Y) is parallel to this top-down view, which degenerates
    // lookAt — so set world −Z as screen-up BEFORE the first lookAt.
    camera.up.set(frame.up.x, frame.up.y, frame.up.z)
    camera.position.set(
      frame.cameraPos.x,
      frame.cameraPos.y,
      frame.cameraPos.z,
    )
    camera.lookAt(frame.target.x, frame.target.y, frame.target.z)
  }, [camera, size])

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    if (box.isEmpty()) return
    boundsRef.current = { min: box.min.clone(), max: box.max.clone() }
    applyFrame()
  }, [scene, applyFrame])

  useEffect(() => {
    applyFrame()
  }, [size, applyFrame])

  // Build the continuous heatmap overlay texture whenever the counts change:
  // a radial-gradient blob per hot key, at the key's footprint UV, smeared by a
  // smoothing blur into one continuous colour spectrum. Cold keys (count 0) are
  // skipped so the natural cap shows through the transparent background.
  const [overlay, setOverlay] = useState<OverlayInfo | null>(null)
  useEffect(() => {
    if (!showOverlay) return
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    if (box.isEmpty()) return

    const footprint: Footprint = {
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z,
    }
    const width = footprint.maxX - footprint.minX
    const depth = footprint.maxZ - footprint.minZ

    const canvasWidth = OVERLAY_CANVAS_WIDTH
    const canvasHeight = Math.max(
      1,
      Math.round(canvasWidth * (depth / width)),
    )
    const canvas = document.createElement("canvas")
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const keyPitch = canvasWidth / OVERLAY_KEY_COLUMNS
    const radius = keyPitch * OVERLAY_RADIUS_SCALE
    // Blur the whole layer so neighbouring keys meld into a continuous field.
    ctx.filter = `blur(${Math.round(keyPitch * OVERLAY_BLUR_SCALE)}px)`

    const nodePos = new THREE.Vector3()
    for (const [id, def] of registry) {
      const count = counts.get(id) ?? 0
      if (count <= 0) continue
      const intensity = keyIntensity(count, maxCount)
      def.node.getWorldPosition(nodePos)
      const { u, v } = mapNodeToUv(nodePos.x, nodePos.z, footprint)
      const { x, y } = uvToCanvas(u, v, canvasWidth, canvasHeight)
      const color = keycapColor(intensity)
      const alpha = heatAlpha(intensity)
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
      grad.addColorStop(0, hexRgba(color, alpha))
      grad.addColorStop(1, hexRgba(color, 0))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    // Pin flipY so uvToCanvas's inverted vertical mapping is enforced, not
    // implicit — a silent flipY change would mirror the overlay top-to-bottom.
    texture.flipY = true

    const modelHeight = box.max.y - box.min.y
    const overlayY = box.max.y + modelHeight * OVERLAY_LIFT_SCALE
    // This effect derives a canvas texture from the loaded GLB scene — an
    // external system — and reflects it in state via the texture swap below.
    // There is no reactive (non-effect) way to rasterize after the scene loads,
    // so a one-shot setState is intentional; the rule is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverlay((prev) => {
      prev?.texture.dispose()
      return {
        texture,
        x: (box.min.x + box.max.x) / 2,
        y: overlayY,
        z: (box.min.z + box.max.z) / 2,
        width,
        depth,
      }
    })
    return () => {
      setOverlay((prev) => {
        prev?.texture.dispose()
        return null
      })
    }
  }, [scene, registry, counts, maxCount, showOverlay])

  // Expose the tooltip anchor projection via the api ref the wrapper owns.
  useEffect(() => {
    canvasApiRef.current = {
      getAnchor: (physicalId: string): TooltipAnchor | null => {
        const nodeName = glbNodeName(physicalId)
        if (!nodeName) return null
        const node = scene.getObjectByName(nodeName)
        if (!node) return null
        return projectKeyAnchor(node, camera, size)
      },
    }
    return () => {
      canvasApiRef.current = null
    }
  }, [scene, camera, size, canvasApiRef])

  useCursor(hovered != null)

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      const name = resolveTopLevelNode(event.object, scene)
      onHover(name ? physicalIdForNode(name) : null)
    },
    [scene, onHover],
  )
  const handlePointerOut = useCallback(() => onHover(null), [onHover])
  // iOS taps don't reliably fire pointermove — treat a pointerdown as a tap.
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      const name = resolveTopLevelNode(event.object, scene)
      onHover(name ? physicalIdForNode(name) : null)
    },
    [scene, onHover],
  )

  // Advance the active springs and write the press depth + emissive onto the
  // keycap nodes. No React state per frame.
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const current = hoveredRef.current
    for (const id of activeRef.current) {
      const def = registry.get(id)
      if (!def) continue
      const target = current === id ? 1 : 0
      const spring =
        springsRef.current.get(id) ?? createSpring(0)
      const next = stepSpring(spring, target, dt)
      springsRef.current.set(id, next)
      def.node.position.y = def.restY - KEY_PRESS_DEPTH_M * next.value
      def.material.emissiveIntensity = next.value * HOVER_EMISSIVE
      if (springIsSettled(next)) {
        activeRef.current.delete(id)
        // Snap exactly to rest/pressed on settle to avoid sub-pixel drift.
        if (target === 0) def.node.position.y = def.restY
        else def.node.position.y = def.restY - KEY_PRESS_DEPTH_M
      }
    }
  })

  return (
    <group
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
    >
      <primitive object={scene} />
      {showOverlay && overlay && (
        <mesh
          position={[overlay.x, overlay.y, overlay.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          // Transparent overlay must never intercept hover — let events fall
          // through to the keycaps below so the press + tooltip still work.
          raycast={() => null}
        >
          <planeGeometry args={[overlay.width, overlay.depth]} />
          <meshBasicMaterial
            map={overlay.texture}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}
