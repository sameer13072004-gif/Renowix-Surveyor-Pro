
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  History, 
  Printer, 
  CheckCircle,
  ChevronRight,
  Briefcase,
  User,
  MapPin,
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
  DoorOpen,
  Layout,
  Coins,
  Percent,
  CircleDollarSign,
  AlertTriangle,
  PlusCircle,
  Calendar,
  LogOut,
  Bell
} from 'lucide-react';
import { 
  ActiveService, 
  ClientDetails, 
  MeasurementItem, 
  PageView, 
  Project, 
  Wall, 
  CeilingSection, 
  CabinetSection,
  Deduction 
} from './types';
import { SERVICE_DATA, DEFAULT_TERMS } from './constants';

// Fix for window.google TypeScript error
declare global {
  interface Window {
    google: any;
  }
}

const LOGO_URL = "https://renowix.in/wp-content/uploads/2025/12/Picsart_25-12-04_19-18-42-905-scaled.png";
const CLIENT_ID = "871774313564-k2k6fi273fjd6ahgfhtiqpv5bdnqvgmk.apps.googleusercontent.com";

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
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  // Google Auth & Tasks
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const tokenClientRef = useRef<any>(null);

  // Modals
  const [exitModal, setExitModal] = useState<{ show: boolean; target: PageView | null }>({ show: false, target: null });
  const [saveModal, setSaveModal] = useState<{ show: boolean }>({ show: false });
  const [reminderModal, setReminderModal] = useState<{ show: boolean; project: Project | null; dueDate: string; isSaving: boolean }>({
    show: false,
    project: null,
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    isSaving: false
  });

  // Handle back navigation with unsaved changes check
  const handleBackNavigation = (target: PageView) => {
    if (isDirty && (view === 'dashboard' || view === 'client-details' || view === 'measure')) {
      setExitModal({ show: true, target });
    } else {
      setView(target);
    }
  };

  // Handle device back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isDirty && (view === 'dashboard' || view === 'client-details' || view === 'measure')) {
        window.history.pushState(null, '', ''); 
        setExitModal({ show: true, target: 'welcome' });
      } else if (view !== 'welcome' && view !== 'setup') {
        const prevViews: Record<string, PageView> = {
          'history': 'welcome',
          'client-details': 'welcome',
          'dashboard': 'client-details',
          'service-select': 'dashboard',
          'measure': 'dashboard',
          'quote': 'dashboard',
          'measurement-sheet': 'dashboard'
        };
        if (prevViews[view]) {
          window.history.pushState(null, '', '');
          setView(prevViews[view]);
        }
      }
    };
    window.history.pushState(null, '', '');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, isDirty]);

  // Google Tasks Auth Init
  useEffect(() => {
    const initGsi = () => {
      if (typeof window.google === 'undefined') return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/tasks',
        callback: (response: any) => {
          if (response.access_token) {
            setGoogleToken(response.access_token);
            localStorage.setItem('google_access_token', response.access_token);
          }
        },
      });
    };
    initGsi();
    const stored = localStorage.getItem('google_access_token');
    if (stored) setGoogleToken(stored);
  }, []);

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

  useEffect(() => {
    if (services.length > 0 || (client.name && client.name.trim() !== '')) {
      setIsDirty(true);
    }
  }, [services, client, terms]);

  const handleGoogleSignIn = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken();
    }
  };

  const createGoogleTask = async () => {
    if (!googleToken || !reminderModal.project) return;
    setReminderModal(prev => ({ ...prev, isSaving: true }));
    
    try {
      const { project, dueDate } = reminderModal;
      const rfc3339 = new Date(dueDate).toISOString();
      
      const summary = project.services.map(s => s.name).join(', ');
      const response = await fetch('https://www.googleapis.com/tasks/v1/lists/@default/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Follow up: ${project.client.name}`,
          notes: `Project Summary: ${summary}\nSite: ${project.client.address}\nLink: ${window.location.origin}`,
          due: rfc3339
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleGoogleSignIn(); // Re-auth
          throw new Error("Session expired. Please sign in again.");
        }
        throw new Error("Failed to create task");
      }

      alert("Follow-up reminder set successfully in Google Tasks!");
      setReminderModal({ show: false, project: null, dueDate: '', isSaving: false });
    } catch (error: any) {
      alert(error.message || "An error occurred");
      setReminderModal(prev => ({ ...prev, isSaving: false }));
    }
  };

  const saveToHistory = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
    localStorage.setItem('renowix_history', JSON.stringify(updatedProjects));
    setIsDirty(false);
  };

  const checkDuplicates = () => {
    if (!currentProjectId) return false;
    const existing = projects.find(p => p.id === currentProjectId);
    if (!existing) return false;
    const currentSerialized = JSON.stringify({ client, services, terms });
    const existingSerialized = JSON.stringify({ client: existing.client, services: existing.services, terms: existing.terms });
    return currentSerialized === existingSerialized;
  };

  const performSave = (updateExisting: boolean) => {
    const projectData: Project = {
      id: updateExisting && currentProjectId ? currentProjectId : Date.now().toString(),
      date: new Date().toLocaleString(),
      client,
      services,
      terms
    };

    let newHistory = [...projects];
    if (updateExisting && currentProjectId) {
      const idx = newHistory.findIndex(p => p.id === currentProjectId);
      if (idx > -1) newHistory[idx] = projectData;
    } else {
      newHistory = [projectData, ...newHistory];
      setCurrentProjectId(projectData.id);
    }

    saveToHistory(newHistory);
    setSaveModal({ show: false });
    alert(updateExisting ? "Project Updated!" : "Project Saved to History!");
  };

  const handleSaveClick = () => {
    if (services.length === 0) return alert("Add at least one measurement before saving.");
    if (checkDuplicates()) {
      alert("No changes detected. Project is up to date.");
      setIsDirty(false);
      return;
    }
    if (currentProjectId) {
      setSaveModal({ show: true });
    } else {
      performSave(false);
    }
  };

  const handleExitDecision = (decision: 'yes' | 'no') => {
    if (decision === 'yes') performSave(true);
    setIsDirty(false);
    if (exitModal.target) setView(exitModal.target);
    setExitModal({ show: false, target: null });
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
      const existingIdx = services.findIndex(s => s.categoryId === tempService.categoryId && s.typeId === tempService.typeId && s.name === tempService.name);
      if (existingIdx >= 0) newServices[existingIdx].items.push(item);
      else newServices.push({ ...(tempService as ActiveService), instanceId: Date.now().toString(), items: [item] });
      setServices(newServices);
    }
    setView('dashboard');
  };

  const editItem = (sIdx: number, iIdx: number) => {
    const service = services[sIdx];
    setTempService({ ...service });
    setEditingItemIndex({ sIdx, iIdx });
    setView('measure');
  };

  const deleteItem = (sIdx: number, iIdx: number) => {
    if (!confirm("Delete this item?")) return;
    const newServices = [...services];
    newServices[sIdx].items.splice(iIdx, 1);
    if (newServices[sIdx].items.length === 0) newServices.splice(sIdx, 1);
    setServices(newServices);
  };

  if (view === 'quote') return <QuoteView client={client} services={services} terms={terms} onBack={() => setView('dashboard')} />;
  if (view === 'measurement-sheet') return <MeasurementSheetView client={client} services={services} onBack={() => setView('dashboard')} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center sm:py-6 text-slate-800 font-sans">
      <div className="w-full max-w-xl bg-white sm:rounded-3xl shadow-2xl flex flex-col min-h-screen sm:min-h-[85vh] relative overflow-hidden border border-gray-100">
        
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
              <div className="mb-8 p-1 bg-white rounded-3xl shadow-2xl overflow-hidden ring-4 ring-slate-700/50">
                <img src={LOGO_URL} alt="Renowix" className="h-32 sm:h-40 w-auto object-contain" />
              </div>
              <h2 className="text-3xl font-display font-black mb-2 tracking-tight">Welcome Surveyor</h2>
              <p className="text-slate-400 mb-8 max-w-xs text-sm font-medium">Precision Measurement & Estimation Suite</p>
              <div className="w-full max-w-xs space-y-4">
                <input 
                  type="text" 
                  className="w-full p-4 text-center text-lg bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:border-brand-gold outline-none focus:ring-4 focus:ring-brand-gold/10 transition-all font-bold"
                  placeholder="Enter Your Name"
                  value={surveyorName}
                  onChange={e => setSurveyorName(e.target.value)}
                />
                <button 
                  onClick={() => surveyorName && (localStorage.setItem('renowix_surveyor', surveyorName), setView('welcome'))}
                  className="w-full bg-brand-gold text-slate-900 py-4 rounded-2xl font-black text-lg hover:bg-yellow-400 active:scale-[0.97] transition-all shadow-xl shadow-brand-gold/20"
                >
                  Get Started
                </button>
              </div>
            </div>
          )}

          {view === 'welcome' && (
            <div className="p-6">
              <div className="mb-8 flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-display font-black text-slate-800">Hello, <span className="text-brand-gold">{surveyorName}</span></h2>
                    <p className="text-slate-500 mt-1 font-medium text-sm">Create a fresh estimate or view records.</p>
                  </div>
                  <button 
                    onClick={googleToken ? () => { setGoogleToken(null); localStorage.removeItem('google_access_token'); } : handleGoogleSignIn}
                    className={`p-3 rounded-2xl border ${googleToken ? 'border-green-100 bg-green-50 text-green-600' : 'border-slate-200 bg-white text-slate-500'} shadow-sm hover:shadow-md transition-all flex items-center gap-2`}
                    title={googleToken ? "Google Linked" : "Link Google Tasks"}
                  >
                    {googleToken ? <CheckCircle size={20} /> : <Calendar size={20} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{googleToken ? 'Linked' : 'Sign In'}</span>
                  </button>
              </div>
               
              <div className="space-y-4">
                <button 
                  onClick={() => { setClient({name: '', address: ''}); setServices([]); setCurrentProjectId(null); setIsDirty(false); setView('client-details'); }}
                  className="group w-full bg-slate-800 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between hover:bg-slate-700 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 p-4 rounded-2xl text-brand-gold shadow-inner"><Plus size={28} /></div>
                    <div className="text-left">
                      <h3 className="font-black text-xl tracking-tight">New Quote</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Start Survey</p>
                    </div>
                  </div>
                  <ChevronRight className="group-hover:translate-x-2 transition-transform text-brand-gold" />
                </button>

                <button 
                  onClick={() => setView('history')}
                  className="w-full bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm"
                >
                   <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-4 rounded-2xl text-slate-600"><History size={28} /></div>
                    <div className="text-left">
                      <h3 className="font-black text-slate-800 text-lg">Project History</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Stored Records</p>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-300" />
                </button>
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="p-6">
              <Header title="Project History" onBack={() => setView('welcome')} />
              <div className="mt-6 space-y-4">
                {projects.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Briefcase size={64} className="mb-4 opacity-10" />
                    <p className="font-bold">No saved projects found.</p>
                  </div>
                )}
                {projects.map((p, idx) => (
                  <div key={p.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-soft hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                         <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl"><User size={20} /></div>
                         <div className="max-w-[180px]">
                            <h3 className="font-black text-slate-800 truncate">{p.client.name}</h3>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                               <MapPin size={10} className="text-brand-gold" />
                               <span className="truncate">{p.client.address || 'No Address'}</span>
                            </div>
                         </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            if (!googleToken) {
                              alert("Please sign in with Google on the Home screen first.");
                              return;
                            }
                            setReminderModal(prev => ({ ...prev, show: true, project: p }));
                          }}
                          className="p-2.5 text-slate-500 hover:text-brand-gold bg-slate-50 rounded-xl transition-all"
                          title="Set Reminder"
                        >
                          <Bell size={18} />
                        </button>
                        <button onClick={() => confirm("Permanently delete this project?") && saveToHistory(projects.filter(prj => prj.id !== p.id))} className="p-2.5 text-red-500 hover:text-red-700 bg-red-50 rounded-xl transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-4">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Project Date</span>
                       <span className="text-xs font-bold text-slate-600">{p.date}</span>
                    </div>
                    <button onClick={() => { setClient(p.client); setServices(p.services); setTerms(p.terms || DEFAULT_TERMS); setCurrentProjectId(p.id); setIsDirty(false); setView('dashboard'); }} className="w-full py-4 text-sm font-black bg-brand-gold text-slate-900 rounded-2xl hover:bg-yellow-400 active:scale-[0.97] transition-all shadow-lg shadow-brand-gold/10">
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
                <div className="bg-white p-6 rounded-3xl shadow-card border border-slate-50">
                  <InputGroup label="Client Name">
                    <input type="text" value={client.name} onChange={e => setClient({...client, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold focus:ring-4 focus:ring-brand-gold/5 transition-all font-bold" placeholder="e.g. Mr. Rajesh Kumar" />
                  </InputGroup>
                  <div className="h-4"></div>
                  <InputGroup label="Site Address">
                    <textarea value={client.address} onChange={e => setClient({...client, address: e.target.value})} rows={3} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold focus:ring-4 focus:ring-brand-gold/5 transition-all resize-none text-sm font-medium" placeholder="Full Site Address" />
                  </InputGroup>
                </div>
              </div>
              <Footer><button onClick={handleStartProject} className="w-full bg-slate-800 text-white py-5 rounded-2xl font-black text-lg hover:bg-slate-700 active:scale-[0.98] transition-all shadow-xl">Create Project Dashboard</button></Footer>
            </div>
          )}

          {view === 'dashboard' && (
            <div className="p-4 sm:p-6 pb-44">
              <Header title="Project Dashboard" onBack={() => handleBackNavigation('client-details')} />
              <div className="mt-4 bg-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                 <div className="absolute -top-12 -right-12 w-48 h-48 bg-brand-gold/20 rounded-full blur-3xl"></div>
                 <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                   <div className="space-y-3">
                     <div className="inline-flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                        <User size={14} className="text-brand-gold" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Client Profile</span>
                     </div>
                     <h3 className="text-2xl font-display font-black text-white leading-none tracking-tight">{client.name || "Unnamed Client"}</h3>
                     <div className="flex items-center gap-2 text-slate-400">
                        <MapPin size={12} className="text-brand-gold/60" />
                        <span className="text-xs truncate max-w-[200px] font-medium italic">{client.address || 'Address details missing'}</span>
                     </div>
                   </div>
                   <div className="w-full sm:w-auto text-left sm:text-right bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
                      <div className="flex items-center sm:justify-end gap-2 mb-1">
                        <Coins size={14} className="text-brand-gold" />
                        <p className="text-[10px] uppercase text-brand-gold font-black tracking-widest">Total Estimate</p>
                      </div>
                      <p className="text-4xl font-display font-black text-white leading-none"><span className="text-xl font-sans mr-1 opacity-50 font-normal">₹</span>{Math.round(services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0)).toLocaleString()}</p>
                   </div>
                 </div>
              </div>

              <div className="mt-10 space-y-4">
                <div className="flex items-center justify-between px-1">
                   <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-xs tracking-widest opacity-60"><Layers size={16} className="text-brand-gold" />Service Items</h3>
                </div>
                {services.map((s, sIdx) => (
                  <div key={sIdx} className="bg-white border-l-4 border-l-yellow-500 rounded-3xl shadow-card overflow-hidden border border-slate-100">
                    <div className="bg-white p-4 border-b border-slate-50 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <ServiceIcon categoryId={s.categoryId} typeId={s.typeId} name={s.name} />
                        <div>
                          <h4 className="font-black text-slate-800 text-sm tracking-tight">{s.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} {s.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-900 text-sm">₹ {Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}</span>
                        <button onClick={() => confirm("Remove this category?") && setServices(services.filter((_,i) => i !== sIdx))} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {s.items.map((item, iIdx) => (
                        <div key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-50/50">
                           <div>
                             <p className="font-bold text-slate-700 text-sm">{item.name}</p>
                             <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider">₹{item.rate} / {s.unit.toUpperCase()}</p>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="font-black text-slate-800 text-sm">₹{Math.round(item.cost).toLocaleString()}</span>
                              <div className="flex gap-1">
                                <button onClick={() => editItem(sIdx, iIdx)} className="p-2 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100"><Edit2 size={14} /></button>
                                <button onClick={() => deleteItem(sIdx, iIdx)} className="p-2 text-red-600 bg-red-50 rounded-xl hover:bg-red-100"><Trash2 size={14} /></button>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setTempService({...s}); setEditingItemIndex(null); setView('measure'); }} className="w-full py-3 bg-slate-50 text-[10px] font-black text-slate-400 border-t border-slate-100 uppercase tracking-[0.2em] hover:text-brand-gold hover:bg-white transition-all">+ Add Section</button>
                  </div>
                ))}
                <button onClick={() => setView('service-select')} className="w-full py-5 border-2 border-dashed border-slate-200 text-slate-400 rounded-3xl font-black flex items-center justify-center gap-2 hover:border-brand-gold hover:text-brand-gold hover:bg-yellow-50/30 transition-all active:scale-[0.98] uppercase text-xs tracking-widest"><PlusCircle size={20} /> Add Service Category</button>
              </div>

              <Footer>
                <div className="flex gap-2 w-full items-stretch h-14">
                   <button onClick={() => setView('measurement-sheet')} className="flex-1 bg-white border border-slate-200 text-slate-800 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-colors shadow-sm">
                      <RulerIcon size={20} className="text-slate-800" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">Sheet</span>
                   </button>
                   <button onClick={handleSaveClick} className="flex-1 bg-white border border-slate-200 text-slate-800 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-colors shadow-sm active:scale-[0.95]">
                      <Save size={20} className="text-slate-800" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">Save</span>
                   </button>
                   <button onClick={() => services.length > 0 ? setView('quote') : alert("No data to generate quote.")} className="flex-[2] bg-slate-800 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl hover:bg-slate-700 transition-all active:scale-[0.97]"><CheckCircle size={20} className="text-brand-gold" /><span className="text-sm">Generate Quote</span></button>
                </div>
              </Footer>
            </div>
          )}

          {view === 'service-select' && <ServiceSelector onBack={() => setView('dashboard')} onSelect={handleAddService} />}
          {view === 'measure' && tempService && <MeasurementForm serviceContext={tempService} editingItem={editingItemIndex !== null && tempService.items ? tempService.items[editingItemIndex.iIdx] : undefined} onBack={() => setView('dashboard')} onSave={handleSaveMeasurement} />}
        </div>
      </div>

      {/* REMINDER MODAL (Google Tasks Integration) */}
      {reminderModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-brand-gold/10 text-brand-gold p-4 rounded-full mb-4 shadow-inner"><Calendar size={32} /></div>
              <h3 className="text-xl font-black text-slate-800 mb-2">📅 Set Follow-up Reminder</h3>
              <p className="text-sm font-medium text-slate-500">Pick a date/time to be reminded to follow up with <strong>{reminderModal.project?.client.name}</strong>.</p>
            </div>
            <div className="mb-6">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Reminder Date & Time</label>
              <input 
                type="datetime-local" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-brand-gold/10 font-bold"
                value={reminderModal.dueDate}
                onChange={e => setReminderModal(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setReminderModal({ show: false, project: null, dueDate: '', isSaving: false })}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={createGoogleTask}
                disabled={reminderModal.isSaving}
                className="flex-[2] py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
              >
                {reminderModal.isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                {reminderModal.isSaving ? 'Scheduling...' : 'Set Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIT MODAL (Revised Wording to match original 3-button style) */}
      {exitModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-yellow-50 text-yellow-500 p-4 rounded-full mb-4 shadow-inner">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Save before leaving?</h3>
              <p className="text-sm font-medium text-slate-500">You have unsaved measurements. Leaving now will discard all new data.</p>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setExitModal({ show: false, target: null })}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <div className="flex-[2] flex gap-2">
                <button 
                  onClick={() => handleExitDecision('no')}
                  className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all"
                >
                  No
                </button>
                <button 
                  onClick={() => handleExitDecision('yes')}
                  className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SAVE DECISION MODAL */}
      {saveModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-blue-50 text-blue-500 p-4 rounded-full mb-4"><Save size={32} /></div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Existing project found</h3>
              <p className="text-sm font-medium text-slate-500">Would you like to update the current project entry or create a new duplicate copy?</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => performSave(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">New Copy</button>
              <button onClick={() => performSave(true)} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700">Update</button>
            </div>
            <button onClick={() => setSaveModal({ show: false })} className="w-full mt-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceIcon({ categoryId, typeId, name }: { categoryId: string, typeId: string, name: string }) {
  const Icon = categoryId === 'painting' ? PaintRoller : (typeId === 'kitchen_mod' ? Utensils : (typeId === 'tv_unit' ? Monitor : (typeId === 'wardrobe' ? Box : Hammer)));
  return (<div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700"><Icon size={20} /></div>);
}

function Header({ title, onBack }: { title: string, onBack: () => void }) {
  return (
    <div className="flex items-center gap-4 py-2 mb-4">
      <button onClick={onBack} className="p-3 -ml-3 text-slate-400 hover:text-slate-800 bg-white shadow-sm border border-slate-100 rounded-xl"><ArrowLeft size={20} /></button>
      <h1 className="font-display font-black text-xl text-slate-800 tracking-tight">{title}</h1>
    </div>
  );
}

function Footer({ children }: { children?: React.ReactNode }) {
  return (<div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 backdrop-blur-md p-4 border-t border-slate-100 z-[100] shadow-2xl">{children}</div>);
}

function InputGroup({ label, children }: { label: string, children?: React.ReactNode }) {
  return (<div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>{children}</div>);
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
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: `Strictly produce a concise 3 to 4 line paragraph description for a professional renovation service. Use simple, persuasive language. Highlight materials used and the primary benefit to the customer. Input context: "${description}"`,
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
          <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold transition-all font-bold" value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">Choose Category...</option>
            {Object.values(SERVICE_DATA).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </InputGroup>
        {cat && cat !== 'custom' && (
          <InputGroup label="Service Type">
            <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold transition-all font-bold" value={type} onChange={e => setType(e.target.value)}>
              <option value="">Choose Service...</option>
              {SERVICE_DATA[cat].items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </InputGroup>
        )}
        {cat === 'custom' && (
          <InputGroup label="Name">
            <input type="text" className="w-full p-4 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold font-bold" placeholder="e.g. Tile Work" value={customName} onChange={e => setCustomName(e.target.value)} />
          </InputGroup>
        )}
        {cat && type && (
          <div className="bg-yellow-50 p-5 rounded-3xl border border-dashed border-yellow-200">
            <InputGroup label="Description (Editable)">
              <textarea rows={6} className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none resize-none text-sm font-medium leading-relaxed" value={description} onChange={e => setDescription(e.target.value)} />
              <button onClick={handleAiRewrite} disabled={isAiLoading} className="mt-2 w-full bg-slate-800 text-white p-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-700">
                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Professional AI Rewrite
              </button>
            </InputGroup>
          </div>
        )}
      </div>
      <Footer><button onClick={() => onSelect(cat, type, customName, description)} disabled={!cat || !type} className="w-full bg-slate-800 text-white py-5 rounded-2xl font-black text-lg disabled:opacity-50 hover:bg-slate-700 shadow-xl">Proceed</button></Footer>
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
      if (serviceContext.categoryId === 'painting' && walls.length === 0) setWalls([1,2,3,4].map(id => ({id: id.toString(), width: 0})));
      if (isWoodwork && cabinetSections.length === 0) setCabinetSections([{ id: Date.now().toString(), name: 'Section 1', l: 0, b: 0, q: 1 }]);
    }
  }, []);

  const calculateTotal = (): number => {
    if (isWoodwork) return cabinetSections.reduce((acc, s) => acc + ((s.l || 0) * (s.b || 0) * (s.q || 1)), 0);
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

  return (
    <div className="p-6 pb-64">
      <Header title="Measurement" onBack={onBack} />
      <div className="space-y-6">
        <InputGroup label="Room / Main Label"><input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-gold/10 outline-none transition-all font-bold" value={name} onChange={e => setName(e.target.value)} placeholder={serviceContext.isKitchen ? "e.g. Master Kitchen" : "e.g. Room 1"} /></InputGroup>
        <InputGroup label="Rate (₹)"><input type="number" className="w-full p-4 bg-yellow-50 border border-yellow-100 rounded-2xl font-black text-xl focus:ring-4 focus:ring-brand-gold/10 outline-none" value={rate || ''} onChange={e => setRate(parseFloat(e.target.value) || 0)} /></InputGroup>
        {isWoodwork && (
          <div className="space-y-4">
             <div className="flex justify-between items-center px-1"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dimensions / Sections</span><button onClick={() => setCabinetSections([...cabinetSections, { id: Date.now().toString(), name: `Section ${cabinetSections.length + 1}`, l: 0, b: 0, q: 1 }])} className="text-[10px] font-black text-yellow-600 bg-yellow-50 px-4 py-2 rounded-full border border-yellow-100 hover:bg-yellow-100 transition-all"><Plus size={12} /> Add Section</button></div>
             <div className="space-y-4">
               {cabinetSections.map((s, idx) => (
                 <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                   <div className="flex justify-between items-center mb-4"><input className="text-sm font-black text-slate-800 bg-transparent border-none focus:ring-0 w-full outline-none" value={s.name} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, name: e.target.value} : sec))} />{cabinetSections.length > 1 && (<button onClick={() => setCabinetSections(cabinetSections.filter(sec => sec.id !== s.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>)}</div>
                   <div className="grid grid-cols-3 gap-4">
                     <div className="space-y-1"><label className="text-[8px] text-slate-400 font-black uppercase">Length (ft)</label><input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-black text-center" value={s.l || ''} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, l: parseFloat(e.target.value) || 0} : sec))} /></div>
                     <div className="space-y-1"><label className="text-[8px] text-slate-400 font-black uppercase">Breadth (ft)</label><input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-black text-center" value={s.b || ''} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, b: parseFloat(e.target.value) || 0} : sec))} /></div>
                     <div className="space-y-1"><label className="text-[8px] text-slate-400 font-black uppercase">Qty</label><input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-black text-center text-brand-gold" value={s.q || ''} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, q: parseFloat(e.target.value) || 0} : sec))} /></div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}
        {serviceContext.categoryId === 'painting' && (
          <div className="space-y-4">
             <InputGroup label="Standard Height (ft)"><input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-brand-gold/5 font-black text-lg" value={height} onChange={e => setHeight(parseFloat(e.target.value))}/></InputGroup>
             <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
               <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Wall Widths</span><button onClick={() => setWalls([...walls, {id: Date.now().toString(), width: 0}])} className="text-[10px] font-black text-yellow-600 hover:text-yellow-700 uppercase">+ Wall</button></div>
               <div className="grid grid-cols-2 gap-3">
                 {walls.map((w, idx) => <input key={w.id} type="number" className="p-4 border border-slate-100 rounded-2xl text-center bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all font-bold" value={w.width || ''} placeholder={`W ${idx+1}`} onChange={e => { const nw = [...walls]; nw[idx].width = parseFloat(e.target.value) || 0; setWalls(nw); }} />)}
               </div>
             </div>
             <div className="grid grid-cols-1 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ceiling Area</span><button onClick={() => setCeilings([...ceilings, { id: Date.now().toString(), l: 0, b: 0 }])} className="text-[10px] font-black text-yellow-600 hover:text-yellow-700 uppercase">+ Area</button></div>
                  <div className="space-y-2">
                    {ceilings.map((c, idx) => (
                      <div key={c.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-transparent hover:border-brand-gold/10 transition-colors">
                        <input type="number" className="w-full p-2 bg-transparent text-xs font-black outline-none text-center" value={c.l || ''} placeholder="L" onChange={e => { const nc = [...ceilings]; nc[idx].l = parseFloat(e.target.value) || 0; setCeilings(nc); }} />
                        <span className="text-slate-300 font-black text-[10px]">×</span>
                        <input type="number" className="w-full p-2 bg-transparent text-xs font-black outline-none text-center" value={c.b || ''} placeholder="B" onChange={e => { const nc = [...ceilings]; nc[idx].b = parseFloat(e.target.value) || 0; setCeilings(nc); }} />
                        <button onClick={() => setCeilings(ceilings.filter((_,i) => i !== idx))} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Extra Patch Area</span><button onClick={() => setExtraAreas([...extraAreas, { id: Date.now().toString(), l: 0, b: 0 }])} className="text-[10px] font-black text-yellow-600 hover:text-yellow-700 uppercase">+ Patch</button></div>
                  <div className="space-y-2">
                    {extraAreas.map((ea, idx) => (
                      <div key={ea.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-transparent hover:border-brand-gold/10 transition-colors">
                        <input type="number" className="w-full p-2 bg-transparent text-xs font-black outline-none text-center" value={ea.l || ''} placeholder="L" onChange={e => { const nea = [...extraAreas]; nea[idx].l = parseFloat(e.target.value) || 0; setExtraAreas(nea); }} />
                        <span className="text-slate-300 font-black text-[10px]">×</span>
                        <input type="number" className="w-full p-2 bg-transparent text-xs font-black outline-none text-center" value={ea.b || ''} placeholder="B" onChange={e => { const nea = [...extraAreas]; nea[idx].b = parseFloat(e.target.value) || 0; setExtraAreas(nea); }} />
                        <button onClick={() => setExtraAreas(extraAreas.filter((_,i) => i !== idx))} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
             <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Deductions</span>
               <div className="flex gap-2 mb-6">
                 {[ { label: 'Door', icon: DoorOpen, area: 21 }, { label: 'Window', icon: Layout, area: 12 }, { label: 'Other', icon: Plus, area: 0 } ].map(btn => (
                   <button key={btn.label} onClick={() => setDeductions([...deductions, { id: Date.now().toString(), type: btn.label, area: btn.area, qty: 1 }])} className="flex-1 py-3 px-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center gap-2 group hover:border-brand-gold shadow-sm"><btn.icon size={18} className="text-slate-400 group-hover:text-brand-gold" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{btn.label}</span></button>
                 ))}
               </div>
               {deductions.map((d, idx) => (
                 <div key={d.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-2">
                   <div className="w-14"><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">#{idx+1}</span></div>
                   <div className="flex-1"><label className="text-[8px] text-slate-400 uppercase font-black block">Area</label><input type="number" className="w-full p-1 bg-transparent text-xs font-black outline-none border-b border-slate-200" value={d.area || ''} onChange={e => setDeductions(deductions.map(dd => dd.id === d.id ? {...dd, area: parseFloat(e.target.value) || 0} : dd))} /></div>
                   <div className="flex-1"><label className="text-[8px] text-slate-400 uppercase font-black block">Qty</label><input type="number" className="w-full p-1 bg-transparent text-xs font-black outline-none border-b border-slate-200 text-center" value={d.qty || ''} onChange={e => setDeductions(deductions.map(dd => dd.id === d.id ? {...dd, qty: parseFloat(e.target.value) || 0} : dd))} /></div>
                   <button onClick={() => setDeductions(deductions.filter(dd => dd.id !== d.id))} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
      <Footer>
        <div className="mb-4 flex justify-between items-center bg-slate-800 text-white p-5 rounded-3xl shadow-xl">
          <div className="text-left"><p className="text-[9px] text-slate-400 uppercase font-black">Net Area</p><p className="font-black text-xl">{netArea.toFixed(2)} <span className="text-xs opacity-50">{serviceContext.unit}</span></p></div>
          <div className="text-right"><p className="text-[9px] text-slate-400 uppercase font-black">Subtotal</p><p className="font-black text-2xl text-brand-gold">₹{Math.round(cost).toLocaleString()}</p></div>
        </div>
        <button onClick={() => onSave({ id: editingItem?.id || Date.now().toString(), name: name || "Item", netArea, rate, cost, l, b, q, height, walls, ceilings, extraAreas, cabinetSections, deductions })} className="w-full bg-slate-800 text-white py-5 rounded-3xl font-black text-lg hover:bg-slate-700 shadow-xl uppercase">Save Section</button>
      </Footer>
    </div>
  );
}

function QuoteView({ client, services, terms: initialTerms, onBack }: { client: ClientDetails, services: ActiveService[], terms: string, onBack: () => void }) {
  const [terms, setTerms] = useState(initialTerms);
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const subTotal = services.reduce((s, ser) => s + ser.items.reduce((is, i) => is + i.cost, 0), 0);
  const discountAmount = useMemo(() => discountType === 'percent' ? (subTotal * discountValue) / 100 : discountType === 'fixed' ? discountValue : 0, [subTotal, discountType, discountValue]);
  const finalTotal = subTotal - discountAmount;
  const date = useMemo(() => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), []);

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col items-center p-4 print:p-0">
      <div className="w-full max-w-[210mm] mb-6 flex justify-between no-print items-center px-2">
        <button onClick={onBack} className="bg-white px-5 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase flex items-center gap-2 shadow-sm"><ArrowLeft size={16} /> Dashboard</button>
        <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-slate-700"><Printer size={16} /> Generate PDF</button>
      </div>
      <div className="w-full max-w-[210mm] bg-white min-h-[297mm] px-12 py-12 print:px-8 print:py-8 text-slate-900 shadow-[0_0_80px_-20px_rgba(0,0,0,0.15)] print:shadow-none flex flex-col overflow-hidden">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-10">
          <div>
            <img src={LOGO_URL} className="h-20 print:h-16 object-contain mb-4 scale-110" />
            <h1 className="text-3xl font-black uppercase text-slate-800">Renowix Renovations</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-2">Complete Home Interior Solutions</p>
          </div>
          <div className="text-right">
            <h2 className="text-6xl font-black text-slate-100 print:text-slate-200 uppercase tracking-tighter">Quote</h2>
            <div className="space-y-1.5 pr-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</p>
              <p className="font-black text-sm text-slate-800">#RX-{Math.floor(Date.now() / 10000).toString().slice(-6)}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">Date</p>
              <p className="font-bold text-xs text-slate-600">{date}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-12 mb-12">
          <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl shadow-inner"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 border-b pb-1">Client</h4><p className="text-2xl font-black text-slate-800 mb-1">{client.name}</p><p className="text-[10px] text-brand-gold font-black uppercase">Preferred Account</p></div>
          <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl shadow-inner"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 border-b pb-1">Site Map</h4><p className="text-[11px] font-bold text-slate-500 italic whitespace-pre-wrap">{client.address || "Address pending"}</p></div>
        </div>
        <div className="flex-1 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="py-4 px-4 text-left font-black text-[13px] uppercase tracking-[0.2em] w-12 border-r border-white/5">#</th>
                <th className="py-4 px-5 text-left font-black text-[13px] uppercase tracking-[0.2em] border-r border-white/5">Service Profile & Location</th>
                <th className="py-4 px-4 text-right font-black text-[13px] uppercase tracking-[0.2em] w-28 border-r border-white/5">Qty</th>
                <th className="py-4 px-4 text-right font-black text-[13px] uppercase tracking-[0.2em] w-24 border-r border-white/5">Rate</th>
                <th className="py-4 px-5 text-right font-black text-[13px] uppercase tracking-[0.2em] w-36 whitespace-nowrap">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-x border-b border-slate-100">
              {services.map((s, idx) => (
                <tr key={idx} className="break-inside-avoid">
                  <td className="py-6 px-4 align-top font-black text-slate-200 text-xs border-r border-slate-50">{(idx + 1)}</td>
                  <td className="py-6 px-5 align-top border-r border-slate-50">
                    <p className="font-black text-slate-800 mb-1.5 uppercase tracking-tight text-sm leading-tight"><strong>{s.name}</strong></p>
                    <p className="text-[9px] text-slate-400 leading-normal font-bold italic mb-4 max-w-sm">{s.desc}</p>
                    <div className="space-y-1.5">{s.items.map((item, iIdx) => (<div key={iIdx} className="flex justify-between items-center text-[10px] bg-white px-3 py-1.5 rounded-xl border border-slate-100 text-slate-600 shadow-sm"><span className="font-bold opacity-70">{item.name}</span><span className="font-black text-[9px] text-slate-400 uppercase">{item.netArea.toFixed(2)} {s.unit}</span></div>))}</div>
                  </td>
                  <td className="py-6 px-4 align-top text-right font-black text-slate-800 text-sm border-r border-slate-50">{s.items.reduce((a, b) => a + b.netArea, 0).toFixed(2)}</td>
                  <td className="py-6 px-4 align-top text-right font-bold text-slate-400 text-xs border-r border-slate-50">₹{s.items[0]?.rate.toLocaleString()}</td>
                  <td className="py-6 px-5 align-top text-right font-black text-slate-800 text-sm whitespace-nowrap">₹{Math.round(s.items.reduce((a, b) => a + b.cost, 0)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-10 flex flex-col items-end gap-6">
          <div className="w-full max-w-md no-print bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
             <div className="flex items-center justify-between mb-4"><span className="text-[10px] font-black uppercase text-slate-400">Promotions</span><div className="flex gap-1.5">{['none', 'percent', 'fixed'].map(opt => (<button key={opt} onClick={() => setDiscountType(opt as any)} className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase transition-all ${discountType === opt ? 'bg-slate-800 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400'}`}>{opt}</button>))}</div></div>
             {discountType !== 'none' && (<div className="flex items-center gap-3"><div className="relative flex-1"><input type="number" value={discountValue || ''} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} className="w-full p-4 pl-10 rounded-2xl border border-slate-200 bg-white text-sm font-black outline-none" placeholder={discountType === 'percent' ? "%" : "₹"} /><div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">{discountType === 'percent' ? <Percent size={16}/> : <CircleDollarSign size={16}/>}</div></div><div className="text-[13px] font-black text-brand-gold bg-white px-4 py-4 rounded-2xl border border-slate-100">- ₹{Math.round(discountAmount).toLocaleString()}</div></div>)}
          </div>
          <div className="w-72">
            <div className="flex justify-between py-2.5 px-5 border-b border-slate-100"><span className="text-[10px] font-black text-slate-300 uppercase">Sub-Total</span><span className="font-black text-sm text-slate-500">₹{Math.round(subTotal).toLocaleString()}</span></div>
            {discountAmount > 0 && (<div className="flex justify-between py-2.5 px-5 border-b border-slate-100"><span className="text-[10px] font-black text-brand-gold uppercase">Discount</span><span className="font-black text-sm text-brand-gold">(-) ₹{Math.round(discountAmount).toLocaleString()}</span></div>)}
            <div className="flex justify-between py-2.5 px-5 border-b border-slate-100"><span className="text-[10px] font-black text-slate-300 uppercase">Regulatory</span><span className="text-[10px] font-black text-slate-200 uppercase">GST At Actuals</span></div>
            <div className="flex justify-between py-5 px-6 bg-slate-800 text-white rounded-3xl shadow-2xl mt-6 scale-110 origin-right transition-transform hover:scale-[1.15]"><span className="text-[11px] font-black uppercase tracking-[0.3em] self-center text-brand-gold">Net Payable</span><span className="text-2xl font-black whitespace-nowrap">₹{Math.round(finalTotal).toLocaleString()}</span></div>
          </div>
        </div>
        <div className="mt-16 break-inside-avoid">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div><h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-5 border-l-4 border-slate-800 pl-3">Terms</h4><div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 no-print"><textarea rows={6} className="w-full text-[10px] bg-transparent border-none outline-none resize-none leading-loose font-bold text-slate-400" value={terms} onChange={e => setTerms(e.target.value)} /></div><div className="print-only text-[10px] leading-relaxed text-slate-400 font-bold whitespace-pre-wrap pl-2 italic">{terms}</div></div>
            <div className="flex flex-col justify-end space-y-12 pb-6"><div className="flex justify-between items-end gap-10"><div className="text-center flex-1"><div className="border-t-2 border-slate-800 mb-3 w-full"></div><p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] text-center">Renowix Auth.</p></div><div className="text-center flex-1"><div className="border-t-2 border-slate-200 mb-3 w-full"></div><p className="text-[10px] font-black uppercase text-slate-200 tracking-[0.2em] text-center">Customer Sign.</p></div></div></div>
          </div>
        </div>
        <div className="mt-20 text-center opacity-20 no-print"><p className="text-[9px] font-black uppercase tracking-[1em]">Renowix Surveyor Pro Enterprise Suite</p></div>
      </div>
    </div>
  );
}

function MeasurementSheetView({ client, services, onBack }: { client: ClientDetails, services: ActiveService[], onBack: () => void }) {
  const date = useMemo(() => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), []);
  return (
    <div className="bg-slate-100 min-h-screen flex flex-col items-center p-4 print:p-0">
      <div className="w-full max-w-[210mm] mb-6 flex justify-between no-print items-center px-2">
        <button onClick={onBack} className="bg-white px-5 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase flex items-center gap-2 shadow-sm"><ArrowLeft size={16} /> Dashboard</button>
        <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-slate-700"><Printer size={16} /> Print Sheet</button>
      </div>
      <div className="w-full max-w-[210mm] bg-white min-h-[297mm] px-12 py-12 print:px-8 print:py-8 text-slate-900 shadow-[0_0_80px_-20px_rgba(0,0,0,0.15)] print:shadow-none flex flex-col">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-10 mb-10">
          <div><img src={LOGO_URL} className="h-20 print:h-16 object-contain mb-4 scale-110" /><h1 className="text-2xl font-black uppercase text-slate-800">Renowix Renovations</h1><p className="text-[9px] text-slate-400 font-bold uppercase mt-2">Measurement Profile (Price-Free)</p></div>
          <div className="text-right"><h2 className="text-5xl font-black text-slate-100 print:text-slate-200 uppercase tracking-tighter">M-Sheet</h2><div className="space-y-1.5 pr-2"><p className="text-[10px] font-black text-slate-400 uppercase">Audit ID</p><p className="font-black text-xs text-slate-800">MSR-{Math.floor(Date.now() / 1000).toString().slice(-6)}</p><p className="text-[10px] font-black text-slate-400 uppercase mt-3">Date</p><p className="font-bold text-xs text-slate-600">{date}</p></div></div>
        </div>
        <div className="grid grid-cols-2 gap-10 mb-10"><div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl"><h4 className="text-[9px] font-black text-slate-400 uppercase mb-3 border-b pb-1">Client</h4><p className="text-lg font-black text-slate-800">{client.name}</p></div><div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl"><h4 className="text-[9px] font-black text-slate-400 uppercase mb-3 border-b pb-1">Site</h4><p className="text-[10px] font-bold text-slate-400 whitespace-pre-wrap">{client.address || "Address pending"}</p></div></div>
        <div className="flex-1">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-slate-100"><tr className="border-y-2 border-slate-900"><th className="py-4 px-3 text-left font-black uppercase w-12">S#</th><th className="py-4 px-4 text-left font-black uppercase w-48">Location</th><th className="py-4 px-4 text-left font-black uppercase">Details</th><th className="py-4 px-4 text-right font-black uppercase w-28">Net Area</th><th className="py-4 px-4 text-left font-black uppercase w-20">Unit</th></tr></thead>
            <tbody className="divide-y divide-slate-200 border-x border-b">
              {services.map((s, sIdx) => (
                <React.Fragment key={sIdx}>
                  <tr className="bg-slate-50"><td colSpan={5} className="py-3 px-4 font-black text-[10px] uppercase text-slate-900 flex items-center gap-3"><TableIcon size={14} className="text-slate-400" /> {s.name}</td></tr>
                  {s.items.map((item, iIdx) => (
                    <tr key={item.id} className="align-top"><td className="py-5 px-3 text-slate-300 font-black text-center text-xs">{(iIdx + 1)}</td><td className="py-5 px-4 font-black text-slate-800 uppercase text-[12px]">{item.name}</td><td className="py-5 px-4 text-slate-500 font-medium">{item.cabinetSections?.map(cab => (
                      <div key={cab.id} className="flex justify-between border-b last:border-0 pb-1.5"><span className="text-slate-400 text-[9px] uppercase">{cab.name}</span><span>({cab.l}×{cab.b})×{cab.q} = {(cab.l*cab.b*cab.q).toFixed(2)}</span></div>
                    ))} {s.categoryId === 'painting' && (<div>{item.walls?.map(w => w.width).join('+')}×H:{item.height}ft {item.ceilings?.length ? ` + C:${item.ceilings.reduce((a,b)=>a+(b.l*b.b),0).toFixed(2)}` : ''}</div>)} </td><td className="py-5 px-4 text-right font-black text-slate-900 text-[13px]">{item.netArea.toFixed(2)}</td><td className="py-5 px-4 text-left font-black text-slate-200 uppercase text-[9px]">{s.unit}</td></tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-16 flex justify-between items-end border-t border-slate-100 pt-10"><div className="text-left w-56"><div className="h-12 border-b-2 border-slate-900"></div><p className="text-[10px] font-black uppercase text-slate-300 text-center">Surveyor Auth.</p></div><div className="text-right w-56"><div className="h-12 border-b-2 border-slate-100"></div><p className="text-[10px] font-black uppercase text-slate-300 text-center">Supervisor / Client</p></div></div>
      </div>
    </div>
  );
}
