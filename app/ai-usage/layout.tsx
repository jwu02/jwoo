import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Usage",
}

export default function AiUsageLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}
