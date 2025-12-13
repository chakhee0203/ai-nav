const express = require('express');
const router = express.Router();
const Fuse = require('fuse.js');
const geoip = require('geoip-lite');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');
const tools = require('../data');
const { openai } = require('../config/ai');

// 配置目录
const CACHE_DIR = process.env.VERCEL ? '/tmp/cache' : path.join(__dirname, '../cache');
const TRENDING_CACHE_FILE = path.join(CACHE_DIR, 'daily_trends.json');
const LOGO_DIR = process.env.VERCEL ? '/tmp/logos' : path.join(__dirname, '../public/logos');

// Ensure directories exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(LOGO_DIR)) {
  fs.mkdirSync(LOGO_DIR, { recursive: true });
}

// 辅助函数：读取缓存 (返回完整对象，由调用者判断日期)
const getTrendingCacheRaw = () => {
  try {
    if (fs.existsSync(TRENDING_CACHE_FILE)) {
      const data = fs.readFileSync(TRENDING_CACHE_FILE, 'utf8');
      const cache = JSON.parse(data);
      if (cache && cache.tools && Array.isArray(cache.tools)) {
        return cache;
      }
    }
  } catch (error) {
    console.error('Error reading cache:', error);
  }
  return null;
};

// 辅助函数：写入缓存
const saveTrendingCache = (tools) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const cache = {
      date: today,
      tools: tools
    };
    fs.writeFileSync(TRENDING_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Error writing cache:', error);
  }
};

// Fuse.js 配置
const fuseOptions = {
  // 启用模糊匹配
  isCaseSensitive: false,
  includeScore: true,
  shouldSort: true,
  includeMatches: true,
  findAllMatches: true,
  minMatchCharLength: 2,
  location: 0,
  threshold: 0.4, // 阈值，0.0 为完全匹配，1.0 为匹配任何内容。0.4 是一个不错的默认值
  distance: 100,
  useExtendedSearch: true,
  ignoreLocation: true, // 忽略匹配位置，这对长描述很有用
  keys: [
    { name: 'name', weight: 0.8 }, // 名称权重最高
    { name: 'tags', weight: 0.5 }, // 标签其次
    { name: 'category', weight: 0.5 }, // 中文分类
    { name: 'category_en', weight: 0.5 }, // 英文分类
    { name: 'description', weight: 0.3 }, // 中文描述
    { name: 'description_en', weight: 0.3 } // 英文描述
  ]
};

const fuse = new Fuse(tools, fuseOptions);

// ----------------------------------------------------------------
// 定时任务逻辑：每天凌晨 1 点获取热门工具并缓存
// ----------------------------------------------------------------

let isUpdating = false; // 防止并发更新

const fetchAndCacheTrendingTools = async () => {
  if (isUpdating) {
    console.log('Update already in progress, skipping...');
    return null;
  }

  if (!openai) {
    console.log('OpenAI/DeepSeek not configured, skipping trending fetch.');
    return null;
  }

  isUpdating = true;

  try {
    console.log('Fetching daily trending tools from DeepSeek (Scheduled/On-Demand)...');
    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `
      请生成一份今日 (${today}) 全球最热门的前 15 个 AI 工具列表。
      要求：
      1. 必须包含当前最流行、最具影响力的工具 (如 ChatGPT, Midjourney, Claude 3, Sora, Kimi, DeepSeek 等)。
      2. 确保数据真实准确。
      3. 返回格式必须是纯 JSON 数组。
      
      每个工具对象的格式如下：
      {
        "id": 1, (数字 ID，从 1 开始递增)
        "name": "工具名称",
        "description": "中文简介 (简练吸引人)",
        "description_en": "English description",
        "category": "分类 (如 Chatbot, Image, Video, Coding, Productivity)",
        "category_en": "Category in English",
        "url": "官方网址",
        "tags": ["Tag1", "Tag2"], (英文标签)
        "tags_zh": ["标签1", "标签2"] (中文标签)
      }

      请只返回 JSON 数组，不要包含 markdown 代码块。
    `;

    // 增加超时控制，防止 Vercel 函数超时
    const completionPromise = openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt }
      ],
      model: "deepseek-chat",
      temperature: 0.3,
      response_format: { type: "json_object" } 
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DeepSeek API Timeout')), 30000) // 30s timeout
    );

    const completion = await Promise.race([completionPromise, timeoutPromise]);

    const content = completion.choices[0].message.content;
    console.log('DeepSeek trending response:', content);

    let trendingTools = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        trendingTools = parsed;
      } else if (parsed.tools && Array.isArray(parsed.tools)) {
        trendingTools = parsed.tools;
      }
    } catch (e) {
      console.error('Failed to parse DeepSeek Trending JSON:', e);
    }

    if (trendingTools.length > 0) {
      saveTrendingCache(trendingTools);
      console.log('Trending tools cached successfully for date:', today);
      return trendingTools;
    }

  } catch (error) {
    console.error('DeepSeek Trending API error:', error);
  } finally {
    isUpdating = false;
  }
  return null;
};

