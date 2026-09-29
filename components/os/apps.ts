import { Activity, Bot, FileText, Globe, Home, type LucideIcon } from "lucide-react"

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
  icon: LucideIcon
}

/** The desktop's route: the one view that is not an application. */
export const HOME = "/"

export const APPS: readonly App[] = [
  { href: HOME, label: "Home", icon: Home },
  { href: "/activity-telemetry", label: "Activity Telemetry", icon: Activity },
  { href: "/ai-usage", label: "AI Usage", icon: Bot },
  { href: "/knowledge-graph", label: "Knowledge Graph", icon: Globe },
  { href: "/resume", label: "Resume", icon: FileText },
]
