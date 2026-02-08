const express = require('express');
const router = express.Router();
const axios = require('axios');
const yahooFinance = require('yahoo-finance2').default;
const iconv = require('iconv-lite');
const { openai } = require('../config/ai');

// Helper: Fetch market data with Fallback
async function fetchMarketData(codes) {
    // 1. Try Tencent (Primary)
    // Construct query
    const formattedCodes = codes.map(c => {
        c = c.toLowerCase().trim();
        if (/^(sh|sz|hk|us)/.test(c)) return c;
        if (/^60/.test(c) || /^68/.test(c) || /^5/.test(c) || /^9/.test(c) || /^11/.test(c)) return `sh${c}`;
        if (/^00/.test(c) || /^30/.test(c) || /^1/.test(c) || /^2/.test(c) || /^4/.test(c)) return `sz${c}`;
        if (/^8/.test(c) || /^43/.test(c) || /^83/.test(c) || /^87/.test(c)) return `bj${c}`;
        if (/^\d{5}$/.test(c)) return `hk${c}`;
        if (/^[a-z]+$/.test(c)) return `us${c}`;
        return c;
    });

    const url = `http://qt.gtimg.cn/q=${formattedCodes.join(',')}`;

    try {
        const res = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const text = iconv.decode(res.data, 'gbk');
        
        const results = [];
        const lines = text.split(';');
        
        // Check if we got valid data for at least one code
        let hasValidData = false;

        formattedCodes.forEach((code, idx) => {
            const match = lines.find(l => l.includes(`v_${code}=`));
            if (match) {
                const dataStr = match.split('"')[1];
                if (dataStr) {
                    const parts = dataStr.split('~');
                    if (parts.length > 30) {
                        hasValidData = true;
                        results.push({
                            code: code,
                            name: parts[1],
                            price: parts[3],
                            change: parts[31],
                            changePercent: parts[32],
                            market_value: parts[45] || '-',
                            pe: parts[39] || '-'
                        });
                    }
                }
            }
        });

        if (hasValidData) return results;
        // If no valid data, throw to trigger fallback
        throw new Error('No valid data from Tencent');

    } catch (e) {
        console.error('Watchlist Primary (Tencent) Error:', e.message);
        
        // 2. Fallback: Yahoo Finance
        console.log('Switching to Yahoo Finance fallback for watchlist...');
        return await fetchYahooFallback(codes);
    }
}

async function fetchYahooFallback(codes) {
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
            // Yahoo uses 4 digits usually? No, 0700.HK. But user might input 00700.
            // Let's try to keep as is, but remove leading zero if length > 4?
            // Actually Yahoo HK symbols are like 0700.HK (4 digits) or 0005.HK.
            // Let's assume input is 5 digits like 00700 -> 0700.HK? 
            // Or just try raw.HK.
            return `${raw.replace(/^0/, '')}.HK`; 
        }
        if (c.startsWith('us') || /^[a-z]+$/.test(raw)) return raw.toUpperCase();
        
        return raw; // Hope for the best
    });

    try {
        const results = await yahooFinance.quote(yahooSymbols);

        if (results && results.length > 0) {
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
        }
        return [];
    } catch (ey) {
        console.error('Yahoo Watchlist Fallback Error:', ey.message);
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
