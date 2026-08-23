"use client"

import { Suspense } from "react"

import type { FocusRequest } from "./scene-focus"
import { ModelObject } from "./model-object"

export function SceneModels({ onFocus }: { onFocus: (request: FocusRequest) => void }) {
  return (
    <Suspense fallback={null}>
      <ModelObject onFocus={onFocus} />
    </Suspense>
  )
}
