import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { ResumeData } from "@/lib/resume/types"
import { ResumeHeader } from "./resume-header"
import { SectionTitle } from "./section-title"

const COLUMN_COMMON = "flex flex-col gap-2 m-3 p-3"

// The composer is the one place that holds the whole document: its job is to
// decide which slice each section gets, so the sections are written here
// rather than in single-use files of their own.
export function ResumeA4Page({ data }: { data: ResumeData }) {
  const { titles } = data

  return (
    <div className="resume-page w-[210mm] h-[297mm] bg-white shadow-2xl mx-auto my-10 flex flex-col print:m-0 print:shadow-none">
      <ResumeHeader header={data.header} contacts={data.contacts} />
      <div className="flex flex-grow">
        <div className={`${COLUMN_COMMON} w-[28%] bg-accent`}>
          <div>
            <SectionTitle title={titles.education} />
            <div className="flex flex-col gap-1">
              {data.education.map((item, index) => (
                <div key={index}>
                  <div className="font-bold">{item.school}</div>
                  <div className="text-muted-foreground">
                    {item.place}, {item.start} - {item.end}
                  </div>
                  <div>{item.qualification}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle title={titles.foreignLanguages} />
            <div className="flex flex-col gap-1">
              {data.languages.map((language) => (
                <div key={language.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span>{language.label}</span>
                    <Badge className="px-2 py-0" variant="outline">
                      {language.proficiencyLabel}
                    </Badge>
                  </div>
                  <Progress value={language.value} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle title={titles.technicalSkills} />
            <ul className="flex flex-col">
              {data.technicalSkills.map((skill, index) => (
                <div key={index}>
                  <b>{skill.group}:</b> {skill.data.join(", ")}
                </div>
              ))}
            </ul>
          </div>

          <div>
            <SectionTitle title={titles.interests} />
            <div className="flex flex-wrap gap-0.5">
              {data.interests.map((interest, index) => (
                <Badge key={index} variant="outline">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className={`${COLUMN_COMMON} w-[72%] ml-0 pl-1`}>
          <div>
            <SectionTitle title={titles.workExperiences} />
            <div className="flex flex-col gap-1">
              {data.workExperiences.map((experience, index) => (
                <div key={index}>
                  <div className="flex justify-between">
                    <h3 className="font-semibold">{experience.position}</h3>
                    <h3>
                      {experience.start} - {experience.end}
                    </h3>
                  </div>
                  <h4 className="font-semibold text-muted-foreground">
                    {experience.company}
                  </h4>
                  <ul className="list-[square] pl-5">
                    {experience.bullets.map((detail, index) => (
                      <li key={index}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle title={titles.personalProjects} />
            <div className="flex flex-col gap-1">
              {data.personalProjects.map((project, index) => (
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

          <div>
            <SectionTitle title={titles.selfEvaluation} />
            <ul className="flex flex-col list-[square] pl-5">
              {data.selfEvaluation.map((evaluation, index) => (
                <li key={index}>{evaluation}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
