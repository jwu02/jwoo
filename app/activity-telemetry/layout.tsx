import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Activity Telemetry",
}

export default function ActivityTelemetryLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}
