import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

const PortfolioPanel = ({
  portfolio,
  maxDisplay,
  refreshQuotes,
  refreshLoading,
  setWeight,
  setEntryPrice,
  sinceEntryPct,
  dailyChangePct,
  handleAnalyze,
  analysisLoading,
  analysisByCode,
  analysisError,
  removeCode,
  totalWeight,
  newCode,
  setNewCode,
  addCode,
  newQuoteLoading,
  newQuote,
  newQuoteError,
  portfolioSinceEntry,
  portfolioDailyEstimate,
  error,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="text-sm font-semibold text-slate-900">组合概览</div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">累计收益</div>
            <div className={`mt-2 text-lg font-semibold ${Number(portfolioSinceEntry()) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {portfolioSinceEntry() === null ? '—' : `${portfolioSinceEntry().toFixed(2)}%`}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">当日收益率（估）</div>
            <div className={`mt-2 text-lg font-semibold ${Number(portfolioDailyEstimate()) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {portfolioDailyEstimate() === null ? '—' : `${portfolioDailyEstimate().toFixed(2)}%`}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900">持仓关注</div>
              <div className="text-xs text-slate-500 mt-1">最多显示 {maxDisplay} 项</div>
            </div>
            <button
              onClick={refreshQuotes}
              disabled={refreshLoading}
              className={`text-xs px-3 py-1.5 rounded-lg border ${refreshLoading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              {refreshLoading ? '刷新中...' : '刷新行情'}
            </button>
          </div>
          <div className="p-4">
            {portfolio.length === 0 ? (
              <div className="text-slate-500 text-center py-10">当前暂无持仓，请添加代码。</div>
            ) : (
              <ul className="space-y-3">
                {portfolio.slice(0, maxDisplay).map((item) => (
                  <li key={item.code} className="border border-slate-200 rounded-lg p-4 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{item.code}</span>
                        <span className="text-xs text-slate-500">占比</span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={item.weight ?? ''}
                          onChange={(e) => setWeight(item.code, e.target.value)}
                          className="w-20 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                        <span>成本价</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.entryPrice ?? ''}
                          onChange={(e) => setEntryPrice(item.code, e.target.value)}
                          className="w-24 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-slate-400">{item.currency}</span>
                      </div>
                      <div className="text-xs mt-2">
                        {Number.isFinite(sinceEntryPct(item.code)) ? (
                          <span className={`mr-3 font-semibold ${sinceEntryPct(item.code) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            累计收益 {sinceEntryPct(item.code).toFixed(2)}%
                          </span>
                        ) : null}
                        {Number.isFinite(dailyChangePct(item.code)) ? (
                          <span className={`font-semibold ${dailyChangePct(item.code) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            当日 {dailyChangePct(item.code).toFixed(2)}%
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => handleAnalyze(item.code)}
                          disabled={analysisLoading[item.code]}
                          className={`text-xs px-3 py-1.5 rounded-lg border ${
                            analysisLoading[item.code] ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {analysisLoading[item.code] ? '分析中...' : (analysisByCode[item.code] ? '查看分析' : '立即分析')}
                        </button>
                        {analysisError[item.code] ? (
                          <span className="text-xs text-red-600">{analysisError[item.code]}</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={() => removeCode(item.code)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-5 py-3 border-t border-slate-200 text-xs">
            <span className="text-slate-600">占比合计：</span>
            <span className={`font-semibold ${Math.round(totalWeight()) === 100 ? 'text-red-600' : 'text-yellow-600'}`}>
              {totalWeight().toFixed(1)}%
            </span>
            {Math.round(totalWeight()) !== 100 ? <span className="ml-2 text-slate-500">建议合计为 100%</span> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="text-sm font-semibold text-slate-900">管理持仓</div>
            <div className="text-xs text-slate-500 mt-1">添加代码并同步最新价格</div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="输入股票/基金代码（如：AAPL）"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && addCode()}
              />
              <button
                onClick={addCode}
                className="bg-blue-600 text-white px-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
            {newCode ? (
              <div className="mt-3 text-xs text-slate-600">
                {newQuoteLoading ? '正在获取当前价格...' : newQuote ? (
                  <span>
                    当前价：<span className="font-mono font-semibold">{newQuote.price}</span> {newQuote.currency}，
                    当日：<span className={`${Number(newQuote.changePct) >= 0 ? 'text-red-600' : 'text-green-600'} font-semibold`}>
                      {Math.abs(Number(newQuote.changePct || 0)).toFixed(2)}%
                    </span>
                  </span>
                ) : newQuoteError ? newQuoteError : '请输入代码以获取当前价'}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PortfolioPanel;
