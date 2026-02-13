const axios = require('axios');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function normalizeSymbol(symbol) {
  const s = String(symbol).trim().toUpperCase();
  const mPref = s.match(/^(S[HZ])(\d{6})$/);
  if (mPref) {
    const digits = mPref[2];
    if (digits.startsWith('6') || digits.startsWith('9') || digits.startsWith('5')) return `${digits}.SS`;
    return `${digits}.SZ`;
  }
  if (/^\d{6}$/.test(s)) {
    if (s.startsWith('6') || s.startsWith('9') || s.startsWith('5')) return `${s}.SS`;
    return `${s}.SZ`;
  }
  return s;
}

function extractCnCode(symbol) {
  const s = String(symbol).trim().toUpperCase();
  const m = s.match(/(\d{6})/);
  return m ? m[1] : null;
}

async function fetchFinancialsEastmoney(code) {
  if (!code) return null;
  const filter = `(SECURITY_CODE="${code}")`;
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_LICO_FN_CPD&columns=SECURITY_CODE,REPORTDATE,TOTAL_OPERATE_INCOME,PARENT_NETPROFIT&filter=${encodeURIComponent(
    filter
  )}&pageSize=1&pageNumber=1&sortColumns=REPORTDATE&sortTypes=-1`;
  try {
    const { data } = await axios.get(url, { headers: { 'User-Agent': UA, 'Referer': 'https://data.eastmoney.com' } });
    const item = data?.result?.data?.[0];
    if (!item) return null;
    const revenue = Number(item.TOTAL_OPERATE_INCOME);
    const netIncome = Number(item.PARENT_NETPROFIT);
    return {
      revenue: Number.isFinite(revenue) ? revenue : null,
      netIncome: Number.isFinite(netIncome) ? netIncome : null,
      currency: 'CNY',
    };
  } catch {
    return null;
  }
}

async function fetchFinancials(symbol) {
  const cnCode = extractCnCode(symbol);
  if (cnCode) {
    const em = await fetchFinancialsEastmoney(cnCode);
    if (em) return em;
  }
  const sym = normalizeSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=financialData,incomeStatementHistory`;
  try {
    const { data } = await axios.get(url, { headers: { 'User-Agent': UA } });
    const result = data?.quoteSummary?.result?.[0] || {};
    const fd = result.financialData || {};
    const ish = result.incomeStatementHistory?.incomeStatementHistory || [];
    const latest = ish[0] || {};
    const revenue = latest.totalRevenue?.raw ?? fd.totalRevenue?.raw ?? null;
    const netIncome = latest.netIncome?.raw ?? fd.netIncome?.raw ?? null;
    return {
      revenue: Number.isFinite(revenue) ? revenue : null,
      netIncome: Number.isFinite(netIncome) ? netIncome : null,
      currency: fd.financialCurrency || null,
    };
  } catch {
    return { revenue: null, netIncome: null, currency: null };
  }
}

module.exports = { fetchFinancials };
