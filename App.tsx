
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  ArrowLeft, Plus, Trash2, Edit2, Save, History, Printer, CheckCircle,
  ChevronRight, Briefcase, User, MapPin, PaintRoller, Hammer, Utensils,
  Monitor, Box, Sparkles, Loader2, Ruler as RulerIcon, 
  AlertTriangle, PlusCircle, LogOut, Eye,
  EyeOff, Settings, ChevronDown, ChevronUp, ArrowUpRight,
  LogIn, Mail, Lock, ExternalLink, Download, Users, FileText, LayoutDashboard, UserPlus,
  PackageSearch, RefreshCw, Layers, X, Clock, Flag, Trophy, Camera, CameraOff, Smartphone, RotateCcw
} from 'lucide-react';

import { 
  ActiveService, ClientDetails, MeasurementItem, PageView, Project, 
  Wall, CeilingSection, CabinetSection, Deduction, UserProfile, Milestone, DailyAttendance } from './types';
import { SERVICE_DATA, DEFAULT_TERMS } from './constants';
import { auth, db } from './firebase';

// Fix: Corrected Firebase modular imports. User is an interface and should be imported as a type in strict environments.
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';

// Fix: Corrected Firestore modular imports to ensure proper type resolution.
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

/**
 * Utility: Compress Image to keep Firestore Docs under 1MB
 */
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

/**
 * Camera Capture Component
 */
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
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setLoading(false);
    } catch (err) {
      alert("Camera access denied or unavailable.");
      onClose();
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => track.stop());
    };
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(dataUrl);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-lg aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="text-brand-gold animate-spin" size={48} />
          </div>
        )}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* UI Overlay */}
        <div className="absolute top-6 left-6 right-6 flex justify-between">
           <button onClick={onClose} className="p-3 bg-black/40 backdrop-blur-md rounded-2xl text-white border border-white/10"><X size={20} /></button>
           <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="p-3 bg-black/40 backdrop-blur-md rounded-2xl text-white border border-white/10"><RotateCcw size={20} /></button>
        </div>

        <div className="absolute bottom-10 left-0 right-0 flex justify-center">
           <button 
             onClick={capture} 
             disabled={loading}
             className="w-20 h-20 bg-white rounded-full border-[6px] border-white/20 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
           >
             <div className="w-14 h-14 bg-white rounded-full border-2 border-slate-200 shadow-inner" />
           </button>
        </div>
      </div>
      <p className="mt-8 text-white/50 text-[10px] font-black uppercase tracking-[0.3em]">Live Site Proof Capture</p>
    </div>
  );
}

/**
 * Enhanced Spreadsheet Quotation View
 */
