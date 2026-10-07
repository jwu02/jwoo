import Image from "next/image"
import { Activity, Bot, FileText, Globe } from "lucide-react"

/** What the Dock renders an app's glyph with: a Lucide icon, or a drawn image. */
type AppIcon = React.ComponentType<{
  className?: string
  "aria-hidden"?: boolean
}>

/**
 * One application of the site: a route the Dock selects and the name it goes by.
 * The Dock is the only surface that reads this list, and the only place an
 * application is declared.
 */
export interface App {
  /** The route the app lives at. Also its identity — there is no separate id. */
  href: string
  /** The app's name, shown on Dock hover and read out to a screen reader. */
  label: string
  icon: AppIcon
}

/** The desktop's route: the one view that is not an application. */
export const HOME = "/"

export const APPS: readonly App[] = [
  { href: HOME, label: "Home", icon: Miyamura },
  { href: "/activity-telemetry", label: "Activity Telemetry", icon: Activity },
  { href: "/ai-usage", label: "AI Usage", icon: Bot },
  { href: "/knowledge-graph", label: "Knowledge Graph", icon: Globe },
  { href: "/resume", label: "Resume", icon: FileText },
  { href: "/tetris", label: "Tetris", icon: Tetris },
]

/** Drawn rather than sized by the Dock: the desktop's portrait fills its button
 * edge to edge, so the Link clips it to the button's own rounding. */
function Miyamura() {
  return (
    <Image
      src="/miyamura.jpg"
      alt=""
      width={56}
      height={56}
      loading="eager"
      className="size-full object-cover"
    />
  )
}

/** The Tetris glyph: a pixel-T, drawn stroked so it takes the Dock's ink like
 * every icon beside it. */
function Tetris({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" fill="none" className={className} aria-hidden>
      {[
        [8, 2],
        [2, 10],
        [8, 10],
        [14, 10],
      ].map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x + 0.6}
          y={y + 0.6}
          width={4.8}
          height={4.8}
          rx={1}
          stroke="currentColor"
          strokeWidth={1.4}
        />
      ))}
    </svg>
  )
}
