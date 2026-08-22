"use client"

import { Html, useCursor, useGLTF } from "@react-three/drei"
import { useRouter } from "next/navigation"
import { useState } from "react"

import type { HomeSceneModel } from "./scene-config"

export function ModelObject({ model }: { model: HomeSceneModel }) {
  const router = useRouter()
  // Second argument is the local Draco decoder path (drei: UseDraco = boolean | string).
  const { scene } = useGLTF(model.url, "/draco/")
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const highlight = hovered ? 1.03 : 1

  return (
    <group
      position={model.position}
      rotation={model.rotation ?? [0, 0, 0]}
      scale={[
        model.scale[0] * highlight,
        model.scale[1] * highlight,
        model.scale[2] * highlight,
      ]}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation()
        if (model.target) router.push(model.target)
      }}
    >
      <primitive object={scene} />
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
