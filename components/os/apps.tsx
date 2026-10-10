import Image from "next/image"
import { Activity, Bot, FileText, Globe, Terminal } from "lucide-react"

/** What the Dock renders an app's glyph with: a Lucide icon, or a drawn image. */
type AppIcon = React.ComponentType<{
  className?: string
  "aria-hidden"?: boolean
}>

/**
 * One application of the site: a route the Dock selects and the name it goes by.
 * The Dock and the Titlebar both read this list, and it is the only place an
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

/** The Terminal's own route. Named here because the Terminal itself reads the
 * registry — it is the one application it does not offer a way into. */
export const TERMINAL = "/terminal"

export const APPS: readonly App[] = [
  { href: HOME, label: "Home", icon: Miyamura },
  { href: TERMINAL, label: "Terminal", icon: Terminal },
  { href: "/activity-telemetry", label: "Activity Telemetry", icon: Activity },
  { href: "/ai-usage", label: "AI Usage", icon: Bot },
  { href: "/knowledge-graph", label: "Knowledge Graph", icon: Globe },
  { href: "/resume", label: "Resume", icon: FileText },
  // Off the Dock until the Tetris cabinet ships its AI autopilot gameplay.
  // { href: "/tetris", label: "Tetris", icon: Tetris },
]

/**
 * The name a window's titlebar shows for a route. A registered application is
 * named by the same list the Dock reads, so the titlebar is a view of that one
 * list rather than a second one to drift; a route with no entry — Tetris, kept
 * off the Dock — is named after its slug, so no window goes unnamed.
 */
export function appTitle(pathname: string): string {
  const app = APPS.find((app) => app.href === pathname)
  if (app) return app.label
  return slugTitle(pathname)
}

function slugTitle(pathname: string): string {
  const slug = pathname.split("/").filter(Boolean).pop()
  if (!slug) return ""
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

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

// Docked out with the app entry; restore both together.
// /** The Tetris glyph: a pixel-T, drawn stroked so it takes the Dock's ink like
//  * every icon beside it. */
// function Tetris({ className }: { className?: string }) {
//   return (
//     <svg viewBox="0 0 22 22" fill="none" className={className} aria-hidden>
//       {[
//         [8, 2],
//         [2, 10],
//         [8, 10],
//         [14, 10],
//       ].map(([x, y]) => (
//         <rect
//           key={`${x}-${y}`}
//           x={x + 0.6}
//           y={y + 0.6}
//           width={4.8}
//           height={4.8}
//           rx={1}
//           stroke="currentColor"
//           strokeWidth={1.4}
//         />
//       ))}
//     </svg>
//   )
// }
