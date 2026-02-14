const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { analyzeSymbol } = require('./skills/portfolioAgent');
const { fetchQuote } = require('./services/marketData');
const { fetchNews } = require('./services/news');
const path = require('path');

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateBuckets = new Map();

const getClientIp = (req) => {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

const checkRateLimit = (req) => {
  const now = Date.now();
  const key = getClientIp(req);
  const entry = rateBuckets.get(key) || { count: 0, start: now };
  if (now - entry.start >= RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  rateBuckets.set(key, entry);
  const remainingMs = RATE_LIMIT_WINDOW_MS - (now - entry.start);
  return {
    allowed: entry.count <= RATE_LIMIT_MAX,
    retryAfter: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
};

const normalizeCodes = (codes) => {
  return codes
    .map(c => String(c ?? '').trim())
    .filter(Boolean)
    .map(c => c.toUpperCase());
};

const isValidCode = (code) => {
  if (!code || code.length > 16) return false;
  if (/^\d{6}$/.test(code)) return true;
  if (/^(SH|SZ)\d{6}$/.test(code)) return true;
  if (/^\d{6}\.(SS|SZ)$/.test(code)) return true;
  if (/^[A-Z0-9.\-]{1,10}$/.test(code)) return true;
  return false;
};

app.post('/api/analyze', (req, res) => {
  const rate = checkRateLimit(req);
  if (!rate.allowed) {
    res.set('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  const { codes } = req.body;

  if (!codes || !Array.isArray(codes)) {
    return res.status(400).json({ error: 'Invalid input. Expected an array of codes.' });
  }

  const normalized = normalizeCodes(codes);
  if (!normalized.length) {
    return res.status(400).json({ error: 'Invalid input. Expected non-empty codes.' });
  }
  if (normalized.length > 10) {
    return res.status(400).json({ error: 'Too many codes. Max 10.' });
  }
  const invalid = normalized.filter(c => !isValidCode(c));
  if (invalid.length) {
    return res.status(400).json({ error: 'Invalid code format.', invalid });
  }

  Promise.all(normalized.map(code => analyzeSymbol(code)))
    .then(results => res.json({ results }))
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Analysis failed' });
    });

});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/quote', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'code is required' });
  try {
    const q = await fetchQuote(String(code).trim());
    res.json(q || null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Quote fetch failed' });
  }
});

app.get('/api/news/related', async (req, res) => {
  const { code, q } = req.query;
  const queries = [];
  try {
    let name = '';
    if (code) {
      const quote = await fetchQuote(String(code).trim());
      name = quote?.name || '';
    }
    if (q) queries.push(String(q).trim());
    if (code) queries.push(String(code).trim());
    if (name) {
      queries.push(name);
      queries.push(`${name} 行业`);
      queries.push(`${name} 公司`);
      queries.push(`${name} 政策`);
    }
    // Expand for CN six-digit codes
    const s = String(code || '').trim().toUpperCase();
    const m = s.match(/^(\d{6})$/);
    if (m) {
      const digits = m[1];
      queries.push(`SH${digits}`);
      queries.push(`SZ${digits}`);
      queries.push(`${digits}.SS`);
      queries.push(`${digits}.SZ`);
      queries.push(`${digits} 政策`);
      queries.push(`${digits} 行业`);
    }
    const uniq = new Map();
    for (const query of queries) {
      if (!query) continue;
      const items = await fetchNews(query, { limit: 10 });
      items.forEach((it) => {
        const key = it.link || it.title;
        if (!uniq.has(key)) uniq.set(key, { ...it, query });
      });
    }
    let results = Array.from(uniq.values());
    if (!results.length && name) {
      // Fallback: query company name alone
      const items = await fetchNews(name, { limit: 10 });
      results = items.map(it => ({ ...it, query: name }));
    }
    res.json({ results: results.slice(0, 20) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Related news fetch failed' });
  }
});

app.get('/api/news/discover', async (req, res) => {
  const rate = checkRateLimit(req);
  if (!rate.allowed) {
    res.set('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ error: 'Too Many Requests' });
  }
  const { section } = req.query;
  const sections = [
    { key: 'policy', title: '最新政策', queries: ['十五五规划', '两会 政府工作报告', '中央经济工作会议', '国务院常务会议 经济'] },
    { key: 'event', title: '大事件', queries: ['美联储 降息', 'FOMC 利率决议', '非农 就业 数据', '美国 CPI 通胀', '欧洲央行 利率决议'] },
    { key: 'hot', title: '热点', queries: ['市场热点', '板块 热点', '主题 投资 热点', '资金 热点', 'A股 热点'] },
  ];
  try {
    const buildSection = async (target) => {
      const uniq = new Map();
      for (const q of target.queries) {
        const items = await fetchNews(q, { limit: 8 });
        items.forEach((it) => {
          const key = it.link || it.title;
          if (!uniq.has(key)) uniq.set(key, { ...it, query: q });
        });
      }
      return { key: target.key, title: target.title, items: Array.from(uniq.values()).slice(0, 12) };
    };
    if (section) {
      const target = sections.find(s => s.key === String(section).trim());
      if (!target) return res.status(400).json({ error: 'Invalid section' });
      const result = await buildSection(target);
      return res.json({ section: result, updatedAt: new Date().toISOString() });
    }
    const results = [];
    for (const target of sections) {
      results.push(await buildSection(target));
    }
    res.json({ sections: results, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Discover news fetch failed' });
  }
});

app.get('/api/news/policy-impact', async (req, res) => {
  const rate = checkRateLimit(req);
  if (!rate.allowed) {
    res.set('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ error: 'Too Many Requests' });
  }
  const year = Number(req.query.year) || new Date().getFullYear();
  const categories = [
    { key: 'plan', title: '十五五规划', queries: [`${year} 十五五规划`, '十五五 规划 纲要', '十五五 规划 重点任务'] },
    { key: 'lianghui', title: '两会政策', queries: [`${year} 两会 政府工作报告`, `${year} 两会 经济 政策`, `${year} 两会 政策 要点`] },
    { key: 'meeting', title: '重要经济会议', queries: [`${year} 中央经济工作会议`, `${year} 国务院常务会议 经济`, `${year} 全国金融工作会议`] },
  ];
  try {
    const results = [];
    for (const category of categories) {
      const uniq = new Map();
      for (const q of category.queries) {
        const items = await fetchNews(q, { limit: 8 });
        items.forEach((it) => {
          const key = it.link || it.title;
          if (!uniq.has(key)) uniq.set(key, { ...it, query: q });
        });
      }
      const items = Array.from(uniq.values()).slice(0, 12);
      const summary = items.length ? items.slice(0, 3).map(it => it.title).join('；') : '暂无';
      results.push({ key: category.key, title: category.title, summary, items });
    }
    res.json({ year, categories: results, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Policy impact fetch failed' });
  }
});

// Serve built frontend
const staticDir = path.join(__dirname, '../public');
app.use(express.static(staticDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(staticDir, 'index.html'));
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
