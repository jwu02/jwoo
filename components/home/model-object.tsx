"use client"

import { Html, useCursor, useGLTF } from "@react-three/drei"
import type { ThreeEvent } from "@react-three/fiber"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import { setHeroMode, useHeroMode } from "./home-hero-store"
import { HOME_SCENE_HOTSPOTS, HOME_SCENE_MODEL, type HomeSceneHotspot } from "./scene-config"
import {
  readWorldPosition,
  resolveFocus,
  type CameraPose,
  type FocusInfo,
  type FocusRequest,
} from "./scene-focus"
import { resolveTopLevelNode } from "./scene-hit"
import { TypeWriter } from "./typewriter"

// World-space offsets above a hotspot node's bbox top for the hover label and
// the MacBook greeting (the wrapping group sits at identity, so local == world).
// Tunable in dev.
const LABEL_OFFSET_Y = 0.12
const GREETING_OFFSET_Y = 0.2

export function ModelObject({ onFocus }: { onFocus: (request: FocusRequest) => void }) {
  const router = useRouter()
  // Second argument is the local Draco decoder path (drei: UseDraco = boolean | string).
  const { scene } = useGLTF(HOME_SCENE_MODEL.url, "/draco/")
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const heroMode = useHeroMode()

  const hotspotByNode = useMemo(
    () => new Map(HOME_SCENE_HOTSPOTS.map((hotspot) => [hotspot.node, hotspot])),
    [],
  )
  const hoveredHotspot = hoveredNode ? hotspotByNode.get(hoveredNode) ?? null : null
  useCursor(hoveredHotspot != null)

  // World-space anchor for a hotspot: the top-center of its node's bbox. Used
  // for hover labels and the greeting, so they float above the object regardless
  // of where Blender put each node's origin.
  const nodeAnchor = useCallback(
    (nodeName: string): THREE.Vector3 | null => {
      const node = scene.getObjectByName(nodeName)
      if (!node) return null
      node.updateWorldMatrix(true, true)
      const box = new THREE.Box3().setFromObject(node)
      if (box.isEmpty()) return null
      const center = new THREE.Vector3()
      box.getCenter(center)
      return new THREE.Vector3(center.x, box.max.y, center.z)
    },
    [scene],
  )

  // Lazily cached world-space bounding sphere per hotspot node, computed on
  // first click (keeps the mount of the 27MB combined scene cheap). The box is
  // the node's own — not the whole scene's — so "fit" views frame just the
  // clicked object, not the car and garage too.
  const focusCache = useRef(new Map<string, FocusInfo>())
  const getFocusInfo = useCallback(
    (hotspot: HomeSceneHotspot): FocusInfo => {
      const cached = focusCache.current.get(hotspot.node)
      if (cached) return cached
      const node = scene.getObjectByName(hotspot.node)
      if (!node) return { point: [0, 0, 0], radius: 0 }
      node.updateWorldMatrix(true, true)
      const box = new THREE.Box3().setFromObject(node)
      const center = new THREE.Vector3()
      box.getCenter(center)
      const size = new THREE.Vector3()
      box.getSize(size)
      const info: FocusInfo = box.isEmpty()
        ? { point: [0, 0, 0], radius: 0 }
        : { point: [center.x, center.y, center.z], radius: size.length() / 2 }
      focusCache.current.set(hotspot.node, info)
      return info
    },
    [scene],
  )

  // World pose of a GLB-authored camera node (e.g. "Camera_Xiaomi"): its
  // position plus the forward direction of its rotation, used to override the
  // focus preset's hand-tuned framing. The orientation is what matches the
  // Blender-authored shot (position alone framed top-down views too low).
  // Returns undefined when the node isn't in the scene so resolveFocus falls
  // back to the preset.
  const getCameraPose = useCallback(
    (cameraName: string): CameraPose | undefined => {
      const node = scene.getObjectByName(cameraName)
      if (!node) return undefined
      node.updateWorldMatrix(true, true)
      const quaternion = new THREE.Quaternion()
      node.getWorldQuaternion(quaternion)
      // GLTF cameras look down their -Z axis; rotate that by the node's world
      // orientation to get the direction the authored camera actually gazes.
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion)
      return {
        position: readWorldPosition(node),
        forward: [forward.x, forward.y, forward.z],
      }
    },
    [scene],
  )

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      const name = resolveTopLevelNode(event.object, scene)
      setHoveredNode(name && hotspotByNode.has(name) ? name : null)
    },
    [scene, hotspotByNode],
  )
  const handlePointerOut = useCallback(() => setHoveredNode(null), [])

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      // R3F dispatches onClick after a drag that *started* on this object (no
      // built-in click-vs-drag filter for object clicks), so ignore drag
      // releases — only act on a genuine click (delta ≤ 2px). Without this,
      // rotating a focused object re-triggered the fly-to and snapped the view
      // back out.
      if (event.delta > 2) return
      const name = resolveTopLevelNode(event.object, scene)
      const hotspot = name ? hotspotByNode.get(name) : undefined
      if (!hotspot) return
      // Single click resolves the hotspot's focus preset into a camera request
      // (fit / deep zoom / desk overview) plus a hero mode to switch to. A
      // GLB-authored camera, when present, overrides the preset's cameraPos and
      // aims the view along its authored gaze (see resolveFocus).
      const camera = hotspot.camera ? getCameraPose(hotspot.camera) : undefined
      const { request, hero } = resolveFocus(hotspot.focus, getFocusInfo(hotspot), camera)
      onFocus(request)
      if (hero) setHeroMode(hero)
    },
    [scene, hotspotByNode, getFocusInfo, getCameraPose, onFocus],
  )

  const handleDoubleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      const name = resolveTopLevelNode(event.object, scene)
      const hotspot = name ? hotspotByNode.get(name) : undefined
      if (hotspot?.target) router.push(hotspot.target)
    },
    [scene, hotspotByNode, router],
  )

  // The macbook hotspot's framing engages the typed greeting; show it above the
  // MacBook while engaged. The corner overlay is gone, so this is the only
  // intro text.
  const macbookHotspot = HOME_SCENE_HOTSPOTS.find((hotspot) => hotspot.id === "macbook")
  const macbookIsHero =
    macbookHotspot?.focus.type === "framing" && macbookHotspot.focus.hero === "macbook"
  const macbookAnchor = useMemo(
    () => (macbookIsHero ? nodeAnchor("MacBook") : null),
    [macbookIsHero, nodeAnchor],
  )
  const labelAnchor = useMemo(
    () => (hoveredHotspot ? nodeAnchor(hoveredHotspot.node) : null),
    [hoveredHotspot, nodeAnchor],
  )

  return (
    <group
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <primitive object={scene} />
      {heroMode === "macbook" && macbookAnchor ? (
        <Html
          position={[macbookAnchor.x, macbookAnchor.y + GREETING_OFFSET_Y, macbookAnchor.z]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap rounded-lg bg-background/80 px-3 py-1.5 text-2xl font-semibold tracking-tight text-foreground shadow-sm backdrop-blur-sm">
            <TypeWriter text="Hello, I'm Tony Wu." />
          </div>
        </Html>
      ) : null}
      {hoveredHotspot?.label && labelAnchor ? (
        <Html
          position={[labelAnchor.x, labelAnchor.y + LABEL_OFFSET_Y, labelAnchor.z]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap rounded-md border bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
            {hoveredHotspot.label}
          </div>
        </Html>
      ) : null}
    </group>
  )
}
