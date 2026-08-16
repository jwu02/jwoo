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
    {
      group: "Frontend",
      data: ["React.js", "Next.js", "Tailwind CSS", "shadcn/ui", "PyQt6"],
    },
    {
      group: "Backend",
      data: ["FastAPI", "Flask", "Spring Boot", "REST APIs"],
    },
    {
      group: "CLoud & DevOps",
      data: [
        "AWS (Lambda, API Gateway)",
        "Docker",
        "Linux",
        "GitLab",
        "GitHub",
      ],
    },
    {
      group: "Data & AI",
      data: [
        "Fundamental Machine Learning Algorithms",
        "LLMs",
        "RAG",
        "Claude Code",
      ],
    },
  ],
  interests: [
    "Foreign Languages",
    "Content Creation",
    "Self Improvement",
    "Psychology",
    "Gym",
  ],
  workExperiences: [
    {
      position: "Python Software Engineer",
      company: "Kam Kiu Aluminium Group",
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
      title: "Personal Website",
      details: [
        "Designed and built a personal website using Next.js, React, Tailwind CSS, and shadcn/ui, featuring an activity telemetry dashboard, an interactive knowledge graph, and a bilingual (English/Chinese) resume",
        "Built a full activity telemetry stack — a desktop logger that records mouse and keyboard events directly into MongoDB, with a Next.js REST API and Recharts/SVG heatmap dashboard visualizing real-time usage trends",
        "Built an interactive knowledge graph rendered with PixiJS on WebGL for smooth, high-performance interaction, using a d3-force simulation to lay out relationships between notes",
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
    {
      group: "前端开发",
      data: ["React.js", "Next.js", "Tailwind CSS", "shadcn/ui", "PyQt6"],
    },
    {
      group: "后端开发",
      data: ["FastAPI", "Flask", "Spring Boot", "REST API"],
    },
    { group: "云服务与DevOps", data: ["AWS（Lambda, API Gateway）", "Docker"] },
    {
      group: "数据与人工智能",
      data: ["机器学习", "大语言模型（LLMs）", "检索增强生成（RAG）"],
    },
    { group: "开发实践", data: ["敏捷开发（Agile）", "系统设计", "分层架构"] },
  ],
  interests: ["外语学习", "内容创作", "自我提升", "心理学", "健身"],
  workExperiences: [
    {
      position: "Python软件工程师",
      company: "金桥铝材集团",
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
      title: "个人网站",
      details: [
        "使用 Next.js、React、Tailwind CSS 与 shadcn/ui 构建个人网站，集活动遥测仪表盘、交互式知识图谱与中英双语简历于一体",
        "构建完整的活动遥测技术栈 — 桌面记录器将鼠标与键盘事件直接写入 MongoDB，配合 Next.js REST API 与 Recharts/SVG 热力图仪表盘，实时可视化使用趋势",
        "使用 PixiJS（基于 WebGL 渲染）构建交互式知识图谱，结合 d3-force 力导向布局，实现笔记与知识关联的流畅交互与浏览",
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
