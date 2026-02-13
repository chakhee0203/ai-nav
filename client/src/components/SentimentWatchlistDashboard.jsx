import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Activity } from 'lucide-react';
import axios from 'axios';

const SentimentWatchlistDashboard = () => {
  const MAX_DISPLAY = 10;
  const [portfolio, setPortfolio] = useState([]);
  const [newCode, setNewCode] = useState('');
  const [newQuote, setNewQuote] = useState(null);
  const [newQuoteLoading, setNewQuoteLoading] = useState(false);
  const [newQuoteError, setNewQuoteError] = useState(null);
  const [analysisByCode, setAnalysisByCode] = useState({});
  const [analysisLoading, setAnalysisLoading] = useState({});
  const [analysisError, setAnalysisError] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCode, setDrawerCode] = useState(null);
  const [error, setError] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [discoverResults, setDiscoverResults] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [view, setView] = useState('portfolio');

  useEffect(() => {
    const savedPortfolio = localStorage.getItem('portfolio');
    if (savedPortfolio) {
      const parsed = JSON.parse(savedPortfolio);
      if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'string') {
        const eq = 100 / Math.min(parsed.length, MAX_DISPLAY);
        setPortfolio(parsed.map(code => ({ code, entryPrice: null, entryDate: null, currency: '', weight: eq })));
      } else {
        const arr = (parsed || []).map(it => ({ ...it, weight: Number(it.weight) || 0 }));
        const missing = arr.every(it => !it.weight);
        if (missing && arr.length) {
          const eq = 100 / Math.min(arr.length, MAX_DISPLAY);
          arr.forEach(it => { it.weight = eq; });
        }
        setPortfolio(arr);
      }
    }
  }, []);

  const refreshQuotes = () => {
    if (!portfolio.length) {
      setQuotes({});
      return;
    }
    Promise.all(portfolio.map(it => axios.get(`/api/quote?code=${encodeURIComponent(it.code)}`)))
      .then(responses => {
        const byCode = {};
        responses.forEach((r, idx) => {
          const q = r?.data;
          const code = portfolio[idx]?.code;
          if (code) byCode[code] = q || null;
        });
        setQuotes(byCode);
      })
      .catch(() => {});
  };

  const savePortfolio = (newPortfolio) => {
    setPortfolio(newPortfolio);
    localStorage.setItem('portfolio', JSON.stringify(newPortfolio));
  };

  const totalWeight = () => {
    return portfolio.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
  };

  const setWeight = (code, weightPercent) => {
    const w = Math.max(0, Math.min(100, Number(weightPercent) || 0));
    const next = portfolio.map(it => it.code === code ? { ...it, weight: w } : it);
    savePortfolio(next);
  };
  const setEntryPrice = (code, price) => {
    const next = portfolio.map(it => {
      if (it.code !== code) return it;
      if (price === '') return { ...it, entryPrice: null };
      const v = Number(price);
      return Number.isFinite(v) && v >= 0 ? { ...it, entryPrice: v } : it;
    });
    savePortfolio(next);
  };

  const normalizedWeights = (codes) => {
    const items = portfolio.filter(it => codes.includes(it.code));
    const sum = items.reduce((s, it) => s + (Number(it.weight) || 0), 0);
    if (sum > 0) {
      const map = {};
      items.forEach(it => { map[it.code] = (Number(it.weight) || 0) / sum; });
      return map;
    }
    const eq = 1 / (items.length || 1);
    const map = {};
    items.forEach(it => { map[it.code] = eq; });
    return map;
  };

  const addCode = () => {
    const code = newCode.trim().toUpperCase();
    if (!code) return;
    if (portfolio.some(it => it.code === code)) return;
    if (portfolio.length >= MAX_DISPLAY) {
      setError('最多只能添加10只标的');
      return;
    }
    axios.get(`/api/quote?code=${encodeURIComponent(code)}`)
      .then(({ data }) => {
        const item = {
          code,
          entryPrice: data?.price ?? null,
          entryDate: new Date().toISOString(),
          currency: data?.currency ?? '',
          weight: 0,
        };
        const updated = [...portfolio, item];
        const eq = 100 / Math.min(updated.length, MAX_DISPLAY);
        const normalized = updated.map(it => ({ ...it, weight: eq }));
        savePortfolio(normalized);
        setNewCode('');
        setQuotes(prev => ({ ...prev, [code]: data }));
      })
      .catch(() => {
        const item = { code, entryPrice: null, entryDate: new Date().toISOString(), currency: '', weight: 0 };
        const updated = [...portfolio, item];
        const eq = 100 / Math.min(updated.length, MAX_DISPLAY);
        const normalized = updated.map(it => ({ ...it, weight: eq }));
        savePortfolio(normalized);
        setNewCode('');
      });
  };

  const removeCode = (code) => {
    const updatedPortfolio = portfolio.filter(c => c.code !== code);
    savePortfolio(updatedPortfolio);
    setQuotes(prev => {
      const n = { ...prev };
      delete n[code];
      return n;
    });
  };

  const analyzeOne = async (code) => {
    setAnalysisLoading(prev => ({ ...prev, [code]: true }));
    setAnalysisError(prev => ({ ...prev, [code]: null }));
    try {
      const { data } = await axios.post('/api/analyze', { codes: [code] });
      const item = data?.results?.[0] || null;
      if (!item) {
        setAnalysisError(prev => ({ ...prev, [code]: '暂无分析结果' }));
      } else {
        setAnalysisByCode(prev => ({ ...prev, [code]: item }));
      }
    } catch (err) {
      const msg = err?.response?.data?.error || '分析失败，请稍后重试';
      setAnalysisError(prev => ({ ...prev, [code]: msg }));
    } finally {
      setAnalysisLoading(prev => ({ ...prev, [code]: false }));
    }
  };
  const openDrawer = (code) => {
    setDrawerCode(code);
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
  };
  const handleAnalyze = (code) => {
    openDrawer(code);
    if (!analysisByCode[code]) analyzeOne(code);
  };

  useEffect(() => {
    const needInit = portfolio.filter(it => !it.entryPrice);
    if (needInit.length) {
      Promise.all(needInit.map(it => axios.get(`/api/quote?code=${encodeURIComponent(it.code)}`)))
        .then(responses => {
          const byCode = {};
          let idxResp = 0;
          let changed = false;
          const filled = portfolio.map(it => {
            if (!it.entryPrice) {
              const resp = responses[idxResp++];
              const q = resp?.data || null;
              if (q) {
                byCode[it.code] = q;
                changed = true;
                return { ...it, entryPrice: q.price ?? null, entryDate: it.entryDate || new Date().toISOString(), currency: q.currency ?? it.currency };
              }
            }
            return it;
          });
          if (changed) {
            savePortfolio(filled);
            setQuotes(prev => ({ ...prev, ...byCode }));
          }
        })
        .catch(() => {});
    } else {
      setQuotes({});
    }
  }, [portfolio]);
  useEffect(() => {
    const c = newCode.trim().toUpperCase();
    if (!c) {
      setNewQuote(null);
      setNewQuoteError(null);
      setNewQuoteLoading(false);
      return;
    }
    setNewQuoteLoading(true);
    setNewQuoteError(null);
    const controller = new AbortController();
    const t = setTimeout(() => {
      axios.get(`/api/quote?code=${encodeURIComponent(c)}`, { signal: controller.signal })
        .then(({ data }) => {
          setNewQuote(data || null);
        })
        .catch((err) => {
          if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
            // ignore canceled
            return;
          }
          setNewQuote(null);
          setNewQuoteError('无法获取当前价格');
        })
        .finally(() => setNewQuoteLoading(false));
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [newCode]);

  const sinceEntryPct = (code) => {
    const item = portfolio.find(it => it.code === code);
    const q = quotes[code];
    if (!item?.entryPrice || !q?.price) return null;
    return ((q.price / item.entryPrice) - 1) * 100;
  };

  const portfolioSinceEntry = () => {
    const codes = portfolio.map(it => it.code);
    const wMap = normalizedWeights(codes);
    const vals = portfolio.map(it => {
      const q = quotes[it.code];
      if (!it.entryPrice || !q?.price) return null;
      return ((q.price / it.entryPrice) - 1) * (wMap[it.code] || 0);
    }).filter(v => v !== null);
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return sum * 100;
  };

  const portfolioDailyEstimate = () => {
    const codes = portfolio.map(it => it.code);
    const wMap = normalizedWeights(codes);
    const vals = portfolio.map(it => {
      const q = quotes[it.code];
      const cp = Number(q?.changePct);
      return Number.isFinite(cp) ? cp * (wMap[it.code] || 0) : null;
    }).filter(v => v !== null);
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return sum;
  };
  const dailyChangePct = (code) => {
    const q = quotes[code];
    const cp = Number(q?.changePct);
    return Number.isFinite(cp) ? cp : null;
  };

  const discoverNews = async () => {
    if (portfolio.length === 0) return;
    setView('discover');
    setDiscoverLoading(true);
    setDiscoverResults([]);
    const codes = portfolio.slice(0, MAX_DISPLAY).map(p => p.code);
    for (const code of codes) {
      try {
        const { data } = await axios.get('/api/news/related', { params: { code } });
        setDiscoverResults(prev => [...prev, { code, items: data?.results || [] }]);
      } catch {
        setDiscoverResults(prev => [...prev, { code, items: [] }]);
      }
    }
    setDiscoverLoading(false);
  };

  const backToPortfolio = () => {
    setView('portfolio');
    setDiscoverLoading(false);
    setDiscoverResults([]);
  };
  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-10">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity size={24} />
          投资组合管理
        </h1>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {view === 'discover' ? (
          <>
            <div className="bg-white rounded-lg shadow-sm p-4 mb-3 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">发现 · 持仓相关新闻</h2>
              <button className="text-blue-600 text-sm" onClick={backToPortfolio}>返回</button>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              {discoverLoading ? (
                <div className="text-sm text-gray-600">正在按持仓逐个获取最新新闻…</div>
              ) : (
                <div className="space-y-4">
                  {discoverResults.map((grp, idx) => (
                    <div key={idx} className="border-b pb-3 last:border-0">
                      <div className="text-sm font-semibold text-gray-900 mb-2">{grp.code}</div>
                      <ul className="space-y-2">
                        {grp.items.map((rn, i) => (
                          <li key={i} className="text-sm">
                            <a href={rn.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                              {rn.title}
                            </a>
                            <div className="text-xs text-gray-500 mt-0.5">
                              来源：{rn.source} {rn.query ? `（关键词：${rn.query}）` : ''}
                            </div>
                          </li>
                        ))}
                        {!grp.items.length && <li className="text-sm text-gray-500">暂无结果</li>}
                      </ul>
                    </div>
                  ))}
                  {!discoverResults.length && <div className="text-sm text-gray-600">暂无数据</div>}
                </div>
              )}
            </div>
          </>
        ) : null}
        {view !== 'discover' && (<>
        {/* 添加股票/基金 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-800">管理持仓</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="输入股票/基金代码（如：AAPL）"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && addCode()}
            />
            <button
              onClick={addCode}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={24} />
            </button>
            <button
              onClick={refreshQuotes}
              className="bg-gray-100 text-gray-800 p-2 rounded-lg hover:bg-gray-200 border border-gray-300"
              title="刷新行情"
            >
              刷新
            </button>
          </div>
        </div>
        {newCode ? (
          <div className="px-4 -mt-2 mb-4 text-xs text-gray-600">
            {newQuoteLoading ? '正在获取当前价格...' : newQuote ? (
              <span>
                当前价：<span className="font-mono font-semibold">{newQuote.price}</span> {newQuote.currency}，
                当日：<span className={`${Number(newQuote.changePct) >= 0 ? 'text-red-600' : 'text-green-600'} font-semibold`}>
                  {Math.abs(Number(newQuote.changePct || 0)).toFixed(2)}%
                </span>
              </span>
            ) : newQuoteError ? newQuoteError : '请输入代码以获取当前价'}
          </div>
        ) : null}

        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-800">组合概览</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">累计收益</span>
            <span className={`font-semibold ${Number(portfolioSinceEntry()) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {portfolioSinceEntry() === null ? '—' : `${portfolioSinceEntry().toFixed(2)}%`}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">当日收益率（估）</span>
            <span className={`font-semibold ${Number(portfolioDailyEstimate()) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {portfolioDailyEstimate() === null ? '—' : `${portfolioDailyEstimate().toFixed(2)}%`}
            </span>
          </div>
        </div>
        {/* 持仓列表 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-800 flex justify-between items-center">
            持仓关注
            <span className="text-sm font-normal text-gray-500">最多显示 {MAX_DISPLAY} 项</span>
          </h2>
          {portfolio.length === 0 ? (
            <p className="text-gray-500 text-center py-4">当前暂无持仓，请添加代码。</p>
          ) : (
            <ul className="space-y-2">
              {portfolio.slice(0, MAX_DISPLAY).map((item) => (
                <li key={item.code} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex flex-col w-full">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-800">{item.code}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">占比%</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={Number(item.weight ?? 0)}
                          onChange={(e) => setWeight(item.code, e.target.value)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span>成本价</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.entryPrice ?? ''}
                        onChange={(e) => setEntryPrice(item.code, e.target.value)}
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                      <span className="text-gray-400">{item.currency}</span>
                    </div>
                    <span className="text-xs mt-1">
                      {Number.isFinite(sinceEntryPct(item.code)) ? (
                        <span className={`mr-3 font-semibold ${sinceEntryPct(item.code) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          累计收益：{sinceEntryPct(item.code).toFixed(2)}%
                        </span>
                      ) : null}
                      {Number.isFinite(dailyChangePct(item.code)) ? (
                        <span className={`font-semibold ${dailyChangePct(item.code) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          当日：{dailyChangePct(item.code).toFixed(2)}%
                        </span>
                      ) : null}
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => handleAnalyze(item.code)}
                        disabled={analysisLoading[item.code]}
                        className={`text-xs px-2 py-1 rounded border ${
                          analysisLoading[item.code] ? 'bg-gray-200 text-gray-500 border-gray-200' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {analysisLoading[item.code] ? '分析中...' : (analysisByCode[item.code] ? '查看分析' : '立即分析')}
                      </button>
                      {analysisError[item.code] ? (
                        <span className="text-xs text-red-600">{analysisError[item.code]}</span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    onClick={() => removeCode(item.code)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 text-xs">
            <span className="text-gray-600">占比合计：</span>
            <span className={`font-semibold ${Math.round(totalWeight()) === 100 ? 'text-red-600' : 'text-yellow-600'}`}>
              {totalWeight().toFixed(1)}%
            </span>
            {Math.round(totalWeight()) !== 100 ? <span className="ml-2 text-gray-500">建议合计为 100%</span> : null}
          </div>
        </div>
        {/* 错误信息 */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        </>)}
      </main>

      {drawerOpen ? (
        <div className="fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer}></div>
          <div
            className="absolute right-0 top-0 h-full w-full sm:w-[440px] bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="font-semibold text-gray-800">
                分析详情 {drawerCode ? `· ${drawerCode}` : ''}
              </div>
              <div className="flex items-center gap-2">
                {drawerCode ? (
                  <button
                    onClick={() => analyzeOne(drawerCode)}
                    disabled={analysisLoading[drawerCode]}
                    className={`text-xs px-2 py-1 rounded border ${
                      analysisLoading[drawerCode] ? 'bg-gray-200 text-gray-500 border-gray-200' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {analysisLoading[drawerCode] ? '分析中...' : '重新分析'}
                  </button>
                ) : null}
                <button
                  onClick={closeDrawer}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1 text-sm text-gray-700">
              {drawerCode && analysisLoading[drawerCode] ? (
                <div className="text-gray-600">正在获取最新分析…</div>
              ) : drawerCode && analysisError[drawerCode] ? (
                <div className="text-red-600">{analysisError[drawerCode]}</div>
              ) : drawerCode && analysisByCode[drawerCode] ? (
                <>
                  <div className="font-semibold text-gray-800">分析摘要</div>
                  <div className="mt-2 whitespace-pre-wrap leading-relaxed">
                    {analysisByCode[drawerCode]?.analysis || '暂无内容'}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-gray-500">最新财报</div>
                      <div className="mt-1">
                        营收 {analysisByCode[drawerCode]?.financials?.revenue ?? '未知'}<br />
                        净利 {analysisByCode[drawerCode]?.financials?.netIncome ?? '未知'}<br />
                        币种 {analysisByCode[drawerCode]?.financials?.currency ?? '未知'}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-gray-500">走势</div>
                      <div className="mt-1">
                        现价 {analysisByCode[drawerCode]?.quote?.price ?? '未知'} {analysisByCode[drawerCode]?.quote?.currency ?? ''}<br />
                        20日收益 {analysisByCode[drawerCode]?.trend?.ret20 != null ? `${(analysisByCode[drawerCode].trend.ret20 * 100).toFixed(2)}%` : '未知'}
                      </div>
                    </div>
                  </div>
                  {analysisByCode[drawerCode]?.newsByTopic?.policy?.length ? (
                    <div className="mt-3">
                      <div className="text-gray-500 font-semibold">政策新闻</div>
                      <ul className="mt-1 space-y-1">
                        {analysisByCode[drawerCode].newsByTopic.policy.slice(0, 5).map((n, idx) => (
                          <li key={`policy-${idx}`} className="leading-snug">
                            <a href={n.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                              {n.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {analysisByCode[drawerCode]?.newsByTopic?.industry?.length ? (
                    <div className="mt-3">
                      <div className="text-gray-500 font-semibold">行业新闻</div>
                      <ul className="mt-1 space-y-1">
                        {analysisByCode[drawerCode].newsByTopic.industry.slice(0, 5).map((n, idx) => (
                          <li key={`industry-${idx}`} className="leading-snug">
                            <a href={n.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                              {n.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {analysisByCode[drawerCode]?.newsByTopic?.finance?.length ? (
                    <div className="mt-3">
                      <div className="text-gray-500 font-semibold">财报新闻</div>
                      <ul className="mt-1 space-y-1">
                        {analysisByCode[drawerCode].newsByTopic.finance.slice(0, 5).map((n, idx) => (
                          <li key={`finance-${idx}`} className="leading-snug">
                            <a href={n.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                              {n.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {analysisByCode[drawerCode]?.news?.length ? (
                    <div className="mt-3">
                      <div className="text-gray-500 font-semibold">公司相关新闻</div>
                      <ul className="mt-1 space-y-1">
                        {analysisByCode[drawerCode].news.slice(0, 5).map((n, idx) => (
                          <li key={`company-${idx}`} className="leading-snug">
                            <a href={n.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                              {n.title}
                            </a>
                            {n.topic ? <span className="ml-1 text-gray-400">（{n.topic}）</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-gray-600">暂无分析数据</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* 底部导航（示例） */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 text-xs text-gray-500">
        <div className="flex flex-col items-center text-blue-600">
          <Activity size={20} />
          <span className="mt-1">持仓</span>
        </div>
        <div className="flex flex-col items-center cursor-pointer" onClick={discoverNews}>
          <Search size={20} />
          <span className="mt-1">发现</span>
        </div>
        {/* 去掉市场模块 */}
      </nav>
      
    </div>
  );
};

export default SentimentWatchlistDashboard;
