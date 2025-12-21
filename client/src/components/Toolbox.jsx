import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Wrench, Zap, Image as ImageIcon, 
  ArrowRight, Copy, Download, Upload, RefreshCw, Check,
  Scan, FileText, Layers, Scissors, Sheet, FileSpreadsheet, BarChart2, Volume2
} from 'lucide-react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';

// --- Error Boundary ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex flex-col items-center text-center">
          <h3 className="font-bold mb-2 text-lg">Something went wrong</h3>
          <p className="text-sm mb-4">The application encountered an error while rendering this component.</p>
          <div className="bg-white p-3 rounded border border-red-100 w-full text-left overflow-auto max-h-40 font-mono text-xs">
            {this.state.error && this.state.error.toString()}
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Sub-components for each tool ---

const DataTable = ({ data, title }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!Array.isArray(data) || data.length === 0) return null;

  const handleCopy = () => {
    try {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join('\t'),
        ...data.map(row => headers.map(header => {
          const val = row[header];
          return val === null || val === undefined ? '' : String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
        }).join('\t'))
      ].join('\n');

      navigator.clipboard.writeText(csvContent).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  try {
    // Validate first item
    if (typeof data[0] !== 'object' || data[0] === null) {
      return <div className="text-slate-400 text-sm p-2">Invalid data format for table.</div>;
    }
    
    const columns = Object.keys(data[0]);
    if (columns.length === 0) {
      return <div className="text-slate-400 text-sm p-2">No columns to display.</div>;
    }

    return (
      <div className="mt-8 border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
           <h4 className="font-bold text-slate-700 text-sm">{title || t('data_preview', 'Data Preview')}</h4>
           <button 
             onClick={handleCopy}
             className="text-xs flex items-center gap-1 text-slate-500 hover:text-green-600 transition-colors px-2 py-1 rounded hover:bg-slate-100"
             title={t('copy_table', 'Copy Table Data')}
           >
             {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
             {copied ? t('copied', 'Copied!') : t('copy', 'Copy')}
           </button>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="px-6 py-3 border-b border-slate-200 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index} className="bg-white border-b hover:bg-slate-50">
                  {columns.map((col) => (
                    <td key={`${index}-${col}`} className="px-6 py-4 border-b border-slate-100 whitespace-nowrap">
                      {/* Handle non-string values safely */}
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } catch (e) {
    console.error("Table rendering error:", e);
    return <div className="text-red-500 text-sm p-4">Error rendering data table.</div>;
  }
};

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
  const [playingOriginal, setPlayingOriginal] = useState(false);
  const [playingTranslated, setPlayingTranslated] = useState(false);
  const [loadingOriginalAudio, setLoadingOriginalAudio] = useState(false);
  const [loadingTranslatedAudio, setLoadingTranslatedAudio] = useState(false);

  const handlePlay = async (text, isTranslated) => {
    if (!text) return;
    
    const setLoading = isTranslated ? setLoadingTranslatedAudio : setLoadingOriginalAudio;
    const setPlaying = isTranslated ? setPlayingTranslated : setPlayingOriginal;
    
    setLoading(true);

    try {
      const response = await axios.post('/api/tools/tts', {
        text,
        voice: 'tongtong' 
      }, {
        responseType: 'blob'
      });

      const audioUrl = URL.createObjectURL(response.data);
      const audio = new Audio(audioUrl);
      
      // Add debug listeners
      audio.oncanplaythrough = () => {
        console.log('Audio ready to play');
        setLoading(false);
        setPlaying(true);
      };
      
      audio.onplay = () => console.log('Audio started playing');
      audio.onpause = () => console.log('Audio paused');

      audio.onended = () => {
        console.log('Audio finished');
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = (e) => {
        setLoading(false);
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
        console.error('Audio playback error', e, audio.error);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Play prevented:", error);
          setLoading(false);
          setPlaying(false);
        });
      }
    } catch (err) {
      console.error('TTS failed:', err);
      setLoading(false);
      setPlaying(false);
    }
  };

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
    if (loading || !image) return;
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
             <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-slate-700">{t('original_text')}</label>
               <button 
                  onClick={() => handlePlay(result?.originalText, false)}
                  disabled={loadingOriginalAudio || playingOriginal || !result?.originalText}
                  className="text-slate-500 hover:text-indigo-600 disabled:opacity-50 transition-colors p-1"
                  title={t('read_aloud', 'Read Aloud')}
                >
                  {loadingOriginalAudio ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <Volume2 className={`w-4 h-4 ${playingOriginal ? 'animate-pulse text-indigo-600' : ''}`} />
                  )}
                </button>
             </div>
             <textarea
               readOnly
               value={result?.originalText || ''}
               placeholder="..."
               className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 text-sm h-32 resize-none focus:outline-none"
             />
           </div>
           <div>
             <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-slate-700">{t('translated_text')}</label>
               <button 
                  onClick={() => handlePlay(result?.translatedText, true)}
                  disabled={loadingTranslatedAudio || playingTranslated || !result?.translatedText}
                  className="text-slate-500 hover:text-indigo-600 disabled:opacity-50 transition-colors p-1"
                  title={t('read_aloud', 'Read Aloud')}
                >
                  {loadingTranslatedAudio ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <Volume2 className={`w-4 h-4 ${playingTranslated ? 'animate-pulse text-indigo-600' : ''}`} />
                  )}
                </button>
             </div>
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

const DataAnalysis = () => {
  const { t, i18n } = useTranslation();
  const [file, setFile] = useState(null);
  const [requirements, setRequirements] = useState('');
  const [results, setResults] = useState(null); // Changed from result to results (array)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisCopied, setAnalysisCopied] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFile(event.target.result); // Base64
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setActiveSheetIndex(0);

    try {
      const res = await axios.post('/api/analysis', {
        file,
        requirements,
        lang: i18n.language
      });

      let responseData = res.data;
      // Handle case where response might be a string (e.g. some proxy issues)
      if (typeof responseData === 'string') {
        try {
            responseData = JSON.parse(responseData);
        } catch (e) {
            console.error('Failed to parse response string:', e);
        }
      }

      // Backend now returns { results: [...] }
      if (responseData.results && Array.isArray(responseData.results)) {
        setResults(responseData.results);
      } else if (responseData.analysis) {
        // Fallback for backward compatibility or single result structure
        setResults([{ sheetName: 'Result', ...responseData }]);
      } else {
        // Fallback: Try to display whatever we got to help debugging
        console.warn('Unexpected response structure:', responseData);
        if (Array.isArray(responseData)) {
             setResults(responseData);
        } else {
             // Create a dummy result to show the error/data
             setResults([{ 
                 sheetName: 'Debug Info', 
                 analysis: typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : String(responseData),
                 intent: 'Debug: Unexpected Response Format'
             }]);
        }
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err.response?.data?.error || err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!results || results.length === 0) return;

    try {
      const workbook = XLSX.utils.book_new();
      
      results.forEach((sheetResult) => {
        let sheetName = sheetResult.sheetName || 'Result';
        // Sanitize sheet name (max 31 chars, no invalid chars)
        sheetName = sheetName.replace(/[\\/?*[\]]/g, '').substring(0, 31);
        
        // 1. Add Analysis Text Sheet
        const analysisData = [
            ['Analysis Intent', sheetResult.intent || ''],
            ['Analysis Summary'],
            [sheetResult.analysis || 'No data available']
        ];
        const analysisSheet = XLSX.utils.aoa_to_sheet(analysisData);
        
        let finalAnalysisSheetName = `${sheetName}-Analysis`.substring(0, 31);
        // Ensure unique name
        let counter = 1;
        while (workbook.Sheets[finalAnalysisSheetName]) {
             finalAnalysisSheetName = `${sheetName.substring(0, 25)}-Ana${counter}`;
             counter++;
        }
        XLSX.utils.book_append_sheet(workbook, analysisSheet, finalAnalysisSheetName);

        // 2. Add Chart Data Sheet (if available)
        if (sheetResult.chart && Array.isArray(sheetResult.chart.data) && sheetResult.chart.data.length > 0) {
           const dataSheet = XLSX.utils.json_to_sheet(sheetResult.chart.data);
           
           let finalDataSheetName = `${sheetName}-Data`.substring(0, 31);
           // Ensure unique name
           counter = 1;
           while (workbook.Sheets[finalDataSheetName]) {
             finalDataSheetName = `${sheetName.substring(0, 25)}-Dat${counter}`;
             counter++;
           }
           XLSX.utils.book_append_sheet(workbook, dataSheet, finalDataSheetName);
        }
      });

      XLSX.writeFile(workbook, `Analysis_Result_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      console.error("Download failed:", err);
      setError("Failed to generate Excel file.");
    }
  };

  const renderChart = (chart) => {
    if (!chart || !chart.type || !Array.isArray(chart.data) || chart.data.length === 0) {
      return (
        <div className="w-full h-[400px] mt-4 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200 text-slate-400">
           <p className="text-sm">Chart data unavailable</p>
        </div>
      );
    }

    const { type, data, xAxisKey, seriesKey, labelKey, title } = chart;
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    try {
      return (
        <div className="w-full h-[400px] mt-4">
          <h4 className="text-center font-bold mb-2 text-slate-700">{title}</h4>
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' && (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisKey} />
                <YAxis />
                <Tooltip />
                <Legend />
                {Array.isArray(seriesKey) ? seriesKey.map((key, index) => (
                    <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
                )) : <Bar dataKey={seriesKey || 'value'} fill="#8884d8" />}
              </BarChart>
            )}
            {type === 'line' && (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisKey} />
                <YAxis />
                <Tooltip />
                <Legend />
                {Array.isArray(seriesKey) ? seriesKey.map((key, index) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} />
                )) : <Line type="monotone" dataKey={seriesKey || 'value'} stroke="#8884d8" />}
              </LineChart>
            )}
            {type === 'pie' && (
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey={seriesKey || 'value'}
                  nameKey={labelKey || 'name'}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      );
    } catch (e) {
      console.error("Chart rendering error:", e);
      return <div className="text-red-500 text-sm p-4">Error rendering chart.</div>;
    }
  };

  const activeResult = results ? results[activeSheetIndex] : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-500" />
          {t('analysis_title')}
        </h3>
        <p className="text-slate-500 text-sm">
          {t('analysis_desc')}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer relative group min-h-[200px]">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
              {file ? (
                <Check className="w-6 h-6 text-blue-500" />
              ) : (
                <Upload className="w-6 h-6 text-blue-500" />
              )}
            </div>
            <p className="text-slate-600 font-medium text-sm">
              {file ? t('file_selected', { count: 1 }) : t('upload_text')}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {t('analysis_upload_hint')}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('analysis_requirements')}
              </label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder={t('analysis_placeholder')}
                className="w-full h-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!file || loading}
              className={`w-full py-2.5 px-4 rounded-lg font-medium text-white transition-all flex items-center justify-center gap-2 ${
                !file || loading
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow'
              }`}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? t('analyzing') : t('analyze_btn')}
            </button>
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 flex flex-col relative min-h-[400px]">
          {results && results.length > 0 ? (
            <div className="flex flex-col h-full gap-4 overflow-auto">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                   <Check className="w-5 h-5 text-green-500" />
                   {t('analysis_result')}
                </h4>
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  {t('download_btn')}
                </button>
              </div>

              {/* Sheet Tabs */}
              {results.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2">
                  {results.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSheetIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        activeSheetIndex === idx
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      {res.sheetName}
                    </button>
                  ))}
                </div>
              )}

              {activeResult && (
                <>
                  {activeResult.error ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
                      <p className="font-semibold">Analysis Failed for this Sheet</p>
                      <p className="text-sm mt-1">{activeResult.error}</p>
                    </div>
                  ) : (
                    <>
                      {activeResult.intent && (
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                          <Zap className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold block mb-1">{t('analysis_intent', 'Analysis Intent')}:</span>
                            {activeResult.intent}
                          </div>
                        </div>
                      )}
                      
                      <div className="relative group">
                        <div className="prose prose-sm max-w-none text-slate-600 bg-white p-4 rounded-lg border border-slate-200">
                          <p className="whitespace-pre-wrap">
                            {typeof activeResult.analysis === 'string' ? activeResult.analysis : JSON.stringify(activeResult.analysis, null, 2)}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                          const text = typeof activeResult.analysis === 'string' ? activeResult.analysis : JSON.stringify(activeResult.analysis, null, 2);
                            navigator.clipboard.writeText(text).then(() => {
                              setAnalysisCopied(true);
                              setTimeout(() => setAnalysisCopied(false), 2000);
                            });
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-green-600 opacity-0 group-hover:opacity-100 transition-all"
                          title={t('copy_analysis', 'Copy Analysis')}
                        >
                          {analysisCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {activeResult.chart && renderChart(activeResult.chart)}
                      
                      {activeResult.chart && activeResult.chart.data && (
                        <DataTable 
                          data={activeResult.chart.data} 
                          title={t('analysis_result_data', 'Analysis Result Data')} 
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <BarChart2 className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">{t('result_placeholder')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
      // Don't set error immediately while typing to avoid annoyance, 
      // but keep old parsed if possible? No, clear parsed if invalid to avoid mismatch.
      // But clearing parsed makes the tree disappear while typing.
      // Let's only set error, keep parsed if we want? 
      // json.cn keeps the tree until valid again? No, it updates in real time.
      // If invalid, maybe just don't update parsed?
    }
  }, [input]);

  const handleFormat = () => {
    try {
      const json = JSON.parse(input);
      setInput(JSON.stringify(json, null, 2));
      setParsed(json);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMinify = () => {
    try {
      const json = JSON.parse(input);
      setInput(JSON.stringify(json));
      setParsed(json);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleValidate = () => {
    try {
      JSON.parse(input);
      setError(null);
      alert(t('json_valid'));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-200px)] flex flex-col">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Code className="w-5 h-5 text-indigo-600" />
          {t('json_editor_title')}
        </h3>
        <p className="text-slate-500 text-sm">
          {t('json_editor_desc')}
        </p>
      </div>

      <div className="flex gap-2 mb-2">
        <button onClick={handleFormat} className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors">{t('json_format')}</button>
        <button onClick={handleMinify} className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors">{t('json_minify')}</button>
        <button onClick={handleValidate} className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors">{t('json_validate')}</button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        <div className="flex flex-col h-full">
           <textarea
             value={input}
             onChange={(e) => setInput(e.target.value)}
             className="flex-1 w-full p-4 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
             placeholder='{"key": "value"}'
             spellCheck="false"
           />
           {error && <div className="mt-2 text-red-500 text-xs">{error}</div>}
        </div>
        
        <div className="h-full border border-slate-300 rounded-lg bg-slate-50 overflow-auto p-4">
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
    },
    {
      id: 'analysis',
      name: t('analysis_title'),
      icon: <BarChart2 className="w-5 h-5" />,
      color: 'text-blue-500'
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
          {activeTool === 'analysis' && (
            <ErrorBoundary>
              <DataAnalysis />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toolbox;
