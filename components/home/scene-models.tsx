"use client"

import { Suspense } from "react"

import type { FocusRequest } from "./scene-focus"
import { HOME_SCENE_MODELS } from "./scene-config"
import { ModelObject } from "./model-object"

export function SceneModels({ onFocus }: { onFocus: (request: FocusRequest) => void }) {
  return (
    <>
      {HOME_SCENE_MODELS.map((model) => (
        <Suspense key={model.id} fallback={null}>
          <ModelObject model={model} onFocus={onFocus} />
        </Suspense>
      ))}
    </>
  )
}
