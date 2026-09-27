"use client"

import { Html, useCursor, useGLTF } from "@react-three/drei"
import type { ThreeEvent } from "@react-three/fiber"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import * as THREE from "three"

import { projectNodeSpan } from "@/components/three/scene-span"

import { useSceneState, selectHotspot, viewEngagesGreeting } from "./home-scene-controller"
import { registerHomeScene } from "./home-scene-resolver"
import { resolveClickAction } from "./scene-click"
import { HOME_GREETING, HOME_SCENE_HOTSPOTS, HOME_SCENE_MODEL } from "./scene-config"
import { runtimeNodeName } from "./scene-node-name"
import { resolveTopLevelNode } from "./scene-hit"
import { TypeWriter } from "./typewriter"

// Screen-space margin (in px) above a hotspot's projected top edge for the hover
// tooltip, and above the MacBook's for the greeting. Anchoring in pixels rather
// than world units keeps both reading as "above the object" from any camera
// angle, where a world offset drifts with parallax. Tunable in dev.
const LABEL_PIXEL_OFFSET = 8
const LABEL_HEIGHT = 28
const GREETING_PIXEL_OFFSET = 96

export function ModelObject() {
  const router = useRouter()
  // Second argument is the local Draco decoder path (drei: UseDraco = boolean | string).
  const { scene } = useGLTF(HOME_SCENE_MODEL.url, "/draco/")
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const { activeView } = useSceneState()

  // The view switcher overlay lives outside <Canvas>, where drei's useGLTF may
  // not suspend (R3F's useLoader throws a promise until the asset is cached),
  // so it resolves hotspots against the scene registered here. Register the
  // loaded scene once; on unmount the overlay has nothing to resolve.
  useEffect(() => {
    registerHomeScene(scene)
    return () => registerHomeScene(null)
  }, [scene])

  // Keyed by the sanitized runtime node names three assigns on load (see
  // runtimeNodeName) so hits resolved off the live scene match the config. Only
  // interactive hotspots are hoverable (cursor + label); non-interactive ones
  // like the desk supply a camera view but never show a tooltip or pointer.
  const hotspotByNode = useMemo(
    () =>
      new Map(
        HOME_SCENE_HOTSPOTS.filter((hotspot) => hotspot.interactive !== false).map(
          (hotspot) => [runtimeNodeName(hotspot.node), hotspot],
        ),
      ),
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
      // backed by a page navigate to it immediately, the rest frame the camera
      // on them, and drag releases are ignored. The drag guard, hit walk, and
      // navigate-vs-focus split all live in the one testable function; the
      // controller owns what focusing *means*, so the switcher pill and this
      // path cannot drift apart.
      const action = resolveClickAction(event.object, event.delta, scene, HOME_SCENE_HOTSPOTS)
      if (action.kind === "navigate") {
        router.push(action.target)
        return
      }
      if (action.kind === "ignore") return
      selectHotspot(action.hotspot.id)
    },
    [scene, router],
  )

  // The greeting floats above the MacBook's node while the selected view asks
  // for it (HOME_GREETING); the desk view is the load view and does ask, so a
  // fresh scene types the greeting without a click. The corner overlay is gone,
  // so this is the only intro text.
  const greetingEngaged = viewEngagesGreeting(activeView)
  const greetingAnchor = useMemo(
    () => (greetingEngaged ? nodeAnchor(HOME_GREETING.node) : null),
    [greetingEngaged, nodeAnchor],
  )
  const labelAnchor = useMemo(
    () => (hoveredHotspot ? nodeAnchor(hoveredHotspot.node) : null),
    [hoveredHotspot, nodeAnchor],
  )

  // Screen-space placement shared by the greeting and the hover tooltip: the
  // node's projected ON-SCREEN silhouette, centered horizontally and lifted
  // `pixelOffsetY` px above its topmost edge. Anchoring off the silhouette (all
  // eight bbox corners) rather than a single world point is what keeps a label
  // pinned to the object's top edge at any camera angle — a single-point anchor
  // drifts off the object's visible top from overhead views like the desk camera.
  // Re-derived from the live projection each frame, so it never drifts with
  // parallax either.
  const anchorAboveNode = useCallback(
    (
      nodeName: string,
      camera: THREE.Camera,
      size: { width: number; height: number },
      pixelOffsetY: number,
    ): [number, number] | null => {
      const span = projectNodeSpan(
        scene.getObjectByName(runtimeNodeName(nodeName)),
        camera,
        size,
      )
      return span ? [span.centerX, span.top - pixelOffsetY] : null
    },
    [scene],
  )

  const greetingPosition = useCallback(
    (_el: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) =>
      anchorAboveNode(HOME_GREETING.node, camera, size, GREETING_PIXEL_OFFSET) ?? [0, 0],
    [anchorAboveNode],
  )

  const labelPosition = useCallback(
    (_el: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) => {
      const anchor = hoveredHotspot
        ? anchorAboveNode(hoveredHotspot.node, camera, size, LABEL_PIXEL_OFFSET)
        : null
      if (!anchor) return [0, 0]
      // Clamp so the label's top edge never runs off the top of the viewport when
      // a large object's top lands near the screen's top edge (e.g. a tall prop in
      // an overhead desk view). The label is bottom-anchored, so
      // anchor.y - LABEL_HEIGHT is its top edge.
      return [anchor[0], Math.max(anchor[1], LABEL_HEIGHT + LABEL_PIXEL_OFFSET)]
    },
    [hoveredHotspot, anchorAboveNode],
  )

  return (
    <group
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <primitive object={scene} />
      {greetingEngaged && greetingAnchor ? (
        <Html
          position={[greetingAnchor.x, greetingAnchor.y, greetingAnchor.z]}
          calculatePosition={greetingPosition}
          // Bottom-center anchors to the projected point, so the text extends
          // upward from GREETING_PIXEL_OFFSET px above the MacBook's top edge.
          style={{ pointerEvents: "none", transform: "translate(-50%, -100%)" }}
        >
          <div className="whitespace-nowrap text-2xl font-semibold tracking-tight text-foreground">
            <TypeWriter text={HOME_GREETING.text} />
          </div>
        </Html>
      ) : null}
      {hoveredHotspot?.label && labelAnchor ? (
        <Html
          position={[labelAnchor.x, labelAnchor.y, labelAnchor.z]}
          calculatePosition={labelPosition}
          // Bottom-center anchors to the projected top minus a pixel margin, so
          // the tooltip sits just above the object's top edge from any angle
          // instead of floating away with a world-space offset.
          style={{ pointerEvents: "none", transform: "translate(-50%, -100%)" }}
        >
          <div className="whitespace-nowrap rounded-md border bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
            {hoveredHotspot.label}
          </div>
        </Html>
      ) : null}
    </group>
  )
}
