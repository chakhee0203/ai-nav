const express = require('express');
const router = express.Router();
const axios = require('axios');
const yahooFinance = require('yahoo-finance2').default;
const iconv = require('iconv-lite');
const { openai } = require('../config/ai');

// Helper: Fetch market data with Fallback (Yahoo -> Tencent -> Sina)
// Prioritize Yahoo Finance as requested, with batched requests
async function fetchMarketData(codes) {
    let errors = [];

    // 1. Try Yahoo Finance (Primary - Batched & Global)
    try {
        console.log('Fetching watchlist from Yahoo Finance (Primary)...');
        const results = await fetchYahoo(codes);
        if (results && results.length > 0) return results;
    } catch (e) {
        console.error('Watchlist Primary (Yahoo) Error:', e.message);
        errors.push(`Yahoo: ${e.message}`);
        if (e.message.includes('429')) {
             console.warn('Yahoo 429 Rate Limit Hit. Consider pausing requests.');
        }
    }

    // 2. Try Tencent (Secondary)
    try {
        console.log('Switching to Tencent fallback...');
        const results = await fetchTencent(codes);
        if (results && results.length > 0) return results;
    } catch (e) {
        console.error('Watchlist Secondary (Tencent) Error:', e.message);
        errors.push(`Tencent: ${e.message}`);
    }

    // 3. Try Sina (Final Fallback)
    try {
        console.log('Switching to Sina Finance fallback...');
        const results = await fetchSina(codes);
        if (results && results.length > 0) return results;
    } catch (e) {
        console.error('Watchlist Fallback (Sina) Error:', e.message);
        errors.push(`Sina: ${e.message}`);
    }

    // If all fail, don't crash, just return empty with error details logged
    console.error('All watchlist data sources failed:', errors.join('; '));
    return []; // Return empty array to prevent crash
}

async function fetchTencent(codes) {
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

    const res = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = iconv.decode(res.data, 'gbk');
    
    const results = [];
    const lines = text.split(';');
    
    formattedCodes.forEach((code, idx) => {
        const match = lines.find(l => l.includes(`v_${code}=`));
        if (match) {
            const dataStr = match.split('"')[1];
            if (dataStr) {
                const parts = dataStr.split('~');
                if (parts.length > 30) {
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

    if (results.length > 0) return results;
    throw new Error('No valid data returned');
}

async function fetchSina(codes) {
    // Map codes to Sina format
    // A-share: sh600000, sz000001
    // HK: rt_hk00700
    // US: gb_aapl (lower case)
    const sinaMap = {};
    const formattedCodes = codes.map(c => {
        c = c.toLowerCase().trim();
        const raw = c.replace(/^(sh|sz|hk|us|bj)/, '');
        let sinaCode = c;
        
        if (c.startsWith('sh') || /^60|^68|^5|^9|^11/.test(raw)) sinaCode = `sh${raw}`;
        else if (c.startsWith('sz') || /^00|^30|^1|^2|^4/.test(raw)) sinaCode = `sz${raw}`;
        else if (c.startsWith('hk') || /^\d{5}$/.test(raw)) sinaCode = `rt_hk${raw}`;
        else if (c.startsWith('us') || /^[a-z]+$/.test(raw)) sinaCode = `gb_${raw}`;
        
        sinaMap[sinaCode] = c; // Map back to original input logic if needed
        return sinaCode;
    });

    const url = `http://hq.sinajs.cn/list=${formattedCodes.join(',')}`;

    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000,
        headers: { 'Referer': 'https://finance.sina.com.cn/' }
    });
    const text = iconv.decode(res.data, 'gbk');
    const lines = text.split('\n');
    const results = [];

    lines.forEach(line => {
        if (!line.includes('="')) return;
        const [keyPart, dataPart] = line.split('="');
        const codeMatch = keyPart.match(/hq_str_(.+)/);
        if (!codeMatch) return;
        
        const sinaCode = codeMatch[1];
        const data = dataPart.replace('";', '').split(',');
        
        if (data.length < 5) return; // Invalid data

        let item = null;
        
        // Parse based on market type
        if (sinaCode.startsWith('sh') || sinaCode.startsWith('sz')) {
            // A-share: name(0), open(1), prevClose(2), price(3)
            const price = parseFloat(data[3]);
            const prevClose = parseFloat(data[2]);
            if (price > 0 && prevClose > 0) {
                const change = (price - prevClose).toFixed(2);
                const changePercent = ((change / prevClose) * 100).toFixed(2);
                item = {
                    code: sinaCode,
                    name: data[0],
                    price: data[3],
                    change: change,
                    changePercent: changePercent,
                    market_value: '-', // Sina simple API might not have MV
                    pe: '-'
                };
            }
        } else if (sinaCode.startsWith('rt_hk')) {
            // HK: engName(0), name(1), open(2), prevClose(3), high(4), low(5), price(6), change(7), pct(8)
            item = {
                code: sinaCode.replace('rt_', ''), // display as hk...
                name: data[1],
                price: data[6],
                change: data[7],
                changePercent: data[8],
                market_value: '-',
                pe: '-'
            };
        } else if (sinaCode.startsWith('gb_')) {
            // US: name(0), price(1), change(2), time(3) -> Change is amount? Or pct?
            // Usually data[2] is change percent in Sina US API?
            // Let's check typical response: "Apple Inc,135.37,2.44,..."
            // It is risky. Let's try.
            item = {
                code: sinaCode.replace('gb_', 'us'),
                name: data[0],
                price: data[1],
                change: '-', // specific change amount not always clear
                changePercent: data[2],
                market_value: '-',
                pe: '-'
            };
        }

        if (item) results.push(item);
    });

    if (results.length > 0) return results;
    throw new Error('No valid data returned');
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
