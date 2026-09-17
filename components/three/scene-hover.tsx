"use client"

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"

import { computeTooltipPosition, type TooltipAnchor } from "@/lib/ui/tooltip-position"

// The DOM half of a hoverable 3D scene: the hovered-id state, the tooltip that
// tracks the model's live projection, and the focusable layer that lets a
// keyboard reach the same regions as the pointer.
//
// All three scenes' wrappers had grown the same copy of this — the same effect,
// the same class names, the same sr-only buttons — so the sync machinery lives
// here and callers supply only what is genuinely theirs: the anchor source, the
// tooltip's contents, and the label for each focusable item.

/** What a scene's canvas API must expose for the tooltip to follow it. */
export interface AnchorSource<T extends string> {
  getAnchor(id: T): TooltipAnchor | null
}

export interface SceneHover<T extends string> {
  hovered: T | null
  setHovered: (id: T | null) => void
  /** Wraps the scene; the tooltip is positioned against this box. */
  containerRef: RefObject<HTMLDivElement | null>
  /** Attach to <SceneTooltip> so it can be measured and placed. */
  tooltipRef: RefObject<HTMLDivElement | null>
}

/**
 * Hover state plus the refs the tooltip needs. `anchorSource` is the scene's
 * canvas API ref — null until the canvas has loaded, which the tooltip treats
 * as "no projection available" and falls back to a deterministic centre/top
 * anchor.
 */
export function useSceneHover<T extends string>(
  anchorSource: RefObject<AnchorSource<T> | null>,
): SceneHover<T> {
  const [hovered, setHovered] = useState<T | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Position against the live projection of the hovered region. Runs before
  // paint so the tooltip never flashes at an unclamped location.
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const container = containerRef.current
    if (!tooltip || !container || hovered === null) return

    const anchor = anchorSource.current?.getAnchor(hovered) ?? {
      centerX: container.clientWidth / 2,
      keyTop: 0,
      keyHeight: 0,
    }
    const pos = computeTooltipPosition(
      anchor,
      tooltip.offsetWidth,
      tooltip.offsetHeight,
      { clientWidth: container.clientWidth, scrollLeft: 0 },
    )
    tooltip.style.left = `${pos.left}px`
    tooltip.style.top = `${pos.top}px`
  }, [hovered, anchorSource])

  return { hovered, setHovered, containerRef, tooltipRef }
}

export interface SceneTooltipProps {
  innerRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

/** Absolutely positioned against the scene box; placed by `useSceneHover`. */
export function SceneTooltip({ innerRef, children }: SceneTooltipProps) {
  return (
    <div
      ref={innerRef}
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
    >
      {children}
    </div>
  )
}

export interface SceneA11yItem<T extends string> {
  id: T
  label: string
}

export interface SceneA11yLayerProps<T extends string> {
  items: readonly SceneA11yItem<T>[]
  onHover: (id: T | null) => void
}

/**
 * Visually hidden but focusable: Tab reaches each region and drives the 3D
 * highlight + tooltip through the same hover pipeline as the pointer. Rendered
 * outside the canvas so it survives the WebGL fallback.
 */
export function SceneA11yLayer<T extends string>({
  items,
  onHover,
}: SceneA11yLayerProps<T>) {
  return (
    <div className="sr-only">
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          onFocus={() => onHover(id)}
          onBlur={() => onHover(null)}
        />
      ))}
    </div>
  )
}
