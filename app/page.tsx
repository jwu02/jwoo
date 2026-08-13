import { Activity, Circle } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
      <section className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          Hello, I&apos;m jwoo.
        </h1>
        <p className="text-muted-foreground">
          A personal site — a home for my tools and projects.
        </p>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity />
            </div>
            <CardTitle>Activity Telemetry</CardTitle>
            <CardDescription>
              Live mouse and keyboard activity collected from this machine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              render={<Link href="/activity-telemetry" />}
              nativeButton={false}
            >
              <Activity data-icon="inline-start" />
              View dashboard
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Circle />
            </div>
            <CardTitle>Knowledge Graph</CardTitle>
            <CardDescription>
              Explore Obsidian-style note connections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/knowledge-graph" />} nativeButton={false}>
              <Circle data-icon="inline-start" />
              Open graph
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
