import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Code } from 'lucide-react';

const JsonNode = ({ name, value, isLast }) => {
  const [expanded, setExpanded] = useState(true);
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const isEmpty = isObject && Object.keys(value).length === 0;

  const toggle = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const renderValue = (val) => {
    if (val === null) return <span className="text-gray-400">null</span>;
    if (typeof val === 'boolean') return <span className="text-purple-600">{String(val)}</span>;
    if (typeof val === 'number') return <span className="text-blue-600">{val}</span>;
    if (typeof val === 'string') return <span className="text-green-600">"{val}"</span>;
    return <span>{String(val)}</span>;
  };

  if (!isObject) {
    return (
      <div className="font-mono text-sm leading-6 hover:bg-slate-100 px-1 rounded">
        {name && <span className="text-purple-800 font-semibold">"{name}": </span>}
        {renderValue(value)}
        {!isLast && ","}
      </div>
    );
  }

  return (
    <div className="font-mono text-sm leading-6">
      <div className="flex items-start hover:bg-slate-100 px-1 rounded">
        <span 
          onClick={!isEmpty ? toggle : undefined} 
          className={`cursor-pointer mr-1 select-none text-slate-400 hover:text-slate-600 w-4 inline-block text-center ${isEmpty ? 'invisible' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </span>
        <div>
          {name && <span className="text-purple-800 font-semibold">"{name}": </span>}
          <span>{isArray ? '[' : '{'}</span>
          {!expanded && <span onClick={toggle} className="text-slate-400 cursor-pointer select-none mx-1">
            {isArray ? `Array[${Object.keys(value).length}]` : `Object{${Object.keys(value).length}}`}
          </span>}
          {!expanded && <span>{isArray ? ']' : '}'}{!isLast && ","}</span>}
        </div>
      </div>
      
      {expanded && !isEmpty && (
        <div className="pl-6 border-l border-slate-200 ml-2">
          {Object.entries(value).map(([key, val], idx, arr) => (
            <JsonNode 
              key={key} 
              name={isArray ? null : key} 
              value={val} 
              isLast={idx === arr.length - 1} 
            />
          ))}
        </div>
      )}
      
      {expanded && (
        <div className="pl-6 ml-2">
          <span>{isArray ? ']' : '}'}{!isLast && ","}</span>
        </div>
      )}
    </div>
  );
};

const JsonEditor = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  const textAreaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  useEffect(() => {
    if (!input.trim()) {
      setParsed(null);
      setError(null);
      return;
    }
    try {
      const json = JSON.parse(input);
      setParsed(json);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [input]);

  const handleFormat = () => {
    try {
      const json = JSON.parse(input);
      setInput(JSON.stringify(json, null, 2));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMinify = () => {
    try {
      const json = JSON.parse(input);
      setInput(JSON.stringify(json));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleScroll = () => {
    if (textAreaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textAreaRef.current.scrollTop;
    }
  };

  const lineCount = input.split('\n').length;
  const lineNumbersContent = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

  return (
    <div className="h-[calc(100vh-70px)] p-4 flex flex-col box-border">
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col overflow-hidden">
        <div className="flex justify-between items-start mb-4 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-600" />
              {t('json_editor_title')}
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              {t('json_editor_desc')}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleFormat} className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors">{t('json_format')}</button>
            <button onClick={handleMinify} className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors">{t('json_minify')}</button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 flex border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent min-h-0">
               <div 
                 ref={lineNumbersRef}
                 className="bg-slate-50 text-slate-400 text-xs font-mono py-4 px-2 text-right select-none border-r border-slate-200 overflow-hidden whitespace-pre"
                 style={{ minWidth: '3rem', lineHeight: '1.5rem' }}
               >
                 {lineNumbersContent}
               </div>
               <textarea
                 ref={textAreaRef}
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onScroll={handleScroll}
                 className="flex-1 w-full p-4 border-none outline-none font-mono text-xs resize-none whitespace-pre overflow-auto"
                 style={{ lineHeight: '1.5rem' }}
                 placeholder='{"key": "value"}'
                 spellCheck="false"
               />
            </div>
            {error && <div className="mt-2 text-red-500 text-xs bg-red-50 p-2 rounded border border-red-100 shrink-0">{error}</div>}
          </div>
          
          <div className="h-full border border-slate-300 rounded-lg bg-slate-50 overflow-auto p-4 min-h-0">
             {parsed ? (
               <JsonNode value={parsed} isLast={true} />
             ) : (
               <div className="text-slate-400 text-sm text-center mt-10">
                 {error ? <span className="text-red-400">{error}</span> : t('result_placeholder')}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JsonEditor;
