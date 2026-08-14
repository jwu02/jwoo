import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function TechnicalSkills({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.technicalSkills} />
      <ul className="flex flex-col">
        {data.technicalSkills.map((skill, index) => (
          <div key={index}>
            <b>{skill.group}:</b> {skill.data.join(", ")}
          </div>
        ))}
      </ul>
    </div>
  )
}
