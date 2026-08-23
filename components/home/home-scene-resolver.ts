import * as THREE from "three"

import { runtimeNodeName, type HomeSceneHotspot } from "./scene-config"
import {
  readWorldPosition,
  resolveFocus,
  type CameraPose,
  type FocusInfo,
  type FocusRequest,
  type HeroMode,
} from "./scene-focus"

export type ResolvedFocus = { request: FocusRequest; hero: HeroMode | null }

/**
 * Turns a hotspot into the camera request + hero state, shared by object clicks
 * (model-object) and the view switcher buttons (home-view-switcher) so the two
 * paths always produce identical framing.
 *
 * The combined scene loads via drei's useGLTF inside the canvas, where it may
 * suspend under the SceneModels Suspense boundary. ModelObject registers the
 * loaded scene here, letting the DOM-overlay switcher resolve hotspots on click
 * without suspending outside that boundary (R3F's useLoader throws a promise
 * until the asset is cached — there is no safe non-suspending read).
 */
export function registerHomeScene(scene: THREE.Group | null): void {
  loadedScene = scene
  // A new scene (e.g. after navigation back to home) must not reuse bboxes
  // measured against the previous scene.
  focusCache.clear()
}

let loadedScene: THREE.Group | null = null
// Lazily cached world-space bounding sphere per hotspot node, computed on first
// resolve (keeps the mount of the 27MB combined scene cheap).
const focusCache = new Map<string, FocusInfo>()

export function resolveHomeHotspot(hotspot: HomeSceneHotspot): ResolvedFocus | null {
  if (!loadedScene) return null
  const camera = hotspot.camera ? getCameraPose(loadedScene, hotspot.camera) : undefined
  return resolveFocus(hotspot.focus, getFocusInfo(loadedScene, hotspot.node), camera)
}

function getFocusInfo(scene: THREE.Group, nodeName: string): FocusInfo {
  const cached = focusCache.get(nodeName)
  if (cached) return cached
  const node = scene.getObjectByName(runtimeNodeName(nodeName))
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
  focusCache.set(nodeName, info)
  return info
}

function getCameraPose(scene: THREE.Group, cameraName: string): CameraPose | undefined {
  const node = scene.getObjectByName(runtimeNodeName(cameraName))
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
}
