# Resume Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/resume` section to the personal site that renders the archived TonyWuCV A4 resume (exact styling/positioning) with a working English/中文 toggle.

**Architecture:** A client-side locale toggle (`en`/`zh`) drives a typed `ResumeData` object built from ported locale data. Presentational components in `components/resume/` render the data as an exact `210mm × 297mm` sheet inside the existing sidebar layout. Scoped CSS forces light tokens and adds `--theme-1`; print rules hide the site chrome so only the sheet prints.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui (base-nova / @base-ui), `lucide-react` (nav icons), `react-icons` (contact icons, new dep), Jest + @testing-library.

**Spec:** `docs/superpowers/specs/2026-08-14-resume-section-design.md`

## Global Constraints

- Work on a new branch `feat/resume-section` (the repo is on `main`; branch before the first commit).
- The working tree contains **unrelated uncommitted changes** to `app/activity-telemetry/page.tsx`, `components/telemetry/keyboard-heatmap.tsx`, `components/telemetry/mouse-visual.tsx`, and their `tests/` files. **Never stage or touch these.** Stage only files this plan creates/modifies.
- Every commit message ends with:
  `Co-Authored-By: Claude <noreply@anthropic.com>`
- Path alias `@/*` → project root (tsconfig + jest config already set).
- The resume sheet must force light color tokens regardless of site dark mode (`--theme-1` = `oklch(0 0 0)`; `--accent` = `oklch(0.97 0 0)`; `--muted-foreground` = `oklch(0.556 0 0)`; `--background` = `oklch(1 0 0)`).
- `.env` is gitignored — do not commit it. Add `NEXT_PUBLIC_EMAIL/PHONE/GITHUB/WECHAT` by copying values from `../resume/.env.local`.
- Per repo convention (CLAUDE.md), maintain a progress ledger at `.superpowers/sdd/resume-section/progress.md`, updating it as tasks complete.
- Tailwind v4 `w-3/10` / `w-7/10` are the exact archive classes (bare fractions → 30%/70%). If a utility fails to generate in this build, replace with `w-[30%]` / `w-[70%]` and note it in the commit.

---

### Task 1: Resume data layer

**Files:**
- Create: `lib/resume/types.ts`
- Create: `lib/resume/locale-data.ts`
- Test: `tests/lib/resume/locale-data.test.ts`

**Interfaces:**
- Produces: `Locale`, `ResumeData`, and all item interfaces from `lib/resume/types.ts`; `getResumeData(locale: Locale): ResumeData`, `en`, `zh` from `lib/resume/locale-data.ts`. Later tasks import these exact names.

- [ ] **Step 1: Create the feature branch and commit the spec + plan docs**

```bash
cd /Users/jwu02/Developer/PersonalProjects/personal-website/jwoo
git checkout -b feat/resume-section
git add docs/superpowers/specs/2026-08-14-resume-section-design.md docs/superpowers/plans/2026-08-14-resume-section.md
git commit -m "docs: add resume section spec and implementation plan

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/resume/locale-data.test.ts`:

```ts
import { en, getResumeData, zh } from "@/lib/resume/locale-data"

describe("resume locale data", () => {
  it("en and zh expose the same top-level shape", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    for (const key of [
      "education",
      "languages",
      "interests",
      "workExperiences",
      "personalProjects",
      "selfEvaluation",
    ]) {
      expect((en[key] as unknown[]).length).toBeGreaterThan(0)
      expect((zh[key] as unknown[]).length).toBeGreaterThan(0)
    }
    expect(en.technicalSkills.length).toBeGreaterThan(0)
    expect(zh.technicalSkills.length).toBeGreaterThan(0)
  })

  it("getResumeData returns the requested locale", () => {
    expect(getResumeData("en").header.name).toBe("Tony Wu")
    expect(getResumeData("zh").header.name).toBe("吴家聪")
  })

  it("languages are resolved to localized labels", () => {
    expect(en.languages[0]).toEqual({
      key: "english",
      label: "English",
      proficiencyLabel: "Native",
      value: 95,
    })
    expect(zh.languages[0]).toEqual({
      key: "english",
      label: "英语",
      proficiencyLabel: "母语",
      value: 95,
    })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/lib/resume/locale-data.test.ts`
Expected: FAIL — module `@/lib/resume/locale-data` cannot be resolved.

- [ ] **Step 4: Create `lib/resume/types.ts`**

```ts
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
```

- [ ] **Step 5: Create `lib/resume/locale-data.ts`**

Port the full content below. `buildLanguages` resolves the archive's `foreignLanguageItems` (english:95/native, mandarin:70/heritage, cantonese:50/heritage, japanese:20/intermediate, french:20/intermediate) into localized label objects.

