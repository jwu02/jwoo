"use client"

import { useEffect, useState } from "react"

// Characters per tick; "Hi, I'm Tony." (13 chars) finishes in ~0.7s.
const TYPE_SPEED_MS = 55

export function TypeWriter({ text }: { text: string }) {
  const [count, setCount] = useState(0)

  // Advance one character per tick; the interval stops once the full text is
  // revealed (count can no longer change).
  useEffect(() => {
    if (count >= text.length) return
    const id = setInterval(() => setCount((c) => c + 1), TYPE_SPEED_MS)
    return () => clearInterval(id)
  }, [count, text])

  return (
    <span>
      {text.slice(0, count)}
      <span aria-hidden className="animate-pulse">
        |
      </span>
    </span>
  )
}
