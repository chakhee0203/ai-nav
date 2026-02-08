const express = require('express');
const router = express.Router();
const axios = require('axios');
const yahooFinance = require('yahoo-finance2').default;
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const cron = require('node-cron');
const Parser = require('rss-parser');
const { openai, zhipuClient } = require('../config/ai');

const parser = new Parser();

// 内存缓存
let cachedData = {
  updatedAt: null,
  market: {
    stocks: {},
    gold: {},
    crypto: {}
  },
  news: [],
  analysis: {
    summary: '',
    detail: ''
  }
};

// 1. 获取市场数据
async function fetchMarketData() {
  const market = { stocks: {}, gold: {}, crypto: {}, flows: {} };
  
  // Define all symbols for batch fetching to reduce requests and avoid 429 errors
  const symbolMap = {
    '000001.SS': { category: 'stocks', key: 'shanghai', name: '上证指数' },
    '399001.SZ': { category: 'stocks', key: 'shenzhen', name: '深证成指' },
    '^HSI': { category: 'stocks', key: 'hsi', name: '恒生指数' },
    '3033.HK': { category: 'stocks', key: 'hstech', name: '恒生科技(ETF)' },
    '^DJI': { category: 'stocks', key: 'dji', name: '道琼斯' },
    '^IXIC': { category: 'stocks', key: 'nasdaq', name: '纳斯达克' },
    'GC=F': { category: 'gold', key: 'london', name: '伦敦金' },
    'BTC-USD': { category: 'crypto', key: 'bitcoin', name: '比特币' },
    'DX-Y.NYB': { category: 'flows', key: 'dxy', name: '美元指数' },
    'CNY=X': { category: 'flows', key: 'usdcny', name: 'USD/CNY' },
    'CL=F': { category: 'flows', key: 'oil', name: '原油' }
  };

  const symbols = Object.keys(symbolMap);

  try {
    console.log('Fetching market data from Yahoo Finance (Batched)...');
    
    // Batch request to Yahoo Finance
    const results = await yahooFinance.quote(symbols);

    if (results && Array.isArray(results)) {
      results.forEach(quote => {
        const symbol = quote.symbol;
        const config = symbolMap[symbol];
        
        if (config && quote.regularMarketPrice !== undefined) {
           const item = {
             name: config.name,
             price: quote.regularMarketPrice,
             changePercent: quote.regularMarketChangePercent || 0
           };
           
           // Handle nested structure
           if (!market[config.category]) market[config.category] = {};
           market[config.category][config.key] = item;
        }
      });
    }

  } catch (error) {
    console.error('Yahoo Market Data Error:', error.message);
    // Graceful degradation: Log error but return empty/partial market object
    // Do not throw to prevent app crash
    if (error.message.includes('429')) {
        console.warn('Hit Yahoo Rate Limit (429). Consider increasing interval.');
    }
  }

  // Fallback check: If Yahoo failed (empty data), try Stooq
    const hasData = Object.keys(market.stocks).length > 0;
    if (!hasData) {
        console.warn('Yahoo returned no data, attempting Stooq fallback...');
        await fetchStooqFallback(market);
    }
    
    return market;
}



async function fetchStooqFallback(market) {
    // Stooq Fallback Logic for Global Indices
    // Mapping: Yahoo/Internal Key -> Stooq Symbol
    const map = {
        'shanghai': '^SHC',  // Shanghai Composite
        'hsi': '^HSI',       // Hang Seng
        'dji': '^DJI',       // Dow Jones
        'nasdaq': '^NDQ',    // Nasdaq
        'london': 'XAUUSD'   // Gold Spot
        // Note: Shenzhen and HSTECH not readily available on Stooq public CSV
    };

    const reverseMap = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
    const symbols = Object.values(map).join('+');
    const url = `https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlc&h&e=csv`;

    try {
        console.log('Fetching market data from Stooq (Fallback)...');
        const res = await axios.get(url, { 
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        // Parse CSV: Symbol,Date,Time,Open,High,Low,Close
        const lines = res.data.split('\n');
        // Remove header
        lines.shift();

        lines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 7) {
                const symbol = parts[0];
                const price = parseFloat(parts[6]); // Close is index 6
                // Stooq CSV doesn't provide change amount/percent in this format
                // We will leave change as 0 or null
                
                const key = reverseMap[symbol];
                if (key && !isNaN(price)) {
                    if (key === 'london') {
                        if (!market.gold) market.gold = {};
                        market.gold[key] = {
                            name: '伦敦金(Stooq)',
                            price: price,
                            changePercent: 0 // Not available
                        };
                    } else {
                        if (!market.stocks) market.stocks = {};
                        market.stocks[key] = {
                            name: getIndexName(key),
                            price: price,
                            changePercent: 0 // Not available
                        };
                    }
                }
            }
        });
    } catch (e) {
        console.error('Stooq Fallback Error:', e.message);
    }
}

