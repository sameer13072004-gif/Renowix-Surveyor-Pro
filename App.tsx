import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  ArrowLeft, Plus, Trash2, Edit2, Save, History, Printer, CheckCircle,
  ChevronRight, Briefcase, User, MapPin, PaintRoller, Hammer, Utensils,
  Monitor, Box, Sparkles, Loader2, Ruler as RulerIcon, 
  AlertTriangle, PlusCircle, LogOut, Eye,
  EyeOff, Settings, ChevronDown, ChevronUp, ArrowUpRight,
  LogIn, Mail, Lock, ExternalLink, Download, Users, FileText, LayoutDashboard, UserPlus,
  PackageSearch, RefreshCw
} from 'lucide-react';

import { 
  ActiveService, ClientDetails, MeasurementItem, PageView, Project, 
  Wall, CeilingSection, CabinetSection, Deduction, UserProfile 
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
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { generateCSV, downloadCSV } from './csvHelper';

const LOGO_URL = "https://renowix.in/wp-content/uploads/2025/12/Picsart_25-12-04_19-18-42-905-scaled.png";
const ADMIN_EMAIL = "info@renowix.in";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<PageView | 'login'>('login');
  
  // Data States
  const [surveyorName, setSurveyorName] = useState<string>('');
  const [client, setClient] = useState<ClientDetails>({ name: '', address: '' });
  const [services, setServices] = useState<ActiveService[]>([]);
  const [terms, setTerms] = useState<string>(DEFAULT_TERMS);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]); // For Admin
  const [allSupervisors, setAllSupervisors] = useState<UserProfile[]>([]); // For Admin
  
  // Admin Sync Error Tracking
  const [adminSyncError, setAdminSyncError] = useState<string | null>(null);

  // UI States
  const [tempService, setTempService] = useState<Partial<ActiveService> | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<{ sIdx: number; iIdx: number } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectStatus, setCurrentProjectStatus] = useState<'quotation' | 'project'>('quotation');
  const [isEstimateHidden, setIsEstimateHidden] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [saveModal, setSaveModal] = useState<{ show: boolean }>({ show: false });

  // Handle Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const profileRef = doc(db, 'profiles', currentUser.uid);
          const profileDoc = await getDoc(profileRef);
          
          let role: 'admin' | 'supervisor' = currentUser.email === ADMIN_EMAIL ? 'admin' : 'supervisor';
          
          // Enforce role and profile document for Admin to satisfy Firestore Rules
          if (role === 'admin') {
             const adminProfile: UserProfile = {
                uid: currentUser.uid,
                email: currentUser.email!,
                name: 'Administrator',
                role: 'admin',
                updatedAt: serverTimestamp()
             };
             await setDoc(profileRef, adminProfile, { merge: true });
             setUserProfile(adminProfile);
             setSurveyorName('Administrator');
             setView('admin-dashboard');
          } else if (profileDoc.exists()) {
            const data = profileDoc.data() as UserProfile;
            setUserProfile(data);
            setSurveyorName(data.name);
            setView('welcome');
          } else {
            const tempProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email!,
              name: '',
              role: 'supervisor',
              updatedAt: serverTimestamp()
            };
            setUserProfile(tempProfile);
            setView('setup');
          }
        } catch (e) {
          console.error("Profile initialization error:", e);
          setView('login');
        }
      } else {
        setUser(null);
        resetState();
        setView('login');
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const resetState = () => {
    setUserProfile(null);
    setSurveyorName('');
    setClient({ name: '', address: '' });
    setServices([]);
    setProjects([]);
    setAssignedProjects([]);
    setAllProjects([]);
    setAllSupervisors([]);
    setAdminSyncError(null);
    setCurrentProjectId(null);
    setIsDirty(false);
  };

  // Sync Projects (Supervisor History)
  useEffect(() => {
    if (!user || !userProfile || userProfile.role !== 'supervisor') return;
    
    const q = query(
      collection(db, 'projects'), 
      where('surveyorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Project[];
      setProjects(projs);
    }, (err) => console.error("History sync error:", err));
    
    return unsub;
  }, [user, userProfile]);

  // Sync Assigned Projects (Supervisor)
  useEffect(() => {
    if (!user || !userProfile || userProfile.role !== 'supervisor') return;

    const q = query(
      collection(db, 'projects'), 
      where('assignedTo', '==', user.uid),
      where('status', '==', 'project'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Project[];
      setAssignedProjects(projs);
    }, (err) => console.error("Active tasks sync error:", err));

    return unsub;
  }, [user, userProfile]);

  // Admin Data Listener Setup (Guarded)
  const setupAdminListeners = useCallback(() => {
    if (!user || !userProfile || userProfile.role !== 'admin') return null;

    setAdminSyncError(null);
    
    // 1. All Projects for Inbox
    const qProjects = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Project[];
      setAllProjects(fetched);
    }, (error) => {
      console.error("Quotation Inbox Sync Error:", error);
      setAdminSyncError("Quotation sync blocked. Check Firestore permissions.");
    });

    // 2. All Supervisors for User List
    const qUsers = query(collection(db, 'profiles'), where('role', '==', 'supervisor'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ ...doc.data() })) as UserProfile[];
      setAllSupervisors(fetched);
    }, (error) => {
      console.error("Supervisor List Sync Error:", error);
      setAdminSyncError("Supervisor list blocked. Check Firestore permissions.");
    });

    return () => {
      unsubProjects();
      unsubUsers();
    };
  }, [user, userProfile]);

  // Sync All Data (Admin ONLY)
  useEffect(() => {
    const cleanup = setupAdminListeners();
    return () => { if(cleanup) cleanup(); };
  }, [setupAdminListeners]);

  const toggleExpand = (id: string) => {
    setExpandedServices(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBackNavigation = (target: PageView) => {
    if (isDirty && (view === 'dashboard' || view === 'measure')) {
      if (confirm("Unsaved changes will be lost. Leave anyway?")) {
        setView(target);
        setIsDirty(false);
      }
    } else {
      setView(target);
    }
  };

  const performSave = async (updateExisting: boolean) => {
    if (!user) return;
    const projectData = {
      date: new Date().toLocaleString(),
      client,
      services,
      terms,
      surveyorId: user.uid,
      surveyorName: surveyorName || user.email?.split('@')[0] || 'Unknown',
      status: currentProjectStatus || 'quotation',
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
      alert("Successfully synced to cloud.");
    } catch (e: any) {
      alert("Cloud error: " + e.message);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !surveyorName) return;
    try {
      const role = user.email === ADMIN_EMAIL ? 'admin' : 'supervisor';
      const profileData: UserProfile = {
        uid: user.uid,
        name: surveyorName,
        email: user.email!,
        role: role,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'profiles', user.uid), profileData);
      setUserProfile(profileData);
      setView(role === 'admin' ? 'admin-dashboard' : 'welcome');
    } catch (e: any) { alert(e.message); }
  };

  const loadProject = (p: Project) => {
    setClient(p.client);
    setServices(p.services);
    setTerms(p.terms || DEFAULT_TERMS);
    setCurrentProjectId(p.id);
    setCurrentProjectStatus(p.status || 'quotation');
    setIsDirty(false);
    setView('dashboard');
  };

  const handleSignOut = async () => {
    if (confirm("Sign out of Surveyor Pro?")) {
      await signOut(auth);
    }
  };

  const handleAddService = (catId: string, typeId: string, customName?: string, customDesc?: string) => {
    if (currentProjectStatus === 'project') return alert("Project is locked.");
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
    if (currentProjectStatus === 'project') return alert("Project is locked.");
    if (!confirm("Delete this section?")) return;
    const newServices = [...services];
    newServices[sIdx].items.splice(iIdx, 1);
    setServices(newServices);
    setIsDirty(true);
  };

  const handleSaveMeasurement = (item: MeasurementItem) => {
    if (currentProjectStatus === 'project') return alert("Project is locked.");
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

  const handleAdminAssign = async (projId: string, supId: string) => {
    try {
      await updateDoc(doc(db, 'projects', projId), {
        assignedTo: supId,
        status: 'project',
        updatedAt: serverTimestamp()
      });
      alert("Project converted and assigned successfully.");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleDownloadCSV = () => {
    if (!currentProjectId) {
      alert("Please save the project to the cloud before downloading CSV.");
      return;
    }
    const content = generateCSV({
      id: currentProjectId,
      date: new Date().toLocaleDateString(),
      client,
      services,
      terms,
      surveyorId: user?.uid || '',
      status: currentProjectStatus,
      createdAt: null
    });
    downloadCSV(content, `Quote_${client.name.replace(/\s+/g, '_')}.csv`);
  };

  if (authLoading) return (
    <div className="min-h-screen bg-appBg flex items-center justify-center">
      <Loader2 className="animate-spin text-brand-gold" size={48} />
    </div>
  );

  if (view === 'login') return <AuthView onComplete={() => {}} />;
  if (view === 'quote') return <QuoteView client={client} services={services} terms={terms} onBack={() => setView('dashboard')} onDownloadCSV={handleDownloadCSV} />;
  if (view === 'measurement-sheet') return <MeasurementSheetView client={client} services={services} onBack={() => setView('dashboard')} />;

  if (view === 'admin-dashboard') {
    return (
      <AdminDashboard 
        projects={allProjects} 
        supervisors={allSupervisors} 
        syncError={adminSyncError}
        onSignOut={handleSignOut} 
        onAssign={handleAdminAssign}
        onRetrySync={() => setupAdminListeners()}
        onReview={(p) => { loadProject(p); setView('dashboard'); }}
      />
    );
  }

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
            <button type="button" onClick={handleSignOut} className="p-2.5 text-slate-400 hover:text-brand-red bg-slate-50 rounded-xl transition-all border border-cardBorder shadow-sm active:scale-95">
              <LogOut size={18} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar bg-appBg">
          {view === 'setup' && (
            <div className="flex flex-col items-center justify-center min-h-full p-8 bg-brand-charcoal text-white text-center">
              <img src={LOGO_URL} alt="Renowix" className="h-32 mb-8 object-contain" />
              <h2 className="text-3xl font-display font-black mb-2">Setup Profile</h2>
              <input type="text" className="w-full max-w-xs h-14 p-4 text-center bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-brand-gold" placeholder="Your Name" value={surveyorName} onChange={e => setSurveyorName(e.target.value)} />
              <button type="button" onClick={handleUpdateProfile} className="mt-4 w-full max-w-xs bg-brand-gold text-brand-charcoal py-4 rounded-2xl font-black text-lg">Create Profile</button>
            </div>
          )}

          {view === 'welcome' && (
            <div className="p-6">
              <h2 className="text-2xl font-display font-black text-brand-charcoal mb-8">Hello, <span className="text-brand-gold">{surveyorName || user?.email?.split('@')[0]}</span></h2>
              <div className="space-y-4">
                <button type="button" onClick={() => { setClient({name: '', address: ''}); setServices([]); setCurrentProjectId(null); setCurrentProjectStatus('quotation'); setView('client-details'); }} className="w-full bg-brand-charcoal text-white p-6 rounded-3xl shadow-xl flex items-center justify-between transition-all active:scale-[0.98]">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 p-4 rounded-2xl text-brand-gold"><Plus size={28} /></div>
                    <div className="text-left"><h3 className="font-black text-xl">New Quote</h3><p className="text-xs text-slate-400 uppercase font-bold tracking-widest mt-1">Start Survey</p></div>
                  </div>
                  <ChevronRight className="text-brand-gold" />
                </button>
                
                <button type="button" onClick={() => setView('active-projects')} className="w-full bg-brand-gold text-brand-charcoal p-6 rounded-3xl shadow-xl flex items-center justify-between transition-all active:scale-[0.98]">
                  <div className="flex items-center gap-4">
                    <div className="bg-brand-charcoal/10 p-4 rounded-2xl text-brand-charcoal"><CheckCircle size={28} /></div>
                    <div className="text-left"><h3 className="font-black text-xl">Current Projects</h3><p className="text-xs text-brand-charcoal/60 uppercase font-bold tracking-widest mt-1">Assigned Tasks</p></div>
                  </div>
                  <ChevronRight className="text-brand-charcoal" />
                </button>

                <button type="button" onClick={() => setView('history')} className="w-full bg-white border border-cardBorder p-6 rounded-3xl flex items-center justify-between shadow-prof active:scale-[0.98]">
                   <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-4 rounded-2xl text-slate-600"><History size={28} /></div>
                    <div className="text-left"><h3 className="font-black text-brand-charcoal text-lg">Quotation History</h3><p className="text-xs text-slate-400 uppercase font-bold tracking-widest mt-1">My Records</p></div>
                  </div>
                  <ChevronRight className="text-slate-300" />
                </button>
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="p-6 pb-24">
              <Header title="My Quotes" onBack={() => setView('welcome')} />
              <div className="mt-6 space-y-4">
                {projects.length === 0 && <p className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest">No quotations found</p>}
                {projects.map((p) => (
                  <div key={p.id} onClick={() => loadProject(p)} className="bg-cardBg rounded-xl p-4 shadow-prof border border-cardBorder hover:bg-slate-50 transition-all relative cursor-pointer group">
                    <button type="button" onClick={async (e) => { e.stopPropagation(); if(confirm("Permanently delete?")) await deleteDoc(doc(db, 'projects', p.id)); }} className="absolute top-3 right-3 p-2 text-brand-red"><Trash2 size={16} /></button>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-50 text-brand-blue p-2.5 rounded-lg"><User size={20} /></div>
                      <div><h3 className="font-bold text-lg text-brand-charcoal truncate">{p.client.name}</h3><p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {p.client.address || 'No Address'}</p></div>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black uppercase text-brand-blue bg-blue-50 px-2 py-1 rounded">Quote</span>
                      <div className="p-2 bg-appBg text-slate-400 rounded-lg group-hover:bg-brand-gold group-hover:text-brand-charcoal transition-all"><ArrowUpRight size={16} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'active-projects' && (
            <div className="p-6 pb-24">
              <Header title="Assigned Projects" onBack={() => setView('welcome')} />
              <div className="mt-6 space-y-4">
                {assignedProjects.length === 0 && <p className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest">No active projects</p>}
                {assignedProjects.map((p) => (
                  <div key={p.id} onClick={() => loadProject(p)} className="bg-cardBg rounded-xl p-4 shadow-prof border-2 border-brand-gold/20 hover:border-brand-gold transition-all relative cursor-pointer group">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-brand-gold/10 text-brand-gold p-2.5 rounded-lg"><CheckCircle size={20} /></div>
                      <div><h3 className="font-bold text-lg text-brand-charcoal truncate">{p.client.name}</h3><p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {p.client.address || 'No Address'}</p></div>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black uppercase text-white bg-brand-charcoal px-2 py-1 rounded">Locked Project</span>
                      <div className="p-2 bg-appBg text-slate-400 rounded-lg group-hover:bg-brand-gold group-hover:text-brand-charcoal transition-all"><ArrowUpRight size={16} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'client-details' && (
            <div className="p-6 pb-32">
              <Header title="Project Details" onBack={() => handleBackNavigation('welcome')} />
              <div className="mt-8 space-y-6">
                <div className="bg-cardBg p-6 rounded-xl shadow-prof border border-cardBorder">
                  <InputGroup label="Client Name"><input type="text" value={client.name} onChange={e => setClient({...client, name: e.target.value})} className="w-full h-12 p-4 bg-white border border-inputBorder rounded-xl outline-none font-bold" placeholder="e.g. Sameer" /></InputGroup>
                  <div className="h-6"></div>
                  <InputGroup label="Site Address"><textarea value={client.address} onChange={e => setClient({...client, address: e.target.value})} rows={3} className="w-full p-4 bg-white border border-inputBorder rounded-xl outline-none text-sm font-medium" placeholder="Full Site Address" /></InputGroup>
                </div>
              </div>
              <Footer><button type="button" onClick={() => { if(!client.name) return alert("Enter client name"); setView('dashboard'); }} className="w-full bg-brand-charcoal text-white py-5 rounded-xl font-black text-lg shadow-xl">Start Project Dashboard</button></Footer>
            </div>
          )}

          {view === 'dashboard' && (
            <div className="p-4 sm:p-6 pb-44">
              <div className="sticky top-0 z-[120] -mx-4 sm:-mx-6 mb-8 bg-brand-charcoal shadow-xl px-4 py-2.5 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2.5 overflow-hidden">
                   <div className="bg-brand-gold/10 p-1.5 rounded-lg text-brand-gold"><User size={12} /></div>
                   <div className="overflow-hidden"><h3 className="text-[14px] font-bold text-white leading-none truncate">{client.name || "Unnamed Client"}</h3></div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex items-center bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                      <p className={`text-sm font-black text-brand-gold leading-none ${isEstimateHidden ? 'masked-estimate' : ''}`}>₹{Math.round(services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0)).toLocaleString()}</p>
                   </div>
                   <button type="button" onClick={() => setIsEstimateHidden(!isEstimateHidden)} className="p-1.5 bg-slate-800 rounded-lg text-white/70">
                      {isEstimateHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                   </button>
                </div>
              </div>
              <Header title={currentProjectStatus === 'project' ? "Project Specs" : "Service Items"} onBack={() => handleBackNavigation('welcome')} />
              
              {currentProjectStatus === 'project' && (
                <div className="mb-6 p-4 bg-yellow-50 border border-brand-gold/20 rounded-xl flex items-center gap-3">
                  <Lock className="text-brand-gold shrink-0" size={20} />
                  <p className="text-[11px] font-bold text-slate-600 uppercase">This project is locked by Admin. Changes are not allowed.</p>
                </div>
              )}

              <div className="mt-4 space-y-6">
                {services.map((s, sIdx) => {
                  const isExpanded = expandedServices[s.instanceId];
                  return (
                    <div key={s.instanceId} className="bg-cardBg rounded-xl shadow-prof border border-cardBorder overflow-hidden">
                      <div className="p-4 border-b border-cardBorder flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(s.instanceId)}>
                        <div className="flex items-center gap-3">
                          <ServiceIcon categoryId={s.categoryId} typeId={s.typeId} />
                          <div><h4 className="font-bold text-[15px] text-brand-charcoal leading-tight">{s.name}</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} {s.unit}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-black text-brand-charcoal text-sm ${isEstimateHidden ? 'masked-estimate' : ''}`}>₹{Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}</span>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="divide-y divide-cardBorder bg-slate-50/30">
                          {s.items.map((item, iIdx) => (
                            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-white">
                               <div><p className="font-bold text-slate-700 text-sm">{item.name}</p><p className="text-[10px] text-slate-400">₹{item.rate} / {s.unit}</p></div>
                               <div className="flex items-center gap-2">
                                  <span className={`font-bold text-brand-charcoal text-sm ${isEstimateHidden ? 'masked-estimate' : ''}`}>₹{Math.round(item.cost).toLocaleString()}</span>
                                  {currentProjectStatus === 'quotation' && (
                                    <div className="flex gap-1.5 ml-2">
                                      <button type="button" onClick={() => { setTempService(s); setEditingItemIndex({ sIdx, iIdx }); setView('measure'); }} className="p-1.5 text-brand-blue bg-white border border-cardBorder rounded-lg"><Edit2 size={12} /></button>
                                      <button type="button" onClick={() => deleteItem(sIdx, iIdx)} className="p-1.5 text-brand-red bg-white border border-cardBorder rounded-lg"><Trash2 size={12} /></button>
                                    </div>
                                  )}
                               </div>
                            </div>
                          ))}
                          {currentProjectStatus === 'quotation' && (
                            <button type="button" onClick={() => { setTempService(s); setEditingItemIndex(null); setView('measure'); }} className="w-full py-3 text-[10px] font-black text-brand-gold uppercase tracking-widest">+ Add Section</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {currentProjectStatus === 'quotation' && (
                  <button type="button" onClick={() => setView('service-select')} className="w-full h-10 border border-cardBorder bg-white text-slate-400 rounded-xl font-bold flex items-center justify-center gap-2 shadow-prof uppercase text-[10px] tracking-widest"><PlusCircle size={14} /> Add Category</button>
                )}
              </div>
              <Footer>
                <div className="flex gap-2 w-full h-14">
                   <button type="button" onClick={() => setView('measurement-sheet')} className="flex-1 bg-white border border-cardBorder text-slate-800 rounded-xl flex flex-col items-center justify-center gap-1 shadow-sm"><RulerIcon size={18} /><span className="text-[9px] font-black uppercase">Sheet</span></button>
                   {currentProjectStatus === 'quotation' && (
                     <button type="button" onClick={() => currentProjectId ? setSaveModal({ show: true }) : performSave(false)} className="flex-1 bg-white border border-cardBorder text-slate-800 rounded-xl flex flex-col items-center justify-center gap-1 shadow-sm"><Save size={18} /><span className="text-[9px] font-black uppercase">Sync</span></button>
                   )}
                   <button type="button" onClick={() => services.length > 0 ? setView('quote') : alert("No data.")} className="flex-[2.5] bg-brand-charcoal text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg"><CheckCircle size={18} className="text-brand-gold" /><span className="text-sm">View {currentProjectStatus === 'project' ? 'Project' : 'Quote'}</span></button>
                </div>
              </Footer>
            </div>
          )}

          {view === 'service-select' && <ServiceSelector onBack={() => setView('dashboard')} onSelect={handleAddService} />}
          {view === 'measure' && tempService && (
            <MeasurementForm serviceContext={tempService} editingItem={editingItemIndex !== null && tempService.items ? tempService.items[editingItemIndex.iIdx] : undefined} onBack={() => setView('dashboard')} onSave={handleSaveMeasurement} />
          )}
        </div>
      </div>

      {saveModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-charcoal/60 backdrop-blur-sm">
          <div className="w-full max-sm bg-cardBg rounded-xl p-6 shadow-2xl border border-cardBorder">
            <h3 className="text-lg font-black text-brand-charcoal mb-4">Cloud Sync</h3>
            <p className="text-sm text-slate-500 mb-6">Update the existing file or create a duplicate copy?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => performSave(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] uppercase">New Copy</button>
              <button type="button" onClick={() => performSave(true)} className="flex-1 py-3 bg-brand-charcoal text-white rounded-xl font-bold text-[11px] uppercase">Update Cloud</button>
            </div>
            <button type="button" onClick={() => setSaveModal({ show: false })} className="w-full mt-2 py-2 text-xs font-bold text-slate-400 underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ADMIN DASHBOARD COMPONENT
function AdminDashboard({ projects, supervisors, syncError, onSignOut, onAssign, onReview, onRetrySync }: { projects: Project[], supervisors: UserProfile[], syncError: string|null, onSignOut: () => void, onAssign: (pid: string, sid: string) => void, onReview: (p: Project) => void, onRetrySync: () => void }) {
  const [activeTab, setActiveTab] = useState<'quotes' | 'supervisors'>('quotes');
  const [assignModal, setAssignModal] = useState<Project | null>(null);

  const pendingQuotes = projects.filter(p => p.status === 'quotation' || !p.status);
  const activeProjects = projects.filter(p => p.status === 'project');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <nav className="bg-brand-charcoal text-white px-8 py-4 flex justify-between items-center shadow-xl sticky top-0 z-[200]">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} className="h-10" alt="Renowix" />
          <div className="h-6 w-px bg-white/20 mx-2"></div>
          <span className="font-display font-black text-xl tracking-tight uppercase">Admin Console</span>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={onRetrySync} title="Refresh Sync" className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 text-brand-gold">
              <RefreshCw size={20} />
           </button>
           <button onClick={onSignOut} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-white/10">
            <LogOut size={16} className="text-brand-gold" /> Sign Out
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-8">
        {syncError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-brand-red">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} />
              <p className="font-bold text-sm">{syncError}</p>
            </div>
            <button onClick={onRetrySync} className="text-xs font-black uppercase tracking-widest bg-brand-red text-white px-4 py-2 rounded-xl shadow-sm">Retry Connection</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard icon={<FileText />} label="Inbox Quotations" value={pendingQuotes.length} color="bg-blue-500" />
          <StatCard icon={<CheckCircle />} label="Active Projects" value={activeProjects.length} color="bg-brand-gold" />
          <StatCard icon={<Users />} label="Registered Supervisors" value={supervisors.length} color="bg-slate-700" />
        </div>

        <div className="flex gap-4 mb-8">
          <button onClick={() => setActiveTab('quotes')} className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'quotes' ? 'bg-brand-charcoal text-white shadow-lg' : 'bg-white text-slate-400 hover:text-slate-600'}`}>
            <LayoutDashboard size={18} /> Quotation Inbox
          </button>
          <button onClick={() => setActiveTab('supervisors')} className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'supervisors' ? 'bg-brand-charcoal text-white shadow-lg' : 'bg-white text-slate-400 hover:text-slate-600'}`}>
            <Users size={18} /> Supervisor List
          </button>
        </div>

        {activeTab === 'quotes' ? (
          <div className="bg-white rounded-3xl shadow-prof border border-slate-200 overflow-hidden min-h-[400px]">
            {projects.length === 0 ? (
                <div className="py-24 flex flex-col items-center text-slate-300">
                    <PackageSearch size={64} className="mb-4 opacity-20" />
                    <p className="font-black uppercase tracking-[0.2em] text-sm">No quotations found in cloud</p>
                    <p className="text-[10px] mt-2 font-bold text-slate-400 uppercase">Wait for sync or click Refresh</p>
                </div>
            ) : (
                <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 font-black text-[11px] uppercase text-slate-400 tracking-widest">Client & Date</th>
                    <th className="px-6 py-4 font-black text-[11px] uppercase text-slate-400 tracking-widest">Surveyor</th>
                    <th className="px-6 py-4 font-black text-[11px] uppercase text-slate-400 tracking-widest">Total Value</th>
                    <th className="px-6 py-4 font-black text-[11px] uppercase text-slate-400 tracking-widest">Status</th>
                    <th className="px-6 py-4 font-black text-[11px] uppercase text-slate-400 tracking-widest text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                        <p className="font-bold text-slate-800">{p.client.name}</p>
                        <p className="text-xs text-slate-400">{p.date.split(',')[0]}</p>
                        </td>
                        <td className="px-6 py-5">
                        <p className="text-sm font-medium text-slate-600">{p.surveyorName || 'Unknown Surveyor'}</p>
                        </td>
                        <td className="px-6 py-5 font-black text-brand-charcoal">
                        ₹{Math.round(p.services.reduce((s, ser) => s + ser.items.reduce((is, i) => is + i.cost, 0), 0)).toLocaleString()}
                        </td>
                        <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${p.status === 'project' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {p.status || 'Quotation'}
                        </span>
                        </td>
                        <td className="px-6 py-5 text-right flex items-center justify-end gap-3">
                        <button onClick={() => onReview(p)} className="p-2 text-slate-400 hover:text-brand-blue transition-colors" title="Review Details"><Eye size={20} /></button>
                        {p.status !== 'project' && (
                            <button onClick={() => setAssignModal(p)} className="bg-brand-charcoal text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm">Convert & Assign</button>
                        )}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {supervisors.length === 0 ? (
                <div className="col-span-full py-24 flex flex-col items-center text-slate-300">
                    <Users size={64} className="mb-4 opacity-20" />
                    <p className="font-black uppercase tracking-[0.2em] text-sm">No registered supervisors yet</p>
                </div>
            ) : supervisors.map((s) => (
              <div key={s.uid} className="bg-white p-6 rounded-3xl shadow-prof border border-slate-200">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-xl">
                    {(s.name || s.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-brand-charcoal leading-none">{s.name || "Pending Setup"}</h3>
                    <p className="text-sm text-slate-400 mt-1">{s.email}</p>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Projects</p>
                    <p className="text-xl font-black text-brand-gold">{projects.filter(p => p.assignedTo === s.uid).length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quotes Built</p>
                    <p className="text-xl font-black text-brand-charcoal">{projects.filter(p => p.surveyorId === s.uid).length}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-[300] bg-brand-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-2xl font-display font-black text-brand-charcoal mb-2">Convert to Project</h3>
            <p className="text-slate-500 text-sm mb-6">Assign <span className="font-bold text-slate-800">{assignModal.client.name}</span> to a supervisor.</p>
            
            <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar mb-8">
              {supervisors.length === 0 ? (
                  <p className="text-center py-4 text-xs font-bold text-brand-red">No active supervisors to assign</p>
              ) : supervisors.map(s => (
                <button key={s.uid} onClick={() => { onAssign(assignModal.id, s.uid); setAssignModal(null); }} className="w-full p-4 flex items-center gap-4 bg-slate-50 hover:bg-brand-gold/10 border border-slate-100 rounded-2xl transition-all text-left group">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 font-bold group-hover:text-brand-gold shadow-sm">{(s.name || s.email).charAt(0).toUpperCase()}</div>
                  <div><p className="font-bold text-slate-800 leading-none">{s.name || s.email}</p><p className="text-[10px] text-slate-400 uppercase font-black mt-1">{s.email}</p></div>
                </button>
              ))}
            </div>

            <button onClick={() => setAssignModal(null)} className="w-full py-4 text-xs font-black text-slate-400 uppercase tracking-widest underline">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: number, color: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-prof border border-slate-200 flex items-center gap-6">
      <div className={`w-14 h-14 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg shadow-${color}/20`}>
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-black text-brand-charcoal leading-none mt-1">{value}</p>
      </div>
    </div>
  );
}

// Subcomponents
function AuthView({ onComplete }: { onComplete: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
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
      let msg = err.message.replace('Firebase: ', '');
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) msg = "Invalid password. Please check and try again.";
      if (msg.includes('auth/user-not-found')) msg = "Email not found. If you are a supervisor, click Register.";
      setError(msg); 
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isAdminMode) {
      setEmail(ADMIN_EMAIL);
      setIsLogin(true); // Always login for Admin
    } else {
      setEmail('');
    }
  }, [isAdminMode]);

  return (
    <div className="min-h-screen bg-brand-charcoal flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Renowix" className="h-16 mx-auto mb-4 object-contain" />
          <h2 className="text-2xl font-display font-black text-brand-charcoal">
            {isAdminMode ? 'Admin Access' : (isLogin ? 'Supervisor Login' : 'Supervisor Signup')}
          </h2>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-brand-red rounded-xl text-xs font-bold border border-red-100 leading-relaxed">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle size={14} /> SYSTEM ERROR</div>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            {isAdminMode ? (
              <div className="w-full h-14 pl-12 pr-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center text-slate-500 font-bold">{ADMIN_EMAIL}</div>
            ) : (
              <input type="email" required className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold transition-colors" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="password" required className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold transition-colors" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          
          <button type="submit" disabled={loading} className="w-full h-14 bg-brand-charcoal text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}
            {isLogin ? 'Sign In' : 'Register Now'}
          </button>
        </form>

        <div className="mt-8 flex flex-col gap-3 items-center">
          {!isAdminMode && (
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-xs font-black text-brand-gold uppercase tracking-widest hover:text-yellow-600 transition-colors">
                {isLogin ? "Supervisor Signup" : "Back to Login"}
              </button>
          )}
          
          <div className="h-px w-1/2 bg-slate-100 my-1"></div>
          
          <button type="button" onClick={() => { setIsAdminMode(!isAdminMode); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest underline decoration-2 underline-offset-4 hover:text-brand-charcoal transition-colors">
            {isAdminMode ? "Switch to Supervisor Mode" : "Admin Console Access"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiceIcon({ categoryId, typeId }: { categoryId: string, typeId: string }) {
  const Icon = categoryId === 'painting' ? PaintRoller : (typeId === 'kitchen_mod' ? Utensils : (typeId === 'tv_unit' ? Monitor : Hammer));
  return (<div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700 border border-cardBorder shadow-sm"><Icon size={18} /></div>);
}

function Header({ title, onBack }: { title: string, onBack: () => void }) {
  return (
    <div className="flex items-center gap-4 py-1 mb-3">
      <button type="button" onClick={onBack} className="p-2.5 text-slate-400 bg-white shadow-prof border border-cardBorder rounded-lg"><ArrowLeft size={18} /></button>
      <h1 className="font-display font-black text-[18px] text-brand-charcoal uppercase truncate">{title}</h1>
    </div>
  );
}

function Footer({ children }: { children?: React.ReactNode }) {
  return (<div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 backdrop-blur-md p-4 border-t border-cardBorder z-[100] safe-bottom shadow-2xl">{children}</div>);
}

function InputGroup({ label, children }: { label: string, children?: React.ReactNode }) {
  return (<div className="space-y-1.5"><label className="text-[14px] font-bold text-slate-400 uppercase tracking-widest ml-1">{label}</label>{children}</div>);
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
        contents: `Restructure this into a professional 3-line description: "${description}"`,
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
             <div className="mt-6"><InputGroup label="Service Name"><input type="text" className="w-full h-12 px-4 border rounded-xl font-bold" value={customName} onChange={e => setCustomName(e.target.value)} /></InputGroup></div>
          )}
        </div>
        {cat && type && (
          <div className="bg-yellow-50/30 p-5 rounded-xl border border-dashed border-brand-gold/30">
            <InputGroup label="Description">
              <textarea rows={5} className="w-full p-4 bg-white border border-inputBorder rounded-xl outline-none text-xs leading-relaxed" value={description} onChange={e => setDescription(e.target.value)} />
              <button type="button" onClick={handleAiRewrite} disabled={isAiLoading} className="mt-3 w-full h-12 bg-brand-charcoal text-white rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-sm">
                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} AI Optimize
              </button>
            </InputGroup>
          </div>
        )}
      </div>
      <Footer><button type="button" onClick={() => onSelect(cat, type, customName, description)} disabled={!cat || !type} className="w-full h-14 bg-brand-charcoal text-white rounded-xl font-black shadow-xl">Proceed to Measures</button></Footer>
    </div>
  );
}

function MeasurementForm({ serviceContext, editingItem, onBack, onSave }: { serviceContext: Partial<ActiveService>, editingItem?: MeasurementItem, onBack: () => void, onSave: (item: MeasurementItem) => void }) {
  const [name, setName] = useState(editingItem?.name || '');
  const [rate, setRate] = useState<number>(editingItem?.rate || serviceContext.rate || 0);
  const [walls, setWalls] = useState<Wall[]>(editingItem?.walls || []);
  const [cabinetSections, setCabinetSections] = useState<CabinetSection[]>(editingItem?.cabinetSections || []);
  const [height, setHeight] = useState<number>(editingItem?.height || 9);

  const isWoodwork = serviceContext.categoryId === 'woodwork' || serviceContext.isCustom || serviceContext.isKitchen;

  useEffect(() => { 
    if (!editingItem) {
      if (serviceContext.categoryId === 'painting' && walls.length === 0) setWalls([1,2,3,4].map(id => ({id: id.toString(), width: 0})));
      if (isWoodwork && cabinetSections.length === 0) setCabinetSections([{ id: Date.now().toString(), name: 'Section 1', l: 0, b: 0, q: 1 }]);
    }
  }, []);

  const calculateTotal = (): number => {
    if (isWoodwork) return cabinetSections.reduce((acc, s) => acc + ((s.l || 0) * (s.b || 0) * (s.q || 1)), 0);
    if (serviceContext.categoryId === 'painting') return (walls.reduce((s, w) => s + (w.width || 0), 0) * height);
    return 1;
  };

  const netArea = calculateTotal();
  const cost = netArea * rate;

  return (
    <div className="flex flex-col min-h-full relative bg-appBg">
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto no-scrollbar">
        <Header title={serviceContext.name || "Measurement"} onBack={onBack} />
        <div className="space-y-6 pb-64">
          <div className="bg-cardBg p-3 rounded-xl border border-cardBorder shadow-prof space-y-4">
             <InputGroup label="ROOM LABEL"><input className="w-full h-10 px-3 border border-inputBorder rounded-lg font-bold" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Master Bedroom" /></InputGroup>
             <div className="grid grid-cols-2 gap-4">
                <InputGroup label="RATE (₹)"><input type="number" className="w-full h-10 px-3 border border-inputBorder rounded-lg font-black" value={rate || ''} onChange={e => setRate(parseFloat(e.target.value) || 0)} /></InputGroup>
                {serviceContext.categoryId === 'painting' && <InputGroup label="HEIGHT (FT)"><input type="number" className="w-full h-10 px-3 border border-inputBorder rounded-lg" value={height} onChange={e => setHeight(parseFloat(e.target.value) || 0)}/></InputGroup>}
             </div>
          </div>
          {isWoodwork ? (
            <div className="space-y-3">
              {cabinetSections.map((s, idx) => (
                <div key={s.id} className="bg-cardBg p-3 rounded-xl border border-cardBorder shadow-prof">
                  <div className="flex justify-between items-center mb-2 font-black text-xs uppercase">{s.name}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" className="w-full h-9 border rounded-lg text-center" placeholder="L" value={s.l || ''} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, l: parseFloat(e.target.value) || 0} : sec))} />
                    <input type="number" className="w-full h-9 border rounded-lg text-center" placeholder="B" value={s.b || ''} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, b: parseFloat(e.target.value) || 0} : sec))} />
                    <input type="number" className="w-full h-9 border rounded-lg text-center text-brand-gold" placeholder="Q" value={s.q || ''} onChange={e => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, q: parseFloat(e.target.value) || 0} : sec))} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setCabinetSections([...cabinetSections, { id: Date.now().toString(), name: `Section ${cabinetSections.length + 1}`, l: 0, b: 0, q: 1 }])} className="w-full h-10 border border-dashed rounded-lg text-[10px] font-black uppercase tracking-widest">+ Add Section</button>
            </div>
          ) : (
            <div className="space-y-6">
               <div className="bg-cardBg p-3 rounded-xl shadow-prof border border-cardBorder">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">WALL WIDTHS</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {walls.map((w, idx) => (
                    <div key={w.id} className="relative h-10">
                      <input type="number" className="w-full h-full px-3 pl-10 border border-inputBorder rounded-lg text-center bg-white font-bold" value={w.width || ''} placeholder="0" onChange={e => { const nw = [...walls]; nw[idx].width = parseFloat(e.target.value) || 0; setWalls(nw); }} />
                      <div className="absolute top-1/2 left-3 -translate-y-1/2 text-[10px] font-bold text-slate-400">W{idx+1}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-[110] w-full flex justify-center p-4 safe-bottom">
        <div className="w-full max-w-xl flex flex-col gap-2">
          <div className="flex justify-between items-center bg-brand-charcoal text-white py-4 px-6 rounded-2xl shadow-xl">
            <div><p className="text-[9px] opacity-50 uppercase tracking-widest">QUANTITY</p><p className="font-extrabold text-brand-gold">{netArea.toFixed(2)} {serviceContext.unit}</p></div>
            <div className="text-right"><p className="text-[9px] opacity-50 uppercase tracking-widest">SUBTOTAL</p><p className="font-extrabold text-brand-gold">₹{Math.round(cost).toLocaleString()}</p></div>
          </div>
          <button type="button" onClick={() => onSave({ id: editingItem?.id || Date.now().toString(), name: name || "Item", netArea, rate, cost, height, walls, cabinetSections })} className="w-full h-14 bg-brand-charcoal text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"><CheckCircle size={18} className="text-brand-gold" /> Save Measurement</button>
        </div>
      </div>
    </div>
  );
}

function QuoteView({ client, services, terms, onBack, onDownloadCSV }: { client: ClientDetails, services: ActiveService[], terms: string, onBack: () => void, onDownloadCSV: () => void }) {
  const subTotal = services.reduce((s, ser) => s + ser.items.reduce((is, i) => is + i.cost, 0), 0);
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  
  return (
    <div className="bg-white min-h-screen flex flex-col items-center overflow-y-auto no-scrollbar">
      <div className="w-full max-w-[210mm] mt-6 mb-4 flex justify-between no-print px-4">
        <button type="button" onClick={onBack} className="bg-white px-5 py-3 rounded-xl border border-cardBorder text-xs font-black uppercase flex items-center gap-2 shadow-sm"><ArrowLeft size={16} /> Back</button>
        <div className="flex gap-2">
           <button type="button" onClick={onDownloadCSV} className="bg-white px-5 py-3 rounded-xl border border-cardBorder text-xs font-black uppercase flex items-center gap-2 shadow-sm"><Download size={16} /> CSV</button>
           <button type="button" onClick={() => window.print()} className="bg-brand-charcoal text-white px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-xl active:scale-95"><Printer size={16} /> Print Quote</button>
        </div>
      </div>
      <div id="quotation-print-area" className="w-full max-w-[210mm] bg-white px-10 py-10 print:p-0 text-slate-900 border shadow-prof mt-6 quote-container flex flex-col">
        <div className="flex justify-between items-center border-b-4 border-brand-charcoal pb-4 mb-6">
          <div className="flex items-center gap-4"><img src={LOGO_URL} className="h-16" /><div><h1 className="text-2xl font-black uppercase tracking-tight">Renowix</h1><p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Professional Renovations</p></div></div>
          <div className="text-right"><h2 className="text-3xl font-black text-slate-200 uppercase tracking-widest">Estimate</h2></div>
        </div>
        <div className="grid grid-cols-2 gap-8 mb-10">
           <div className="bg-slate-50 p-6 border"><h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">CLIENT PROFILE</h4><p className="text-2xl font-black">{client.name}</p><p className="text-sm italic text-slate-500 leading-relaxed">{client.address}</p></div>
           <div className="bg-slate-50 p-6 border"><h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">DETAILS</h4><div className="flex justify-between mb-1"><span className="text-xs font-bold text-slate-400 uppercase">DATE</span><span className="text-xs font-black">{dateStr}</span></div><div className="flex justify-between"><span className="text-xs font-bold text-slate-400 uppercase">REF</span><span className="text-xs font-black">#RX-{Math.floor(Date.now()/10000).toString().slice(-6)}</span></div></div>
        </div>
        <table className="w-full border-collapse">
          <thead><tr className="bg-brand-charcoal text-white"><th className="py-4 px-6 text-left text-[11px] uppercase font-black">Scope of Work</th><th className="py-4 px-4 text-right text-[11px] uppercase font-black">Qty</th><th className="py-4 px-6 text-right text-[11px] uppercase font-black">Amount (₹)</th></tr></thead>
          <tbody>{services.map((s, idx) => (<tr key={idx} className="border"><td className="py-5 px-6"><h3 className="font-black text-lg mb-1">{s.name}</h3><p className="text-[10px] text-slate-500 font-medium leading-relaxed">{s.desc}</p></td><td className="py-5 px-4 text-right font-bold">{s.items.reduce((a, b) => a + b.netArea, 0).toFixed(2)} {s.unit}</td><td className="py-5 px-6 text-right font-black">₹{Math.round(s.items.reduce((a, b) => a + b.cost, 0)).toLocaleString()}</td></tr>))}</tbody>
        </table>
        <div className="mt-10 flex flex-col items-end">
           <div className="bg-brand-charcoal text-white p-6 rounded-2xl w-full max-sm flex justify-between items-center shadow-xl"><span className="font-black text-brand-gold uppercase tracking-widest text-xs">Grand Total</span><span className="text-3xl font-black">₹{Math.round(subTotal).toLocaleString()}</span></div>
        </div>
        <div className="mt-10 pt-10 border-t-2 border-slate-100 flex justify-between items-end pb-10">
           <div className="w-56 text-center border-t border-slate-300 pt-2 text-[10px] font-black uppercase text-slate-400">Authorized Signature</div>
           <div className="w-56 text-center border-t border-slate-300 pt-2 text-[10px] font-black uppercase text-slate-400">Client Signature</div>
        </div>
      </div>
    </div>
  );
}

function MeasurementSheetView({ client, services, onBack }: { client: ClientDetails, services: ActiveService[], onBack: () => void }) {
  return (
    <div className="bg-slate-100 min-h-screen flex flex-col items-center overflow-y-auto no-scrollbar">
      <div className="w-full max-w-[210mm] mt-6 mb-4 flex justify-between no-print px-4">
        <button type="button" onClick={onBack} className="bg-white px-5 py-3 rounded-xl border border-cardBorder text-xs font-black uppercase flex items-center gap-2 shadow-sm"><ArrowLeft size={16} /> Back</button>
        <button type="button" onClick={() => window.print()} className="bg-brand-charcoal text-white px-6 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-xl"><Printer size={16} /> Print Sheet</button>
      </div>
      <div className="w-full max-w-[210mm] bg-white p-10 print:p-0 shadow-prof mt-6 quote-container">
        <div className="flex justify-between items-center border-b-2 mb-8 pb-4">
           <div><h1 className="text-3xl font-black uppercase tracking-tighter">Audit Report</h1><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{client.name}</p></div>
           <img src={LOGO_URL} className="h-12" />
        </div>
        {services.map(s => (
          <div key={s.instanceId} className="mb-8 break-inside-avoid">
            <h2 className="bg-slate-100 p-2 font-black mb-4 uppercase text-xs border-l-4 border-brand-gold">{s.name}</h2>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="border-b"><th className="text-left py-2">Room / Section</th><th className="text-right py-2">Calculation (L x B x Q)</th><th className="text-right py-2">Net Area</th></tr></thead>
              <tbody>{s.items.map(i => (<tr key={i.id} className="border-b"><td className="py-2 font-bold uppercase text-[11px]">{i.name}</td><td className="py-2 text-right opacity-50 text-[10px]">{i.cabinetSections?.map(c => `(${c.l}x${c.b})x${c.q}`).join(' + ')}</td><td className="py-2 text-right font-black">{i.netArea.toFixed(2)}</td></tr>))}</tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}


