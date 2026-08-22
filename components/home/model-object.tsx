"use client"

import { Html, useCursor, useGLTF } from "@react-three/drei"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import * as THREE from "three"

import { setHeroMode, useHeroMode } from "./home-hero-store"
import type { HomeSceneModel } from "./scene-config"
import { resolveFocus, type FocusInfo, type FocusRequest } from "./scene-focus"
import { TypeWriter } from "./typewriter"

export function ModelObject({
  model,
  onFocus,
}: {
  model: HomeSceneModel
  onFocus: (request: FocusRequest) => void
}) {
  const router = useRouter()
  // Second argument is the local Draco decoder path (drei: UseDraco = boolean | string).
  const { scene } = useGLTF(model.url, "/draco/")
  const [hovered, setHovered] = useState(false)
  const heroMode = useHeroMode()
  useCursor(hovered)

  // The gltf's world-space bounding box (center + radius), computed lazily on
  // first click (keeps the mount of the 28MB car cheap). The box is read in
  // world space — the group's position/scale/rotation are already baked into
  // matrixWorld — so the transform is never applied a second time (which sent
  // the car's focus point ~500 units away).
  const focusInfoRef = useRef<FocusInfo | null>(null)
  const getFocusInfo = useCallback((): FocusInfo => {
    const cached = focusInfoRef.current
    if (cached) return cached
    scene.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(scene)
    const center = new THREE.Vector3()
    box.getCenter(center)
    const size = new THREE.Vector3()
    box.getSize(size)
    focusInfoRef.current = box.isEmpty()
      ? { point: [model.position[0], model.position[1], model.position[2]], radius: 0 }
      : { point: [center.x, center.y, center.z], radius: size.length() / 2 }
    return focusInfoRef.current
  }, [scene, model.position])

  return (
    <group
      position={model.position}
      rotation={model.rotation ?? [0, 0, 0]}
      scale={model.scale}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation()
        // R3F dispatches onClick after a drag that *started* on this object (no
        // built-in click-vs-drag filter for object clicks), so ignore drag
        // releases — only act on a genuine click (delta ≤ 2px). Without this,
        // rotating a focused object re-triggered the fly-to and snapped the view
        // back out.
        if (event.delta > 2) return
        // Single click resolves the model's focus preset into a camera request
        // (fit / deep zoom / desk overview) plus a hero mode to switch to.
        const { request, hero } = resolveFocus(model.focus, getFocusInfo())
        onFocus(request)
        if (hero) setHeroMode(hero)
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (model.target) router.push(model.target)
      }}
    >
      <primitive object={scene} />
      {/* The model whose framing engages the macbook hero (the MacBook) types
          the greeting above itself while engaged; the corner overlay is gone,
          so this is the only intro text. */}
      {model.focus.type === "framing" && model.focus.hero === "macbook" && heroMode === "macbook" ? (
        <Html position={[0, 0.24, 0]} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-lg bg-background/80 px-3 py-1.5 text-2xl font-semibold tracking-tight text-foreground shadow-sm backdrop-blur-sm">
            <TypeWriter text="Hello, I'm Tony Wu." />
          </div>
        </Html>
      ) : null}
      {hovered && model.label ? (
        <Html position={[0, 1.2, 0]} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md border bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
            {model.label}
          </div>
        </Html>
      ) : null}
    </group>
  )
}