// 每天凌晨 1:00 执行
cron.schedule('0 1 * * *', () => {
  console.log('Running scheduled task: Fetch Daily Trending Tools');
  fetchAndCacheTrendingTools();
});

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------

// 获取每日热门工具 (优先从缓存获取)
router.get('/trending', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const cachedData = getTrendingCacheRaw();

  // 1. 如果缓存存在且是今天的，直接返回
  if (cachedData && cachedData.date === today) {
    // console.log('Serving fresh trending tools from cache');
    return res.json(cachedData.tools);
  }

  // 2. 如果缓存存在但不是今天的 (过期数据)，先返回过期数据，后台更新
  if (cachedData) {
    console.log('Serving stale trending tools from cache, updating in background...');
    res.json(cachedData.tools); // 立即响应
    fetchAndCacheTrendingTools(); // 后台触发更新
    return;
  }

  // 3. 如果完全没有缓存，先返回本地静态数据作为兜底，后台更新
  console.log('No cache found. Serving local static tools, updating in background...');
  res.json(tools); // 立即响应
  fetchAndCacheTrendingTools(); // 后台触发更新
});

// 获取所有工具
router.get('/tools', (req, res) => {
  res.json(tools);
});

// 获取客户端 IP 和位置信息
router.get('/location', (req, res) => {
  const ip = req.clientIp;
  // 在本地开发时，IP 可能是 ::1 或 127.0.0.1，geoip 查不到
  // 我们可以模拟一个 IP 用于测试，或者返回 null 让前端处理默认值
  const geo = geoip.lookup(ip) || geoip.lookup('114.114.114.114'); // 如果查不到，默认 fallback 到一个中国 IP 方便测试效果
  
  res.json({
    ip,
    country: geo ? geo.country : null,
    city: geo ? geo.city : null
  });
});

