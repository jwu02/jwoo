import type { Metadata } from "next"

import { ResumeView } from "@/components/resume/resume-view"

export const metadata: Metadata = {
  title: "Resume",
}

export default function ResumePage() {
  return <ResumeView />
}
