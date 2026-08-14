import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function PersonalProjects({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.personalProjects} />
      <div className="flex flex-col gap-2">
        {data.personalProjects.map((project, index) => (
          <div key={index}>
            <h3 className="font-semibold">{project.title}</h3>
            <ul className="list-disc pl-5">
              {project.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
