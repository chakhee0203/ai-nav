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
  }, []);

  const refreshQuotes = () => {
    if (!portfolio.length) {
      setQuotes({});
      setError(null);
      return;
    }
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
      });
  };

  const savePortfolio = (newPortfolio) => {
    setPortfolio(newPortfolio);
    localStorage.setItem('portfolio', JSON.stringify(newPortfolio));
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
            setWeight={setWeight}
            setEntryPrice={setEntryPrice}
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

      <BottomNav active={view} onDiscover={discoverNews} onPortfolio={backToPortfolio} />
      
    </div>
  );
};

export default SentimentWatchlistDashboard;
