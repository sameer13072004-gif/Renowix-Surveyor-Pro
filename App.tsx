import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  ArrowLeft, Plus, Trash2, Edit2, Save, History, Printer, CheckCircle,
  ChevronRight, User, MapPin, PaintRoller, Utensils,
  Monitor, Sparkles, Loader2, 
  AlertTriangle, PlusCircle, LogOut, Eye,
  EyeOff, ChevronDown, ChevronUp, ArrowUpRight,
  LogIn, Mail, Lock, Camera, Smartphone, RotateCcw, X, Clock,
  FileText, RefreshCw, LayoutDashboard, Users, Hammer, Beaker
} from 'lucide-react';

import { 
  ActiveService, ClientDetails, MeasurementItem, PageView, Project, 
  Wall, CeilingSection, CabinetSection, Deduction, UserProfile, Milestone, DailyAttendance 
} from './types';
import { SERVICE_DATA, DEFAULT_TERMS } from './constants';
import { auth, db } from './firebase';
// Add missing CSV helper imports
import { generateCSV, downloadCSV } from './csvHelper';

import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  User as FirebaseUser
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

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
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// ==================================================================================
// SECTION: UI CONSTANTS & CONFIGURATION
// Change brand assets, colors, and global heights in this section.
// ==================================================================================

// STYLING TWEAK: Brand Identity
const LOGO_URL = "https://renowix.in/wp-content/uploads/2025/12/Picsart_25-12-04_19-18-42-905-scaled.png";
const ADMIN_EMAIL = "info@renowix.in";

// STYLING TWEAK: Dashboard Card Config
const DASHBOARD_CONFIG = {
  CLIENT_CARD_HEIGHT: "h-24", // Change to h-20 for shorter, h-32 for taller
  ESTIMATE_BLUR: "blur-md",    // Intensity of the price masking
};

// LOGIC TWEAK: Application Mode
const TEST_MODE = false; // Set to true to bypass real login during development

// ==================================================================================
// SECTION: UTILITY FUNCTIONS
// Technical helper functions for images and data.
// ==================================================================================

// COMPRESSION: Shrinks photos taken by camera before uploading to cloud
async function compressImage(base64Str: string, maxWidth = 1000, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
}

// ==================================================================================
// SECTION: SHARED UI COMPONENTS
// Common buttons, headers, and inputs used on multiple screens.
// ==================================================================================

// COMPONENT: SITE CAMERA
function RealTimeCamera({ 
  onCapture, 
  onClose, 
  mode = 'environment' 
 }: { 
  onCapture: (base64: string) => void, 
  onClose: () => void,
  mode?: 'user' | 'environment'
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(mode);

  const startCamera = async () => {
    setLoading(true);
    if (stream) { stream.getTracks().forEach(track => track.stop()); }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) { videoRef.current.srcObject = newStream; }
      setLoading(false);
    } catch (err) {
      alert("Camera access denied.");
      onClose();
    }
  };

  useEffect(() => {
    startCamera();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [facingMode]);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        onCapture(canvas.toDataURL('image/jpeg', 0.8));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-lg aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute top-6 left-6 right-6 flex justify-between">
           <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-2xl text-white"><X size={20} /></button>
           <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="p-3 bg-black/40 backdrop-blur-md rounded-2xl text-white"><RotateCcw size={20} /></button>
        </div>
        <div className="absolute bottom-10 left-0 right-0 flex justify-center">
           <button onClick={capture} disabled={loading} className="w-20 h-20 bg-white rounded-full border-[6px] border-white/20 flex items-center justify-center active:scale-90">
             <div className="w-14 h-14 bg-white rounded-full border-2 border-slate-200 shadow-inner" />
           </button>
        </div>
      </div>
    </div>
  );
}

// COMPONENT: MAIN SCREEN HEADER
function Header({ title, onBack }: { title: string, onBack: () => void }) {
  return (
    <div className="flex items-center gap-4 py-1 mb-3">
      <button type="button" onClick={onBack} className="p-2.5 text-slate-400 bg-white shadow-prof border border-cardBorder rounded-lg">
        <ArrowLeft size={18} />
      </button>
      <h1 className="font-display font-black text-[16px] sm:text-[18px] text-brand-charcoal uppercase truncate">{title}</h1>
    </div>
  );
}

