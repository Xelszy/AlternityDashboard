import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QCImage, PromptEntry, Character } from './types';
import { 
  LayoutDashboard, 
  Image as ImageIcon, 
  FileText, 
  RefreshCcw, 
  CheckCircle2, 
  XCircle, 
  Upload, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  SplitSquareHorizontal,
  Download,
  PlayCircle,
  FolderOpen,
  Terminal,
  AlertCircle
} from 'lucide-react';

// --- Utility Functions ---

const detectSettingFromPrompt = (prompt: string): string => {
    if (!prompt) return 'generic';
    const p = prompt.toLowerCase();
    if (p.includes('vip')) return 'hospital_vip';
    if (p.includes('hospital') || p.includes('rumah sakit')) return 'hospital_regular';
    if (p.includes('living') || p.includes('ruang tamu')) return 'apartment_living_room';
    if (p.includes('bedroom') || p.includes('kamar tidur')) return 'apartment_bedroom';
    return 'generic';
};

const detectCharactersFromPrompt = (prompt: string): Character[] => {
    if (!prompt) return [];
    const characters: Character[] = [];
    const p = prompt.toLowerCase();
    
    const detectOutfit = () => {
        if (p.includes('baju pasien') || p.includes('patient')) return 'patient';
        if (p.includes('formal')) return 'formal';
        if (p.includes('casual')) return 'casual';
        if (p.includes('santai')) return 'santai';
        return 'default';
    };
    
    if (p.includes('mc')) characters.push({ name: 'MC', outfit: detectOutfit() });
    if (p.includes('raka')) characters.push({ name: 'Raka', outfit: detectOutfit() });
    if (p.includes('alina')) characters.push({ name: 'Alina', outfit: detectOutfit() });
    if (p.includes('aruna')) characters.push({ name: 'Aruna', outfit: 'default' });
    
    return characters;
};

const matchPromptToImage = (imageName: string, promptsArray: PromptEntry[]): string | null => {
    if (!promptsArray || promptsArray.length === 0) return null;
    const cleanImageName = imageName.replace(/_compressed/gi, '').replace(/\.(png|jpg|jpeg|webp)$/i, '').toLowerCase();
    const imgMatch = cleanImageName.match(/chap[_\s]*(\d+)_(\d+)/i);
    
    if (imgMatch) {
        const imgChapter = `${imgMatch[1]}_${imgMatch[2]}`;
        for (const promptEntry of promptsArray) {
            const outputAi = promptEntry.outputAi || '';
            if (outputAi.includes('||')) {
                const parts = outputAi.split('||');
                const promptText = parts[0].trim();
                const filenameFromJSON = parts[1].trim();
                
                const jsonMatch = filenameFromJSON.match(/chap[_\s]*(\d+)_(\d+)/i);
                if (jsonMatch) {
                    const jsonChapter = `${jsonMatch[1]}_${jsonMatch[2]}`;
                    if (imgChapter === jsonChapter) return promptText;
                }
            }
        }
    }
    return null;
};

// --- Components ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  badge 
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  badge?: number 
}) => (
  <div 
    onClick={onClick}
    className={`
      flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-l-2
      ${active 
        ? 'bg-surfaceHighlight border-primary text-white' 
        : 'border-transparent text-muted hover:bg-surface hover:text-white'}
    `}
  >
    <Icon size={18} />
    <span className="text-sm font-medium flex-1">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center">
        {badge}
      </span>
    )}
  </div>
);

