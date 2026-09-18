import type { ResumeData } from "@/lib/resume/types"
import { Education } from "./education"
import { Interests } from "./interests"
import { Languages } from "./languages"
import { PersonalProjects } from "./personal-projects"
import { ResumeHeader } from "./resume-header"
import { SelfEvaluation } from "./self-evaluation"
import { TechnicalSkills } from "./technical-skills"
import { WorkExperience } from "./work-experience"

const COLUMN_COMMON = "flex flex-col gap-2 m-3 p-3"

// The composer is the one place that holds the whole document: its job is to
// decide which slice each section gets, so it is also the only component that
// needs to see all of them.
export function ResumeA4Page({ data }: { data: ResumeData }) {
  return (
    <div className="resume-page w-[210mm] h-[297mm] bg-white shadow-2xl mx-auto my-10 flex flex-col print:m-0 print:shadow-none">
      <ResumeHeader header={data.header} contacts={data.contacts} />
      <div className="flex flex-grow">
        <div className={`${COLUMN_COMMON} w-[28%] bg-accent`}>
          <Education title={data.titles.education} items={data.education} />
          <Languages
            title={data.titles.foreignLanguages}
            items={data.languages}
          />
          <TechnicalSkills
            title={data.titles.technicalSkills}
            items={data.technicalSkills}
          />
          <Interests title={data.titles.interests} items={data.interests} />
        </div>
        <div className={`${COLUMN_COMMON} w-[72%] ml-0 pl-1`}>
          <WorkExperience
            title={data.titles.workExperiences}
            items={data.workExperiences}
          />
          <PersonalProjects
            title={data.titles.personalProjects}
            items={data.personalProjects}
          />
          <SelfEvaluation
            title={data.titles.selfEvaluation}
            items={data.selfEvaluation}
          />
        </div>
      </div>
    </div>
  )
}
