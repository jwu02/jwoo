"use client"

import { useCallback, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

export interface PrototypeVariant {
  key: string
  name: string
}

/**
 * The floating bar that flips a UI prototype between its variants. Throwaway
 * scaffolding, not product chrome: it is deliberately styled unlike the rest of
 * the site so it cannot be mistaken for the design under review, and it hides
 * itself in production builds.
 *
 * The current variant lives in the URL (`?variant=`), so a variant is
 * shareable and a reload lands on the same one. Both the arrows and the arrow
 * keys cycle, wrapping at either end.
 */
export function PrototypeSwitcher({
  variants,
  current,
  param = "variant",
}: {
  variants: readonly PrototypeVariant[]
  current: string
  param?: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const go = useCallback(
    (key: string) => {
      const next = new URLSearchParams({ [param]: key })
      router.replace(`${pathname}?${next}`, { scroll: false })
    },
    [router, pathname, param]
  )

  const step = useCallback(
    (by: number) => {
      const index = variants.findIndex((v) => v.key === current)
      const next = variants[(index + by + variants.length) % variants.length]
      if (next) go(next.key)
    },
    [variants, current, go]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      const target = event.target as HTMLElement | null
      // A keypress meant for a field is the field's, not the switcher's.
      if (target?.closest("input, textarea, [contenteditable='true']")) return
      event.preventDefault()
      step(event.key === "ArrowRight" ? 1 : -1)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [step])

  if (process.env.NODE_ENV === "production") return null

  const index = variants.findIndex((v) => v.key === current)
  const active = variants[index] ?? variants[0]

  const arrow =
    "flex size-8 items-center justify-center rounded-full text-lg leading-none transition hover:bg-white/15"

  return (
    <div
      data-prototype-switcher
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-neutral-900/90 px-2 py-1.5 text-neutral-100 shadow-2xl backdrop-blur-md"
    >
      <button
        type="button"
        aria-label="Previous variant"
        className={arrow}
        onClick={() => step(-1)}
      >
        ←
      </button>
      <div className="min-w-44 px-1 text-center">
        <div className="text-[11px] tracking-widest text-neutral-400 uppercase">
          prototype {index + 1}/{variants.length}
        </div>
        <div className="text-sm font-medium">
          {active.key} <span className="text-neutral-400">·</span>{" "}
          <span className="text-neutral-300">{active.name}</span>
        </div>
      </div>
      <button
        type="button"
        aria-label="Next variant"
        className={arrow}
        onClick={() => step(1)}
      >
        →
      </button>
    </div>
  )
}
