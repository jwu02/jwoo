import { cn } from "@/lib/utils"

import { HOME_GREETING } from "./scene-config"

// The static version of the greeting for the card-grid fallback. In the 3D scene
// the same words are typed in-scene above the MacBook (see model-object), which
// is why the text comes from HOME_GREETING rather than being repeated here: the
// scene and the fallback are two faces of the same page.
export function HomeGreeting({ className }: { className?: string }) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-4", className)}>
      <h1 className="text-4xl font-semibold tracking-tight">{HOME_GREETING.text}</h1>
      <p className="text-muted-foreground">
        A personal site — a home for my tools and projects.
      </p>
    </div>
  )
}
