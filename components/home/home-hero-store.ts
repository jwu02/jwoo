"use client"

import { useSyncExternalStore } from "react"

import type { HeroMode } from "./scene-focus"

// Tiny dependency-free store bridging the 3D canvas (where clicks fire) and the
// hero overlay (which renders the typed greeting). Module-level state — the same
// pattern drei uses for useProgress, minus the zustand dependency.
let mode: HeroMode = "intro"
const listeners = new Set<() => void>()

export function getHeroMode(): HeroMode {
  return mode
}

export function setHeroMode(next: HeroMode): void {
  if (next === mode) return
  mode = next
  for (const listener of listeners) listener()
}

export function subscribeHeroMode(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useHeroMode(): HeroMode {
  return useSyncExternalStore(subscribeHeroMode, getHeroMode, getHeroMode)
}
