const Parser = require('rss-parser');
const parser = new Parser();

async function fetchNews(symbol, { limit = 5 } = {}) {
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    symbol
  )}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
  try {
    const feed = await parser.parseURL(feedUrl);
    const items = (feed.items || []).slice(0, limit);
    return items.map((it) => ({
      title: it.title,
      link: it.link,
      pubDate: it.pubDate,
      source: it.source || 'Google News',
    }));
  } catch (e) {
    return [];
  }
}

module.exports = { fetchNews };
