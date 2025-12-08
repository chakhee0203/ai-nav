const express = require('express');
const cors = require('cors');
const Fuse = require('fuse.js');
const geoip = require('geoip-lite');
const requestIp = require('request-ip');
const tools = require('./data');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const CACHE_DIR = process.env.VERCEL ? '/tmp/cache' : path.join(__dirname, 'cache');
const TRENDING_CACHE_FILE = path.join(CACHE_DIR, 'daily_trends.json');
const LOGO_DIR = process.env.VERCEL ? '/tmp/logos' : path.join(__dirname, 'public/logos');

// Ensure directories exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(LOGO_DIR)) {
  fs.mkdirSync(LOGO_DIR, { recursive: true });
}

// 初始化 OpenAI 客户端 (兼容 DeepSeek)
const apiKey = process.env.DEEPSEEK_API_KEY;
console.log('DeepSeek API Key Status:', apiKey ? 'Present (' + apiKey.substring(0, 4) + '***)' : 'Missing');

const openai = apiKey ? new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: apiKey
}) : null;

// 初始化 ZhipuAI 客户端 (用于视觉任务)
const zhipuApiKey = process.env.ZHIPU_API_KEY;
console.log('Zhipu API Key Status:', zhipuApiKey ? 'Present' : 'Missing');

const zhipuClient = zhipuApiKey ? new OpenAI({
  baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
  apiKey: zhipuApiKey
}) : null;

