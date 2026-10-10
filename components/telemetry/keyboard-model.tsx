"use client"

import { useCursor, useGLTF } from "@react-three/drei"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import { resolveTopLevelNode } from "@/components/home/scene-hit"
import { projectNodeSpan } from "@/components/three/scene-span"
import { keyIntensity, keycapColor } from "@/lib/telemetry/heatmap-colors"
import {
  KEYBOARD_DRACO_PATH,
  KEYBOARD_MODEL_URL,
  PHYSICAL_KEY_NODE,
  glbNodeName,
  physicalIdForNode,
} from "@/lib/telemetry/key-node-map"
import type { TooltipAnchor } from "@/lib/ui/tooltip-position"

import { fitTopDown, type Bounds3 } from "./keyboard-camera"
import {
  KEY_PRESS_DEPTH_M,
  createSpring,
  springIsSettled,
  stepSpring,
  type SpringState,
} from "./keyboard-spring"

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

/** Footprint (top-down extent) of the keyboard, in world units. */
interface Footprint {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/**
 * Map a key's world-space footprint point (x on XZ, z on XZ) into the overlay
 * texture's [0,1] UV grid. u grows with world +X (left→right); v is 1 at the
 * back edge (world −Z, screen top) and 0 at the front (world +Z, screen bottom),
 * which matches a plane rotated flat facing the top-down camera. Out-of-range
 * points are clamped onto the nearest edge.
 */
function mapNodeToUv(x: number, z: number, footprint: Footprint): { u: number; v: number } {
  const width = footprint.maxX - footprint.minX
  const depth = footprint.maxZ - footprint.minZ
  return {
    u: clamp01((x - footprint.minX) / width),
    v: clamp01((footprint.maxZ - z) / depth),
  }
}

/**
 * Convert an sRGB hex string ("#rgb" or "#rrggbb") into an "rgba(r,g,b,a)" CSS
 * string for a canvas gradient stop. `alpha` is clamped to [0, 1].
 */
function hexRgba(hex: string, alpha: number): string {
  const a = clamp01(alpha)
  const clean = hex.replace("#", "")
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export interface KeyboardCanvasApi {
  /** Project a key's 3D node into a tooltip anchor (container-content px). */
  getAnchor(physicalId: string): TooltipAnchor | null
}

interface KeyDef {
  node: THREE.Object3D
  cap: THREE.Mesh
  restY: number
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

  // Resolve each physical id's GLB node once and snapshot its rest height. The
  // caps keep their natural GLB colour — the heatmap is a separate overlay layer,
  // and hover only presses the cap down (no material mutation), so the chassis'
  // shared cap-material primitive is never disturbed.
  const registry = useMemo(() => {
    const byId = new Map<string, KeyDef>()
    for (const id of Object.keys(PHYSICAL_KEY_NODE)) {
      const nodeName = glbNodeName(id)
      if (!nodeName) continue
      const node = scene.getObjectByName(nodeName)
      if (!node) continue
      const cap = findFirstMesh(node)
      if (!cap) continue
      byId.set(id, { node, cap, restY: node.position.y })
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
    // Fill the canvas width (the h-96 card keeps width as the binding axis) but
    // leave ~4% headroom on every side: margin 1 = the chassis keys touch the
    // card edge (which reads as a crop); 1.06 insets it visibly. Higher grows the
    // gap and shrinks the keyboard. Tunable in dev.
    const frame = fitTopDown({ bounds, fovDeg: camera.fov, aspect, margin: 1.06 })
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
      // The ramp is drawn on a 2D canvas (row 0 = top) and sampled by a plane
      // with flipY = true, so the canvas's top row shows at texture-v = 1 — the
      // back of the keyboard. Hence the inverted vertical coordinate.
      const x = u * canvasWidth
      const y = (1 - v) * canvasHeight
      const color = keycapColor(intensity)
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
      // Max overlay alpha for a fully-hot key; intensity is already in [0, 1]
      // (keyIntensity clamps), so it doubles as the gradient's peak alpha.
      grad.addColorStop(0, hexRgba(color, intensity))
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
    // Pin flipY so the inverted vertical mapping above is enforced, not
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
        // The key's on-screen silhouette: the tooltip sits above its top edge
        // and flips below using its height.
        const span = projectNodeSpan(node, camera, size)
        return (
          span && { centerX: span.centerX, keyTop: span.top, keyHeight: span.bottom - span.top }
        )
      },
    }
    return () => {
      canvasApiRef.current = null
    }
  }, [scene, camera, size, canvasApiRef])

  useCursor(hovered != null)

  // Wired to both pointermove and pointerdown: iOS taps don't reliably fire
  // pointermove, so a pointerdown is treated as a tap.
  const handlePointer = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      const name = resolveTopLevelNode(event.object, scene)
      onHover(name ? physicalIdForNode(name) : null)
    },
    [scene, onHover],
  )
  const handlePointerOut = useCallback(() => onHover(null), [onHover])

  // Advance the active springs and write the press depth onto the keycap nodes.
  // No React state per frame.
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
      onPointerMove={handlePointer}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointer}
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
