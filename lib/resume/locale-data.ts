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
  header: { name: "Tony Wu", profession: "AI Full-Stack Engineer" },
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
    {
      group: "Languages",
      data: ["Python", "Java", "JavaScript", "TypeScript"],
    },
    {
      group: "Frontend",
      data: [
        "React.js",
        "Next.js",
        "Tailwind CSS",
        "shadcn/ui",
        "PyQt6",
      ],
    },
    {
      group: "Backend",
      data: [
        "FastAPI",
        "Flask",
        "NestJS",
        "Spring Boot",
      ],
    },
    {
      group: "AI & LLM",
      data: [
        "AI Agents",
        "Context Engineering",
        "RAG",
        "LangChain",
        "Langfuse",
      ],
    },
    {
      group: "Databases",
      data: [
        "PostgreSQL",
        "MongoDB",
        "Redis",
        "ChromaDB",
      ],
    },
    {
      group: "DevOps & Infrastructure",
      data: [
        "Docker",
        "Linux",
        "Nginx",
        "MinIO",
        "GitLab",
        "GitHub",
        "Vercel",
      ],
    },
    {
      group: "Development Tools",
      data: [
        "Claude Code",
        "OpenCode",
        "Blender",
      ],
    },
  ],
  interests: [
    "Foreign Languages",
    "Content Creation",
    "Self Improvement",
    "Gym",
  ],
  workExperiences: [
    {
      position: "Python Software Engineer",
      company: "Kam Kiu Aluminium Group",
      start: "May 2025",
      end: "Present",
      bullets: [
        "Built and deployed an automated OQC reporting system with PyQt, FastAPI, and Celery/Redis, reducing manual processing by 95% and saving 6+ hours/day, across multiple projects and teams",
        "Built a real-time manufacturing performance dashboard with PyQt, enabling live production monitoring and faster operational decisions",
        "Designed and deployed a shared Nginx reverse-proxy infrastructure for multiple Dockerized applications on Linux servers, centralizing HTTP/HTTPS routing and backend access while maintaining application isolation",
        "Engineered and deployed a full-stack training management platform with Next.js, FastAPI, and self-hosted MinIO object storage, providing centralized management of training content and media resources",
        "Digitised a paper-based examination workflow into a full-stack assessment platform using Next.js, NestJS, and LLMs, automating question-bank parsing, assessment creation, and free-text answer grading, with Langfuse for LLM observability and evaluation",
      ],
    },
  ],
  personalProjects: [
    {
      title: "Resume LLM Assistant",
      details: [
        "Built a resume chat assistant for HR professionals to query candidate resumes using natural language, leveraging a Next.js frontend and FastAPI backend",
        "Designed and implemented a resume ingestion pipeline using Alibaba text embedding models to generate semantic embeddings for resume sections",
        "Integrated ChromaDB vector storage for efficient similarity search and semantic retrieval of candidate information",
        "Developed a custom Retrieval-Augmented Generation (RAG) pipeline with LangChain to deliver context-aware responses from relevant resume sections",
        "Implemented semantic search workflows enabling recruiters to quickly retrieve candidate skills, experience, and qualifications from unstructured resume data",
      ],
    },
    {
      title: "Personal Website",
      details: [
        "Engineered an interactive 3D homepage with React Three Fiber and Blender, featuring interactive objects, camera views, and navigation",
        "Developed a full-stack activity telemetry system with a desktop client-side logger that records keyboard/mouse usage in MongoDB, with interactive usage dashboards on Next.js frontend",
        "Created an interactive knowledge graph using an Obsidian plugin to extract note metadata into MongoDB, visualized with PixiJS/WebGL and D3 force-directed simulation",
        "Implemented a Claude Code hook to capture per-request LLM usage, including token counts, cost, and model, with a Next.js dashboard for usage analysis",
        "Deployed the personal website on Vercel with automated production deployments",
      ],
    },
  ],
  selfEvaluation: [
    "AI-native engineering mindset, experienced in leveraging AI Agent tools to accelerate development, automate workflows, and improve productivity while critically evaluating their outputs",
    "Keen explorer of emerging technologies, actively experimenting with a wide range of new tools, frameworks, models, and development approaches to understand their practical capabilities and limitations",
    "Strong technical judgment with an emphasis on understanding technology trade-offs, evaluating different approaches, and selecting the right tools and architectures based on specific requirements, constraints, and use cases",
    "Innovative and solution-oriented, with a proven ability to identify opportunities for process improvement, develop creative solutions that drive efficiency and business value",
  ],
}

