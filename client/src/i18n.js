import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "brand_name": "NiuMa AI",
      "nav_station": "Navigation",
      "toolbox": "Toolbox",
      "title": "AI Navigation",
      "subtitle": "Useful AI tools to make your work easier.",
      "toolbox_title": "AI Toolbox",
      "toolbox_subtitle": "A collection of practical online tools to boost your productivity.",
      "search_placeholder": "Ask AI: 'I need a tool to generate logos' or 'Help me write code'...",
      "search_results": "Search Results",
      "popular_tools": "Popular Tools",
      "tools_found": "{{count}} tools found",
      "no_results": "No tools found",
      "try_adjusting": "Try adjusting your search query",
      "loading": "Loading...",
      "language": "Language",
      
      "tools_title": "Tools",
      "prompt_gen_title": "Prompt Generator",
      "prompt_gen_desc": "Optimize your rough ideas into professional prompts for ChatGPT or Midjourney.",
      "target_platform": "Target Platform",
      "platform_general": "General (ChatGPT, Claude)",
      "platform_image": "Image (Midjourney, SD)",
      "your_idea": "Your Idea",
      "idea_placeholder": "e.g., A futuristic city with flying cars at sunset...",
      "optimize_btn": "Optimize Prompt",
      "optimizing_btn": "Optimizing...",
      "optimized_result": "Optimized Result",
      "copy": "Copy",
      "copied": "Copied!",
      "gen_error": "Error generating prompt. Please try again.",
      
      "json_fmt_title": "JSON Formatter",
      "json_fmt_desc": "Validate, format, and minify your JSON data.",
      "input_json": "Input JSON",
      "output_json": "Output",
      "output_placeholder": "Formatted result will appear here...",
      "format_btn": "Format (Prettify)",
      "minify_btn": "Minify",
      
      "img_resizer_title": "Image Resizer",
      "img_resizer_desc": "Resize images quickly in your browser. No server upload required.",
      "upload_text": "Click or drag image here",
      "upload_hint": "Supports JPG, PNG, WEBP",
      "settings": "Settings",
      "width_px": "Width (px)",
      "height_px": "Height (px)",
      "maintain_aspect": "Maintain aspect ratio",
      "quality": "Quality",
      "download_btn": "Download Result",
      "reset_btn": "Reset / Choose another",
      "preview": "Preview",
      
      "ocr_title": "AI OCR & Translator",
      "ocr_desc": "Extract text from images and translate it instantly using advanced AI vision models.",
      "ocr_upload_hint": "Supports JPG, PNG (Max 5MB)",
      "target_lang": "Target Language",
      "recognize_btn": "Recognize & Translate",
      "recognizing": "Processing...",
      "original_text": "Original Text",
      "translated_text": "Translated Text"
    }
  },
  zh: {
    translation: {
      "brand_name": "牛马AI",
      "nav_station": "导航站",
      "toolbox": "工具箱",
      "title": "AI 导航站",
      "subtitle": "收录好用的 AI 工具，让工作变简单",
      "toolbox_title": "AI 效率工具箱",
      "toolbox_subtitle": "集合多种实用在线工具，提升您的工作效率。",
      "search_placeholder": "问 AI：'我需要一个生成 Logo 的工具' 或 '帮我写代码'...",
      "search_results": "搜索结果",
      "popular_tools": "热门工具",
      "tools_found": "找到 {{count}} 个工具",
      "no_results": "未找到相关工具",
      "try_adjusting": "尝试调整您的搜索关键词",
      "loading": "加载中...",
      "language": "语言",
      
      "tools_title": "工具列表",
      "prompt_gen_title": "提示词生成器",
      "prompt_gen_desc": "将您的想法优化为 ChatGPT 或 Midjourney 的专业提示词。",
      "target_platform": "目标平台",
      "platform_general": "通用对话 (ChatGPT, Claude)",
      "platform_image": "AI 绘画 (Midjourney, SD)",
      "your_idea": "您的想法",
      "idea_placeholder": "例如：夕阳下的未来城市，飞车穿梭...",
      "optimize_btn": "优化提示词",
      "optimizing_btn": "优化中...",
      "optimized_result": "优化结果",
      "copy": "复制",
      "copied": "已复制！",
      "gen_error": "生成失败，请重试。",
      
      "json_fmt_title": "JSON 格式化",
      "json_fmt_desc": "验证、格式化和压缩您的 JSON 数据。",
      "input_json": "输入 JSON",
      "output_json": "输出结果",
      "output_placeholder": "格式化结果将显示在这里...",
      "format_btn": "格式化 (美化)",
      "minify_btn": "压缩",
      
      "img_resizer_title": "图片压缩/缩放",
      "img_resizer_desc": "在浏览器中快速调整图片大小，无需上传服务器。",
      "upload_text": "点击或拖拽图片到这里",
      "upload_hint": "支持 JPG, PNG, WEBP",
      "settings": "设置",
      "width_px": "宽度 (px)",
      "height_px": "高度 (px)",
      "maintain_aspect": "保持纵横比",
      "quality": "质量",
      "download_btn": "下载结果",
      "reset_btn": "重置 / 选择其他图片",
      "preview": "预览",
      
      "ocr_title": "AI 识图",
      "ocr_desc": "利用先进的 AI 视觉模型提取图片文字并实时翻译。",
      "ocr_upload_hint": "支持 JPG, PNG (最大 5MB)",
      "target_lang": "目标语言",
      "recognize_btn": "识别并翻译",
      "recognizing": "正在处理中...",
      "original_text": "识别原文",
      "translated_text": "翻译结果"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh', // 默认语言设为中文
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
