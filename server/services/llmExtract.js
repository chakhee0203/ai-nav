const axios = require('axios');

function pickLLM() {
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if (process.env.ZHIPU_API_KEY) return 'zhipu';
  return null;
}

async function chatLLM(messages) {
  const which = pickLLM();
  if (!which) return null;
  if (which === 'deepseek') {
    const url = 'https://api.deepseek.com/chat/completions';
    const resp = await axios.post(
      url,
      { model: 'deepseek-chat', messages, temperature: 0 },
      { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } }
    );
    return resp.data?.choices?.[0]?.message?.content || null;
  } else {
    const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    const resp = await axios.post(
      url,
      { model: 'glm-4', messages, temperature: 0 },
      { headers: { Authorization: `Bearer ${process.env.ZHIPU_API_KEY}` } }
    );
    return resp.data?.choices?.[0]?.message?.content || null;
  }
}

async function extractPriceFromHtml(html, symbol) {
  const content = [
    '你是一个信息抽取器。根据给定的网页片段，提取该证券的当前价格与币种。',
    '只返回 JSON，不要文字说明。',
    'JSON 结构: {"price": number, "currency": "string"}',
    `代码: ${symbol}`,
    '网页片段如下：',
    html.slice(0, 15000),
  ].join('\n');
  const res = await chatLLM([
    { role: 'system', content: '从文本中抽取指定字段，严格输出 JSON。' },
    { role: 'user', content },
  ]);
  if (!res) return null;
  try {
    const j = JSON.parse(res);
    if (typeof j.price === 'number') return j;
  } catch {}
  return null;
}

module.exports = {
  extractPriceFromHtml,
  chatLLM,
  pickLLM,
}
