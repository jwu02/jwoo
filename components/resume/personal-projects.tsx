import type { ProjectItem } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function PersonalProjects({
  title,
  items,
}: {
  title: string
  items: ProjectItem[]
}) {
  return (
    <div>
      <SectionTitle title={title} />
      <div className="flex flex-col gap-1">
        {items.map((project, index) => (
          <div key={index}>
            <h3 className="font-semibold">{project.title}</h3>
            <ul className="list-[square] pl-5">
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
