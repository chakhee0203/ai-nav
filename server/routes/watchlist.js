const express = require('express');
const router = express.Router();
const axios = require('axios');
const iconv = require('iconv-lite');
const { openai } = require('../config/ai');

// Helper: Fetch market data from Tencent
// Supports auto-detection by trying prefixes if not provided
async function fetchMarketData(codes) {
    // 1. Construct query
    // We'll try to guess prefixes if missing.
    // A-share: 6 digits (60xxxx -> sh, 00xxxx -> sz, 30xxxx -> sz, 68xxxx -> sh, 4/8 -> bj?)
    // HK: 5 digits
    // US: Letters
    
    const formattedCodes = codes.map(c => {
        c = c.toLowerCase().trim();
        if (/^(sh|sz|hk|us)/.test(c)) return c; // Already has prefix
        
        // Auto-guess
        if (/^60/.test(c) || /^68/.test(c) || /^5/.test(c) || /^9/.test(c) || /^11/.test(c)) return `sh${c}`; // SH Stocks/Funds/Bonds
        if (/^00/.test(c) || /^30/.test(c) || /^1/.test(c) || /^2/.test(c) || /^4/.test(c)) return `sz${c}`; // SZ Stocks/Funds
        if (/^8/.test(c) || /^43/.test(c) || /^83/.test(c) || /^87/.test(c)) return `bj${c}`; // BJ Stocks (Tencent support?)
        if (/^\d{5}$/.test(c)) return `hk${c}`;
        if (/^[a-z]+$/.test(c)) return `us${c}`; // US stocks
        // Funds (Open-end): usually 6 digits but not starting with 60/00/30 necessarily?
        // Let's assume user might enter full code or we default to 'sh/sz' for ETFs.
        // For pure funds, Tencent uses 'f_' prefix? e.g. f_161725.
        // Let's try adding generic handling or just return as is if unsure
        return c; 
    });

    const url = `http://qt.gtimg.cn/q=${formattedCodes.join(',')}`;

    try {
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        const text = iconv.decode(res.data, 'gbk');
        
        const results = [];
        const lines = text.split(';');
        
        formattedCodes.forEach((code, idx) => {
            // Find line starting with v_code=
            const match = lines.find(l => l.includes(`v_${code}=`));
            if (match) {
                const dataStr = match.split('"')[1];
                if (dataStr) {
                    const parts = dataStr.split('~');
                    // Tencent Format:
                    // 0: Unknown?
                    // 1: Name
                    // 2: Code
                    // 3: Current Price
                    // 4: Last Close
                    // 5: Open
                    // 30: Time?
                    // 31: Change
                    // 32: Change%
                    // 33: High
                    // 34: Low
                    // ...
                    // Different for US/HK? 
                    // HK: Similar
                    // US: Similar
                    
                    results.push({
                        code: code,
                        name: parts[1],
                        price: parts[3],
                        change: parts[31],
                        changePercent: parts[32],
                        market_value: parts[45] || '-', // Market Cap often here
                        pe: parts[39] || '-' // PE often here
                    });
                } else {
                     results.push({ code, error: 'Data not found' });
                }
            } else {
                results.push({ code, error: 'Invalid code' });
            }
        });
        
        return results;

    } catch (e) {
        console.error('Watchlist Data Fetch Error:', e);
        return [];
    }
}

router.post('/analyze', async (req, res) => {
    const { codes } = req.body;
    
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
        return res.status(400).json({ error: 'No codes provided' });
    }

    if (codes.length > 5) {
        return res.status(400).json({ error: 'Max 5 codes allowed' });
    }

    try {
        // 1. Get Market Data
        const marketData = await fetchMarketData(codes);
        const validItems = marketData.filter(i => !i.error);

        if (validItems.length === 0) {
            return res.json({ items: marketData }); // Return errors
        }

        // 2. AI Analysis
        // Construct prompt
        const prompt = `
        我是投资助手。用户关注了以下 ${validItems.length} 只证券/基金，请进行全方位跟踪分析：
        
        ${validItems.map(item => 
            `- [${item.code}] ${item.name}: 现价${item.price}, 涨跌${item.changePercent}%, PE:${item.pe}, 市值:${item.market_value}`
        ).join('\n')}
        
        请输出JSON格式分析结果，格式如下：
        {
            "analysis_list": [
                {
                    "code": "对应代码",
                    "trend": "短期趋势判研(看多/看空/震荡)",
                    "suggestion": "操作建议(加仓/减仓/持有/观望)",
                    "reason": "简要理由(50字以内，结合基本面或技术面)"
                }
            ]
        }
        注意：必须返回纯JSON字符串，不要Markdown标记。
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a financial analyst. Output JSON only." },
                { role: "user", content: prompt }
            ],
            model: "deepseek-chat", // or appropriate model
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const aiText = completion.choices[0].message.content;
        let aiJson = {};
        try {
            aiJson = JSON.parse(aiText);
        } catch (e) {
            console.error("AI Parse Error:", e);
            // Fallback manual parse if needed, but JSON mode usually works
        }

        // 3. Merge Data
        const finalResults = validItems.map(item => {
            const analysis = aiJson.analysis_list?.find(a => 
                // Flexible match because code might have prefix difference in AI's mind?
                // AI usually returns what was prompted.
                a.code === item.code || a.code.includes(item.code) || item.code.includes(a.code)
            );
            return {
                ...item,
                analysis: analysis || { trend: '未知', suggestion: '观察', reason: 'AI分析暂时不可用' }
            };
        });

        res.json({ items: finalResults });

    } catch (error) {
        console.error('Watchlist Error:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});

module.exports = router;