function QuoteView({ client, services, terms, onBack, onDownloadCSV }: { client: ClientDetails, services: ActiveService[], terms: string, onBack: () => void, onDownloadCSV: () => void }) {
  const totalAmount = services.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.cost, 0), 0);
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center">
      {/* Action Bar (Browser Only) */}
      <div className="no-print w-full bg-white border-b border-slate-200 sticky top-0 z-[200] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={onBack} className="p-2 text-slate-400 hover:text-brand-charcoal transition-colors bg-slate-50 rounded-xl border border-slate-100"><ArrowLeft size={20} /></button>
          <div className="flex gap-3">
             <button onClick={onDownloadCSV} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-200 hover:bg-slate-100 transition-all active:scale-95"><Download size={14} /> Download CSV</button>
             <button onClick={handlePrint} className="px-6 py-2 bg-brand-charcoal text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                <Printer size={16} className="text-brand-gold" /> Download PDF / Print
             </button>
          </div>
        </div>
      </div>

      {/* Quotation Canvas (Paper Effect) */}
      <div className="quote-container w-full max-w-[210mm] min-h-[297mm] bg-white my-8 shadow-2xl overflow-hidden print:shadow-none print:my-0">
        <div className="p-10 sm:p-14">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start mb-12 border-b-4 border-brand-charcoal pb-8">
            <div className="space-y-4">
              <img src={LOGO_URL} className="h-16 mb-2 object-contain" alt="Renowix" />
              <h1 className="text-4xl font-black text-brand-charcoal tracking-tighter uppercase leading-none">Quotation</h1>
              <div className="flex items-center gap-2">
                <span className="bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded font-black text-[10px] tracking-widest">OFFICIAL</span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">REF: RNX-{new Date().getFullYear()}-{Math.floor(Math.random()*10000)}</p>
              </div>
            </div>
            <div className="mt-8 sm:mt-0 text-right space-y-1">
              <h2 className="text-lg font-black text-brand-charcoal">Renowix Renovations</h2>
              <p className="text-xs text-slate-500 font-medium">C-32, Sector 51, Noida, UP 201301</p>
              <p className="text-xs text-slate-500 font-medium">info@renowix.in | +91 92114 29635</p>
              <div className="h-4"></div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 inline-block text-left min-w-[160px]">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Document Date</p>
                <p className="text-sm font-black text-brand-charcoal">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          </div>

          {/* Client Info Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 mb-12">
            <div>
              <p className="text-[11px] font-black text-brand-gold uppercase tracking-[0.3em] mb-4 border-b border-slate-100 pb-2">Client Profile</p>
              <h3 className="text-xl font-black text-brand-charcoal mb-2">{client.name}</h3>
              <div className="flex gap-2">
                 <MapPin size={14} className="text-slate-300 shrink-0 mt-0.5" />
                 <p className="text-xs text-slate-500 font-medium leading-relaxed whitespace-pre-wrap">{client.address || "Address not provided"}</p>
              </div>
            </div>
            <div className="flex flex-col justify-end space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Category</span>
                <span className="text-xs font-black text-brand-charcoal">Standard Residential</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quote Status</span>
                <span className="text-xs font-black text-brand-blue uppercase">Provisional Estimate</span>
              </div>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div className="mb-12">
            <table className="w-full border-collapse border border-slate-300">
              <thead>
                <tr className="bg-brand-charcoal text-white print:bg-brand-charcoal print:text-white">
                  <th className="border border-brand-charcoal p-3 text-left text-[11px] font-black uppercase tracking-widest w-12">#</th>
                  <th className="border border-brand-charcoal p-3 text-left text-[11px] font-black uppercase tracking-widest">Description of Work</th>
                  <th className="border border-brand-charcoal p-3 text-center text-[11px] font-black uppercase tracking-widest w-24">Quantity</th>
                  <th className="border border-brand-charcoal p-3 text-center text-[11px] font-black uppercase tracking-widest w-20">Unit</th>
                  <th className="border border-brand-charcoal p-3 text-right text-[11px] font-black uppercase tracking-widest w-28">Rate (₹)</th>
                  <th className="border border-brand-charcoal p-3 text-right text-[11px] font-black uppercase tracking-widest w-32">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, sIdx) => (
                  <React.Fragment key={service.instanceId}>
                    {/* Category Row */}
                    <tr className="bg-slate-100 border-b-2 border-slate-300">
                      <td colSpan={6} className="p-3 border border-slate-300">
                        <div className="flex items-center justify-between">
                           <span className="font-black text-xs text-brand-charcoal uppercase tracking-[0.2em]">{service.name}</span>
                           <span className="text-[10px] font-bold text-slate-400 uppercase italic">Section {sIdx + 1}</span>
                        </div>
                        {service.desc && <p className="text-[10px] text-slate-500 mt-1 font-medium italic leading-relaxed">{service.desc}</p>}
                      </td>
                    </tr>
                    {/* Item Rows */}
                    {service.items.map((item, iIdx) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="border border-slate-200 p-3 text-center text-[11px] font-bold text-slate-400">{sIdx + 1}.{iIdx + 1}</td>
                        <td className="border border-slate-200 p-3">
                          <p className="text-xs font-black text-brand-charcoal mb-1">{item.name}</p>
                          {/* Measurements breakdown in spreadsheet format */}
                          <div className="flex flex-col gap-1">
                            {item.walls && item.walls.length > 0 && (
                              <p className="text-[9px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded inline-block w-fit font-medium">
                                WALLS: ({item.walls.map(w => w.width).join(' + ')}) ft x {item.height} ft Height
                              </p>
                            )}
                            {item.cabinetSections && item.cabinetSections.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.cabinetSections.map(c => (
                                  <span key={c.id} className="text-[8px] bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase">
                                    {c.name}: {c.l}x{c.b} ({c.q} Qty)
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="border border-slate-200 p-3 text-center text-xs font-bold text-slate-600">{item.netArea.toFixed(2)}</td>
                        <td className="border border-slate-200 p-3 text-center text-[10px] font-black text-slate-400 uppercase">{service.unit}</td>
                        <td className="border border-slate-200 p-3 text-right text-xs font-bold text-slate-600">₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="border border-slate-200 p-3 text-right text-xs font-black text-brand-charcoal">₹{Math.round(item.cost).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    {/* Section Subtotal */}
                    <tr className="bg-slate-50/50">
                       <td colSpan={5} className="border border-slate-200 p-2 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Section {sIdx + 1} Subtotal</td>
                       <td className="border border-slate-200 p-2 text-right text-xs font-black text-brand-charcoal bg-slate-100/50">₹{Math.round(service.items.reduce((acc, curr) => acc + curr.cost, 0)).toLocaleString('en-IN')}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-brand-charcoal text-white print:bg-brand-charcoal print:text-white">
                  <td colSpan={4} className="p-5 border border-brand-charcoal text-right text-sm font-black uppercase tracking-[0.3em]">Estimated Total Project Cost</td>
                  <td colSpan={2} className="p-5 border border-brand-charcoal text-right text-2xl font-black text-brand-gold shadow-inner">
                    ₹{Math.round(totalAmount).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Terms and Sign-off */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-12 mt-12">
            <div className="sm:col-span-7">
              <h4 className="text-[11px] font-black text-brand-charcoal uppercase tracking-widest mb-4 border-b-2 border-brand-gold pb-1 inline-block">General Terms & Provisions</h4>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <pre className="text-[10px] text-slate-500 font-medium whitespace-pre-wrap leading-relaxed italic">{terms || DEFAULT_TERMS}</pre>
              </div>
            </div>
            <div className="sm:col-span-5 flex flex-col items-center justify-end space-y-6 pt-10">
               <div className="w-full flex flex-col items-center">
                  <div className="w-48 h-12 flex items-center justify-center italic text-slate-200 font-serif">Signature Area</div>
                  <div className="w-full h-px bg-slate-300"></div>
                  <p className="text-[10px] font-black text-brand-charcoal uppercase tracking-[0.2em] mt-3">Authorized Signatory</p>
                  <p className="text-[9px] text-slate-400 font-medium">Renowix Projects Department</p>
               </div>
               <div className="h-8"></div>
               <div className="text-center">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Thank you for your business</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Footer Action (Browser Only) */}
      <div className="no-print w-full flex justify-center pb-8 safe-bottom">
         <button onClick={handlePrint} className="w-full max-sm h-16 bg-brand-charcoal text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all">
            <Printer size={24} className="text-brand-gold" /> DOWNLOAD QUOTE (PDF)
         </button>
      </div>
    </div>
  );
}

/**
 * Internal Measurement Breakdown Sheet
 */
function MeasurementSheetView({ client, services, onBack }: { client: ClientDetails, services: ActiveService[], onBack: () => void }) {
  return (
    <div className="p-6 pb-32 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 bg-white rounded-xl shadow-sm border border-slate-200"><ArrowLeft size={18} /></button>
        <h2 className="text-lg font-black text-brand-charcoal uppercase tracking-tight">Measurement Sheet</h2>
      </div>
      <div className="space-y-8">
        {services.map(s => (
          <div key={s.instanceId} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-black text-brand-gold text-xs uppercase tracking-[0.2em] mb-6 border-b border-slate-50 pb-4">{s.name}</h3>
            <div className="space-y-6">
              {s.items.map(i => (
                <div key={i.id} className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-800 text-sm">{i.name}</span>
                    <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-500 uppercase">{i.netArea.toFixed(2)} {s.unit}</span>
                  </div>
                  {i.walls && i.walls.length > 0 && (
                    <div className="pl-4 border-l-2 border-slate-100 space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Wall Layout (Height: {i.height}ft)</p>
                      <div className="flex flex-wrap gap-2">
                        {i.walls.map((w, idx) => (
                          <span key={w.id} className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">W{idx+1}: {w.width}ft</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {i.cabinetSections && i.cabinetSections.length > 0 && (
                    <div className="pl-4 border-l-2 border-slate-100 space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Components</p>
                      <div className="space-y-1">
                        {i.cabinetSections.map((sec) => (
                          <div key={sec.id} className="text-[10px] font-bold text-slate-600 flex justify-between">
                            <span>{sec.name}: {sec.l} x {sec.b} ft</span>
                            <span className="text-slate-400">Qty: {sec.q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const [allProjects, setAllProjects] = useState<Project[]>([]); 
  const [allSupervisors, setAllSupervisors] = useState<UserProfile[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<DailyAttendance | null>(null);
  
  const [adminSyncError, setAdminSyncError] = useState<string | null>(null);
  const adminRetryRef = useRef<number>(0);

  // UI States
  const [tempService, setTempService] = useState<Partial<ActiveService> | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<{ sIdx: number; iIdx: number } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectStatus, setCurrentProjectStatus] = useState<'quotation' | 'project'>('quotation');
  const [isEstimateHidden, setIsEstimateHidden] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [saveModal, setSaveModal] = useState<{ show: boolean }>({ show: false });
  const [cameraConfig, setCameraConfig] = useState<{ show: boolean, type: 'labor' | 'selfie' } | null>(null);
  
  // Custom Confirmation Modal State
  const [confirmState, setConfirmState] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Get date ID (YYYY-MM-DD)
  const getTodayId = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  // Handle Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const profileRef = doc(db, 'profiles', currentUser.uid);
          const profileDoc = await getDoc(profileRef);
          
          let role: 'admin' | 'supervisor' = currentUser.email === ADMIN_EMAIL ? 'admin' : 'supervisor';
          
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
            if (!data.role) {
              await updateDoc(profileRef, { role: 'supervisor' });
              data.role = 'supervisor';
            }
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
    setCurrentProject(null);
    setTodayAttendance(null);
    setIsDirty(false);
    adminRetryRef.current = 0;
  };

  /**
   * Dedicated single-document listener for current project
   */
  useEffect(() => {
    if (!currentProjectId) {
      setCurrentProject(null);
      setTodayAttendance(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'projects', currentProjectId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { ...docSnap.data(), id: docSnap.id } as Project;
        setCurrentProject(data);
        if (data.status === 'project') {
          setClient(data.client);
          setServices(data.services);
          setTerms(data.terms || DEFAULT_TERMS);
          setCurrentProjectStatus(data.status);
        }
      }
    }, (err) => {
      console.warn("Project Listener Permission Denied:", err);
    });

    const todayId = getTodayId();
    const unsubAttendance = onSnapshot(doc(db, 'projects', currentProjectId, 'attendance', todayId), (docSnap) => {
      if (docSnap.exists()) {
        setTodayAttendance({ ...docSnap.data(), id: docSnap.id } as DailyAttendance);
      } else {
        setTodayAttendance(null);
      }
    }, (err) => {
      console.warn("Attendance Listener Permission Denied:", err);
    });

    return () => {
      unsub();
      unsubAttendance();
    };
  }, [currentProjectId]);

  // Listener for "My Quotes" (History)
  useEffect(() => {
    if (!user || !userProfile || userProfile.role !== 'supervisor') return;
    const q = query(collection(db, 'projects'), where('surveyorId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Project[];
      const sorted = [...projs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProjects(sorted);
    }, (err) => console.error("History sync error:", err));
    return unsub;
  }, [user, userProfile]);

  // Listener for "Active Tasks"
  useEffect(() => {
    if (!user || !userProfile || userProfile.role !== 'supervisor') return;
    const q = query(collection(db, 'projects'), where('assignedTo', '==', user.uid), where('status', '==', 'project'));
    const unsub = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Project[];
      const sorted = [...projs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAssignedProjects(sorted);
    }, (err) => console.error("Active tasks sync error:", err));
    return unsub;
  }, [user, userProfile]);

  const setupAdminListeners = useCallback(() => {
    if (!user || !userProfile || userProfile.role !== 'admin' || user.email !== ADMIN_EMAIL) return null;
    setAdminSyncError(null);
    const qProjects = query(collection(db, 'projects'));
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Project[];
      const sorted = [...fetched].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAllProjects(sorted);
      adminRetryRef.current = 0;
    }, (err) => {
      if (adminRetryRef.current < 3) {
        adminRetryRef.current++;
        setTimeout(setupAdminListeners, 1500 * adminRetryRef.current);
      } else setAdminSyncError("Inbox Permission Denied: Check Firestore rules.");
    });
    const qUsers = query(collection(db, 'profiles'), where('role', '==', 'supervisor'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as UserProfile[];
      setAllSupervisors(fetched);
    }, (err) => {
      if (adminRetryRef.current >= 3) setAdminSyncError("Team Sync Permission Denied.");
    });
    return () => { unsubProjects(); unsubUsers(); };
  }, [user, userProfile]);

  useEffect(() => {
    const cleanup = setupAdminListeners();
    return () => { if(cleanup) cleanup(); };
  }, [setupAdminListeners]);

  const toggleExpand = (id: string) => {
    setExpandedServices(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBackNavigation = (target: PageView) => {
    if (isDirty && (view === 'dashboard' || view === 'measure')) {
      setConfirmState({
        show: true,
        title: 'Unsaved Changes',
        message: 'Your updates are not synced to the cloud. Exit anyway?',
        type: 'danger',
        onConfirm: () => {
          setView(target);
          setIsDirty(false);
          setConfirmState(prev => ({ ...prev, show: false }));
        }
      });
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
    } catch (e: any) { alert("Cloud error: " + e.message); }
  };

  const handleUpdateProfile = async () => {
    if (!user || !surveyorName) return;
    try {
      const role = user.email === ADMIN_EMAIL ? 'admin' : 'supervisor';
      const profileData: UserProfile = { uid: user.uid, name: surveyorName, email: user.email!, role: role, updatedAt: serverTimestamp() };
      await setDoc(doc(db, 'profiles', user.uid), profileData);
      setUserProfile(profileData);
      setView(role === 'admin' ? 'admin-dashboard' : 'welcome');
    } catch (e: any) { alert(e.message); }
  };

  const loadProject = (p: Project) => {
    setClient(p.client); 
    setServices(p.services); 
    setTerms(p.terms || DEFAULT_TERMS);
    setCurrentProjectStatus(p.status || 'quotation');
    setCurrentProjectId(p.id); 
    setIsDirty(false); 
    setView('dashboard');
  };

  const handleSignOut = () => {
    setConfirmState({
      show: true,
      title: 'Sign Out',
      message: 'Are you sure you want to log out of Surveyor Pro?',
      type: 'info',
      onConfirm: async () => {
        await signOut(auth);
        setConfirmState(prev => ({ ...prev, show: false }));
      }
    });
  };

  /**
   * Attendance Actions
   */
  const handleCheckIn = async () => {
    if (!currentProjectId || !user) return;
    const todayId = getTodayId();
    try {
      await setDoc(doc(db, 'projects', currentProjectId, 'attendance', todayId), {
        checkIn: serverTimestamp(),
        supervisorId: user.uid,
        supervisorName: surveyorName || 'Supervisor',
        id: todayId
      });
    } catch (e: any) { 
      alert("Error checking in: " + e.message + ". Check Firestore rules for sub-collections.");
    }
  };

  const handleCheckOut = async () => {
    if (!currentProjectId) return;
    const todayId = getTodayId();
    try {
      await updateDoc(doc(db, 'projects', currentProjectId, 'attendance', todayId), {
        checkOut: serverTimestamp()
      });
    } catch (e: any) { alert("Error checking out: " + e.message); }
  };

  const handlePhotoCapture = async (base64: string) => {
    if (!currentProjectId || !cameraConfig || !user) return;
    const todayId = getTodayId();
    const type = cameraConfig.type;
    setCameraConfig(null);
    setConfirmState({
      show: true,
      title: 'Optimizing & Saving',
      message: 'Processing site proof. No payment or extra storage needed...',
      onConfirm: () => {},
      type: 'info'
    });

    try {
      // 1. Compress image client-side to keep document size light
      const compressed = await compressImage(base64, 1000, 0.6);

      // 2. Save directly to Firestore Attendance document (Base64)
      await updateDoc(doc(db, 'projects', currentProjectId, 'attendance', todayId), {
        [type === 'labor' ? 'laborPhoto' : 'selfiePhoto']: compressed
      });
      
      setConfirmState(prev => ({ ...prev, show: false }));
    } catch (e: any) {
      alert("Photo save failed: " + e.message);
      setConfirmState(prev => ({ ...prev, show: false }));
    }
  };

  const handleAddService = (catId: string, typeId: string, customName?: string, customDesc?: string) => {
    if (currentProjectStatus === 'project') return alert("Project is locked.");
    const category = SERVICE_DATA[catId];
    if (!category) return;
    const typeDef = category.items.find(i => i.id === typeId);
    const newService: ActiveService = {
      instanceId: Date.now().toString(), categoryId: catId, typeId: typeId,
      name: customName || typeDef?.name || 'New Service',
      desc: customDesc || typeDef?.desc || '',
      unit: (typeDef?.unit || category.unit || 'sqft') as any,
      items: [], isKitchen: typeDef?.type === 'kitchen', isCustom: catId === 'custom', rate: typeDef?.rate || 0
    };
    setServices(prev => [...prev, newService]);
    setExpandedServices(prev => ({ ...prev, [newService.instanceId]: true }));
    setIsDirty(true); setView('dashboard');
  };

  const deleteItem = (sIdx: number, iIdx: number) => {
    if (currentProjectStatus === 'project') return alert("Project is locked.");
    setConfirmState({
      show: true,
      title: 'Delete Section',
      message: 'Remove this measurement section permanently?',
      type: 'danger',
      onConfirm: () => {
        const newServices = [...services];
        newServices[sIdx].items.splice(iIdx, 1);
        setServices(newServices);
        setIsDirty(true);
        setConfirmState(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleSaveMeasurement = (item: MeasurementItem) => {
    if (currentProjectStatus === 'project') return alert("Project is locked.");
    const sIdx = services.findIndex(s => s.instanceId === tempService?.instanceId);
    if (sIdx === -1) return;
    const newServices = [...services];
    if (editingItemIndex !== null) newServices[sIdx].items[editingItemIndex.iIdx] = item;
    else newServices[sIdx].items.push(item);
    setServices(newServices);
    setIsDirty(true); setView('dashboard');
    setTempService(null); setEditingItemIndex(null);
  };

  const handleAdminAssign = async (projId: string, supId: string, milestones: Milestone[]) => {
    try {
      await updateDoc(doc(db, 'projects', projId), { 
        assignedTo: supId, 
        status: 'project', 
        milestones: milestones,
        updatedAt: serverTimestamp() 
      });
      alert("Project converted, milestones set, and assigned successfully.");
    } catch (e: any) { alert("Error: " + e.message); }
  };

  const toggleMilestone = async (milestoneId: string) => {
    if (!currentProject) return;
    const updatedMilestones = currentProject.milestones?.map(m => {
      if (m.id === milestoneId) {
        const newStatus = m.status === 'completed' ? 'pending' : 'completed';
        return { 
          ...m, 
          status: newStatus, 
          completedAt: newStatus === 'completed' ? new Date().toISOString() : null 
        };
      }
      return m;
    }) || [];
    try {
      await updateDoc(doc(db, 'projects', currentProject.id), { 
        milestones: updatedMilestones,
        updatedAt: serverTimestamp() 
      });
    } catch (e: any) { alert("Execution error: " + e.message); }
  };

  const handleDownloadCSV = () => {
    if (!currentProjectId) { alert("Save to cloud first."); return; }
    const content = generateCSV({
      id: currentProjectId, date: new Date().toLocaleDateString(), client, services, terms,
      surveyorId: user?.uid || '', status: currentProjectStatus, createdAt: null
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
        onReview={(p) => { loadProject(p); setView('dashboard'); }}
        onRetrySync={() => setupAdminListeners()}
        onDeleteProject={(id) => {
          setConfirmState({
            show: true, title: 'Delete Project', message: 'Permanently remove this record from cloud?', type: 'danger',
            onConfirm: async () => { await deleteDoc(doc(db, 'projects', id)); setConfirmState(prev => ({ ...prev, show: false })); }
          });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-appBg flex flex-col items-center sm:py-6 text-slate-800 font-sans overflow-x-hidden">
      <div className="w-full max-w-xl bg-cardBg sm:rounded-3xl shadow-prof flex flex-col min-h-screen sm:min-h-[85vh] relative overflow-hidden border border-cardBorder">
        
        {/* Fix: Removed view !== 'quote' check because view === 'quote' is handled via early return, causing a redundant comparison error in TypeScript narrowing. */}
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
              <input type="text" className="w-full h-14 p-4 text-center bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-brand-gold" placeholder="Your Name" value={surveyorName} onChange={e => setSurveyorName(e.target.value)} />
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
                          <div 
                            className="h-full bg-brand-gold transition-all duration-500" 
                            style={{ width: `${(p.milestones.filter(m => m.status === 'completed').length / p.milestones.length) * 100}%` }}
                          />
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
              
              {/* Site Attendance Card */}
              {currentProjectStatus === 'project' && (
                <div className="mb-8 bg-white border border-cardBorder rounded-3xl p-6 shadow-sm border-t-[6px] border-t-brand-gold">
                   <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className="text-sm font-black text-brand-charcoal uppercase tracking-widest">Site Attendance</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{getTodayId()}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${todayAttendance?.checkOut ? 'bg-green-100 text-green-700' : (todayAttendance ? 'bg-brand-gold/10 text-brand-gold' : 'bg-slate-100 text-slate-500')}`}>
                        {todayAttendance?.checkOut ? 'Completed' : (todayAttendance ? 'Checked In' : 'Not Started')}
                      </div>
                   </div>

                   <div className="space-y-4">
                      {!todayAttendance ? (
                        <button 
                          onClick={handleCheckIn}
                          className="w-full h-16 bg-brand-charcoal text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all"
                        >
                          <Smartphone size={20} className="text-brand-gold" /> Check In Now
                        </button>
                      ) : !todayAttendance.checkOut ? (
                        <div className="space-y-4">
                           <div className="grid grid-cols-2 gap-3">
                              <button 
                                onClick={() => setCameraConfig({ show: true, type: 'labor' })}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${todayAttendance.laborPhoto ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-slate-50 hover:border-brand-gold'}`}
                              >
                                {todayAttendance.laborPhoto ? <CheckCircle className="text-green-500" size={24} /> : <Camera size={24} className="text-slate-400" />}
                                <span className="text-[10px] font-black uppercase text-slate-600">Labor Proof</span>
                              </button>
                              <button 
                                onClick={() => setCameraConfig({ show: true, type: 'selfie' })}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${todayAttendance.selfiePhoto ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-slate-50 hover:border-brand-gold'}`}
                              >
                                {todayAttendance.selfiePhoto ? <CheckCircle className="text-green-500" size={24} /> : <User size={24} className="text-slate-400" />}
                                <span className="text-[10px] font-black uppercase text-slate-600">My Selfie</span>
                              </button>
                           </div>
                           <button 
                            onClick={handleCheckOut}
                            className="w-full h-14 bg-brand-gold text-brand-charcoal rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                           >
                             <LogOut size={18} /> Final Check Out
                           </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-4">
                           <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white"><CheckCircle size={24} /></div>
                           <div>
                             <p className="text-xs font-black text-green-700 uppercase tracking-widest">Day Finalized</p>
                             <p className="text-[10px] font-bold text-green-600/60 mt-0.5">Checked out at {new Date(todayAttendance.checkOut?.seconds * 1000).toLocaleTimeString()}</p>
                           </div>
                        </div>
                      )}
                   </div>
                </div>
              )}

              {currentProjectStatus === 'project' && currentProject?.milestones && (
                <div className="mb-8 bg-white border border-cardBorder rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-sm font-black text-brand-charcoal uppercase tracking-widest">Execution Timeline</h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">TAP TO TOGGLE STATUS</p>
                    </div>
                    <div className="bg-brand-gold/10 text-brand-gold px-3 py-1 rounded-full text-xs font-black">
                      {Math.round((currentProject.milestones.filter(m => m.status === 'completed').length / currentProject.milestones.length) * 100)}%
                    </div>
                  </div>
                  
                  <div className="relative pl-6 border-l-2 border-slate-100 space-y-6">
                    {currentProject.milestones.map((m, idx) => (
                      <div key={m.id} className="relative">
                        <div className={`absolute -left-[2.05rem] top-1.5 w-4 h-4 rounded-full border-2 bg-white transition-all ${m.status === 'completed' ? 'border-brand-gold bg-brand-gold shadow-[0_0_8px_rgba(212,175,55,0.4)]' : 'border-slate-200'}`}>
                          {m.status === 'completed' && <CheckCircle size={10} className="text-white mx-auto mt-0.5" />}
                        </div>
                        <button 
                          onClick={() => toggleMilestone(m.id)}
                          className={`w-full text-left p-4 rounded-2xl border transition-all ${m.status === 'completed' ? 'bg-brand-gold/5 border-brand-gold/20' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200'}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className={`font-bold text-sm ${m.status === 'completed' ? 'text-brand-charcoal' : 'text-slate-500'}`}>{m.name}</span>
                            <span className={`text-[9px] font-black uppercase tracking-wider ${m.status === 'completed' ? 'text-brand-gold' : 'text-slate-300'}`}>
                              {m.status === 'completed' ? 'Completed' : 'Pending'}
                            </span>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentProjectStatus === 'project' && (
                <div className="mb-6 p-4 bg-yellow-50 border border-brand-gold/20 rounded-xl flex items-center gap-3">
                  <Lock className="text-brand-gold shrink-0" size={20} /><p className="text-[11px] font-bold text-slate-600 uppercase">This project is locked by Admin.</p>
                </div>
              )}
              <div className="mt-4 space-y-6">
                {services.map((s, sIdx) => {
                  const isExpanded = expandedServices[s.instanceId];
                  return (
                    <div key={s.instanceId} className="bg-cardBg rounded-xl shadow-prof border border-cardBorder overflow-hidden">
                      <div className="p-4 border-b border-cardBorder flex justify-between items-center cursor-pointer" onClick={() => toggleExpand(s.instanceId)}>
                        <div className="flex items-center gap-3"><ServiceIcon categoryId={s.categoryId} typeId={s.typeId} />
                          <div><h4 className="font-bold text-[15px] text-brand-charcoal leading-tight">{s.name}</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.items.reduce((a,b)=>a+b.netArea,0).toFixed(2)} {s.unit}</p></div>
                        </div>
                        <div className="flex items-center gap-3"><span className={`font-black text-brand-charcoal text-sm ${isEstimateHidden ? 'masked-estimate' : ''}`}>₹{Math.round(s.items.reduce((a,b)=>a+b.cost,0)).toLocaleString()}</span>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                      </div>
                      {isExpanded && (
                        <div className="divide-y divide-cardBorder bg-slate-50/30">
                          {s.items.map((item, iIdx) => (
                            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-white">
                               <div><p className="font-bold text-slate-700 text-sm">{item.name}</p><p className="text-[10px] text-slate-400">₹{item.rate} / {s.unit}</p></div>
                               <div className="flex items-center gap-2"><span className={`font-bold text-brand-charcoal text-sm ${isEstimateHidden ? 'masked-estimate' : ''}`}>₹{Math.round(item.cost).toLocaleString()}</span>
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

      {cameraConfig?.show && (
        <RealTimeCamera 
          mode={cameraConfig.type === 'selfie' ? 'user' : 'environment'}
          onCapture={handlePhotoCapture} 
          onClose={() => setCameraConfig(null)} 
        />
      )}

      {/* CUSTOM CONFIRM MODAL */}
      {confirmState.show && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${confirmState.type === 'danger' ? 'bg-red-50 text-brand-red' : 'bg-blue-50 text-brand-blue'}`}>
                {confirmState.type === 'danger' ? <AlertTriangle size={24} /> : (confirmState.title === 'Optimizing & Saving' ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle size={24} />)}
              </div>
              <h3 className="text-xl font-black text-brand-charcoal">{confirmState.title}</h3>
            </div>
            <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">{confirmState.message}</p>
            {confirmState.title !== 'Optimizing & Saving' && (
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirmState(prev => ({ ...prev, show: false }))} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
                <button type="button" onClick={confirmState.onConfirm} className={`flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all ${confirmState.type === 'danger' ? 'bg-brand-red shadow-lg shadow-red-200' : 'bg-brand-charcoal shadow-lg shadow-slate-200'}`}>Confirm</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ projects, supervisors, syncError, onSignOut, onAssign, onReview, onRetrySync, onDeleteProject }: { projects: Project[], supervisors: UserProfile[], syncError: string|null, onSignOut: () => void, onAssign: (pid: string, sid: string, milestones: Milestone[]) => void, onReview: (p: Project) => void, onRetrySync: () => void, onDeleteProject: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<'quotes' | 'supervisors' | 'attendance'>('quotes');
  const [assignModal, setAssignModal] = useState<Project | null>(null);
  const [selectedSup, setSelectedSup] = useState<UserProfile | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<Record<string, DailyAttendance[]>>({});
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: '1', name: 'Site Mobilization', status: 'pending' },
    { id: '2', name: 'Civil & Structural Work', status: 'pending' },
    { id: '3', name: 'MEP (Electrical & Plumbing)', status: 'pending' },
    { id: '4', name: 'Finishing & Painting', status: 'pending' },
    { id: '5', name: 'Handover & Signoff', status: 'pending' }
  ]);
  const [newMilestoneName, setNewMilestoneName] = useState('');

  const pendingQuotes = projects.filter(p => p.status === 'quotation' || !p.status);
  const activeProjects = projects.filter(p => p.status === 'project');

  useEffect(() => {
    if (activeTab === 'attendance') {
      activeProjects.forEach(async p => {
        try {
          const attCol = collection(db, 'projects', p.id, 'attendance');
          const q = query(attCol, orderBy('checkIn', 'desc'));
          const snap = await getDocs(q);
          const logs = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as DailyAttendance));
          setAttendanceLogs(prev => ({ ...prev, [p.id]: logs }));
        } catch (e) {
          console.warn(`Could not fetch attendance for project ${p.id}:`, e);
        }
      });
    }
  }, [activeTab, activeProjects]);

  const addMilestone = () => {
    if (!newMilestoneName.trim()) return;
    setMilestones([...milestones, { id: Date.now().toString(), name: newMilestoneName, status: 'pending' }]);
    setNewMilestoneName('');
  };

  const removeMilestone = (id: string) => {
    setMilestones(milestones.filter(m => m.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <nav className="bg-brand-charcoal text-white px-4 sm:px-8 py-4 flex justify-between items-center shadow-xl sticky top-0 z-[200]">
        <div className="flex items-center gap-3"><img src={LOGO_URL} className="h-8 sm:h-10" alt="Renowix" /><div className="h-6 w-px bg-white/20 mx-1 sm:mx-2"></div><span className="font-display font-black text-sm sm:text-xl tracking-tight uppercase">Admin</span></div>
        <div className="flex items-center gap-2 sm:gap-4"><button onClick={onRetrySync} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-brand-gold"><RefreshCw size={18} /></button>
           <button onClick={onSignOut} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-white/10"><LogOut size={14} className="text-brand-gold" /> Out</button>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {syncError && (
          <div className="mb-6 p-5 bg-red-50 border-2 border-red-100 rounded-3xl flex flex-col sm:flex-row items-center gap-4 text-brand-red">
            <div className="p-3 bg-red-100 rounded-full"><AlertTriangle size={24} /></div>
            <div className="flex-1 text-center sm:text-left">
              <p className="font-black uppercase text-[10px] tracking-widest mb-1">Database Access Error</p>
              <p className="font-bold text-sm leading-tight">{syncError}</p>
            </div>
            <button onClick={onRetrySync} className="bg-brand-red text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em]">Force Refresh</button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10"><StatCard icon={<FileText />} label="Quotations" value={pendingQuotes.length} color="bg-blue-500" /><StatCard icon={<CheckCircle />} label="Active Tasks" value={activeProjects.length} color="bg-brand-gold" /><StatCard icon={<Users />} label="Supervisors" value={supervisors.length} color="bg-slate-700" /></div>
        
        <div className="flex overflow-x-auto no-scrollbar gap-2 sm:gap-4 mb-8">
          <button onClick={() => setActiveTab('quotes')} className={`flex-none px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'quotes' ? 'bg-brand-charcoal text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}><LayoutDashboard size={16} /> Inbox</button>
          <button onClick={() => setActiveTab('attendance')} className={`flex-none px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'attendance' ? 'bg-brand-charcoal text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}><Clock size={16} /> Attendance</button>
          <button onClick={() => setActiveTab('supervisors')} className={`flex-none px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'supervisors' ? 'bg-brand-charcoal text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}><Users size={16} /> Team</button>
        </div>

        {activeTab === 'quotes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow relative">
                <button onClick={() => onDeleteProject(p.id)} className="absolute top-4 right-4 text-slate-300 hover:text-brand-red transition-all"><X size={16} /></button>
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-3"><div><h3 className="font-black text-lg text-brand-charcoal leading-tight">{p.client.name}</h3><p className="text-xs text-slate-400 font-bold uppercase mt-0.5">{p.date.split(',')[0]}</p></div>
                     <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${p.status === 'project' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status || 'Quotation'}</span>
                  </div>
                  {p.milestones && (
                    <div className="mb-4 space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Project Progress</span>
                        <span>{Math.round((p.milestones.filter(m => m.status === 'completed').length / p.milestones.length) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-gold transition-all duration-700" 
                          style={{ width: `${(p.milestones.filter(m => m.status === 'completed').length / p.milestones.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2"><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><User size={12} className="text-brand-gold" /><span>Surveyor: <span className="text-slate-800">{p.surveyorName || 'Unknown'}</span></span></div><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><MapPin size={12} className="text-brand-gold" /><span className="truncate">{p.client.address || 'No Address'}</span></div></div>
                </div>
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex flex-col"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Value</p><p className="font-black text-brand-charcoal text-lg">₹{Math.round(p.services.reduce((s, ser) => s + ser.items.reduce((is, i) => is + i.cost, 0), 0)).toLocaleString()}</p></div>
                  <div className="flex gap-2"><button onClick={() => onReview(p)} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-brand-blue hover:text-white transition-all"><Eye size={18} /></button>
                    {p.status !== 'project' && (<button onClick={() => setAssignModal(p)} className="bg-brand-charcoal text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Assign</button>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-6">
            {activeProjects.map(p => (
              <div key={p.id} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-lg text-brand-charcoal leading-none">{p.client.name}</h3>
                    <p className="text-[10px] font-black uppercase text-slate-400 mt-1.5 tracking-widest">Attendance Logs</p>
                  </div>
                  <div className="bg-brand-gold text-brand-charcoal px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">Active Project</div>
                </div>
                <div className="p-6">
                   {!attendanceLogs[p.id] || attendanceLogs[p.id]?.length === 0 ? (
                     <p className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest">No logs yet for this site</p>
                   ) : (
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="border-b border-slate-100">
                                 <th className="py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</th>
                                 <th className="py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Check In</th>
                                 <th className="py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Check Out</th>
                                 <th className="py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Visual Proof</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {attendanceLogs[p.id]?.map(log => (
                                <tr key={log.id} className="group">
                                   <td className="py-4">
                                      <p className="font-bold text-slate-800 text-sm">{log.id}</p>
                                   </td>
                                   <td className="py-4">
                                      <p className="font-black text-brand-charcoal text-xs">{log.checkIn ? new Date(log.checkIn.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</p>
                                   </td>
                                   <td className="py-4">
                                      <p className="font-black text-brand-charcoal text-xs">{log.checkOut ? new Date(log.checkOut.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}</p>
                                   </td>
                                   <td className="py-4">
                                      <div className="flex gap-2">
                                        {log.laborPhoto ? (
                                          <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
                                             <img src={log.laborPhoto} className="w-full h-full object-cover" alt="labor" onClick={() => {
                                                const win = window.open();
                                                win?.document.write(`<img src="${log.laborPhoto}" style="max-width:100%">`);
                                             }} />
                                          </div>
                                        ) : <div className="w-10 h-10 rounded-lg bg-slate-50 border border-dashed border-slate-200" />}
                                        {log.selfiePhoto ? (
                                          <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
                                             <img src={log.selfiePhoto} className="w-full h-full object-cover" alt="selfie" onClick={() => {
                                                const win = window.open();
                                                win?.document.write(`<img src="${log.selfiePhoto}" style="max-width:100%">`);
                                             }} />
                                          </div>
                                        ) : <div className="w-10 h-10 rounded-lg bg-slate-50 border border-dashed border-slate-200" />}
                                      </div>
                                   </td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                   )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'supervisors' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {supervisors.map((s) => (
              <div key={s.uid} className="bg-white p-6 rounded-3xl shadow-prof border border-slate-200">
                <div className="flex items-center gap-4 mb-6"><div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-xl shadow-inner border border-slate-200/50">{(s.name || s.email).charAt(0).toUpperCase()}</div>
                  <div><h3 className="font-bold text-lg text-brand-charcoal leading-none">{s.name || "Pending Setup"}</h3><p className="text-xs text-slate-400 mt-1 font-medium">{s.email}</p></div>
                </div>
                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <div className="text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Task</p><p className="text-xl font-black text-brand-gold">{projects.filter(p => p.assignedTo === s.uid).length}</p></div>
                  <div className="text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quotes Built</p><p className="text-xl font-black text-brand-charcoal">{projects.filter(p => p.surveyorId === s.uid).length}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {assignModal && (
        <div className="fixed inset-0 z-[300] bg-brand-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-6 sm:p-10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl sm:text-3xl font-display font-black text-brand-charcoal mb-1">Launch Project</h3>
                <p className="text-slate-400 text-sm font-medium">Setting up execution plan for <span className="text-brand-charcoal font-bold">{assignModal.client.name}</span></p>
              </div>
              <button onClick={() => { setAssignModal(null); setSelectedSup(null); }} className="p-2 text-slate-300 hover:text-brand-red"><X size={24} /></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto no-scrollbar flex-1 pb-4 pr-2">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">1. Select Supervisor</label>
                  <div className="space-y-2">
                    {supervisors.map(s => (
                      <button 
                        key={s.uid} 
                        onClick={() => setSelectedSup(s)} 
                        className={`w-full p-4 flex items-center gap-4 border-2 rounded-2xl transition-all text-left group ${selectedSup?.uid === s.uid ? 'border-brand-gold bg-brand-gold/5 shadow-md' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm transition-colors ${selectedSup?.uid === s.uid ? 'bg-brand-gold text-white' : 'bg-white text-slate-400'}`}>{(s.name || s.email).charAt(0).toUpperCase()}</div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-slate-800 leading-none truncate">{s.name || s.email}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-black mt-1.5 tracking-wider truncate">{s.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">2. Project Milestones</label>
                  <div className="space-y-2 mb-4">
                    {milestones.map((m, idx) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl group animate-in slide-in-from-right-4" style={{ animationDelay: `${idx * 50}ms` }}>
                        <div className="w-6 h-6 rounded-lg bg-brand-gold/10 text-brand-gold flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</div>
                        <span className="flex-1 text-sm font-bold text-slate-700 truncate">{m.name}</span>
                        <button onClick={() => removeMilestone(m.id)} className="p-1.5 text-slate-300 hover:text-brand-red transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add custom milestone..." 
                      className="flex-1 h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-gold text-sm font-medium"
                      value={newMilestoneName}
                      onChange={e => setNewMilestoneName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addMilestone()}
                    />
                    <button onClick={addMilestone} className="w-12 h-12 bg-brand-charcoal text-white rounded-xl flex items-center justify-center hover:bg-slate-800 shadow-lg active:scale-95 transition-all"><Plus size={20} /></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
              <button 
                disabled={!selectedSup || milestones.length === 0}
                onClick={() => { onAssign(assignModal.id, selectedSup!.uid, milestones); setAssignModal(null); setSelectedSup(null); }} 
                className="w-full h-16 bg-brand-gold text-brand-charcoal rounded-2xl font-black text-lg shadow-xl shadow-brand-gold/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
              >
                <Trophy size={24} /> Confirm & Launch Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: number, color: string }) {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-prof border border-slate-200 flex items-center gap-4 sm:gap-6">
      <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${color} text-white flex items-center justify-center shadow-lg shadow-${color}/20 shrink-0`}>{React.cloneElement(icon, { size: 24 })}</div>
      <div><p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</p><p className="text-xl sm:text-3xl font-black text-brand-charcoal leading-none mt-1">{value}</p></div>
    </div>
  );
}

function AuthView({ onComplete }: { onComplete: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (isLogin) await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      onComplete();
    } catch (err: any) { 
      let msg = err.message.replace('Firebase: ', '');
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) msg = "Invalid password.";
      setError(msg); 
    } finally { setLoading(false); }
  };
  useEffect(() => { if (isAdminMode) { setEmail(ADMIN_EMAIL); setIsLogin(true); } else { setEmail(''); } }, [isAdminMode]);
  return (
    <div className="min-h-screen bg-brand-charcoal flex items-center justify-center p-4">
      <div className="w-full max-sm bg-white rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8"><img src={LOGO_URL} alt="Renowix" className="h-14 mx-auto mb-4 object-contain" />
          <h2 className="text-xl font-display font-black text-brand-charcoal">{isAdminMode ? 'Admin Access' : (isLogin ? 'Supervisor Login' : 'Supervisor Signup')}</h2>
        </div>
        {error && (<div className="mb-6 p-4 bg-red-50 text-brand-red rounded-xl text-xs font-bold border border-red-100 leading-relaxed"><div className="flex items-center gap-2 mb-1 uppercase tracking-widest"><AlertTriangle size={12} /> System Alert</div>{error}</div>)}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            {isAdminMode ? (<div className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center text-slate-500 font-bold">{ADMIN_EMAIL}</div>) : 
            (<input type="email" required className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold transition-colors" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />)}
          </div>
          <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="password" required className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-brand-gold transition-colors" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <button type="submit" disabled={loading} className="w-full h-14 bg-brand-charcoal text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}{isLogin ? 'Sign In' : 'Register Now'}</button>
        </form>
        <div className="mt-8 flex flex-col gap-3 items-center">
          {!isAdminMode && (<button type="button" onClick={() => setIsLogin(!isLogin)} className="text-xs font-black text-brand-gold uppercase tracking-widest hover:text-yellow-600 transition-colors">{isLogin ? "Supervisor Signup" : "Back to Login"}</button>)}
          <div className="h-px w-1/2 bg-slate-100 my-1"></div>
          <button type="button" onClick={() => setIsAdminMode(!isAdminMode)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest underline decoration-2 underline-offset-4 hover:text-brand-charcoal transition-colors">{isAdminMode ? "Switch to Supervisor Mode" : "Admin Console Access"}</button>
        </div>
      </div>
    </div>
  );
}

function ServiceIcon({ categoryId, typeId }: { categoryId: string, typeId: string }) {
  const Icon = categoryId === 'painting' ? PaintRoller : (typeId === 'kitchen_mod' ? Utensils : (typeId === 'tv_unit' ? Monitor : Hammer));
  return (<div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-700 border border-cardBorder shadow-sm shrink-0"><Icon size={18} /></div>);
}

function Header({ title, onBack }: { title: string, onBack: () => void }) {
  return (<div className="flex items-center gap-4 py-1 mb-3"><button type="button" onClick={onBack} className="p-2.5 text-slate-400 bg-white shadow-prof border border-cardBorder rounded-lg"><ArrowLeft size={18} /></button><h1 className="font-display font-black text-[16px] sm:text-[18px] text-brand-charcoal uppercase truncate">{title}</h1></div>);
}

function Footer({ children, className = "" }: { children?: React.ReactNode, className?: string }) {
  return (<div className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 backdrop-blur-md p-4 border-t border-cardBorder z-[100] safe-bottom shadow-2xl ${className}`}>{children}</div>);
}

function InputGroup({ label, children }: { label: string, children?: React.ReactNode }) {
  return (<div className="space-y-1.5"><label className="text-[14px] font-bold text-slate-400 uppercase tracking-widest ml-1">{label}</label>{children}</div>);
}

/**
 * Service Selector Component
 */
function ServiceSelector({ onBack, onSelect }: { onBack: () => void, onSelect: (c:string, t:string, customN?:string, customD?:string) => void }) {
  const [cat, setCat] = useState(''); const [type, setType] = useState('');
  const [customName, setCustomName] = useState(''); const [description, setDescription] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  useEffect(() => { if (cat === 'custom') setType('custom_item'); else setType(''); }, [cat]);
  useEffect(() => { if (cat && type && cat !== 'custom') { const typeItem = SERVICE_DATA[cat]?.items.find(i => i.id === type); if (typeItem) setDescription(typeItem.desc); } }, [cat, type]);
  const handleAiRewrite = async () => {
    if (!description.trim()) return; setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Restructure this into a professional 3-line description for a quotation: "${description}"` });
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
              <div className="w-12 h-12 rounded-2xl bg-slate-50 text-brand-gold flex items-center justify-center border border-slate-100 shadow-sm">
                <ServiceIcon categoryId={c.id} typeId="" />
              </div>
              <span className="font-black text-[12px] uppercase tracking-wider text-brand-charcoal">{c.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6 mt-4">
          <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
            <button onClick={() => setCat('')} className="p-2 text-slate-400 bg-white rounded-lg shadow-sm">
              <ArrowLeft size={14} />
            </button>
            <span className="font-black uppercase text-[10px] text-slate-600 tracking-[0.15em] ml-2">{SERVICE_DATA[cat]?.name}</span>
          </div>
          
          <div className="space-y-3">
            {cat === 'custom' ? (
              <div className="bg-cardBg p-5 rounded-2xl border border-cardBorder shadow-prof">
                <InputGroup label="Custom Name">
                  <input 
                    type="text" 
                    className="w-full h-12 px-4 border rounded-xl font-bold bg-slate-50 focus:bg-white focus:border-brand-gold transition-all" 
                    value={customName} 
                    onChange={e => setCustomName(e.target.value)} 
                    placeholder="Service Name" 
                  />
                </InputGroup>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {SERVICE_DATA[cat].items.map(i => (
                  <button 
                    key={i.id} 
                    onClick={() => setType(i.id)} 
                    className={`p-4 rounded-2xl border text-left transition-all ${type === i.id ? 'bg-brand-gold/10 border-brand-gold ring-1 ring-brand-gold shadow-md' : 'bg-white border-cardBorder'}`}
                  >
                    <h4 className="font-black text-brand-charcoal text-[13px] uppercase tracking-tight">{i.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-bold uppercase tracking-widest">Base Rate: ₹{i.rate}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {(type || cat === 'custom') && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-cardBorder shadow-inner animate-in fade-in slide-in-from-bottom-2">
              <InputGroup label="Service Description">
                <textarea 
                  rows={5} 
                  className="w-full p-4 bg-white border border-inputBorder rounded-xl outline-none text-xs leading-relaxed focus:border-brand-gold" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                />
                <button 
                  type="button" 
                  onClick={handleAiRewrite} 
                  disabled={isAiLoading} 
                  className="mt-3 w-full h-12 bg-brand-charcoal text-white rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-xl hover:bg-slate-800 transition-all"
                >
                  {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-brand-gold" />} 
                  AI Optimize
                </button>
              </InputGroup>
            </div>
          )}
        </div>
      )}
      <Footer>
        <button 
          type="button" 
          onClick={() => onSelect(cat, type, customName, description)} 
          disabled={!cat || (!type && cat !== 'custom')} 
          className="w-full h-14 bg-brand-charcoal text-white rounded-xl font-black shadow-2xl active:scale-95 transition-all"
        >
          Continue to Measures
        </button>
      </Footer>
    </div>
  );
}

function SliderInput({ value, onChange, min, max, label, step = 0.5 }: { value: number, onChange: (v: number) => void, min: number, max: number, label: string, step?: number }) {
  return (
    <div className="space-y-2 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</label><div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm"><span className="text-[14px] font-black text-brand-charcoal">{value}</span><span className="text-[10px] font-black text-slate-300 uppercase">ft</span></div></div><div className="relative flex items-center h-6"><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-gold" /></div></div>
  );
}

function MeasurementForm({ serviceContext, editingItem, onBack, onSave }: { serviceContext: Partial<ActiveService>, editingItem?: MeasurementItem, onBack: () => void, onSave: (item: MeasurementItem) => void }) {
  const [name, setName] = useState(editingItem?.name || '');
  const [rate, setRate] = useState<number>(editingItem?.rate || serviceContext.rate || 0);
  const [walls, setWalls] = useState<Wall[]>(editingItem?.walls || []);
  const [cabinetSections, setCabinetSections] = useState<CabinetSection[]>(editingItem?.cabinetSections || []);
  const [height, setHeight] = useState<number>(editingItem?.height || 9);
  const isWoodwork = serviceContext.categoryId === 'woodwork' || serviceContext.isCustom || serviceContext.isKitchen;
  useEffect(() => { if (!editingItem) { if (serviceContext.categoryId === 'painting' && walls.length === 0) setWalls([1,2,3,4].map(id => ({id: id.toString(), width: 0}))); if (isWoodwork && cabinetSections.length === 0) setCabinetSections([{ id: Date.now().toString(), name: 'Section 1', l: 0, b: 0, q: 1 }]); } }, [editingItem, serviceContext.categoryId, isWoodwork, walls.length, cabinetSections.length]);
  const calculateTotal = (): number => {
    if (isWoodwork) return cabinetSections.reduce((acc, s) => acc + ((s.l || 0) * (s.b || 0) * (s.q || 1)), 0);
    if (serviceContext.categoryId === 'painting') return (walls.reduce((s, w) => s + (w.width || 0), 0) * height);
    return 1;
  };
  const netArea = calculateTotal(); const cost = netArea * rate;
  return (
    <div className="flex flex-col min-h-full relative bg-appBg"><div className="p-4 sm:p-6 flex-1 overflow-y-auto no-scrollbar"><Header title={serviceContext.name || "Measurement"} onBack={onBack} /><div className="space-y-6 pb-64 mt-4"><div className="bg-cardBg p-5 rounded-2xl border border-cardBorder shadow-prof space-y-5"><InputGroup label="ROOM / SECTION NAME"><input className="w-full h-12 px-4 border border-inputBorder rounded-xl font-black bg-slate-50 focus:bg-white focus:border-brand-gold transition-all" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Master Bedroom" /></InputGroup><div className="grid grid-cols-2 gap-4"><InputGroup label="RATE (₹)"><input type="number" className="w-full h-12 px-4 border border-inputBorder rounded-xl font-black bg-slate-50" value={rate || ''} onChange={e => setRate(parseFloat(e.target.value) || 0)} /></InputGroup>{serviceContext.categoryId === 'painting' && (<div className="space-y-1.5"><label className="text-[14px] font-bold text-slate-400 uppercase tracking-widest ml-1">Height (ft)</label><input type="number" className="w-full h-12 px-4 border border-inputBorder rounded-xl font-black bg-slate-50" value={height} onChange={e => setHeight(parseFloat(e.target.value) || 0)}/></div>)}</div></div>
          {isWoodwork ? (<div className="space-y-4"><span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block">Component Dimensions</span>{cabinetSections.map((s, idx) => (<div key={s.id} className="bg-cardBg p-5 rounded-2xl border border-cardBorder shadow-prof space-y-4 relative overflow-hidden">{cabinetSections.length > 1 && (<button onClick={() => setCabinetSections(cabinetSections.filter(sec => sec.id !== s.id))} className="absolute top-4 right-4 text-brand-red p-2 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>)}<h4 className="font-black text-xs uppercase text-brand-charcoal tracking-widest">{s.name}</h4><div className="space-y-4"><SliderInput label="Length" value={s.l} min={0} max={20} onChange={(v) => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, l: v} : sec))} /><SliderInput label="Width" value={s.b} min={0} max={10} onChange={(v) => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, b: v} : sec))} /><div className="flex items-center justify-between p-4 bg-slate-100 rounded-2xl border border-slate-200"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Quantity</label><div className="flex items-center gap-3"><button onClick={() => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, q: Math.max(1, sec.q - 1)} : sec))} className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-200">-</button><span className="font-black text-brand-charcoal w-6 text-center">{s.q}</span><button onClick={() => setCabinetSections(cabinetSections.map(sec => sec.id === s.id ? {...sec, q: sec.q + 1} : sec))} className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-200">+</button></div></div></div></div>))}
              <button type="button" onClick={() => setCabinetSections([...cabinetSections, { id: Date.now().toString(), name: `Component ${cabinetSections.length + 1}`, l: 0, b: 0, q: 1 }])} className="w-full h-12 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-brand-gold hover:text-brand-gold transition-all">+ Add Component</button></div>) : 
            (<div className="space-y-6"><div className="bg-cardBg p-5 rounded-2xl shadow-prof border border-cardBorder"><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5 block">Wall Width Measurements</span><div className="space-y-4">{walls.map((w, idx) => (<SliderInput key={w.id} label={`Wall ${idx+1}`} value={w.width} min={0} max={30} onChange={(v) => { const nw = [...walls]; nw[idx].width = v; setWalls(nw); }} />))}<button type="button" onClick={() => setWalls([...walls, { id: Date.now().toString(), width: 0 }])} className="w-full h-10 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-300 hover:border-brand-gold hover:text-brand-gold transition-all">+ Add Wall</button></div></div></div>)}
        </div></div><div className="fixed bottom-0 left-0 right-0 z-[110] w-full flex justify-center p-4 safe-bottom"><div className="w-full max-w-xl flex flex-col gap-2"><div className="flex justify-between items-center bg-brand-charcoal text-white py-4 px-6 rounded-2xl shadow-2xl border border-white/5"><div><p className="text-[9px] opacity-50 uppercase tracking-[0.2em]">FINAL QTY</p><p className="font-extrabold text-brand-gold text-lg">{netArea.toFixed(2)} {serviceContext.unit}</p></div><div className="text-right"><p className="text-[9px] opacity-50 uppercase tracking-[0.2em]">ITEM TOTAL</p><p className="font-extrabold text-brand-gold text-lg">₹{Math.round(cost).toLocaleString()}</p></div></div><button type="button" onClick={() => onSave({ id: editingItem?.id || Date.now().toString(), name: name || "Room", netArea, rate, cost, height, walls, cabinetSections })} className="w-full h-14 bg-brand-charcoal text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"><CheckCircle size={22} className="text-brand-gold" /> Save Item</button></div></div></div>
  );
}