```ts
import type { LanguageItem, Locale, ResumeData } from "./types"

const LANGUAGE_ITEMS: { key: string; value: number }[] = [
  { key: "english", value: 95 },
  { key: "mandarin", value: 70 },
  { key: "cantonese", value: 50 },
  { key: "japanese", value: 20 },
  { key: "french", value: 20 },
]

const PROFICIENCY_BY_KEY: Record<string, string> = {
  english: "native",
  mandarin: "heritage",
  cantonese: "heritage",
  japanese: "intermediate",
  french: "intermediate",
}

const LANGUAGE_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    english: "English",
    mandarin: "Mandarin",
    cantonese: "Cantonese",
    japanese: "Japanese",
    french: "French",
  },
  zh: {
    english: "英语",
    mandarin: "普通话",
    cantonese: "粤语",
    japanese: "日语",
    french: "法语",
  },
}

const PROFICIENCY_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    native: "Native",
    heritage: "Heritage",
    intermediate: "Intermediate",
    beginner: "Beginner",
  },
  zh: {
    native: "母语",
    heritage: "传承语言",
    intermediate: "中级",
    beginner: "初级",
  },
}

function buildLanguages(locale: Locale): LanguageItem[] {
  return LANGUAGE_ITEMS.map(({ key, value }) => ({
    key,
    label: LANGUAGE_LABELS[locale][key],
    proficiencyLabel: PROFICIENCY_LABELS[locale][PROFICIENCY_BY_KEY[key]],
    value,
  }))
}

export const en: ResumeData = {
  header: { name: "Tony Wu", profession: "Python / Automation Engineer" },
  titles: {
    education: "Education",
    foreignLanguages: "Languages",
    technicalSkills: "Technical Skills",
    interests: "Other Interests",
    workExperiences: "Work Experiences",
    personalProjects: "Personal Projects",
    selfEvaluation: "Personal Evaluation",
  },
  education: [
    {
      school: "The University of Sheffield",
      place: "Sheffield",
      qualification: "BSc Computer Science (2:1)",
      start: "Sep 2020",
      end: "Jul 2023",
    },
  ],
  languages: buildLanguages("en"),
  technicalSkills: [
    { group: "Programming Languages", data: ["Python", "Java", "JavaScript"] },
    { group: "Frontend", data: ["React.js", "Next.js", "Tailwind CSS", "shadcn/ui", "PyQt6"] },
    { group: "Backend", data: ["FastAPI", "Flask", "Spring Boot", "REST APIs"] },
    { group: "CLoud & DevOps", data: ["AWS (Lambda, API Gateway)", "Docker", "Linux", "GitLab", "GitHub"] },
    { group: "Data & AI", data: ["Fundamental Machine Learning Algorithms", "LLMs", "RAG", "Claude Code"] },
  ],
  interests: ["Foreign Languages", "Content Creation", "Self Improvement", "Psychology", "Gym"],
  workExperiences: [
    {
      position: "Python Software Engineer",
      company: "Kamkiu Aluminium Products",
      start: "May 2025",
      end: "Present",
      bullets: [
        "Built and deployed an automated OQC reporting system with PyQt, FastAPI, Celery/Redis, and Docker, reducing manual report processing by 95% and saving 6+ hours/day by automating data pipelines across multiple reporting workflows",
        "Developed and deployed a full-stack training management platform using Next.js, FastAPI, and MinIO, containerized with Docker and hosted on Linux servers with Caddy reverse proxy for secure service routing.",
        "Built a real-time manufacturing performance dashboard with PyQt, to monitor live process metrics, improving visibility into production and enabling faster operational decisions",
        "Built a PyQt-based data analysis platform for process engineers, standardizing analytical workflows and reducing onboarding time for new engineers",
      ],
    },
  ],
  personalProjects: [
    {
      title: "Resume LLM Assistant",
      details: [
        "Vibe-coded a ChatGPT-style resume assistant for HR professionals to query candidate resumes using natural language, leveraging a Next.js frontend and FastAPI backend",
        "Designed and implemented a resume ingestion pipeline using Alibaba text embedding models to generate semantic embeddings for resume sections",
        "Integrated ChromaDB vector storage for efficient similarity search and semantic retrieval of candidate information",
        "Developed a custom Retrieval-Augmented Generation (RAG) pipeline with LangChain to deliver context-aware responses from relevant resume sections",
        "Implemented semantic search workflows enabling recruiters to quickly retrieve candidate skills, experience, and qualifications from unstructured resume data",
      ],
    },
    {
      title: "PC Activity Monitoring",
      details: [
        "Built a Python-based desktop application to track and record system activity, including keyboard input and mouse interactions, for personal productivity analytics",
        "Designed a serverless data pipeline using AWS API Gateway and Lambda to periodically transmit activity data, with storage in MongoDB for persistence and querying",
        "Developed a Next.js frontend dashboard to visualize user activity data via serverless APIs, enabling real-time personal behavior insights",
      ],
    },
    {
      title: "Obsidian Notes Knowledge Graph",
      details: [
        "Integrated GitHub API to retrieve and sync backed-up Obsidian note data for structured knowledge extraction",
        "Built an interactive force-directed graph visualization using D3.js to represent relationships between notes, enabling exploration of knowledge connections",
        "Embedded visualization into a Next.js personal website for interactive browsing and knowledge navigation",
      ],
    },
  ],
  selfEvaluation: [
    "Strong engineering mindset with solid problem-solving skills; capable of independently delivering complex features while maintaining high standards of code quality, maintainability, and performance optimization",
    "Rapid learner with a strong commitment to continuous learning, consistently staying up to date with emerging technologies such as large language models and AI-driven applications",
    "Experienced in using AI/LLM tools to accelerate product delivery, while critically evaluating and adapting generated code for reliability and maintainability",
    "Innovative and solution-oriented, with a proven ability to identify opportunities for process improvement, leverage emerging technologies, and develop creative solutions that drive efficiency and business value",
  ],
}

export const zh: ResumeData = {
  header: { name: "吴家聪", profession: "Python / 自动化 工程师" },
  titles: {
    education: "教育背景",
    foreignLanguages: "语言能力",
    technicalSkills: "专业技能",
    interests: "其他兴趣",
    workExperiences: "工作经历",
    personalProjects: "个人项目",
    selfEvaluation: "自我评价",
  },
  education: [
    {
      school: "谢菲尔德大学",
      place: "谢菲尔德",
      qualification: "本科计算机科学（2:1）",
      start: "2020.09",
      end: "2023.07",
    },
  ],
  languages: buildLanguages("zh"),
  technicalSkills: [
    { group: "编程语言", data: ["Python", "Java", "JavaScript"] },
    { group: "前端开发", data: ["React.js", "Next.js", "Tailwind CSS", "shadcn/ui", "PyQt6"] },
    { group: "后端开发", data: ["FastAPI", "Flask", "Spring Boot", "REST API"] },
    { group: "云服务与DevOps", data: ["AWS（Lambda, API Gateway）", "Docker"] },
    { group: "数据与人工智能", data: ["机器学习", "大语言模型（LLMs）", "检索增强生成（RAG）"] },
    { group: "开发实践", data: ["敏捷开发（Agile）", "系统设计", "分层架构"] },
  ],
  interests: ["外语学习", "内容创作", "自我提升", "心理学", "健身"],
  workExperiences: [
    {
      position: "Python软件工程师",
      company: "金桥铝材有限公司",
      start: "2025.05",
      end: "至今",
      bullets: [
        "使用 FastAPI、Celery/Redis 和 Docker 架构并部署自动化 OQC 报告系统，实现分布式任务的可扩展异步处理",
        "开发基于 PyQt 的前端应用并与后端服务集成，利用 Win32 API 实现操作系统级打印任务调度，全面自动化文档队列流程",
        "通过自动化内部数据管道，将人工报告处理工作量减少95%，每天节省约7小时工时，覆盖多个项目及不同类型的报告工作流程",
        "开发实时制造绩效监控仪表盘，跟踪生产过程关键指标，提升生产可视化能力并加快运营决策速度",
        "构建基于 PyQt 的数据分析平台，规范工程师分析流程，缩短新员工上手时间",
      ],
    },
  ],
  personalProjects: [
    {
      title: "简历 LLM 智能助手",
      details: [
        "Vibecoded 一个类似 ChatGPT 的简历聊天助手，帮助 HR 通过自然语言查询候选人简历，采用 Next.js 前端与 FastAPI 后端架构",
        "设计并实现简历数据摄取流程，使用阿里巴巴文本嵌入模型生成简历内容的语义向量",
        "集成 ChromaDB 向量数据库，实现高效的相似度搜索与候选人信息语义检索",
        "基于 LangChain 开发自定义 Retrieval-Augmented Generation（RAG）流程，从相关简历内容中生成具备上下文感知能力的回答",
        "实现语义搜索工作流，帮助招聘人员快速从非结构化简历数据中检索候选人的技能、经验与资格",
      ],
    },
    {
      title: "PC 活动监控系统",
      details: [
        "开发基于 Python 的桌面应用，用于跟踪并记录系统活动，包括键盘输入及鼠标点击与移动行为，用于个人生产力分析",
        "设计无服务器数据管道，通过 AWS API Gateway 与 Lambda 定期上传活动数据，并存储至 MongoDB 以支持持久化与查询分析",
        "开发基于 Next.js 的前端数据看板，通过无服务器 API 可视化用户行为数据，实现实时个人行为洞察",
      ],
    },
    {
      title: "Obsidian 笔记知识图谱",
      details: [
        "通过 GitHub API 获取并同步备份的 Obsidian 笔记数据，实现结构化知识提取",
        "使用 D3.js 构建交互式力导向图可视化，用于展示笔记之间的关联关系，支持知识网络探索",
        "将可视化模块集成至 Next.js 个人网站，实现交互式浏览与知识导航",
      ],
    },
  ],
  selfEvaluation: [
    "具备扎实的工程思维和优秀的问题解决能力，能够独立完成复杂功能开发，同时保持高质量代码、良好可维护性及性能优化",
    "学习能力强，持续保持对新技术的关注与学习，紧跟大语言模型（LLM）及AI应用等前沿发展",
    "具备使用AI/大语言模型工具加速产品开发的经验，并能够对生成代码进行深入理解、评估与优化，以确保系统的可靠性和可维护性",
    "具有创新性和以解决方案为导向，善于识别流程改进机会、利用新兴技术，并提出富有创意的解决方案，从而提升效率并创造业务价值",
  ],
}

export const RESUME_DATA: Record<Locale, ResumeData> = { en, zh }

export function getResumeData(locale: Locale): ResumeData {
  return RESUME_DATA[locale]
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/lib/resume/locale-data.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/resume/types.ts lib/resume/locale-data.ts tests/lib/resume/locale-data.test.ts
git commit -m "feat: add resume data layer with en/zh locales

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Badge and Progress UI primitives

**Files:**
- Create: `components/ui/badge.tsx`, `components/ui/progress.tsx` (via shadcn skill)
- Test: `tests/components/resume/primitives.test.tsx`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: `Badge` (props: `variant?: "outline" | ...`, `className`) and `Progress` (props: `value?: number`, `className`, aria props) at `@/components/ui/badge` and `@/components/ui/progress`. Used by `Languages` and `Interests` in Task 3.

- [ ] **Step 1: Write the failing test**

Create `tests/components/resume/primitives.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