// 辅助函数：读取缓存
const getTrendingCache = () => {
  try {
    if (fs.existsSync(TRENDING_CACHE_FILE)) {
      const data = fs.readFileSync(TRENDING_CACHE_FILE, 'utf8');
      const cache = JSON.parse(data);
      
      // 检查缓存日期是否是今天
      const today = new Date().toISOString().split('T')[0];
      if (cache.date === today && cache.tools && cache.tools.length > 0) {
        return cache.tools;
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

// 使用 request-ip 中间件
app.use(requestIp.mw());
app.use(cors());
app.use(express.json());
app.use('/logos', express.static(LOGO_DIR));

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

// 获取每日热门工具 (从缓存或 DeepSeek 获取)
app.get('/api/trending', async (req, res) => {
  // 1. 尝试从缓存获取
  const cachedTools = getTrendingCache();
  if (cachedTools) {
    console.log('Serving trending tools from cache');
    return res.json(cachedTools);
  }

  // 2. 如果没有缓存，调用 DeepSeek 生成
  if (openai) {
    try {
      console.log('Fetching daily trending tools from DeepSeek...');
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
        setTimeout(() => reject(new Error('DeepSeek API Timeout')), 5000)
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
        return res.json(trendingTools);
      }

    } catch (error) {
      console.error('DeepSeek Trending API error:', error);
    }
  }

  // 3. 如果 API 失败，回退到本地静态数据
  console.log('Falling back to local static tools');
  res.json(tools);
});

// 获取所有工具 (兼容旧接口，现在指向 trending 也可以，或者保持原样作为全量库)
app.get('/api/tools', (req, res) => {
  res.json(tools);
});

// 获取客户端 IP 和位置信息
app.get('/api/location', (req, res) => {
  const ip = req.clientIp;
  // 在本地开发时，IP 可能是 ::1 或 127.0.0.1，geoip 查不到
  // 我们可以模拟一个 IP 用于测试，或者返回 null 让前端处理默认值
  const geo = geoip.lookup(ip) || geoip.lookup('114.114.114.114'); // 如果查不到，默认 fallback 到一个中国 IP 方便测试效果 (或者去掉这个 fallback)
  
  // 生产环境建议去掉 fallback，让前端决定默认语言
  // const geo = geoip.lookup(ip);

  res.json({
    ip,
    country: geo ? geo.country : null,
    city: geo ? geo.city : null
  });
});

// 模拟 AI 推荐/搜索接口
app.post('/api/search', async (req, res) => {
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
    // 这比之前的简单的 includes 强大得多，支持拼写错误、加权、部分匹配
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
app.get('/api/logo', async (req, res) => {
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

// DeepSeek Prompt Generation API
app.post('/api/generate-prompt', async (req, res) => {
  const { input, type = 'general' } = req.body;

  if (!input) {
    return res.status(400).json({ error: 'Missing input' });
  }

  if (!openai) {
    return res.status(503).json({ error: 'AI service not configured' });
  }

  try {
    const systemPrompt = `
    You are an expert Prompt Engineer. Your goal is to rewrite the user's raw idea into a high-quality, professional prompt optimized for Large Language Models (LLMs) or AI Image Generators depending on the context.
    
    Context: ${type === 'image' ? 'Midjourney/Stable Diffusion Image Generation' : 'ChatGPT/Claude General Task'}

    If Context is Image Generation:
    - Focus on visual descriptors, lighting, style, composition, and artists.
    - Format: "Subject, details, style, lighting, aspect ratio parameters".
    - English output is preferred for image generators.

    If Context is General Task:
    - Use the CO-STAR framework (Context, Objective, Style, Tone, Audience, Response).
    - Be clear, specific, and structured.
    - If the input is Chinese, output optimized Chinese. If English, output English.

    Input: "${input}"

    Return ONLY the optimized prompt text, no explanations.
    `;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input }
      ],
      model: "deepseek-chat",
      temperature: 0.7,
    });

    const optimizedPrompt = completion.choices[0].message.content;
    res.json({ result: optimizedPrompt });

  } catch (error) {
    console.error('Prompt Generation Error:', error);
    // Return detailed error message if available
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to generate prompt';
    res.status(500).json({ error: errorMessage });
  }
});

// Zhipu OCR & Translation API
app.post('/api/ocr-translate', async (req, res) => {
  const { image, targetLang = 'English' } = req.body; // image is base64 string

  if (!image) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  if (!zhipuClient) {
    return res.status(503).json({ error: 'Vision AI service not configured (Missing ZHIPU_API_KEY)' });
  }

  try {
    const systemPrompt = `
    You are a professional translator and OCR expert.
    1. Identify ALL text in the provided image.
    2. Translate the identified text into ${targetLang}.
    3. Return the result using the following EXACT format (do not use JSON):

    [[ORIGINAL_TEXT_START]]
    {Put the original text here, preserving line breaks}
    [[ORIGINAL_TEXT_END]]
    
    [[TRANSLATED_TEXT_START]]
    {Put the translated text here}
    [[TRANSLATED_TEXT_END]]
    `;

    const response = await zhipuClient.chat.completions.create({
      model: "glm-4v",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            {
              type: "image_url",
              image_url: {
                url: image
              }
            }
          ]
        }
      ],
      max_tokens: 2048,
      temperature: 0.1
    });

    const content = response.choices[0].message.content;
    console.log('Zhipu Raw Response:', content);
    
    let result = {
      originalText: "",
      translatedText: ""
    };

    try {
      // Extract content using delimiters
      const originalMatch = content.match(/\[\[ORIGINAL_TEXT_START\]\]([\s\S]*?)\[\[ORIGINAL_TEXT_END\]\]/);
      const translatedMatch = content.match(/\[\[TRANSLATED_TEXT_START\]\]([\s\S]*?)\[\[TRANSLATED_TEXT_END\]\]/);

      if (originalMatch) {
        result.originalText = originalMatch[1].trim();
      }
      if (translatedMatch) {
        result.translatedText = translatedMatch[1].trim();
      }

      // If extraction failed completely, return raw content
      if (!result.originalText && !result.translatedText) {
         // Try legacy JSON parsing just in case the model ignored instructions (unlikely with this prompt)
         try {
            const jsonRes = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
            result.originalText = jsonRes.originalText || content;
            result.translatedText = jsonRes.translatedText || "";
         } catch(e) {
            result.originalText = "Raw output (Parsing failed): " + content;
         }
      }

    } catch (e) {
      console.error('Parsing Error:', e);
      result.originalText = "Error parsing output: " + content;
    }

    res.json(result);

  } catch (error) {
    console.error('OCR/Translate Error:', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to process image';
    res.status(500).json({ error: errorMessage });
  }
});

// Serve static files from the React client
// Strategy: Find where index.html is located
const localPublicPath = path.join(__dirname, 'public');
const rootPublicPath = path.join(__dirname, '../public');
const clientDistPath = path.join(__dirname, '../client/dist');

let staticDir = null;

if (fs.existsSync(path.join(localPublicPath, 'index.html'))) {
  console.log('Found React app in ./public (Docker/Merged)');
  staticDir = localPublicPath;
} else if (fs.existsSync(path.join(rootPublicPath, 'index.html'))) {
  console.log('Found React app in ../public (Vercel/Local)');
  staticDir = rootPublicPath;
} else if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
  console.log('Found React app in ../client/dist (Legacy)');
  staticDir = clientDistPath;
}

if (staticDir) {
  app.use(express.static(staticDir));
  app.get('*', (req, res) => {
    // Exclude API routes and logos from wildcard match (handled by express router order, but good to be safe)
    if (req.path.startsWith('/api') || req.path.startsWith('/logos')) {
      return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(staticDir, 'index.html'));
  });
} else {
  console.log('Warning: No React app build found. API only mode.');
}

// Export for Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true'; // Vercel sets this to '1'

if (!isVercel) {
  const host = '0.0.0.0';
  console.log('Starting server...');
  try {
    const server = app.listen(PORT, host, () => {
      console.log(`Server is running on http://${host}:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Static Directory: ${staticDir || 'None'}`);
    });

    server.on('error', (e) => {
      console.error('Server startup error:', e);
      process.exit(1);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

module.exports = app;
