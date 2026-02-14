import React from 'react';

const DiscoverPanel = ({
  discoverLoading,
  discoverItems,
  discoverPolicyCategories,
  discoverError,
  discoverUpdatedAt,
  tabs,
  activeTab,
  onTabChange,
}) => {
  const formatDate = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };
  const activeTitle = tabs.find(t => t.key === activeTab)?.title || '';
  const isPolicy = activeTab === 'policy';
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200">
        <div>
          <div className="text-base font-semibold text-slate-900">发现 · 资讯模块</div>
          <div className="text-xs text-slate-500 mt-1">点击模块获取最新政策、大事件与热点</div>
        </div>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${activeTab === tab.key ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 border-slate-200 hover:border-slate-300'}`}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {discoverLoading ? (
          <div className="text-sm text-slate-600">{activeTitle ? `正在获取${activeTitle}…` : '正在获取最新信息…'}</div>
        ) : discoverError ? (
          <div className="text-sm text-red-600">{discoverError}</div>
        ) : (
          <div className="space-y-3">
            {discoverUpdatedAt && (
              <div className="text-xs text-slate-400">更新时间：{formatDate(discoverUpdatedAt)}</div>
            )}
            {isPolicy ? (
              <div className="space-y-4">
                {discoverPolicyCategories.map((category) => (
                  <div key={category.key} className="border border-slate-200 rounded-lg p-4">
                    <div className="text-sm font-semibold text-slate-900">{category.title}</div>
                    <div className="text-xs text-slate-500 mt-1">要点：{category.summary || '暂无'}</div>
                    <ul className="mt-3 space-y-2">
                      {category.items.map((rn, i) => (
                        <li key={i} className="text-sm">
                          <a href={rn.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                            {rn.title}
                          </a>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {rn.source ? `来源：${rn.source}` : ''}{formatDate(rn.pubDate) ? ` · ${formatDate(rn.pubDate)}` : ''}{rn.query ? ` · ${rn.query}` : ''}
                          </div>
                        </li>
                      ))}
                      {!category.items.length && <li className="text-sm text-slate-500">暂无结果</li>}
                    </ul>
                  </div>
                ))}
                {!discoverPolicyCategories.length && <div className="text-sm text-slate-500">暂无结果</div>}
              </div>
            ) : (
              <ul className="space-y-2">
                {discoverItems.map((rn, i) => (
                  <li key={i} className="text-sm">
                    <a href={rn.link} target="_blank" rel="noreferrer" className="hover:text-blue-600">
                      {rn.title}
                    </a>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {rn.source ? `来源：${rn.source}` : ''}{formatDate(rn.pubDate) ? ` · ${formatDate(rn.pubDate)}` : ''}{rn.query ? ` · ${rn.query}` : ''}
                    </div>
                  </li>
                ))}
                {!discoverItems.length && <li className="text-sm text-slate-500">暂无结果</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverPanel;