function getIndexName(key) {
    const names = {
        'shanghai': '上证指数',
        'hsi': '恒生指数',
        'dji': '道琼斯',
        'nasdaq': '纳斯达克'
    };
    return names[key] || key;
}

// 2. 获取新闻 (RSS + 百度热搜)
async function fetchNews() {
  let allNews = [];

  // 2.1 RSS 源 (优先国内源以保证连接性)
  const rssFeeds = [
    { name: '36Kr', url: 'https://36kr.com/feed' }, // Tech & Business
    { name: 'Google Finance', url: 'https://news.google.com/rss/search?q=finance+china&hl=zh-CN&gl=CN&ceid=CN:zh-CN' }, // Reliable Aggregator
    { name: '联合早报', url: 'https://www.zaobao.com.sg/rss/realtime/world.xml' }, // Global (Requires Cheerio fallback)
  ];

  for (const feed of rssFeeds) {
    try {
      let items = [];
      // Always use axios for timeout control and raw buffer access
      try {
        const res = await axios.get(feed.url, { 
            responseType: 'arraybuffer', 
            timeout: 8000 
        });
        
        let xml = '';
        // Decode logic
        const raw = res.data.toString('utf-8');
        // Simple encoding check
        if (raw.includes('encoding="gb2312"') || raw.includes('encoding="GB2312"') || raw.includes('encoding="gbk"')) {
             xml = iconv.decode(res.data, 'gbk');
        } else {
             xml = raw;
        }

        // Try rss-parser first
        try {
            const feedContent = await parser.parseString(xml);
            items = feedContent.items;
        } catch (parseErr) {
            console.log(`RSS Parser failed for ${feed.name}, trying Cheerio...`);
            // Fallback to cheerio for malformed XML (e.g. Zaobao)
            const $ = cheerio.load(xml, { xmlMode: true });
            $('item').each((i, el) => {
                items.push({
                    title: $(el).find('title').text(),
                    link: $(el).find('link').text(),
                    pubDate: $(el).find('pubDate').text(),
                    content: $(el).find('description').text()
                });
            });
        }

      } catch (netErr) {
        console.error(`Network/Parse Error (${feed.name}): ${netErr.message}`);
      }

      /*
      if (feed.url.includes('sina')) {
           // Special handling for Sina (GBK) - Skipped for now
           try {
               const res = await axios.get(feed.url, { responseType: 'arraybuffer' });
               const xml = iconv.decode(res.data, 'gbk'); // Sina uses GBK usually
               // Try rss-parser first
               try {
                   const feedContent = await parser.parseString(xml);
                   items = feedContent.items;
               } catch (parseErr) {
                   // Fallback to cheerio for malformed XML
                   const $ = cheerio.load(xml, { xmlMode: true });
                   $('item').each((i, el) => {
                       items.push({
                           title: $(el).find('title').text(),
                           link: $(el).find('link').text(),
                           pubDate: $(el).find('pubDate').text(),
                           content: $(el).find('description').text()
                       });
                   });
               }
           } catch (netErr) {
               console.error(`Sina Network Error: ${netErr.message}`);
           }
       } else {
          // Standard RSS
          const res = await parser.parseURL(feed.url);
          items = res.items;
      }
      */

      const mappedItems = items.slice(0, 5).map(item => {
        // 尝试提取图片
        let imageUrl = null;
        if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image')) {
            imageUrl = item.enclosure.url;
        } else if (item.content) {
            const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) imageUrl = imgMatch[1];
        }

        return {
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            source: feed.name,
            summary: item.contentSnippet || item.content || '',
            image: imageUrl
        };
      });
      allNews = [...allNews, ...mappedItems];
    } catch (e) {
      console.error(`RSS Error (${feed.name}):`, e.message);
    }
  }

  // 2.2 百度热搜 (补充国内视角)
  try {
    const baiduRes = await axios.get('https://top.baidu.com/board?tab=realtime', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(baiduRes.data);
    $('.category-wrap_iQLoo').each((i, el) => {
      if (i >= 5) return;
      const title = $(el).find('.c-single-text-ellipsis').text().trim();
      const url = $(el).find('a').attr('href');
      if (title) {
        allNews.push({
          title,
          link: url,
          source: '百度热搜',
          pubDate: new Date().toISOString(),
          summary: $(el).find('.hot-desc_1m_jR').text().trim()
        });
      }
    });
  } catch (e) {
    console.error('Baidu Hot Error:', e.message);
  }

  // 按时间排序 (如果可能)
  return allNews.slice(0, 20); // 保留前20条
}

