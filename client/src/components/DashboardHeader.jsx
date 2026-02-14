import React from 'react';
import { Activity } from 'lucide-react';

const DashboardHeader = () => {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Activity size={22} />
          投资组合管理
        </h1>
        <div className="text-xs text-blue-100">专业版持仓看板</div>
      </div>
    </header>
  );
};

export default DashboardHeader;
