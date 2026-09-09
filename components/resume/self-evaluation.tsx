import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function SelfEvaluation({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.selfEvaluation} />
      <ul className="flex flex-col list-[square] pl-5">
        {data.selfEvaluation.map((evaluation, index) => (
          <li key={index}>{evaluation}</li>
        ))}
      </ul>
    </div>
  )
}
