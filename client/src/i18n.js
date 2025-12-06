import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "title": "AI Navigation",
      "subtitle": "Discover the best AI tools for your workflow. Powered by intelligent search.",
      "search_placeholder": "Ask AI: 'I need a tool to generate logos' or 'Help me write code'...",
      "search_results": "Search Results",
      "popular_tools": "Popular Tools",
      "tools_found": "{{count}} tools found",
      "no_results": "No tools found",
      "try_adjusting": "Try adjusting your search query",
      "loading": "Loading...",
      "language": "Language"
    }
  },
  zh: {
    translation: {
      "title": "AI 导航站",
      "subtitle": "发现最适合您工作流程的 AI 工具。由智能搜索驱动。",
      "search_placeholder": "问 AI：'我需要一个生成 Logo 的工具' 或 '帮我写代码'...",
      "search_results": "搜索结果",
      "popular_tools": "热门工具",
      "tools_found": "找到 {{count}} 个工具",
      "no_results": "未找到相关工具",
      "try_adjusting": "尝试调整您的搜索关键词",
      "loading": "加载中...",
      "language": "语言"
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
