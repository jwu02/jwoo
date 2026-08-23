import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Knowledge Graph",
}

export default function KnowledgeGraphLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}
