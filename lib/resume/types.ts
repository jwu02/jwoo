export type Locale = "en" | "zh"

export interface ResumeHeader {
  name: string
  profession: string
}

export interface EducationItem {
  school: string
  place: string
  qualification: string
  start: string
  end: string
}

export interface TechnicalSkillItem {
  group: string
  data: string[]
}

export interface WorkExperienceItem {
  company: string
  position: string
  start: string
  end: string
  bullets: string[]
}

export interface ProjectItem {
  title: string
  details: string[]
}

export interface LanguageItem {
  key: string
  label: string
  proficiencyLabel: string
  value: number
}

export interface ResumeTitles {
  education: string
  foreignLanguages: string
  technicalSkills: string
  interests: string
  workExperiences: string
  personalProjects: string
  selfEvaluation: string
}

export interface ResumeData {
  header: ResumeHeader
  titles: ResumeTitles
  education: EducationItem[]
  languages: LanguageItem[]
  technicalSkills: TechnicalSkillItem[]
  interests: string[]
  workExperiences: WorkExperienceItem[]
  personalProjects: ProjectItem[]
  selfEvaluation: string[]
}
