const express = require('express');
const router = express.Router();
const axios = require('axios');
const yahooFinance = require('yahoo-finance2').default;
const iconv = require('iconv-lite');
const { openai } = require('../config/ai');

// Helper: Fetch market data (Yahoo Finance Only)
async function fetchMarketData(codes) {
    try {
        console.log('Fetching watchlist from Yahoo Finance...');
        const results = await fetchYahoo(codes);
        return results || [];
    } catch (e) {
        console.error('Watchlist Error (Yahoo):', e.message);
        if (e.message.includes('429')) {
             console.warn('Yahoo 429 Rate Limit Hit.');
        }
        return [];
    }
}



async function fetchYahoo(codes) {
    // Map codes to Yahoo symbols
    // sh600000 -> 600000.SS
    // sz000001 -> 000001.SZ
    // hk00700 -> 0700.HK
    // usAAPL -> AAPL
    const yahooSymbols = codes.map(c => {
        c = c.toLowerCase().trim();
        // Remove prefixes if present to re-add correctly
        const raw = c.replace(/^(sh|sz|hk|us|bj)/, '');
        
        // Heuristic
        if (c.startsWith('sh') || /^60|^68|^5|^9|^11/.test(raw)) return `${raw}.SS`;
        if (c.startsWith('sz') || /^00|^30|^1|^2|^4/.test(raw)) return `${raw}.SZ`;
        if (c.startsWith('hk') || /^\d{5}$/.test(raw)) {
            // Robust HK mapping: Remove non-digits, parse int, pad to 4 digits
            const numStr = raw.replace(/\D/g, '');
            const num = parseInt(numStr, 10);
            if (!isNaN(num)) {
                return `${num.toString().padStart(4, '0')}.HK`;
            }
            return `${raw}.HK`; // Fallback
        }
        if (c.startsWith('us') || /^[a-z]+$/.test(raw)) return raw.toUpperCase();
        
        return raw; // Hope for the best
    });

    try {
        const results = await yahooFinance.quote(yahooSymbols);

        if (results && Array.isArray(results) && results.length > 0) {
            return results.map(r => {
                return {
                    code: r.symbol, // Use symbol as code
                    name: r.shortName || r.longName || r.symbol,
                    price: r.regularMarketPrice,
                    change: r.regularMarketChange,
                    changePercent: r.regularMarketChangePercent,
                    market_value: r.marketCap || '-',
                    pe: r.trailingPE || '-'
                };
            });
        } else if (results && !Array.isArray(results)) {
            // Handle single result case if library returns object for single symbol
             const r = results;
             return [{
                    code: r.symbol,
                    name: r.shortName || r.longName || r.symbol,
                    price: r.regularMarketPrice,
                    change: r.regularMarketChange,
                    changePercent: r.regularMarketChangePercent,
                    market_value: r.marketCap || '-',
                    pe: r.trailingPE || '-'
             }];
        }
        return [];
    } catch (ey) {
        console.error('Yahoo Watchlist Fallback Error:', ey.message);
        // If 401/404, we just return empty so it falls back to Tencent
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
