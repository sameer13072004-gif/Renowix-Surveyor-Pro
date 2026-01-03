
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  ArrowLeft, Plus, Trash2, Edit2, Save, History, Printer, CheckCircle,
  ChevronRight, Briefcase, User, MapPin, PaintRoller, Hammer, Utensils,
  Monitor, Layers, Box, Sparkles, Loader2, Table as TableIcon,
  Ruler as RulerIcon, DoorOpen, Layout, Coins, Percent, CircleDollarSign,
  AlertTriangle, PlusCircle, Calendar, LogOut, Bell, XCircle, Eye,
  EyeOff, Settings, ChevronDown, ChevronUp, Clock, ArrowUpRight,
  LogIn, Mail, Lock, ExternalLink
} from 'lucide-react';

import { 
  ActiveService, ClientDetails, MeasurementItem, PageView, Project, 
  Wall, CeilingSection, CabinetSection, Deduction 
} from './types';
import { SERVICE_DATA, DEFAULT_TERMS } from './constants';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

const LOGO_URL = "https://renowix.in/wp-content/uploads/2025/12/Picsart_25-12-04_19-18-42-905-scaled.png";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<PageView | 'login'>('login');
  const [surveyorName, setSurveyorName] = useState<string>('');
  const [client, setClient] = useState<ClientDetails>({ name: '', address: '' });
  const [services, setServices] = useState<ActiveService[]>([]);
  const [terms, setTerms] = useState<string>(DEFAULT_TERMS);
  const [tempService, setTempService] = useState<Partial<ActiveService> | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<{ sIdx: number; iIdx: number } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isEstimateHidden, setIsEstimateHidden] = useState(false);
  const [editingServiceInfo, setEditingServiceInfo] = useState<{ sIdx: number; name: string; desc: string } | null>(null);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  
  // Enhanced error handling states
  const [firestoreError, setFirestoreError] = useState<{message: string, link?: string} | null>(null);
  
  const [saveModal, setSaveModal] = useState<{ show: boolean }>({ show: false });
  const [editClientModal, setEditClientModal] = useState<{ show: boolean; project: Project | null }>({ show: false, project: null });
  const [exitModal, setExitModal] = useState<{ show: boolean; target: PageView | null }>({ show: false, target: null });

  // Handle Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profileDoc = await getDoc(doc(db, 'profiles', currentUser.uid));
          if (profileDoc.exists()) {
            setSurveyorName(profileDoc.data().name);
            setView('welcome');
          } else {
            setView('setup');
          }
        } catch (e) {
          console.error("Profile fetch error:", e);
          setView('setup');
        }
      } else {
        setView('login');
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync Projects from Firestore with Index Error detection
  useEffect(() => {
    if (!user) return;
    setFirestoreError(null);

    // Initial query attempt with sorting
    let q = query(
      collection(db, 'projects'), 
      where('surveyorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const startSnapshot = (currentQuery: any) => {
      return onSnapshot(currentQuery, 
        (snapshot) => {
          const projs: Project[] = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as Project[];
          setProjects(projs);
          setFirestoreError(null);
        },
        (error) => {
          console.error("Firestore Listener Error:", error);
          
          if (error.message.includes("requires an index")) {
            // Extract the link from the error message if possible
            const linkMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
            const indexLink = linkMatch ? linkMatch[0] : null;

            setFirestoreError({
              message: "Sort Index Required: This query needs a composite index in the Firebase Console to sort projects by date.",
              link: indexLink || undefined
            });

            // Fallback: Re-run query without sorting so user can at least see data
            console.warn("Retrying query without sorting due to missing index...");
            const fallbackQuery = query(
              collection(db, 'projects'), 
              where('surveyorId', '==', user.uid)
            );
            // We don't want to loop infinitely, so we just set the error and 
            // the user can click the link to fix it properly.
          } else if (error.code === 'permission-denied') {
            setFirestoreError({ message: "Access Denied: Please update your Firestore Security Rules to allow access to your projects." });
          } else {
            setFirestoreError({ message: "Sync Error: " + error.message });
          }
        }
      );
    };

    const unsubscribe = startSnapshot(q);
    return unsubscribe;
  }, [user]);

  const toggleExpand = (id: string) => {
    setExpandedServices(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBackNavigation = (target: PageView) => {
    if (isDirty && (view === 'dashboard' || view === 'measure')) {
      setExitModal({ show: true, target });
    } else {
      setView(target);
    }
  };

  const performSave = async (updateExisting: boolean, silent = false) => {
    if (!user) return;
    
    const projectData = {
      date: new Date().toLocaleString(),
      client,
      services,
      terms,
      surveyorId: user.uid,
      createdAt: serverTimestamp()
    };

    try {
      if (updateExisting && currentProjectId) {
        await updateDoc(doc(db, 'projects', currentProjectId), projectData);
      } else {
        const docRef = await addDoc(collection(db, 'projects'), projectData);
        setCurrentProjectId(docRef.id);
      }
      setIsDirty(false);
      setSaveModal({ show: false });
      if (!silent) alert(updateExisting ? "Cloud Updated!" : "Saved to Cloud!");
    } catch (e: any) {
      alert("Error saving: " + e.message);
    }
  };

  const handleSaveClick = () => {
    if (services.length === 0) return alert("Add at least one measurement before saving.");
    if (currentProjectId) {
      setSaveModal({ show: true });
    } else {
      performSave(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !surveyorName) return;
    try {
      await setDoc(doc(db, 'profiles', user.uid), {
        name: surveyorName,
        email: user.email,
        updatedAt: serverTimestamp()
      });
      setView('welcome');
    } catch (e: any) {
      alert("Profile Error: " + e.message);
    }
  };

  const loadProject = (p: Project) => {
    setClient(p.client);
    setServices(p.services);
    setTerms(p.terms || DEFAULT_TERMS);
    setCurrentProjectId(p.id);
    setIsDirty(false);
    setView('dashboard');
  };

  const handleSignOut = () => {
    if (confirm("Sign out of Surveyor Pro?")) {
      signOut(auth);
    }
  };

  const handleStartProject = () => {
    if (!client.name) return alert("Please enter client name");
    setView('dashboard');
    setIsDirty(true);
  };

  const handleAddService = (catId: string, typeId: string, customName?: string, customDesc?: string) => {
    const category = SERVICE_DATA[catId];
    if (!category) return;
    const typeDef = category.items.find(i => i.id === typeId);
    
    const newService: ActiveService = {
      instanceId: Date.now().toString(),
      categoryId: catId,
      typeId: typeId,
      name: customName || typeDef?.name || 'New Service',
      desc: customDesc || typeDef?.desc || '',
      unit: (typeDef?.unit || category.unit || 'sqft') as any,
      items: [],
      isKitchen: typeDef?.type === 'kitchen',
      isCustom: catId === 'custom',
      rate: typeDef?.rate || 0
    };

    setServices(prev => [...prev, newService]);
    setExpandedServices(prev => ({ ...prev, [newService.instanceId]: true }));
    setIsDirty(true);
    setView('dashboard');
  };

  const deleteItem = (sIdx: number, iIdx: number) => {
    if (!confirm("Remove this section?")) return;
    const newServices = [...services];
    newServices[sIdx].items.splice(iIdx, 1);
    setServices(newServices);
    setIsDirty(true);
  };

  const editItem = (sIdx: number, iIdx: number) => {
    setTempService(services[sIdx]);
    setEditingItemIndex({ sIdx, iIdx });
    setView('measure');
  };

  const handleSaveMeasurement = (item: MeasurementItem) => {
    const sIdx = services.findIndex(s => s.instanceId === tempService?.instanceId);
    if (sIdx === -1) return;

    const newServices = [...services];
    if (editingItemIndex !== null) {
      newServices[sIdx].items[editingItemIndex.iIdx] = item;
    } else {
      newServices[sIdx].items.push(item);
    }

    setServices(newServices);
    setIsDirty(true);
    setView('dashboard');
    setTempService(null);
    setEditingItemIndex(null);
  };

  if (authLoading) return (
    <div className="min-h-screen bg-appBg flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin text-brand-gold mx-auto mb-4" size={48} />
        <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Connecting to Cloud...</p>
      </div>
    </div>
  );

  if (view === 'login') return <AuthView onComplete={() => {}} />;
  if (view === 'quote') return <QuoteView client={client} services={services} terms={terms} onBack={() => setView('dashboard')} />;
  if (view === 'measurement-sheet') return <MeasurementSheetView client={client} services={services} onBack={() => setView('dashboard')} />;

  return (
    <div className="min-h-screen bg-appBg flex flex-col items-center sm:py-6 text-slate-800 font-sans overflow-x-hidden">
      <div className="w-full max-w-xl bg-cardBg sm:rounded-3xl shadow-prof flex flex-col min-h-screen sm:min-h-[85vh] relative overflow-hidden border border-cardBorder">
        
        {view !== 'setup' && (
          <div className="px-4 py-3 bg-white border-b border-cardBorder sticky top-0 z-[150] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Renowix" className="h-10 w-auto object-contain" />
              <div className="flex items-center gap-1.5 leading-none">
                 <span className="text-xl font-black text-brand-charcoal tracking-tighter">Surveyor</span>
                 <span className="text-xl font-black text-brand-gold tracking-tighter italic">Pro</span>
              </div>
            </div>
            
            <button onClick={handleSignOut} className="p-2.5 text-slate-400 hover:text-brand-red bg-slate-50 rounded-xl transition-all border border-cardBorder shadow-sm">
              <LogOut size={18} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar bg-appBg">
          {firestoreError && (
            <div className="mx-6 mt-4 p-5 bg-yellow-50 border border-brand-gold/20 rounded-2xl flex flex-col gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-brand-gold shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-xs font-black text-brand-charcoal uppercase tracking-widest mb-1.5">Database Configuration Required</p>
                  <p className="text-[11px] font-medium text-slate-600 leading-relaxed">{firestoreError.message}</p>
                </div>
              </div>
              
              {firestoreError.link && (
                <a 
                  href={firestoreError.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-brand-charcoal text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-[0.98]"
                >
                  <ExternalLink size={14} className="text-brand-gold" /> Click to Auto-Create Index
                </a>
              )}
              
              <div className="flex justify-between items-center px-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase italic">Indexing takes ~3 mins after clicking</p>
                <button onClick={() => window.location.reload()} className="text-[10px] font-black text-brand-gold uppercase tracking-widest underline">Refresh App</button>
              </div>
            </div>
          )}

          {view === 'setup' && (
            <div className="flex flex-col items-center justify-center min-h-full p-8 bg-brand-charcoal text-white text-center">
              <div className="mb-8 p-1 bg-white rounded-3xl shadow-2xl overflow-hidden ring-4 ring-slate-700/50">
                <img src={LOGO_URL} alt="Renowix" className="h-32 sm:h-40 w-auto object-contain" />
              </div>
              <h2 className="text-3xl font-display font-black mb-2 tracking-tight">Setup Profile</h2>
              <p className="text-slate-400 mb-8 max-w-xs text-sm font-medium">Please enter your professional name</p>
              <div className="w-full max-w-xs space-y-4">
                <input 
                  type="text" 
                  className="w-full h-14 p-4 text-center text-lg bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:border-brand-gold outline-none font-bold"
                  placeholder="Your Full Name"
                  value={surveyorName}
                  onChange={e => setSurveyorName(e.target.value)}
                />
                <button 
                  onClick={handleUpdateProfile}
                  className="w-full bg-brand-gold text-brand-charcoal py-4 rounded-2xl font-black text-lg hover:bg-yellow-400 transition-all shadow-xl shadow-brand-gold/20"
                >
                  Create Profile
                </button>
              </div>
            </div>
          )}

          {view === 'welcome' && (
            <div className="p-6">
              <div className="mb-8">
                  <h2 className="text-2xl font-display font-black text-brand-charcoal">Hello, <span className="text-brand-gold">{surveyorName}</span></h2>
                  <p className="text-slate-500 mt-1 font-medium text-sm italic">{user?.email}</p>
              </div>
               
              <div className="space-y-4">
                <button 
                  onClick={() => { setClient({name: '', address: ''}); setServices([]); setCurrentProjectId(null); setIsDirty(false); setView('client-details'); }}
                  className="group w-full bg-brand-charcoal text-white p-6 rounded-3xl shadow-xl flex items-center justify-between hover:bg-slate-700 active:scale-[0.98] transition-all"
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
                  className="w-full bg-white border border-cardBorder p-6 rounded-3xl flex items-center justify-between hover:bg-slate-50 active:scale-[0.98] transition-all shadow-prof"
                >
                   <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-4 rounded-2xl text-slate-600"><History size={28} /></div>
                    <div className="text-left">
                      <h3 className="font-black text-brand-charcoal text-lg">Project History</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Cloud Sync Records</p>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-300" />
                </button>
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="p-6 pb-24">
              <Header title="Cloud Records" onBack={() => setView('welcome')} />
              <div className="mt-6 space-y-4">
                {projects.length === 0 && !firestoreError && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Briefcase size={64} className="mb-4 opacity-10" />
                    <p className="font-bold">No saved projects found.</p>
                  </div>
                )}
                {projects.map((p) => {
                  const [datePart, timePart] = p.date.split(', ');
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => loadProject(p)}
                      className="bg-cardBg rounded-xl p-4 shadow-prof border border-cardBorder hover:bg-slate-50 active:bg-slate-100 transition-all relative cursor-pointer group"
                    >
                      <button 
                        onClick={async (e) => { 
                          e.stopPropagation(); 
                          if(confirm("Permanently delete this cloud entry?")) {
                            await deleteDoc(doc(db, 'projects', p.id));
                          }
                        }}
                        className="absolute top-3 right-3 p-2 text-brand-red hover:bg-red-50 rounded-lg z-10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      
                      <div className="flex items-center gap-3 mb-3">
                        <div className="bg-blue-50 text-brand-blue p-2.5 rounded-lg"><User size={20} /></div>
                        <div className="overflow-hidden">
                          <h3 className="font-bold text-lg text-brand-charcoal truncate leading-tight">{p.client.name}</h3>
                          <p className="text-xs text-slate-400 font-medium truncate flex items-center gap-1 mt-0.5"><MapPin size={10} /> {p.client.address || 'No Address'}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-end">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-slate-600">{datePart}</span>
                          <span className="text-[12px] text-slate-400 font-normal">{timePart}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditClientModal({ show: true, project: p }); }}
                            className="p-2 text-brand-blue hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <div className="p-2 bg-appBg text-slate-400 rounded-lg group-hover:bg-brand-gold group-hover:text-brand-charcoal transition-all">
                            <ArrowUpRight size={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'client-details' && (
            <div className="p-6 pb-32">
              <Header title="Project Details" onBack={() => handleBackNavigation('welcome')} />
              <div className="mt-8 space-y-6">
                <div className="bg-cardBg p-6 rounded-xl shadow-prof border border-cardBorder">
                  <InputGroup label="Client Name" labelSize="text-xs font-bold">
                    <input type="text" value={client.name} onChange={e => setClient({...client, name: e.target.value})} className="w-full h-12 p-4 bg-white border border-inputBorder rounded-xl outline-none focus:border-brand-gold transition-all font-bold" placeholder="e.g. Sameer" />
                  </InputGroup>
                  <div className="h-6"></div>
                  <InputGroup label="Site Address" labelSize="text-xs font-bold">
                    <textarea value={client.address} onChange={e => setClient({...client, address: e.target.value})} rows={3} className="w-full p-4 bg-white border border-inputBorder rounded-xl outline-none focus:border-brand-gold transition-all resize-none text-sm font-medium" placeholder="Full Site Address" />
                  </InputGroup>
                </div>
              </div>
              <Footer><button onClick={handleStartProject} className="w-full bg-brand-charcoal text-white py-5 rounded-xl font-black text-lg hover:bg-slate-700 active:scale-[0.98] transition-all shadow-xl">Create Project Dashboard</button></Footer>
            </div>
          )}

          {view === 'dashboard' && (
            <div className="p-4 sm:p-6 pb-44">
              <div className="sticky top-0 z-[120] -mx-4 sm:-mx-6 mb-8 bg-brand-charcoal shadow-xl px-4 py-2.5 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2.5 overflow-hidden">
                   <div className="bg-brand-gold/10 p-1.5 rounded-lg text-brand-gold"><User size={12} /></div>
                   <div className="overflow-hidden">
                      <h3 className="text-[14px] font-bold text-white leading-none truncate">{client.name || "Unnamed Client"}</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate max-w-[120px]">Cloud Synced</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex items-center bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                      <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mr-2">ESTIMATE</p>
                      <p className={`text-sm font-black text-brand-gold leading-none ${isEstimateHidden ? 'masked-estimate' : ''}`}>
                         ₹{Math.round(services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0)).toLocaleString()}
                      </p>
                   </div>
                   <button onClick={() => setIsEstimateHidden(!isEstimateHidden)} className="p-1.5 bg-slate-800 rounded-lg text-white/70 hover:text-white">
                      {isEstimateHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                   </button>
                </div>
              </div>

              <Header title="Service Items" onBack={() => handleBackNavigation('welcome')} />
              <div className="mt-4 space-y-6">
                {services.map((s, sIdx) => {
                  const isExpanded = expandedServices[s.instanceId];
                  return (
                    <div key={s.instanceId} className="bg-cardBg rounded-xl shadow-prof border border-cardBorder overflow-hidden transition-all duration-200">
                      <div className="p-4 border-b border-cardBorder flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => toggleExpand(s.instanceId)}>
                        <div className="flex items-center gap-3">
                          <ServiceIcon categoryId={s.categoryId} typeId={s.typeId} name={s.name} />
                          <div>
                            <h4 className="font-bold text-[15px] text-brand-charcoal tracking-tight leading-tight">{s.name}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} {s.unit}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-black text-brand-charcoal text-sm ${isEstimateHidden ? 'masked-estimate' : ''}`}>₹ {Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}</span>
                          <div className="flex items-center gap-1">
                             <button onClick={(e) => { e.stopPropagation(); setEditingServiceInfo({ sIdx, name: s.name, desc: s.desc }); }} className="p-2 text-slate-300 hover:text-brand-blue transition-colors"><Settings size={14} /></button>
                             {isExpanded ? <ChevronUp size={16} className="text-slate-400 ml-1" /> : <ChevronDown size={16} className="text-slate-400 ml-1" />}
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="divide-y divide-cardBorder bg-slate-50/30">
                          {s.items.map((item, iIdx) => (
                            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-white">
                               <div><p className="font-bold text-slate-700 text-sm">{item.name}</p><p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider italic">₹{item.rate} / {s.unit.toUpperCase()}</p></div>
                               <div className="flex items-center gap-2">
                                  <span className={`font-bold text-brand-charcoal text-sm ${isEstimateHidden ? 'masked-estimate' : ''}`}>₹{Math.round(item.cost).toLocaleString()}</span>
                                  <div className="flex gap-1.5 ml-2">
                                    <button onClick={() => editItem(sIdx, iIdx)} className="p-1.5 text-brand-blue bg-white border border-cardBorder rounded-lg shadow-sm"><Edit2 size={12} /></button>
                                    <button onClick={() => deleteItem(sIdx, iIdx)} className="p-1.5 text-brand-red bg-white border border-cardBorder rounded-lg shadow-sm"><Trash2 size={12} /></button>
                                  </div>
                               </div>
                            </div>
                          ))}
                          <button onClick={() => { setTempService({...s}); setEditingItemIndex(null); setView('measure'); }} className="w-full py-3 bg-white text-[10px] font-black text-brand-gold uppercase tracking-[0.2em] border-t border-cardBorder hover:bg-slate-50 transition-all">+ Add Section</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => setView('service-select')} className="w-full h-10 border border-cardBorder bg-white text-slate-400 rounded-xl font-bold flex items-center justify-center gap-2 hover:border-brand-gold hover:text-brand-gold transition-all active:scale-[0.98] uppercase text-[10px] tracking-widest shadow-prof"><PlusCircle size={14} /> Add Category</button>
              </div>

              <Footer>
                <div className="flex gap-2 w-full items-stretch h-14">
                   <button onClick={() => setView('measurement-sheet')} className="flex-1 bg-white border border-cardBorder text-slate-800 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 shadow-sm"><RulerIcon size={18} /><span className="text-[9px] font-black uppercase tracking-tighter">Sheet</span></button>
                   <button onClick={handleSaveClick} className="flex-1 bg-white border border-cardBorder text-slate-800 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 shadow-sm active:scale-[0.95]"><Save size={18} /><span className="text-[9px] font-black uppercase tracking-tighter">Sync</span></button>
                   <button onClick={() => services.length > 0 ? setView('quote') : alert("No data.")} className="flex-[2.5] bg-brand-charcoal text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg hover:bg-slate-700 transition-all"><CheckCircle size={18} className="text-brand-gold" /><span className="text-sm">Generate Quote</span></button>
                </div>
              </Footer>
            </div>
          )}

          {view === 'service-select' && <ServiceSelector onBack={() => setView('dashboard')} onSelect={handleAddService} />}
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

      {/* MODALS */}
      {saveModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-charcoal/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-cardBg rounded-xl p-6 shadow-2xl border border-cardBorder">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-blue-50 text-brand-blue p-4 rounded-full mb-4 shadow-sm"><Save size={32} /></div>
              <h3 className="text-lg font-black text-brand-charcoal mb-1">Sync to Cloud</h3>
              <p className="text-xs font-medium text-slate-500">Update current file or create a duplicate copy?</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => performSave(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] uppercase tracking-widest">New Copy</button>
              <button onClick={() => performSave(true)} className="flex-1 py-3 bg-brand-charcoal text-white rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg">Update Cloud</button>
            </div>
          </div>
        </div>
      )}

      {exitModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-charcoal/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-cardBg rounded-xl p-6 shadow-2xl border border-cardBorder">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-yellow-50 text-brand-gold p-4 rounded-full mb-4 shadow-sm"><AlertTriangle size={32} /></div>
              <h3 className="text-lg font-black text-brand-charcoal mb-1">Unsaved Progress</h3>
              <p className="text-xs font-medium text-slate-500">Leaving will discard all unsynced measurements.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setExitModal({ show: false, target: null })} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] uppercase tracking-widest">Cancel</button>
              <button onClick={() => { setIsDirty(false); if (exitModal.target) setView(exitModal.target); setExitModal({ show: false, target: null }); }} className="flex-1 py-3 text-brand-red font-bold text-[11px] uppercase tracking-widest border border-brand-red/10 rounded-xl">Discard</button>
              <button onClick={() => performSave(true, true).then(() => { if (exitModal.target) setView(exitModal.target); setExitModal({ show: false, target: null }); })} className="flex-1 py-3 bg-brand-charcoal text-white rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg">Sync & Exit</button>
            </div>
          </div>
        </div>
      )}

      {editClientModal.show && editClientModal.project && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-brand-charcoal/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-cardBg rounded-xl p-6 shadow-2xl border border-cardBorder">
            <h3 className="text-lg font-black text-brand-charcoal mb-4 flex items-center gap-2"><Edit2 size={18} className="text-brand-blue" /> Edit Client</h3>
            <InputGroup label="Client Name" labelSize="text-[10px]"><input type="text" className="w-full h-12 px-4 bg-white border border-inputBorder rounded-xl outline-none font-bold text-sm" value={editClientModal.project.client.name} onChange={e => setEditClientModal({...editClientModal, project: { ...editClientModal.project!, client: { ...editClientModal.project!.client, name: e.target.value } }})} /></InputGroup>
            <div className="h-6"></div>
            <InputGroup label="Site Address" labelSize="text-[10px]"><textarea rows={3} className="w-full p-4 bg-white border border-inputBorder rounded-xl outline-none text-xs font-medium" value={editClientModal.project.client.address} onChange={e => setEditClientModal({...editClientModal, project: { ...editClientModal.project!, client: { ...editClientModal.project!.client, address: e.target.value } }})} /></InputGroup>
            <div className="flex gap-2 mt-8">
              <button onClick={() => setEditClientModal({ show: false, project: null })} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] uppercase tracking-widest">Cancel</button>
              <button onClick={() => performSave(true)} className="flex-1 py-3 bg-brand-charcoal text-white rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg">Update Cloud</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthView({ onComplete }: { onComplete: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onComplete();
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-charcoal flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl border border-white/5">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Renowix" className="h-16 mx-auto mb-4 object-contain" />
          <h2 className="text-2xl font-display font-black text-brand-charcoal tracking-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest text-[9px]">Cloud Authentication</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-brand-red rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="email" required className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold font-bold transition-all" placeholder="email@renowix.in" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="password" required className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold font-bold transition-all" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>
          <button disabled={loading} className="w-full h-14 bg-brand-gold text-brand-charcoal rounded-2xl font-black text-lg shadow-xl shadow-brand-gold/20 hover:bg-yellow-400 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={24} /> : (isLogin ? <LogIn size={24} /> : <PlusCircle size={24} />)}
            {isLogin ? 'Sign In' : 'Join Now'}
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-xs font-bold text-slate-400 hover:text-brand-charcoal transition-colors uppercase tracking-widest">
            {isLogin ? "New user? Create an account" : "Have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Subcomponents
function ServiceIcon({ categoryId, typeId, name }: { categoryId: string, typeId: string, name: string }) {
  const Icon = categoryId === 'painting' ? PaintRoller : (typeId === 'kitchen_mod' ? Utensils : (typeId === 'tv_unit' ? Monitor : (typeId === 'wardrobe' ? Box : Hammer)));
  return (<div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700 shadow-sm border border-cardBorder"><Icon size={18} /></div>);
}

function Header({ title, onBack }: { title: string, onBack: () => void }) {
  return (
    <div className="flex items-center gap-4 py-1 mb-3">
      <button onClick={onBack} className="p-2.5 -ml-2 text-slate-400 hover:text-brand-charcoal bg-white shadow-prof border border-cardBorder rounded-lg"><ArrowLeft size={18} /></button>
      <h1 className="font-display font-black text-[18px] text-brand-charcoal tracking-tight uppercase truncate">{title}</h1>
    </div>
  );
}

function Footer({ children }: { children?: React.ReactNode }) {
  return (<div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 backdrop-blur-md p-4 border-t border-cardBorder z-[100] shadow-2xl safe-bottom">{children}</div>);
}

function InputGroup({ label, children, labelSize = "text-[14px] font-bold" }: { label: string, children?: React.ReactNode, labelSize?: string }) {
  return (<div className="space-y-1.5"><label className={`${labelSize} text-slate-400 uppercase tracking-widest ml-1`}>{label}</label>{children}</div>);
}

function ServiceSelector({ onBack, onSelect }: { onBack: () => void, onSelect: (c:string, t:string, customN?:string, customD?:string) => void }) {
  const [cat, setCat] = useState('');
  const [type, setType] = useState('');
  const [customName, setCustomName] = useState('');
  const [description, setDescription] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => { 
    if (cat === 'custom') setType('custom_item');
    else setType('');
  }, [cat]);

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
        contents: `Strictly produce a concise 3 line paragraph description for professional renovation. Context: "${description}"`,
        config: { temperature: 0.7 } 
      });
      if (response.text) setDescription(response.text.trim());
    } catch (e) { alert("AI error."); }
    finally { setIsAiLoading(false); }
  };

  return (
    <div className="p-6 pb-32 bg-appBg">
      <Header title="Select Service" onBack={onBack} />
      <div className="space-y-6">
        <div className="bg-cardBg p-5 rounded-xl border border-cardBorder shadow-prof">
          <InputGroup label="Category">
            <select className="w-full h-12 px-4 bg-white border border-inputBorder rounded-xl outline-none font-bold" value={cat} onChange={e => setCat(e.target.value)}>
              <option value="">Choose Category...</option>
              {Object.values(SERVICE_DATA).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </InputGroup>
          {cat && cat !== 'custom' && (
            <div className="mt-6">
              <InputGroup label="Service Type">
                <select className="w-full h-12 px-4 bg-white border border-inputBorder rounded-xl outline-none font-bold" value={type} onChange={e => setType(e.target.value)}>
                  <option value="">Choose Service...</option>
                  {SERVICE_DATA[cat].items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </InputGroup>
            </div>
          )}
          {cat === 'custom' && (
            <div className="mt-6">
              <InputGroup label="Name">
                <input type="text" className="w-full h-12 px-4 border border-inputBorder bg-white rounded-xl outline-none font-bold" placeholder="e.g. Tile Work" value={customName} onChange={e => setCustomName(e.target.value)} />
              </InputGroup>
            </div>
          )}
        </div>
        
        {cat && type && (
          <div className="bg-yellow-50/30 p-5 rounded-xl border border-dashed border-brand-gold/30">
            <InputGroup label="Description (Editable)" labelSize="text-[11px] font-bold">
              <textarea rows={5} className="w-full p-4 bg-white border border-inputBorder rounded-xl outline-none resize-none text-xs font-medium leading-relaxed" value={description} onChange={e => setDescription(e.target.value)} />
              <button onClick={handleAiRewrite} disabled={isAiLoading} className="mt-3 w-full h-12 bg-brand-charcoal text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Professional AI Rewrite
              </button>
            </InputGroup>
          </div>
        )}
      </div>
      <Footer><button onClick={() => onSelect(cat, type, customName, description)} disabled={!cat || !type} className="w-full h-14 bg-brand-charcoal text-white rounded-xl font-black text-base disabled:opacity-50 shadow-xl">Proceed</button></Footer>
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
  const [height, setHeight] = useState<number>(editingItem?.height || 9);
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
    if (isWoodwork) {
      return cabinetSections.reduce((acc, s) => {
        const itemArea = (s.l || 0) * (s.b || 0);
        return acc + (itemArea > 0 ? itemArea * (s.q || 1) : (s.q || 1));
      }, 0);
    }
    if (serviceContext.categoryId === 'painting') {
      const wArea = walls.reduce((s, w) => s + (w.width || 0), 0) * height;
      const cArea = ceilings.reduce((s, c) => s + (c.l * c.b), 0);
      const eArea = extraAreas.reduce((s, e) => s + (e.l * e.b), 0);
      const dArea = deductions.reduce((s, d) => s + (d.area * d.qty), 0);
      return Math.max(0, wArea + cArea + eArea - dArea);
    }
    const area = (l || 0) * (b || 0);
    return area > 0 ? area * (q || 1) : (q || 1);
  };

  const netArea = calculateTotal();
  const cost = netArea * rate;

  return (
    <div className="flex flex-col min-h-full relative bg-appBg">
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto no-scrollbar">
        <Header title={serviceContext.name || "Measurement"} onBack={onBack} />
        <div className="space-y-6 pb-64">
          <div className="bg-cardBg p-3 rounded-xl border border-cardBorder shadow-prof space-y-4">
             <InputGroup label="ROOM / MAIN LABEL"><input className="w-full h-10 px-3 bg-white border border-inputBorder rounded-lg outline-none font-bold text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Master Kitchen" /></InputGroup>
             <div className="grid grid-cols-2 gap-4">
                <InputGroup label="RATE (₹)"><input type="number" className="w-full h-10 px-3 bg-white border border-inputBorder rounded-lg font-black text-sm outline-none" value={rate || ''} onChange={e => setRate(parseFloat(e.target.value) || 0)} /></InputGroup>
                {serviceContext.categoryId === 'painting' && (
                  <InputGroup label="HEIGHT (FT)"><input type="number" className="w-full h-10 px-3 bg-white border border-inputBorder rounded-lg outline-none font-bold text-sm" value={height} onChange={e => setHeight(parseFloat(e.target.value) || 0)}/></InputGroup>
                )}
             </div>
          </div>
          
          {isWoodwork && (
            <div className="space-y-3">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">SECTIONS & SIZING</span>
              <div className="space-y-3">
                {cabinetSections.map((s, idx) => (
                  <div key={s.id} className="bg-cardBg p-3 rounded-xl border border-cardBorder shadow-prof relative">
                    <div className="flex justify-between items-center mb-2"><input className="text-xs font-black text-brand-charcoal bg-transparent border-none focus:ring-0 w-full outline-none" value={s.name} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, name: e.target.value} : sec))} />{cabinetSections.length > 1 && (<button onClick={() => setCabinetSections(cabinetSections.filter(sec => sec.id !== s.id))} className="text-slate-300 hover:text-brand-red"><Trash2 size={12} /></button>)}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-0.5"><label className="text-[9px] text-slate-400 font-bold uppercase">Len</label><input type="number" className="w-full h-9 px-2 bg-white border border-inputBorder rounded-lg text-xs font-bold text-center" value={s.l || ''} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, l: parseFloat(e.target.value) || 0} : sec))} /></div>
                      <div className="space-y-0.5"><label className="text-[9px] text-slate-400 font-bold uppercase">Brd</label><input type="number" className="w-full h-9 px-2 bg-white border border-inputBorder rounded-lg text-xs font-bold text-center" value={s.b || ''} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, b: parseFloat(e.target.value) || 0} : sec))} /></div>
                      <div className="space-y-0.5"><label className="text-[9px] text-slate-400 font-bold uppercase">Qty</label><input type="number" className="w-full h-9 px-2 bg-white border border-brand-gold/30 rounded-lg text-xs font-black text-center text-brand-gold" value={s.q || ''} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, q: parseFloat(e.target.value) || 0} : sec))} /></div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <button onClick={() => setCabinetSections([...cabinetSections, { id: Date.now().toString(), name: `Section ${cabinetSections.length + 1}`, l: 0, b: 0, q: 1 }])} className="text-[10px] font-black text-slate-400 h-8 px-3 border border-cardBorder rounded-lg hover:bg-white bg-white/50 transition-all flex items-center gap-1 shadow-sm">+ ADD SECTION</button>
                </div>
              </div>
            </div>
          )}

          {serviceContext.categoryId === 'painting' && (
            <div className="space-y-6">
              <div className="bg-cardBg p-3 rounded-xl shadow-prof border border-cardBorder">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">WALL WIDTHS</span>
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  {walls.map((w, idx) => (
                    <div key={w.id} className="relative h-10">
                      <input type="number" className="w-full h-full px-3 pl-10 border border-inputBorder rounded-lg text-center bg-white focus:border-brand-gold transition-all font-bold text-sm" value={w.width || ''} placeholder="0" onChange={e => { const nw = [...walls]; nw[idx].width = parseFloat(e.target.value) || 0; setWalls(nw); }} />
                      <div className="absolute top-1/2 left-3 -translate-y-1/2 text-[14px] font-bold text-slate-400 uppercase pointer-events-none">W{idx+1}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setWalls([...walls, {id: Date.now().toString(), width: 0}])} className="text-[10px] font-black text-slate-400 h-8 px-4 border border-cardBorder bg-white rounded-lg hover:bg-slate-50 transition-all shadow-sm">+ ADD WALL</button>
                </div>
              </div>

              <div className="bg-cardBg p-3 rounded-xl shadow-prof border border-cardBorder">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">CEILING AREAS</span>
                <div className="space-y-2 mb-3">
                  {ceilings.map((c, idx) => (
                    <div key={c.id} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-lg border border-cardBorder">
                      <div className="flex-1 text-center"><label className="block text-[8px] font-black text-slate-300 mb-0.5 uppercase">Len</label><input type="number" className="w-full h-8 bg-white border border-inputBorder rounded text-xs font-bold outline-none text-center" value={c.l || ''} onChange={e => { const nc = [...ceilings]; nc[idx].l = parseFloat(e.target.value) || 0; setCeilings(nc); }} /></div>
                      <span className="text-slate-300 font-bold text-sm">×</span>
                      <div className="flex-1 text-center"><label className="block text-[8px] font-black text-slate-300 mb-0.5 uppercase">Brd</label><input type="number" className="w-full h-8 bg-white border border-inputBorder rounded text-xs font-bold outline-none text-center" value={c.b || ''} onChange={e => { const nc = [...ceilings]; nc[idx].b = parseFloat(e.target.value) || 0; setCeilings(nc); }} /></div>
                      <button onClick={() => setCeilings(ceilings.filter((_,i) => i !== idx))} className="text-brand-red hover:bg-red-50 p-1.5 rounded-md"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setCeilings([...ceilings, { id: Date.now().toString(), l: 0, b: 0 }])} className="text-[10px] font-black text-slate-400 h-8 px-4 border border-cardBorder bg-white rounded-lg hover:bg-slate-50 transition-all shadow-sm">+ ADD AREA</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 z-[110] w-full flex justify-center p-4 safe-bottom">
        <div className="w-full max-w-xl flex flex-col gap-2">
          <div className="flex justify-between items-center bg-brand-charcoal shadow-2xl text-white py-4 px-6 rounded-2xl border border-white/5">
            <div className="text-left">
              <p className="text-[9px] text-white/50 uppercase font-black tracking-widest mb-0.5">NET QUANTITY</p>
              <p className="font-extrabold text-[16px] text-brand-gold leading-none">{netArea.toFixed(2)} <span className="text-[11px] opacity-40 uppercase font-bold">{serviceContext.unit}</span></p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/50 uppercase font-black tracking-widest mb-0.5">SUBTOTAL</p>
              <p className="font-extrabold text-[16px] text-brand-gold leading-none">₹{Math.round(cost).toLocaleString()}</p>
            </div>
          </div>
          <button 
            onClick={() => onSave({ id: editingItem?.id || Date.now().toString(), name: name || "Item", netArea, rate, cost, l, b, q, height, walls, ceilings, extraAreas, cabinetSections, deductions })} 
            className="w-full h-14 bg-brand-charcoal text-white rounded-xl font-black text-sm hover:bg-slate-700 shadow-xl uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <CheckCircle size={18} className="text-brand-gold" /> Save Section Measurement
          </button>
        </div>
      </div>
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
    <div className="bg-white min-h-screen flex flex-col items-center p-0">
      <div className="w-full max-w-[210mm] mt-6 mb-6 flex justify-between no-print items-center px-4">
        <button onClick={onBack} className="bg-white px-5 py-3 rounded-xl border border-cardBorder text-xs font-black uppercase flex items-center gap-2 shadow-sm"><ArrowLeft size={16} /> Dashboard</button>
        <button onClick={() => window.print()} className="bg-brand-charcoal text-white px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-slate-700"><Printer size={16} /> Print Quote</button>
      </div>
      <div className="w-full max-w-[210mm] bg-white px-10 py-10 print:px-6 print:py-6 text-slate-900 flex flex-col font-sans relative border border-cardBorder shadow-prof">
        <div className="flex justify-between items-center border-b-4 border-brand-charcoal pb-4 mb-6 flex-shrink-0">
          <div className="flex items-center gap-8"><img src={LOGO_URL} className="h-24 object-contain" /><div><h1 className="text-4xl font-black uppercase text-brand-charcoal leading-none mb-1 tracking-tighter">Renowix Renovations</h1><p className="text-sm text-slate-500 font-bold uppercase tracking-[0.3em]">Excellence in Home Interiors</p></div></div>
          <div className="text-right"><h2 className="text-5xl font-black text-slate-100 uppercase tracking-tighter leading-none select-none">Quote</h2></div>
        </div>
        <div className="grid grid-cols-2 gap-8 mb-10 flex-shrink-0">
          <div className="bg-slate-50 border border-cardBorder p-6 rounded-sm"><h4 className="text-[12px] font-black text-slate-600 uppercase tracking-widest mb-4 border-b pb-2">Client Profile</h4><p className="text-2xl font-black text-brand-charcoal mb-1">{client.name}</p><p className="text-sm font-medium text-slate-700 leading-relaxed italic">{client.address || "Address pending verification"}</p></div>
          <div className="bg-slate-50 border border-cardBorder p-6 rounded-sm"><h4 className="text-[12px] font-black text-slate-600 uppercase tracking-widest mb-4 border-b pb-2">Quote Reference</h4><div className="space-y-3"><div className="flex justify-between items-baseline"><span className="text-[11px] text-slate-500 font-bold uppercase">Ref ID</span><span className="text-sm font-black text-brand-charcoal">#RX-{Math.floor(Date.now() / 10000).toString().slice(-6)}</span></div><div className="flex justify-between items-baseline"><span className="text-[11px] text-slate-500 font-bold uppercase">Date</span><span className="text-sm font-black text-brand-charcoal">{date}</span></div></div></div>
        </div>
        <div className="flex-grow">
          <table className="w-full border-collapse table-fixed">
            <thead><tr className="bg-brand-charcoal text-white border border-brand-charcoal"><th className="py-4 px-4 text-left font-black uppercase tracking-widest text-[11px]" style={{width: '50px'}}>#</th><th className="py-4 px-6 text-left font-black uppercase tracking-widest text-[11px]">Service Scope</th><th className="py-4 px-4 text-right font-black uppercase tracking-widest text-[11px]" style={{width: '90px'}}>Qty</th><th className="py-4 px-4 text-right font-black uppercase tracking-widest text-[11px]" style={{width: '110px'}}>Rate</th><th className="py-4 px-6 text-right font-black uppercase tracking-widest text-[11px]" style={{width: '140px'}}>Amount (₹)</th></tr></thead>
            <tbody>
              {services.map((s, idx) => (
                <tr key={idx} className="border border-cardBorder break-inside-avoid">
                  <td className="py-5 px-4 align-top text-lg font-bold text-slate-800 bg-slate-50/30 border-r border-cardBorder">{(idx + 1).toString().padStart(2, '0')}</td>
                  <td className="py-5 px-6 align-top border-r border-cardBorder"><h3 className="text-lg font-black text-brand-charcoal mb-1 uppercase leading-tight tracking-tight">{s.name}</h3><p className="text-[11px] text-slate-600 leading-[1.6] font-medium mb-4">{s.desc}</p></td>
                  <td className="py-5 px-4 align-top text-right font-bold text-base text-brand-charcoal border-r border-cardBorder bg-slate-50/10">{s.items.reduce((a, b) => a + b.netArea, 0).toFixed(2)}</td>
                  <td className="py-5 px-4 align-top text-right font-semibold text-base text-slate-600 border-r border-cardBorder">₹{s.items[0]?.rate.toLocaleString()}</td>
                  <td className="py-5 px-6 align-top text-right font-black text-lg text-brand-charcoal bg-slate-50/20">₹{Math.round(s.items.reduce((a, b) => a + b.cost, 0)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end p-6 border-x border-b border-cardBorder bg-slate-50/40 mb-6"><div className="text-right"><span className="text-[12px] font-black uppercase text-slate-500 tracking-[0.2em] mr-6">Sub-Total Cost</span><span className="text-xl font-black text-brand-charcoal tracking-tight">₹{Math.round(subTotal).toLocaleString()}</span></div></div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 break-inside-avoid">
          <div className="w-full max-w-sm flex flex-col gap-4">
            <div className="no-print bg-slate-50 p-4 rounded border border-cardBorder mb-2"><div className="flex items-center justify-between mb-3"><span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Apply Discount</span><div className="flex gap-1">{['none', 'percent', 'fixed'].map(t => (<button key={t} onClick={() => setDiscountType(t as any)} className={`px-2 py-1 rounded text-[7px] font-black uppercase transition-all ${discountType === t ? 'bg-brand-charcoal text-white' : 'bg-white border border-cardBorder text-slate-300'}`}>{t}</button>))}</div></div>{discountType !== 'none' && (<input type="number" className="w-full p-2 border border-inputBorder rounded text-xs font-bold outline-none" placeholder={discountType === 'percent' ? "% Percent" : "Fixed Amount (₹)"} value={discountValue || ''} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} />)}</div>
            <div className="bg-brand-charcoal text-white p-6 rounded-[1.5rem] shadow-xl flex items-center justify-between w-full relative overflow-hidden group"><div className="flex flex-col"><span className="text-brand-gold font-black text-lg tracking-[0.1em] leading-tight uppercase">Final</span><span className="text-brand-gold font-black text-lg tracking-[0.1em] leading-tight uppercase">Payable</span></div><div className="text-4xl font-black tracking-tight flex items-baseline gap-1"><span className="text-2xl opacity-80">₹</span>{Math.round(finalTotal).toLocaleString()}</div></div>
            {discountAmount > 0 && (<p className="text-[10px] font-black text-brand-gold italic text-right px-2 mt-2">Applied Privilege Discount: -₹{Math.round(discountAmount).toLocaleString()}</p>)}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-8 border-t-2 border-slate-100 pt-6 break-inside-avoid"><div className="flex flex-col gap-2"><h4 className="text-[13px] font-black text-brand-charcoal uppercase tracking-normal mb-2">Contractual Terms & Conditions</h4><div className="no-print"><textarea rows={5} className="w-full text-sm p-4 bg-slate-50 border border-inputBorder rounded font-medium leading-relaxed outline-none text-slate-600" value={terms} onChange={e => setTerms(e.target.value)} /></div><div className="print-only text-sm leading-[1.8] text-slate-700 font-semibold tracking-tight whitespace-pre-wrap px-4 italic border-l-4 border-slate-200">{terms}</div></div><div className="flex justify-between items-end pb-4 mt-4"><div className="w-72 text-center"><div className="h-20 border-b-2 border-brand-charcoal mb-3 opacity-10"></div><p className="text-[11px] font-black uppercase text-brand-charcoal tracking-widest">Authorized Executive</p></div><div className="w-72 text-center"><div className="h-20 border-b-2 border-cardBorder mb-3 opacity-10"></div><p className="text-[11px] font-black uppercase text-brand-charcoal tracking-widest">Client Signature</p></div></div></div>
      </div>
    </div>
  );
}

function MeasurementSheetView({ client, services, onBack }: { client: ClientDetails, services: ActiveService[], onBack: () => void }) {
  const date = useMemo(() => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), []);
  return (
    <div className="bg-slate-100 min-h-screen flex flex-col items-center p-4 print:p-0">
      <div className="w-full max-w-[210mm] mb-6 flex justify-between no-print items-center px-2"><button onClick={onBack} className="bg-white px-5 py-3 rounded-xl border border-cardBorder text-xs font-black uppercase flex items-center gap-2 shadow-sm"><ArrowLeft size={16} /> Dashboard</button><button onClick={() => window.print()} className="bg-brand-charcoal text-white px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-slate-700"><Printer size={16} /> Print Sheet</button></div>
      <div className="w-full max-w-[210mm] bg-white min-h-[297mm] px-10 py-10 print:px-6 print:py-6 text-slate-900 shadow-prof border border-cardBorder flex flex-col"><div className="flex justify-between items-center border-b-2 border-brand-charcoal pb-6 mb-8"><div className="flex items-center gap-6"><img src={LOGO_URL} className="h-16 object-contain" /><div><h1 className="text-2xl font-black uppercase text-slate-800 leading-none">Renowix Renovations</h1><p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Audit Measurement Profile</p></div></div><div className="text-right"><h2 className="text-4xl font-black text-slate-100 print:text-slate-200 uppercase tracking-tighter leading-none">M-Sheet</h2></div></div><div className="grid grid-cols-2 gap-8 mb-8"><div className="p-4 bg-slate-50 border border-cardBorder rounded-xl"><h4 className="text-[9px] font-black text-slate-400 uppercase mb-2 border-b pb-1 tracking-widest">Client Name & Address</h4><p className="text-lg font-black text-slate-800">{client.name}</p><p className="text-[10px] font-medium text-slate-500 mt-1 whitespace-pre-wrap">{client.address || "Address pending verification"}</p></div><div className="p-4 bg-slate-50 border border-cardBorder rounded-xl"><h4 className="text-[9px] font-black text-slate-400 uppercase mb-2 border-b pb-1 tracking-widest">Metadata</h4><div className="flex flex-col gap-1"><div className="flex justify-between"><span className="text-[8px] font-bold text-slate-400">AUDIT ID</span><span className="text-xs font-black text-slate-800 uppercase">#MSR-{Math.floor(Date.now() / 1000).toString().slice(-6)}</span></div><div className="flex justify-between"><span className="text-[8px] font-bold text-slate-400">SITE DATE</span><span className="text-xs font-black text-slate-800 uppercase">{date}</span></div></div></div></div><div className="flex-1"><table className="w-full text-[10px] border-collapse border border-cardBorder"><thead className="bg-slate-100"><tr className="border-y-2 border-brand-charcoal"><th className="py-3 px-3 text-left font-black uppercase w-10">S#</th><th className="py-3 px-4 text-left font-black uppercase">Category / Room Section</th><th className="py-3 px-4 text-left font-black uppercase">Detailed Calculations</th><th className="py-3 px-4 text-right font-black uppercase w-24">Net Area</th><th className="py-3 px-4 text-left font-black uppercase w-16">Unit</th></tr></thead><tbody>{services.map((s, sIdx) => (<React.Fragment key={s.instanceId}><tr className="bg-slate-50"><td colSpan={5} className="py-2.5 px-3 font-black text-[10px] uppercase text-brand-charcoal bg-slate-100 border-y border-cardBorder">CATEGORY: {s.name}</td></tr>{s.items.map((item, iIdx) => (<tr key={item.id} className="align-top border-b border-slate-100 break-inside-avoid"><td className="py-5 px-3 text-slate-300 font-black">{(iIdx + 1)}</td><td className="py-5 px-4 font-black text-slate-800 uppercase text-[11px]">{item.name}</td><td className="py-5 px-4 text-slate-500 font-medium"><div className="flex flex-wrap gap-1">{item.cabinetSections?.map((cab, ci) => (<span key={cab.id} className="text-[10px] font-bold">{cab.name} ({cab.l}x{cab.b})x{cab.q}{ci < item.cabinetSections!.length - 1 ? ', ' : ''}</span>))}</div>{s.categoryId === 'painting' && (<div className="mt-2 text-[8px] text-slate-400 italic font-bold">{item.walls?.length ? `Walls: ${item.walls.map(w => w.width).join('+')} × ${item.height}H` : ''}</div>)}</td><td className="py-5 px-4 text-right font-black text-slate-900 text-[12px]">{item.netArea.toFixed(2)}</td><td className="py-5 px-4 text-left font-black text-slate-200 uppercase text-[8px]">{s.unit}</td></tr>))} </React.Fragment>))}</tbody></table></div></div>
    </div>
  );
}
