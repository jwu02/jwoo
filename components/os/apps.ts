import { Activity, Bot, FileText, Globe, Home, type LucideIcon } from "lucide-react"

/**
 * One application of the site: the route the Dock selects and the Top Bar
 * names. The Dock and the Top Bar are two surfaces of this one list, so an app
 * cannot exist in one without the other.
 */
export interface App {
  /** The route the app lives at. Also its identity — there is no separate id. */
  href: string
  /** The app's name, shown on Dock hover. */
  label: string
  /** What the Top Bar says while the app is active. */
  title: string
  icon: LucideIcon
}

export const APPS: readonly App[] = [
  // Home names the person rather than the place: it is the desktop, not a
  // destination within the site.
  { href: "/", label: "Home", title: "Tony Wu", icon: Home },
  {
    href: "/activity-telemetry",
    label: "Activity Telemetry",
    title: "Activity Telemetry",
    icon: Activity,
  },
  { href: "/ai-usage", label: "AI Usage", title: "AI Usage", icon: Bot },
  {
    href: "/knowledge-graph",
    label: "Knowledge Graph",
    title: "Knowledge Graph",
    icon: Globe,
  },
  { href: "/resume", label: "Resume", title: "Resume", icon: FileText },
]

/** What the Top Bar names a route no application claims — a 404. */
const UNLISTED: App = { href: "", label: "Not Found", title: "Not Found", icon: Home }

export function activeApp(pathname: string): App {
  return APPS.find((app) => app.href === pathname) ?? UNLISTED
}
