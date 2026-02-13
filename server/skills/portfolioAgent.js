const { fetchQuote, fetchHistory } = require('../services/marketData');
const { fetchNews } = require('../services/news');
const { fetchFinancials } = require('../services/financials');

let openaiClient = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

async function analyzeSymbol(symbol) {
  const [quote, news, hist] = await Promise.all([
    fetchQuote(symbol),
    fetchNews(symbol, { limit: 5 }),
    fetchHistory(symbol, { interval: '1d' }),
  ]);
  const fin = await fetchFinancials(symbol);

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

  const client = getOpenAI();
  let analysis = '';
  if (client) {
    const content = [
      `你是中文投研助手。基于以下信息对代码 ${symbol} 给出结构化分析：`,
      `- 行情：${quote ? `价格 ${quote.price} ${quote.currency}，涨跌幅 ${quote.changePct ?? '未知'}%` : '未知'}`,
      `- 走势：${trend ? `20日均线 ${trend.ma20?.toFixed?.(2)}，近20日日收益率 ${(trend.ret20*100).toFixed(2)}%` : '不足以判断'}`,
      `- 财务（简）：营收 ${fin?.revenue ?? '未知'}；净利 ${fin?.netIncome ?? '未知'}；币种 ${fin?.currency ?? '未知'}`,
      `- 新闻（最多5条）：${news.length ? news.map(n => n.title).join('；') : '无'}`,
      `请从：1) 当前走势与关键位；2) 财务质量与盈利趋势；3) 市场情绪与行业/政策背景；4) 风险与催化；5) 操作建议（仓位、止损/止盈、跟踪指标）给出简洁、可执行结论。`,
    ].join('\n');
    try {
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '你是资深中文投研分析师，结论务实、风险可控。' },
          { role: 'user', content },
        ],
        temperature: 0.3,
      });
      analysis = resp.choices?.[0]?.message?.content || '';
    } catch {
      analysis = '分析失败（模型不可用或限额），请稍后重试。';
    }
  } else {
    const retStr = trend ? `近20日收益率 ${(trend.ret20*100).toFixed(2)}%，20日均线 ${trend.ma20?.toFixed?.(2)}；` : '';
    const finStr = `营收 ${fin?.revenue ?? '未知'}；净利 ${fin?.netIncome ?? '未知'}；`;
    const newsStr = news.length ? `相关新闻：${news.map(n => n.title).slice(0, 2).join('；')}；` : '新闻：暂无；';
    analysis = `行情：价格${quote?.price ?? '未知'}，涨跌幅${quote?.changePct ?? '未知'}%。${retStr}${finStr}${newsStr}` +
      '建议：关注关键支撑/压力位与成交量变化；结合财务与政策面谨慎加减仓，设置止损与止盈，并跟踪盈利与现金流改善。';
  }

  return { code: symbol, quote, news, trend, financials: fin, analysis };
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