const ComparisonView = ({ oldUrl, newUrl }: { oldUrl: string, newUrl: string }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full select-none cursor-ew-resize overflow-hidden rounded-lg shadow-2xl bg-black border border-border"
      onMouseDown={() => setIsDragging(true)}
    >
      <img src={oldUrl} className="absolute top-0 left-0 w-full h-full object-contain" alt="Original" />
      <div 
        className="absolute top-0 left-0 w-full h-full overflow-hidden border-r border-white/50"
        style={{ width: `${sliderPos}%` }}
      >
        <img src={newUrl} className="absolute top-0 left-0 w-full h-full object-contain max-w-none" style={{ width: containerRef.current?.offsetWidth }} alt="New" />
      </div>
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-primary cursor-ew-resize z-10 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg border-2 border-white">
          <SplitSquareHorizontal size={14} />
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  // State
  const [currentView, setCurrentView] = useState<'dashboard' | 'qc' | 'extraction' | 'retry'>('dashboard');
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem('backend-url') || 'http://localhost:5000');
  
  // Data State
  const [images, setImages] = useState<QCImage[]>([]);
  const [promptData, setPromptData] = useState<PromptEntry[]>([]);
  
  // QC State
  const [qcIndex, setQcIndex] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [outfitOverride, setOutfitOverride] = useState<Record<string, string>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Extraction State
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionLog, setExtractionLog] = useState<string[]>([]);

  // Persist Backend URL
  useEffect(() => {
    localStorage.setItem('backend-url', backendUrl);
  }, [backendUrl]);

  // Derived Stats
  const stats = {
    total: images.length,
    approved: images.filter(i => i.status === 'approved').length,
    rejected: images.filter(i => i.status === 'rejected').length,
    pending: images.filter(i => i.status === 'pending').length
  };

  // --- Handlers ---

  const handleDocxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setDocxFile(e.target.files[0]);
  };

  const handleSimulateExtraction = () => {
    if (!docxFile) return;
    setIsExtracting(true);
    setExtractionLog(['Initializing local parser module...', 'Reading DOCX binary structure...']);
    
    // Simulate steps to make the UI feel responsive and "ERP-like"
    setTimeout(() => setExtractionLog(p => [...p, 'Extracting XML content from document...']), 800);
    setTimeout(() => setExtractionLog(p => [...p, 'Parsing [insert image] tags...', 'Parsing [background] tags...']), 1600);
    setTimeout(() => setExtractionLog(p => [...p, 'Analyzing scene context and dress codes...', 'Generating JSON structure...']), 2400);
    setTimeout(() => {
        setExtractionLog(p => [...p, '✅ Extraction Complete!', 'Ready for QC.']);
        setIsExtracting(false);
        // Alert to inform user about the missing backend connection for this specific demo feature
        alert("Extraction Logic Simulation Complete.\n\nIn a live environment, this would send the DOCX to the python backend. For now, please upload the JSON file generated by your script in the QC Studio.");
    }, 3200);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    // Explicitly cast to File[] to satisfy TypeScript
    const files = Array.from(e.target.files) as File[];
    const newImages: QCImage[] = files.map((file, idx) => {
        const prompt = matchPromptToImage(file.name, promptData) || "Prompt will appear here once JSON is loaded...";
        return {
            id: Date.now() + idx,
            file,
            url: URL.createObjectURL(file),
            name: file.name,
            prompt: prompt,
            originalPrompt: prompt,
            status: 'pending'
        };
    });
    setImages(prev => [...prev, ...newImages]);
    setCurrentView('qc');
  };

  const handleJSONUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const data = JSON.parse(ev.target?.result as string);
              setPromptData(data);
              // Update existing images if they match
              setImages(prev => prev.map(img => {
                  const newPrompt = matchPromptToImage(img.name, data);
                  return newPrompt ? { ...img, prompt: newPrompt, originalPrompt: newPrompt } : img;
              }));
              alert(`✅ Successfully loaded ${data.length} prompt entries.`);
          } catch(err) {
              alert('Invalid JSON file.');
          }
      };
      reader.readAsText(file);
  };

  const handleRegenerate = async () => {
      const current = images[qcIndex];
      if (!current || !backendUrl) return;
      
      setIsRegenerating(true);
      try {
          const detectedChars = detectCharactersFromPrompt(current.prompt);
          const charsWithOverride = detectedChars.map(c => ({
              name: c.name,
              outfit: outfitOverride[c.name] || c.outfit
          }));

          // Mock fetch for demo if backend not present
          // In real app: await fetch(`${backendUrl}/api/regenerate` ...)
          await new Promise(r => setTimeout(r, 2000)); 
          
          // For demo, we just use the same URL to show the UI state
          // In reality, this would be `data.new_image_base64`
          const newUrl = current.url; 
          
          const updated = [...images];
          updated[qcIndex] = {
              ...current,
              oldUrl: current.url, // Keep old for comparison
              url: newUrl, // New image
              status: 'pending'
          };
          setImages(updated);
          setCompareMode(true);
          
      } catch (e) {
          alert("Regeneration failed (Check backend connection)");
      } finally {
          setIsRegenerating(false);
      }
  };

  // --- Render Functions ---

  const renderDashboard = () => (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">Production Overview</h2>
            <div className="text-sm text-muted bg-surface px-3 py-1 rounded-full border border-border">
                {new Date().toLocaleDateString()}
            </div>
        </div>
        
        <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-surface border border-border p-6 rounded-xl hover:border-border/80 transition-colors">
                <div className="flex items-center justify-between mb-4">
                     <div className="text-muted text-xs font-bold uppercase tracking-wider">Total Assets</div>
                     <FolderOpen size={16} className="text-muted" />
                </div>
                <div className="text-4xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-muted mt-2">Active in pipeline</div>
            </div>
            <div className="bg-surface border border-border p-6 rounded-xl hover:border-success/50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                     <div className="text-success/80 text-xs font-bold uppercase tracking-wider">Approved</div>
                     <CheckCircle2 size={16} className="text-success" />
                </div>
                <div className="text-4xl font-bold text-success">{stats.approved}</div>
                <div className="text-xs text-muted mt-2">Ready for deployment</div>
            </div>
            <div className="bg-surface border border-border p-6 rounded-xl hover:border-danger/50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                     <div className="text-danger/80 text-xs font-bold uppercase tracking-wider">Rejected</div>
                     <XCircle size={16} className="text-danger" />
                </div>
                <div className="text-4xl font-bold text-danger">{stats.rejected}</div>
                <div className="text-xs text-muted mt-2">Requires attention</div>
            </div>
            <div className="bg-surface border border-border p-6 rounded-xl hover:border-warning/50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                     <div className="text-warning/80 text-xs font-bold uppercase tracking-wider">Pending QC</div>
                     <RefreshCcw size={16} className="text-warning" />
                </div>
                <div className="text-4xl font-bold text-warning">{stats.pending}</div>
                <div className="text-xs text-muted mt-2">Awaiting review</div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-md">
                        <Upload size={18} className="text-primary"/> 
                    </div>
                    Quick Import
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <label className="group flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-xl hover:border-primary hover:bg-surfaceHighlight cursor-pointer transition-all">
                        <div className="w-12 h-12 rounded-full bg-surfaceHighlight group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                            <FileText size={24} className="text-muted group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-sm font-medium text-white">Upload JSON Prompt</span>
                        <span className="text-xs text-muted mt-1">Populate scene data</span>
                        <input type="file" accept=".json" className="hidden" onChange={handleJSONUpload} />
                    </label>
                    <label className="group flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-xl hover:border-primary hover:bg-surfaceHighlight cursor-pointer transition-all">
                        <div className="w-12 h-12 rounded-full bg-surfaceHighlight group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                            <ImageIcon size={24} className="text-muted group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-sm font-medium text-white">Upload Images</span>
                        <span className="text-xs text-muted mt-1">Batch import scenes</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <div className="p-1.5 bg-surfaceHighlight rounded-md">
                        <Settings size={18} className="text-muted"/> 
                    </div>
                    System Status
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surfaceHighlight flex items-center justify-center">
                                <Terminal size={14} className="text-muted" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-white">Backend Connection</div>
                                <div className="text-xs text-muted">Python generation server</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-surfaceHighlight rounded text-xs font-mono">
                             <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                             <span>{backendUrl}</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surfaceHighlight flex items-center justify-center">
                                <FileText size={14} className="text-muted" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-white">Prompt Database</div>
                                <div className="text-xs text-muted">Current session memory</div>
                            </div>
                        </div>
                        <div className="px-3 py-1 bg-surfaceHighlight rounded text-xs text-white font-medium">
                            {promptData.length > 0 ? `${promptData.length} entries active` : 'Empty'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  const renderExtraction = () => (
    <div className="p-8 h-full flex flex-col max-w-7xl mx-auto">
        <div className="mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                <FileText className="text-primary" /> 
                Asset Extraction Center
            </h2>
            <p className="text-muted text-sm mt-1">Convert screenplay documents into structured asset lists.</p>
        </div>
        
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
            {/* Left: Upload Area */}
            <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-lg">
                {!docxFile ? (
                    <label className="w-full h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-surfaceHighlight cursor-pointer transition-all p-12 group">
                        <div className="w-20 h-20 bg-surfaceHighlight rounded-full flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                            <FileText size={40} className="text-muted group-hover:text-primary transition-colors" />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-white">Upload Script (.docx)</h3>
                        <p className="text-muted mb-8 max-w-sm">Drag and drop your screenplay file here to begin the analysis and extraction process.</p>
                        <span className="bg-primary hover:bg-primaryHover text-white px-8 py-3 rounded-lg font-bold transition-all transform group-hover:scale-105 shadow-lg shadow-primary/20">
                            Select File
                        </span>
                        <input type="file" accept=".docx" className="hidden" onChange={handleDocxUpload} />
                    </label>
                ) : (
                    <div className="w-full max-w-md animate-in fade-in zoom-in duration-300">
                        <div className="bg-background p-6 rounded-xl border border-border mb-8 flex items-center gap-4 relative overflow-hidden group">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                            <FileText size={32} className="text-primary" />
                            <div className="text-left flex-1 overflow-hidden">
                                <div className="font-bold truncate text-white text-lg">{docxFile.name}</div>
                                <div className="text-xs text-muted">{(docxFile.size / 1024).toFixed(1)} KB • Word Document</div>
                            </div>
                            <button onClick={() => setDocxFile(null)} className="p-2 hover:bg-surfaceHighlight rounded-full text-muted hover:text-danger transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <button 
                            onClick={handleSimulateExtraction}
                            disabled={isExtracting}
                            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 text-lg shadow-xl transition-all ${
                                isExtracting ? 'bg-surfaceHighlight text-muted cursor-wait' : 'bg-primary hover:bg-primaryHover text-white hover:scale-[1.02]'
                            }`}
                        >
                            {isExtracting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-muted border-t-white rounded-full animate-spin"></div>
                                    Analyzing Document...
                                </>
                            ) : (
                                <>
                                    <PlayCircle size={24} /> Start Extraction
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Right: Console Log */}
            <div className="bg-surface border border-border rounded-xl p-0 flex flex-col overflow-hidden shadow-lg h-full">
                <div className="px-6 py-4 border-b border-border bg-surfaceHighlight flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                        <Terminal size={14} /> Process Log
                    </h3>
                    {isExtracting && <div className="text-xs text-primary animate-pulse font-mono">● Running</div>}
                </div>
                <div className="flex-1 bg-[#0c0c0e] p-6 font-mono text-sm overflow-y-auto space-y-3">
                    {extractionLog.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted opacity-30">
                            <Terminal size={48} className="mb-4" />
                            <div>Waiting for input...</div>
                        </div>
                    ) : (
                        extractionLog.map((log, i) => (
                            <div key={i} className="flex items-start gap-3 animate-in slide-in-from-left-2 duration-200">
                                <span className="text-primary font-bold select-none">{`>`}</span>
                                <span className="text-gray-300">{log}</span>
                            </div>
                        ))
                    )}
                    {/* Fake cursor */}
                    {isExtracting && (
                        <div className="w-2 h-4 bg-primary animate-pulse inline-block align-middle"></div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );

  const renderQC = () => {
    const current = images[qcIndex];
    if (!current) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-background">
                <div className="bg-surface p-16 rounded-2xl border border-border max-w-xl w-full shadow-2xl">
                    <div className="w-24 h-24 bg-surfaceHighlight rounded-full flex items-center justify-center mx-auto mb-8">
                         <ImageIcon size={48} className="text-muted" />
                    </div>
                    <h2 className="text-3xl font-bold mb-4 text-white">QC Studio Empty</h2>
                    <p className="text-muted mb-10 text-lg">Load your generated assets or JSON prompt data to begin the quality control workflow.</p>
                    <div className="flex gap-4 justify-center">
                        <label className="bg-primary hover:bg-primaryHover text-white px-8 py-4 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-2 shadow-lg hover:shadow-primary/30">
                            <Upload size={20} /> Upload Images
                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                        <label className="bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-white px-8 py-4 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-2 border border-border hover:border-white/20">
                            <FileText size={20} /> Load JSON
                            <input type="file" accept=".json" className="hidden" onChange={handleJSONUpload} />
                        </label>
                    </div>
                </div>
            </div>
        );
    }

    const chars = detectCharactersFromPrompt(current.prompt);

    return (
        <div className="flex h-full overflow-hidden bg-background">
            {/* Left: Thumbnail List */}
            <div className="w-72 bg-surface border-r border-border flex flex-col flex-shrink-0 z-10">
                <div className="p-4 border-b border-border bg-surfaceHighlight/50 backdrop-blur">
                    <h3 className="font-bold text-xs text-muted uppercase tracking-wider flex items-center justify-between">
                        <span>Queue ({images.length})</span>
                        <span className="text-primary">{qcIndex + 1} / {images.length}</span>
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {images.map((img, idx) => (
                        <div 
                            key={img.id}
                            onClick={() => { setQcIndex(idx); setCompareMode(false); }}
                            className={`
                                group flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all border
                                ${idx === qcIndex 
                                    ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5' 
                                    : 'bg-surfaceHighlight/30 border-transparent hover:bg-surfaceHighlight hover:border-border'}
                            `}
                        >
                            <div className="relative w-14 h-14 flex-shrink-0">
                                <img src={img.url} className="w-full h-full rounded-lg bg-black object-cover" alt="" />
                                {idx === qcIndex && <div className="absolute inset-0 rounded-lg ring-2 ring-primary ring-inset"></div>}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center h-14">
                                <div className={`text-sm font-medium truncate mb-1 ${idx === qcIndex ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                                    {img.name}
                                </div>
                                <div className="flex items-center gap-2">
                                    {img.status === 'approved' && <div className="flex items-center gap-1 text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded font-bold uppercase"><CheckCircle2 size={10} /> Approved</div>}
                                    {img.status === 'rejected' && <div className="flex items-center gap-1 text-[10px] bg-danger/10 text-danger px-1.5 py-0.5 rounded font-bold uppercase"><XCircle size={10} /> Rejected</div>}
                                    {img.status === 'pending' && <div className="flex items-center gap-1 text-[10px] bg-background text-muted px-1.5 py-0.5 rounded font-bold uppercase"><RefreshCcw size={10} /> Pending</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-border bg-surface">
                    <button 
                        onClick={() => {
                            const approved = images.filter(i => i.status === 'approved');
                            if(approved.length) alert(`Downloading ${approved.length} approved images...`);
                            else alert("No approved images to download.");
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-white/10"
                    >
                        <Download size={14} /> Download Approved
                    </button>
                </div>
            </div>

            {/* Center: Viewer */}
            <div className="flex-1 flex flex-col bg-[#0c0c0e] relative min-w-0">
                <div className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shadow-sm z-20">
                    <div className="font-mono text-sm text-white truncate max-w-xl flex items-center gap-2">
                        <ImageIcon size={16} className="text-primary"/>
                        {current.name}
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setQcIndex(Math.max(0, qcIndex - 1))}
                            disabled={qcIndex === 0}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surfaceHighlight hover:bg-border text-white disabled:opacity-30 disabled:hover:bg-surfaceHighlight transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button 
                            onClick={() => setQcIndex(Math.min(images.length - 1, qcIndex + 1))}
                            disabled={qcIndex === images.length - 1}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surfaceHighlight hover:bg-border text-white disabled:opacity-30 disabled:hover:bg-surfaceHighlight transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-8 flex items-center justify-center relative overflow-hidden">
                    {/* Loading Overlay */}
                    {isRegenerating ? (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                            <div className="text-white text-lg font-medium">Generating variation...</div>
                            <div className="text-muted text-sm mt-2">Sending prompt to {backendUrl}</div>
                        </div>
                    ) : null}

                    {/* Image Area */}
                    <div className="relative w-full h-full flex items-center justify-center">
                        {compareMode && current.oldUrl ? (
                            <ComparisonView oldUrl={current.oldUrl} newUrl={current.url} />
                        ) : (
                            <img 
                                src={current.url} 
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg border border-border/50" 
                                alt="Preview" 
                            />
                        )}
                        
                        {/* Status Watermark if decided */}
                        {current.status !== 'pending' && (
                            <div className={`
                                absolute top-4 right-4 px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider shadow-lg backdrop-blur-md border
                                ${current.status === 'approved' ? 'bg-success/20 border-success/50 text-success' : 'bg-danger/20 border-danger/50 text-danger'}
                            `}>
                                {current.status}
                            </div>
                        )}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="h-24 bg-surface border-t border-border flex items-center justify-center gap-6 px-8 z-20">
                    <button 
                        onClick={() => {
                            const updated = [...images];
                            updated[qcIndex].status = 'approved';
                            setImages(updated);
                            if (qcIndex < images.length - 1) setQcIndex(qcIndex + 1);
                        }}
                        className="flex-1 max-w-[220px] h-12 bg-success hover:bg-emerald-500 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-success/20 flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                    >
                        <CheckCircle2 size={20} /> Approve
                    </button>
                    
                    <button 
                        onClick={handleRegenerate}
                        disabled={isRegenerating}
                        className="flex-1 max-w-[220px] h-12 bg-primary hover:bg-primaryHover text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm uppercase tracking-wide disabled:opacity-50 disabled:scale-100"
                    >
                        <RefreshCcw size={20} /> Regenerate
                    </button>

                    {current.oldUrl && (
                        <button 
                            onClick={() => setCompareMode(!compareMode)}
                            className={`flex-1 max-w-[220px] h-12 border-2 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wide ${compareMode ? 'bg-white text-black border-white' : 'border-white/20 text-white hover:bg-white/10'}`}
                        >
                            <SplitSquareHorizontal size={20} /> Compare
                        </button>
                    )}

                    <button 
                        onClick={() => {
                            const updated = [...images];
                            updated[qcIndex].status = 'rejected';
                            setImages(updated);
                            if (qcIndex < images.length - 1) setQcIndex(qcIndex + 1);
                        }}
                        className="flex-1 max-w-[220px] h-12 bg-surfaceHighlight hover:bg-danger text-white hover:text-white border border-border hover:border-danger font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-2 text-sm uppercase tracking-wide group"
                    >
                        <XCircle size={20} className="text-danger group-hover:text-white transition-colors" /> Reject
                    </button>
                </div>
            </div>

            {/* Right: Context */}
            <div className="w-80 bg-surface border-l border-border flex flex-col flex-shrink-0 overflow-y-auto z-10 shadow-xl">
                <div className="p-5 border-b border-border">
                    <h3 className="font-bold text-xs uppercase text-muted tracking-wider mb-3 flex items-center gap-2">
                        <FileText size={14} /> Prompt Details
                    </h3>
                    <div className="relative">
                        <textarea 
                            className="w-full h-40 bg-[#0c0c0e] border border-border rounded-lg p-3 text-xs font-mono text-gray-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none leading-relaxed"
                            value={current.prompt}
                            onChange={(e) => {
                                const updated = [...images];
                                updated[qcIndex].prompt = e.target.value;
                                setImages(updated);
                            }}
                        />
                        <div className="absolute bottom-2 right-2">
                            <button 
                                onClick={() => {
                                    const updated = [...images];
                                    updated[qcIndex].prompt = current.originalPrompt;
                                    setImages(updated);
                                }}
                                className="p-1.5 bg-surface border border-border rounded hover:border-primary text-muted hover:text-primary transition-colors"
                                title="Reset Prompt"
                            >
                                <RefreshCcw size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-b border-border">
                    <h3 className="font-bold text-xs uppercase text-muted tracking-wider mb-4 flex items-center gap-2">
                        <Settings size={14} /> Character Outfits
                    </h3>
                    {chars.length === 0 ? (
                        <div className="p-4 bg-surfaceHighlight/30 rounded-lg border border-border/50 text-center">
                            <div className="text-xs text-muted italic">No specific characters detected in prompt text.</div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {chars.map(char => (
                                <div key={char.name} className="bg-surfaceHighlight/30 p-3 rounded-lg border border-border/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-white">{char.name}</span>
                                        <span className="text-[10px] uppercase bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/20">{char.outfit}</span>
                                    </div>
                                    <select 
                                        className="w-full bg-[#0c0c0e] border border-border rounded px-2 py-2 text-xs text-gray-300 focus:border-primary outline-none"
                                        value={outfitOverride[char.name] || 'default'}
                                        onChange={(e) => setOutfitOverride(p => ({...p, [char.name]: e.target.value}))}
                                    >
                                        <option value="default">Default Prompt</option>
                                        <option value="patient">🏥 Patient Gown</option>
                                        <option value="casual">👕 Casual Wear</option>
                                        <option value="formal">👔 Formal Suit</option>
                                        <option value="santai">🏠 Home Wear</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-5 flex-1">
                    <h3 className="font-bold text-xs uppercase text-muted tracking-wider mb-4 flex items-center gap-2">
                        <AlertCircle size={14} /> Scene Context
                    </h3>
                    <div className="space-y-3">
                         <div className="bg-background border border-border rounded-lg p-3">
                            <div className="text-[10px] text-muted uppercase font-bold mb-1">Detected Setting</div>
                            <div className="text-xs font-mono text-primary bg-primary/10 inline-block px-1.5 py-0.5 rounded">{detectSettingFromPrompt(current.prompt)}</div>
                         </div>
                         <div className="bg-background border border-border rounded-lg p-3">
                            <div className="text-[10px] text-muted uppercase font-bold mb-1">File Source</div>
                            <div className="text-xs font-mono text-gray-400 break-all">{current.name}</div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex h-screen bg-background text-gray-200 font-sans selection:bg-primary selection:text-white overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-surface border-r border-border flex flex-col flex-shrink-0 z-20 shadow-2xl">
            <div className="h-16 flex items-center px-6 border-b border-border bg-surfaceHighlight/10">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-600 rounded-lg mr-3 shadow-lg shadow-primary/20 flex items-center justify-center text-white font-bold text-xs">VN</div>
                <div>
                    <h1 className="font-bold text-white leading-tight tracking-tight">VN-ERP</h1>
                    <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Production Suite</div>
                </div>
            </div>
            
            <div className="flex-1 py-6 space-y-1 overflow-y-auto">
                <div className="px-6 mb-2 text-[10px] font-bold text-muted uppercase tracking-wider opacity-70">Overview</div>
                <SidebarItem 
                    icon={LayoutDashboard} 
                    label="Dashboard" 
                    active={currentView === 'dashboard'} 
                    onClick={() => setCurrentView('dashboard')} 
                />
                
                <div className="px-6 mt-8 mb-2 text-[10px] font-bold text-muted uppercase tracking-wider opacity-70">Pipeline</div>
                <SidebarItem 
                    icon={FileText} 
                    label="Asset Extraction" 
                    active={currentView === 'extraction'} 
                    onClick={() => setCurrentView('extraction')} 
                />
                <SidebarItem 
                    icon={CheckCircle2} 
                    label="QC Studio" 
                    active={currentView === 'qc'} 
                    onClick={() => setCurrentView('qc')}
                    badge={images.length}
                />
                <SidebarItem 
                    icon={RefreshCcw} 
                    label="Retry Queue" 
                    active={currentView === 'retry'} 
                    onClick={() => setCurrentView('retry')} 
                />
            </div>

            <div className="p-4 border-t border-border bg-[#121215]">
                <div className="bg-background rounded-lg p-3 border border-border shadow-inner">
                    <label className="text-[10px] font-bold text-muted uppercase block mb-1.5 flex items-center justify-between">
                        Backend Connection
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
                    </label>
                    <input 
                        type="text" 
                        value={backendUrl}
                        onChange={(e) => setBackendUrl(e.target.value)}
                        className="w-full bg-[#0c0c0e] border border-border rounded px-2 py-1.5 text-xs text-white focus:border-primary outline-none transition-all font-mono"
                    />
                </div>
            </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
             {currentView === 'dashboard' && renderDashboard()}
             {currentView === 'extraction' && renderExtraction()}
             {currentView === 'qc' && renderQC()}
             {currentView === 'retry' && (
                 <div className="flex items-center justify-center h-full text-muted flex-col animate-in fade-in zoom-in duration-300">
                     <div className="w-24 h-24 bg-surfaceHighlight rounded-full flex items-center justify-center mb-6">
                        <RefreshCcw size={40} className="text-muted opacity-50"/>
                     </div>
                     <div className="text-2xl font-bold text-white">Retry Queue Empty</div>
                     <p className="text-sm mt-2 max-w-xs text-center text-gray-400">Failed generations from the automated pipeline will appear here automatically for manual review.</p>
                 </div>
             )}
        </div>
    </div>
  );
}