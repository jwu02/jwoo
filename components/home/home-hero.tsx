import { cn } from "@/lib/utils"

export function HomeHero({ className }: { className?: string }) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-4", className)}>
      <h1 className="text-4xl font-semibold tracking-tight">
        Hello, I&apos;m Tony Wu.
      </h1>
      <p className="text-muted-foreground">
        A personal site — a home for my tools and projects.
      </p>
    </div>
  )
}
