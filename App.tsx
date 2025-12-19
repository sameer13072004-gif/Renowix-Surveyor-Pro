
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  FileText, 
  History, 
  Printer, 
  CheckCircle,
  PlusCircle,
  MinusCircle,
  X,
  ChevronRight,
  Briefcase,
  User,
  MapPin,
  Ruler,
  PaintRoller,
  Hammer,
  Utensils,
  Monitor,
  Layers,
  Box,
  Sparkles,
  Loader2,
  Table as TableIcon,
  Ruler as RulerIcon,
  Download,
  DoorOpen,
  Layout,
  Maximize,
  Coins,
  Percent,
  CircleDollarSign
} from 'lucide-react';
import { 
  ActiveService, 
  ClientDetails, 
  MeasurementItem, 
  PageView, 
  Project, 
  ServiceTypeDef, 
  Wall, 
  CeilingSection, 
  CabinetSection,
  Deduction 
} from './types';
import { SERVICE_DATA, DEFAULT_TERMS } from './constants';
import { generateCSV, downloadCSV } from './csvHelper';

const LOGO_URL = "https://renowix.in/wp-content/uploads/2025/12/Picsart_25-12-04_19-18-42-905-scaled.png";

export default function App() {
  const [view, setView] = useState<PageView>('setup');
  const [surveyorName, setSurveyorName] = useState<string>('');
  const [client, setClient] = useState<ClientDetails>({ name: '', address: '' });
  const [services, setServices] = useState<ActiveService[]>([]);
  const [terms, setTerms] = useState<string>(DEFAULT_TERMS);
  const [tempService, setTempService] = useState<Partial<ActiveService> | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<{ sIdx: number; iIdx: number } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('renowix_surveyor');
    if (savedName) {
      setSurveyorName(savedName);
      setView('welcome');
    }
    const savedProjects = localStorage.getItem('renowix_history');
    if (savedProjects) {
      setProjects(JSON.parse(savedProjects));
    }
  }, []);

  // Mark project as dirty whenever client details or services change
  useEffect(() => {
    if (services.length > 0 || client.name) {
      setIsDirty(true);
    }
  }, [services, client]);

  const saveHistory = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
    localStorage.setItem('renowix_history', JSON.stringify(updatedProjects));
    setIsDirty(false); // Reset dirty flag after saving
  };

  const handleBackNavigation = (targetView: PageView) => {
    if (isDirty && (view === 'dashboard' || view === 'client-details')) {
      const confirmSave = window.confirm("You have unsaved changes. Do you want to save this project before leaving?");
      if (confirmSave) {
        saveProject();
        setView(targetView);
      } else {
        const discard = window.confirm("Discard all changes and exit?");
        if (discard) {
          setIsDirty(false);
          setView(targetView);
        }
      }
    } else {
      setView(targetView);
    }
  };

  const handleStartProject = () => {
    if (!client.name) return alert("Please enter client name");
    setView('dashboard');
  };

  const handleAddService = (catId: string, typeId: string, customName?: string, customDesc?: string) => {
    const cat = SERVICE_DATA[catId];
    const type = cat.items.find(i => i.id === typeId);
    if (!cat || !type) return;

    const newService: Partial<ActiveService> = {
      categoryId: cat.id,
      typeId: type.id,
      name: customName || type.name,
      desc: customDesc || type.desc,
      unit: type.unit || cat.unit,
      isKitchen: type.type === 'kitchen',
      isCustom: type.type === 'custom',
      items: [],
      rate: type.rate
    };
    
    setTempService(newService);
    setEditingItemIndex(null);
    setView('measure');
  };

  const handleSaveMeasurement = (item: MeasurementItem) => {
    if (!tempService) return;
    if (item.netArea <= 0) return alert("Measurement area must be greater than zero.");

    const newServices = [...services];
    if (editingItemIndex !== null) {
      const { sIdx, iIdx } = editingItemIndex;
      newServices[sIdx].items[iIdx] = item;
      setServices(newServices);
    } else {
      const existingServiceIdx = services.findIndex(s => 
        s.categoryId === tempService.categoryId && 
        s.typeId === tempService.typeId && 
        s.name === tempService.name
      );
      if (existingServiceIdx >= 0) {
        newServices[existingServiceIdx].items.push(item);
      } else {
        const fullService: ActiveService = {
          ...(tempService as ActiveService),
          instanceId: Date.now().toString(),
          items: [item]
        };
        newServices.push(fullService);
      }
      setServices(newServices);
    }
    setView('dashboard');
  };

  const deleteItem = (sIdx: number, iIdx: number) => {
    if (!confirm("Delete this item?")) return;
    const newServices = [...services];
    newServices[sIdx].items.splice(iIdx, 1);
    if (newServices[sIdx].items.length === 0) {
      newServices.splice(sIdx, 1);
    }
    setServices(newServices);
  };

  const deleteServiceCategory = (sIdx: number) => {
    if (!confirm("Delete this entire service category and all its measurements?")) return;
    const newServices = [...services];
    newServices.splice(sIdx, 1);
    setServices(newServices);
  };

  const editItem = (sIdx: number, iIdx: number) => {
    const s = services[sIdx];
    setTempService({ ...s });
    setEditingItemIndex({ sIdx, iIdx });
    setView('measure');
  };

  const saveProject = () => {
    if (services.length === 0) return alert("Add at least one measurement before saving.");
    const newProject: Project = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      client,
      services,
      terms
    };
    const newHistory = [newProject, ...projects];
    saveHistory(newHistory);
    alert("Project saved to History!");
  };

  if (view === 'quote') {
    return (
      <QuoteView 
        client={client} 
        services={services} 
        terms={terms} 
        onBack={() => setView('dashboard')} 
      />
    );
  }

  if (view === 'measurement-sheet') {
    return (
      <MeasurementSheetView 
        client={client} 
        services={services} 
        onBack={() => setView('dashboard')} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center sm:py-6 text-slate-800 font-sans">
      <div className="w-full max-w-xl bg-white sm:rounded-3xl shadow-2xl flex flex-col min-h-screen sm:min-h-[85vh] relative overflow-hidden">
        
        {view !== 'setup' && (
          <div className="px-4 py-2 bg-white border-b border-gray-100 sticky top-0 z-50 flex items-center justify-between shadow-sm">
            <img src={LOGO_URL} alt="Renowix" className="h-10 w-auto object-contain" />
            <div className="flex items-center gap-1">
               <span className="text-sm font-bold text-slate-800 tracking-tight">Surveyor</span>
               <span className="text-sm font-bold text-yellow-500">Pro</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/50">
          {view === 'setup' && (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-slate-800 text-white text-center">
              <div className="mb-8 p-1 bg-white rounded-2xl shadow-2xl overflow-hidden ring-4 ring-slate-700">
                <img src={LOGO_URL} alt="Renowix" className="h-20 sm:h-24 w-auto object-contain scale-110" />
              </div>
              <h2 className="text-3xl font-display font-bold mb-2">Welcome Surveyor</h2>
              <p className="text-gray-400 mb-8 max-w-xs">Professional renovation measurement & quotation tool.</p>
              
              <div className="w-full max-w-xs space-y-4">
                <input 
                  type="text" 
                  className="w-full p-4 text-center text-lg bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:border-brand-gold outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"
                  placeholder="Enter Your Name"
                  value={surveyorName}
                  onChange={e => setSurveyorName(e.target.value)}
                />
                <button 
                  onClick={() => {
                    if(surveyorName) {
                      localStorage.setItem('renowix_surveyor', surveyorName);
                      setView('welcome');
                    }
                  }}
                  className="w-full bg-brand-gold text-slate-900 py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 active:scale-[0.98] transition-all shadow-xl"
                >
                  Get Started
                </button>
              </div>
            </div>
          )}

          {view === 'welcome' && (
            <div className="p-6">
              <div className="mb-8">
                  <h2 className="text-2xl font-display font-bold text-slate-900">Hello, <span className="text-brand-gold">{surveyorName}</span></h2>
                  <p className="text-gray-500 mt-1">Ready to create a new estimate?</p>
              </div>
               
              <div className="space-y-4">
                <button 
                  onClick={() => {
                     setClient({name: '', address: ''});
                     setServices([]);
                     setView('client-details');
                  }}
                  className="group w-full bg-slate-800 text-white p-6 rounded-2xl shadow-xl flex items-center justify-between hover:bg-slate-700 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 p-3 rounded-full text-brand-gold">
                      <Plus size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-lg">Create New Quote</h3>
                      <p className="text-sm text-gray-400">Start a fresh measurement</p>
                    </div>
                  </div>
                  <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </button>

                <button 
                  onClick={() => setView('history')}
                  className="w-full bg-white border border-gray-200 p-5 rounded-2xl flex items-center justify-between hover:bg-gray-50 active:scale-[0.99] transition-all"
                >
                   <div className="flex items-center gap-4">
                    <div className="bg-gray-100 p-3 rounded-full text-gray-600">
                      <History size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-slate-800">Project History</h3>
                      <p className="text-sm text-gray-500">View past estimates</p>
                    </div>
                  </div>
                  <ChevronRight className="text-gray-400" />
                </button>
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="p-6">
              <Header title="Project History" onBack={() => setView('welcome')} />
              <div className="mt-6 space-y-4">
                {projects.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Briefcase size={48} className="mb-4 opacity-20" />
                    <p>No saved projects found.</p>
                  </div>
                )}
                {projects.map((p, idx) => (
                  <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-soft">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                         <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                            <User size={18} />
                         </div>
                         <div>
                            <h3 className="font-bold text-slate-800">{p.client.name}</h3>
                            <p className="text-xs text-gray-500">{p.date}</p>
                         </div>
                      </div>
                      <button onClick={() => {
                          const newP = [...projects];
                          newP.splice(idx, 1);
                          saveHistory(newP);
                        }} className="text-gray-300 hover:text-red-500 p-2">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <button onClick={() => {
                          setClient(p.client);
                          setServices(p.services);
                          setTerms(p.terms || DEFAULT_TERMS);
                          setView('dashboard');
                        }} className="w-full py-3 text-sm font-semibold bg-gray-50 text-slate-700 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all">
                        LOAD PROJECT
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'client-details' && (
            <div className="p-6 pb-32">
              <Header title="Project Details" onBack={() => handleBackNavigation('welcome')} />
              <div className="mt-8 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-card">
                  <InputGroup label="Client Name">
                    <input 
                      type="text" 
                      value={client.name}
                      onChange={e => setClient({...client, name: e.target.value})}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-all"
                      placeholder="e.g. Mr. Rajesh Kumar"
                    />
                  </InputGroup>
                  <div className="h-4"></div>
                  <InputGroup label="Site Address">
                    <textarea 
                      value={client.address}
                      onChange={e => setClient({...client, address: e.target.value})}
                      rows={3}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-all resize-none"
                      placeholder="Full Site Address"
                    />
                  </InputGroup>
                </div>
              </div>
              <Footer>
                <button onClick={handleStartProject} className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold hover:bg-slate-700 active:scale-[0.98] transition-all">
                  Create Project Dashboard
                </button>
              </Footer>
            </div>
          )}

          {view === 'dashboard' && (
            <div className="p-4 sm:p-6 pb-44">
              <Header title="Project Dashboard" onBack={() => handleBackNavigation('client-details')} />
              
              {/* Premium Client Card */}
              <div className="mt-4 bg-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
                 {/* Decorative background elements */}
                 <div className="absolute -top-12 -right-12 w-48 h-48 bg-brand-gold/10 rounded-full blur-3xl group-hover:bg-brand-gold/20 transition-all duration-700"></div>
                 <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700"></div>
                 <div className="absolute inset-0 border border-white/5 rounded-2xl"></div>

                 <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                   <div className="space-y-3">
                     <div className="inline-flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                        <User size={14} className="text-brand-gold" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Client Profile</span>
                     </div>
                     <h3 className="text-2xl font-display font-black text-white leading-none tracking-tight">{client.name || "Unnamed Client"}</h3>
                     <div className="flex items-center gap-2 text-gray-400">
                        <MapPin size={12} className="text-brand-gold/60" />
                        <span className="text-xs truncate max-w-[200px] font-medium italic">{client.address || 'Address details missing'}</span>
                     </div>
                   </div>
                   
                   <div className="w-full sm:w-auto text-left sm:text-right bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                      <div className="flex items-center sm:justify-end gap-2 mb-1">
                        <Coins size={14} className="text-brand-gold" />
                        <p className="text-[10px] uppercase text-brand-gold font-black tracking-widest">Total Estimate</p>
                      </div>
                      <p className="text-4xl font-display font-black text-white leading-none">
                        <span className="text-xl font-sans mr-1 opacity-50 font-normal">₹</span>
                        {Math.round(services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0)).toLocaleString()}
                      </p>
                   </div>
                 </div>
              </div>

              <div className="mt-10 space-y-4">
                <div className="flex items-center justify-between px-1">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2">
                     <Layers size={18} className="text-brand-gold" />
                     Service Items
                   </h3>
                   {services.length === 0 && <span className="text-xs text-gray-400">No measurements added yet</span>}
                </div>

                {services.map((s, sIdx) => (
                  <div key={sIdx} className="bg-white border-l-4 border-l-yellow-500 rounded-xl shadow-card overflow-hidden transition-all hover:shadow-md">
                    <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <ServiceIcon categoryId={s.categoryId} typeId={s.typeId} name={s.name} />
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{s.name}</h4>
                          <p className="text-xs text-gray-500">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} {s.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800 text-sm">
                          ₹ {Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}
                        </span>
                        <button onClick={() => deleteServiceCategory(sIdx)} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {s.items.map((item, iIdx) => (
                        <div key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                           <div>
                             <p className="font-semibold text-slate-700 text-sm">{item.name}</p>
                             <p className="text-xs text-gray-400 mt-0.5">₹{item.rate} / {s.unit}</p>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-800 text-sm">₹{Math.round(item.cost).toLocaleString()}</span>
                              <div className="flex gap-1">
                                <button onClick={() => editItem(sIdx, iIdx)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Edit2 size={14} /></button>
                                <button onClick={() => deleteItem(sIdx, iIdx)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={14} /></button>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setTempService({...s}); setEditingItemIndex(null); setView('measure'); }} className="w-full py-2 bg-gray-50 text-[10px] font-bold text-slate-500 border-t border-gray-100 uppercase tracking-widest hover:text-brand-gold hover:bg-gray-100 transition-all">+ Add Room/Section</button>
                  </div>
                ))}

                <button onClick={() => setView('service-select')} className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-400 rounded-2xl font-bold flex items-center justify-center gap-2 hover:border-yellow-500 hover:text-yellow-500 hover:bg-yellow-50 transition-all active:scale-[0.98]">
                  <Plus size={20} /> Add New Service Category
                </button>
              </div>

              <Footer>
                <div className="flex gap-2 w-full items-stretch h-14">
                   <button 
                    onClick={() => setView('measurement-sheet')} 
                    className="flex-1 bg-white border border-slate-200 text-slate-700 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-colors shadow-sm"
                    title="View Measurement Sheet"
                   >
                      <RulerIcon size={20} className="text-slate-400" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Sheet</span>
                   </button>

                   <button 
                    onClick={saveProject} 
                    className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-colors shadow-sm active:scale-[0.95]"
                    title="Save History"
                   >
                      <Save size={20} />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Save</span>
                   </button>
                   
                   <button 
                    onClick={() => { if(services.length > 0) setView('quote'); else alert("No data to generate quote."); }} 
                    className="flex-[2] bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-700 transition-all active:scale-[0.97]"
                   >
                      <CheckCircle size={20} className="text-brand-gold" />
                      <span className="text-sm">Generate Quote</span>
                   </button>
                </div>
              </Footer>
            </div>
          )}

          {view === 'service-select' && <ServiceSelector onBack={() => setView('dashboard')} onSelect={handleAddService} />}
          {view === 'measure' && tempService && <MeasurementForm serviceContext={tempService} editingItem={editingItemIndex !== null && tempService.items ? tempService.items[editingItemIndex.iIdx] : undefined} onBack={() => setView('dashboard')} onSave={handleSaveMeasurement} />}
        </div>
      </div>
    </div>
  );
}

function ServiceIcon({ categoryId, typeId, name }: { categoryId: string, typeId: string, name: string }) {
  const Icon = categoryId === 'painting' ? PaintRoller : (typeId === 'kitchen_mod' ? Utensils : (typeId === 'tv_unit' ? Monitor : (typeId === 'wardrobe' ? Box : Hammer)));
  return (
    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
      <Icon size={20} />
    </div>
  );
}

function Header({ title, onBack }: { title: string, onBack: () => void }) {
  return (
    <div className="flex items-center gap-4 py-2 mb-4">
      <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft size={22} /></button>
      <h1 className="font-display font-bold text-xl text-slate-900">{title}</h1>
    </div>
  );
}

function Footer({ children }: { children?: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 backdrop-blur-md p-4 border-t border-gray-200 z-[100] shadow-2xl">
      {children}
    </div>
  );
}

function InputGroup({ label, children }: { label: string, children?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}

function ServiceSelector({ onBack, onSelect }: { onBack: () => void, onSelect: (c:string, t:string, customN?:string, customD?:string) => void }) {
  const [cat, setCat] = useState('');
  const [type, setType] = useState('');
  const [customName, setCustomName] = useState('');
  const [description, setDescription] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => { setType(cat === 'custom' ? 'custom_item' : ''); }, [cat]);
  useEffect(() => {
    if (cat && type && cat !== 'custom') {
       const typeItem = SERVICE_DATA[cat]?.items.find(i => i.id === type);
       if (typeItem) setDescription(typeItem.desc);
    }
  }, [cat, type]);

  const handleAiRewrite = async () => {
    if (!description.trim()) return;
    setIsAiLoading(true);
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key not found");
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Strictly produce a concise 3 to 4 line paragraph description for a professional renovation service. Use simple, persuasive language. Highlight materials used and the primary benefit to the customer. 
      DO NOT use markdown, DO NOT use bullet points, DO NOT provide multiple options, DO NOT include conversational text like "Here is the rewrite". 
      Input context: "${description}"`;

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt,
        config: { temperature: 0.7 } 
      });
      if (response.text) setDescription(response.text.trim());
    } catch (e) { alert("AI error. Check API key."); }
    finally { setIsAiLoading(false); }
  };

  return (
    <div className="p-6 pb-32">
      <Header title="Select Service" onBack={onBack} />
      <div className="space-y-6">
        <InputGroup label="Category">
          <select className="w-full p-4 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand-gold transition-all" value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">Choose Category...</option>
            {Object.values(SERVICE_DATA).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </InputGroup>
        {cat && cat !== 'custom' && (
          <InputGroup label="Service Type">
            <select className="w-full p-4 bg-white border border-gray-200 rounded-xl outline-none focus:border-brand-gold transition-all" value={type} onChange={e => setType(e.target.value)}>
              <option value="">Choose Service...</option>
              {SERVICE_DATA[cat].items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </InputGroup>
        )}
        {cat === 'custom' && (
          <InputGroup label="Name">
            <input type="text" className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:border-brand-gold transition-all" placeholder="e.g. Tile Work" value={customName} onChange={e => setCustomName(e.target.value)} />
          </InputGroup>
        )}
        {cat && type && (
          <div className="bg-yellow-50 p-5 rounded-2xl border border-dashed border-yellow-200">
            <InputGroup label="Description (Editable)">
              <textarea rows={6} className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none resize-none text-sm" value={description} onChange={e => setDescription(e.target.value)} />
              <button onClick={handleAiRewrite} disabled={isAiLoading} className="mt-2 w-full bg-slate-800 text-white p-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors active:scale-[0.98]">
                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Professional AI Rewrite
              </button>
            </InputGroup>
          </div>
        )}
      </div>
      <Footer>
        <button onClick={() => onSelect(cat, type, customName, description)} disabled={!cat || !type} className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold disabled:opacity-50 hover:bg-slate-700 active:scale-[0.98] transition-all">Proceed</button>
      </Footer>
    </div>
  );
}

function MeasurementForm({ serviceContext, editingItem, onBack, onSave }: { serviceContext: Partial<ActiveService>, editingItem?: MeasurementItem, onBack: () => void, onSave: (item: MeasurementItem) => void }) {
  const [name, setName] = useState(editingItem?.name || '');
  const [rate, setRate] = useState<number>(editingItem?.rate || serviceContext.rate || 0);
  const [walls, setWalls] = useState<Wall[]>(editingItem?.walls || []);
  const [ceilings, setCeilings] = useState<CeilingSection[]>(editingItem?.ceilings || []);
  const [extraAreas, setExtraAreas] = useState<CeilingSection[]>(editingItem?.extraAreas || []);
  const [cabinetSections, setCabinetSections] = useState<CabinetSection[]>(editingItem?.cabinetSections || []);
  const [deductions, setDeductions] = useState<Deduction[]>(editingItem?.deductions || []);
  const [height, setHeight] = useState<number>(editingItem?.height || 10);
  const [l, setL] = useState<number>(editingItem?.l || 0);
  const [b, setB] = useState<number>(editingItem?.b || 0);
  const [q, setQ] = useState<number>(editingItem?.q || 1);

  const isWoodwork = serviceContext.categoryId === 'woodwork' || serviceContext.isCustom || serviceContext.isKitchen;

  useEffect(() => { 
    if (!editingItem) {
      if (serviceContext.categoryId === 'painting' && walls.length === 0) {
        setWalls([1,2,3,4].map(id => ({id: id.toString(), width: 0})));
      }
      if (isWoodwork && cabinetSections.length === 0) {
        setCabinetSections([{ id: Date.now().toString(), name: 'Section 1', l: 0, b: 0, q: 1 }]);
      }
    }
  }, []);

  const calculateTotal = (): number => {
    if (isWoodwork) {
      return cabinetSections.reduce((acc, section) => acc + ((section.l || 0) * (section.b || 0) * (section.q || 1)), 0);
    }
    if (serviceContext.categoryId === 'painting') {
      const wArea = walls.reduce((s, w) => s + (w.width || 0), 0) * height;
      const cArea = ceilings.reduce((s, c) => s + (c.l * c.b), 0);
      const eArea = extraAreas.reduce((s, e) => s + (e.l * e.b), 0);
      const dArea = deductions.reduce((s, d) => s + (d.area * d.qty), 0);
      return Math.max(0, wArea + cArea + eArea - dArea);
    }
    return (l || 0) * (b || 1) * (q || 1) || (l * q);
  };

  const netArea = calculateTotal();
  const cost = netArea * rate;

  const addCabinetSection = () => {
    setCabinetSections([...cabinetSections, { id: Date.now().toString(), name: `Section ${cabinetSections.length + 1}`, l: 0, b: 0, q: 1 }]);
  };

  const removeCabinetSection = (id: string) => {
    setCabinetSections(cabinetSections.filter(s => s.id !== id));
  };

  const updateCabinetSection = (id: string, field: keyof CabinetSection, val: any) => {
    setCabinetSections(cabinetSections.map(s => s.id === id ? { ...s, [field]: val } : s));
  };

  const addCeiling = () => {
    setCeilings([...ceilings, { id: Date.now().toString(), l: 0, b: 0 }]);
  };

  const addExtraArea = () => {
    setExtraAreas([...extraAreas, { id: Date.now().toString(), l: 0, b: 0 }]);
  };

  const addDeduction = (type: string, area: number) => {
    setDeductions([...deductions, { id: Date.now().toString(), type, area, qty: 1 }]);
  };

  return (
    <div className="p-6 pb-64">
      <Header title="Measurement" onBack={onBack} />
      <div className="space-y-6">
        <InputGroup label="Room / Main Label">
          <input 
            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-gold/10 outline-none transition-all" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder={serviceContext.isKitchen ? "e.g. Master Kitchen" : "e.g. Room 1"} 
          />
        </InputGroup>
        <InputGroup label="Rate (₹)">
          <input type="number" className="w-full p-4 border border-gray-200 rounded-xl bg-yellow-50 font-bold focus:ring-2 focus:ring-brand-gold/10 outline-none transition-all" value={rate || ''} onChange={e => setRate(parseFloat(e.target.value) || 0)} />
        </InputGroup>
        
        {isWoodwork && (
          <div className="space-y-4">
             <div className="flex justify-between items-center px-1">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dimensions / Sections</span>
               <button onClick={addCabinetSection} className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-100 hover:bg-yellow-100 active:scale-[0.95] transition-all">
                 <Plus size={12} /> Add Section
               </button>
             </div>
             <div className="space-y-3">
               {cabinetSections.map((s, idx) => (
                 <div key={s.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                   <div className="flex justify-between items-center mb-3">
                     <input 
                       className="text-xs font-bold text-slate-700 bg-transparent border-none focus:ring-0 w-32 outline-none" 
                       value={s.name} 
                       onChange={e => updateCabinetSection(s.id, 'name', e.target.value)}
                     />
                     {cabinetSections.length > 1 && (
                       <button onClick={() => removeCabinetSection(s.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                         <Trash2 size={14} />
                       </button>
                     )}
                   </div>
                   <div className="grid grid-cols-3 gap-3">
                     <div className="space-y-1">
                       <label className="text-[9px] text-gray-400 font-bold uppercase">Length (ft)</label>
                       <input type="number" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-center" value={s.l || ''} onChange={e => updateCabinetSection(s.id, 'l', parseFloat(e.target.value) || 0)} />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[9px] text-gray-400 font-bold uppercase">Breadth (ft)</label>
                       <input type="number" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-center" value={s.b || ''} onChange={e => updateCabinetSection(s.id, 'b', parseFloat(e.target.value) || 0)} />
                     </div>
                     <div className="space-y-1">
                       <label className="text-[9px] text-gray-400 font-bold uppercase">Quantity</label>
                       <input type="number" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-center font-bold" value={s.q || ''} onChange={e => updateCabinetSection(s.id, 'q', parseFloat(e.target.value) || 0)} />
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {serviceContext.categoryId === 'painting' && (
          <div className="space-y-4">
             <InputGroup label="Height (ft)"><input type="number" className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-gold/10" value={height} onChange={e => setHeight(parseFloat(e.target.value))} /></InputGroup>
             
             {/* Walls */}
             <div className="bg-white p-4 rounded-xl shadow-soft border border-gray-100">
               <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WALL WIDTHS</span><button onClick={() => setWalls([...walls, {id: Date.now().toString(), width: 0}])} className="text-[10px] font-bold text-yellow-600 hover:text-yellow-700 transition-colors">+ Add Wall</button></div>
               <div className="grid grid-cols-2 gap-3">
                 {walls.map((w, idx) => <input key={w.id} type="number" className="p-3 border border-gray-100 rounded-xl text-center bg-gray-50 focus:bg-white focus:ring-1 focus:ring-brand-gold/20 outline-none transition-all" value={w.width || ''} placeholder={`Wall ${idx+1}`} onChange={e => { const nw = [...walls]; nw[idx].width = parseFloat(e.target.value); setWalls(nw); }} />)}
               </div>
             </div>

             {/* Ceilings */}
             <div className="bg-white p-4 rounded-xl shadow-soft border border-gray-100">
               <div className="flex justify-between items-center mb-4">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CEILING SECTIONS</span>
                 <button onClick={addCeiling} className="text-[10px] font-bold text-yellow-600 hover:text-yellow-700 transition-colors">+ Add Ceiling</button>
               </div>
               {ceilings.length > 0 && (
                 <div className="space-y-3">
                   {ceilings.map((c, idx) => (
                     <div key={c.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-transparent hover:border-brand-gold/10 transition-colors">
                       <div className="flex-1">
                         <label className="text-[8px] text-gray-400 uppercase font-bold block mb-0.5">Length</label>
                         <input type="number" className="w-full p-1 bg-transparent text-xs font-bold outline-none" value={c.l || ''} placeholder="0" onChange={e => { const nc = [...ceilings]; nc[idx].l = parseFloat(e.target.value) || 0; setCeilings(nc); }} />
                       </div>
                       <div className="text-gray-300 text-[10px]">×</div>
                       <div className="flex-1">
                         <label className="text-[8px] text-gray-400 uppercase font-bold block mb-0.5">Breadth</label>
                         <input type="number" className="w-full p-1 bg-transparent text-xs font-bold outline-none" value={c.b || ''} placeholder="0" onChange={e => { const nc = [...ceilings]; nc[idx].b = parseFloat(e.target.value) || 0; setCeilings(nc); }} />
                       </div>
                       <button onClick={() => { const nc = [...ceilings]; nc.splice(idx, 1); setCeilings(nc); }} className="text-gray-300 hover:text-red-500 p-1 transition-colors"><Trash2 size={12}/></button>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             {/* Extra Areas */}
             <div className="bg-white p-4 rounded-xl shadow-soft border border-gray-100">
               <div className="flex justify-between items-center mb-4">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EXTRA AREAS</span>
                 <button onClick={addExtraArea} className="text-[10px] font-bold text-yellow-600 hover:text-yellow-700 transition-colors">+ Add Extra Area</button>
               </div>
               {extraAreas.length > 0 && (
                 <div className="space-y-3">
                   {extraAreas.map((ea, idx) => (
                     <div key={ea.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-transparent hover:border-brand-gold/10 transition-colors">
                       <div className="flex-1">
                         <label className="text-[8px] text-gray-400 uppercase font-bold block mb-0.5">Length</label>
                         <input type="number" className="w-full p-1 bg-transparent text-xs font-bold outline-none" value={ea.l || ''} placeholder="0" onChange={e => { const nea = [...extraAreas]; nea[idx].l = parseFloat(e.target.value) || 0; setExtraAreas(nea); }} />
                       </div>
                       <div className="text-gray-300 text-[10px]">×</div>
                       <div className="flex-1">
                         <label className="text-[8px] text-gray-400 uppercase font-bold block mb-0.5">Breadth</label>
                         <input type="number" className="w-full p-1 bg-transparent text-xs font-bold outline-none" value={ea.b || ''} placeholder="0" onChange={e => { const nea = [...extraAreas]; nea[idx].b = parseFloat(e.target.value) || 0; setExtraAreas(nea); }} />
                       </div>
                       <button onClick={() => { const nea = [...extraAreas]; nea.splice(idx, 1); setExtraAreas(nea); }} className="text-gray-300 hover:text-red-500 p-1 transition-colors"><Trash2 size={12}/></button>
                     </div>
                   ))}
                 </div>
               )}
             </div>
             
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
               <div className="flex justify-between items-center mb-4">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DEDUCTIONS</span>
               </div>
               <div className="flex gap-2 mb-4">
                 <button onClick={() => addDeduction('Door', 21)} className="flex-1 py-2 px-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center gap-1 group hover:border-brand-gold transition-all active:scale-[0.95]">
                    <DoorOpen size={16} className="text-slate-400 group-hover:text-brand-gold" />
                    <span className="text-[9px] font-bold text-slate-600 uppercase">Door</span>
                 </button>
                 <button onClick={() => addDeduction('Window', 12)} className="flex-1 py-2 px-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center gap-1 group hover:border-brand-gold transition-all active:scale-[0.95]">
                    <Layout size={16} className="text-slate-400 group-hover:text-brand-gold" />
                    <span className="text-[9px] font-bold text-slate-600 uppercase">Window</span>
                 </button>
                 <button onClick={() => addDeduction('Other', 0)} className="flex-1 py-2 px-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center gap-1 group hover:border-brand-gold transition-all active:scale-[0.95]">
                    <Plus size={16} className="text-slate-400 group-hover:text-brand-gold" />
                    <span className="text-[9px] font-bold text-slate-600 uppercase">Other</span>
                 </button>
               </div>

               {deductions.length > 0 && (
                 <div className="grid grid-cols-1 gap-2 border-t border-gray-50 pt-4">
                   {deductions.map((d, idx) => (
                     <div key={d.id} className="flex gap-3 items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100 transition-shadow hover:shadow-sm">
                       <div className="w-16">
                         <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">{d.type}</span>
                         <div className="text-[10px] font-bold text-slate-700">Ref {idx+1}</div>
                       </div>
                       <div className="flex-1">
                         <label className="text-[8px] text-gray-400 uppercase font-bold block mb-1">Area (sqft)</label>
                         <input type="number" className="w-full p-1 bg-transparent text-xs font-bold outline-none border-b border-transparent focus:border-brand-gold" value={d.area || ''} placeholder="0" onChange={e => { const nd = [...deductions]; nd[idx].area = parseFloat(e.target.value) || 0; setDeductions(nd); }} />
                       </div>
                       <div className="text-gray-300 text-[10px] self-end pb-1.5">×</div>
                       <div className="w-10">
                         <label className="text-[8px] text-gray-400 uppercase font-bold block mb-1">Qty</label>
                         <input type="number" className="w-full p-1 bg-transparent text-xs font-bold outline-none border-b border-transparent focus:border-brand-gold text-center" value={d.qty || ''} placeholder="1" onChange={e => { const nd = [...deductions]; nd[idx].qty = parseFloat(e.target.value) || 0; setDeductions(nd); }} />
                       </div>
                       <button onClick={() => { const nd = [...deductions]; nd.splice(idx,1); setDeductions(nd); }} className="ml-2 p-2 text-slate-300 hover:text-red-500 transition-colors">
                         <Trash2 size={16}/>
                       </button>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        )}
      </div>
      <Footer>
        <div className="mb-4 flex justify-between items-center bg-slate-800 text-white p-4 rounded-2xl shadow-xl">
          <div className="text-left"><p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Quantity</p><p className="font-bold text-lg">{netArea.toFixed(2)} {serviceContext.unit}</p></div>
          <div className="text-right"><p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Section Cost</p><p className="font-bold text-xl text-brand-gold">₹{Math.round(cost).toLocaleString()}</p></div>
        </div>
        <button onClick={() => onSave({ id: editingItem?.id || Date.now().toString(), name: name || "Item", netArea, rate, cost, l, b, q, height, walls, ceilings, extraAreas, cabinetSections, deductions })} className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold hover:bg-slate-700 active:scale-[0.98] transition-all shadow-lg">Save Measurement</button>
      </Footer>
    </div>
  );
}

function QuoteView({ client, services, terms: initialTerms, onBack }: { client: ClientDetails, services: ActiveService[], terms: string, onBack: () => void }) {
  const [terms, setTerms] = useState(initialTerms);
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  
  const subTotal = services.reduce((s, ser) => s + ser.items.reduce((is, i) => is + i.cost, 0), 0);
  
  const discountAmount = useMemo(() => {
    if (discountType === 'percent') return (subTotal * discountValue) / 100;
    if (discountType === 'fixed') return discountValue;
    return 0;
  }, [subTotal, discountType, discountValue]);

  const finalTotal = subTotal - discountAmount;
  const date = useMemo(() => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), []);

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col items-center p-4 print:p-0 print:bg-white print:block">
      <div className="w-full max-w-[210mm] mb-6 flex justify-between no-print items-center px-2">
        <button onClick={onBack} className="bg-white px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm">
          <ArrowLeft size={14} /> Dashboard
        </button>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:bg-slate-700 transition-colors">
            <Printer size={14} /> Print / Download
          </button>
        </div>
      </div>

      <div className="w-full max-w-[210mm] bg-white min-h-[297mm] px-10 py-10 print:px-8 print:py-8 print:m-0 text-slate-900 shadow-[0_0_50px_-10px_rgba(0,0,0,0.1)] print:shadow-none font-sans flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
          <div>
            <img src={LOGO_URL} className="h-20 print:h-16 object-contain mb-4 scale-110 -ml-1" />
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Renowix Renovations</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1 leading-none">Complete Home Interior Solutions</p>
          </div>
          <div className="text-right">
            <h2 className="text-5xl font-black text-slate-100 print:text-slate-200 uppercase leading-none mb-6">Quote</h2>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doc Ref.</p>
              <p className="font-bold text-sm">#RX-{Math.floor(Date.now() / 10000).toString().slice(-6)}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Date</p>
              <p className="font-bold text-xs">{date}</p>
            </div>
          </div>
        </div>

        {/* Client & Site Info */}
        <div className="grid grid-cols-2 gap-12 mb-10">
          <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">Client Contact</h4>
            <p className="text-xl font-black text-slate-900 mb-1">{client.name}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Preferred Project</p>
          </div>
          <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-1">Site Location</h4>
            <p className="text-[11px] leading-relaxed font-bold whitespace-pre-wrap text-slate-600">{client.address || "Address not provided"}</p>
          </div>
        </div>

        {/* Main Items Table */}
        <div className="flex-1 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="py-3 px-3 text-left font-black text-[13px] uppercase tracking-widest w-10">#</th>
                <th className="py-3 px-4 text-left font-black text-[13px] uppercase tracking-widest">Service Profile & Location</th>
                <th className="py-3 px-4 text-right font-black text-[13px] uppercase tracking-widest w-24">Quantity</th>
                <th className="py-3 px-4 text-right font-black text-[13px] uppercase tracking-widest w-24">Rate</th>
                <th className="py-3 px-4 text-right font-black text-[13px] uppercase tracking-widest w-36 whitespace-nowrap">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-x border-b border-slate-100">
              {services.map((s, idx) => (
                <tr key={idx} className="break-inside-avoid">
                  <td className="py-5 px-3 align-top font-black text-slate-300 text-xs">{(idx + 1)}</td>
                  <td className="py-5 px-4 align-top">
                    <p className="font-black text-slate-900 mb-1 uppercase tracking-tight text-sm"><strong>{s.name}</strong></p>
                    <p className="text-[9px] text-slate-400 leading-tight font-bold italic mb-3">{s.desc}</p>
                    
                    {/* Measurements summary */}
                    <div className="mt-3 space-y-1">
                      {s.items.map((item, iIdx) => (
                        <div key={iIdx} className="flex justify-between items-center text-[10px] bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 text-slate-600">
                           <span className="font-bold opacity-80">{item.name}</span>
                           <span className="font-black opacity-40">{item.netArea.toFixed(2)} {s.unit.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-5 px-4 align-top text-right font-black text-slate-900">
                    {s.items.reduce((a, b) => a + b.netArea, 0).toFixed(2)}
                  </td>
                  <td className="py-5 px-4 align-top text-right font-bold text-slate-400 text-xs">
                    ₹{s.items[0]?.rate || "0.00"}
                  </td>
                  <td className="py-5 px-4 align-top text-right font-black text-slate-900">
                    ₹{Math.round(s.items.reduce((a, b) => a + b.cost, 0)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="mt-8 flex flex-col items-end gap-4">
          {/* Discount Controls (No Print) */}
          <div className="w-full max-w-sm no-print bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
             <div className="flex items-center justify-between mb-3">
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Apply Discount</span>
               <div className="flex gap-1">
                 <button 
                  onClick={() => setDiscountType('none')}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${discountType === 'none' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
                 >
                   None
                 </button>
                 <button 
                  onClick={() => setDiscountType('percent')}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all flex items-center gap-1 ${discountType === 'percent' ? 'bg-brand-gold text-slate-900' : 'bg-white border border-slate-200 text-slate-400'}`}
                 >
                   <Percent size={10} /> Percentage
                 </button>
                 <button 
                  onClick={() => setDiscountType('fixed')}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all flex items-center gap-1 ${discountType === 'fixed' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}
                 >
                   <CircleDollarSign size={10} /> Lumpsum
                 </button>
               </div>
             </div>
             {discountType !== 'none' && (
               <div className="flex items-center gap-2">
                 <input 
                  type="number" 
                  value={discountValue || ''}
                  onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="flex-1 p-2 rounded-lg border border-slate-200 bg-white text-sm font-bold focus:ring-2 focus:ring-brand-gold/10 outline-none"
                  placeholder={discountType === 'percent' ? "Enter percentage %" : "Enter amount ₹"}
                 />
                 <div className="text-[11px] font-bold text-brand-gold">
                   {discountType === 'percent' ? `(-) ₹${Math.round(discountAmount).toLocaleString()}` : 'Lumpsum Off'}
                 </div>
               </div>
             )}
          </div>

          <div className="w-64">
            <div className="flex justify-between py-2 px-4 border-b border-slate-100">
              <span className="text-[9px] font-black text-slate-300 uppercase">Sub-Total</span>
              <span className="font-black text-sm">₹{Math.round(subTotal).toLocaleString()}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between py-2 px-4 border-b border-slate-100">
                <span className="text-[9px] font-black text-brand-gold uppercase">Discount {discountType === 'percent' ? `(${discountValue}%)` : ''}</span>
                <span className="font-black text-sm text-brand-gold">(-) ₹{Math.round(discountAmount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-2 px-4 border-b border-slate-100">
              <span className="text-[9px] font-black text-slate-300 uppercase">Taxation</span>
              <span className="text-[10px] font-bold text-slate-200">GST Extra</span>
            </div>
            <div className="flex justify-between py-4 px-5 bg-slate-800 text-white rounded-2xl shadow-2xl mt-4 scale-105 origin-right">
              <span className="text-[10px] font-black uppercase tracking-widest self-center text-brand-gold">Total (INR)</span>
              <span className="text-xl font-black">₹{Math.round(finalTotal).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Terms and Signatures */}
        <div className="mt-12 break-inside-avoid">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                 Terms & Conditions
              </h4>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 no-print">
                <textarea 
                  rows={6} 
                  className="w-full text-[10px] bg-transparent border-none outline-none resize-none leading-relaxed font-bold text-slate-500" 
                  value={terms} 
                  onChange={e => setTerms(e.target.value)} 
                />
              </div>
              <div className="print-only text-[10px] leading-relaxed text-slate-500 font-bold whitespace-pre-wrap pt-1">
                {terms}
              </div>
            </div>
            <div className="flex flex-col justify-end space-y-12 pb-4">
              <div className="flex justify-between items-end">
                <div className="text-center w-40">
                  <div className="border-t-2 border-slate-900 mb-2"></div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Renowix Auth.</p>
                </div>
                <div className="text-center w-40">
                  <div className="border-t-2 border-slate-200 mb-2"></div>
                  <p className="text-[9px] font-black uppercase text-slate-200 tracking-widest text-center">Client Sign.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center border-t border-slate-50 pt-8 opacity-20 no-print">
          <p className="text-[8px] font-black uppercase tracking-[0.8em]">Renowix Surveyor Pro Enterprise Suite</p>
        </div>
      </div>
    </div>
  );
}

function MeasurementSheetView({ client, services, onBack }: { client: ClientDetails, services: ActiveService[], onBack: () => void }) {
  const date = useMemo(() => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), []);

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col items-center p-4 print:p-0 print:bg-white print:block">
      <div className="w-full max-w-[210mm] mb-6 flex justify-between no-print items-center px-2">
        <button onClick={onBack} className="bg-white px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm">
          <ArrowLeft size={14} /> Dashboard
        </button>
        <button onClick={() => window.print()} className="bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:bg-slate-700 transition-colors">
          <Printer size={14} /> Print Meas. Sheet
        </button>
      </div>

      <div className="w-full max-w-[210mm] bg-white min-h-[297mm] px-10 py-10 print:px-8 print:py-8 print:m-0 text-slate-900 shadow-[0_0_50px_-10px_rgba(0,0,0,0.1)] print:shadow-none font-sans flex flex-col">
        {/* Branded Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
          <div>
            <img src={LOGO_URL} className="h-20 print:h-16 object-contain mb-4 scale-110 -ml-1" />
            <h1 className="text-xl font-black uppercase tracking-tighter">Renowix Renovations</h1>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-1">Measurement Portfolio (Price-Free)</p>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-black text-slate-100 print:text-slate-200 uppercase leading-none mb-4">M-Sheet</h2>
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ref Code</p>
              <p className="font-bold text-xs">MSR-{Math.floor(Date.now() / 1000).toString().slice(-6)}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Survey Date</p>
              <p className="font-bold text-xs">{date}</p>
            </div>
          </div>
        </div>

        {/* Site Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
             <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-200 pb-1">Client</h4>
             <p className="text-sm font-bold text-slate-800">{client.name}</p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
             <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-200 pb-1">Site Address</h4>
             <p className="text-[10px] leading-tight font-medium text-slate-600 whitespace-pre-wrap">{client.address}</p>
          </div>
        </div>

        {/* Spreadsheet Table */}
        <div className="flex-1">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-slate-100">
              <tr className="border-y-2 border-slate-900">
                <th className="py-3 px-2 text-left font-black uppercase tracking-widest w-10">S#</th>
                <th className="py-3 px-3 text-left font-black uppercase tracking-widest w-40">Section / Room</th>
                <th className="py-3 px-3 text-left font-black uppercase tracking-widest">Dimension Details & Breakdown</th>
                <th className="py-3 px-3 text-right font-black uppercase tracking-widest w-24">Net Area</th>
                <th className="py-3 px-3 text-left font-black uppercase tracking-widest w-16">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border-x border-b border-slate-200">
              {services.map((s, sIdx) => (
                <React.Fragment key={sIdx}>
                  {/* Service Sub-header */}
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="py-2 px-3">
                       <p className="font-black text-[10px] uppercase tracking-[0.1em] text-slate-900 flex items-center gap-2">
                          <TableIcon size={12} className="text-slate-400" /> {s.name}
                       </p>
                    </td>
                  </tr>
                  {s.items.map((item, iIdx) => (
                    <tr key={item.id} className="break-inside-avoid align-top">
                      <td className="py-4 px-2 text-slate-300 font-bold text-center">{(iIdx + 1)}</td>
                      <td className="py-4 px-3 font-bold text-slate-800 uppercase tracking-tight">{item.name}</td>
                      <td className="py-4 px-3 text-slate-500 leading-relaxed">
                        {item.cabinetSections && item.cabinetSections.length > 0 && (
                           <div className="space-y-1">
                              {item.cabinetSections.map((cab, cIdx) => (
                                 <div key={cab.id} className="flex justify-between border-b border-slate-100 last:border-0 pb-1">
                                    <span className="font-bold text-slate-600 text-[10px]">{cab.name}</span>
                                    <span>({cab.l} × {cab.b}) × {cab.q} = {(cab.l * cab.b * cab.q).toFixed(2)}</span>
                                 </div>
                              ))}
                           </div>
                        )}
                        {s.categoryId === 'painting' && (
                           <div className="space-y-1">
                              <div><span className="font-bold text-[9px] uppercase tracking-widest text-slate-400">Walls:</span> {item.walls?.map(w => w.width).join(' + ')} (Sum: {item.walls?.reduce((a,b)=>a+b.width,0)}) × H:{item.height}ft</div>
                              {item.ceilings && item.ceilings.length > 0 && (
                                <div className="text-blue-500 text-[9px] italic font-bold">
                                  Ceilings: {item.ceilings.map(c => `(${c.l}×${c.b})`).join(', ')} (Total: {item.ceilings.reduce((acc, c) => acc + (c.l * c.b), 0).toFixed(2)})
                                </div>
                              )}
                              {item.extraAreas && item.extraAreas.length > 0 && (
                                <div className="text-green-500 text-[9px] italic font-bold">
                                  Extras: {item.extraAreas.map(ea => `(${ea.l}×${ea.b})`).join(', ')} (Total: {item.extraAreas.reduce((acc, ea) => acc + (ea.l * ea.b), 0).toFixed(2)})
                                </div>
                              )}
                              {item.deductions && item.deductions.length > 0 && (
                                <div className="text-red-400 text-[9px] italic font-bold">
                                  Less Deductions: {item.deductions.map(d => `${d.type}(${d.area}×${d.qty})`).join(', ')}
                                </div>
                              )}
                           </div>
                        )}
                        {(s.categoryId === 'woodwork' || s.isCustom) && (!item.cabinetSections || item.cabinetSections.length === 0) && (
                           <div>L:{item.l} × B:{item.b} × Q:{item.q}</div>
                        )}
                      </td>
                      <td className="py-4 px-3 text-right font-black text-slate-900 text-[12px]">{item.netArea.toFixed(2)}</td>
                      <td className="py-4 px-3 text-left font-bold text-slate-300 uppercase">{s.unit}</td>
                    </tr>
                  ))}
                  {/* Category Summary Row */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={3} className="py-2 px-3 text-right font-bold text-slate-400 uppercase text-[9px]">Total {s.name}</td>
                    <td className="py-2 px-3 text-right font-black border-l-2 border-slate-900 bg-white">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-left font-bold text-slate-400 uppercase text-[9px]">{s.unit}</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Area */}
        <div className="mt-12 flex justify-between items-end border-t border-slate-100 pt-10 break-inside-avoid">
           <div className="text-left w-48">
              <div className="h-10 mb-2 border-b-2 border-slate-900"></div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Surveyor Sign.</p>
           </div>
           <div className="text-right w-48">
              <div className="h-10 mb-2 border-b-2 border-slate-100"></div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Supervisor / Client</p>
           </div>
        </div>

        <div className="mt-16 text-center opacity-10 no-print">
           <p className="text-[7px] font-black tracking-[1em] uppercase">Enterprise Measurement Ledger System</p>
        </div>
      </div>
    </div>
  );
}
