const { fetchQuote, fetchHistory } = require('../services/marketData');
const { fetchNews } = require('../services/news');
const { fetchFinancials } = require('../services/financials');
const { chatLLM, pickLLM } = require('../services/llmExtract');

const uniqNews = (items) => {
  const map = new Map();
  items.forEach((it) => {
    const key = it?.link || it?.title;
    if (!key) return;
    if (!map.has(key)) map.set(key, it);
  });
  return Array.from(map.values());
};

const buildNews = async (symbol, name) => {
  const base = await fetchNews(symbol, { limit: 5 }).catch(() => []);
  const baseKey = name || symbol;
  const topics = [
    { key: 'policy', label: '政策', query: `${baseKey} 政策` },
    { key: 'industry', label: '行业', query: `${baseKey} 行业` },
    { key: 'finance', label: '财报', query: `${baseKey} 财报` },
  ];
  const topicResults = await Promise.all(
    topics.map(t =>
      fetchNews(t.query, { limit: 5 })
        .then(items => (items || []).map(it => ({ ...it, topic: t.label })))
        .catch(() => [])
    )
  );
  const merged = uniqNews([...base, ...topicResults.flat()]);
  const newsByTopic = topics.reduce((acc, t, idx) => {
    acc[t.key] = topicResults[idx] || [];
    return acc;
  }, {});
  return { news: merged, newsByTopic };
};

async function analyzeSymbol(symbol) {
  const [quote, hist] = await Promise.all([
    fetchQuote(symbol),
    fetchHistory(symbol, { interval: '1d' }),
  ]);
  const fin = await fetchFinancials(symbol);
  const { news, newsByTopic } = await buildNews(symbol, quote?.name || '');

  let trend = null;
  if (hist?.series?.length) {
    const series = hist.series.slice(-60);
    const closes = series.map(p => p.close).filter(Number.isFinite);
    if (closes.length >= 20) {
      const last = closes[closes.length - 1];
      const ma20 = closes.slice(-20).reduce((a,b)=>a+b,0) / 20;
      const ret20 = last / closes[closes.length - 20] - 1;
      trend = { last, ma20, ret20 };
    }
  }

  const policyTitles = (newsByTopic.policy || []).map(n => n.title).slice(0, 3).join('；') || '无';
  const industryTitles = (newsByTopic.industry || []).map(n => n.title).slice(0, 3).join('；') || '无';
  const financeTitles = (newsByTopic.finance || []).map(n => n.title).slice(0, 3).join('；') || '无';
  const modelType = pickLLM();
  let analysis = '';
  if (modelType) {
    const content = [
      `你是中文投研助手。基于以下信息对代码 ${symbol} 给出结构化分析：`,
      `- 行情：${quote ? `价格 ${quote.price} ${quote.currency}，涨跌幅 ${quote.changePct ?? '未知'}%` : '未知'}`,
      `- 走势：${trend ? `20日均线 ${trend.ma20?.toFixed?.(2)}，近20日日收益率 ${(trend.ret20*100).toFixed(2)}%` : '不足以判断'}`,
      `- 最新财报：营收 ${fin?.revenue ?? '未知'}；净利 ${fin?.netIncome ?? '未知'}；币种 ${fin?.currency ?? '未知'}`,
      `- 政策新闻：${policyTitles}`,
      `- 行业新闻：${industryTitles}`,
      `- 财报新闻：${financeTitles}`,
      `- 公司相关新闻：${news.length ? news.map(n => n.title).slice(0, 5).join('；') : '无'}`,
      '请从：1) 关键走势与趋势判断；2) 财报质量与盈利变化；3) 政策与行业影响；4) 风险与催化；5) 操作建议给出简洁结论。',
    ].join('\n');
    try {
      const res = await chatLLM([
        { role: 'system', content: '你是资深中文投研分析师，结论务实、风险可控。' },
        { role: 'user', content },
      ]);
      analysis = res || '';
    } catch {
      analysis = '分析失败（模型不可用或限额），请稍后重试。';
    }
  } else {
    const retStr = trend ? `近20日收益率 ${(trend.ret20*100).toFixed(2)}%，20日均线 ${trend.ma20?.toFixed?.(2)}；` : '';
    const finStr = `营收 ${fin?.revenue ?? '未知'}；净利 ${fin?.netIncome ?? '未知'}；`;
    const newsStr = news.length ? `相关新闻：${news.map(n => n.title).slice(0, 2).join('；')}；` : '新闻：暂无；';
    const policyStr = policyTitles ? `政策：${policyTitles}；` : '';
    const industryStr = industryTitles ? `行业：${industryTitles}；` : '';
    analysis = `行情：价格${quote?.price ?? '未知'}，涨跌幅${quote?.changePct ?? '未知'}%。${retStr}${finStr}${policyStr}${industryStr}${newsStr}` +
      '建议：关注关键支撑/压力位与成交量变化；结合财务与政策面谨慎加减仓，设置止损与止盈，并跟踪盈利与现金流改善。';
  }

  return { code: symbol, quote, news, trend, financials: fin, newsByTopic, analysis, model: modelType };
}

function computeMetricsFromSeries(series) {
  if (!series.length) return null;
  const nav0 = series[0].nav;
  const navLast = series[series.length - 1].nav;
  const totalReturn = (navLast / nav0) - 1;
  const rets = [];
  for (let i = 1; i < series.length; i++) {
    const r = series[i].nav / series[i - 1].nav - 1;
    rets.push(r);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length || 0;
  const variance = rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (rets.length || 1);
  const vol = Math.sqrt(variance) * Math.sqrt(252);
  let peak = -Infinity;
  let mdd = 0;
  series.forEach(pt => {
    peak = Math.max(peak, pt.nav);
    const dd = peak > 0 ? (pt.nav / peak - 1) : 0;
    mdd = Math.min(mdd, dd);
  });
  return {
    totalReturn,
    volatility: vol,
    maxDrawdown: mdd,
  };
}

async function backtestEqualWeight(symbols, { start, end, initial = 100000 } = {}) {
  const histories = await Promise.all(
    symbols.map(s => fetchHistory(s, { start, end, interval: '1d' }))
  );
  const valid = histories.filter(Boolean);
  if (!valid.length) return { series: [], metrics: null };
  // Build date -> prices map for intersection
  const dateSets = valid.map(h => new Set(h.series.map(p => p.date)));
  const commonDates = [...dateSets.reduce((acc, s) => new Set([...acc].filter(x => s.has(x))), dateSets[0])].sort();
  const priceMaps = Object.fromEntries(
    valid.map(h => [h.symbol, Object.fromEntries(h.series.map(p => [p.date, p.close]))])
  );
  const weight = 1 / valid.length;
  const series = commonDates.map(date => {
    let nav = 0;
    valid.forEach(h => {
      const px = priceMaps[h.symbol][date];
      nav += (px || 0) * weight;
    });
    return { date, nav };
  });
  // Scale to initial capital using first day normalization
  if (series.length) {
    const base = series[0].nav;
    for (const pt of series) {
      pt.nav = (pt.nav / base) * initial;
    }
  }
  const metrics = computeMetricsFromSeries(series);
  return { series, metrics };
}

module.exports = {
  analyzeSymbol,
  backtestEqualWeight,
};
