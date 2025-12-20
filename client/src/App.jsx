import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { Search, Sparkles, ExternalLink, Bot, Code, Image as ImageIcon, PenTool, Video, Globe, Navigation, Wrench } from 'lucide-react'
import StarryLoading from './components/StarryLoading'
import Toolbox from './components/Toolbox'
import JsonEditor from './components/JsonEditor'

// 辅助函数：根据类别返回图标
const getCategoryIcon = (category) => {
  if (!category) return <Sparkles className="w-5 h-5 text-gray-500" />;
  // 简单的映射，因为 category 可能是英文也可能是中文
  if (category.includes('Chat') || category.includes('聊天')) return <Bot className="w-5 h-5 text-blue-500" />;
  if (category.includes('Image') || category.includes('图像')) return <ImageIcon className="w-5 h-5 text-purple-500" />;
  if (category.includes('Video') || category.includes('视频')) return <Video className="w-5 h-5 text-red-500" />;
  if (category.includes('Dev') || category.includes('开发') || category.includes('Coding')) return <Code className="w-5 h-5 text-green-500" />;
  if (category.includes('Writing') || category.includes('写作') || category.includes('Marketing')) return <PenTool className="w-5 h-5 text-yellow-500" />;
  return <Sparkles className="w-5 h-5 text-gray-500" />;
}

