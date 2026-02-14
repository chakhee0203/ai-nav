const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const parser = new Parser({
  requestOptions: {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    timeout: 10000,
  },
});

const parseItemsFromXml = (xml, limit) => {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $('item').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const link = $(el).find('link').first().text().trim();
    const pubDate = $(el).find('pubDate').first().text().trim();
    const source = $(el).find('source').first().text().trim();
    if (!title && !link) return;
    items.push({
      title,
      link,
      pubDate,
      source: source || 'Google News',
    });
  });
  return items.slice(0, limit);
};

async function fetchNews(symbol, { limit = 5 } = {}) {
  const query = encodeURIComponent(symbol);
  const feedUrls = [
    `https://news.google.com/rss/search?q=${query}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`,
    `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
    `https://r.jina.ai/http://news.google.com/rss/search?q=${query}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`,
    `https://r.jina.ai/http://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
  ];
  for (const feedUrl of feedUrls) {
    try {
      const resp = await axios.get(feedUrl, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
        timeout: 10000,
        responseType: 'text',
      });
      const xmlItems = parseItemsFromXml(resp.data, limit);
      if (xmlItems.length) return xmlItems;
      const feed = await parser.parseString(resp.data);
      const items = (feed.items || []).slice(0, limit);
      if (items.length) {
        return items.map((it) => ({
          title: it.title,
          link: it.link,
          pubDate: it.pubDate,
          source: it.source || 'Google News',
        }));
      }
    } catch (e) {
      continue;
    }
  }
  return [];
}

module.exports = { fetchNews };
