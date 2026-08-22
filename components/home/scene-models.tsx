"use client"

import { Suspense } from "react"

import { HOME_SCENE_MODELS } from "./scene-config"
import { ModelObject } from "./model-object"

export function SceneModels() {
  return (
    <>
      {HOME_SCENE_MODELS.map((model) => (
        <Suspense key={model.id} fallback={null}>
          <ModelObject model={model} />
        </Suspense>
      ))}
    </>
  )
}
