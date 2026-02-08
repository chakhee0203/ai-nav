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
  
  // --- Strategy: Primary (Tencent/Sina) -> Fallback (Yahoo Finance) ---

  // A. Stocks & Gold
  try {
    // 尝试腾讯财经 (Primary)
    const qtUrl = 'http://qt.gtimg.cn/q=sh000001,sz399001,hkHSI,hkHSTECH,hf_XAU,us.DJI';
    const qtRes = await axios.get(qtUrl, { 
        responseType: 'arraybuffer',
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const qtData = iconv.decode(qtRes.data, 'gbk');
    const lines = qtData.split(';');

    // Helper to parse QT format
    const parseQt = (line) => {
      if (!line) return null;
      const content = line.split('"')[1];
      if (!content) return null;
      const parts = content.split('~');
      return {
        name: parts[1],
        price: parseFloat(parts[3]),
        changePercent: parseFloat(parts[32]),
        changeAmount: parseFloat(parts[31])
      };
    };

    const sh = parseQt(lines[0]);
    if (sh && sh.price > 0) market.stocks.shanghai = { ...sh, name: '上证指数' };

    const sz = parseQt(lines[1]);
    if (sz && sz.price > 0) market.stocks.shenzhen = { ...sz, name: '深证成指' };

    const hsi = parseQt(lines[2]);
    if (hsi && hsi.price > 0) market.stocks.hsi = { ...hsi, name: '恒生指数' };

    const hstech = parseQt(lines[3]);
    if (hstech && hstech.price > 0) market.stocks.hstech = { ...hstech, name: '恒生科技' };

    // 黄金: hf_XAU
    if (lines[4]) {
        const content = lines[4].split('"')[1];
        if (content) {
            const parts = content.split(',');
            market.gold.london = {
                name: '伦敦金',
                price: parseFloat(parts[0]) || 0,
                changePercent: parseFloat(parts[1]) || 0
            };
        }
    }
    
    const dji = parseQt(lines[5]);
    if (dji && dji.price > 0) market.stocks.dji = { ...dji, name: '道琼斯' };

  } catch (e) {
    console.error('Market Data (QT) Error:', e.message);
  }

  // Fallback: Yahoo Finance (if any key data is missing)
  if (!market.stocks.shanghai || !market.stocks.hsi || !market.gold.london) {
      console.log('Primary source failed or incomplete, switching to Yahoo Finance fallback...');
      try {
          // Map: 000001.SS (上证), 399001.SZ (深证), ^HSI (恒生), 3033.HK (恒生科技ETF替代), GC=F (黄金), ^DJI (道指)
          // Note: Yahoo Finance query1 API is robust
          const symbols = ['000001.SS', '399001.SZ', '^HSI', '3033.HK', 'GC=F', '^DJI'];
          const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbols.join(',')}?interval=1d&range=1d`; // Batch not supported this way in v8 chart, need loop or quote api
          
          // Use yahoo-finance2 for reliable overseas access
          const results = await yahooFinance.quote(symbols);

          if (results && results.length > 0) {
              const find = (sym) => results.find(r => r.symbol === sym);
              
              const sh = find('000001.SS');
              if (sh) market.stocks.shanghai = { name: '上证指数', price: sh.regularMarketPrice, changePercent: sh.regularMarketChangePercent };
              
              const sz = find('399001.SZ');
              if (sz) market.stocks.shenzhen = { name: '深证成指', price: sz.regularMarketPrice, changePercent: sz.regularMarketChangePercent };
              
              const hsi = find('^HSI');
              if (hsi) market.stocks.hsi = { name: '恒生指数', price: hsi.regularMarketPrice, changePercent: hsi.regularMarketChangePercent };
              
              const hstech = find('3033.HK'); // Using ETF as proxy for Tech index direction
              if (hstech) market.stocks.hstech = { name: '恒生科技(ETF)', price: hstech.regularMarketPrice, changePercent: hstech.regularMarketChangePercent };
              
              const gold = find('GC=F');
              if (gold) market.gold.london = { name: 'COMEX黄金', price: gold.regularMarketPrice, changePercent: gold.regularMarketChangePercent };

              const dji = find('^DJI');
              if (dji) market.stocks.dji = { name: '道琼斯', price: dji.regularMarketPrice, changePercent: dji.regularMarketChangePercent };
          }
      } catch (ey) {
          console.error('Yahoo Finance Fallback Error:', ey.message);
      }
  }

  // ... (Rest of the function: Bitcoin, Sina Flows)

  // Bitcoin (CryptoCompare -> Blockchain.info -> Mock)
  try {
    // 1. CryptoCompare (More reliable without proxy)
    const ccRes = await axios.get('https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD', { timeout: 5000 });
    // Note: CryptoCompare only gives price. For change%, we need 'pricemultifull' or just 0.
    // Let's try to get change% if possible: https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC&tsyms=USD
    const ccFullRes = await axios.get('https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC&tsyms=USD', { timeout: 5000 });
    const rawCC = ccFullRes.data.RAW.BTC.USD;
    
    market.crypto.bitcoin = {
      name: 'Bitcoin',
      price: parseFloat(rawCC.PRICE).toFixed(2),
      changePercent: parseFloat(rawCC.CHANGEPCT24HOUR).toFixed(2)
    };
  } catch (e) {
    console.error('Crypto (CryptoCompare) Error:', e.message);
  }

  // Global Flows (Sina Finance)
  // DINIW: Dollar Index, USDCNY: USD/CNY, hf_CL: Crude Oil
  try {
      const sinaUrl = 'http://hq.sinajs.cn/list=DINIW,USDCNY,hf_CL,gb_dji,gb_ixic';
      const sinaRes = await axios.get(sinaUrl, { 
          responseType: 'arraybuffer',
          headers: { 'Referer': 'https://finance.sina.com.cn/' }
      });
      const sinaText = iconv.decode(sinaRes.data, 'gbk');
      
      market.flows = {};

      // Helper for Sina format: var hq_str_CODE="val1,val2,..."
      const parseSina = (code, text) => {
          const match = text.match(new RegExp(`var hq_str_${code}="(.*?)";`));
          if (match && match[1]) {
              const parts = match[1].split(',');
              return parts;
          }
          return null;
      };

      // DINIW: time, price, ...
      // "04:59:02,97.6102,97.6102,97.9300,4724,97.9323,98.0297,97.5573,97.6102,美元指数,2026-02-07"
      // Index 1: Current Price. Index 2: Open/Prev Close.
      const diniw = parseSina('DINIW', sinaText);
      if (diniw) {
          const price = parseFloat(diniw[1]);
          const prev = parseFloat(diniw[2]);
          market.flows.dxy = {
              name: '美元指数',
              price: price.toFixed(2),
              changePercent: prev ? ((price - prev) / prev * 100).toFixed(2) : '0.00'
          };
      }

      // USDCNY: "03:00:01,6.9345,6.9362,..."
      // Index 1: Price, Index 2: Prev
      const usdcny = parseSina('USDCNY', sinaText);
      if (usdcny) {
           const price = parseFloat(usdcny[1]);
           const prev = parseFloat(usdcny[2]);
           market.flows.usdcny = {
               name: 'USD/CNY',
               price: price.toFixed(4),
               changePercent: prev ? ((price - prev) / prev * 100).toFixed(2) : '0.00'
           };
      }
      
      // Crude Oil (hf_CL): "63.597,,63.490,..." -> Index 0: Price, Index 2: Open/Prev
      const oil = parseSina('hf_CL', sinaText);
      if (oil) {
          const price = parseFloat(oil[0]);
          const prev = parseFloat(oil[2]); // Use Index 2 as ref if Index 1 is empty
          // Some sina futures have change% at index 1, but if empty, calc manually
          let changePct = '0.00';
          if (oil[1]) {
              changePct = parseFloat(oil[1]).toFixed(2);
          } else if (prev) {
              changePct = ((price - prev) / prev * 100).toFixed(2);
          }
          
          market.flows.oil = {
              name: '原油',
              price: price.toFixed(2),
              changePercent: changePct
          };
      }
      
      // US Stocks (gb_dji)
      // "道琼斯,50115.6719,2.47,..." -> Index 1: Price, Index 2: Change%
      const dji = parseSina('gb_dji', sinaText);
      if (dji) {
          market.stocks.dji = {
              name: '道琼斯',
              price: parseFloat(dji[1]).toFixed(0),
              changePercent: parseFloat(dji[2]).toFixed(2)
          };
      }
      
      const ixic = parseSina('gb_ixic', sinaText);
      if (ixic) {
          market.stocks.nasdaq = {
              name: '纳斯达克',
              price: parseFloat(ixic[1]).toFixed(0),
              changePercent: parseFloat(ixic[2]).toFixed(2)
          };
      }

  } catch (e) {
      console.error('Global Flows (Sina) Error:', e.message);
  }

  // Fallback for Flows (if Sina failed)
  if (!market.flows.dxy || !market.flows.usdcny || !market.flows.oil || !market.stocks.nasdaq) {
      console.log('Sina flows failed, switching to Yahoo Finance fallback...');
      try {
          const symbols = ['DX-Y.NYB', 'CNY=X', 'CL=F', '^IXIC'];
          const results = await yahooFinance.quote(symbols);

          if (results && results.length > 0) {
              const find = (sym) => results.find(r => r.symbol === sym);

              const dxy = find('DX-Y.NYB');
              if (dxy) market.flows.dxy = { name: '美元指数', price: dxy.regularMarketPrice, changePercent: dxy.regularMarketChangePercent };

              const cny = find('CNY=X');
              if (cny) market.flows.usdcny = { name: 'USD/CNY', price: cny.regularMarketPrice, changePercent: cny.regularMarketChangePercent };

              const oil = find('CL=F');
              if (oil) market.flows.oil = { name: '原油', price: oil.regularMarketPrice, changePercent: oil.regularMarketChangePercent };
              
              const ixic = find('^IXIC');
              if (ixic) market.stocks.nasdaq = { name: '纳斯达克', price: ixic.regularMarketPrice, changePercent: ixic.regularMarketChangePercent };
          }
      } catch (e) {
          console.error('Yahoo Flows Fallback Error:', e.message);
      }
  }

  return market;
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
