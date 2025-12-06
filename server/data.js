const tools = [
  {
    id: 1,
    name: "ChatGPT",
    description: "OpenAI 开发的通用人工智能聊天机器人，能够回答问题、编写代码、生成创意内容。支持 GPT-3.5 和 GPT-4 模型。",
    description_en: "General-purpose AI chatbot developed by OpenAI, capable of answering questions, writing code, and generating creative content. Supports GPT-3.5 and GPT-4 models.",
    category: "Chatbot",
    category_en: "Chatbot",
    url: "https://chat.openai.com",
    tags: ["AI Chat", "Writing", "Coding", "Assistant"],
    tags_zh: ["AI 聊天", "写作", "代码", "助手"]
  },
  {
    id: 2,
    name: "Midjourney",
    description: "强大的 AI 图像生成工具，通过 Discord 运行，能根据文本描述生成极具艺术感和真实感的高质量图像。",
    description_en: "Powerful AI image generation tool running via Discord, capable of generating high-quality, artistic, and realistic images from text descriptions.",
    category: "Image Generation",
    category_en: "Image Generation",
    url: "https://www.midjourney.com",
    tags: ["Image", "Art", "Design", "Drawing"],
    tags_zh: ["图像", "艺术", "设计", "绘画"]
  },
  {
    id: 3,
    name: "Notion AI",
    description: "集成在 Notion 工作流中的 AI 助手，帮助用户快速写作、总结会议记录、润色文章和整理笔记。",
    description_en: "AI assistant integrated into the Notion workflow, helping users write faster, summarize meeting notes, polish articles, and organize notes.",
    category: "Productivity",
    category_en: "Productivity",
    url: "https://www.notion.so",
    tags: ["Writing", "Notes", "Office", "Summary"],
    tags_zh: ["写作", "笔记", "办公", "摘要"]
  },
  {
    id: 4,
    name: "Runway Gen-2",
    description: "领先的 AI 视频生成工具，支持 Text-to-Video 和 Image-to-Video，专为创意人员设计的视频编辑套件。",
    description_en: "Leading AI video generation tool supporting Text-to-Video and Image-to-Video, designed as a video editing suite for creatives.",
    category: "Video Generation",
    category_en: "Video Generation",
    url: "https://runwayml.com",
    tags: ["Video", "Creative", "Editing", "Motion"],
    tags_zh: ["视频", "创意", "剪辑", "动态"]
  },
  {
    id: 5,
    name: "GitHub Copilot",
    description: "基于 OpenAI Codex 的 AI 编程助手，集成在 VS Code 等 IDE 中，实时提供代码建议和补全。",
    description_en: "AI coding assistant based on OpenAI Codex, integrated into IDEs like VS Code, providing real-time code suggestions and completions.",
    category: "Developer Tools",
    category_en: "Developer Tools",
    url: "https://github.com/features/copilot",
    tags: ["Coding", "Developer", "Productivity", "Programming"],
    tags_zh: ["代码", "开发者", "生产力", "编程"]
  },
  {
    id: 6,
    name: "Jasper",
    description: "专为营销人员和企业设计的 AI 写作助手，擅长生成 SEO 友好的博客、广告文案、社交媒体帖子。",
    description_en: "AI writing assistant designed for marketers and businesses, specializing in generating SEO-friendly blogs, ad copy, and social media posts.",
    category: "Marketing",
    category_en: "Marketing",
    url: "https://www.jasper.ai",
    tags: ["Writing", "Marketing", "Copywriting", "SEO"],
    tags_zh: ["写作", "营销", "文案", "SEO"]
  },
  {
    id: 7,
    name: "Stable Diffusion",
    description: "开源的文本到图像生成模型，可以本地部署，拥有庞大的模型微调社区 (Civitai)。",
    description_en: "Open-source text-to-image generation model that can be deployed locally, with a massive model fine-tuning community (Civitai).",
    category: "Image Generation",
    category_en: "Image Generation",
    url: "https://stability.ai",
    tags: ["Image", "Open Source", "Art", "Local"],
    tags_zh: ["图像", "开源", "艺术", "本地部署"]
  },
  {
    id: 8,
    name: "ElevenLabs",
    description: "目前最逼真的 AI 语音生成 (TTS) 和声音克隆工具，支持多种语言和情感表达。",
    description_en: "Currently the most realistic AI voice generation (TTS) and voice cloning tool, supporting multiple languages and emotional expressions.",
    category: "Audio",
    category_en: "Audio",
    url: "https://elevenlabs.io",
    tags: ["Voice", "Audio", "TTS", "Speech"],
    tags_zh: ["语音", "音频", "TTS", "演讲"]
  },
  {
    id: 9,
    name: "Claude 3",
    description: "Anthropic 推出的高性能 AI 模型，具有超长上下文窗口，擅长逻辑推理、文档分析和编码。",
    description_en: "High-performance AI model by Anthropic with a massive context window, excelling in logical reasoning, document analysis, and coding.",
    category: "Chatbot",
    category_en: "Chatbot",
    url: "https://claude.ai",
    tags: ["AI Chat", "Analysis", "Writing", "Coding"],
    tags_zh: ["AI 聊天", "分析", "写作", "代码"]
  },
  {
    id: 10,
    name: "Sora",
    description: "OpenAI 发布的文生视频模型，能够生成长达一分钟的高清视频，保持视觉一致性 (目前仅部分开放)。",
    description_en: "Text-to-video model released by OpenAI, capable of generating high-definition videos up to one minute long with visual consistency (currently partially open).",
    category: "Video Generation",
    category_en: "Video Generation",
    url: "https://openai.com/sora",
    tags: ["Video", "Simulation", "Creative"],
    tags_zh: ["视频", "模拟", "创意"]
  },
  {
    id: 11,
    name: "Perplexity AI",
    description: "结合了 ChatGPT 能力的 AI 搜索引擎，提供带有实时来源引用的准确答案。",
    description_en: "AI search engine combining ChatGPT capabilities, providing accurate answers with real-time source citations.",
    category: "Productivity",
    category_en: "Productivity",
    url: "https://www.perplexity.ai",
    tags: ["Search", "Research", "Assistant"],
    tags_zh: ["搜索", "研究", "助手"]
  },
  {
    id: 12,
    name: "Hugging Face",
    description: "AI 领域的 GitHub，提供海量开源模型、数据集和 Demo，是开发者寻找模型的首选之地。",
    description_en: "The GitHub of AI, offering massive open-source models, datasets, and demos, the go-to place for developers to find models.",
    category: "Developer Tools",
    category_en: "Developer Tools",
    url: "https://huggingface.co",
    tags: ["Open Source", "Models", "Machine Learning"],
    tags_zh: ["开源", "模型", "机器学习"]
  },
  {
    id: 13,
    name: "Gamma",
    description: "AI 驱动的演示文稿生成工具，只需输入主题即可自动生成精美的 PPT、文档和网页。",
    description_en: "AI-powered presentation generator that automatically creates stunning PPTs, docs, and webpages from just a topic.",
    category: "Productivity",
    category_en: "Productivity",
    url: "https://gamma.app",
    tags: ["Presentation", "Design", "Office"],
    tags_zh: ["演示文稿", "设计", "办公"]
  },
  {
    id: 14,
    name: "Suno",
    description: "强大的 AI 音乐生成工具，能够根据文本描述生成包含人声和伴奏的完整歌曲。",
    description_en: "Powerful AI music generation tool capable of creating full songs with vocals and accompaniment from text descriptions.",
    category: "Audio",
    category_en: "Audio",
    url: "https://suno.ai",
    tags: ["Music", "Audio", "Creative"],
    tags_zh: ["音乐", "音频", "创意"]
  },
  {
    id: 15,
    name: "V0.dev",
    description: "Vercel 推出的 AI UI 生成工具，通过文本描述生成基于 Tailwind CSS 的 React 组件代码。",
    description_en: "AI UI generation tool by Vercel that generates Tailwind CSS-based React component code from text descriptions.",
    category: "Developer Tools",
    category_en: "Developer Tools",
    url: "https://v0.dev",
    tags: ["Coding", "UI/UX", "Design"],
    tags_zh: ["代码", "UI/UX", "设计"]
  }
];

module.exports = tools;
