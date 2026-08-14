import { Geist } from "next/font/google"

import { ResumeView } from "@/components/resume/resume-view"

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
