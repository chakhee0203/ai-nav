const axios = require('axios');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function normalizeSymbol(symbol) {
  const s = String(symbol).trim().toUpperCase();
  const mPref = s.match(/^(S[HZ])(\d{6})$/);
  if (mPref) {
    const digits = mPref[2];
    if (digits.startsWith('6') || digits.startsWith('9')) return `${digits}.SS`;
    return `${digits}.SZ`;
  }
  if (/^\d{6}$/.test(s)) {
    if (s.startsWith('6') || s.startsWith('9')) return `${s}.SS`;
    return `${s}.SZ`;
  }
  return s;
}

async function fetchFinancials(symbol) {
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
