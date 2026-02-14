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

const parseItemsFromXml = (xml, limit, defaultSource = 'Google News') => {
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
      source: source || defaultSource,
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
    `https://www.bing.com/news/search?q=${query}&format=rss&setlang=zh-cn&cc=CN`,
    `https://www.bing.com/news/search?q=${query}&format=rss&setlang=en-us&cc=US`,
    `https://cn.bing.com/news/search?q=${query}&format=rss&setlang=zh-cn&cc=CN`,
    `https://cn.bing.com/news/search?q=${query}&format=rss&setlang=en-us&cc=US`,
  ];
  for (const feedUrl of feedUrls) {
    try {
      const isBing = feedUrl.includes('bing.com');
      const headers = {
        'User-Agent': UA,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      };
      if (isBing) {
        headers.Accept = 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7';
        headers['Accept-Encoding'] = 'gzip, deflate';
        headers.Referer = 'https://www.bing.com/news';
      }
      const resp = await axios.get(feedUrl, {
        headers,
        timeout: 10000,
        responseType: 'text',
        maxRedirects: 5,
      });
      const defaultSource = feedUrl.includes('bing.com') ? 'Bing News' : 'Google News';
      const xmlItems = parseItemsFromXml(resp.data, limit, defaultSource);
      if (xmlItems.length) return xmlItems;
      const feed = await parser.parseString(resp.data);
      const items = (feed.items || []).slice(0, limit);
      if (items.length) {
        return items.map((it) => ({
          title: it.title,
          link: it.link,
          pubDate: it.pubDate,
          source: it.source || defaultSource,
        }));
      }
    } catch (e) {
      continue;
    }
  }
  return [];
}

module.exports = { fetchNews };
