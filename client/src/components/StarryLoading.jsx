import React, { useEffect, useState } from 'react';

const StarryLoading = () => {
  const [step, setStep] = useState(0);
  
  const steps = [
    "Initializing neural network...",
    "Parsing semantic context...",
    "Retrieving knowledge graph...",
    "Synthesizing optimal results..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-96 flex flex-col items-center justify-center relative overflow-hidden bg-white/50 rounded-2xl border border-slate-100">
      {/* 科技感网格背景 - 极其微妙 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] mask-image-gradient"></div>

      <div className="relative z-10 flex flex-col items-center">
        {/* 核心动画容器 */}
        <div className="relative w-32 h-32 mb-10 flex items-center justify-center">
            {/* 外部光晕场 - 模拟量子场 */}
            <div className="absolute w-full h-full bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl animate-pulse-slow"></div>
            
            {/* 旋转的细线条轨道 - 模拟电子轨道 */}
            <svg className="absolute w-24 h-24 animate-spin-slow opacity-60" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="none" stroke="url(#grad1)" strokeWidth="0.5" />
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
                  <stop offset="50%" stopColor="#6366f1" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            
            <svg className="absolute w-16 h-16 animate-spin-reverse-slow opacity-60" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="none" stroke="url(#grad2)" strokeWidth="0.5" />
              <defs>
                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
                  <stop offset="50%" stopColor="#a855f7" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* 核心 - 呼吸的奇点 */}
            <div className="relative flex items-center justify-center">
                <div className="w-3 h-3 bg-slate-900 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] animate-ping-slow"></div>
                <div className="absolute w-2 h-2 bg-white rounded-full"></div>
            </div>
        </div>

        {/* 极简文字信息 */}
        <div className="flex flex-col items-center space-y-3">
            {/* 状态指示器 */}
            <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100/50 rounded-full border border-slate-200/50 backdrop-blur-sm">
                <div className="flex space-x-1">
                    <span className="w-1 h-3 bg-indigo-500 rounded-full animate-wave-1"></span>
                    <span className="w-1 h-3 bg-indigo-500 rounded-full animate-wave-2"></span>
                    <span className="w-1 h-3 bg-indigo-500 rounded-full animate-wave-3"></span>
                </div>
                <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">AI Processing</span>
            </div>
            
            {/* 动态步骤文字 */}
            <div className="h-8 flex items-center overflow-hidden">
                <p className="text-slate-700 text-sm font-medium tracking-wide animate-fade-slide-up key-{step}">
                   {steps[step]}
                </p>
            </div>
        </div>
      </div>

      <style jsx>{`
        .animate-pulse-slow {
            animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-spin-slow {
            animation: spin 8s linear infinite;
        }
        .animate-spin-reverse-slow {
            animation: spin 12s linear infinite reverse;
        }
        .animate-ping-slow {
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes wave {
            0%, 100% { height: 6px; opacity: 0.5; }
            50% { height: 12px; opacity: 1; }
        }
        .animate-wave-1 { animation: wave 1s ease-in-out infinite; animation-delay: 0s; }
        .animate-wave-2 { animation: wave 1s ease-in-out infinite; animation-delay: 0.2s; }
        .animate-wave-3 { animation: wave 1s ease-in-out infinite; animation-delay: 0.4s; }

        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-slide-up {
            animation: fadeSlideUp 0.5s ease-out forwards;
        }
        .mask-image-gradient {
            mask-image: radial-gradient(circle at center, black, transparent 80%);
        }
      `}</style>
    </div>
  );
};

export default StarryLoading;
