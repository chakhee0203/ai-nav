import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Wrench, Zap, Image as ImageIcon, 
  ArrowRight, Copy, Download, Upload, RefreshCw, Check,
  Scan, FileText, Layers, Scissors, Sheet, FileSpreadsheet
} from 'lucide-react';
import axios from 'axios';

// --- Sub-components for each tool ---

const ExcelTools = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('pdf-to-excel');
  const [files, setFiles] = useState([]);
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pages, setPages] = useState('');

  const tabs = [
    { id: 'pdf-to-excel', label: t('excel_tab_pdf_to_excel') },
    { id: 'to-pdf', label: t('excel_tab_to_pdf') },
    { id: 'to-json', label: t('excel_tab_to_json') },
    { id: 'json-to-excel', label: t('excel_tab_json_to_excel') }
  ];

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Validate file type based on tab
    const valid = selectedFiles.every(file => {
      if (activeTab === 'pdf-to-excel') return file.type === 'application/pdf';
      if (activeTab === 'json-to-excel') return file.type === 'application/json' || file.name.endsWith('.json');
      return file.type.includes('excel') || file.type.includes('spreadsheet') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx');
    });

    if (!valid) {
      setError(t('invalid_file_type'));
      return;
    }

    // Convert to base64
    Promise.all(selectedFiles.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
    })).then(base64Files => {
      setFiles(base64Files);
      setError(null);
      setResult(null);
    });
  };

  const handleProcess = async () => {
    if (activeTab !== 'json-to-excel' && files.length === 0) return;
    if (activeTab === 'json-to-excel' && !jsonText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let endpoint = '';
      let payload = {};

      if (activeTab === 'pdf-to-excel') {
        endpoint = '/api/excel/pdf-to-excel';
        payload = { file: files[0], pages };
      } else if (activeTab === 'to-pdf') {
        endpoint = '/api/excel/to-pdf';
        payload = { file: files[0] };
      } else if (activeTab === 'to-json') {
        endpoint = '/api/excel/to-json';
        payload = { file: files[0] };
      } else if (activeTab === 'json-to-excel') {
        endpoint = '/api/excel/json-to-excel';
        // Convert JSON text to base64
        try {
            // Validate JSON
            JSON.parse(jsonText);
            const base64 = btoa(unescape(encodeURIComponent(jsonText)));
            payload = { file: base64 };
        } catch (e) {
            throw new Error(t('invalid_json_format') || "Invalid JSON format");
        }
      }

      const res = await axios.post(endpoint, payload);
      setResult(res.data.result);
    } catch (err) {
      console.error('Excel processing failed:', err);
      setError(err.response?.data?.error || err.message || 'Processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Sheet className="w-5 h-5 text-green-600" />
          {t('excel_tools_title')}
        </h3>
        <p className="text-slate-500 text-sm">
          {t('excel_tools_desc')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setFiles([]); setJsonText(''); setResult(null); setError(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-green-500 text-green-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {activeTab === 'json-to-excel' ? (
            <div className="flex flex-col h-[200px]">
                <textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder={t('json_input_placeholder') || 'Paste your JSON array here... e.g. [{"name": "Alice", "age": 30}]'}
                    className="w-full h-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-xs resize-none"
                />
            </div>
          ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-green-400 hover:bg-green-50 transition-all cursor-pointer relative group min-h-[200px]">
            <input
              type="file"
              accept={activeTab === 'pdf-to-excel' ? ".pdf" : ".xls,.xlsx"}
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
              {files.length > 0 ? (
                <Check className="w-6 h-6 text-green-500" />
              ) : (
                <Upload className="w-6 h-6 text-green-500" />
              )}
            </div>
            <p className="text-slate-600 font-medium text-sm">
              {files.length > 0 ? t('file_selected', { count: files.length }) : t('upload_text')}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {activeTab === 'pdf-to-excel' ? 'PDF files' : 'Excel files (.xls, .xlsx)'}
            </p>
          </div>
          )}

          {activeTab === 'pdf-to-excel' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('pdf_pages_optional')}
              </label>
              <input
                type="text"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder="e.g. 1-2,5"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={(activeTab === 'json-to-excel' ? !jsonText.trim() : files.length === 0) || loading}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-white transition-all flex items-center justify-center gap-2 ${
              (activeTab === 'json-to-excel' ? !jsonText.trim() : files.length === 0) || loading
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 shadow-sm hover:shadow'
            }`}
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? t('processing') : t('start_process')}
          </button>
          
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 flex flex-col relative min-h-[300px]">
          {result ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="bg-white p-4 rounded-full shadow-sm">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h4 className="text-lg font-medium text-slate-800">{t('success')}</h4>
              
              {activeTab === 'to-json' ? (
                <div className="w-full h-64 bg-white border border-slate-200 rounded-lg overflow-auto p-4 text-xs font-mono">
                  {typeof result === 'string' && result.startsWith('http') ? (
                     <a href={result} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
                       {result}
                     </a>
                  ) : (
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                  )}
                </div>
              ) : (
                <a 
                  href={result} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t('download_file')}
                </a>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <FileSpreadsheet className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">{t('result_placeholder')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ImageOcrTranslator = () => {
  const { t } = useTranslation();
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [targetLang, setTargetLang] = useState('English');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        // limit size 5MB
        if (file.size > 5 * 1024 * 1024) {
            setError(t('ocr_upload_hint')); 
            return;
        }
        setError(null);
        const reader = new FileReader();
        reader.onload = (event) => {
            setPreviewUrl(event.target.result);
            setImage(event.target.result); // Base64 string
            setResult(null);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleRecognize = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await axios.post('/api/tools/ocr-translate', {
        image: image,
        targetLang
      });
      setResult(res.data);
    } catch (err) {
      console.error('OCR failed:', err);
      setError(err.response?.data?.error || err.message || 'Failed to process image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Scan className="w-5 h-5 text-green-500" />
          {t('ocr_title')}
        </h3>
        <p className="text-slate-500 text-sm">
          {t('ocr_desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Upload & Settings */}
        <div className="space-y-4">
           {!previewUrl ? (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer relative group min-h-[200px]">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-indigo-500" />
              </div>
              <p className="text-slate-600 font-medium text-sm">{t('upload_text')}</p>
              <p className="text-slate-400 text-xs mt-1">{t('ocr_upload_hint')}</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group">
              <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover object-center" />
              <button
                onClick={() => { setPreviewUrl(null); setImage(null); setResult(null); }}
                className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-slate-600 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">{t('target_lang')}</label>
             <select
               value={targetLang}
               onChange={(e) => setTargetLang(e.target.value)}
               className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
             >
               <option value="English">English</option>
               <option value="Chinese">Chinese (Simplified)</option>
               <option value="Spanish">Spanish</option>
               <option value="Japanese">Japanese</option>
               <option value="French">French</option>
               <option value="German">German</option>
               <option value="Korean">Korean</option>
             </select>
          </div>

          <button
            onClick={handleRecognize}
            disabled={loading || !image}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
            {loading ? t('recognizing') : t('recognize_btn')}
          </button>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="space-y-4">
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">{t('original_text')}</label>
             <textarea
               readOnly
               value={result?.originalText || ''}
               placeholder="..."
               className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 text-sm h-32 resize-none focus:outline-none"
             />
           </div>
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">{t('translated_text')}</label>
             <textarea
               readOnly
               value={result?.translatedText || ''}
               placeholder="..."
               className="w-full p-3 border border-indigo-200 rounded-lg bg-indigo-50 text-sm h-32 resize-none focus:outline-none"
             />
           </div>
        </div>
      </div>
    </div>
  );
};

const PromptGenerator = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [type, setType] = useState('general'); // 'general' | 'image'
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult('');
    try {
      const res = await axios.post('/api/tools/generate-prompt', { input, type });
      setResult(res.data.result);
    } catch (error) {
      console.error('Generation failed:', error);
      const msg = error.response?.data?.error || error.message || t('gen_error');
      setResult(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          {t('prompt_gen_title')}
        </h3>
        <p className="text-slate-500 text-sm">
          {t('prompt_gen_desc')}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('target_platform')}</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="type" 
                value="general" 
                checked={type === 'general'} 
                onChange={(e) => setType(e.target.value)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600">{t('platform_general')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="type" 
                value="image" 
                checked={type === 'image'} 
                onChange={(e) => setType(e.target.value)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600">{t('platform_image')}</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('your_idea')}</label>
          <textarea
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-all h-32"
            placeholder={t('idea_placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !input.trim()}
          className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? t('optimizing_btn') : t('optimize_btn')}
        </button>

        {result && (
          <div className="mt-6 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">{t('optimized_result')}</label>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? t('copied') : t('copy')}
              </button>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};



const ImageResizer = () => {
  const { t } = useTranslation();
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [quality, setQuality] = useState(0.8);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);
  const canvasRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setWidth(img.width);
          setHeight(img.height);
          setAspectRatio(img.width / img.height);
          setPreviewUrl(img.src);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWidthChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setWidth(val);
    if (maintainAspectRatio) {
      setHeight(Math.round(val / aspectRatio));
    }
  };

  const handleHeightChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setHeight(val);
    if (maintainAspectRatio) {
      setWidth(Math.round(val * aspectRatio));
    }
  };

  const handleDownload = () => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    
    // Smooth scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(image, 0, 0, width, height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const link = document.createElement('a');
    link.download = `resized-image-${width}x${height}.jpg`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-purple-500" />
          {t('img_resizer_title')}
        </h3>
        <p className="text-slate-500 text-sm">
          {t('img_resizer_desc')}
        </p>
      </div>

      {!image ? (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer relative group">
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8 text-indigo-500" />
          </div>
          <h4 className="text-lg font-medium text-slate-700">{t('upload_text')}</h4>
          <p className="text-slate-400 text-sm mt-2">{t('upload_hint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                <Wrench className="w-4 h-4" /> {t('settings')}
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('width_px')}</label>
                  <input 
                    type="number" 
                    value={width} 
                    onChange={handleWidthChange}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('height_px')}</label>
                  <input 
                    type="number" 
                    value={height} 
                    onChange={handleHeightChange}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="aspect"
                  checked={maintainAspectRatio}
                  onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="aspect" className="text-sm text-slate-600 select-none cursor-pointer">{t('maintain_aspect')}</label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('quality')} ({Math.round(quality * 100)}%)</label>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1" 
                  step="0.1" 
                  value={quality} 
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleDownload}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> {t('download_btn')}
                </button>
                <button
                  onClick={() => setImage(null)}
                  className="w-full mt-2 py-2 text-slate-500 hover:text-red-500 transition-colors text-sm"
                >
                  {t('reset_btn')}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-start bg-slate-100 rounded-xl p-4 border border-slate-200 overflow-hidden">
             <p className="text-xs text-slate-400 mb-2 w-full text-center">{t('preview')}</p>
             <img 
               src={previewUrl} 
               alt="Preview" 
               className="max-w-full h-auto max-h-[400px] object-contain shadow-md rounded-lg"
               style={{ aspectRatio: `${width}/${height}` }} 
             />
             {/* Hidden Canvas for processing */}
             <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}
    </div>
  );
};

const PdfTools = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('convert'); // convert | merge | split
  const [files, setFiles] = useState([]);
  const [pages, setPages] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    // Convert to base64
    Promise.all(selectedFiles.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    })).then(base64Files => {
      setFiles(base64Files);
      setResult(null);
      setError(null);
    }).catch(err => {
      setError('Failed to read files');
    });
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let endpoint = '';
      let payload = {};

      if (activeTab === 'convert') {
        endpoint = '/api/pdf/convert/text';
        payload = { file: files[0] };
      } else if (activeTab === 'merge') {
        endpoint = '/api/pdf/merge';
        payload = { files: files };
      } else if (activeTab === 'split') {
        endpoint = '/api/pdf/split';
        payload = { file: files[0], pages };
      }

      const res = await axios.post(endpoint, payload);
      setResult(res.data.result);
    } catch (err) {
      console.error('PDF processing failed:', err);
      setError(err.response?.data?.error || err.message || 'Processing failed');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    return (
      <div className="space-y-4 mt-6">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer relative group">
          <input
            type="file"
            accept=".pdf"
            multiple={activeTab === 'merge'}
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6 text-indigo-500" />
          </div>
          <p className="text-slate-600 font-medium text-sm">
            {files.length > 0 ? `${files.length} file(s) selected` : t('pdf_upload_hint')}
          </p>
        </div>

        {activeTab === 'split' && (
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">{t('pdf_pages_hint')}</label>
             <input
               type="text"
               value={pages}
               onChange={(e) => setPages(e.target.value)}
               placeholder="1-2,5"
               className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
             />
           </div>
        )}

        <button
          onClick={handleProcess}
          disabled={loading || files.length === 0 || (activeTab === 'split' && !pages)}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? t('pdf_processing') : 
            activeTab === 'convert' ? t('pdf_convert_btn') :
            activeTab === 'merge' ? t('pdf_merge_btn') : t('pdf_split_btn')
          }
        </button>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
             <label className="block text-sm font-medium text-slate-700 mb-2">Result</label>
             {activeTab === 'convert' ? (
                <div className="whitespace-pre-wrap text-sm text-slate-700 max-h-60 overflow-y-auto">
                  {result}
                </div>
             ) : (
                <div className="space-y-2">
                   {Array.isArray(result) ? result.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline text-sm">
                        <Download className="w-4 h-4" /> Part {idx + 1}
                      </a>
                   )) : (
                      <a href={result} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline text-sm">
                        <Download className="w-4 h-4" /> Download Result
                      </a>
                   )}
                </div>
             )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-500" />
          {t('pdf_tools_title')}
        </h3>
        <p className="text-slate-500 text-sm">
          {t('pdf_tools_desc')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('convert'); setFiles([]); setResult(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'convert' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          {t('pdf_tab_convert')}
        </button>
        <button
          onClick={() => { setActiveTab('merge'); setFiles([]); setResult(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'merge' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          {t('pdf_tab_merge')}
        </button>
        <button
          onClick={() => { setActiveTab('split'); setFiles([]); setResult(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'split' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          {t('pdf_tab_split')}
        </button>
      </div>

      {renderContent()}
    </div>
  );
};

// --- Main Toolbox Layout ---

const Toolbox = () => {
  const { t } = useTranslation();
  const [activeTool, setActiveTool] = useState('prompt');

  const tools = [
    {
      id: 'prompt',
      name: t('prompt_gen_title'),
      icon: <Zap className="w-5 h-5" />,
      color: 'text-yellow-500'
    },
    {
      id: 'ocr',
      name: t('ocr_title'),
      icon: <Scan className="w-5 h-5" />,
      color: 'text-green-500'
    },
    {
      id: 'image',
      name: t('img_resizer_title'),
      icon: <ImageIcon className="w-5 h-5" />,
      color: 'text-purple-500'
    },
    {
      id: 'pdf',
      name: t('pdf_tools_title'),
      icon: <FileText className="w-5 h-5" />,
      color: 'text-red-500'
    },
    {
      id: 'excel',
      name: t('excel_tools_title'),
      icon: <Sheet className="w-5 h-5" />,
      color: 'text-green-600'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8 min-h-[600px]">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 mb-4 px-2">{t('tools_title')}</h2>
          <div className="space-y-1">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTool === tool.id 
                    ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className={activeTool === tool.id ? tool.color : 'text-slate-400'}>
                  {tool.icon}
                </span>
                {tool.name}
                {activeTool === tool.id && <ArrowRight className="w-4 h-4 ml-auto text-indigo-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
          {activeTool === 'prompt' && <PromptGenerator />}
          {activeTool === 'ocr' && <ImageOcrTranslator />}
          {activeTool === 'image' && <ImageResizer />}
          {activeTool === 'pdf' && <PdfTools />}
          {activeTool === 'excel' && <ExcelTools />}
        </div>
      </div>
    </div>
  );
};

export default Toolbox;