// COMPONENT: SCREEN FOOTER (STICKY)
function Footer({ children, className = "" }: { children?: React.ReactNode, className?: string }) {
  return (<div className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 backdrop-blur-md p-4 border-t border-cardBorder z-[100] safe-bottom shadow-2xl ${className}`}>{children}</div>);
}

// COMPONENT: FORM INPUT WRAPPER
function InputGroup({ label, children }: { label: string, children?: React.ReactNode }) {
  return (<div className="space-y-1.5"><label className="text-[14px] font-bold text-slate-400 uppercase tracking-widest ml-1">{label}</label>{children}</div>);
}

// ==================================================================================
// SECTION: MAIN APP COMPONENT
// The engine of the application. Manages all states and navigation.
// ==================================================================================

export default function App() {
  // --- STATE: USER & AUTH ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<PageView | 'login'>('login');
  const [surveyorName, setSurveyorName] = useState<string>('');

  // --- STATE: ACTIVE QUOTATION ---
  const [client, setClient] = useState<ClientDetails>({ name: '', address: '' });
  const [services, setServices] = useState<ActiveService[]>([]);
  const [terms, setTerms] = useState<string>(DEFAULT_TERMS);
  
  // --- STATE: PROJECT LISTS ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]); 
  const [allSupervisors, setAllSupervisors] = useState<UserProfile[]>([]);
  
  // --- STATE: ACTIVE WORK TRACKING ---
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<DailyAttendance | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectStatus, setCurrentProjectStatus] = useState<'quotation' | 'project'>('quotation');

  // --- STATE: UI CONTROLS ---
  const [isDirty, setIsDirty] = useState(false);
  const [isEstimateHidden, setIsEstimateHidden] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [cameraConfig, setCameraConfig] = useState<{ show: boolean, type: 'labor' | 'selfie' } | null>(null);
  const [tempService, setTempService] = useState<Partial<ActiveService> | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<{ sIdx: number; iIdx: number } | null>(null);
  const [adminSyncError, setAdminSyncError] = useState<string | null>(null);
  
  const [confirmState, setConfirmState] = useState<{
    show: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info';
  }>({ show: false, title: '', message: '', onConfirm: () => {} });

  // HELPERS
  const getTodayId = () => new Date().toISOString().split('T')[0];

  // --------------------------------------------------------------------------------
  // LOGIC: AUTHENTICATION LISTENERS
  // Automatically routes user to Admin or Surveyor dashboard based on login type.
  // --------------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const profileRef = doc(db, 'profiles', currentUser.uid);
          const profileDoc = await getDoc(profileRef);
          
          // ADMIN DETECTION: Check if the email matches info@renowix.in
          const isAdmin = currentUser.email === ADMIN_EMAIL;
          let role: 'admin' | 'supervisor' = isAdmin ? 'admin' : 'supervisor';
          
          if (role === 'admin') {
             const adminProfile: UserProfile = { uid: currentUser.uid, email: currentUser.email!, name: 'Administrator', role: 'admin', updatedAt: serverTimestamp() };
             await setDoc(profileRef, adminProfile, { merge: true });
             setUserProfile(adminProfile);
             setSurveyorName('Administrator');
             setView('admin-dashboard'); // Go directly to admin panel
          } else if (profileDoc.exists()) {
            const data = profileDoc.data() as UserProfile;
            setUserProfile(data);
            setSurveyorName(data.name);
            setView('welcome');
          } else if (currentUser.isAnonymous) {
            // GUEST MODE: Silent profile creation for visitors
            const guestProfile: UserProfile = { uid: currentUser.uid, email: 'guest@renowix.in', name: 'Guest Surveyor', role: 'supervisor', updatedAt: serverTimestamp() };
            await setDoc(profileRef, guestProfile, { merge: true });
            setUserProfile(guestProfile);
            setSurveyorName('Guest Surveyor');
            setView('welcome');
          } else {
            // NEW USER: Redirect to profile setup screen
            const tempProfile: UserProfile = { uid: currentUser.uid, email: currentUser.email!, name: '', role: 'supervisor', updatedAt: serverTimestamp() };
            setUserProfile(tempProfile);
            setView('setup');
          }
        } catch (e) { setView('login'); }
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
    setUserProfile(null); setSurveyorName(''); setClient({ name: '', address: '' }); setServices([]);
    setProjects([]); setAssignedProjects([]); setAllProjects([]); setAllSupervisors([]);
    setAdminSyncError(null); setCurrentProjectId(null); setCurrentProject(null); setTodayAttendance(null);
    setIsDirty(false);
  };

  // --------------------------------------------------------------------------------
  // LOGIC: CLOUD DATA SYNC (FIRESTORE)
  // Handles saving quotes and fetching existing projects.
  // --------------------------------------------------------------------------------
  
  // SYNC: Load project details when a specific project is selected
  useEffect(() => {
    if (!currentProjectId) { setCurrentProject(null); setTodayAttendance(null); return; }
    const unsub = onSnapshot(doc(db, 'projects', currentProjectId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { ...docSnap.data(), id: docSnap.id } as Project;
        setCurrentProject(data);
        if (data.status === 'project') { setClient(data.client); setServices(data.services); setTerms(data.terms || DEFAULT_TERMS); setCurrentProjectStatus(data.status); }
      }
    });
    const todayId = getTodayId();
    const unsubAttendance = onSnapshot(doc(db, 'projects', currentProjectId, 'attendance', todayId), (docSnap) => {
      if (docSnap.exists()) setTodayAttendance({ ...docSnap.data(), id: docSnap.id } as DailyAttendance);
      else setTodayAttendance(null);
    });
    return () => { unsub(); unsubAttendance(); };
  }, [currentProjectId]);

  // SYNC: Fetch surveyor's personal quote history
  useEffect(() => {
    if (!user || !userProfile || userProfile.role !== 'supervisor') return;
    const q = query(collection(db, 'projects'), where('surveyorId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Project[];
      setProjects([...projs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return unsub;
  }, [user, userProfile]);

  // SYNC: Fetch active site projects assigned to the current user
  useEffect(() => {
    if (!user || !userProfile || userProfile.role !== 'supervisor') return;
    const q = query(collection(db, 'projects'), where('assignedTo', '==', user.uid), where('status', '==', 'project'));
    const unsub = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Project[];
      setAssignedProjects([...projs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return unsub;
  }, [user, userProfile]);

  // ADMIN: Load all global projects and team members
  const setupAdminListeners = useCallback(() => {
    if (!user || !userProfile || userProfile.role !== 'admin' || user.email !== ADMIN_EMAIL) return null;
    const qProjects = query(collection(db, 'projects'));
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Project[];
      setAllProjects([...fetched].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    const qUsers = query(collection(db, 'profiles'), where('role', '==', 'supervisor'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as UserProfile[];
      setAllSupervisors(fetched);
    });
    return () => { unsubProjects(); unsubUsers(); };
  }, [user, userProfile]);

  useEffect(() => {
    const cleanup = setupAdminListeners();
    return () => { if(cleanup) cleanup(); };
  }, [setupAdminListeners]);

  // --------------------------------------------------------------------------------
  // LOGIC: NAVIGATION & BUTTON HANDLERS
  // Controls moving between screens and confirming exits.
  // --------------------------------------------------------------------------------

  const toggleExpand = (id: string) => setExpandedServices(prev => ({ ...prev, [id]: !prev[id] }));

  const handleBackNavigation = (target: PageView) => {
    if (isDirty && (view === 'dashboard' || view === 'measure')) {
      setConfirmState({
        show: true, title: 'Unsaved Changes', message: 'Your updates are not synced to the cloud. Exit anyway?', type: 'danger',
        onConfirm: () => { setView(target); setIsDirty(false); setConfirmState(prev => ({ ...prev, show: false })); }
      });
    } else setView(target);
  };

  // Fix missing handleAddService function
  const handleAddService = (catId: string, typeId: string, customName?: string, customDesc?: string) => {
    const category = SERVICE_DATA[catId];
    if (!category) return;
    const typeDef = category.items.find(i => i.id === typeId);
    
    const newService: ActiveService = {
      instanceId: Date.now().toString(),
      categoryId: catId,
      typeId: typeId,
      name: customName || typeDef?.name || category.name,
      desc: customDesc || typeDef?.desc || '',
      unit: (typeDef?.unit || category.unit || 'sqft') as any,
      items: [],
      rate: typeDef?.rate || 0,
      isKitchen: typeDef?.type === 'kitchen',
      isCustom: typeDef?.type === 'custom'
    };
    
    setServices(prev => [...prev, newService]);
    setTempService(newService);
    setEditingItemIndex(null);
    setView('measure');
    setIsDirty(true);
  };

  // Fix missing handleSaveMeasurement function
  const handleSaveMeasurement = (item: MeasurementItem) => {
    if (!tempService) return;
    
    setServices(prev => {
      const updated = [...prev];
      const serviceIdx = updated.findIndex(s => s.instanceId === tempService.instanceId);
      if (serviceIdx === -1) return prev;
      
      const newItems = [...updated[serviceIdx].items];
      
      if (editingItemIndex !== null) {
        newItems[editingItemIndex.iIdx] = item;
      } else {
        newItems.push(item);
      }
      
      updated[serviceIdx] = { ...updated[serviceIdx], items: newItems };
      return updated;
    });

    setTempService(null);
    setEditingItemIndex(null);
    setView('dashboard');
    setIsDirty(true);
  };

  // Fix missing deleteItem function
  const deleteItem = (sIdx: number, iIdx: number) => {
    setServices(prev => {
      const updated = [...prev];
      const service = { ...updated[sIdx] };
      service.items = service.items.filter((_, idx) => idx !== iIdx);
      
      if (service.items.length === 0) {
        return updated.filter((_, idx) => idx !== sIdx);
      }
      updated[sIdx] = service;
      return updated;
    });
    setIsDirty(true);
  };

  const performSave = async (updateExisting: boolean) => {
    if (!user) return;
    const projectData = {
      date: new Date().toLocaleString(), client, services, terms, surveyorId: user.uid,
      surveyorName: surveyorName || user.email?.split('@')[0] || 'Unknown',
      status: currentProjectStatus || 'quotation', createdAt: serverTimestamp()
    };
    try {
      if (updateExisting && currentProjectId) await updateDoc(doc(db, 'projects', currentProjectId), projectData);
      else { const docRef = await addDoc(collection(db, 'projects'), projectData); setCurrentProjectId(docRef.id); }
      setIsDirty(false); alert("Synced to cloud.");
    } catch (e: any) { alert("Error: " + e.message); }
  };

  const handleUpdateProfile = async () => {
    if (!user || !surveyorName) return;
    try {
      const isAdmin = user.email === ADMIN_EMAIL;
      const role = isAdmin ? 'admin' : 'supervisor';
      const profileData: UserProfile = { uid: user.uid, name: surveyorName, email: user.email || 'guest@renowix.in', role: role, updatedAt: serverTimestamp() };
      await setDoc(doc(db, 'profiles', user.uid), profileData); setUserProfile(profileData);
      setView(role === 'admin' ? 'admin-dashboard' : 'welcome');
    } catch (e: any) { alert(e.message); }
  };

  const loadProject = (p: Project) => {
    setClient(p.client); setServices(p.services); setTerms(p.terms || DEFAULT_TERMS);
    setCurrentProjectStatus(p.status || 'quotation'); setCurrentProjectId(p.id); 
    setIsDirty(false); setView('dashboard');
  };

  const handleSignOut = () => {
    setConfirmState({
      show: true, title: 'Sign Out', message: 'Log out of Surveyor Pro?', type: 'info',
      onConfirm: async () => { await signOut(auth); setConfirmState(prev => ({ ...prev, show: false })); }
    });
  };

  // --------------------------------------------------------------------------------
  // VIEW: MAIN APP WRAPPER
  // --------------------------------------------------------------------------------
  if (authLoading) return <div className="min-h-screen bg-appBg flex items-center justify-center"><Loader2 className="animate-spin text-brand-gold" size={48} /></div>;

  // ROUTING: Decide which page to show based on 'view' state
  if (view === 'login') return <AuthView onComplete={() => {}} />;
  // Added QuoteView and MeasurementSheetView handlers
  if (view === 'quote') return <QuoteView client={client} services={services} terms={terms} onBack={() => setView('dashboard')} onShowMeasures={() => setView('measurement-sheet')} />;
  if (view === 'measurement-sheet') return <MeasurementSheetView client={client} services={services} onBack={() => setView('quote')} />;

  // VIEW: ADMIN PANEL
  if (view === 'admin-dashboard') {
    return (
      <AdminDashboard 
        projects={allProjects} supervisors={allSupervisors} syncError={adminSyncError}
        onSignOut={handleSignOut} 
        onAssign={async (pid, sid, ms) => { try { await updateDoc(doc(db, 'projects', pid), { assignedTo: sid, status: 'project', milestones: ms, updatedAt: serverTimestamp() }); alert("Assigned."); } catch(e) { alert("Error."); } }}
        onReview={(p) => { loadProject(p); setView('dashboard'); }}
        onRetrySync={() => setupAdminListeners()}
        onDeleteProject={(id) => {
          setConfirmState({
            show: true, title: 'Delete Project', message: 'Permanently remove?', type: 'danger',
            onConfirm: async () => { await deleteDoc(doc(db, 'projects', id)); setConfirmState(prev => ({ ...prev, show: false })); }
          });
        }}
      />
    );
  }

  // VIEW: SURVEYOR MAIN INTERFACE
  return (
    <div className="min-h-screen bg-appBg flex flex-col items-center sm:py-6 text-slate-800 font-sans overflow-x-hidden">
      <div className="w-full max-xl bg-cardBg sm:rounded-3xl shadow-prof flex flex-col min-h-screen sm:min-h-[85vh] relative overflow-hidden border border-cardBorder">
        
        {/* HEADER: LOGO AND SIGN OUT AREA */}
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
          
          {/* SCREEN: INITIAL PROFILE SETUP */}
          {view === 'setup' && (
            <div className="flex flex-col items-center justify-center min-h-full p-8 bg-brand-charcoal text-white text-center">
              <img src={LOGO_URL} alt="Renowix" className="h-32 mb-8 object-contain" />
              <h2 className="text-3xl font-display font-black mb-2">Setup Profile</h2>
              <input type="text" className="w-full h-14 p-4 text-center bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-brand-gold" placeholder="Your Name" value={surveyorName} onChange={e => setSurveyorName(e.target.value)} />
              <button type="button" onClick={handleUpdateProfile} className="mt-4 w-full max-w-xs bg-brand-gold text-brand-charcoal py-4 rounded-2xl font-black text-lg">Create Profile</button>
            </div>
          )}

          {/* SCREEN: WELCOME DASHBOARD (MAIN MENU) */}
          {view === 'welcome' && (
            <div className="p-6">
              <h2 className="text-2xl font-display font-black text-brand-charcoal mb-8">Hello, <span className="text-brand-gold">{surveyorName || user?.email?.split('@')[0]}</span></h2>
              <div className="space-y-4">
                {/* MENU BUTTON: CREATE NEW QUOTE */}
                <button type="button" onClick={() => { setClient({name: '', address: ''}); setServices([]); setCurrentProjectId(null); setCurrentProjectStatus('quotation'); setView('client-details'); }} className="w-full bg-brand-charcoal text-white p-6 rounded-3xl shadow-xl flex items-center justify-between transition-all active:scale-[0.98]">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 p-4 rounded-2xl text-brand-gold"><Plus size={28} /></div>
                    <div className="text-left"><h3 className="font-black text-xl">New Quote</h3><p className="text-xs text-slate-400 uppercase font-bold tracking-widest mt-1">Start Survey</p></div>
                  </div>
                  <ChevronRight className="text-brand-gold" />
                </button>
                {/* MENU BUTTON: SITE MONITORING */}
                <button type="button" onClick={() => setView('active-projects')} className="w-full bg-brand-gold text-brand-charcoal p-6 rounded-3xl shadow-xl flex items-center justify-between transition-all active:scale-[0.98]">
                  <div className="flex items-center gap-4">
                    <div className="bg-brand-charcoal/10 p-4 rounded-2xl text-brand-charcoal"><CheckCircle size={28} /></div>
                    <div className="text-left"><h3 className="font-black text-xl">Current Projects</h3><p className="text-xs text-brand-charcoal/60 uppercase font-bold tracking-widest mt-1">Assigned Tasks</p></div>
                  </div>
                  <ChevronRight className="text-brand-charcoal" />
                </button>
                {/* MENU BUTTON: VIEW PREVIOUS WORK */}
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

          {/* SCREEN: QUOTATION HISTORY LIST */}
          {view === 'history' && (
            <div className="p-6 pb-24">
              <Header title="My Quotes" onBack={() => setView('welcome')} />
              <div className="mt-6 space-y-4">
                {projects.length === 0 && <p className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest">No quotations found</p>}
                {projects.map((p) => (
                  <div key={p.id} onClick={() => loadProject(p)} className="bg-cardBg rounded-xl p-4 shadow-prof border border-cardBorder hover:bg-slate-50 transition-all relative cursor-pointer group">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmState({
                      show: true, title: 'Delete Quote', message: 'Permanently remove this from cloud?', type: 'danger',
                      onConfirm: async () => { await deleteDoc(doc(db, 'projects', p.id)); setConfirmState(prev => ({ ...prev, show: false })); }
                    }); }} className="absolute top-3 right-3 p-2 text-brand-red"><Trash2 size={16} /></button>
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

          {/* SCREEN: ASSIGNED SITE PROJECTS */}
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
                    <div className="mb-4">
                      {p.milestones && (
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-gold transition-all duration-500" style={{ width: `${(p.milestones.filter(m => m.status === 'completed').length / p.milestones.length) * 100}%` }} />
                        </div>
                      )}
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

          {/* SCREEN: CLIENT INFO INPUT */}
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
              <Footer><button type="button" onClick={() => { if(!client.name) return alert("Enter client name"); setView('dashboard'); }} className="w-full bg-brand-charcoal text-white py-5 rounded-xl font-black text-lg shadow-xl">Start Dashboard</button></Footer>
            </div>
          )}

          {/* SCREEN: MAIN SURVEY DASHBOARD */}
          {view === 'dashboard' && (
            <div className="pt-0 p-4 sm:p-6 pb-44">
              {/* SECTION: STICKY CLIENT CARD (Search: client card, estimate) */}
              <div className="sticky top-0 z-[120] -mx-4 sm:-mx-6 px-4 pt-3 pb-5 bg-appBg/80 backdrop-blur-md">
                <div className={`bg-brand-charcoal shadow-xl px-5 py-4 rounded-[1.25rem] flex items-center justify-between border border-white/5 ${DASHBOARD_CONFIG.CLIENT_CARD_HEIGHT}`}>
                  <div className="flex items-center gap-4 overflow-hidden">
                     <div className="bg-brand-gold/20 p-2.5 rounded-xl text-brand-gold shrink-0"><User size={20} /></div>
                     <div className="overflow-hidden">
                        <h3 className="text-[18px] font-black text-white leading-tight truncate uppercase tracking-tight">{client.name || "Unnamed Client"}</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-[0.15em] truncate">{client.address || "No site address provided"}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                     <div className="flex flex-col items-end bg-black/30 px-4 py-2.5 rounded-xl border border-white/5">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Est. Total</span>
                        <p className={`text-[15px] font-black text-brand-gold leading-none ${isEstimateHidden ? DASHBOARD_CONFIG.ESTIMATE_BLUR : ''}`}>₹{Math.round(services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0)).toLocaleString()}</p>
                     </div>
                     <button type="button" onClick={() => setIsEstimateHidden(!isEstimateHidden)} className="p-2.5 bg-slate-800/50 rounded-xl text-white/60 hover:bg-slate-700 transition-colors">
                        {isEstimateHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                     </button>
                  </div>
                </div>
              </div>
              
              <Header title={currentProjectStatus === 'project' ? "Project Specs" : "Service Items"} onBack={() => handleBackNavigation('welcome')} />
              
              {/* SECTION: SERVICE LISTING (Search: service list, category) */}
              <div className="mt-4 space-y-4">
                {services.map((s, sIdx) => {
                  const isExpanded = expandedServices[s.instanceId];
                  return (
                    <div key={s.instanceId} className="bg-cardBg rounded-2xl shadow-prof border border-cardBorder overflow-hidden">
                      <div className="min-h-[5.5rem] px-4 py-3 border-b border-cardBorder grid grid-cols-[50px_1fr_80px] gap-4 items-center cursor-pointer relative" onClick={() => toggleExpand(s.instanceId)}>
                        <div className="flex items-center justify-start shrink-0">
                          <ServiceIcon categoryId={s.categoryId} typeId={s.typeId} />
                        </div>
                        <div className="min-w-0 pr-2">
                          <h4 className="font-black text-[14px] text-brand-charcoal leading-tight line-clamp-2">{s.name}</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} {s.unit}</p>
                        </div>
                        <div className="flex flex-col items-end justify-center shrink-0">
                          <span className={`font-black text-brand-charcoal text-[15px] ${isEstimateHidden ? DASHBOARD_CONFIG.ESTIMATE_BLUR : ''}`}>₹{Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}</span>
                          <div className="mt-2 text-slate-300">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="divide-y divide-cardBorder bg-slate-50/30">
                          {s.items.map((item, iIdx) => (
                            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-white">
                               <div><p className="font-bold text-slate-700 text-sm">{item.name}</p><p className="text-[10px] text-slate-400">₹{item.rate} / {s.unit}</p></div>
                               <div className="flex items-center gap-2"><span className={`font-bold text-brand-charcoal text-sm ${isEstimateHidden ? DASHBOARD_CONFIG.ESTIMATE_BLUR : ''}`}>₹{Math.round(item.cost).toLocaleString()}</span>
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
                            <button type="button" onClick={() => { setTempService(s); setEditingItemIndex(null); setView('measure'); }} className="w-full py-4 text-[11px] font-black text-brand-gold uppercase tracking-[0.2em] bg-white/40">+ Add New Measurement</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* BUTTON: ADD NEW CATEGORY */}
                {currentProjectStatus === 'quotation' && (
                  <button type="button" onClick={() => setView('service-select')} className="w-full h-14 border-2 border-brand-gold/30 bg-white text-brand-gold rounded-2xl font-black flex items-center justify-center gap-3 shadow-sm uppercase text-[12px] tracking-[0.15em] active:scale-[0.98] transition-all"><PlusCircle size={18} /> Add New Category</button>
                )}
              </div>
              <Footer>
                <div className="flex gap-2 w-full h-14">
                   <button type="button" onClick={() => services.length > 0 ? setView('quote') : alert("No data.")} className="flex-[2.5] bg-brand-charcoal text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg"><CheckCircle size={18} className="text-brand-gold" /><span className="text-sm">Review Quotation</span></button>
                   {currentProjectStatus === 'quotation' && (
                     <button type="button" onClick={() => performSave(currentProjectId !== null)} className="flex-1 bg-white border border-cardBorder text-slate-800 rounded-xl flex flex-col items-center justify-center gap-1 shadow-sm"><Save size={18} /><span className="text-[9px] font-black uppercase">Sync</span></button>
                   )}
                </div>
              </Footer>
            </div>
          )}
          
          {/* SCREEN: CATEGORY SELECTION */}
          {view === 'service-select' && <ServiceSelector onBack={() => setView('dashboard')} onSelect={handleAddService} />}
          
          {/* SCREEN: MEASUREMENT DATA FORM */}
          {view === 'measure' && tempService && (
            <MeasurementForm serviceContext={tempService} editingItem={editingItemIndex !== null && tempService.items ? tempService.items[editingItemIndex.iIdx] : undefined} onBack={() => setView('dashboard')} onSave={handleSaveMeasurement} />
          )}
        </div>
      </div>

      {/* POPUP: GLOBAL CONFIRMATION DIALOG */}
      {confirmState.show && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
            <h3 className="text-xl font-black text-brand-charcoal mb-4">{confirmState.title}</h3>
            <p className="text-slate-500 text-sm mb-8">{confirmState.message}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmState(prev => ({ ...prev, show: false }))} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase">Cancel</button>
              <button type="button" onClick={confirmState.onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase ${confirmState.type === 'danger' ? 'bg-brand-red' : 'bg-brand-charcoal'}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================================================================================
// VIEW: AUTHENTICATION (Search: login page, google login, guest mode)
// The entrance to the app. Handles Google, Guest, and Email login.
// ==================================================================================

function AuthView({ onComplete }: { onComplete: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // BUTTON HANDLER: Standard Email/Password Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onComplete();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  // BUTTON HANDLER: Google One-Click Login
  const handleGoogleSignIn = async () => {
    setLoading(true); setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onComplete();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  // BUTTON HANDLER: Continue as Guest (Search: guest button)
  const handleGuestSignIn = async () => {
    setLoading(true); setError('');
    try {
      await signInAnonymously(auth);
      onComplete();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-brand-charcoal flex items-center justify-center p-4">
      <div className="w-full max-sm bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Renowix" className="h-16 mx-auto mb-6 object-contain" />
          <h2 className="text-2xl font-display font-black text-brand-charcoal tracking-tight">Surveyor Portal</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Authorized Access Only</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-brand-red rounded-2xl text-[11px] font-bold border border-red-100 leading-relaxed flex gap-3 items-center">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="email" required className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="password" required className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="w-full h-16 bg-brand-charcoal text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} className="text-brand-gold" />} Sign In Securely
          </button>
        </form>

        <div className="mt-8 flex flex-col gap-4">
           <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Or login via</span>
              <div className="flex-grow border-t border-slate-100"></div>
           </div>

           {/* SOCIAL LOGIN: Google */}
           <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="w-full h-14 bg-white border-2 border-slate-100 text-slate-700 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-50">
             <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
             Continue with Google
           </button>

           {/* GUEST ACCESS LINK */}
           <button type="button" onClick={handleGuestSignIn} disabled={loading} className="w-full h-12 text-[11px] font-black text-brand-gold uppercase tracking-[0.2em]">
             Continue as Guest
           </button>
        </div>
      </div>
    </div>
  );
}

// ==================================================================================
// VIEW: SERVICE SELECTOR (Search: add service, ai optimize)
// Allows surveyor to pick categories like "Painting" or "Woodwork".
// ==================================================================================

function ServiceSelector({ onBack, onSelect }: { onBack: () => void, onSelect: (c:string, t:string, customN?:string, customD?:string) => void }) {
  const [cat, setCat] = useState('');
  const [type, setType] = useState('');
  const [customName, setCustomName] = useState('');
  const [description, setDescription] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => { if (cat === 'custom') setType('custom_item'); else setType(''); }, [cat]);
  useEffect(() => { if (cat && type && cat !== 'custom') { const typeItem = SERVICE_DATA[cat]?.items.find(i => i.id === type); if (typeItem) setDescription(typeItem.desc); } }, [cat, type]);
  
  // AI FEATURE: Rewrites messy notes into professional quotation descriptions
  const handleAiRewrite = async () => {
    if (!description.trim()) return; setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Restructure into a professional 3-line quote description: "${description}"` });
      if (response.text) setDescription(response.text.trim());
    } catch (e) { alert("AI error."); } finally { setIsAiLoading(false); }
  };

  return (
    <div className="p-6 pb-32 bg-appBg">
      <Header title="Add Service" onBack={onBack} />
      {!cat ? (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {Object.values(SERVICE_DATA).map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} className="bg-white p-6 rounded-3xl shadow-prof border border-cardBorder flex flex-col items-center gap-3 active:scale-95 transition-all text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 text-brand-gold flex items-center justify-center border border-slate-100 shadow-sm"><ServiceIcon categoryId={c.id} typeId="" /></div>
              <span className="font-black text-[12px] uppercase tracking-wider text-brand-charcoal">{c.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6 mt-4">
          <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
            <span className="font-black uppercase text-[10px] text-slate-600 tracking-[0.15em] ml-2">{SERVICE_DATA[cat]?.name}</span>
          </div>
          <div className="space-y-3">
            {cat === 'custom' ? (
              <div className="bg-cardBg p-5 rounded-2xl border border-cardBorder shadow-prof"><InputGroup label="Custom Name"><input type="text" className="w-full h-12 px-4 border border-inputBorder rounded-xl font-bold bg-slate-50" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Service Name" /></InputGroup></div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {SERVICE_DATA[cat].items.map(i => (
                  <button key={i.id} onClick={() => setType(i.id)} className={`p-4 rounded-2xl border text-left transition-all ${type === i.id ? 'bg-brand-gold/10 border-brand-gold ring-1 ring-brand-gold shadow-md' : 'bg-white border-cardBorder'}`}>
                    <h4 className="font-black text-brand-charcoal text-[13px] uppercase tracking-tight">{i.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-bold uppercase tracking-widest">Base Rate: ₹{i.rate}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {(type || cat === 'custom') && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-cardBorder shadow-inner animate-in fade-in slide-in-from-bottom-2">
              <InputGroup label="Service Description"><textarea rows={5} className="w-full p-4 bg-white border border-inputBorder rounded-xl outline-none text-xs leading-relaxed focus:border-brand-gold" value={description} onChange={e => setDescription(e.target.value)} />
                <button type="button" onClick={handleAiRewrite} disabled={isAiLoading} className="mt-3 w-full h-12 bg-brand-charcoal text-white rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-xl hover:bg-slate-800 transition-all">
                  {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-brand-gold" />} AI Optimize
                </button>
              </InputGroup>
            </div>
          )}
        </div>
      )}
      <Footer><button type="button" onClick={() => onSelect(cat, type, customName, description)} disabled={!cat || (!type && cat !== 'custom')} className="w-full h-14 bg-brand-charcoal text-white rounded-xl font-black shadow-2xl active:scale-95 transition-all">Continue to Measures</button></Footer>
    </div>
  );
}

// ==================================================================================
// VIEW: MEASUREMENT FORM (Search: measurement page, walls, cabinet)
// The technical core for entering dimensions (Length, Breadth, Height).
// ==================================================================================

function MeasurementForm({ serviceContext, editingItem, onBack, onSave }: { serviceContext: Partial<ActiveService>, editingItem?: MeasurementItem, onBack: () => void, onSave: (item: MeasurementItem) => void }) {
  const [name, setName] = useState(editingItem?.name || '');
  const [rate, setRate] = useState<number>(editingItem?.rate || serviceContext.rate || 0);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [cabinetSections, setCabinetSections] = useState<CabinetSection[]>([]);
  const [extraAreas, setExtraAreas] = useState<CeilingSection[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [height, setHeight] = useState<number>(editingItem?.height || 9);
  
  const isWoodwork = serviceContext.categoryId === 'woodwork' || serviceContext.isCustom || serviceContext.isKitchen;
  const isPainting = serviceContext.categoryId === 'painting';

  useEffect(() => { 
    if (!editingItem) { 
      if (isPainting) setWalls([1,2,3,4].map(id => ({id: id.toString(), width: 0}))); 
      if (isWoodwork) setCabinetSections([{ id: Date.now().toString(), name: 'Main Section', l: 0, b: 0, q: 1 }]); 
    } else {
      if (isWoodwork) setCabinetSections(editingItem.cabinetSections || [{ id: Date.now().toString(), name: 'Main Section', l: 0, b: 0, q: 1 }]);
      if (isPainting) {
        setWalls(editingItem.walls || [1,2,3,4].map(id => ({id: id.toString(), width: 0})));
        setExtraAreas(editingItem.extraAreas || []);
        setDeductions(editingItem.deductions || []);
      }
    } 
  }, [editingItem, isPainting, isWoodwork]);

  // LOGIC: Calculate net area minus doors/windows
  const calculateTotal = (): number => {
    let baseArea = 0;
    if (isWoodwork) {
      baseArea = cabinetSections.reduce((acc, s) => acc + ((s.l || 0) * (s.b || 0) * (s.q || 1)), 0);
    } else if (isPainting) {
      const wallArea = walls.reduce((s, w) => s + (w.width || 0), 0) * height;
      const extraArea = extraAreas.reduce((s, e) => s + ((e.l || 0) * (e.b || 0)), 0);
      baseArea = wallArea + extraArea;
    }
    const totalDeduction = deductions.reduce((s, d) => s + ((d.area || 0) * (d.qty || 1)), 0);
    return Math.max(0, baseArea - totalDeduction);
  };

  const netArea = calculateTotal(); 
  const cost = netArea * rate;

  return (
    <div className="flex flex-col min-h-full relative bg-appBg">
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto no-scrollbar">
        <Header title={serviceContext.name || "Measurement"} onBack={onBack} />
        <div className="space-y-6 pb-80 mt-4">
          
          {/* SECTION: BASIC INFO (Search: room name, rate) */}
          <div className="bg-cardBg p-5 rounded-3xl border border-cardBorder shadow-prof space-y-5">
            <InputGroup label="ROOM / SECTION NAME">
              <input className="w-full h-12 px-4 border border-inputBorder rounded-xl font-black bg-slate-50 focus:bg-white focus:border-brand-gold transition-all" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Living Room" />
            </InputGroup>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="RATE (₹)">
                <input type="number" className="w-full h-12 px-4 border border-inputBorder rounded-xl font-black bg-slate-50" value={rate || ''} onChange={e => setRate(parseFloat(e.target.value) || 0)} />
              </InputGroup>
              {isPainting && (
                <NumericInput label="Height" value={height} onChange={setHeight} unit="ft" />
              )}
            </div>
          </div>

          {/* SECTION: WALLS (Painting only) */}
          {isPainting ? (
            <div className="bg-cardBg p-5 rounded-3xl shadow-prof border border-cardBorder space-y-4">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Wall Widths</span>
              <div className="grid grid-cols-2 gap-4">
                {walls.map((w, idx) => (
                  <NumericInput key={w.id} label={`Wall ${idx+1}`} value={w.width} onChange={(v) => { const nw = [...walls]; nw[idx].width = v; setWalls(nw); }} />
                ))}
              </div>
              <button type="button" onClick={() => setWalls([...walls, { id: Date.now().toString(), width: 0 }])} className="w-full h-10 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-300">+ Add More Wall</button>
            </div>
          ) : (
            // SECTION: WOODWORK COMPONENTS (Wardrobes, Cabinets)
            <div className="space-y-4">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Component Dimensions</span>
              {cabinetSections.map((s, idx) => (
                <div key={s.id} className="bg-cardBg p-5 rounded-3xl border border-cardBorder shadow-prof space-y-4 relative">
                  {cabinetSections.length > 1 && (
                    <button onClick={() => setCabinetSections(cabinetSections.filter(sec => sec.id !== s.id))} className="absolute top-4 right-4 text-brand-red p-2"><Trash2 size={16} /></button>
                  )}
                  <input type="text" className="font-black text-[11px] uppercase tracking-widest bg-transparent outline-none border-b border-slate-50 pb-2 mb-2 block w-full" value={s.name} placeholder="Section Name" onChange={(e) => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, name: e.target.value} : sec))} />
                  <div className="flex gap-4">
                    <NumericInput label="L" value={s.l} onChange={(v) => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, l: v} : sec))} />
                    <NumericInput label="W" value={s.b} onChange={(v) => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, b: v} : sec))} />
                    <NumericInput label="Qty" value={s.q} unit="x" onChange={(v) => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, q: v} : sec))} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setCabinetSections([...cabinetSections, { id: Date.now().toString(), name: `Component ${cabinetSections.length + 1}`, l: 0, b: 0, q: 1 }])} className="w-full h-12 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400">+ Add Component</button>
            </div>
          )}

          {/* Restored SECTION: EXTRA AREAS (Ceiling / Patches) */}
          {isPainting && (
            <div className="space-y-4">
              <span className="text-[11px] font-black text-brand-gold uppercase tracking-widest ml-1 block">Extra Areas (Ceiling / Patches)</span>
              {extraAreas.map((ea, idx) => (
                <div key={ea.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-end gap-3 relative">
                  <button onClick={() => setExtraAreas(extraAreas.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-white p-1.5 rounded-full text-brand-red border border-red-100 shadow-sm"><X size={12} /></button>
                  <NumericInput label="L" value={ea.l} onChange={(v) => { const nea = [...extraAreas]; nea[idx].l = v; setExtraAreas(nea); }} />
                  <NumericInput label="B" value={ea.b} onChange={(v) => { const nea = [...extraAreas]; nea[idx].b = v; setExtraAreas(nea); }} />
                </div>
              ))}
              <button type="button" onClick={() => setExtraAreas([...extraAreas, { id: Date.now().toString(), l: 0, b: 0 }])} className="w-full h-10 border-2 border-dashed border-brand-gold/20 bg-brand-gold/[0.03] rounded-xl text-[10px] font-black uppercase text-brand-gold">+ Add Ceiling/Patch Area</button>
            </div>
          )}

          {/* SECTION: DEDUCTIONS (Search: doors, windows) */}
          <div className="space-y-4">
            <span className="text-[11px] font-black text-brand-red uppercase tracking-widest ml-1 block">Deductions (Doors / Windows)</span>
            {deductions.map((d, idx) => (
              <div key={d.id} className="bg-red-50/30 p-4 rounded-3xl border border-red-100 shadow-sm space-y-3 relative">
                <button onClick={() => setDeductions(deductions.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-white p-1.5 rounded-full text-brand-red border border-red-100 shadow-sm"><X size={12} /></button>
                <input type="text" value={d.type} onChange={(e) => { const nd = [...deductions]; nd[idx].type = e.target.value; setDeductions(nd); }} placeholder="e.g. Standard Door" className="w-full h-10 px-4 bg-white border border-red-100 rounded-xl text-[11px] font-black outline-none" />
                <div className="flex gap-4">
                  <NumericInput label="Unit Area" value={d.area} unit="sqft" onChange={(v) => { const nd = [...deductions]; nd[idx].area = v; setDeductions(nd); }} />
                  <NumericInput label="Qty" value={d.qty} unit="x" onChange={(v) => { const nd = [...deductions]; nd[idx].qty = v; setDeductions(nd); }} />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setDeductions([...deductions, { id: Date.now().toString(), type: 'Door/Window', area: 18, qty: 1 }])} className="w-full h-10 border-2 border-dashed border-red-200 bg-red-50/10 rounded-xl text-[10px] font-black uppercase text-brand-red">+ Add Deduction</button>
          </div>
        </div>
      </div>

      {/* FOOTER: NET TOTAL DISPLAY */}
      <div className="fixed bottom-0 left-0 right-0 z-[110] w-full flex justify-center p-4 safe-bottom">
        <div className="w-full max-sm flex flex-col gap-2">
          <div className="flex flex-row justify-between items-center bg-brand-charcoal text-white py-4 px-8 rounded-3xl shadow-2xl border border-white/5">
            <div>
              <p className="text-[9px] opacity-50 uppercase tracking-[0.2em]">NET QUANTITY</p>
              <p className="font-extrabold text-brand-gold text-2xl">{netArea.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] opacity-50 uppercase tracking-[0.2em]">ESTIMATE</p>
              <p className="font-extrabold text-brand-gold text-2xl">₹{Math.round(cost).toLocaleString()}</p>
            </div>
          </div>
          <button type="button" onClick={() => onSave({ id: editingItem?.id || Date.now().toString(), name: name || "Room", netArea, rate, cost, height, walls, cabinetSections, extraAreas, deductions })} className="w-full h-16 bg-brand-charcoal text-white rounded-3xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all">
             <CheckCircle size={24} className="text-brand-gold" /> SAVE MEASUREMENT
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================================================================================
// VIEW: ADMIN DASHBOARD (Search: admin dashboard, inbox)
// Restricted panel for info@renowix.in to monitor all quotes.
// ==================================================================================

function AdminDashboard({ projects, supervisors, syncError, onSignOut, onAssign, onReview, onRetrySync, onDeleteProject }: { projects: Project[], supervisors: UserProfile[], syncError: string|null, onSignOut: () => void, onAssign: (pid: string, sid: string, milestones: Milestone[]) => void, onReview: (p: Project) => void, onRetrySync: () => void, onDeleteProject: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<'quotes' | 'supervisors' | 'attendance'>('quotes');
  const [assignModal, setAssignModal] = useState<Project | null>(null);
  const [selectedSup, setSelectedSup] = useState<UserProfile | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <nav className="bg-brand-charcoal text-white px-8 py-4 flex justify-between items-center shadow-xl sticky top-0 z-[200]">
        <div className="flex items-center gap-3"><img src={LOGO_URL} className="h-10" alt="Renowix" /><span className="font-display font-black text-xl tracking-tight uppercase">Admin</span></div>
        <button onClick={onSignOut} className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl text-sm font-bold border border-white/10"><LogOut size={14} className="text-brand-gold" /> Out</button>
      </nav>
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex gap-4 mb-8">
          <button onClick={() => setActiveTab('quotes')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase ${activeTab === 'quotes' ? 'bg-brand-charcoal text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>Inbox</button>
          <button onClick={() => setActiveTab('supervisors')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase ${activeTab === 'supervisors' ? 'bg-brand-charcoal text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>Team</button>
        </div>
        {activeTab === 'quotes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow relative">
                <button onClick={() => onDeleteProject(p.id)} className="absolute top-4 right-4 text-slate-300 hover:text-brand-red"><X size={16} /></button>
                <div className="mb-4">
                  <h3 className="font-black text-lg text-brand-charcoal leading-tight">{p.client.name}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><MapPin size={10} /> {p.client.address || 'No Address'}</p>
                </div>
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <p className="font-black text-brand-charcoal text-lg">₹{Math.round(p.services.reduce((s, ser) => s + ser.items.reduce((is, i) => is + i.cost, 0), 0)).toLocaleString()}</p>
                  <button onClick={() => onReview(p)} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-brand-blue hover:text-white transition-all"><Eye size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// COMPONENT: SERVICE ICON GENERATOR
// --------------------------------------------------------------------------------
function ServiceIcon({ categoryId, typeId }: { categoryId: string, typeId: string }) {
  const Icon = categoryId === 'painting' ? PaintRoller : (typeId === 'kitchen_mod' ? Utensils : (typeId === 'tv_unit' ? Monitor : Hammer));
  const categoryStyles = categoryId === 'painting' ? "bg-blue-50 text-blue-600 border-blue-100" : (categoryId === 'woodwork' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-slate-50 text-slate-600 border-slate-200");
  return (<div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm shrink-0 ${categoryStyles}`}><Icon size={20} /></div>);
}

// --------------------------------------------------------------------------------
// COMPONENT: NUMERIC INPUT WITH UNIT LABEL
// --------------------------------------------------------------------------------
function NumericInput({ value, onChange, label, unit = "ft", placeholder = "0" }: { value: number, onChange: (v: number) => void, label: string, unit?: string, placeholder?: string }) {
  return (
    <div className="flex-1 space-y-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <input type="number" value={value === 0 ? '' : value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} placeholder={placeholder} className="w-full h-12 px-4 pr-10 border border-inputBorder rounded-xl font-black bg-white focus:border-brand-gold transition-all outline-none" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">{unit}</span>
      </div>
    </div>
  );
}

// Fix missing QuoteView component
function QuoteView({ client, services, terms, onBack, onShowMeasures }: { client: ClientDetails, services: ActiveService[], terms: string, onBack: () => void, onShowMeasures: () => void }) {
  const total = services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0);

  return (
    <div className="min-h-screen bg-white p-6 pb-32">
      <Header title="Quotation Review" onBack={onBack} />
      
      <div className="mt-8 space-y-8">
        <div className="border-b border-slate-100 pb-6">
          <div className="flex justify-between items-start mb-4">
             <div>
               <h2 className="text-2xl font-black text-brand-charcoal">{client.name}</h2>
               <p className="text-sm text-slate-500 max-w-xs">{client.address}</p>
             </div>
             <div className="text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</p>
               <p className="font-bold text-slate-700">{new Date().toLocaleDateString()}</p>
             </div>
          </div>
        </div>

        <div className="space-y-6">
          {services.map((s) => (
            <div key={s.instanceId} className="space-y-3">
              <h3 className="font-black text-brand-charcoal uppercase text-sm tracking-widest">{s.name}</h3>
              <div className="bg-slate-50 rounded-2xl p-4 divide-y divide-slate-200/50">
                {s.items.map(item => (
                  <div key={item.id} className="py-3 flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-600">{item.name}</span>
                    <span className="font-bold text-brand-charcoal">₹{Math.round(item.cost).toLocaleString()}</span>
                  </div>
                ))}
                <div className="pt-3 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Section Total</span>
                  <span className="font-black text-brand-charcoal">₹{Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-brand-charcoal text-white p-6 rounded-3xl">
           <div className="flex justify-between items-center mb-2">
             <span className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em]">Grand Total</span>
             <span className="text-3xl font-black text-brand-gold">₹{Math.round(total).toLocaleString()}</span>
           </div>
           <p className="text-[10px] opacity-40 italic">Note: Taxes extra as applicable</p>
        </div>

        <div className="space-y-3">
           <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Terms & Conditions</h4>
           <div className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
             {terms}
           </div>
        </div>
      </div>

      <Footer className="flex gap-2">
        <button onClick={onShowMeasures} className="flex-1 h-14 bg-white border border-slate-200 text-slate-600 rounded-xl font-black flex items-center justify-center gap-2"><FileText size={18} /> Breakdown</button>
        <button onClick={() => downloadCSV(generateCSV({ client, services, terms, date: new Date().toLocaleDateString(), surveyorId: '', status: 'quotation', createdAt: null } as any), `Quote_${client.name}.csv`)} className="flex-[1.5] h-14 bg-brand-charcoal text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-xl"><Printer size={18} className="text-brand-gold" /> Export CSV</button>
      </Footer>
    </div>
  );
}

// Fix missing MeasurementSheetView component
function MeasurementSheetView({ client, services, onBack }: { client: ClientDetails, services: ActiveService[], onBack: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24">
      <Header title="Measurement Sheet" onBack={onBack} />
      <div className="mt-6 space-y-6">
        {services.map(s => (
          <div key={s.instanceId} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
               <h3 className="font-black text-brand-charcoal uppercase text-xs tracking-widest">{s.name}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-tighter">
                    <th className="px-6 py-3">Room / Item</th>
                    <th className="px-6 py-3">Details</th>
                    <th className="px-6 py-3 text-right">Net Area</th>
                    <th className="px-6 py-3 text-right">Rate</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {s.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 font-bold text-slate-700">{item.name}</td>
                      <td className="px-6 py-4 text-slate-400">
                        {item.walls && item.walls.length > 0 && `Walls: ${item.walls.map(w=>w.width).join('+')} @ H:${item.height}`}
                        {item.cabinetSections && item.cabinetSections.length > 0 && item.cabinetSections.map(cs => `${cs.l}x${cs.b}x${cs.q}`).join(', ')}
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{item.netArea.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">₹{item.rate}</td>
                      <td className="px-6 py-4 text-right font-black text-brand-charcoal">₹{Math.round(item.cost).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