// 模拟 AI 推荐/搜索接口
router.post('/search', async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.json(tools);
  }

  try {
    let results = [];

    // 1. 尝试使用 DeepSeek 进行语义分析和工具推荐
    if (openai) {
      try {
        console.log('Using DeepSeek for analysis...');
        const systemPrompt = `
        你是一个智能 AI 工具推荐助手。
        用户会输入他们的需求。你需要分析需求，并完成以下两个任务：
        
        1. 从提供的【本地工具列表】中挑选最合适的工具。
        2. 根据你自己的知识库，推荐 1-3 个【不在本地列表中】但非常匹配用户需求的知名 AI 工具（如果有的话）。
        
        【本地工具列表】 (JSON格式):
        ${JSON.stringify(tools.map(t => ({ id: t.id, name: t.name, description: t.description, category: t.category })))}
        
        请返回一个 JSON 对象，包含两个字段：
        - "local_ids": [匹配的本地工具 ID 列表]
        - "external_tools": [外部工具对象列表]
        
        外部工具对象格式:
        {
          "name": "工具名称",
          "description": "工具描述 (中文)",
          "description_en": "Tool description (English)",
          "category": "分类 (如: Chatbot, Image Generation, Video Generation, Developer Tools, Productivity)",
          "url": "工具官网链接 (请确保准确，如果不确定请留空)",
          "tags": ["Tag1", "Tag2"], // 英文标签
          "tags_zh": ["标签1", "标签2"], // 中文标签
          "is_external": true
        }

        请只返回标准的 JSON 格式，不要包含 markdown 代码块标记。
        `;

        const completion = await openai.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
          ],
          model: "deepseek-chat",
          temperature: 0.2,
          response_format: { type: "json_object" } 
        });

        const content = completion.choices[0].message.content;
        console.log('DeepSeek response:', content);
        
        // 解析返回的 JSON
        let localResults = [];
        let externalResults = [];

        try {
          const parsed = JSON.parse(content);
          
          // 处理本地 ID
          if (parsed.local_ids && Array.isArray(parsed.local_ids)) {
            localResults = tools.filter(t => parsed.local_ids.includes(t.id));
            // 排序
            localResults.sort((a, b) => parsed.local_ids.indexOf(a.id) - parsed.local_ids.indexOf(b.id));
          }
          
          // 处理外部工具
          if (parsed.external_tools && Array.isArray(parsed.external_tools)) {
            externalResults = parsed.external_tools.map((tool, index) => ({
              ...tool,
              id: `ext-${Date.now()}-${index}`, // 生成临时 ID
              category_en: tool.category // 简化处理，假设 AI 返回的是英文或通用分类
            }));
          }
          
        } catch (e) {
          console.error('Failed to parse DeepSeek JSON:', e);
          // 尝试回退到旧逻辑（如果 AI 没按新格式返回）
        }

        results = [...localResults, ...externalResults];

        if (results.length > 0) {
          console.log(`DeepSeek recommended ${localResults.length} local tools and ${externalResults.length} external tools`);
          return res.json(results);
        } else {
           console.log('DeepSeek returned no matches, falling back to fuzzy search.');
        }

      } catch (apiError) {
        console.error('DeepSeek API error:', apiError.message);
        // API 失败则降级到本地搜索
      }
    }

    // 2. 降级/后备方案：使用 Fuse.js 进行本地高级模糊搜索
    const fuseResults = fuse.search(query);
    
    // Fuse 返回的格式是 { item, score, matches }，我们需要提取 item
    results = fuseResults.map(result => result.item);

    // 如果 Fuse 没找到结果，我们可以尝试放宽条件或者进行简单的关键字拆分
    if (results.length === 0) {
      console.log(`No direct fuzzy match for: ${query}, trying loose match...`);
      // 简单的后备逻辑：拆分单词再搜一次 (OR 逻辑)
      const looseQuery = query.split(' ').join(' | ');
      const looseResults = fuse.search(looseQuery);
      results = looseResults.map(result => result.item);
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 获取/下载工具 Logo
router.get('/logo', async (req, res) => {
  const { url, name } = req.query;
  if (!url) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    let domain;
    try {
      domain = new URL(url).hostname;
    } catch (e) {
      return res.status(400).send('Invalid URL');
    }

    const filename = `${domain}.png`;
    const filePath = path.join(LOGO_DIR, filename);

    // 1. 如果本地文件存在，直接返回文件
    if (fs.existsSync(filePath)) {
      // 检查文件大小，如果为0则认为是无效文件，删除并重新下载
      const stats = fs.statSync(filePath);
      if (stats.size > 0) {
        return res.sendFile(filePath);
      } else {
        console.log(`Removing empty logo file for ${domain}`);
        fs.unlinkSync(filePath);
      }
    }

    // 2. 尝试从多个源下载
    const candidates = [
      `https://logo.clearbit.com/${domain}`,
      `https://${domain}/favicon.ico`,
      `https://${domain}/favicon.png`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    ];

    let downloaded = false;

    for (const logoUrl of candidates) {
      try {
        console.log(`Trying to download logo for ${domain} from ${logoUrl}...`);
        const response = await axios({
          method: 'get',
          url: logoUrl,
          responseType: 'stream',
          timeout: 5000, // 5秒超时
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        if (response.status === 200) {
          const writer = fs.createWriteStream(filePath);
          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
          
          downloaded = true;
          console.log(`Successfully downloaded logo for ${domain} from ${logoUrl}`);
          break; // 下载成功，跳出循环
        }
      } catch (err) {
        console.log(`Failed to download from ${logoUrl}: ${err.message}`);
        // 继续尝试下一个
      }
    }

    if (downloaded) {
      res.sendFile(filePath);
    } else {
      console.log(`All attempts failed for ${domain}`);
      res.status(404).send('Logo not found');
    }

  } catch (error) {
    console.error('Logo API Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
