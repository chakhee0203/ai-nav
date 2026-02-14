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
  onFetch,
}) => {
  const formatDate = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };
  const activeTitle = tabs.find(t => t.key === activeTab)?.title || '';
  const isPolicy = activeTab === 'policy';
  const shouldPromptFetch = !discoverLoading && !discoverError && !discoverUpdatedAt;
  const heatColors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500', 'bg-pink-500'];
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">发现 · 资讯模块</div>
            <div className="text-xs text-slate-500 mt-1">每个模块点击获取后可在右上角更新</div>
          </div>
          {discoverUpdatedAt ? (
            <button
              onClick={onFetch}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              更新
            </button>
          ) : null}
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
        ) : shouldPromptFetch ? (
          <div className="py-10 flex flex-col items-center gap-3 text-sm text-slate-500">
            <div>{activeTitle ? `当前未获取${activeTitle}` : '当前未获取内容'}</div>
            <button
              onClick={onFetch}
              className="text-xs px-4 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              点击获取
            </button>
          </div>
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
            ) : activeTab === 'hot' ? (
              <div className="space-y-4">
                <div className="text-xs text-slate-500">热度越高，点越大</div>
                <div className="flex flex-wrap gap-4">
                  {discoverItems.map((rn, i) => {
                    const size = Math.max(14, 44 - i * 1.4);
                    const color = heatColors[i % heatColors.length];
                    return (
                      <a
                        key={i}
                        href={rn.link}
                        target="_blank"
                        rel="noreferrer"
                        className="w-20 flex flex-col items-center gap-2 group"
                      >
                        <div
                          className={`${color} rounded-full shadow-sm`}
                          style={{ width: size, height: size, opacity: 0.9 }}
                        />
                        <div className="text-[11px] text-slate-600 text-center break-words">
                          {rn.title}
                        </div>
                      </a>
                    );
                  })}
                  {!discoverItems.length && <div className="text-sm text-slate-500">暂无结果</div>}
                </div>
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
