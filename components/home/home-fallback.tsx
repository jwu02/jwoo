import { Activity, Bot, FileText, Globe, Sparkle } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HomeGreeting } from "./home-greeting"

/** The four cards' copy — header icon, title, blurb, and the button that links out. */
const SECTIONS = [
  {
    icon: Activity,
    title: "Activity Telemetry",
    description: "Live mouse and keyboard activity collected from this machine.",
    href: "/activity-telemetry",
    action: "View dashboard",
    actionIcon: Activity,
  },
  {
    icon: Bot,
    title: "AI Usage",
    description: "Model cost and token usage from AI API calls.",
    href: "/ai-usage",
    action: "View usage",
    actionIcon: Bot,
  },
  {
    icon: Globe,
    title: "Knowledge Graph",
    description: "Explore Obsidian-style note connections.",
    href: "/knowledge-graph",
    action: "Open graph",
    actionIcon: Sparkle,
  },
  {
    icon: FileText,
    title: "Resume",
    description: "My CV as an exact A4 sheet — English and 中文.",
    href: "/resume",
    action: "View resume",
    actionIcon: FileText,
  },
]

export function HomeFallback() {
  return (
    // Unlike the scene, this is an ordinary scrolling page with the Shell
    // floating over it, so it keeps itself clear of the chrome the way an
    // application's surface does: a column's worth of padding where the Dock
    // railed down the left at desktop widths, a bar's worth at the bottom on
    // narrow ones. Only the padding is layout — everything else here is the
    // same page it was when the Dock took its own column.
    <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-24 md:px-20 md:pb-16">
      <HomeGreeting />

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <Card key={section.href}>
            <CardHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <section.icon />
              </div>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href={section.href} />} nativeButton={false}>
                <section.actionIcon data-icon="inline-start" />
                {section.action}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
