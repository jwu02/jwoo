import { cn } from "@/lib/utils"

// The static greeting for the card-grid fallback. In the 3D scene the greeting
// is typed in-scene above the MacBook (see model-object.tsx), not overlaid here.
export function HomeHero({ className }: { className?: string }) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-4", className)}>
      <h1 className="text-4xl font-semibold tracking-tight">
        Hi, I&apos;m Tony.
      </h1>
      <p className="text-muted-foreground">
        A personal site — a home for my tools and projects.
      </p>
    </div>
  )
}
