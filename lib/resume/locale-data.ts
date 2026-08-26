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
  header: { name: "Tony Wu", profession: "Software Engineer" },
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
        "Built a 3D homepage from a Blender-authored glb rendered with React Three Fiber, using the Blender MCP to construct the scene and position objects, with orbit/zoom controls, hover labels, and clickable objects that navigate or focus authored camera views",
        "Built a full activity telemetry stack — a desktop logger that records mouse and keyboard events directly into MongoDB, with a Next.js REST API and Recharts/SVG heatmap dashboard visualizing real-time usage trends",
        "Built an interactive knowledge graph using a personal Obsidian plugin that extracts note metadata (filenames, creation dates, and wikilinks) into MongoDB, rendered with PixiJS on WebGL and laid out with a d3-force simulation",
        "Implemented a Claude Code hook that pushes per-request large language model usage statistics (token counts, cost, and model) into MongoDB, and added an AI usage dashboard to the website to visualize them",
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
  header: { name: "吴家聪", profession: "软件工程师" },
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
  interests: ["外语学习", "内容创作", "自我提升", "健身"],
  workExperiences: [
    {
      position: "Python软件工程师",
      company: "金桥铝材集团",
      start: "2025.05",
      end: "至今",
      bullets: [
        "使用 PyQt、FastAPI、Celery/Redis 和 Docker 构建并部署自动化 OQC 报告系统，通过自动化多个报告工作流程的数据管道，将人工报告处理量减少 95%，每天节省 6 小时以上工时",
        "使用 Next.js、FastAPI 和 MinIO 开发并部署全栈培训管理平台，采用 Docker 容器化部署，托管于 Linux 服务器，并通过 Caddy 反向代理实现安全的服务路由",
        "使用 PyQt 构建实时制造绩效监控仪表盘，实时监控生产过程指标，提升生产可视化能力，加快运营决策速度",
        "为工艺工程师构建基于 PyQt 的数据分析平台，规范分析工作流程，缩短新工程师的上手时间",
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
        "使用 Blender MCP 进行场景搭建与物体定位，从 Blender 导出 glb 模型，用 React Three Fiber 渲染 3D 首页，支持轨道/缩放控制、悬停标签，以及点击物体跳转页面或聚焦预设相机视角",
        "构建完整的活动遥测技术栈 — 桌面记录器将鼠标与键盘事件直接写入 MongoDB，配合 Next.js REST API 与 Recharts/SVG 热力图仪表盘，实时可视化使用趋势",
        "使用个人 Obsidian 插件将笔记元数据（文件名、创建日期与 wiki 链接）提取到 MongoDB，并基于 PixiJS（WebGL 渲染）与 d3-force 力导向布局构建交互式知识图谱",
        "实现 Claude Code hook，将每次请求的大语言模型使用统计（token 数量、费用与模型）写入 MongoDB，并在网站中新增 AI 用量仪表盘进行可视化展示",
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