const ToolIcon = ({ tool }) => {
  const [error, setError] = useState(false);

  if (error || !tool.url) {
    return (
      <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-indigo-50 transition-colors w-12 h-12 flex items-center justify-center shrink-0">
        {getCategoryIcon(tool.category)}
      </div>
    );
  }

  return (
    <div className="w-12 h-12 bg-white rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 p-1">
      <img 
        src={`/api/nav/logo?url=${encodeURIComponent(tool.url)}&name=${encodeURIComponent(tool.name)}`} 
        alt={tool.name}
        className="w-full h-full object-contain"
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
};

function App() {
  const { t, i18n } = useTranslation()
  const [tools, setTools] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('nav') // 'nav' | 'toolbox' | 'json'
  const initRef = useRef(false)

  useEffect(() => {
    fetchTools()
    // 检查是否是初次访问，尝试根据 IP 切换语言
    checkIpLocation()
  }, [])

  const fetchTools = async () => {
    setLoading(true)
    try {
      try {
        // 使用 /api/nav/trending 获取每日热门工具
        const res = await axios.get('/api/nav/trending')
        if (Array.isArray(res.data) && res.data.length > 0) {
          setTools(res.data)
          return
        }
      } catch (error) {
        console.error('Error fetching tools:', error)
      }

      // Fallback: 如果 trending 失败或为空，获取静态全量列表
      try {
        const res = await axios.get('/api/nav/tools')
        setTools(res.data)
      } catch (error) {
        console.error('Error fetching static tools:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  const checkIpLocation = async () => {
    // 如果用户之前手动设置过语言 (i18next 通常会存在 localStorage)，则不覆盖
    // 但为了演示 "根据 IP 自动切换"，我们这里设定：只要 localStorage 没有明确的值，或者我们想强制检测一次
    // 注意：i18next-browser-languagedetector 会自动写入 localStorage
    
    // 简单的逻辑：如果应用刚刚加载且我们想确认 IP
    if (initRef.current) return;
    initRef.current = true;

    try {
      const res = await axios.get('/api/nav/location');
      const { country } = res.data;
      console.log('Detected IP Country:', country);

      if (country === 'CN') {
        if (i18n.language !== 'zh') {
          console.log('Switching to zh based on IP');
          i18n.changeLanguage('zh');
        }
      } else if (country) {
        // 非中国地区，且不是 undefined，切换到英文
        if (i18n.language !== 'en') {
          console.log('Switching to en based on IP');
          i18n.changeLanguage('en');
        }
      }
    } catch (error) {
      console.error('Error checking IP location:', error);
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await axios.post('/api/nav/search', { query })
      setTools(res.data)
    } catch (error) {
      console.error('Error searching tools:', error)
    } finally {
      setLoading(false)
    }
  }

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
  }

  // 获取当前语言的显示内容
  const getLocalizedContent = (tool) => {
    const isEn = i18n.language.startsWith('en');
    return {
      description: (isEn && tool.description_en) ? tool.description_en : tool.description,
      category: (isEn && tool.category_en) ? tool.category_en : tool.category,
      tags: (isEn) ? tool.tags : (tool.tags_zh || tool.tags)
    };
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header / Hero Section */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          
          {/* Top Bar: Logo & Language & Tabs */}
          <div className="flex flex-col md:flex-row justify-between items-center py-3">
            {/* Logo Area */}
            <div className="flex items-baseline space-x-2 mb-2 md:mb-0">
              <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent cursor-pointer" onClick={() => setActiveTab('nav')}>
                {t('brand_name')}
              </h1>
              <span className="text-sm text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded-full">
                {activeTab === 'nav' ? t('nav_station') : (activeTab === 'toolbox' ? t('toolbox') : t('json_editor_title'))}
              </span>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('nav')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'nav' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Navigation className="w-4 h-4" />
                <span>{t('nav_station')}</span>
              </button>
              <button
                onClick={() => setActiveTab('toolbox')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'toolbox' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Wrench className="w-4 h-4" />
                <span>{t('toolbox')}</span>
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'json' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Code className="w-4 h-4" />
                <span>JSON</span>
              </button>
            </div>

            {/* Language Switcher */}
            <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 ml-4">
              <Globe className="w-3 h-3" />
              <button 
                onClick={() => changeLanguage('zh')} 
                className={`hover:text-indigo-600 ${i18n.language.startsWith('zh') ? 'font-bold text-indigo-600' : ''}`}
              >
                CN
              </button>
              <span>/</span>
              <button 
                onClick={() => changeLanguage('en')} 
                className={`hover:text-indigo-600 ${i18n.language.startsWith('en') ? 'font-bold text-indigo-600' : ''}`}
              >
                EN
              </button>
            </div>
          </div>

          {/* Search Bar (Only visible in Nav mode) */}
          {activeTab === 'nav' && (
            <div className="py-4 flex flex-col items-center justify-center text-center space-y-2 border-t border-slate-100 mt-2">
              
              <form onSubmit={handleSearch} className="w-full max-w-2xl relative group !mt-4">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-11 pr-4 py-3 bg-slate-100 border-transparent text-slate-900 placeholder-slate-400 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all shadow-inner"
                  placeholder={t('search_placeholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="absolute inset-y-0 right-2 flex items-center">
                  <button
                    type="submit"
                    disabled={loading}
                    className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'nav' ? (
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-800">
              {query ? t('search_results') : t('popular_tools')}
            </h2>
            <span className="text-sm text-slate-500">{t('tools_found', { count: tools.length })}</span>
          </div>

          {loading ? (
            <div className="w-full">
              <StarryLoading />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool) => {
                const content = getLocalizedContent(tool);
                return (
                  <div key={tool.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:border-indigo-200 transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <ToolIcon tool={tool} />
                        <div>
                          <h3 className="font-bold text-lg text-slate-800 group-hover:text-indigo-600 transition-colors">{tool.name}</h3>
                          <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
                            {content.category}
                          </span>
                        </div>
                      </div>
                      <a 
                        href={tool.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                    <p className="text-slate-600 text-sm line-clamp-2 mb-3 h-10">
                      {content.description}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex space-x-2">
                        {content.tags && content.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tools.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">{t('no_results')}</h3>
              <p className="text-slate-500 mt-2">{t('try_adjusting')}</p>
            </div>
          )}
        </main>
      ) : activeTab === 'toolbox' ? (
        <Toolbox />
      ) : (
        <JsonEditor />
      )}
    </div>
  )
}

export default App
