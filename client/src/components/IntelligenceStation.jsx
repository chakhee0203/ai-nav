import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { 
    TrendingUp, TrendingDown, RefreshCw, AlertCircle, Newspaper, 
    Activity, Zap, DollarSign, Bitcoin, Sparkles, Bot, BarChart as BarChartIcon,
    PieChart as PieChartIcon, ShieldAlert, AlertTriangle, Target, Radio, Clock,
    Plus, Trash2, Search, Eye
  } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell,
  PieChart, Pie
} from 'recharts';
import StarryLoading from './StarryLoading';

const IntelligenceStation = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Watchlist State
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistData, setWatchlistData] = useState(null);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [newCode, setNewCode] = useState('');

  useEffect(() => {
    // Load watchlist from local storage
    const saved = localStorage.getItem('ai_nav_watchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse watchlist', e);
      }
    }
  }, []);

  const addToWatchlist = () => {
    if (!newCode) return;
    if (watchlist.length >= 5) {
      alert('最多只能添加 5 只自选股/基金');
      return;
    }
    if (watchlist.includes(newCode)) {
      setNewCode('');
      return;
    }
    const updated = [...watchlist, newCode];
    setWatchlist(updated);
    localStorage.setItem('ai_nav_watchlist', JSON.stringify(updated));
    setNewCode('');
  };

  const removeFromWatchlist = (code) => {
    const updated = watchlist.filter(c => c !== code);
    setWatchlist(updated);
    localStorage.setItem('ai_nav_watchlist', JSON.stringify(updated));
  };

  const analyzeWatchlist = async () => {
    if (watchlist.length === 0) return;
    setLoadingWatchlist(true);
    try {
      const res = await axios.post('/api/watchlist/analyze', { codes: watchlist });
      setWatchlistData(res.data.items);
    } catch (err) {
      console.error('Watchlist analysis failed', err);
      // Optional: setWatchlistError
    } finally {
      setLoadingWatchlist(false);
    }
  };

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      const endpoint = isRefresh ? '/api/intelligence/refresh' : '/api/intelligence/latest';
      const method = isRefresh ? 'post' : 'get';
      const res = await axios[method](endpoint);
      setData(res.data);
      
      // If manual refresh, also refresh watchlist
      if (isRefresh && watchlist.length > 0) {
          analyzeWatchlist();
      }
    } catch (err) {
      console.error('Failed to fetch intelligence:', err);
      setError('连接情报中心失败，请稍后重试。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Disabled automatic refresh
    // const interval = setInterval(() => { ... }, 60000); 
    // return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100">
        <StarryLoading />
        <p className="mt-4 text-slate-400 animate-pulse">正在从全球节点搜集情报...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-red-400">
        <AlertCircle className="w-16 h-16 mb-4" />
        <p className="text-xl">{error}</p>
        <button 
          onClick={() => fetchData()}
          className="mt-6 px-6 py-2 bg-red-900/30 border border-red-800 rounded-full hover:bg-red-900/50 transition-colors"
        >
          重新建立连接
        </button>
      </div>
    );
  }

  // --- Chart Data Preparation ---
  const sentimentScore = data?.analysis?.sentiment_score || 50;
  const sentimentData = [
    { name: 'Fear', value: 100 - sentimentScore },
    { name: 'Greed', value: sentimentScore },
  ];
  
  const riskData = data?.analysis?.risk_factors || [
    { name: 'A股风险', value: 5 },
    { name: '地缘', value: 7 },
    { name: '通胀', value: 6 },
    { name: 'Crypto', value: 8 },
    { name: '债务', value: 5 },
  ];

  const marketChangeData = [
    { name: '上证', value: parseFloat(data?.market?.stocks?.shanghai?.changePercent || 0) },
    { name: '深证', value: parseFloat(data?.market?.stocks?.shenzhen?.changePercent || 0) },
    { name: '恒生', value: parseFloat(data?.market?.stocks?.hsi?.changePercent || 0) },
    { name: '恒科', value: parseFloat(data?.market?.stocks?.hstech?.changePercent || 0) },
    { name: 'BTC', value: parseFloat(data?.market?.crypto?.bitcoin?.changePercent || 0) },
    { name: '黄金', value: parseFloat(data?.market?.gold?.london?.changePercent || 0) },
  ];

  // Helper for Market Card
  const MarketCard = ({ title, price, change, icon, color }) => {
    const isUp = parseFloat(change) >= 0;
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-4 rounded-xl flex items-center justify-between hover:bg-slate-800 transition-all">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color} bg-opacity-20`}>
            {icon}
          </div>
          <div>
            <p className="text-slate-400 text-sm">{title}</p>
            <p className="text-xl font-mono font-bold text-slate-100">{price}</p>
          </div>
        </div>
        <div className={`text-right ${isUp ? 'text-red-400' : 'text-green-400'}`}>
          <div className="flex items-center justify-end gap-1">
            {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="font-bold">{change}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 md:w-6 md:h-6 text-yellow-400 fill-yellow-400" />
            <span className="text-lg md:text-xl font-bold tracking-tight text-white">牛马<span className="text-indigo-400">情报站</span></span>
          </div>
          <div className="flex items-center gap-2 md:gap-4 text-sm">
            <span className="text-slate-500 text-xs hidden md:inline">
              情报更新于: {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : '-'}
            </span>
            <button 
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className={`flex items-center gap-2 px-2.5 py-1.5 md:px-3 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors ${refreshing ? 'opacity-70' : ''}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-xs md:text-sm hidden xs:inline">强制刷新</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        
        {/* 1. Breaking News Alert (Marquee if list exists, else single) */}
        {(data?.analysis?.breaking_news_list?.length > 0 || data?.analysis?.breaking_news) && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-4 md:p-6 relative overflow-hidden animate-fade-in group">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <AlertTriangle className="w-32 h-32 md:w-64 md:h-64 text-red-500" />
                </div>
                
                {/* Header */}
                <div className="relative z-10 flex items-center justify-between mb-3 md:mb-4 border-b border-red-500/20 pb-2">
                    <div className="flex items-center gap-2">
                        <span className="animate-pulse relative flex h-2.5 w-2.5 md:h-3 md:w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 bg-red-500"></span>
                        </span>
                        <h3 className="text-red-400 font-bold uppercase tracking-wider text-xs md:text-sm">全球重大突发</h3>
                    </div>
                    <div className="text-[10px] md:text-xs text-red-400/60 font-mono">
                        {/* Static count or extra info if needed */}
                        实时监控中
                    </div>
                </div>

                {/* Content Area - Supports Scrolling */}
                <div className="relative z-10 h-28 md:h-32 overflow-hidden">
                   <div className={`${(data.analysis.breaking_news_list?.length > 1) ? 'animate-marquee-vertical' : ''} space-y-8`}>
                       {/* Handle both new list format and legacy single object format */}
                       {(data.analysis.breaking_news_list || [data.analysis.breaking_news]).map((news, idx) => (
                           <div key={idx} className="h-28 md:h-32 flex flex-col justify-center">
                                <div className="flex items-center justify-between mb-1">
                                    <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-white truncate pr-2 md:pr-4">
                                        {news.title}
                                    </h2>
                                    {news.time && (
                                        <div className="flex-shrink-0 flex items-center gap-1 text-red-300/80 text-[10px] md:text-xs font-mono bg-red-900/40 px-1.5 py-0.5 md:px-2 md:py-1 rounded border border-red-500/20">
                                            <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            {news.time}
                                        </div>
                                    )}
                                </div>
                                <p className="text-slate-300 text-sm md:text-lg line-clamp-2 mb-2 leading-relaxed">
                                    {news.summary}
                                </p>
                                <div className="flex items-center gap-2">
                                    <div className="inline-flex items-center px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-xs md:text-sm font-medium">
                                        影响: {news.impact || '高危'}
                                    </div>
                                    {data.analysis.breaking_news_list?.length > 1 && (
                                        <span className="text-[10px] md:text-xs text-slate-500">
                                            ({idx + 1}/{data.analysis.breaking_news_list.length})
                                        </span>
                                    )}
                                </div>
                           </div>
                       ))}
                   </div>
                </div>
            </div>
        )}

        {/* 2. Market Overview Cards */}
        <section className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <MarketCard 
            title="上证指数" 
            price={data?.market?.stocks?.shanghai?.price || '-'} 
            change={data?.market?.stocks?.shanghai?.changePercent || '0'} 
            icon={<Activity className="w-4 h-4 md:w-5 md:h-5 text-red-500" />}
            color="bg-red-500"
          />
          <MarketCard 
            title="深证成指" 
            price={data?.market?.stocks?.shenzhen?.price || '-'} 
            change={data?.market?.stocks?.shenzhen?.changePercent || '0'} 
            icon={<Activity className="w-4 h-4 md:w-5 md:h-5 text-purple-500" />}
            color="bg-purple-500"
          />
          <MarketCard 
            title="恒生指数" 
            price={data?.market?.stocks?.hsi?.price || '-'} 
            change={data?.market?.stocks?.hsi?.changePercent || '0'} 
            icon={<Activity className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />}
            color="bg-indigo-500"
          />
          <MarketCard 
            title="恒生科技" 
            price={data?.market?.stocks?.hstech?.price || '-'} 
            change={data?.market?.stocks?.hstech?.changePercent || '0'} 
            icon={<Zap className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />}
            color="bg-cyan-500"
          />
          <MarketCard 
            title="国际黄金" 
            price={data?.market?.gold?.london?.price || '-'} 
            change={data?.market?.gold?.london?.changePercent || '0'} 
            icon={<DollarSign className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />}
            color="bg-yellow-500"
          />
          <MarketCard 
            title="Bitcoin" 
            price={`$${parseFloat(data?.market?.crypto?.bitcoin?.price || 0).toLocaleString()}`} 
            change={data?.market?.crypto?.bitcoin?.changePercent || '0'} 
            icon={<Bitcoin className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />}
            color="bg-orange-500"
          />
        </section>

        {/* 3. Visual Analysis Dashboard */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
           {/* Sentiment Gauge */}
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center relative overflow-hidden">
              <h3 className="text-slate-400 text-xs md:text-sm font-semibold mb-4 flex items-center gap-2 w-full">
                <PieChartIcon className="w-4 h-4" /> 市场情绪指数
              </h3>
              <div className="h-32 md:h-40 w-full flex items-center justify-center relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        startAngle={180}
                        endAngle={0}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell key="fear" fill="#334155" />
                        <Cell key="greed" fill={sentimentScore > 50 ? '#ef4444' : '#22c55e'} />
                      </Pie>
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute top-[60%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                    <span className={`text-3xl md:text-4xl font-bold ${sentimentScore > 50 ? 'text-red-400' : 'text-green-400'}`}>
                      {sentimentScore}
                    </span>
                    <p className="text-[10px] md:text-xs text-slate-500 mt-1">
                      {sentimentScore > 80 ? '极度贪婪' : sentimentScore > 50 ? '贪婪' : sentimentScore > 20 ? '恐惧' : '极度恐惧'}
                    </p>
                 </div>
              </div>
           </div>

           {/* Risk Radar */}
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
              <h3 className="text-slate-400 text-xs md:text-sm font-semibold mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> 风险雷达
              </h3>
              <div className="h-40 md:h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={riskData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar
                      name="Risk"
                      dataKey="value"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="#8b5cf6"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Market Comparison Bar */}
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
              <h3 className="text-slate-400 text-xs md:text-sm font-semibold mb-2 flex items-center gap-2">
                <BarChartIcon className="w-4 h-4" /> 24H 涨跌幅对比
              </h3>
              <div className="h-40 md:h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marketChangeData} layout="vertical" margin={{ left: 5, right: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={30} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                      cursor={{ fill: 'transparent' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {marketChangeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#ef4444' : '#22c55e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>
        </section>

        {/* 4. Global Capital Flows Monitoring */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-indigo-400" />
                全球资金流向监控
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Metrics Cards */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <MarketCard 
                        title="美元指数 (DXY)" 
                        price={data?.market?.flows?.dxy?.price || '-'} 
                        change={data?.market?.flows?.dxy?.changePercent || '0'} 
                        icon={<DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-500" />}
                        color="bg-green-500"
                     />
                     <MarketCard 
                        title="USD/CNY" 
                        price={data?.market?.flows?.usdcny?.price || '-'} 
                        change={data?.market?.flows?.usdcny?.changePercent || '0'} 
                        icon={<RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />}
                        color="bg-blue-500"
                     />
                     <MarketCard 
                        title="原油 (WTI)" 
                        price={data?.market?.flows?.oil?.price || '-'} 
                        change={data?.market?.flows?.oil?.changePercent || '0'} 
                        icon={<Target className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />}
                        color="bg-slate-500"
                     />
                     <MarketCard 
                        title="美股道琼斯" 
                        price={data?.market?.stocks?.dji?.price || '-'} 
                        change={data?.market?.stocks?.dji?.changePercent || '0'} 
                        icon={<Activity className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />}
                        color="bg-purple-500"
                     />
                </div>

                {/* Right: AI Analysis */}
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-between">
                     <div>
                         <div className="flex items-center justify-between mb-3">
                             <span className="text-sm font-semibold text-slate-300">AI 资金面研判</span>
                             <span className={`px-2 py-1 rounded text-xs font-bold ${
                                 data?.analysis?.capital_flows?.status?.includes('流出') ? 'bg-green-500/20 text-green-400' : 
                                 data?.analysis?.capital_flows?.status?.includes('流入') ? 'bg-red-500/20 text-red-400' :
                                 'bg-slate-700 text-slate-300'
                             }`}>
                                {data?.analysis?.capital_flows?.status || '分析中...'}
                             </span>
                         </div>
                         
                         <div className="space-y-3 text-xs md:text-sm">
                             <div className="flex gap-2">
                                <span className="text-slate-500 shrink-0 font-mono">DXY :</span>
                                <span className="text-slate-300">{data?.analysis?.capital_flows?.dxy_analysis || '等待数据...'}</span>
                             </div>
                             <div className="flex gap-2">
                                <span className="text-slate-500 shrink-0 font-mono">FX  :</span>
                                <span className="text-slate-300">{data?.analysis?.capital_flows?.usdcny_analysis || '等待数据...'}</span>
                             </div>
                         </div>
                     </div>
                     
                     <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                        <span className="text-xs text-slate-500">整体风险水平</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                                data?.analysis?.capital_flows?.overall_risk === '高' ? 'bg-red-500 animate-pulse' : 
                                data?.analysis?.capital_flows?.overall_risk === '中' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <span className={`font-bold text-sm ${
                                data?.analysis?.capital_flows?.overall_risk === '高' ? 'text-red-500' : 
                                data?.analysis?.capital_flows?.overall_risk === '中' ? 'text-yellow-500' : 'text-green-500'
                            }`}>
                                {data?.analysis?.capital_flows?.overall_risk || '-'}
                            </span>
                        </div>
                     </div>
                </div>
            </div>
        </section>

        {/* Watchlist Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
                <h3 className="text-lg md:text-xl font-semibold text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                    自选跟踪
                    <span className="text-[10px] md:text-xs text-slate-500 font-normal hidden sm:inline">(保存在本地，最多5只)</span>
                </h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                     <div className="relative flex-1 sm:flex-none">
                        <input 
                            type="text" 
                            placeholder="代码 (如 600519)" 
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addToWatchlist()}
                            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs md:text-sm rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-indigo-500 w-full sm:w-40"
                        />
                        <button 
                            onClick={addToWatchlist}
                            className="absolute right-1 top-1 text-indigo-400 hover:text-indigo-300 p-0.5"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                     </div>
                     <button 
                        onClick={analyzeWatchlist}
                        disabled={loadingWatchlist || watchlist.length === 0}
                        className={`flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-600/30 transition-colors shrink-0 ${loadingWatchlist ? 'opacity-50' : ''}`}
                     >
                        <Search className={`w-3.5 h-3.5 md:w-4 md:h-4 ${loadingWatchlist ? 'animate-spin' : ''}`} />
                        <span className="text-xs md:text-sm">智能追踪</span>
                     </button>
                </div>
            </div>

            {/* Watchlist Items */}
            {watchlist.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-xl">
                    暂无自选，请在右上角添加关注的代码（股票/基金）
                </div>
            ) : (
                <div className="space-y-4">
                    {/* List of codes if not analyzed yet */}
                    {!watchlistData && (
                        <div className="flex flex-wrap gap-2">
                            {watchlist.map(code => (
                                <div key={code} className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full text-slate-300 text-sm border border-slate-700">
                                    <span>{code}</span>
                                    <button onClick={() => removeFromWatchlist(code)} className="text-slate-500 hover:text-red-400">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <div className="text-xs text-slate-500 self-center ml-2 animate-pulse">
                                点击“智能追踪”获取 AI 深度分析
                            </div>
                        </div>
                    )}

                    {/* Analyzed Results */}
                    {watchlistData && (
                        <div className="grid grid-cols-1 gap-4">
                            {watchlistData.map((item, idx) => (
                                <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-indigo-500/30 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg font-bold text-white">{item.name}</span>
                                                <span className="text-xs text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded">{item.code}</span>
                                                <button 
                                                    onClick={() => removeFromWatchlist(watchlist.find(c => item.code.includes(c)) || item.code)} 
                                                    className="text-slate-600 hover:text-red-400 ml-2"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm font-mono">
                                                <span className="text-slate-300">¥{item.price}</span>
                                                <span className={parseFloat(item.changePercent) >= 0 ? "text-red-400" : "text-green-400"}>
                                                    {parseFloat(item.changePercent) >= 0 ? '+' : ''}{item.changePercent}%
                                                </span>
                                                {item.pe !== '-' && <span className="text-slate-500">PE: {item.pe}</span>}
                                            </div>
                                        </div>
                                        {item.analysis && (
                                            <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                                item.analysis.suggestion?.includes('买') || item.analysis.suggestion?.includes('加') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                item.analysis.suggestion?.includes('卖') || item.analysis.suggestion?.includes('减') ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                'bg-slate-700 text-slate-300 border-slate-600'
                                            }`}>
                                                {item.analysis.suggestion}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {item.analysis && (
                                        <div className="bg-slate-900/50 rounded-lg p-3 text-sm">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`w-2 h-2 rounded-full ${
                                                    item.analysis.trend === '看多' ? 'bg-red-500' : 
                                                    item.analysis.trend === '看空' ? 'bg-green-500' : 'bg-yellow-500'
                                                }`}></span>
                                                <span className="text-slate-300 font-medium">{item.analysis.trend}</span>
                                            </div>
                                            <p className="text-slate-400 leading-relaxed">
                                                {item.analysis.reason}
                                            </p>
                                        </div>
                                    )}
                                    
                                    {item.error && (
                                        <div className="text-red-400 text-sm">
                                            获取数据失败: {item.error}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>

        {/* 4. A-Share Strategy & Deep Analysis (Full Width) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            
            {/* Left Column: A-Share Strategy Card */}
            <div className="lg:col-span-1 space-y-4 md:space-y-6">
                 {/* Summary Banner */}
                {data?.analysis?.summary && (
                  <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 p-4 md:p-6 rounded-2xl relative overflow-hidden shadow-lg shadow-indigo-900/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Bot className="w-24 h-24 md:w-32 md:h-32" />
                    </div>
                    <h3 className="text-indigo-300 font-semibold mb-2 flex items-center gap-2 text-sm md:text-base">
                      <Sparkles className="w-4 h-4" /> 局势速评
                    </h3>
                    <p className="text-lg md:text-xl font-bold text-white leading-relaxed">
                      “{data.analysis.summary}”
                    </p>
                  </div>
                )}

                {/* Strategy Box */}
                {data?.analysis?.a_share_strategy && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
                        <h3 className="text-base md:text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                            <Target className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                            A股重点方向
                        </h3>
                        
                        <div className="mb-4">
                            <div className="text-xs md:text-sm text-slate-500 mb-1">建议方向</div>
                            <div className={`text-xl md:text-2xl font-bold ${data.analysis.a_share_strategy.direction === '看多' ? 'text-red-400' : data.analysis.a_share_strategy.direction === '看空' ? 'text-green-400' : 'text-yellow-400'}`}>
                                {data.analysis.a_share_strategy.direction || '震荡观察'}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="text-[10px] md:text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                                    <Radio className="w-3 h-3" /> 重点关注
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {data.analysis.a_share_strategy.focus_sectors?.map((sector, i) => (
                                        <span key={i} className="px-2 py-1 md:px-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs md:text-sm font-medium">
                                            {sector}
                                        </span>
                                    ))}
                                    {!data.analysis.a_share_strategy.focus_sectors?.length && <span className="text-slate-600 text-xs md:text-sm">暂无明确主线</span>}
                                </div>
                            </div>
                            
                            <div>
                                <div className="text-[10px] md:text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3" /> 建议回避
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {data.analysis.a_share_strategy.avoid_sectors?.map((sector, i) => (
                                        <span key={i} className="px-2 py-1 md:px-3 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs md:text-sm font-medium">
                                            {sector}
                                        </span>
                                    ))}
                                    {!data.analysis.a_share_strategy.avoid_sectors?.length && <span className="text-slate-600 text-xs md:text-sm">暂无高危板块</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Portfolio Suggestion Box */}
                {data?.analysis?.portfolio_suggestion && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                        智能仓位建议
                    </h3>
                    <div className="text-xs md:text-sm text-slate-400 mb-4 italic border-l-2 border-indigo-500 pl-3">
                       "{data.analysis.portfolio_suggestion.logic}"
                    </div>
                    <div className="h-48 md:h-64 w-full relative">
                       <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                             <Pie
                                data={data.analysis.portfolio_suggestion.allocation}
                                dataKey="percentage"
                                nameKey="asset"
                                cx="50%"
                                cy="50%"
                                outerRadius={60}
                                innerRadius={30}
                                paddingAngle={2}
                                label={({ asset, percentage }) => `${asset} ${percentage}%`}
                                labelLine={false}
                             >
                                {data.analysis.portfolio_suggestion.allocation.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={['#ef4444', '#3b82f6', '#eab308', '#f97316', '#64748b'][index % 5]} />
                                ))}
                             </Pie>
                             <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                itemStyle={{ color: '#e2e8f0' }}
                             />
                          </PieChart>
                       </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-3">
                       {data.analysis.portfolio_suggestion.allocation.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs md:text-sm">
                             <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0`} style={{ backgroundColor: ['#ef4444', '#3b82f6', '#eab308', '#f97316', '#64748b'][i % 5] }}></div>
                             <div>
                                <span className="text-slate-300 font-medium">{item.asset}</span>
                                <span className="text-slate-500 mx-1">-</span>
                                <span className="text-slate-400">{item.reason}</span>
                             </div>
                          </div>
                       ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Right Column: Deep Report */}
            <div className="lg:col-span-2">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-8 h-full">
                  <h3 className="text-base md:text-lg font-semibold text-slate-300 mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                    <Newspaper className="w-4 h-4 md:w-5 md:h-5" />
                    深度研判报告
                  </h3>
                  <div className="prose prose-invert prose-slate max-w-none">
                    <ReactMarkdown 
                        components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-6 pb-2 border-b border-slate-800" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl md:text-2xl font-bold text-slate-100 mt-8 mb-4 flex items-center gap-2 before:content-[''] before:w-1.5 before:h-6 md:before:h-8 before:bg-indigo-500 before:rounded-full before:mr-2" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg md:text-xl font-semibold text-indigo-300 mt-6 mb-3" {...props} />,
                            p: ({node, ...props}) => <p className="text-slate-300 leading-relaxed mb-4 text-base md:text-lg" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-none space-y-2 mb-4" {...props} />,
                            li: ({node, ...props}) => (
                                <li className="flex items-start gap-2 text-slate-300 text-sm md:text-base">
                                    <span className="mt-1.5 md:mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                    <span>{props.children}</span>
                                </li>
                            ),
                            strong: ({node, ...props}) => <strong className="text-white font-bold bg-indigo-500/10 px-1 rounded" {...props} />,
                            blockquote: ({node, ...props}) => (
                                <blockquote className="border-l-4 border-indigo-500 bg-slate-800/50 p-4 rounded-r-lg my-6 text-slate-400 italic text-sm md:text-base">
                                    {props.children}
                                </blockquote>
                            ),
                            a: ({node, ...props}) => <a className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30 transition-colors" {...props} />,
                            hr: ({node, ...props}) => <hr className="border-slate-800 my-8" {...props} />,
                            table: ({node, ...props}) => <div className="overflow-x-auto my-6 rounded-lg border border-slate-700"><table className="min-w-full divide-y divide-slate-700 bg-slate-900/50" {...props} /></div>,
                            thead: ({node, ...props}) => <thead className="bg-slate-800" {...props} />,
                            th: ({node, ...props}) => <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-indigo-300 uppercase tracking-wider" {...props} />,
                            td: ({node, ...props}) => <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-slate-300 border-t border-slate-700" {...props} />,
                            img: ({node, ...props}) => <img className="rounded-xl shadow-2xl border border-slate-700 my-6 w-full" {...props} alt={props.alt || "Report Image"} />,
                            code: ({node, inline, ...props}) => (
                                inline 
                                    ? <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-xs md:text-sm font-mono" {...props} />
                                    : <div className="bg-slate-950 p-4 rounded-lg my-4 overflow-x-auto border border-slate-800"><code className="text-slate-300 font-mono text-xs md:text-sm" {...props} /></div>
                            )
                        }}
                    >
                        {data?.analysis?.detail || '*AI 正在思考中...*'}
                    </ReactMarkdown>
                  </div>
                </div>
            </div>

        </section>

      </main>
    </div>
  );
};

export default IntelligenceStation;
