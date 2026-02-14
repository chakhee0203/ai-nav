import React from 'react';

const AnalysisDrawer = ({
  drawerOpen,
  closeDrawer,
  drawerCode,
  analyzeOne,
  analysisLoading,
  analysisError,
  analysisByCode,
}) => {
  if (!drawerOpen) return null;
  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50 animate-[fadeInOverlay_220ms_ease-out]" onClick={closeDrawer}></div>
      <div
        className="absolute right-0 top-0 h-full w-full sm:w-[460px] bg-white shadow-2xl flex flex-col animate-[slideIn_260ms_cubic-bezier(0.2,0.8,0.2,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">分析详情</div>
            <div className="text-base font-semibold text-slate-900">{drawerCode || '—'}</div>
          </div>
          <div className="flex items-center gap-2">
            {drawerCode ? (
              <button
                onClick={() => analyzeOne(drawerCode)}
                disabled={analysisLoading[drawerCode]}
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  analysisLoading[drawerCode] ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                }`}
              >
                {analysisLoading[drawerCode] ? '分析中...' : '重新分析'}
              </button>
            ) : null}
            <button
              onClick={closeDrawer}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              关闭
            </button>
          </div>
        </div>
        <div className="p-5 overflow-auto flex-1 text-sm text-slate-700">
          {drawerCode && analysisLoading[drawerCode] ? (
            <div className="text-slate-600">正在获取最新分析…</div>
          ) : drawerCode && analysisError[drawerCode] ? (
            <div className="text-red-600">{analysisError[drawerCode]}</div>
          ) : drawerCode && analysisByCode[drawerCode] ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500">分析摘要</div>
                <div className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-800">
                  {analysisByCode[drawerCode]?.analysis || '暂无内容'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500">最新财报</div>
                  <div className="mt-2 text-sm text-slate-800 space-y-1">
                    <div>营收：{analysisByCode[drawerCode]?.financials?.revenue ?? '未知'}</div>
                    <div>净利：{analysisByCode[drawerCode]?.financials?.netIncome ?? '未知'}</div>
                    <div>币种：{analysisByCode[drawerCode]?.financials?.currency ?? '未知'}</div>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500">走势概览</div>
                  <div className="mt-2 text-sm text-slate-800 space-y-1">
                    <div>现价：{analysisByCode[drawerCode]?.quote?.price ?? '未知'} {analysisByCode[drawerCode]?.quote?.currency ?? ''}</div>
                    <div>20日收益：{analysisByCode[drawerCode]?.trend?.ret20 != null ? `${(analysisByCode[drawerCode].trend.ret20 * 100).toFixed(2)}%` : '未知'}</div>
                  </div>
                </div>
              </div>
              {(analysisByCode[drawerCode]?.newsByTopic?.policy?.length || analysisByCode[drawerCode]?.newsByTopic?.industry?.length || analysisByCode[drawerCode]?.newsByTopic?.finance?.length || analysisByCode[drawerCode]?.news?.length) ? (
                <div className="border border-slate-200 rounded-lg">
                  <div className="px-4 py-3 border-b border-slate-200 text-xs text-slate-500">新闻与事件</div>
                  <div className="p-4 space-y-4">
                    {analysisByCode[drawerCode]?.newsByTopic?.policy?.length ? (
                      <div>
                        <div className="text-xs font-semibold text-slate-700">政策新闻</div>
                        <ul className="mt-2 space-y-1.5">
                          {analysisByCode[drawerCode].newsByTopic.policy.slice(0, 5).map((n, idx) => (
                            <li key={`policy-${idx}`} className="leading-snug text-sm">
                              <a href={n.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                                {n.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {analysisByCode[drawerCode]?.newsByTopic?.industry?.length ? (
                      <div>
                        <div className="text-xs font-semibold text-slate-700">行业新闻</div>
                        <ul className="mt-2 space-y-1.5">
                          {analysisByCode[drawerCode].newsByTopic.industry.slice(0, 5).map((n, idx) => (
                            <li key={`industry-${idx}`} className="leading-snug text-sm">
                              <a href={n.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                                {n.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {analysisByCode[drawerCode]?.newsByTopic?.finance?.length ? (
                      <div>
                        <div className="text-xs font-semibold text-slate-700">财报新闻</div>
                        <ul className="mt-2 space-y-1.5">
                          {analysisByCode[drawerCode].newsByTopic.finance.slice(0, 5).map((n, idx) => (
                            <li key={`finance-${idx}`} className="leading-snug text-sm">
                              <a href={n.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                                {n.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {analysisByCode[drawerCode]?.news?.length ? (
                      <div>
                        <div className="text-xs font-semibold text-slate-700">公司相关新闻</div>
                        <ul className="mt-2 space-y-1.5">
                          {analysisByCode[drawerCode].news.slice(0, 5).map((n, idx) => (
                            <li key={`company-${idx}`} className="leading-snug text-sm">
                              <a href={n.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                                {n.title}
                              </a>
                              {n.topic ? <span className="ml-1 text-slate-400">（{n.topic}）</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-slate-600">暂无分析数据</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisDrawer;