// 3. AI 研判
async function generateAnalysis(market, news) {
  const client = zhipuClient || openai;
  if (!client) return { summary: "AI 未配置", detail: "请配置 API Key。" };

  // 构建 Prompt
  const marketStr = `
    A股上证: ${market.stocks.shanghai?.price} (${market.stocks.shanghai?.changePercent}%)
    A股深证: ${market.stocks.shenzhen?.price} (${market.stocks.shenzhen?.changePercent}%)
    港股恒生: ${market.stocks.hsi?.price} (${market.stocks.hsi?.changePercent}%)
    港股恒生科技: ${market.stocks.hstech?.price} (${market.stocks.hstech?.changePercent}%)
    美股道琼斯: ${market.stocks.dji?.price || '-'} (${market.stocks.dji?.changePercent || '-'}%)
    美股纳斯达克: ${market.stocks.nasdaq?.price || '-'} (${market.stocks.nasdaq?.changePercent || '-'}%)
    
    【资金流向指标】
    美元指数 (DXY): ${market.flows?.dxy?.price || '-'} (${market.flows?.dxy?.changePercent || '-'}%)
    美元/人民币 (USDCNY): ${market.flows?.usdcny?.price || '-'} (${market.flows?.usdcny?.changePercent || '-'}%)
    原油 (WTI): ${market.flows?.oil?.price || '-'} (${market.flows?.oil?.changePercent || '-'}%)
    黄金: ${market.gold.london?.price}
    比特币: ${market.crypto.bitcoin?.price} (${market.crypto.bitcoin?.changePercent}%)
  `;

  const newsStr = news.map((n, i) => {
      const timeStr = n.pubDate ? new Date(n.pubDate).toLocaleString('zh-CN', { hour12: false }) : '未知时间';
      return `${i+1}. [${n.source} | ${timeStr}] ${n.title}`;
  }).join('\n');

  // console.log('--- News sent to AI (Summary) ---');
  // console.log(`Total items: ${news.length}. Sources: ${[...new Set(news.map(n => n.source))].join(', ')}`);

  const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });

  const prompt = `
    你是一个顶级宏观经济分析师，服务于“牛马情报站”。请根据以下数据进行深度研判。
    当前时间：${nowStr}

    【任务：生成全球重大突发新闻列表】
    1. **筛选标准（极度严格）**：
       - 仅包含对全球金融市场（A股/港股/美股/黄金/期货/Crypto）有**直接且巨大冲击**的事件。
       - 例如：美联储议息会议结果、非农数据发布、突发战争/地缘政治危机、国家级重磅政策（降息降准）、主要经济体领袖更替等。
       - **严禁**包含：个股财报、普通行业新闻、社会民生新闻、无实质影响的官员讲话。
    2. **时间范围**：
       - 优先寻找**过去7天（168小时）内**发生的此类重大事件。
       - **如果过去7天内没有此类重大事件**，则必须**预告未来7天内**即将发生的重大财经日程（如：“未来7日关注：美联储FOMC会议”、“未来7日关注：美国非农数据发布”），并将时间标记为未来时间。

    【市场数据与资金流向】
    ${marketStr}

    【最新情报】
    ${newsStr}

    请输出两部分内容（用JSON格式返回，不要Markdown代码块，直接纯JSON字符串）：
    {
      "breaking_news_list": [
          {
            "title": "重大新闻标题", 
            "summary": "简要概括（必须是对全球市场有重大实质性影响的事件。如果无过去7天事件，则填写未来7天预告）",
            "impact": "高危/利好/中性/前瞻",
            "time": "YYYY-MM-DD HH:mm:ss" 
          }
      ],
      "summary": "一句话毒舌点评当前A股及港股局势（50字以内）",
      "capital_flows": {
        "status": "净流入/净流出/震荡",
        "dxy_analysis": "美元指数简评（如：美元走强压制资产）",
        "usdcny_analysis": "汇率影响简评（如：贬值压力缓解）",
        "overall_risk": "高/中/低"
      },
      "sentiment_score": 50, // 0-100
      "risk_factors": [
         {"name": "A股风险", "value": 5},
         {"name": "港股风险", "value": 6},
         {"name": "外围干扰", "value": 8}
      ],
      "a_share_strategy": {
         "direction": "看多/看空/震荡",
         "focus_sectors": ["板块A", "板块B"],
         "avoid_sectors": ["板块C"]
      },
      "portfolio_suggestion": {
         "allocation": [
            {"asset": "A股/港股", "percentage": 30, "reason": "理由简述"},
            {"asset": "美股/QDII", "percentage": 20, "reason": "理由简述"},
            {"asset": "黄金/商品", "percentage": 10, "reason": "理由简述"},
            {"asset": "Crypto", "percentage": 5, "reason": "理由简述"},
            {"asset": "现金/债券", "percentage": 35, "reason": "理由简述"}
         ],
         "logic": "整体配置逻辑的一句话总结（例如：'防守反击，现金为王' 或 '重仓出击，拥抱核心'）"
      },
      "detail": "使用Markdown格式的详细分析报告。请严格按照以下结构输出（不要使用代码块）：\n\n### 一、全球宏观与资金流向研判\n（必须引用【市场数据与资金流向】中的具体数值，如美元指数DXY、美元兑人民币USDCNY、美债收益率等，分析全球市场水位。若有突发事件，必须结合分析其对资金流向的影响。）\n\n### 二、核心市场方向研判\n#### 1. A股与港股策略\n（必须结合【市场数据】中的指数涨跌幅、北向资金（如有）、汇率压力进行分析。明确指出机会板块和仓位建议。）\n\n#### 2. 黄金与大宗商品\n（结合地缘政治事件和美元走势，引用黄金/原油价格数据给出操作建议。）\n\n#### 3. Crypto与另类资产\n（引用比特币价格及变动幅度，简要分析风险偏好。）\n\n### 三、总结与风控提示\n（一句话总结当前最核心的交易逻辑，并给出明确的风控线。）"
    }
  `;

  try {
    // 优先使用 DeepSeek (openai)，如果未配置则降级到 Zhipu
    const activeClient = openai || zhipuClient;
    const activeModel = openai ? "deepseek-chat" : "glm-4-flash";

    if (!activeClient) return { summary: "AI 未配置", detail: "请配置 API Key。" };

    const completion = await activeClient.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: activeModel,
      temperature: 0.7,
      max_tokens: 2500,
      response_format: { type: "json_object" }
    });
    
    const content = completion.choices[0].message.content;
    try {
        const parsed = JSON.parse(content);

        // Programmatic filter: Breaking news window (Past 7 days + Future 7 days allowed)
        // 7 days = 168 hours
        const sevenDaysAgo = new Date(Date.now() - 168 * 60 * 60 * 1000);
        
        if (parsed.breaking_news_list && Array.isArray(parsed.breaking_news_list)) {
            console.log('AI Raw Breaking News List:', JSON.stringify(parsed.breaking_news_list));
            parsed.breaking_news_list = parsed.breaking_news_list.filter(item => {
                if (!item.time) {
                    console.log('Skipping item without time:', item.title);
                    return false;
                }
                // Replace space with T for ISO compatibility
                const eventTime = new Date(item.time.replace(' ', 'T'));
                if (isNaN(eventTime.getTime())) {
                    console.log('Skipping item with invalid time:', item.time, item.title);
                    // If AI gives a future date description but invalid format, we might miss it.
                    // But usually AI follows format.
                    return false;
                }
                
                // Allow items from 7 days ago AND future items (eventTime > now is fine)
                const isRecentOrFuture = eventTime >= sevenDaysAgo;
                
                if (!isRecentOrFuture) {
                    console.log('Skipping old item (>7 days):', item.time, item.title);
                }
                return isRecentOrFuture;
            });
            console.log('Filtered Breaking News List:', JSON.stringify(parsed.breaking_news_list));
        } else if (parsed.breaking_news) {
             // Fallback for single object format
             if (parsed.breaking_news.time) {
                 const eventTime = new Date(parsed.breaking_news.time.replace(' ', 'T'));
                 if (!isNaN(eventTime.getTime()) && eventTime < threeDaysAgo) {
                     parsed.breaking_news = null;
                 }
             }
        }
        
        return parsed;
    } catch (e) {
        // Fallback if JSON parse fails
        return {
            summary: "AI 分析结果解析失败",
            detail: content
        };
    }
  } catch (error) {
    console.error('AI Analysis Failed:', error);
    return { summary: "AI 暂时离线", detail: "无法连接到分析中心。" };
  }
}

// 核心更新任务
async function updateIntelligence() {
  console.log('Running intelligence update...');
  try {
    console.log('Fetching market data...');
    const market = await fetchMarketData();
    console.log('Fetching news...');
    const news = await fetchNews();
    console.log(`Fetched ${news.length} news items.`);
    
    // Save raw data
    cachedData.market = market;
    cachedData.news = news;

    console.log('Generating analysis...');
    const analysis = await generateAnalysis(market, news);
    
    cachedData = {
      updatedAt: new Date().toISOString(),
      market,
      news,
      analysis
    };
    console.log('Intelligence updated.');
  } catch (error) {
    console.error('Update Intelligence Error:', error);
  }
}

// Routes
router.get('/latest', async (req, res) => {
  if (!cachedData.updatedAt) await updateIntelligence();
  res.json(cachedData);
});

router.post('/refresh', async (req, res) => {
  await updateIntelligence();
  res.json(cachedData);
});

// Schedule: Manual only (Disabled automatic)
// cron.schedule('* * * * *', updateIntelligence);

// Init with delay to allow server startup
setTimeout(() => {
  updateIntelligence();
}, 5000);

module.exports = router;
