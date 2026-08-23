"use client"

import { useSyncExternalStore } from "react"

// Tiny dependency-free store tracking which preset camera view (desk / car) the
// home scene is currently framed on, mirroring home-hero-store. The switcher
// pill highlights the active button; user camera drags clear it. Module-level
// state — the same pattern drei uses for useProgress.
let activeView: string | null = null
const listeners = new Set<() => void>()

export function getActiveView(): string | null {
  return activeView
}

export function setActiveView(next: string | null): void {
  if (next === activeView) return
  activeView = next
  for (const listener of listeners) listener()
}

export function subscribeActiveView(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useActiveView(): string | null {
  return useSyncExternalStore(subscribeActiveView, getActiveView, getActiveView)
}
