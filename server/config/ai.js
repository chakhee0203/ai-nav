const OpenAI = require('openai');
require('dotenv').config();

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

module.exports = { openai, zhipuClient };
