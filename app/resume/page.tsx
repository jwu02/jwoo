import type { Metadata } from "next"
import { Geist } from "next/font/google"

import { ResumeView } from "@/components/resume/resume-view"

export const metadata: Metadata = {
  title: "Resume",
}

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export default function ResumePage() {
  return (
    <div className={geist.variable}>
      <ResumeView />
    </div>
  )
}
