import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DashboardHeader from './DashboardHeader';
import DiscoverPanel from './DiscoverPanel';
import PortfolioPanel from './PortfolioPanel';
import AnalysisDrawer from './AnalysisDrawer';
import BottomNav from './BottomNav';

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
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  const [closeLoading, setCloseLoading] = useState({});
  const [returnDetailsOpen, setReturnDetailsOpen] = useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCode, setEditCode] = useState(null);
  const [editWeight, setEditWeight] = useState('');
  const [editEntryPrice, setEditEntryPrice] = useState('');
  const [discoverActiveTab, setDiscoverActiveTab] = useState('policy');
  const [discoverLoadingTab, setDiscoverLoadingTab] = useState(null);
  const [discoverErrorByTab, setDiscoverErrorByTab] = useState({ policy: null, event: null, hot: null });
  const [discoverCache, setDiscoverCache] = useState({
    policy: { categories: [], updatedAt: null },
    event: { items: [], updatedAt: null },
    hot: { items: [], updatedAt: null },
  });
  const [view, setView] = useState('portfolio');
  const DISCOVER_TABS = [
    { key: 'policy', title: '最新政策' },
    { key: 'event', title: '大事件' },
    { key: 'hot', title: '热点' },
  ];

  const parseWeightValue = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const v = Number(value);
    return Number.isFinite(v) ? v : null;
  };

  useEffect(() => {
    const savedPortfolio = localStorage.getItem('portfolio');
    if (savedPortfolio) {
      const parsed = JSON.parse(savedPortfolio);
      if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'string') {
        setPortfolio(parsed.map(code => ({ code, entryPrice: null, entryDate: null, currency: '', weight: null })));
      } else {
        const arr = (parsed || []).map(it => ({ ...it, weight: parseWeightValue(it.weight) }));
        setPortfolio(arr);
      }
    }
    const savedHistory = localStorage.getItem('portfolioHistory');
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      if (Array.isArray(parsed)) setPortfolioHistory(parsed);
    }
  }, []);

  const [refreshLoading, setRefreshLoading] = useState(false);
  const refreshQuotes = () => {
    if (!portfolio.length) {
      setQuotes({});
      setError(null);
      return;
    }
    setRefreshLoading(true);
    setError(null);
    Promise.all(portfolio.map(it => axios.get(`/api/quote?code=${encodeURIComponent(it.code)}`)))
      .then(responses => {
        const byCode = {};
        responses.forEach((r, idx) => {
          const q = r?.data;
          const code = portfolio[idx]?.code;
          if (code) byCode[code] = q || null;
        });
        setQuotes(byCode);
        const hasAny = Object.values(byCode).some(Boolean);
        if (!hasAny) setError('行情更新失败，请稍后重试');
      })
      .catch(() => {
        setError('行情更新失败，请稍后重试');
      })
      .finally(() => {
        setRefreshLoading(false);
      });
  };

  const savePortfolio = (newPortfolio) => {
    setPortfolio(newPortfolio);
    localStorage.setItem('portfolio', JSON.stringify(newPortfolio));
  };
  const saveHistory = (records) => {
    setPortfolioHistory(records);
    localStorage.setItem('portfolioHistory', JSON.stringify(records));
  };

  const totalWeight = () => {
    return portfolio.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
  };

  const setWeight = (code, weightPercent) => {
    if (weightPercent === '') {
      const next = portfolio.map(it => it.code === code ? { ...it, weight: null } : it);
      savePortfolio(next);
      return;
    }
    const v = Number(weightPercent);
    if (!Number.isFinite(v)) return;
    const w = Math.max(0, v);
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
    setError(null);
    axios.get(`/api/quote?code=${encodeURIComponent(code)}`)
      .then(({ data }) => {
        if (!data) {
          setError('无法获取行情，已添加持仓');
        }
        const item = {
          code,
          entryPrice: data?.price ?? null,
          entryDate: new Date().toISOString(),
          currency: data?.currency ?? '',
          weight: null,
        };
        const updated = [...portfolio, item];
        savePortfolio(updated);
        setNewCode('');
        setQuotes(prev => ({ ...prev, [code]: data }));
      })
      .catch(() => {
        setError('无法获取行情，已添加持仓');
        const item = { code, entryPrice: null, entryDate: new Date().toISOString(), currency: '', weight: null };
        const updated = [...portfolio, item];
        savePortfolio(updated);
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
  const closePosition = async (code) => {
    const item = portfolio.find(it => it.code === code);
    if (!item || closeLoading[code]) return;
    setCloseLoading(prev => ({ ...prev, [code]: true }));
    let exitPrice = quotes[code]?.price ?? null;
    let currency = item.currency || '';
    if (exitPrice === null || exitPrice === undefined) {
      try {
        const { data } = await axios.get(`/api/quote?code=${encodeURIComponent(code)}`);
        if (data) {
          exitPrice = data.price ?? exitPrice;
          currency = data.currency ?? currency;
          setQuotes(prev => ({ ...prev, [code]: data }));
        }
      } catch {
      }
    }
    const returnPct = item.entryPrice && exitPrice ? ((exitPrice / item.entryPrice) - 1) * 100 : null;
    const wMap = normalizedWeights(portfolio.map(it => it.code));
    const weightShare = wMap[code] || 0;
    const contributionPct = Number.isFinite(returnPct) ? returnPct * weightShare : 0;
    const record = {
      code,
      entryPrice: item.entryPrice ?? null,
      exitPrice: exitPrice ?? null,
      entryDate: item.entryDate ?? null,
      exitDate: new Date().toISOString(),
      currency,
      weightShare,
      returnPct,
      contributionPct,
    };
    saveHistory([record, ...portfolioHistory]);
    removeCode(code);
    setCloseLoading(prev => ({ ...prev, [code]: false }));
  };
  const clearHistory = () => {
    saveHistory([]);
    setClearHistoryOpen(false);
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

  const openEdit = (code) => {
    const item = portfolio.find(it => it.code === code);
    if (!item) return;
    setEditCode(code);
    setEditWeight(item.weight ?? '');
    setEditEntryPrice(item.entryPrice ?? '');
    setEditOpen(true);
  };
  const closeEdit = () => {
    setEditOpen(false);
    setEditCode(null);
    setEditWeight('');
    setEditEntryPrice('');
  };
  const saveEdit = () => {
    if (!editCode) return;
    const next = portfolio.map(it => {
      if (it.code !== editCode) return it;
      let weight = it.weight;
      if (editWeight === '') {
        weight = null;
      } else {
        const v = Number(editWeight);
        if (Number.isFinite(v)) weight = Math.max(0, v);
      }
      let entryPrice = it.entryPrice;
      if (editEntryPrice === '') {
        entryPrice = null;
      } else {
        const v = Number(editEntryPrice);
        if (Number.isFinite(v) && v >= 0) entryPrice = v;
      }
      return { ...it, weight, entryPrice };
    });
    savePortfolio(next);
    closeEdit();
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
          if (!data) {
            setNewQuote(null);
            setNewQuoteError('无法获取当前价格');
            return;
          }
          setNewQuote(data);
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
    const sum = vals.reduce((a, b) => a + b, 0);
    const realized = portfolioHistory.reduce((s, r) => s + (Number(r.contributionPct) || 0), 0);
    if (!vals.length && !realized) return null;
    return (sum * 100) + realized;
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

  const fetchDiscoverSection = async (sectionKey) => {
    setDiscoverLoadingTab(sectionKey);
    setDiscoverErrorByTab(prev => ({ ...prev, [sectionKey]: null }));
    try {
      if (sectionKey === 'policy') {
        const { data } = await axios.get('/api/news/policy-impact');
        setDiscoverCache(prev => ({
          ...prev,
          policy: {
            ...prev.policy,
            categories: data?.categories || [],
            updatedAt: data?.updatedAt || new Date().toISOString(),
          },
        }));
      } else {
        const { data } = await axios.get('/api/news/discover', { params: { section: sectionKey } });
        const section = data?.section || null;
        setDiscoverCache(prev => ({
          ...prev,
          [sectionKey]: {
            ...prev[sectionKey],
            items: section?.items || [],
            updatedAt: data?.updatedAt || new Date().toISOString(),
          },
        }));
      }
    } catch {
      setDiscoverErrorByTab(prev => ({ ...prev, [sectionKey]: '获取发现内容失败，请稍后重试' }));
    } finally {
      setDiscoverLoadingTab(null);
    }
  };
  const discoverNews = async () => {
    setView('discover');
  };

  const backToPortfolio = () => {
    setView('portfolio');
  };
  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      <DashboardHeader />

      <main className="p-4 max-w-6xl mx-auto">
        {view === 'discover' ? (
          <DiscoverPanel
            discoverLoading={discoverLoadingTab === discoverActiveTab}
            discoverItems={discoverCache[discoverActiveTab]?.items || []}
            discoverPolicyCategories={discoverCache[discoverActiveTab]?.categories || []}
            discoverError={discoverErrorByTab[discoverActiveTab]}
            discoverUpdatedAt={discoverCache[discoverActiveTab]?.updatedAt || null}
            tabs={DISCOVER_TABS}
            activeTab={discoverActiveTab}
            onTabChange={setDiscoverActiveTab}
            onFetch={() => fetchDiscoverSection(discoverActiveTab)}
          />
        ) : null}
        {view !== 'discover' && (
          <PortfolioPanel
            portfolio={portfolio}
            maxDisplay={MAX_DISPLAY}
            refreshQuotes={refreshQuotes}
            refreshLoading={refreshLoading}
            onUnlockEdit={openEdit}
            onClosePosition={closePosition}
            closeLoading={closeLoading}
            onShowReturnDetails={() => setReturnDetailsOpen(true)}
            sinceEntryPct={sinceEntryPct}
            dailyChangePct={dailyChangePct}
            handleAnalyze={handleAnalyze}
            analysisLoading={analysisLoading}
            analysisByCode={analysisByCode}
            analysisError={analysisError}
            removeCode={removeCode}
            totalWeight={totalWeight}
            newCode={newCode}
            setNewCode={setNewCode}
            addCode={addCode}
            newQuoteLoading={newQuoteLoading}
            newQuote={newQuote}
            newQuoteError={newQuoteError}
            portfolioSinceEntry={portfolioSinceEntry}
            portfolioDailyEstimate={portfolioDailyEstimate}
            error={error}
          />
        )}
      </main>

      <AnalysisDrawer
        drawerOpen={drawerOpen}
        closeDrawer={closeDrawer}
        drawerCode={drawerCode}
        analyzeOne={analyzeOne}
        analysisLoading={analysisLoading}
        analysisError={analysisError}
        analysisByCode={analysisByCode}
      />

      {editOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeEdit} />
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-4">
            <div className="text-sm font-semibold text-slate-900">编辑占比与成本价</div>
            <div className="text-xs text-slate-500 mt-1">{editCode}</div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">占比</div>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">成本价</div>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editEntryPrice}
                  onChange={(e) => setEditEntryPrice(e.target.value)}
                  className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={closeEdit}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                className="text-xs px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {returnDetailsOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReturnDetailsOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-lg mx-4 p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">收益明细</div>
                <div className="text-xs text-slate-500 mt-1">包含当前持仓与历史清仓</div>
              </div>
              <button
                onClick={() => setClearHistoryOpen(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                一键清空
              </button>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-700">当前持仓</div>
              <div className="mt-2 space-y-2">
                {portfolio.map((it) => {
                  const q = quotes[it.code];
                  const wMap = normalizedWeights(portfolio.map(p => p.code));
                  const weightShare = wMap[it.code] || 0;
                  const returnPct = it.entryPrice && q?.price ? ((q.price / it.entryPrice) - 1) * 100 : null;
                  const contributionPct = Number.isFinite(returnPct) ? returnPct * weightShare : null;
                  return (
                    <div key={it.code} className="text-xs flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-slate-900 font-semibold">{it.code}</div>
                        <div className="text-slate-500">
                          成本 {it.entryPrice ?? '—'} / 现价 {q?.price ?? '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`${Number(returnPct) >= 0 ? 'text-red-600' : 'text-green-600'} font-semibold`}>
                          {returnPct === null ? '—' : `${returnPct.toFixed(2)}%`}
                        </div>
                        <div className="text-slate-500">
                          贡献 {contributionPct === null ? '—' : `${contributionPct.toFixed(2)}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!portfolio.length ? <div className="text-xs text-slate-500">暂无持仓</div> : null}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs font-semibold text-slate-700">历史清仓</div>
              <div className="mt-2 space-y-2">
                {portfolioHistory.map((it, idx) => (
                  <div key={`${it.code}-${it.exitDate}-${idx}`} className="text-xs flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                    <div>
                      <div className="text-slate-900 font-semibold">{it.code}</div>
                      <div className="text-slate-500">
                        成本 {it.entryPrice ?? '—'} / 清仓 {it.exitPrice ?? '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`${Number(it.returnPct) >= 0 ? 'text-red-600' : 'text-green-600'} font-semibold`}>
                        {it.returnPct === null ? '—' : `${Number(it.returnPct).toFixed(2)}%`}
                      </div>
                      <div className="text-slate-500">
                        贡献 {it.contributionPct === null ? '—' : `${Number(it.contributionPct).toFixed(2)}%`}
                      </div>
                    </div>
                  </div>
                ))}
                {!portfolioHistory.length ? <div className="text-xs text-slate-500">暂无历史</div> : null}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setReturnDetailsOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {clearHistoryOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setClearHistoryOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-4">
            <div className="text-sm font-semibold text-slate-900">清空历史收益</div>
            <div className="text-xs text-slate-500 mt-2">仅清空历史清仓记录，不影响当前持仓。</div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setClearHistoryOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={clearHistory}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-600 bg-red-600 text-white hover:bg-red-700"
              >
                清空
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav active={view} onDiscover={discoverNews} onPortfolio={backToPortfolio} />
      
    </div>
  );
};

export default SentimentWatchlistDashboard;
