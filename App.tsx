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

// --- MAIN APP COMPONENT ---

export default function App() {
  // Global State
  const [view, setView] = useState<PageView>('setup');
  const [surveyorName, setSurveyorName] = useState<string>('');
  
  // Project State
  const [client, setClient] = useState<ClientDetails>({ name: '', address: '' });
  const [services, setServices] = useState<ActiveService[]>([]);
  const [terms, setTerms] = useState<string>(DEFAULT_TERMS);
  
  // Temp State for UI Flows
  const [tempService, setTempService] = useState<Partial<ActiveService> | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<{ sIdx: number; iIdx: number } | null>(null);
  
  // History State
  const [projects, setProjects] = useState<Project[]>([]);

  // Init
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

  // --- ACTIONS ---

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
    setEditingItemIndex(null); // New Item mode
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

  // --- VIEWS ---

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center sm:py-10 text-slate-800">
      <div className="w-full max-w-xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-screen sm:min-h-[85vh] relative">
        
        {/* GLOBAL HEADER (Except Setup/Print) */}
        {view !== 'setup' && (
          <div className="px-4 py-2 bg-white border-b border-gray-100 sticky top-0 z-20 flex items-center justify-between shadow-sm">
            <img src={LOGO_URL} alt="Renowix" className="h-12 object-contain" />
            <div className="flex items-center gap-1">
               <span className="text-sm font-sans font-bold text-slate-900">Surveyor</span>
               <span className="text-sm font-sans font-bold text-yellow-600">Pro</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pb-40 no-scrollbar bg-slate-50/50">
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
                  className="w-full bg-brand-gold text-slate-900 py-4 rounded-xl font-bold text-lg hover:bg-yellow-400 transition-colors shadow-lg shadow-yellow-500/20"
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
                  className="group w-full bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10 flex items-center justify-between transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 p-3 rounded-full text-brand-gold group-hover:bg-brand-gold group-hover:text-slate-900 transition-colors">
                      <Plus size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-lg">Create New Quote</h3>
                      <p className="text-sm text-gray-400">Start a fresh measurement</p>
                    </div>
                  </div>
                  <ChevronRight className="text-gray-600 group-hover:text-white transition-colors" />
                </button>

                <button 
                  onClick={() => setView('history')}
                  className="w-full bg-white border border-gray-200 p-5 rounded-2xl hover:border-gray-300 flex items-center justify-between transition-all active:bg-gray-50"
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
                  <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-soft hover:shadow-md transition-shadow">
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
                      <button 
                        onClick={() => {
                          const newP = [...projects];
                          newP.splice(idx, 1);
                          saveHistory(newP);
                        }}
                        className="text-gray-300 hover:text-red-500 p-2 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <button 
                        onClick={() => {
                          if(confirm("Load this project? Current unsaved work will be lost.")) {
                            setClient(p.client);
                            setServices(p.services);
                            setTerms(p.terms || DEFAULT_TERMS);
                            setView('dashboard');
                          }
                        }}
                        className="w-full py-3 text-sm font-semibold bg-gray-50 hover:bg-slate-900 hover:text-white text-slate-700 rounded-xl transition-colors"
                      >
                        LOAD PROJECT
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'client-details' && (
            <div className="p-6">
              <Header title="New Project Setup" onBack={() => setView('welcome')} />
              
              <div className="mt-8 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-card">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg"><User size={20}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Client Details</h3>
                  </div>

                  <div className="space-y-5">
                    <InputGroup label="Client Name">
                      <input 
                        type="text" 
                        value={client.name}
                        onChange={e => setClient({...client, name: e.target.value})}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none transition-all"
                        placeholder="e.g. Mr. Rajesh Kumar"
                      />
                    </InputGroup>
                    <InputGroup label="Site Address">
                      <textarea 
                        value={client.address}
                        onChange={e => setClient({...client, address: e.target.value})}
                        rows={3}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none transition-all resize-none"
                        placeholder="Full Site Address"
                      />
                    </InputGroup>
                  </div>
                </div>
              </div>
              
              <Footer>
                <button 
                  onClick={handleStartProject}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                >
                  Create Project Dashboard
                </button>
              </Footer>
            </div>
          )}

          {view === 'dashboard' && (
            <div className="p-4 sm:p-6">
              <Header title="Project Dashboard" onBack={() => setView('client-details')} />
              
              {/* Stats Card */}
              <div className="mt-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-xl shadow-slate-900/20 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-10">
                   <img src={LOGO_URL} className="w-32 grayscale invert" />
                 </div>
                 <div className="relative z-10 flex justify-between items-end">
                   <div>
                     <div className="flex items-center gap-2 mb-2 opacity-80">
                       <User size={14} />
                       <span className="text-xs uppercase tracking-widest font-semibold">Client</span>
                     </div>
                     <h3 className="text-xl font-display font-bold truncate max-w-[180px]">{client.name}</h3>
                     <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs">
                        <MapPin size={10} />
                        <span className="truncate max-w-[200px]">{client.address || 'No address provided'}</span>
                     </div>
                   </div>
                   <div className="text-right">
                      <p className="text-xs uppercase text-brand-gold font-bold tracking-wider mb-1">Total Estimate</p>
                      <p className="text-3xl font-display font-bold text-white tracking-tight">
                        <span className="text-lg align-top opacity-50 font-sans mr-1">₹</span>
                        {services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0).toLocaleString()}
                      </p>
                   </div>
                 </div>
              </div>

              <div className="mt-8 space-y-6">
                <div className="flex items-center justify-between px-1">
                   <h3 className="font-bold text-slate-800">Services Added</h3>
                   <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{services.length}</span>
                </div>

                {services.length === 0 ? (
                  <div className="text-center py-6">
                     <p className="text-gray-400 text-sm mb-2">No services added yet.</p>
                  </div>
                ) : (
                  services.map((s, sIdx) => (
                    <div key={sIdx} className="bg-white border-l-4 border-l-brand-gold rounded-xl overflow-hidden shadow-card mb-4">
                      <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 text-brand-black">
                             <ServiceIcon categoryId={s.categoryId} typeId={s.typeId} name={s.name} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm">{s.name}</h4>
                            <p className="text-xs text-gray-500">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} {s.unit}</p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200 text-sm">
                          ₹ {Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="divide-y divide-gray-50">
                        {s.items.map((item, iIdx) => (
                          <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                             <div>
                               <p className="font-semibold text-slate-700 text-sm">{item.name}</p>
                               <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                 <span className="font-medium text-slate-600">{item.netArea.toFixed(2)} {s.unit}</span>
                                 <span>×</span>
                                 <span>₹{item.rate}</span>
                               </p>
                             </div>
                             <div className="flex items-center gap-4">
                                <span className="font-bold text-slate-800 text-sm">
                                  ₹ {Math.round(item.cost).toLocaleString()}
                                </span>
                                <div className="flex gap-2">
                                  <button onClick={() => editItem(sIdx, iIdx)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-100">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => deleteItem(sIdx, iIdx)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                             </div>
                          </div>
                        ))}
                      </div>
                      
                      <button 
                        onClick={() => {
                          setTempService({...s});
                          setEditingItemIndex(null); 
                          setView('measure');
                        }}
                        className="w-full py-3 bg-gray-50 text-xs font-bold text-slate-600 hover:bg-gray-100 hover:text-brand-black flex items-center justify-center gap-2 transition-colors border-t border-gray-100 uppercase tracking-wide"
                      >
                        <PlusCircle size={14} />
                        Add Room / Item
                      </button>
                    </div>
                  ))
                )}

                <button 
                  onClick={() => setView('service-select')}
                  className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-400 rounded-2xl font-bold flex flex-row items-center justify-center gap-2 hover:border-brand-gold hover:text-brand-gold hover:bg-yellow-50/50 transition-all group"
                >
                  <Plus size={20} />
                  Add New Service Category
                </button>
              </div>

              <Footer>
                <div className="flex gap-2 w-full">
                  <button onClick={saveProject} className="p-4 bg-white border border-gray-200 text-slate-600 rounded-xl hover:bg-gray-50 flex justify-center items-center shadow-sm">
                    <Save size={20} />
                  </button>
                  <button onClick={exportCSV} className="p-4 bg-white border border-gray-200 text-slate-600 rounded-xl hover:bg-gray-50 flex justify-center items-center shadow-sm">
                    <FileText size={20} />
                  </button>
                  <button onClick={() => setView('quote')} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                    <CheckCircle size={18} className="text-brand-gold" />
                    Generate Quote
                  </button>
                </div>
              </Footer>
            </div>
          )}

          {view === 'service-select' && (
            <ServiceSelector 
              onBack={() => setView('dashboard')} 
              onSelect={handleAddService} 
            />
          )}

          {view === 'measure' && tempService && (
            <MeasurementForm 
              serviceContext={tempService}
              editingItem={editingItemIndex !== null && tempService.items ? tempService.items[editingItemIndex.iIdx] : undefined}
              onBack={() => setView('dashboard')}
              onSave={handleSaveMeasurement}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- SUB COMPONENTS ---

const ServiceIcon = ({ categoryId, typeId, name }: { categoryId: string, typeId: string, name: string }) => {
  if (categoryId === 'painting') return <PaintRoller size={20} />;
  if (categoryId === 'woodwork') {
      if (typeId === 'kitchen_mod') return <Utensils size={20} />;
      if (typeId === 'tv_unit') return <Monitor size={20} />;
      if (typeId === 'wood_floor') return <Layers size={20} />;
      if (typeId === 'wardrobe') return <Box size={20} />;
      return <Hammer size={20} />;
  }
  return <span className="font-bold text-lg">{name.charAt(0).toUpperCase()}</span>;
};

const Header = ({ title, onBack }: { title: string, onBack: () => void }) => (
  <div className="flex items-center gap-4 py-2 mb-6">
    <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:bg-white hover:shadow-sm rounded-xl transition-all">
      <ArrowLeft size={22} />
    </button>
    <h1 className="font-display font-bold text-xl text-slate-900">{title}</h1>
  </div>
);

const Footer = ({ children }: { children?: React.ReactNode }) => (
  <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-4 border-t border-gray-200 z-[100] shadow-lg">
    <div className="max-w-xl mx-auto">
      {children}
    </div>
  </div>
);

const InputGroup = ({ label, children }: { label: string, children?: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
    {children}
  </div>
);

// --- SERVICE SELECTOR ---
function ServiceSelector({ onBack, onSelect }: { onBack: () => void, onSelect: (c:string, t:string, customN?:string, customD?:string) => void }) {
  const [cat, setCat] = useState('');
  const [type, setType] = useState('');
  const [customName, setCustomName] = useState('');
  const [description, setDescription] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (cat === 'custom') {
      setType('custom_item');
    } else {
      setType('');
    }
  }, [cat]);

  // Update description when a standard service type is selected
  useEffect(() => {
    if (cat && type && cat !== 'custom') {
       const catData = SERVICE_DATA[cat];
       const typeItem = catData?.items.find(i => i.id === type);
       if (typeItem) {
          setDescription(typeItem.desc);
       }
    } else if (cat === 'custom' && !description) {
       setDescription('');
    }
  }, [cat, type]);

  const handleAiRewrite = async () => {
    if (!description.trim()) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Rewrite the following renovation service description for a client quote. 
      Make it highly professional, value-for-money, and easy to scan. You can use bullet points. 
      Keep it strictly within the scope of the original description. 
      Input: "${description}"`;

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      if (result.text) {
        setDescription(result.text.trim());
      }
    } catch (error) {
      console.error("AI Rewrite Error:", error);
      alert("Could not rewrite text. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const isSelectionComplete = cat && type && (cat !== 'custom' || customName);

  return (
    <div className="p-6">
      <Header title="Select Service" onBack={onBack} />
      <div className="mt-4 space-y-6">
        <InputGroup label="Service Category">
          <div className="relative">
             <select 
              className="w-full p-4 bg-white border border-gray-200 rounded-xl appearance-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold outline-none"
              value={cat}
              onChange={e => setCat(e.target.value)}
            >
              <option value="">Choose a Category...</option>
              {Object.values(SERVICE_DATA).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
               <ChevronRight className="rotate-90" size={18} />
            </div>
          </div>
        </InputGroup>

        {cat && cat !== 'custom' && (
          <InputGroup label="Service Type">
            <div className="relative">
              <select 
                className="w-full p-4 bg-white border border-gray-200 rounded-xl appearance-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold outline-none"
                value={type}
                onChange={e => setType(e.target.value)}
              >
                <option value="">Choose specific service...</option>
                {SERVICE_DATA[cat].items.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
               <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                 <ChevronRight className="rotate-90" size={18} />
              </div>
            </div>
          </InputGroup>
        )}

        {cat === 'custom' && (
           <InputGroup label="Custom Service Name">
              <input 
                type="text"
                placeholder="e.g. Bathroom Renovation"
                className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-brand-gold outline-none"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
           </InputGroup>
        )}

        {/* Unified Description Editor for BOTH Custom and Standard services */}
        {((cat && type && cat !== 'custom') || cat === 'custom') && (
           <div className="p-6 bg-yellow-50 border border-dashed border-brand-gold/30 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
             <InputGroup label="Service Description (Editable)">
                <textarea 
                  placeholder="Describe scope of work (English or Hindi)..."
                  rows={4}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-brand-gold outline-none resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
                 <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAiRewrite}
                    disabled={isAiLoading || !description.trim()}
                    className="flex items-center gap-2 text-xs font-bold text-brand-gold bg-slate-900 px-3 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                  >
                    {isAiLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {isAiLoading ? "Rewriting..." : "Professional Rewrite (AI)"}
                  </button>
                </div>
             </InputGroup>
           </div>
        )}
      </div>

      <Footer>
         <button 
           onClick={() => {
             if(!isSelectionComplete) return alert("Please select all options");
             onSelect(cat, type, customName, description);
           }}
           className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
           disabled={!isSelectionComplete}
         >
           Proceed to Measurement
         </button>
      </Footer>
    </div>
  );
}

// --- MEASUREMENT FORM ---

function MeasurementForm({ serviceContext, editingItem, onBack, onSave }: { 
  serviceContext: Partial<ActiveService>, 
  editingItem?: MeasurementItem, 
  onBack: () => void, 
  onSave: (item: MeasurementItem) => void 
}) {
  const [name, setName] = useState(editingItem?.name || '');
  
  const [rate, setRate] = useState<number>(() => {
    if (editingItem?.rate !== undefined) return editingItem.rate;
    if (serviceContext.rate !== undefined) return serviceContext.rate;
    if (serviceContext.categoryId && serviceContext.typeId) {
       const cat = SERVICE_DATA[serviceContext.categoryId];
       const typeItem = cat?.items.find(i => i.id === serviceContext.typeId);
       return typeItem?.rate || 0;
    }
    return 0;
  });
  
  const [walls, setWalls] = useState<Wall[]>(editingItem?.walls || []);
  const [ceilings, setCeilings] = useState<CeilingSection[]>(editingItem?.ceilings || []);
  const [deductions, setDeductions] = useState<Deduction[]>(editingItem?.deductions || []);
  const [height, setHeight] = useState<number>(editingItem?.height || 10);
  
  const [l, setL] = useState<number>(editingItem?.l || 0);
  const [b, setB] = useState<number>(editingItem?.b || 0);
  const [q, setQ] = useState<number>(editingItem?.q || 1);
  const [kitchenArea, setKitchenArea] = useState<number>(editingItem?.netArea || 0);

  const [useSimpleDims, setUseSimpleDims] = useState(false);

  useEffect(() => {
    if (!editingItem && serviceContext.categoryId === 'painting' && walls.length === 0) {
      setWalls([1,2,3,4].map(id => ({ id: id.toString(), width: 0 })));
    }
  }, []);

  const calculateTotal = (): number => {
    if (serviceContext.isKitchen) return kitchenArea;
    if (serviceContext.isCustom) {
      if (useSimpleDims) {
         return (l || 0) * (b || 1) * (q || 1);
      }
      if (l > 0 || b > 0) return l * (b || 1) * q;
      return q; 
    }
    if (serviceContext.categoryId === 'painting') {
      const wallArea = walls.reduce((sum, w) => sum + w.width, 0) * height;
      const ceilArea = ceilings.reduce((sum, c) => sum + (c.l * c.b), 0);
      const deductArea = deductions.reduce((sum, d) => sum + (d.area * d.qty), 0);
      return Math.max(0, wallArea + ceilArea - deductArea);
    }
    if (serviceContext.unit === 'rft') return l * q;
    return l * b * q;
  };

  const netArea = calculateTotal();
  const estimatedCost = netArea * rate;

  return (
    <div className="p-6">
      <Header title="Take Measurement" onBack={onBack} />
      
      <div className="mt-2 pb-56 space-y-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm text-brand-gold">
            <ServiceIcon categoryId={serviceContext.categoryId || ''} typeId={serviceContext.typeId || ''} name={serviceContext.name || 'C'} />
          </div>
          <div>
             <p className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-0.5">Active Service</p>
             <h3 className="font-bold text-slate-800">{serviceContext.name}</h3>
          </div>
        </div>

        <InputGroup label={serviceContext.isCustom ? "Item Name (Optional)" : "Room / Item Name"}>
          <input 
            type="text"
            className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none"
            placeholder={serviceContext.isCustom ? "e.g. Bathroom" : "e.g. Master Bedroom"}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </InputGroup>

        <InputGroup label={`Rate (₹ / ${serviceContext.unit})`}>
           <div className="flex items-center gap-2">
             <div className="relative w-full">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-sans font-bold">₹</span>
               <input 
                type="number" 
                className="w-full pl-8 p-4 bg-yellow-50/50 border border-brand-gold/30 text-slate-800 font-bold rounded-xl focus:ring-2 focus:ring-brand-gold/50 outline-none"
                value={rate || ''}
                onChange={e => setRate(parseFloat(e.target.value) || 0)}
               />
             </div>
           </div>
        </InputGroup>

        {/* --- DYNAMIC FORM AREAS --- */}

        {serviceContext.isKitchen && (
           <InputGroup label="Total Kitchen Area (sqft)">
             <input type="number" className="w-full p-4 border border-gray-200 rounded-xl" value={kitchenArea || ''} onChange={e => setKitchenArea(parseFloat(e.target.value))} />
           </InputGroup>
        )}

        {serviceContext.isCustom && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <label className="text-sm font-bold text-slate-700">Include Dimensions?</label>
              <button 
                onClick={() => setUseSimpleDims(!useSimpleDims)}
                className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out ${useSimpleDims ? 'bg-brand-gold' : 'bg-gray-200'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${useSimpleDims ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            
            {useSimpleDims ? (
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Length">
                  <input type="number" className="w-full p-4 bg-white border border-gray-200 rounded-xl" value={l || ''} onChange={e => setL(parseFloat(e.target.value))} />
                </InputGroup>
                <InputGroup label="Width">
                  <input type="number" className="w-full p-4 bg-white border border-gray-200 rounded-xl" value={b || ''} onChange={e => setB(parseFloat(e.target.value))} />
                </InputGroup>
              </div>
            ) : (
               <div className="p-4 bg-blue-50 text-blue-700 text-sm rounded-xl border border-blue-100 flex gap-2">
                  <CheckCircle size={16} className="mt-0.5" />
                  <p>Dimensions disabled. Cost will be calculated as Quantity × Rate.</p>
               </div>
            )}

             <InputGroup label="Quantity">
                <div className="flex items-center justify-center bg-white p-2 rounded-2xl border border-gray-200 shadow-sm w-48 mx-auto">
                  <button onClick={() => setQ(Math.max(1, q - 1))} className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"><MinusCircle size={20} /></button>
                  <input type="number" className="w-full p-2 text-center bg-transparent font-bold text-xl outline-none" value={q} onChange={e => setQ(parseFloat(e.target.value))} />
                  <button onClick={() => setQ(q + 1)} className="p-3 bg-brand-gold text-white hover:bg-yellow-400 rounded-xl transition-colors"><PlusCircle size={20} /></button>
                </div>
            </InputGroup>
          </div>
        )}

        {serviceContext.categoryId === 'woodwork' && !serviceContext.isKitchen && (
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Length">
                  <input type="number" className="w-full p-4 border border-gray-200 rounded-xl" value={l || ''} onChange={e => setL(parseFloat(e.target.value))} />
                </InputGroup>
                {serviceContext.unit !== 'rft' && (
                  <InputGroup label="Width / Height">
                    <input type="number" className="w-full p-4 border border-gray-200 rounded-xl" value={b || ''} onChange={e => setB(parseFloat(e.target.value))} />
                  </InputGroup>
                )}
             </div>
             <InputGroup label="Quantity">
                <div className="flex items-center justify-center bg-white p-2 rounded-2xl border border-gray-200 shadow-sm w-48 mx-auto">
                  <button onClick={() => setQ(Math.max(1, q - 1))} className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"><MinusCircle size={20} /></button>
                  <input type="number" className="w-full p-2 text-center bg-transparent font-bold text-xl outline-none" value={q} onChange={e => setQ(parseFloat(e.target.value))} />
                  <button onClick={() => setQ(q + 1)} className="p-3 bg-brand-gold text-white hover:bg-yellow-400 rounded-xl transition-colors"><PlusCircle size={20} /></button>
                </div>
            </InputGroup>
          </div>
        )}

        {serviceContext.categoryId === 'painting' && (
          <div className="space-y-6">
             <InputGroup label="Room Height (ft)">
               <input type="number" className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:border-brand-gold outline-none" value={height} onChange={e => setHeight(parseFloat(e.target.value))} />
             </InputGroup>

             <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-soft">
               <div className="flex justify-between items-center mb-4">
                 <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Ruler size={14}/> Wall Widths (ft)</label>
                 <button onClick={() => setWalls([...walls, {id: Date.now().toString(), width: 0}])} className="text-xs font-bold text-brand-black bg-brand-gold/20 px-3 py-1.5 rounded-full hover:bg-brand-gold/30 transition-colors">+ Add Wall</button>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 {walls.map((w, idx) => (
                   <div key={w.id} className="relative group">
                     <input 
                      type="number" 
                      placeholder={`Wall ${idx+1}`}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-center focus:bg-white focus:border-brand-gold outline-none transition-all"
                      value={w.width || ''}
                      onChange={e => {
                        const newW = [...walls];
                        newW[idx].width = parseFloat(e.target.value);
                        setWalls(newW);
                      }}
                     />
                     <button onClick={() => {
                       const newW = [...walls];
                       newW.splice(idx, 1);
                       setWalls(newW);
                     }} className="absolute -top-1 -right-1 bg-white shadow-md rounded-full p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                   </div>
                 ))}
               </div>
             </div>

             <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-soft">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Ruler size={14}/> Ceiling (L x B)</label>
                  <button onClick={() => setCeilings([...ceilings, {id: Date.now().toString(), l:0, b:0}])} className="text-xs font-bold text-brand-black bg-brand-gold/20 px-3 py-1.5 rounded-full hover:bg-brand-gold/30 transition-colors">+ Add Section</button>
                </div>
                <div className="space-y-3">
                  {ceilings.map((c, idx) => (
                    <div key={c.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
                      <input type="number" placeholder="L" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-center text-sm" value={c.l || ''} onChange={e => {
                        const newC = [...ceilings]; newC[idx].l = parseFloat(e.target.value); setCeilings(newC);
                      }}/>
                      <span className="text-gray-400 font-sans">×</span>
                      <input type="number" placeholder="B" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-center text-sm" value={c.b || ''} onChange={e => {
                        const newC = [...ceilings]; newC[idx].b = parseFloat(e.target.value); setCeilings(newC);
                      }}/>
                      <button onClick={() => { const newC = [...ceilings]; newC.splice(idx, 1); setCeilings(newC); }} className="text-gray-400 hover:text-red-500 p-1"><X size={16} /></button>
                    </div>
                  ))}
                </div>
             </div>
             
             <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-soft">
                 <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-bold text-slate-500 uppercase">Deductions</label>
                    <div className="flex gap-2">
                      <button onClick={() => setDeductions([...deductions, {id: Date.now().toString(), type: 'Door', area: 21, qty: 1}])} className="text-[10px] font-bold bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200">+Door</button>
                      <button onClick={() => setDeductions([...deductions, {id: Date.now().toString(), type: 'Window', area: 16, qty: 1}])} className="text-[10px] font-bold bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200">+Wind</button>
                    </div>
                 </div>
                 <div className="space-y-2">
                    {deductions.map((d, idx) => (
                      <div key={d.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl">
                         <span className="text-xs font-bold w-12 text-slate-600 pl-1">{d.type}</span>
                         <input type="number" placeholder="Area" className="flex-1 p-1 bg-white border border-gray-200 rounded-lg text-sm" value={d.area} onChange={e => {
                           const newD = [...deductions]; newD[idx].area = parseFloat(e.target.value); setDeductions(newD);
                         }} />
                         <input type="number" placeholder="Qty" className="w-12 p-1 bg-white border border-gray-200 rounded-lg text-sm text-center" value={d.qty} onChange={e => {
                           const newD = [...deductions]; newD[idx].qty = parseFloat(e.target.value); setDeductions(newD);
                         }} />
                         <button onClick={() => { const newD = [...deductions]; newD.splice(idx, 1); setDeductions(newD); }} className="text-gray-400 hover:text-red-500 p-1"><X size={16} /></button>
                      </div>
                    ))}
                 </div>
             </div>
          </div>
        )}

      </div>

      {/* Floating Action Footer containing Live Calc and Save Button */}
      <Footer>
         <div className="mb-4 bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center pointer-events-auto">
            <div>
              <p className="text-[10px] uppercase text-gray-400 tracking-wider">Net Quantity</p>
              <p className="font-bold text-lg">{netArea.toFixed(2)} <span className="text-xs font-normal text-gray-400">{serviceContext.unit}</span></p>
            </div>
            <div className="h-8 w-px bg-gray-700 mx-2"></div>
            <div className="text-right">
               <p className="text-[10px] uppercase text-gray-400 tracking-wider">Amount</p>
               <p className="font-bold text-2xl text-brand-gold">₹ {Math.round(estimatedCost).toLocaleString()}</p>
            </div>
         </div>
        <button 
          onClick={() => {
            if(!name && !serviceContext.isCustom) return alert("Enter Name");
            
            const item: MeasurementItem = {
              id: editingItem?.id || Date.now().toString(),
              name: name || serviceContext.name || "Custom Item",
              netArea,
              rate,
              cost: estimatedCost,
              height, walls, ceilings, deductions, l, b, q
            };
            onSave(item);
          }}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-colors"
        >
          SAVE ENTRY
        </button>
      </Footer>
    </div>
  );
}

// --- QUOTE VIEW (PRINT) ---

function QuoteView({ client, services, terms: initialTerms, onBack }: { client: ClientDetails, services: ActiveService[], terms: string, onBack: () => void }) {
  const [terms, setTerms] = useState(initialTerms);
  const total = services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0);
  const quoteId = useMemo(() => `QT-${Math.floor(1000 + Math.random() * 9000)}`, []);
  const date = useMemo(() => new Date().toLocaleDateString(), []);

  return (
    <div className="bg-gray-200 min-h-screen w-full flex flex-col items-center sm:p-8 print:p-0 print:m-0 print:bg-white print:block">
      {/* Print Controls */}
      <div className="w-full max-w-[210mm] mb-6 flex justify-between items-center no-print px-4 sm:px-0 mt-4 sm:mt-0">
         <button onClick={onBack} className="flex items-center gap-2 text-slate-600 bg-white px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 font-medium"><ArrowLeft size={18}/> Back to Edit</button>
         <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20"><Printer size={18} /> PRINT QUOTE</button>
      </div>

      {/* A4 Paper Simulation */}
      <div className="w-full max-w-[210mm] bg-white min-h-[297mm] p-12 shadow-2xl print:shadow-none print:m-0 print:w-full print:max-w-none print:p-6 text-slate-800">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-gray-100 pb-8 mb-8 print:pb-4 print:mb-4">
          <div className="flex gap-5 items-center">
            <img src={LOGO_URL} className="h-16 w-auto object-contain print:h-12" alt="Renowix Logo" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 print:text-lg">Renowix Renovations</h1>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5 print:text-[10px]">
                <p>C-32, Sector 51, Noida, UP 201301</p>
                <p>info@renowix.in | +91 92114 29635</p>
              </div>
            </div>
          </div>
          <div className="text-right">
             <h2 className="text-4xl font-display font-bold text-gray-100 uppercase tracking-tighter print:text-2xl">Quote</h2>
             <div className="mt-2">
               <p className="font-bold text-slate-700 print:text-sm">#{quoteId}</p>
               <p className="text-sm text-gray-500 print:text-xs">{date}</p>
             </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="flex gap-12 mb-12 print:mb-6">
           <div className="flex-1">
             <h3 className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-3 print:mb-1">Bill To</h3>
             <p className="font-bold text-lg text-slate-900 print:text-sm">{client.name}</p>
             <p className="text-slate-600 whitespace-pre-line text-sm mt-1 leading-relaxed print:text-xs">{client.address}</p>
           </div>
           <div className="w-px bg-gray-100"></div>
           <div className="flex-1">
             <h3 className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-3 print:mb-1">Site Details</h3>
             <p className="font-bold text-lg text-slate-900 print:text-sm">{client.name}</p>
             <p className="text-slate-600 whitespace-pre-line text-sm mt-1 leading-relaxed print:text-xs">{client.address}</p>
           </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm mb-12 print:mb-6 print:text-xs">
           <thead>
             <tr className="border-b-2 border-slate-900">
               <th className="py-3 text-left pl-2 font-bold text-slate-900 w-12 print:py-2">#</th>
               <th className="py-3 text-left font-bold text-slate-900 print:py-2">Description</th>
               <th className="py-3 text-right font-bold text-slate-900 w-24 print:py-2">Qty</th>
               <th className="py-3 text-right font-bold text-slate-900 w-24 print:py-2">Rate</th>
               <th className="py-3 text-right pr-2 font-bold text-slate-900 w-32 print:py-2">Amount</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-100">
             {services.map((s, idx) => (
               <React.Fragment key={idx}>
                 <tr className="group break-inside-avoid">
                   <td className="py-4 pl-2 font-bold align-top text-slate-400 print:py-2">{idx + 1}</td>
                   <td className="py-4 align-top pr-4 print:py-2">
                     <p className="font-bold text-slate-800 text-base mb-1 print:text-sm">{s.name}</p>
                     <p className="text-xs text-gray-500 leading-relaxed mb-2 whitespace-pre-line">{s.desc}</p>
                     {s.items.length > 0 && (
                        <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 inline-block print:p-1 print:bg-transparent print:text-[10px]">
                          <span className="font-semibold text-gray-400 uppercase text-[10px] mr-2">Locations:</span>
                          {s.items.map(i => i.name).join(', ')}
                        </div>
                     )}
                   </td>
                   <td className="py-4 text-right align-top font-medium text-slate-600 print:py-2">
                     {s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} <span className="text-[10px] text-gray-400 uppercase">{s.unit}</span>
                   </td>
                   <td className="py-4 text-right align-top text-slate-600 print:py-2">
                     {s.items[0].rate}
                   </td>
                   <td className="py-4 text-right pr-2 align-top font-bold text-slate-900 print:py-2">
                     {Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}
                   </td>
                 </tr>
               </React.Fragment>
             ))}
           </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-16 break-inside-avoid print:mb-8">
           <div className="w-64">
             <div className="flex justify-between text-slate-500 py-2 border-b border-gray-100 print:py-1 print:text-xs">
               <span>Sub Total</span>
               <span>{Math.round(total).toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center py-3 mt-2 print:py-2">
               <span className="font-bold text-lg text-slate-900 print:text-sm">Total</span>
               <span className="font-bold text-2xl text-brand-black print:text-xl">₹ {Math.round(total).toLocaleString()}</span>
             </div>
             <div className="h-1 w-full bg-brand-gold mt-1 rounded-full"></div>
           </div>
        </div>

        {/* Terms */}
        <div className="break-inside-avoid">
           <h4 className="font-bold text-xs uppercase text-gray-400 tracking-widest mb-3 print:mb-1">Terms & Conditions</h4>
           <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 print:bg-transparent print:p-0 print:border-none">
             <textarea 
               className="w-full text-xs text-slate-600 bg-transparent border-none p-0 resize-none focus:ring-0 whitespace-pre-line leading-relaxed font-sans"
               rows={12}
               value={terms}
               onChange={e => setTerms(e.target.value)}
             />
           </div>
        </div>

        {/* Signature */}
        <div className="mt-20 flex justify-end break-inside-avoid print:mt-12">
           <div className="text-center">
             <div className="w-48 border-b border-gray-300 mb-2"></div>
             <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Authorized Signature</p>
           </div>
        </div>

      </div>
    </div>
  );
}