export const zh: ResumeData = {
  header: { name: "吴家聪", profession: "AI 全栈工程师" },
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
    {
      group: "编程语言",
      data: ["Python", "Java", "JavaScript", "TypeScript"],
    },
    {
      group: "前端开发",
      data: [
        "React.js",
        "Next.js",
        "Tailwind CSS",
        "shadcn/ui",
        "PyQt6",
      ],
    },
    {
      group: "后端开发",
      data: [
        "FastAPI",
        "Flask",
        "NestJS",
        "Spring Boot",
      ],
    },
    {
      group: "AI 与大语言模型",
      data: [
        "AI 智能体",
        "上下文工程",
        "检索增强生成（RAG）",
        "LangChain",
        "Langfuse",
        "Claude Code",
      ],
    },
    {
      group: "数据库",
      data: [
        "PostgreSQL",
        "MongoDB",
        "Redis",
        "ChromaDB",
      ],
    },
    {
      group: "DevOps 与基础设施",
      data: [
        "Docker",
        "Linux",
        "Nginx",
        "MinIO",
        "GitLab CI/CD",
        "GitHub",
        "Vercel",
      ],
    },
    {
      group: "开发工具",
      data: [
        "Claude Code",
        "OpenCode",
        "Blender",
      ],
    },
  ],
  interests: ["外语学习", "内容创作", "自我提升", "健身"],
  workExperiences: [
    {
      position: "Python软件工程师",
      company: "金桥铝材集团",
      start: "2025.05",
      end: "至今",
      bullets: [
        "构建并部署基于 PyQt、FastAPI 和 Celery/Redis 的自动化 OQC 报表系统，将人工处理工作量减少 95%，每天节省 6+ 小时，并覆盖多个项目及团队",
        "开发实时制造绩效监控平台，实现生产数据实时监控，帮助团队更快掌握生产状况并提升运营决策效率",
        "设计并部署基于 Linux 服务器的共享 Nginx 反向代理基础设施，为多个 Docker 化应用提供统一的 HTTP/HTTPS 路由与后端访问，同时保持应用之间的隔离",
        "搭建并部署基于 Next.js、FastAPI 和自托管 MinIO 对象存储的全栈培训管理平台，实现培训内容及媒体资源的集中化管理",
        "将传统纸质考试流程数字化，基于 Next.js、NestJS 和大语言模型构建全栈评测平台，自动完成题库解析、试卷生成及主观题评分，并通过 Langfuse 实现 LLM 可观测性与评估",
      ],
    },
  ],
  personalProjects: [
    {
      title: "简历 LLM 智能助手",
      details: [
        "设计并构建了一个简历聊天助手，帮助 HR 通过自然语言查询候选人简历，采用 Next.js 前端与 FastAPI 后端架构",
        "设计并实现简历数据摄取流程，使用阿里巴巴文本嵌入模型生成简历内容的语义向量",
        "集成 ChromaDB 向量数据库，实现高效的相似度搜索与候选人信息语义检索",
        "基于 LangChain 开发自定义 Retrieval-Augmented Generation（RAG）流程，从相关简历内容中生成具备上下文感知能力的回答",
        "实现语义搜索工作流，帮助招聘人员快速从非结构化简历数据中检索候选人的技能、经验与资格",
      ],
    },
    {
      title: "个人网站",
      details: [
        "使用 React Three Fiber 和 Blender 构建交互式 3D 首页，实现可交互物体、镜头视角切换及页面导航",
        "开发全栈活动遥测系统，通过桌面客户端记录键盘与鼠标使用数据并存储至 MongoDB，并在 Next.js 前端提供交互式使用情况仪表板",
        "基于 Obsidian 插件构建交互式知识图谱，将笔记元数据提取至 MongoDB，并使用 PixiJS/WebGL 与 D3 力导向模拟进行可视化",
        "实现 Claude Code Hook，捕获每次 LLM 请求的使用数据，包括 Token 数量、费用及模型，并通过 Next.js 构建使用情况分析仪表板",
        "将个人网站部署至 Vercel，并实现生产环境的自动化部署",
      ],
    },
  ],
  selfEvaluation: [
    "AI 原生工程思维，具备运用 AI Agent 工具加速开发、自动化工作流程并提升生产力的经验，同时能够批判性地评估其输出结果",
    "热衷于探索新兴技术，积极尝试各种新工具、框架、模型和开发方式，以深入了解其实际能力与局限性",
    "具备较强的技术判断力，注重理解不同技术方案之间的权衡，根据具体需求、约束条件和应用场景评估不同方案，并选择合适的工具与架构",
    "创新且以解决问题为导向，能够识别流程改进机会，并通过创新方案提升效率与业务价值",
  ],
}

export const RESUME_DATA: Record<Locale, ResumeData> = { en, zh }

export function getResumeData(locale: Locale): ResumeData {
  return RESUME_DATA[locale]
}
