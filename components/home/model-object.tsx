"use client"

import { Html, useCursor, useGLTF } from "@react-three/drei"
import type { ThreeEvent } from "@react-three/fiber"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import * as THREE from "three"

import { setHeroMode, useHeroMode } from "./home-hero-store"
import { registerHomeScene, resolveHomeHotspot } from "./home-scene-resolver"
import { setActiveView } from "./home-view-store"
import { resolveClickAction } from "./scene-click"
import { HOME_SCENE_HOTSPOTS, HOME_SCENE_MODEL, runtimeNodeName } from "./scene-config"
import type { FocusRequest } from "./scene-focus"
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

  // The view switcher overlay lives outside <Canvas>, where drei's useGLTF may
  // not suspend (R3F's useLoader throws a promise until the asset is cached),
  // so it resolves hotspots against the scene registered here. Register the
  // loaded scene once; on unmount the overlay has nothing to resolve.
  useEffect(() => {
    registerHomeScene(scene)
    return () => registerHomeScene(null)
  }, [scene])

  // Keyed by the sanitized runtime node names three assigns on load (see
  // runtimeNodeName) so hits resolved off the live scene match the config.
  const hotspotByNode = useMemo(
    () =>
      new Map(HOME_SCENE_HOTSPOTS.map((hotspot) => [runtimeNodeName(hotspot.node), hotspot])),
    [],
  )
  const hoveredHotspot = hoveredNode ? hotspotByNode.get(hoveredNode) ?? null : null
  useCursor(hoveredHotspot != null)

  // World-space anchor for a hotspot: the top-center of its node's bbox. Used
  // for hover labels and the greeting, so they float above the object regardless
  // of where Blender put each node's origin.
  const nodeAnchor = useCallback(
    (nodeName: string): THREE.Vector3 | null => {
      const node = scene.getObjectByName(runtimeNodeName(nodeName))
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
      // Single click resolves into a click action (see scene-click): hotspots
      // backed by a page navigate to it immediately, the rest fly the camera to
      // their focus preset, and drag releases are ignored. The drag guard, hit
      // walk, and navigate-vs-focus split all live in the one testable function.
      const action = resolveClickAction(event.object, event.delta, scene, HOME_SCENE_HOTSPOTS)
      if (action.kind === "navigate") {
        router.push(action.target)
        return
      }
      if (action.kind === "ignore") return
      // Camera focus: resolve the hotspot's focus preset into a camera request
      // (fit / deep zoom / desk overview) plus a hero mode to switch to. Goes
      // through the shared resolver so switcher buttons and object clicks frame
      // identically; a GLB-authored camera overrides the preset's cameraPos and
      // aims the view along its authored gaze (see resolveFocus).
      const resolved = resolveHomeHotspot(action.hotspot)
      if (!resolved) return
      onFocus(resolved.request)
      if (resolved.hero) setHeroMode(resolved.hero)
      setActiveView(action.hotspot.id)
    },
    [scene, onFocus, router],
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
    >
      <primitive object={scene} />
      {heroMode === "macbook" && macbookAnchor ? (
        <Html
          position={[macbookAnchor.x, macbookAnchor.y + GREETING_OFFSET_Y, macbookAnchor.z]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap text-2xl font-semibold tracking-tight text-foreground">
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
