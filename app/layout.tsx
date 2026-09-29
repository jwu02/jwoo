import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Geist, Roboto_Mono } from "next/font/google"

import "./globals.css"
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
  title: {
    default: "Tony Wu",
    template: "%s — Tony Wu",
  },
  icons: {
    icon: "/miyamura.jpg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // `dark` is fixed rather than resolved: an OS has one appearance, and the
    // glass surfaces this design is built from only read as glass on a dark
    // wallpaper. The resume sheet opts back into print's light tokens itself.
    <html
      lang="en"
      className={cn("dark antialiased", geist.variable, robotoMono.variable, "font-sans")}
    >
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
