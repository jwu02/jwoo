import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function WorkExperience({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.workExperiences} />
      <div className="flex flex-col gap-1">
        {data.workExperiences.map((experience, index) => (
          <div key={index}>
            <div className="flex justify-between">
              <h3 className="font-semibold">{experience.position}</h3>
              <h3>
                {experience.start} - {experience.end}
              </h3>
            </div>
            <h4 className="font-semibold text-muted-foreground">{experience.company}</h4>
            <ul className="list-[square] pl-5">
              {experience.bullets.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
