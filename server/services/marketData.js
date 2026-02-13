const axios = require('axios');
const { extractPriceFromHtml } = require('./llmExtract');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function normalizeSymbol(symbol) {
  const s = String(symbol).trim().toUpperCase();
  const mPref = s.match(/^(S[HZ])(\d{6})$/);
  if (mPref) {
    const digits = mPref[2];
    if (digits.startsWith('6') || digits.startsWith('9') || digits.startsWith('5')) return `${digits}.SS`;
    return `${digits}.SZ`;
  }
  if (/^\d{6}$/.test(s)) {
    if (s.startsWith('6') || s.startsWith('9') || s.startsWith('5')) return `${s}.SS`;
    return `${s}.SZ`;
  }
  return s;
}

async function fetchQuoteYahoo(symbol) {
  const sym = normalizeSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
  try {
    const { data } = await axios.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' } });
    const quote = data?.quoteResponse?.result?.[0];
    if (!quote) return null;
    const price = quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? null;
    const changePct = quote.regularMarketChangePercent ?? null;
    return {
      symbol: quote.symbol,
      name: quote.shortName || quote.longName || sym,
      price,
      changePct,
      currency: quote.currency || 'USD',
      marketState: quote.marketState || 'CLOSED',
    };
  } catch {
    return null;
  }
}

function toCnPrefix(symbol) {
  const s = String(symbol).trim().toUpperCase();
  if (/^\d{6}$/.test(s)) {
    if (s.startsWith('6') || s.startsWith('9') || s.startsWith('5')) return `sh${s}`;
    return `sz${s}`;
  }
  const mPref = s.match(/^(S[HZ])(\d{6})$/);
  if (mPref) {
    const p = mPref[1].toLowerCase();
    return `${p}${mPref[2]}`;
  }
  return s.toLowerCase();
}

const iconv = require('iconv-lite');

async function fetchQuoteSina(symbol) {
  const code = toCnPrefix(symbol);
  if (!/^s[hz]\d{6}$/.test(code)) return null;
  const url = `http://hq.sinajs.cn/list=${code}`;
  try {
    const resp = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Referer': 'http://finance.sina.com.cn' },
      responseType: 'arraybuffer',
    });
    const text = iconv.decode(Buffer.from(resp.data), 'gbk');
    const m = String(text).match(/"(.*)"/);
    if (!m) return null;
    const parts = m[1].split(',');
    if (parts.length < 4) return null;
    const name = parts[0];
    const prevClose = Number(parts[2]);
    const price = Number(parts[3]);
    if (!Number.isFinite(price)) return null;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    return {
      symbol: code,
      name,
      price,
      changePct,
      currency: 'CNY',
      marketState: 'REGULAR',
    };
  } catch {
    return null;
  }
}

async function fetchQuoteTencent(symbol) {
  const code = toCnPrefix(symbol);
  if (!/^s[hz]\d{6}$/.test(code)) return null;
  const url = `https://qt.gtimg.cn/q=${code}`;
  try {
    const resp = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Referer': 'https://qt.gtimg.cn' },
      responseType: 'arraybuffer',
    });
    const text = iconv.decode(Buffer.from(resp.data), 'gbk');
    const m = String(text).match(/="([^"]+)"/);
    if (!m) return null;
    const parts = m[1].split('~');
    if (parts.length < 5) return null;
    const name = parts[1];
    const price = Number(parts[3]);
    const prevClose = Number(parts[4]);
    if (!Number.isFinite(price)) return null;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    return {
      symbol: code,
      name,
      price,
      changePct,
      currency: 'CNY',
      marketState: 'REGULAR',
    };
  } catch {
    return null;
  }
}

function isCnSymbol(symbol) {
  const s = String(symbol).trim().toUpperCase();
  if (/^\d{6}$/.test(s)) return true;
  if (/^S[HZ]\d{6}$/.test(s)) return true;
  if (s.endsWith('.SS') || s.endsWith('.SZ')) return true;
  return false;
}

async function fetchQuote(symbol) {
  if (isCnSymbol(symbol)) {
    const a = await fetchQuoteTencent(symbol);
    if (a) return a;
    const b = await fetchQuoteSina(symbol);
    if (b) return b;
    const c = await fetchQuoteYahoo(symbol);
    if (c) return c;
    const d = await fetchQuoteLLM(symbol);
    if (d) return d;
    return null;
  } else {
    const c = await fetchQuoteYahoo(symbol);
    if (c) return c;
    const d = await fetchQuoteLLM(symbol);
    if (d) return d;
    return null;
  }
}

async function fetchHistory(symbol, { start, end, interval = '1d' } = {}) {
  const sym = normalizeSymbol(symbol);
  let url;
  if (start && end) {
    const period1 = Math.floor(new Date(start).getTime() / 1000);
    const period2 = Math.floor(new Date(end).getTime() / 1000);
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      sym
    )}?interval=${interval}&period1=${period1}&period2=${period2}`;
  } else {
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      sym
    )}?interval=${interval}&range=1y`;
  }
  let yahooSeries = null;
  try {
    const { data } = await axios.get(url, { headers: { 'User-Agent': UA } });
    const result = data?.chart?.result?.[0];
    if (result) {
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      const series = timestamps
        .map((t, i) => ({
          date: new Date(t * 1000).toISOString().slice(0, 10),
          close: closes[i],
        }))
        .filter((p) => Number.isFinite(p.close));
      if (series.length) {
        yahooSeries = { symbol, series };
      }
    }
  } catch {}
  if (yahooSeries) return yahooSeries;
  if (!isCnSymbol(symbol)) return null;
  return fetchHistoryTencent(symbol);
}

async function fetchHistoryTencent(symbol, count = 120) {
  const code = toCnPrefix(symbol);
  if (!/^s[hz]\d{6}$/.test(code)) return null;
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(
    code
  )},day,,,${count},qfq`;
  try {
    const { data } = await axios.get(url, { headers: { 'User-Agent': UA, 'Referer': 'https://qt.gtimg.cn' } });
    const node = data?.data?.[code];
    const seriesRaw = node?.qfqday || node?.day || [];
    if (!Array.isArray(seriesRaw) || !seriesRaw.length) return null;
    const series = seriesRaw
      .map((row) => ({
        date: row?.[0],
        close: Number(row?.[2]),
      }))
      .filter((p) => p.date && Number.isFinite(p.close));
    return series.length ? { symbol, series } : null;
  } catch {
    return null;
  }
}

async function fetchQuoteLLM(symbol) {
  const sym = normalizeSymbol(symbol);
  const url = `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
  try {
    const { data } = await axios.get(url, { headers: { 'User-Agent': UA } });
    const ext = await extractPriceFromHtml(String(data), sym);
    if (ext && typeof ext.price === 'number') {
      return {
        symbol: sym,
        name: sym,
        price: ext.price,
        changePct: null,
        currency: ext.currency || 'USD',
        marketState: 'UNKNOWN',
      };
    }
  } catch {}
  return null;
}

module.exports = {
  fetchQuote,
  fetchHistory,
};
