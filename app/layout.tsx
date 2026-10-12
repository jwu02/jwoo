import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Geist, Roboto_Mono } from "next/font/google"

import "./globals.css"
import { appearanceScript } from "@/components/os/appearance"
import { OSShell } from "@/components/os/os-shell"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// Two voices, and the split is what makes the frame read as a system: Geist is
// what an application says, Roboto Mono is what the OS chrome (the Dock's
// labels) says.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Tony Wu",
  icons: {
    icon: "/miyamura.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // The document is server-rendered dark — the OS's own first appearance —
    // and the inline script below corrects it from storage before the browser's
    // first paint, so a visitor whose appearance is light never sees a dark
    // flash. The appearance class is the one class here React does not draw;
    // the Shell keeps it there, and `suppressHydrationWarning` is what lets
    // React accept a class it did not draw.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("dark antialiased", geist.variable, robotoMono.variable, "font-sans")}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      </head>
      <body>
        <TooltipProvider>
          <OSShell>{children}</OSShell>
        </TooltipProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
