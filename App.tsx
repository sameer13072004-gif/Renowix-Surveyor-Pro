
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
  Loader2
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

  const saveHistory = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
    localStorage.setItem('renowix_history', JSON.stringify(updatedProjects));
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

  const editItem = (sIdx: number, iIdx: number) => {
    const s = services[sIdx];
    setTempService({ ...s });
    setEditingItemIndex({ sIdx, iIdx });
    setView('measure');
  };

  const saveProject = () => {
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

  const exportCSV = () => {
    const project: Project = {
      id: "current",
      date: new Date().toLocaleString(),
      client,
      services,
      terms
    };
    const csv = generateCSV(project);
    downloadCSV(csv, `Renowix_Report_${client.name.replace(/\s/g, '_')}.csv`);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center sm:py-6 text-slate-800">
      <div className="w-full max-w-xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-screen sm:min-h-[85vh] relative">
        
        {view !== 'setup' && (
          <div className="px-4 py-2 bg-white border-b border-gray-100 sticky top-0 z-50 flex items-center justify-between shadow-sm">
            <img src={LOGO_URL} alt="Renowix" className="h-10 w-auto object-contain" />
            <div className="flex items-center gap-1">
               <span className="text-sm font-sans font-bold text-slate-900">Surveyor</span>
               <span className="text-sm font-sans font-bold text-yellow-500">Pro</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar bg-slate-50/50">
          {view === 'setup' && (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-b from-slate-900 to-slate-850 text-white text-center">
              <div className="mb-8 p-4 bg-white rounded-2xl shadow-lg">
                <img src={LOGO_URL} alt="Renowix" className="h-12" />
              </div>
              <h2 className="text-3xl font-display font-bold mb-2">Welcome Surveyor</h2>
              <p className="text-gray-400 mb-8 max-w-xs">Professional renovation measurement & quotation tool.</p>
              
              <div className="w-full max-w-xs space-y-4">
                <input 
                  type="text" 
                  className="w-full p-4 text-center text-lg bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:border-brand-gold outline-none transition-all"
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
                  className="w-full bg-brand-gold text-slate-900 py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 transition-colors shadow-lg"
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
                  className="group w-full bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex items-center justify-between transition-all"
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
                  <ChevronRight />
                </button>

                <button 
                  onClick={() => setView('history')}
                  className="w-full bg-white border border-gray-200 p-5 rounded-2xl flex items-center justify-between"
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
                        }} className="w-full py-3 text-sm font-semibold bg-gray-50 text-slate-700 rounded-xl">
                        LOAD PROJECT
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'client-details' && (
            <div className="p-6 pb-32">
              <Header title="Project Details" onBack={() => setView('welcome')} />
              <div className="mt-8 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-card">
                  <InputGroup label="Client Name">
                    <input 
                      type="text" 
                      value={client.name}
                      onChange={e => setClient({...client, name: e.target.value})}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-gold transition-all"
                      placeholder="e.g. Mr. Rajesh Kumar"
                    />
                  </InputGroup>
                  <div className="h-4"></div>
                  <InputGroup label="Site Address">
                    <textarea 
                      value={client.address}
                      onChange={e => setClient({...client, address: e.target.value})}
                      rows={3}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-gold transition-all resize-none"
                      placeholder="Full Site Address"
                    />
                  </InputGroup>
                </div>
              </div>
              <Footer>
                <button onClick={handleStartProject} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">
                  Create Project Dashboard
                </button>
              </Footer>
            </div>
          )}

          {view === 'dashboard' && (
            <div className="p-4 sm:p-6 pb-40">
              <Header title="Project Dashboard" onBack={() => setView('client-details')} />
              
              <div className="mt-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                 <div className="relative z-10 flex justify-between items-end">
                   <div>
                     <h3 className="text-xl font-display font-bold truncate max-w-[200px]">{client.name}</h3>
                     <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs">
                        <MapPin size={10} />
                        <span className="truncate max-w-[200px]">{client.address || 'No address'}</span>
                     </div>
                   </div>
                   <div className="text-right">
                      <p className="text-xs uppercase text-brand-gold font-bold tracking-wider mb-1">Estimate</p>
                      <p className="text-3xl font-display font-bold text-white">
                        <span className="text-lg font-sans mr-1">₹</span>
                        {services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0).toLocaleString()}
                      </p>
                   </div>
                 </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between px-1">
                   <h3 className="font-bold text-slate-800">Services</h3>
                   {services.length === 0 && <span className="text-xs text-gray-400">Add a service below to start</span>}
                </div>

                {services.map((s, sIdx) => (
                  <div key={sIdx} className="bg-white border-l-4 border-l-yellow-500 rounded-xl shadow-card overflow-hidden">
                    <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <ServiceIcon categoryId={s.categoryId} typeId={s.typeId} name={s.name} />
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{s.name}</h4>
                          <p className="text-xs text-gray-500">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} {s.unit}</p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">
                        ₹ {Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {s.items.map((item, iIdx) => (
                        <div key={item.id} className="p-4 flex justify-between items-center">
                           <div>
                             <p className="font-semibold text-slate-700 text-sm">{item.name}</p>
                             <p className="text-xs text-gray-400 mt-0.5">₹{item.rate} / {s.unit}</p>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-800 text-sm">₹{Math.round(item.cost).toLocaleString()}</span>
                              <div className="flex gap-1">
                                <button onClick={() => editItem(sIdx, iIdx)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                                <button onClick={() => deleteItem(sIdx, iIdx)} className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setTempService({...s}); setEditingItemIndex(null); setView('measure'); }} className="w-full py-2 bg-gray-50 text-[10px] font-bold text-slate-500 border-t border-gray-100 uppercase tracking-widest">+ Add Room</button>
                  </div>
                ))}

                <button onClick={() => setView('service-select')} className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-400 rounded-2xl font-bold flex items-center justify-center gap-2 hover:border-yellow-500 hover:text-yellow-500 transition-all">
                  <Plus size={20} /> Add New Service Category
                </button>
              </div>

              <Footer>
                <div className="flex gap-2 w-full">
                  <button onClick={saveProject} className="p-4 bg-white border border-gray-200 text-slate-600 rounded-xl"><Save size={20} /></button>
                  <button onClick={exportCSV} className="p-4 bg-white border border-gray-200 text-slate-600 rounded-xl"><FileText size={20} /></button>
                  <button onClick={() => setView('quote')} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                    <CheckCircle size={18} className="text-brand-gold" /> Generate Quote
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
      <button onClick={onBack} className="p-2 -ml-2 text-slate-500"><ArrowLeft size={22} /></button>
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are a pro renovation consultant. Rewrite this service description to be:
      - Easy to scan (use bullet points if helpful)
      - Highlight high value for money
      - Professional and persuasive
      - Strictly maintain the original scope. 
      Input: "${description}"`;

      const result = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      if (result.text) setDescription(result.text.trim());
    } catch (e) { alert("AI error. Check API key."); }
    finally { setIsAiLoading(false); }
  };

  return (
    <div className="p-6 pb-32">
      <Header title="Select Service" onBack={onBack} />
      <div className="space-y-6">
        <InputGroup label="Category">
          <select className="w-full p-4 bg-white border border-gray-200 rounded-xl outline-none" value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">Choose Category...</option>
            {Object.values(SERVICE_DATA).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </InputGroup>
        {cat && cat !== 'custom' && (
          <InputGroup label="Service Type">
            <select className="w-full p-4 bg-white border border-gray-200 rounded-xl outline-none" value={type} onChange={e => setType(e.target.value)}>
              <option value="">Choose Service...</option>
              {SERVICE_DATA[cat].items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </InputGroup>
        )}
        {cat === 'custom' && (
          <InputGroup label="Name">
            <input type="text" className="w-full p-4 border border-gray-200 rounded-xl outline-none" placeholder="e.g. Tile Work" value={customName} onChange={e => setCustomName(e.target.value)} />
          </InputGroup>
        )}
        {cat && type && (
          <div className="bg-yellow-50 p-5 rounded-2xl border border-dashed border-yellow-200">
            <InputGroup label="Description (Editable)">
              <textarea rows={6} className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none resize-none text-sm" value={description} onChange={e => setDescription(e.target.value)} />
              <button onClick={handleAiRewrite} disabled={isAiLoading} className="mt-2 w-full bg-slate-900 text-white p-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Professional AI Rewrite
              </button>
            </InputGroup>
          </div>
        )}
      </div>
      <Footer>
        <button onClick={() => onSelect(cat, type, customName, description)} disabled={!cat || !type} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold disabled:opacity-50">Proceed</button>
      </Footer>
    </div>
  );
}

function MeasurementForm({ serviceContext, editingItem, onBack, onSave }: { serviceContext: Partial<ActiveService>, editingItem?: MeasurementItem, onBack: () => void, onSave: (item: MeasurementItem) => void }) {
  const [name, setName] = useState(editingItem?.name || '');
  const [rate, setRate] = useState<number>(editingItem?.rate || serviceContext.rate || 0);
  const [walls, setWalls] = useState<Wall[]>(editingItem?.walls || []);
  const [ceilings, setCeilings] = useState<CeilingSection[]>(editingItem?.ceilings || []);
  const [deductions, setDeductions] = useState<Deduction[]>(editingItem?.deductions || []);
  const [height, setHeight] = useState<number>(editingItem?.height || 10);
  const [l, setL] = useState<number>(editingItem?.l || 0);
  const [b, setB] = useState<number>(editingItem?.b || 0);
  const [q, setQ] = useState<number>(editingItem?.q || 1);
  const [kArea, setKArea] = useState<number>(editingItem?.netArea || 0);

  useEffect(() => { if (!editingItem && serviceContext.categoryId === 'painting' && walls.length === 0) setWalls([1,2,3,4].map(id => ({id: id.toString(), width: 0}))); }, []);

  const calculateTotal = (): number => {
    if (serviceContext.isKitchen) return kArea;
    if (serviceContext.isCustom) return (l || 0) * (b || 1) * (q || 1) || q;
    if (serviceContext.categoryId === 'painting') {
      const wArea = walls.reduce((s, w) => s + (w.width || 0), 0) * height;
      const cArea = ceilings.reduce((s, c) => s + (c.l * c.b), 0);
      const dArea = deductions.reduce((s, d) => s + (d.area * d.qty), 0);
      return Math.max(0, wArea + cArea - dArea);
    }
    return (l || 0) * (b || 1) * (q || 1) || (l * q);
  };

  const netArea = calculateTotal();
  const cost = netArea * rate;

  return (
    <div className="p-6 pb-64">
      <Header title="Measurement" onBack={onBack} />
      <div className="space-y-6">
        <InputGroup label="Room / Item Name"><input className="w-full p-4 border border-gray-200 rounded-xl" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Living Room" /></InputGroup>
        <InputGroup label="Rate (₹)"><input type="number" className="w-full p-4 border border-gray-200 rounded-xl bg-yellow-50 font-bold" value={rate || ''} onChange={e => setRate(parseFloat(e.target.value) || 0)} /></InputGroup>
        {serviceContext.categoryId === 'painting' && (
          <div className="space-y-4">
             <InputGroup label="Height (ft)"><input type="number" className="w-full p-4 border border-gray-200 rounded-xl" value={height} onChange={e => setHeight(parseFloat(e.target.value))} /></InputGroup>
             <div className="bg-white p-4 rounded-xl shadow-soft border border-gray-100">
               <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-bold text-slate-400">WALL WIDTHS</span><button onClick={() => setWalls([...walls, {id: Date.now().toString(), width: 0}])} className="text-[10px] font-bold text-yellow-600">+ Add</button></div>
               <div className="grid grid-cols-2 gap-3">
                 {walls.map((w, idx) => <input key={w.id} type="number" className="p-3 border border-gray-100 rounded-xl text-center bg-gray-50 focus:bg-white" value={w.width || ''} placeholder={`Wall ${idx+1}`} onChange={e => { const nw = [...walls]; nw[idx].width = parseFloat(e.target.value); setWalls(nw); }} />)}
               </div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-soft border border-gray-100">
               <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-bold text-slate-400">DEDUCTIONS</span><button onClick={() => setDeductions([...deductions, {id: Date.now().toString(), type: 'D/W', area: 15, qty: 1}])} className="text-[10px] font-bold text-red-400">+ Add</button></div>
               {deductions.map((d, idx) => (
                 <div key={d.id} className="flex gap-2 items-center mb-2">
                   <input type="number" className="w-full p-2 border border-gray-100 rounded-lg text-center text-xs" value={d.area} placeholder="Area" onChange={e => { const nd = [...deductions]; nd[idx].area = parseFloat(e.target.value); setDeductions(nd); }} />
                   <span className="text-gray-300">×</span>
                   <input type="number" className="w-12 p-2 border border-gray-100 rounded-lg text-center text-xs" value={d.qty} placeholder="Qty" onChange={e => { const nd = [...deductions]; nd[idx].qty = parseFloat(e.target.value); setDeductions(nd); }} />
                   <button onClick={() => { const nd = [...deductions]; nd.splice(idx,1); setDeductions(nd); }} className="text-gray-300 p-1"><X size={14}/></button>
                 </div>
               ))}
             </div>
          </div>
        )}
        {(serviceContext.categoryId === 'woodwork' || serviceContext.isCustom) && !serviceContext.isKitchen && (
          <div className="grid grid-cols-3 gap-3">
            <InputGroup label="L"><input type="number" className="p-3 border border-gray-200 rounded-xl w-full" value={l || ''} onChange={e => setL(parseFloat(e.target.value))} /></InputGroup>
            <InputGroup label="B"><input type="number" className="p-3 border border-gray-200 rounded-xl w-full" value={b || ''} onChange={e => setB(parseFloat(e.target.value))} /></InputGroup>
            <InputGroup label="Q"><input type="number" className="p-3 border border-gray-200 rounded-xl w-full" value={q || ''} onChange={e => setQ(parseFloat(e.target.value))} /></InputGroup>
          </div>
        )}
      </div>
      <Footer>
        <div className="mb-4 flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl">
          <div className="text-left"><p className="text-[10px] text-gray-400 uppercase">Quantity</p><p className="font-bold">{netArea.toFixed(2)} {serviceContext.unit}</p></div>
          <div className="text-right"><p className="text-[10px] text-gray-400 uppercase">Amount</p><p className="font-bold text-yellow-400">₹{Math.round(cost).toLocaleString()}</p></div>
        </div>
        <button onClick={() => onSave({ id: editingItem?.id || Date.now().toString(), name: name || "Item", netArea, rate, cost, l, b, q, height, walls, ceilings, deductions })} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">Save Entry</button>
      </Footer>
    </div>
  );
}

function QuoteView({ client, services, terms: initialTerms, onBack }: { client: ClientDetails, services: ActiveService[], terms: string, onBack: () => void }) {
  const [terms, setTerms] = useState(initialTerms);
  const total = services.reduce((s, ser) => s + ser.items.reduce((is, i) => is + i.cost, 0), 0);
  const date = useMemo(() => new Date().toLocaleDateString(), []);

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col items-center p-4 print:p-0 print:bg-white print:block">
      <div className="w-full max-w-[210mm] mb-6 flex justify-between no-print"><button onClick={onBack} className="bg-white px-4 py-2 rounded-lg border">Back</button><button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold">Print Quote</button></div>
      <div className="w-full max-w-[210mm] bg-white min-h-[297mm] p-10 print:p-4 print:m-0 text-slate-800 shadow-xl print:shadow-none">
        <div className="flex justify-between border-b pb-6 mb-8 print:pb-2 print:mb-2">
          <img src={LOGO_URL} className="h-16 print:h-12 object-contain" />
          <div className="text-right"><h2 className="text-3xl font-bold text-gray-200">QUOTE</h2><p className="text-xs">{date}</p></div>
        </div>
        <div className="flex gap-10 mb-8 print:mb-2">
          <div className="flex-1"><h4 className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Client</h4><p className="font-bold">{client.name}</p><p className="text-xs whitespace-pre-wrap">{client.address}</p></div>
          <div className="flex-1 text-right"><h4 className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Project</h4><p className="font-bold">Renovation Estimate</p><p className="text-xs">#{Math.floor(Math.random()*10000)}</p></div>
        </div>
        <table className="w-full text-sm mb-10 print:mb-2 print:text-xs">
          <thead><tr className="border-b-2 border-slate-900"><th className="py-2 text-left">#</th><th className="py-2 text-left">Description</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {services.map((s, idx) => (
              <tr key={idx} className="break-inside-avoid">
                <td className="py-3 print:py-1 font-bold text-slate-300">{idx+1}</td>
                <td className="py-3 print:py-1"><p className="font-bold">{s.name}</p><p className="text-xs text-gray-400 whitespace-pre-wrap">{s.desc}</p></td>
                <td className="py-3 print:py-1 text-right">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} {s.unit}</td>
                <td className="py-3 print:py-1 text-right font-bold">₹{Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end mb-10 print:mb-2"><div className="w-48 border-t border-slate-900 pt-2 flex justify-between font-bold text-lg print:text-sm"><span>Total</span><span>₹{Math.round(total).toLocaleString()}</span></div></div>
        <div className="break-inside-avoid">
          <h4 className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Terms</h4>
          <textarea rows={10} className="w-full text-xs bg-slate-50 border-none rounded-xl p-4 print:p-0 print:bg-white resize-none" value={terms} onChange={e => setTerms(e.target.value)} />
        </div>
        <div className="mt-16 flex justify-end"><div className="w-48 border-t border-slate-300 text-center text-[10px] font-bold text-gray-400 pt-2 uppercase">Signature</div></div>
      </div>
    </div>
  );
}
