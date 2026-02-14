import React from 'react';
import { Activity, Search } from 'lucide-react';

const BottomNav = ({ active, onDiscover, onPortfolio }) => {
  const isPortfolio = active === 'portfolio';
  const isDiscover = active === 'discover';
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 text-xs text-gray-500">
      <button className={`flex flex-col items-center ${isPortfolio ? 'text-blue-600' : 'text-gray-500'}`} onClick={onPortfolio}>
        <Activity size={20} />
        <span className="mt-1">持仓</span>
      </button>
      <button className={`flex flex-col items-center ${isDiscover ? 'text-blue-600' : 'text-gray-500'}`} onClick={onDiscover}>
        <Search size={20} />
        <span className="mt-1">发现</span>
      </button>
    </nav>
  );
};

export default BottomNav;
