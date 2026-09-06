import type { ResumeData } from "@/lib/resume/types"
import { Education } from "./education"
import { Interests } from "./interests"
import { Languages } from "./languages"
import { PersonalProjects } from "./personal-projects"
import { ResumeHeader } from "./resume-header"
import { SelfEvaluation } from "./self-evaluation"
import { TechnicalSkills } from "./technical-skills"
import { WorkExperience } from "./work-experience"

const COLUMN_COMMON = "flex flex-col gap-4 m-3 p-3"

export function ResumeA4Page({ data }: { data: ResumeData }) {
  return (
    <div className="resume-page w-[210mm] h-[297mm] bg-white shadow-2xl mx-auto my-10 flex flex-col print:m-0 print:shadow-none">
      <ResumeHeader data={data} />
      <div className="flex flex-grow">
        <div className={`${COLUMN_COMMON} w-[27%] bg-accent`}>
          <Education data={data} />
          <Languages data={data} />
          <TechnicalSkills data={data} />
          <Interests data={data} />
        </div>
        <div className={`${COLUMN_COMMON} w-[73%] ml-0 pl-2`}>
          <WorkExperience data={data} />
          <PersonalProjects data={data} />
          <SelfEvaluation data={data} />
        </div>
      </div>
    </div>
  )
}