describe("resume UI primitives", () => {
  it("renders an outline badge", () => {
    render(<Badge variant="outline">Native</Badge>)
    expect(screen.getByText("Native")).toBeInTheDocument()
  })

  it("renders a progress bar", () => {
    const { container } = render(<Progress value={40} aria-label="language level" />)
    expect(container.querySelector('[data-slot="progress"]')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/resume/primitives.test.tsx`
Expected: FAIL — `@/components/ui/badge` / `@/components/ui/progress` cannot be resolved.

- [ ] **Step 3: Add the components via the shadcn skill**

Use the `shadcn` skill (Skill tool) to add the `badge` and `progress` components to `components/ui/` in this project's base-nova style. (Equivalently: `npx shadcn add badge progress`.) The generated components will use `@base-ui/react` like the rest of the site.

- [ ] **Step 4: Style them to the archive's look**

In `components/ui/progress.tsx`, apply the archive's exact classes to the generated component — root: `bg-primary/20 relative h-2 w-full overflow-hidden rounded-full`, indicator: `bg-primary h-full w-full transition-all` (with the translateX style the generated component already has). Keep the generated `role="progressbar"` semantics.

In `components/ui/badge.tsx`, confirm the `outline` variant renders `text-foreground` text with a visible border. No other changes required (usage sites pass className overrides).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/components/resume/primitives.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add components/ui/badge.tsx components/ui/progress.tsx tests/components/resume/primitives.test.tsx
git commit -m "feat: add badge and progress primitives for resume sections

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Resume section components

**Files:**
- Create: `components/resume/section-title.tsx`
- Create: `components/resume/education.tsx`
- Create: `components/resume/languages.tsx`
- Create: `components/resume/technical-skills.tsx`
- Create: `components/resume/interests.tsx`
- Create: `components/resume/work-experience.tsx`
- Create: `components/resume/personal-projects.tsx`
- Create: `components/resume/self-evaluation.tsx`
- Test: `tests/components/resume/sections.test.tsx`

**Interfaces:**
- Consumes: `ResumeData` from `@/lib/resume/types`, `Badge` from `@/components/ui/badge`, `Progress` from `@/components/ui/progress`.
- Produces: named exports `SectionTitle`, `Education`, `Languages`, `TechnicalSkills`, `Interests`, `WorkExperience`, `PersonalProjects`, `SelfEvaluation`. All section components take `{ data }: { data: ResumeData }`. `SectionTitle` takes `{ title }: { title: string }`. Used by the A4 page shell in Task 5.

- [ ] **Step 1: Write the failing test**

Create `tests/components/resume/sections.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { Education } from "@/components/resume/education"
import { Interests } from "@/components/resume/interests"
import { Languages } from "@/components/resume/languages"
import { PersonalProjects } from "@/components/resume/personal-projects"
import { SelfEvaluation } from "@/components/resume/self-evaluation"
import { TechnicalSkills } from "@/components/resume/technical-skills"
import { WorkExperience } from "@/components/resume/work-experience"
import { en } from "@/lib/resume/locale-data"

describe("resume section components", () => {
  it("Education renders school, dates, and qualification", () => {
    render(<Education data={en} />)
    expect(screen.getByText("The University of Sheffield")).toBeInTheDocument()
    expect(screen.getByText("Sheffield, Sep 2020 - Jul 2023")).toBeInTheDocument()
    expect(screen.getByText("BSc Computer Science (2:1)")).toBeInTheDocument()
  })

  it("Languages renders labels, proficiency badges, and progress bars", () => {
    const { container } = render(<Languages data={en} />)
    expect(screen.getByText("English")).toBeInTheDocument()
    expect(screen.getByText("Native")).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="progress"]')).toHaveLength(
      en.languages.length
    )
  })

  it("TechnicalSkills renders group and comma-joined items", () => {
    render(<TechnicalSkills data={en} />)
    expect(screen.getByText(/Programming Languages:/)).toBeInTheDocument()
    expect(screen.getByText(/Python, Java, JavaScript/)).toBeInTheDocument()
  })

  it("Interests renders outline badges", () => {
    render(<Interests data={en} />)
    for (const interest of en.interests) {
      expect(screen.getByText(interest)).toBeInTheDocument()
    }
  })

  it("WorkExperience renders position, company, dates, and bullets", () => {
    render(<WorkExperience data={en} />)
    expect(screen.getByText("Python Software Engineer")).toBeInTheDocument()
    expect(screen.getByText("Kamkiu Aluminium Products")).toBeInTheDocument()
    expect(screen.getByText("May 2025 - Present")).toBeInTheDocument()
    expect(screen.getByText(en.workExperiences[0].bullets[0])).toBeInTheDocument()
  })

  it("PersonalProjects renders titles and details", () => {
    render(<PersonalProjects data={en} />)
    expect(screen.getByText("Resume LLM Assistant")).toBeInTheDocument()
    expect(screen.getByText(en.personalProjects[0].details[0])).toBeInTheDocument()
  })

  it("SelfEvaluation renders all items", () => {
    render(<SelfEvaluation data={en} />)
    for (const item of en.selfEvaluation) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/resume/sections.test.tsx`
Expected: FAIL — imports cannot be resolved.

- [ ] **Step 3: Create the components**

`components/resume/section-title.tsx`:

```tsx
interface SectionTitleProps {
  title: string
}

export function SectionTitle({ title }: SectionTitleProps) {
  return (
    <div className="border-b-2 border-theme-1 w-full mb-2">
      <h2 className="bg-theme-1 text-background font-bold px-2 py-1 w-fit">{title}</h2>
    </div>
  )
}
```

`components/resume/education.tsx`:

```tsx
import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function Education({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.education} />
      <div className="flex flex-col gap-2">
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
  )
}
```

`components/resume/languages.tsx`:

```tsx
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function Languages({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.foreignLanguages} />
      <div className="flex flex-col gap-2">
        {data.languages.map((language) => (
          <div key={language.key} className="flex flex-col gap-1">
            <div className="flex justify-between">
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
  )
}
```

`components/resume/technical-skills.tsx`:

```tsx
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
```

`components/resume/interests.tsx`:

```tsx
import { Badge } from "@/components/ui/badge"
import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function Interests({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.interests} />
      <div>
        {data.interests.map((interest, index) => (
          <Badge key={index} variant="outline" className="text-base">
            {interest}
          </Badge>
        ))}
      </div>
    </div>
  )
}
```

`components/resume/work-experience.tsx`:

```tsx
import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function WorkExperience({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.workExperiences} />
      <div className="flex flex-col gap-2">
        {data.workExperiences.map((experience, index) => (
          <div key={index}>
            <div className="flex justify-between">
              <h3 className="font-semibold">{experience.position}</h3>
              <h3>
                {experience.start} - {experience.end}
              </h3>
            </div>
            <h4 className="font-semibold text-muted-foreground">{experience.company}</h4>
            <ul className="list-disc pl-5">
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
```

`components/resume/personal-projects.tsx`:

```tsx
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
```

`components/resume/self-evaluation.tsx`:

```tsx
import type { ResumeData } from "@/lib/resume/types"
import { SectionTitle } from "./section-title"

export function SelfEvaluation({ data }: { data: ResumeData }) {
  return (
    <div>
      <SectionTitle title={data.titles.selfEvaluation} />
      <ul className="flex flex-col list-disc pl-5">
        {data.selfEvaluation.map((evaluation, index) => (
          <li key={index}>{evaluation}</li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/components/resume/sections.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add components/resume/ tests/components/resume/sections.test.tsx
git commit -m "feat: add presentational resume section components

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Resume header and contacts (icons, photo, env)

**Files:**
- Create: `components/resume/contacts.tsx`
- Create: `components/resume/resume-header.tsx`
- Copy: `public/pfp.jpg` (from `../resume/pfp.jpg`)
- Modify: `.env` (append 4 contact keys)
- Modify: `package.json` + `package-lock.json` (add `react-icons`)
- Test: `tests/components/resume/contacts.test.tsx`

**Interfaces:**
- Consumes: `ResumeData` from `@/lib/resume/types`.
- Produces: `Contacts` (no props) and `ResumeHeader({ data }: { data: ResumeData })` at `@/components/resume/contacts` and `@/components/resume/resume-header`. Used by the A4 page shell in Task 5.

- [ ] **Step 1: Write the failing test**

Create `tests/components/resume/contacts.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { Contacts } from "@/components/resume/contacts"

describe("Contacts", () => {
  it("renders nothing when no contact env vars are set", () => {
    render(<Contacts />)
    expect(screen.queryByText(/@/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/resume/contacts.test.tsx`
Expected: FAIL — `@/components/resume/contacts` cannot be resolved.

- [ ] **Step 3: Install react-icons and copy the photo**

```bash
cd /Users/jwu02/Developer/PersonalProjects/personal-website/jwoo
npm install react-icons
cp ../resume/pfp.jpg public/pfp.jpg
```

- [ ] **Step 4: Append contact env vars to `.env`**

Read the values from `../resume/.env.local` and append to `.env`:

```bash
NEXT_PUBLIC_EMAIL=
NEXT_PUBLIC_PHONE=
NEXT_PUBLIC_GITHUB=
NEXT_PUBLIC_WECHAT=
```

(fill each with the corresponding value from `../resume/.env.local`; `.env` is gitignored, so it is never committed)

- [ ] **Step 5: Create `components/resume/contacts.tsx`**

```tsx
import { IoLogoWechat } from "react-icons/io5"
import { RxEnvelopeClosed, RxGithubLogo, RxMobile } from "react-icons/rx"

const CONTACT_ITEMS = [
  { key: "email", icon: RxEnvelopeClosed, value: process.env.NEXT_PUBLIC_EMAIL ?? null },
  { key: "phone", icon: RxMobile, value: process.env.NEXT_PUBLIC_PHONE ?? null },
  { key: "github", icon: RxGithubLogo, value: process.env.NEXT_PUBLIC_GITHUB ?? null },
  { key: "wechat", icon: IoLogoWechat, value: process.env.NEXT_PUBLIC_WECHAT ?? null },
] as const

export function Contacts() {
  return (
    <div className="flex flex-col gap-1 py-2 font-medium">
      {CONTACT_ITEMS.filter((contact) => contact.value).map(
        ({ key, icon: Icon, value }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-background bg-theme-1 p-1.5 rounded-full">
              <Icon size={16} />
            </span>
            <span>{value}</span>
          </div>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create `components/resume/resume-header.tsx`**

```tsx
import Image from "next/image"
import type { ResumeData } from "@/lib/resume/types"
import { Contacts } from "./contacts"

export function ResumeHeader({ data }: { data: ResumeData }) {
  return (
    <div className="flex items-center justify-around gap-5 p-5 bg-accent">
      <div>
        <Image
          src="/pfp.jpg"
          width={125}
          height={125}
          className="rounded-full"
          alt="Tony Wu"
        />
      </div>
      <div>
        <div className="text-5xl font-black">{data.header.name}</div>
        <div className="text-3xl text-muted-foreground font-bold">
          {data.header.profession}
        </div>
      </div>
      <Contacts />
    </div>
  )
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- tests/components/resume/contacts.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 8: Commit**

```bash
git add components/resume/contacts.tsx components/resume/resume-header.tsx tests/components/resume/contacts.test.tsx public/pfp.jpg package.json package-lock.json
git commit -m "feat: add resume header and env-driven contacts

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: A4 page shell + scoped styling foundation

**Files:**
- Create: `components/resume/resume-a4-page.tsx`
- Modify: `app/globals.css` (add `--color-theme-1` mapping, `.resume-page` scoped tokens, `@page`, print rules)
- Test: `tests/components/resume/resume-a4-page.test.tsx`

**Interfaces:**
- Consumes: all section components from Task 3, `ResumeHeader` from Task 4.
- Produces: `ResumeA4Page({ data }: { data: ResumeData })` at `@/components/resume/resume-a4-page`. Used by `ResumeView` in Task 6.

- [ ] **Step 1: Write the failing test**

Create `tests/components/resume/resume-a4-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { ResumeA4Page } from "@/components/resume/resume-a4-page"
import { en } from "@/lib/resume/locale-data"

describe("ResumeA4Page", () => {
  it("renders the header name and every section title", () => {
    render(<ResumeA4Page data={en} />)
    expect(screen.getByText("Tony Wu")).toBeInTheDocument()
    for (const title of Object.values(en.titles)) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it("carries the A4 sheet sizing classes", () => {
    const { container } = render(<ResumeA4Page data={en} />)
    const sheet = container.querySelector(".resume-page")
    expect(sheet).toHaveClass("w-[210mm]", "h-[297mm]", "bg-white")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/resume/resume-a4-page.test.tsx`
Expected: FAIL — `@/components/resume/resume-a4-page` cannot be resolved.

- [ ] **Step 3: Create `components/resume/resume-a4-page.tsx`**

```tsx
import type { ResumeData } from "@/lib/resume/types"
import { Education } from "./education"
import { Interests } from "./interests"
import { Languages } from "./languages"
import { PersonalProjects } from "./personal-projects"
import { ResumeHeader } from "./resume-header"
import { SelfEvaluation } from "./self-evaluation"
import { TechnicalSkills } from "./technical-skills"
import { WorkExperience } from "./work-experience"

const COLUMN_COMMON = "flex flex-col gap-4 m-3 p-4"

export function ResumeA4Page({ data }: { data: ResumeData }) {
  return (
    <div className="resume-page w-[210mm] h-[297mm] bg-white shadow-2xl mx-auto my-10 flex flex-col print:m-0 print:shadow-none">
      <ResumeHeader data={data} />
      <div className="flex flex-grow">
        <div className={`${COLUMN_COMMON} w-3/10 bg-accent`}>
          <Education data={data} />
          <Languages data={data} />
          <TechnicalSkills data={data} />
          <Interests data={data} />
        </div>
        <div className={`${COLUMN_COMMON} w-7/10 ml-0 pl-2`}>
          <WorkExperience data={data} />
          <PersonalProjects data={data} />
          <SelfEvaluation data={data} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the styling foundation to `app/globals.css`**

Inside `@theme inline { ... }`, add the token mapping (it enables `bg-theme-1` / `border-theme-1`):

```css
  --color-theme-1: var(--theme-1);
```

After the `@layer base { ... }` block, append:

```css
/* Resume A4 sheet (archived TonyWuCV port): force light tokens + archive base type */
.resume-page {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --border: oklch(0.922 0 0);
  --theme-1: oklch(0 0 0);
  font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.25;
}

@page {
  size: A4;
  margin: 0;
}

@media print {
  aside[data-slot="sidebar"],
  header {
    display: none !important;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/components/resume/resume-a4-page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Manually confirm the 30/70 column split renders**

Run: `npm run dev` and open `/resume` (temporarily mount `ResumeA4Page` on the route if Task 6/7 aren't done yet — or defer this check until after Task 7). Confirm the left column is visually ~30% of the sheet and the right ~70%. If `w-3/10`/`w-7/10` did not generate, replace them with `w-[30%]`/`w-[70%]` in `resume-a4-page.tsx`.

- [ ] **Step 7: Commit**

```bash
git add components/resume/resume-a4-page.tsx app/globals.css tests/components/resume/resume-a4-page.test.tsx
git commit -m "feat: add A4 resume page shell with scoped styling

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Language toggle + resume view (locale state)

**Files:**
- Create: `components/resume/language-toggle.tsx`
- Create: `components/resume/resume-view.tsx`
- Test: `tests/components/resume/resume-view.test.tsx`

**Interfaces:**
- Consumes: `Locale`, `ResumeData` from `@/lib/resume/types`; `getResumeData` from `@/lib/resume/locale-data`; `ResumeA4Page` from Task 5.
- Produces: `ResumeView` (no props, client component) at `@/components/resume/resume-view` and `LanguageToggle({ locale, onChange })` at `@/components/resume/language-toggle`. Used by `app/resume/page.tsx` in Task 7.

- [ ] **Step 1: Write the failing test**

Create `tests/components/resume/resume-view.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { ResumeView } from "@/components/resume/resume-view"

describe("ResumeView", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("defaults to English", () => {
    render(<ResumeView />)
    expect(screen.getByText("Tony Wu")).toBeInTheDocument()
  })

  it("switches to Chinese and persists the choice", () => {
    render(<ResumeView />)
    fireEvent.click(screen.getByRole("button", { name: "中" }))
    expect(screen.getByText("吴家聪")).toBeInTheDocument()
    expect(window.localStorage.getItem("resume:locale")).toBe("zh")
  })

  it("switches back to English", () => {
    render(<ResumeView />)
    fireEvent.click(screen.getByRole("button", { name: "中" }))
    fireEvent.click(screen.getByRole("button", { name: "EN" }))
    expect(screen.getByText("Tony Wu")).toBeInTheDocument()
  })

  it("reads a persisted locale on mount", () => {
    window.localStorage.setItem("resume:locale", "zh")
    render(<ResumeView />)
    expect(screen.getByText("吴家聪")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/components/resume/resume-view.test.tsx`
Expected: FAIL — `@/components/resume/resume-view` cannot be resolved.

- [ ] **Step 3: Create `components/resume/language-toggle.tsx`**

```tsx
import type { Locale } from "@/lib/resume/types"
import { cn } from "@/lib/utils"

interface LanguageToggleProps {
  locale: Locale
  onChange: (locale: Locale) => void
}

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中" },
]

export function LanguageToggle({ locale, onChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-1 print:hidden">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={locale === option.value}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium",
            locale === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create `components/resume/resume-view.tsx`**

```tsx
"use client"

import { useState } from "react"
import { getResumeData } from "@/lib/resume/locale-data"
import type { Locale } from "@/lib/resume/types"
import { LanguageToggle } from "./language-toggle"
import { ResumeA4Page } from "./resume-a4-page"

const RESUME_LOCALE_KEY = "resume:locale"

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "en"
  return window.localStorage.getItem(RESUME_LOCALE_KEY) === "zh" ? "zh" : "en"
}

export function ResumeView() {
  const [locale, setLocale] = useState<Locale>(readInitialLocale)
  const data = getResumeData(locale)

  const handleChange = (next: Locale) => {
    setLocale(next)
    window.localStorage.setItem(RESUME_LOCALE_KEY, next)
  }

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex justify-end">
        <LanguageToggle locale={locale} onChange={handleChange} />
      </div>
      <ResumeA4Page data={data} />
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/components/resume/resume-view.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add components/resume/language-toggle.tsx components/resume/resume-view.tsx tests/components/resume/resume-view.test.tsx
git commit -m "feat: add language toggle and resume view with persisted locale

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Resume route + Geist font + print-safe layout

**Files:**
- Create: `app/resume/page.tsx`
- Modify: `app/layout.tsx` (add `print:p-0` to the content wrapper)

**Interfaces:**
- Consumes: `ResumeView` from Task 6.
- Produces: `app/resume/page.tsx` (server component) serving `/resume`.

- [ ] **Step 1: Create `app/resume/page.tsx`**

```tsx
import { Geist } from "next/font/google"

import { ResumeView } from "@/components/resume/resume-view"

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export default function ResumePage() {
  return (
    <div className={geist.variable}>
      <ResumeView />
    </div>
  )
}
```

- [ ] **Step 2: Make the layout print-safe in `app/layout.tsx`**

Change the children wrapper from:

```tsx
<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
```

to:

```tsx
<div className="flex flex-1 flex-col gap-4 p-4 pt-0 print:p-0">
```

- [ ] **Step 3: Verify the route builds and serves**

Run: `npm run dev`, open `http://localhost:3000/resume`. Expected: the sidebar/header still show; the toggle (top-right) and the white A4 sheet render; the sheet is centered with the two columns visible; switching 中 swaps the name to 吴家聪; the dark theme does not tint the sheet.

- [ ] **Step 4: Verify print output**

From the same page, run `window.print()` (Cmd+P). Expected: a single A4 page showing only the white sheet — no sidebar, no header, no toggle, no shadow/margins.

- [ ] **Step 5: Commit**

```bash
git add app/resume/page.tsx app/layout.tsx
git commit -m "feat: add resume route with Geist font and print-safe layout

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Navigation entry + home card

**Files:**
- Modify: `components/app-sidebar.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Add the sidebar item in `components/app-sidebar.tsx`**

Add `FileText` to the lucide import:

```tsx
import { Activity, Circle, FileText, Home, Radar } from "lucide-react"
```

Add the nav item at the end of `NAV_ITEMS`:

```tsx
  { title: "Resume", url: "/resume", icon: FileText },
```

- [ ] **Step 2: Add a Resume card to `app/page.tsx`**

Add `FileText` to the lucide import and append a third `Card` inside the grid section, mirroring the existing two:

```tsx
        <Card>
          <CardHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText />
            </div>
            <CardTitle>Resume</CardTitle>
            <CardDescription>
              My CV as an exact A4 sheet — English and 中文.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/resume" />} nativeButton={false}>
              <FileText data-icon="inline-start" />
              View resume
            </Button>
          </CardContent>
        </Card>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`. Then `npm run dev`, confirm the sidebar shows **Resume** and the home page shows the third card; both navigate to `/resume`.

- [ ] **Step 4: Commit**

```bash
git add components/app-sidebar.tsx app/page.tsx
git commit -m "feat: add resume navigation entry and home card

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `tests/lib/resume/` and `tests/components/resume/` suites.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no type errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no lint errors. Run `npm run format` if prettier complains.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds, `/resume` route included.

- [ ] **Step 5: Final manual pass**

Run: `npm run dev`. Open `/resume`:
- EN default; toggle to 中 and back; reload keeps the chosen locale.
- Sheet matches the archive layout: header (photo, name, profession, contacts), 30/70 columns, black-banded section titles, 12px base text.
- Dark mode leaves the sheet white; the surrounding chrome stays themed.
- `window.print()` prints one clean A4 page of the sheet only.

- [ ] **Step 6: Report**

Summarize the completed work, the branch name, and confirm the unrelated telemetry working-tree changes were left untouched and uncommitted.
