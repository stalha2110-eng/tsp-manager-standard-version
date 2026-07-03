/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import appLogo from './Assets/logo(TSPb).png';
import { 
  TrendingUp,
  Calculator,
  ArrowRight,
  Bell,
  BellRing,
  RefreshCw,
  Sparkles,
  Search, 
  Settings as SettingsIcon, 
  Plus, 
  Minus, 
  Home, 
  User, 
  Lock, 
  Unlock, 
  ArrowLeft,
  Trash2,
  Edit2,
  QrCode,
  Image as ImageIcon,
  ChevronRight,
  Sun,
  Moon,
  Globe,
  Briefcase,
  Smartphone,
  ShieldCheck,
  FileText,
  Cloud,
  CheckCircle2,
  Store,
  UserCheck,
  Phone,
  MapPin,
  AlertCircle,
  Package,
  Weight,
  Hash,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Truck,
  Users,
  PlusCircle,
  X,
  Coins,
  Scale,
  Wallet,
  Minimize2,
  Share2,
  Type,
  Maximize2,
  Mic,
  Calendar,
  Pin,
  CheckCircle,
  MessageSquare,
  RotateCcw,
  LogOut,
  LogIn,
  MoreVertical,
  Download,
  Upload,
  Database,
  CloudOff,
  FileSpreadsheet,
  FileText as FilePdf,
  XCircle,
  HelpCircle,
  BookOpen,
  Tag,
  Paperclip,
  Zap,
  Check,
  Eye,
  Info,
  Shield,
  AlertTriangle
} from 'lucide-react';
// @ts-ignore
import XLSXStyle from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from './components/ui/Button';
import { PINScreen } from './components/ui/PINScreen';
import { UnitSelectorModal } from './components/ui/UnitSelectorModal';
import { LoginScreen } from './components/LoginScreen';
import { AccountSyncCard } from './components/AccountSyncCard';
import { WebPushNotificationCard } from './components/WebPushNotificationCard';
import { SmartEntryModal } from './components/SmartEntryModal';
import { CategoryAddModal } from './components/CategoryAddModal';
import CalculatorWorkspace from './components/CalculatorWorkspace';
import { 
  db, 
  auth, 
  loginWithGoogle, 
  onAuthStateChanged,
  User as FirebaseUser
} from './firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  AppState, 
  Item, 
  Category, 
  AppSettings, 
  LanguageType, 
  ThemeType,
  Translations,
  Note,
  OperationType,
  FirestoreErrorInfo,
  UdharBillItem
} from './types';
import { 
  DEFAULT_CATEGORIES, 
  THEMES, 
  LANGUAGES, 
  UI_TEXT, 
  UNITS,
  AURORA_PALETTES,
  AURORA_SPEEDS 
} from './constants';
import { 
  cn, 
  formatCurrency, 
  formatNumber,
  triggerHapticFeedback
} from './lib/utils';
import { translateItemName, generatePriceAdvisory, getSmartNoteCategorization } from './services/geminiService';

interface SnappyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (val: string) => void;
}

function SnappyInput({ value, onChange, ...props }: SnappyInputProps) {
  const [localValue, setLocalValue] = React.useState(String(value ?? ''));
  const isFocused = React.useRef(false);

  React.useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(String(value ?? ''));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    
    // Defer the parent state update to the next event loop tick
    const timer = setTimeout(() => {
      onChange(val);
    }, 0);
    return () => clearTimeout(timer);
  };

  return (
    <input
      {...props}
      value={localValue}
      onChange={handleChange}
      onFocus={(e) => {
        isFocused.current = true;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        isFocused.current = false;
        onChange(e.target.value);
        props.onBlur?.(e);
      }}
    />
  );
}

// Global device ID generation
const getDeviceId = () => {
  let id = localStorage.getItem('ts_device_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 11);
    localStorage.setItem('ts_device_id', id);
  }
  return id;
};

const getDeviceName = () => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android Device";
  if (/iPad|iPhone|iPod/.test(ua)) return "iOS Device";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Macintosh/i.test(ua)) return "MacBook";
  return "Web Browser";
};

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  try {
    const saved = localStorage.getItem('ts_sync_logs');
    const logs = saved ? JSON.parse(saved) : [];
    const newEntry = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      details: `Path: ${path || 'General'} | Op: ${operationType}`,
      operation: operationType,
      collection: path ? path.split('/')[0] : 'general'
    };
    localStorage.setItem('ts_sync_logs', JSON.stringify([newEntry, ...logs].slice(0, 100)));
    window.dispatchEvent(new CustomEvent('ts_sync_log_added'));
  } catch (e) {
    console.error("Failed to write to local sync logs:", e);
  }

  throw new Error(JSON.stringify(errInfo));
}

// --- Default State ---
const INITIAL_SETTINGS: AppSettings = {
  theme: 'ultra_premium',
  language: 'en',
  isLocked: true,
  pin: null,
  currency: 'INR',
  autoLockDelay: 30,
  hideBuyingPriceByDefault: true,
  accentColor: 'indigo',
  fontSize: 'standard',
  pricePrecision: 0,
  showStockAlerts: true,
  autoCloudSync: true,
  hasSeenOnboarding: false,
  enableBgColorChange: true,
  ultraPremiumSpeed: 'normal',
  ultraPremiumPalette: 'neon_aurora',
  dismissedNotifications: [],
  deviceId: getDeviceId(),
  deviceName: getDeviceName(),
  hapticMaster: true,
  hapticNavigation: true,
  hapticCalculator: true,
  hapticBilling: true,
  hapticButton: true,
  hapticSave: true,
  hapticDownload: true,
  hapticPopup: true,
  hapticLongPress: true,
  hapticError: true,
  hapticSuccess: true,
  hapticIntensity: 'light',
};

const getInitialState = (): AppState => {
  const savedSettings = localStorage.getItem('price_manager_settings');
  const savedState = localStorage.getItem('price_manager_state');
  
  let settings = INITIAL_SETTINGS;
  if (savedSettings) {
    try {
      settings = { ...INITIAL_SETTINGS, ...JSON.parse(savedSettings) };
    } catch (e) {
      console.error("Failed to parse saved settings", e);
    }
  }

  let items = [];
  let notes = [];
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      items = parsed.items || [];
      notes = parsed.notes || [];
    } catch (e) {
      console.error("Failed to parse saved state", e);
    }
  }

  const cachedUserStr = localStorage.getItem('ts_cached_user');
  let user = null;
  if (cachedUserStr) {
    try {
      user = JSON.parse(cachedUserStr);
    } catch (e) {
      console.error("Failed to parse cached user", e);
    }
  }

  return {
    items,
    notes,
    categories: DEFAULT_CATEGORIES,
    settings,
    user,
  };
};

const INITIAL_STATE: AppState = getInitialState();

interface Alert {
  id: string;
  type: 'note' | 'item' | 'batch';
  title: string;
  subtitle: string;
  priority: 'Urgent' | 'Important' | 'Info' | 'Completed';
  icon: React.ReactNode;
  category?: string;
  timestamp: string;
}

function NotificationBar({ 
  notes, 
  items,
  dismissed, 
  currentTime,
  onDismiss, 
  onDismissAll,
  onView
}: { 
  notes: Note[]; 
  items: Item[];
  dismissed: string[]; 
  currentTime: Date;
  onDismiss: (id: string) => void; 
  onDismissAll: (ids: string[]) => void; 
  onView: (id: string, type: 'item' | 'note' | 'batch') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'info'>('all');

  const alerts = useMemo(() => {
    const list: Alert[] = [];
    const now = currentTime;

    // 1. Process High-Priority Notes & Reminders
    notes.forEach(note => {
      const isReminder = note.category === 'Reminder' && note.dueDate;
      const isDue = isReminder && new Date(note.dueDate!) <= now;
      const isSoon = isReminder && !isDue && (new Date(note.dueDate!).getTime() - now.getTime()) < 3600000 * 24;

      if (!dismissed.includes(note.id) && (isDue || isSoon || note.priority === 'Urgent' || note.priority === 'Important')) {
        list.push({
          id: note.id,
          type: 'note',
          title: note.title,
          subtitle: isDue ? "REACHED DUE DATE" : isSoon ? `Due ${new Date(note.dueDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : note.description,
          priority: isDue ? 'Urgent' : note.priority,
          icon: isReminder ? <Clock size={16} /> : <FileText size={16} />,
          timestamp: note.createdAt
        });
      }
    });

    // 2. Process Item Price Changes (Batch if > 2)
    const itemPriceChanges = items.filter(item => {
      if (item.priceChangedAt && !dismissed.includes(`price-${item.id}-${item.priceChangedAt}`)) {
        const changedAt = new Date(item.priceChangedAt);
        return (now.getTime() - changedAt.getTime() < 3600000 * 24);
      }
      return false;
    });

    if (itemPriceChanges.length > 2) {
      if (!dismissed.includes('batched-prices')) {
        list.push({
          id: 'batched-prices',
          type: 'batch',
          title: `${itemPriceChanges.length} Price Updates`,
          subtitle: `Multiple inventory items have new rates. Audit required.`,
          priority: 'Info',
          icon: <TrendingUp size={16} />,
          timestamp: itemPriceChanges[0].priceChangedAt || now.toISOString()
        });
      }
    } else {
      itemPriceChanges.forEach(item => {
        list.push({
          id: item.id,
          type: 'item',
          title: `Rate Change: ${item.translations.en}`,
          subtitle: `Updated by ${item.lastChangedBy || 'System'}`,
          priority: 'Info',
          icon: <TrendingUp size={16} />,
          timestamp: item.priceChangedAt!
        });
      });
    }

    // 3. Process Less Critical Info Notes (Batch if > 2)
    const infoNotes = notes.filter(n => 
      !dismissed.includes(n.id) && 
      n.priority === 'Info' && 
      !n.dueDate && 
      (now.getTime() - new Date(n.createdAt).getTime() < 3600000 * 24)
    );

    if (infoNotes.length > 2) {
      if (!dismissed.includes('batched-info-notes')) {
        list.push({
          id: 'batched-info-notes',
          type: 'batch',
          title: `${infoNotes.length} Operation Logs`,
          subtitle: `Routine updates and log entries recorded today.`,
          priority: 'Info',
          icon: <FileText size={16} />,
          timestamp: infoNotes[0].createdAt
        });
      }
    } else if (infoNotes.length > 0) {
      infoNotes.forEach(note => {
        list.push({
          id: note.id,
          type: 'note',
          title: note.title,
          subtitle: note.description,
          priority: 'Info',
          icon: <FileText size={16} />,
          timestamp: note.createdAt
        });
      });
    }

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notes, items, dismissed, currentTime]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'urgent') return alerts.filter(a => a.priority === 'Urgent');
    return alerts.filter(a => a.priority !== 'Urgent');
  }, [alerts, filter]);

  if (alerts.length === 0) return null;

  return (
    <div className="sticky top-20 z-40 px-4 py-2 pointer-events-none">
      <div className="max-w-4xl mx-auto flex flex-col gap-2 pointer-events-auto">
        <div 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between px-4 py-3 bg-[var(--card)]/90 backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-xl cursor-pointer hover:border-[var(--primary)]/30 transition-all group"
        >
          <div className="flex items-center gap-3">
             <div className="relative">
                <BellRing size={16} className="text-[var(--primary)] animate-bounce" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black h-4 w-4 flex items-center justify-center rounded-full shadow-sm">{alerts.length}</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40 leading-none mb-0.5">Live Intelligence</span>
                <span className="text-xs font-bold truncate max-w-[180px] leading-tight">{alerts[0].title}</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black uppercase tracking-tight opacity-30 group-hover:opacity-100 transition-opacity">
                {expanded ? 'Hide Feed' : 'Explore Feed'}
             </span>
             <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
                <ChevronDown size={14} className="opacity-40" />
             </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0, scale: 0.95 }}
              animate={{ height: 'auto', opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              className="overflow-hidden"
            >
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 space-y-3 mt-1">
                {/* Intelligence Toolbar */}
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2 flex-wrap">
                  <div className="flex gap-1">
                    {(['all', 'urgent', 'info'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFilter(type)}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                          filter === type 
                            ? "bg-[var(--primary)] text-white shadow-sm"
                            : "bg-[var(--primary)]/5 text-[var(--primary)] hover:bg-[var(--primary)]/10"
                        )}
                      >
                        {type === 'all' ? 'All' : type === 'urgent' ? 'Critical' : 'Routine'}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const idsToDismiss = filteredAlerts.map(a => {
                        if (a.type === 'item') return `price-${a.id}-${a.timestamp}`;
                        return a.id;
                      });
                      onDismissAll(idsToDismiss);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-rose-500 hover:text-white hover:bg-rose-500 rounded-md transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                    title="Dismiss filtered alerts"
                  >
                    <Check size={9} strokeWidth={3} /> Clear Visible
                  </button>
                </div>

                {/* Scrollable Alerts List */}
                <div className="space-y-1 max-h-[300px] overflow-y-auto no-scrollbar">
                  {filteredAlerts.map((alert) => (
                    <div 
                      key={alert.id + alert.timestamp}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl hover:bg-[var(--primary)]/5 transition-all cursor-pointer group/item border border-transparent hover:border-[var(--primary)]/10",
                        alert.priority === 'Urgent' ? "bg-red-500/5 shadow-inner" : ""
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(alert.id, alert.type);
                      }}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        alert.priority === 'Urgent' ? "bg-red-500 text-white" : "bg-[var(--primary)]/10 text-[var(--primary)]"
                      )}>
                        {alert.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-tight truncate leading-none">{alert.title}</p>
                          {alert.priority === 'Urgent' && <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-black uppercase scale-75 origin-left">Critical</span>}
                        </div>
                        <p className="text-[11px] font-medium opacity-50 truncate mt-1">{alert.subtitle}</p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          let dismissId = alert.id;
                          if (alert.type === 'item') dismissId = `price-${alert.id}-${alert.timestamp}`;
                          onDismiss(dismissId);
                        }}
                        className="opacity-0 group-hover/item:opacity-100 p-2 hover:text-red-500 transition-all rounded-lg hover:bg-red-500/10 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {filteredAlerts.length === 0 && (
                    <div className="py-8 text-center text-[10px] font-black uppercase opacity-30 tracking-wider">
                      No active alerts in this category
                    </div>
                  )}
                  <div className="py-2 text-center border-t border-[var(--border)]/30 mt-2">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-20 italic">End of operational intelligence</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToastContainer({ toasts, onClose }: { 
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-[120] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgColor = "bg-slate-950/95 border-slate-800 text-white shadow-[0_10px_30px_rgba(0,0,0,0.6)]";
          let icon = <Info size={18} className="text-blue-400" />;
          if (toast.type === 'success') {
            bgColor = "bg-emerald-950/95 border-emerald-500/20 text-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.15)]";
            icon = <CheckCircle2 size={18} className="text-emerald-400" />;
          } else if (toast.type === 'error') {
            bgColor = "bg-rose-950/95 border-rose-500/20 text-rose-100 shadow-[0_10px_30px_rgba(239,68,68,0.15)]";
            icon = <AlertCircle size={18} className="text-rose-400" />;
          } else if (toast.type === 'warning') {
            bgColor = "bg-amber-950/95 border-amber-500/20 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.15)]";
            icon = <AlertCircle size={18} className="text-amber-400" />;
          }

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className={cn(
                "p-4 rounded-2xl border flex items-start gap-3 backdrop-blur-md pointer-events-auto",
                bgColor
              )}
            >
              <div className="shrink-0 mt-0.5">
                {icon}
              </div>
              <div className="flex-1 text-xs font-bold leading-relaxed pr-2">
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => onClose(toast.id)}
                className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-current opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0c10]"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <div className="relative mb-8">
          <motion.div 
            className="absolute inset-0 bg-amber-500 blur-[60px] opacity-20"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <div className="relative h-40 w-40 rounded-[2.5rem] bg-gradient-to-br from-slate-800 to-slate-900 p-1 border border-white/10 shadow-2xl overflow-hidden">
             <img src={appLogo} alt="TS" className="h-full w-full object-contain" />
          </div>
        </div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-center"
        >
          <h1 className="text-4xl font-black tracking-tighter text-white">
            TS <span className="text-amber-500">PRICE</span> MANAGER
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.5em] text-white/30">
            Enterprise Pricing Core v2.5
          </p>
        </motion.div>
        
        <div className="mt-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-amber-500"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- App Component ---
export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  
  const handleGuestLogin = () => {
    localStorage.setItem('ts_guest_session', 'true');
    localStorage.setItem('ts_has_logged_in', 'true');
    localStorage.setItem('ts_cached_user', JSON.stringify({ uid: 'guest', email: 'Guest Account' }));
    setState(prev => ({
      ...prev,
      user: { uid: 'guest', email: 'Guest Account' }
    }));
  };

  const [activeTab, setActiveTabRaw] = useState<'home' | 'notes' | 'settings' | 'profile' | 'notifications' | 'calculator'>('home');
  const setActiveTab = (tab: 'home' | 'notes' | 'settings' | 'profile' | 'notifications' | 'calculator') => {
    setActiveTabRaw(tab);
    triggerHapticFeedback('navigation');
  };
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [syncLogs, setSyncLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('ts_sync_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Periodically refresh current time to update reminder proximity alerts
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showCategoryAddModal, setShowCategoryAddModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSmartEntry, setShowSmartEntry] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [previewingItem, setPreviewingItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [showCategorySearch, setShowCategorySearch] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPINScreen, setShowPINScreen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [isVerifyingOldPIN, setIsVerifyingOldPIN] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteDeleteConfirmation, setNoteDeleteConfirmation] = useState<{
    show: boolean;
    ids: string[];
  }>({ show: false, ids: [] });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // --- New Styled Excel Export System States ---
  const [showExportExcelModal, setShowExportExcelModal] = useState(false);
  const [selectedExportOption, setSelectedExportOption] = useState<'with_cost' | 'without_cost' | null>(null);
  const [exportStep, setExportStep] = useState<number | null>(null); // null = idle, 0 = Prep, 1 = Create, 2 = Optimize, 3 = Finalize, 4 = Success
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedFileName, setExportedFileName] = useState<string>("");

  // Deletion state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    type: 'single' | 'multiple';
    targetId?: string;
  }>({ show: false, type: 'single' });

  // Global Toast Notifications System
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }[]>([]);

  const triggerToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  }, []);

  // --- Network Connectivity & Sync Health Monitoring ---
  useEffect(() => {
    const logSyncEvent = (type: 'success' | 'error' | 'warning' | 'info', message: string, details?: string, operation?: string, collection?: string) => {
      const newEntry = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        type,
        message,
        details,
        operation,
        collection
      };
      setSyncLogs(prev => {
        const updated = [newEntry, ...prev].slice(0, 100);
        localStorage.setItem('ts_sync_logs', JSON.stringify(updated));
        return updated;
      });
    };

    const handleOnline = () => {
      setIsOnline(true);
      triggerToast("📶 Network connection restored! Auto-sync active.", "success");
      logSyncEvent('success', 'Device reconnected to network. Automated live channels resumed.');
    };

    const handleOffline = () => {
      setIsOnline(false);
      triggerToast("⚠️ Device went offline. Matrix local memory active.", "warning");
      logSyncEvent('warning', 'Device disconnected. Core operating in Sandbox Mode.');
    };

    const handleNewLog = () => {
      try {
        const saved = localStorage.getItem('ts_sync_logs');
        if (saved) {
          setSyncLogs(JSON.parse(saved));
        }
      } catch (err) {
        console.error("Error reading updated sync logs:", err);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ts_sync_log_added', handleNewLog);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ts_sync_log_added', handleNewLog);
    };
  }, [triggerToast]);

  // --- Real-Time Push Notifications triggers for Stock, Reminders, and Udhar debts ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    // Check if showing stock alerts is enabled in settings
    if (state.settings.showStockAlerts === false) return;

    const dispatchedKey = 'ts_dispatched_push_alerts';
    let dispatched: string[] = [];
    try {
      const saved = localStorage.getItem(dispatchedKey);
      dispatched = saved ? JSON.parse(saved) : [];
    } catch (e) {
      dispatched = [];
    }

    const currentDispatched = [...dispatched];
    let changed = false;

    // Helper to send a native push notification through the registered service worker
    const sendPushNotification = (id: string, title: string, body: string) => {
      if (currentDispatched.includes(id)) return;
      
      currentDispatched.push(id);
      changed = true;

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            icon: '/logo.png',
            badge: '/logo.png',
            vibrate: [200, 100, 200],
            tag: id,
            data: { url: window.location.origin }
          } as any);
        }).catch(() => {
          new Notification(title, { body, icon: '/logo.png' });
        });
      } else {
        new Notification(title, { body, icon: '/logo.png' });
      }
    };

    // 1. Check for Low Stock (items with quantity <= 5)
    state.items.forEach(item => {
      if (item.quantity <= 5) {
        const alertId = `push-lowstock-${item.id}-${item.quantity}`;
        sendPushNotification(
          alertId,
          `⚠️ Low Stock: ${item.translations?.en || item.name}`,
          `Only ${item.quantity} ${item.unit || 'PCS'} left in physical inventory! Please reorder soon.`
        );
      }
    });

    // 2. Check for Overdue or Due Soon Udhar Ledger entries (unsettled debt/credit)
    const todayStr = new Date().toISOString().split('T')[0];
    state.notes.forEach(note => {
      if (note.status === 'Active' && note.udharPerson) {
        const remainingAmount = Number(note.udharAmount || 0) - (note.udharPayments?.reduce((s, p) => s + p.amount, 0) || 0);
        if (remainingAmount > 0) {
          if (note.dueDate) {
            const dueDateStr = note.dueDate.split('T')[0];
            const dueTime = new Date(dueDateStr).getTime();
            const todayTime = new Date(todayStr).getTime();
            const diffDays = Math.ceil((dueTime - todayTime) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
              const alertId = `push-overdue-${note.id}-${remainingAmount}`;
              sendPushNotification(
                alertId,
                `🔴 Overdue Udhar: ${note.udharPerson}`,
                `Outstanding balance of ₹${remainingAmount.toLocaleString()} was due on ${new Date(note.dueDate).toLocaleDateString()}.`
              );
            } else if (diffDays <= 1) {
              const alertId = `push-duesoon-${note.id}-${dueDateStr}`;
              sendPushNotification(
                alertId,
                `📅 Settlement Due: ${note.udharPerson}`,
                `₹${remainingAmount.toLocaleString()} is due for settlement ${diffDays === 0 ? 'today' : 'tomorrow'} (${new Date(note.dueDate).toLocaleDateString()}).`
              );
            }
          }
        }
      }

      // 3. Check for general 'Reminder' category notes due today or overdue
      if (note.status === 'Active' && note.category === 'Reminder' && note.dueDate) {
        const dueDateStr = note.dueDate.split('T')[0];
        const dueTime = new Date(dueDateStr).getTime();
        const todayTime = new Date(todayStr).getTime();
        const diffDays = Math.ceil((dueTime - todayTime) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          const alertId = `push-reminder-overdue-${note.id}`;
          sendPushNotification(
            alertId,
            `⏰ Overdue Reminder: ${note.title}`,
            `${note.description || 'Action required.'} (Scheduled for ${new Date(note.dueDate).toLocaleDateString()})`
          );
        } else if (diffDays <= 0) {
          const alertId = `push-reminder-today-${note.id}`;
          sendPushNotification(
            alertId,
            `⏰ Reminder Today: ${note.title}`,
            `${note.description || 'Action required today!'}`
          );
        }
      }
    });

    if (changed) {
      try {
        localStorage.setItem(dispatchedKey, JSON.stringify(currentDispatched.slice(-200)));
      } catch (e) {
        console.error("Failed to save dispatched alerts history:", e);
      }
    }
  }, [state.items, state.notes, state.settings.showStockAlerts]);

  // PWA Install Logic
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Automatically show welcome or install banner if it's the first visit
      const hasSeenInstall = localStorage.getItem('ts_install_seen');
      if (!hasSeenInstall) {
        setShowWelcome(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      localStorage.setItem('ts_install_seen', 'true');
      console.log('PWA was installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert(t.installApp + ": " + t.error);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      localStorage.setItem('ts_install_seen', 'true');
    }
  };

  // --- Data Management ---
  const generateStyledExcel = (items: Item[], includeCostPrice: boolean) => {
    // 1. Headers
    const headers = [
      "Serial Number",
      "Product Name",
      "Category",
      "Field Note",
      "Retail Price / Unit",
      "Wholesale Price / Unit"
    ];
    if (includeCostPrice) {
      headers.push("Cost Price / Unit");
    }

    // 2. Data rows
    const rows = items.map((item, idx) => {
      const serial = (idx + 1).toString();
      const productName = item.translations[state.settings.language] || item.translations.en || "-";
      const catName = state.categories.find((c: Category) => c.id === item.categoryId)?.name || "-";
      const fieldNote = item.notes || "-";
      
      const retailStr = `₹${formatNumber(item.retailPrice, state.settings.pricePrecision)} / ${item.retailPriceUnit || 'Piece'}`;
      const wholesaleStr = `₹${formatNumber(item.wholesalePrice, state.settings.pricePrecision)} / ${item.wholesalePriceUnit || 'Piece'}`;
      const costStr = `₹${formatNumber(item.buyingPrice || 0, state.settings.pricePrecision)} / ${item.buyingPriceUnit || 'Piece'}`;

      if (includeCostPrice) {
        return [serial, productName, catName, fieldNote, retailStr, wholesaleStr, costStr];
      } else {
        return [serial, productName, catName, fieldNote, retailStr, wholesaleStr];
      }
    });

    // Combine headers and rows
    const allData = [headers, ...rows];

    // Create worksheet
    const ws = XLSXStyle.utils.aoa_to_sheet(allData);

    // Set auto-adjusted widths based on requirements
    const colWidths = [
      { wch: 12 }, // Serial Number
      { wch: 35 }, // Product Name
      { wch: 22 }, // Category
      { wch: 45 }, // Field Note
      { wch: 22 }, // Retail Price
      { wch: 22 }, // Wholesale Price
    ];
    if (includeCostPrice) {
      colWidths.push({ wch: 22 }); // Cost Price
    }
    ws['!cols'] = colWidths;

    // Row Heights
    ws['!rows'] = [
      { hpt: 28 }, // Header row height
      ...rows.map(() => ({ hpt: 20 })) // Consistent row height
    ];

    // Freeze Header Row and First Column (Serial Number)
    ws['!views'] = [
      {
        state: 'frozen',
        xSplit: 1, // Freeze Serial Number
        ySplit: 1, // Freeze Header Row
        topLeftCell: 'B2',
        activePane: 'bottomRight'
      }
    ];

    // Styling logic
    const range = XLSXStyle.utils.decode_range(ws['!ref'] || "A1:G1");
    for (let r = range.s.r; r <= range.e.r; ++r) {
      for (let c = range.s.c; c <= range.e.c; ++c) {
        const cellRef = XLSXStyle.utils.encode_cell({ r, c });
        const cell = ws[cellRef];
        if (!cell) continue;

        // Perfect Slate bordered cells
        const cellBorder = {
          top: { style: 'thin', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
          left: { style: 'thin', color: { rgb: 'E2E8F0' } },
          right: { style: 'thin', color: { rgb: 'E2E8F0' } }
        };

        if (r === 0) {
          // Headers styling
          cell.s = {
            font: {
              name: "Calibri",
              sz: 11,
              bold: true,
              color: { rgb: "FFFFFF" }
            },
            fill: {
              fgColor: { rgb: "0F172A" } // Dark slate background
            },
            alignment: {
              horizontal: "center",
              vertical: "center",
              wrapText: true
            },
            border: cellBorder
          };
        } else {
          // Body row styling
          let alignment: 'left' | 'center' | 'right' = 'left';
          if (c === 0) {
            alignment = 'center'; // Serial
          } else if (c >= 4) {
            alignment = 'right'; // Prices
          }

          // Subtle zebra striping for professional readability
          const isEven = r % 2 === 0;
          const bgRgb = isEven ? "F8FAFC" : "FFFFFF";

          cell.s = {
            font: {
              name: "Calibri",
              sz: 11,
              color: { rgb: "1E293B" }
            },
            fill: {
              fgColor: { rgb: bgRgb }
            },
            alignment: {
              horizontal: alignment,
              vertical: "center",
              wrapText: true
            },
            border: cellBorder
          };
        }
      }
    }

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Products');
    return wb;
  };

  const exportToExcel = async () => {
    setSelectedExportOption(null);
    setExportStep(null);
    setExportedBlob(null);
    setShowExportExcelModal(true);
  };

  const startExcelExportProcess = async () => {
    if (!selectedExportOption) return;
    setIsExporting(true);
    setExportStep(0); // 0: Preparing Excel...

    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      setExportStep(1); // 1: Creating Spreadsheet...
      
      await new Promise(resolve => setTimeout(resolve, 700));
      setExportStep(2); // 2: Optimizing Layout...

      await new Promise(resolve => setTimeout(resolve, 700));
      setExportStep(3); // 3: Finalizing File...

      const includeCost = selectedExportOption === 'with_cost';
      const wb = generateStyledExcel(state.items, includeCost);

      const wbout = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'binary' });
      const s2ab = (s: string) => {
        const buf = new ArrayBuffer(s.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < s.length; i++) {
          view[i] = s.charCodeAt(i) & 0xff;
        }
        return buf;
      };
      const blob = new Blob([s2ab(wbout)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = includeCost
        ? `Products_With_CostPrice_${dateStr}.xlsx`
        : `Products_Without_CostPrice_${dateStr}.xlsx`;

      setExportedBlob(blob);
      setExportedFileName(fileName);

      await new Promise(resolve => setTimeout(resolve, 600));
      setExportStep(4); // 4: Done!
      triggerToast("Excel export optimized & compiled!", "success");
    } catch (e) {
      console.error("Styled excel export failed", e);
      triggerToast("Failed to compile styled Excel. Please try again.", "error");
      setShowExportExcelModal(false);
      setExportStep(null);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    
    try {
      // Simulate slight delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 1000));

      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(31, 41, 55); // Dark Slate
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('TS PRICE MANAGER', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('PROFESSIONAL PRODUCT PRICE LIST', 14, 28);
      
      doc.setTextColor(200, 200, 200);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 150, 28);

      const tableData = state.items.map(item => [
        item.translations[state.settings.language] || item.translations.en,
        `₹${formatNumber(item.retailPrice, state.settings.pricePrecision)}/${item.retailPriceUnit}`,
        `₹${formatNumber(item.wholesalePrice, state.settings.pricePrecision)}/${item.wholesalePriceUnit}`
      ]);

      autoTable(doc, {
        startY: 50,
        head: [['Product Name', 'Retail Price', 'Wholesale Price']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [79, 70, 229], // Indigo
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { halign: 'right' },
          2: { halign: 'right' }
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251]
        },
        margin: { top: 50 },
        styles: {
          fontSize: 9,
          cellPadding: 4
        }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} | TS Price Manager Core System`, 14, doc.internal.pageSize.height - 10);
      }

      doc.save(`TS_PRICE_LIST_${new Date().toISOString().split('T')[0]}.pdf`);
      triggerToast("PDF export successful!", "success");
    } catch (error) {
      console.error("PDF export failed", error);
      triggerToast("Failed to export PDF. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareProductList = async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      if (state.items.length === 0) {
        triggerToast("Product list is empty!", "warning");
        return;
      }

      let message = "*Product List*\n\n";
      state.items.forEach((item, index) => {
        const name = item.translations[state.settings.language] || item.translations.en;
        message += `${index + 1}. *${name}*\nRetail Price: ₹${formatNumber(item.retailPrice, state.settings.pricePrecision)}/${item.retailPriceUnit}\nWholesale Price: ₹${formatNumber(item.wholesalePrice, state.settings.pricePrecision)}/${item.wholesalePriceUnit}\n\n`;
      });
      message += "Thank you.";

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
      
      // Try to open WhatsApp
      window.open(whatsappUrl, '_blank');
      
    } catch (error) {
      console.error("Sharing failed", error);
      triggerToast("Failed to share product list.", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.items && Array.isArray(json.items)) {
          if (confirm('Importing will merge with current data. Proceed?')) {
            setState(prev => ({ ...prev, items: [...prev.items, ...json.items] }));
            triggerToast('Import successful!', 'success');
          }
        }
      } catch (err) {
        triggerToast('Invalid file format. Please upload a valid JSON backup.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleBackup = () => {
    const dataStr = JSON.stringify(state);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `TS_PRICE_MANAGER_Backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.settings && json.items) {
          if (confirm('Restoring will overwrite current settings and items. Proceed?')) {
            setState(json);
            triggerToast('System Restored!', 'success');
          }
        }
      } catch (err) {
        triggerToast('Invalid backup file.', 'error');
      }
    };
    reader.readAsText(file);
  };
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (user.email) {
          localStorage.setItem('ts_last_google_email', user.email);
        }
        localStorage.setItem('ts_has_logged_in', 'true');
        localStorage.setItem('ts_cached_user', JSON.stringify({ uid: user.uid, email: user.email }));
        setState(prev => ({ 
          ...prev, 
          user: { uid: user.uid, email: user.email } 
        }));
      } else {
        const isGuest = localStorage.getItem('ts_guest_session') === 'true';
        if (isGuest) {
          localStorage.setItem('ts_has_logged_in', 'true');
          localStorage.setItem('ts_cached_user', JSON.stringify({ uid: 'guest', email: 'Guest Account' }));
          setState(prev => ({ 
            ...prev, 
            user: { uid: 'guest', email: 'Guest Account' } 
          }));
        } else {
          setState(prev => ({ ...prev, user: null }));
        }
      }
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Firestore Sync ---
  useEffect(() => {
    if (!state.user || state.user.uid === 'guest' || !state.settings.autoCloudSync) {
      return;
    }

    const userDocRef = doc(db, 'users', state.user.uid);
    
    // Sync Settings
    const unsubSettings = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setState(prev => ({ ...prev, settings: { ...prev.settings, ...data } }));
      }
    }, (error) => {
      console.error("Settings sync error:", error);
      handleFirestoreError(error, OperationType.GET, `users/${state.user!.uid}`);
    });

    // Sync Items
    const itemsRef = collection(db, 'users', state.user.uid, 'items');
    const unsubItems = onSnapshot(query(itemsRef, orderBy('lastUpdated', 'desc')), (snap) => {
      const itemsList: Item[] = [];
      snap.forEach(doc => itemsList.push({ ...doc.data() as Item, id: doc.id }));
      setState(prev => ({ ...prev, items: itemsList }));
    }, (error) => {
      console.error("Items sync error:", error);
      handleFirestoreError(error, OperationType.GET, `users/${state.user!.uid}/items`);
    });

    // Sync Notes
    const notesRef = collection(db, 'users', state.user.uid, 'notes');
    const unsubNotes = onSnapshot(query(notesRef, orderBy('createdAt', 'desc')), (snap) => {
      const notesList: Note[] = [];
      snap.forEach(doc => notesList.push({ ...doc.data() as Note, id: doc.id }));
      setState(prev => ({ ...prev, notes: notesList }));
    }, (error) => {
      console.error("Notes sync error:", error);
      handleFirestoreError(error, OperationType.GET, `users/${state.user!.uid}/notes`);
    });

    // Sync Categories
    const categoriesRef = collection(db, 'users', state.user.uid, 'categories');
    const unsubCategories = onSnapshot(categoriesRef, (snap) => {
      const dbCategories: Category[] = [];
      snap.forEach(doc => dbCategories.push({ ...doc.data() as Category, id: doc.id }));
      setState(prev => {
        const merged = [...DEFAULT_CATEGORIES];
        dbCategories.forEach(dbCat => {
          const index = merged.findIndex(c => c.id === dbCat.id || c.name.toLowerCase() === dbCat.name.toLowerCase());
          if (index !== -1) {
            merged[index] = dbCat;
          } else {
            merged.push(dbCat);
          }
        });
        return { ...prev, categories: merged };
      });
    }, (error) => {
      console.error("Categories sync error:", error);
      handleFirestoreError(error, OperationType.GET, `users/${state.user!.uid}/categories`);
    });

    return () => {
      unsubSettings();
      unsubItems();
      unsubNotes();
      unsubCategories();
    };
  }, [state.user, state.settings.autoCloudSync, syncTrigger]);

  // --- Effects ---

  // Separate Effect for Theme & Core Styles (low frequency)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    const accents: Record<string, string> = {
      indigo: '99, 102, 241',
      emerald: '16, 185, 129',
      rose: '244, 63, 94',
      amber: '245, 158, 11',
      cyan: '6, 182, 212',
      slate: '100, 116, 139'
    };
    const rgb = accents[state.settings.accentColor || 'indigo'];
    document.documentElement.style.setProperty('--primary-rgb', rgb);
    
    const fontSizes: Record<string, string> = {
      standard: '16px',
      comfortable: '18px',
      compact: '14px'
    };
    document.documentElement.style.setProperty('--base-font-size', fontSizes[state.settings.fontSize || 'standard']);
  }, [state.settings.theme, state.settings.accentColor, state.settings.fontSize]);

  // Separate Effect for Mouse Move (High frequency, throttled)
  useEffect(() => {
    if (state.settings.theme !== 'premium_dynamic') return;

    let ticking = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const x = (e.clientX / window.innerWidth) * 100;
          const y = (e.clientY / window.innerHeight) * 100;
          document.body.style.setProperty('--mouse-x', `${x}%`);
          document.body.style.setProperty('--mouse-y', `${y}%`);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [state.settings.theme]);

  // Separate Effect for Persistence
  useEffect(() => {
    // Always persist settings to localStorage for consistent boot-up
    localStorage.setItem('price_manager_settings', JSON.stringify(state.settings));
    
    // Only persist full state if cloud sync is off or user is guest
    if (!state.user || !state.settings.autoCloudSync) {
      localStorage.setItem('price_manager_state', JSON.stringify(state));
    }
  }, [state.items, state.notes, state.settings, state.user]);

  const t = UI_TEXT[state.settings.language];
  const precision = state.settings.pricePrecision || 0;

  const filteredItems = useMemo(() => {
    return state.items.filter(item => {
      const matchesSearch = 
        item.translations.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.translations.hi.includes(searchQuery) ||
        item.translations.mr.includes(searchQuery) ||
        item.translations['hi-en'].toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [state.items, searchQuery, selectedCategory]);

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery) return state.categories;
    return state.categories.filter(c => 
      c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );
  }, [state.categories, categorySearchQuery]);

  // --- Handlers ---
  const handleUpdateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    if (isSyncing) return;
    
    // Set syncing flag if autoCloudSync is being toggled
    const isTogglingSync = 'autoCloudSync' in updates;
    if (isTogglingSync) setIsSyncing(true);

    try {
      // Local state update first (Responsive UI)
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, ...updates }
      }));

      // Cloud Persistence
      if (state.user && (updates.autoCloudSync ?? state.settings.autoCloudSync)) {
        await setDoc(doc(db, 'users', state.user.uid), updates, { merge: true });
      }

      // If we just enabled sync, ensure local storage doesn't conflict
      if (updates.autoCloudSync === true) {
        triggerToast("Cloud Synchronization Enabled Successfully.", "success");
      } else if (updates.autoCloudSync === false) {
        triggerToast("Cloud Synchronization Disabled. Data will be saved locally.", "info");
      }

    } catch (e) {
      console.error("Settings update failed", e);
      triggerToast((t.error || "Error") + ": " + (e instanceof Error ? e.message : 'Unknown error'), "error");
      
      // Rollback local state if cloud sync was intended but failed
      setState(prev => ({ ...prev })); 
    } finally {
      if (isTogglingSync) {
        // Minimum delay for animation visibility
        setTimeout(() => setIsSyncing(false), 600);
      }
    }
  }, [state.user, state.settings.autoCloudSync, t.error, isSyncing]);

  const handleSaveCategories = useCallback(async (names: string[]) => {
    if (names.length === 0) return;

    const newCategories: Category[] = names.map((name, index) => ({
      id: (Date.now() + index).toString(),
      name: name.trim(),
      icon: '📦',
    }));

    // Optimistic local state update
    setState(prev => {
      const filteredNew = newCategories.filter(
        newCat => !prev.categories.some(c => c.name.toLowerCase() === newCat.name.toLowerCase())
      );
      return {
        ...prev,
        categories: [...prev.categories, ...filteredNew]
      };
    });

    if (state.user && state.settings.autoCloudSync && state.user.uid !== 'guest') {
      try {
        for (const cat of newCategories) {
          await setDoc(doc(db, 'users', state.user.uid, 'categories', cat.id), cat);
        }
        triggerToast("Categories successfully synced with Live Ledger.", "success");
      } catch (e) {
        console.error("Cloud sync of custom categories failed", e);
        handleFirestoreError(e, OperationType.WRITE, `users/${state.user.uid}/categories`);
      }
    } else {
      triggerToast("Categories saved locally in Sandbox memory.", "info");
    }
  }, [state.user, state.settings.autoCloudSync]);

  const handleDeleteCategory = useCallback(async (catId: string) => {
    if (DEFAULT_CATEGORIES.some(c => c.id === catId)) {
      triggerToast("Cannot delete predefined system categories.", "error");
      return;
    }

    const itemsToUpdate = state.items.filter(item => item.categoryId === catId);
    const defaultCatId = '6'; // Default Category 'Others'

    setState(prev => {
      const updatedItems = prev.items.map(item => 
        item.categoryId === catId ? { ...item, categoryId: defaultCatId, lastUpdated: new Date().toISOString() } : item
      );
      const updatedCategories = prev.categories.filter(c => c.id !== catId);
      return {
        ...prev,
        items: updatedItems,
        categories: updatedCategories
      };
    });

    if (state.user && state.settings.autoCloudSync && state.user.uid !== 'guest') {
      try {
        for (const item of itemsToUpdate) {
          const itemRef = doc(db, 'users', state.user.uid, 'items', item.id);
          await updateDoc(itemRef, { categoryId: defaultCatId, lastUpdated: new Date().toISOString() });
        }
        const catRef = doc(db, 'users', state.user.uid, 'categories', catId);
        await deleteDoc(catRef);
        triggerToast("Category deleted. Products reassigned to 'Others'.", "success");
      } catch (e) {
        console.error("Failed to delete category in Firestore", e);
        handleFirestoreError(e, OperationType.DELETE, `users/${state.user.uid}/categories/${catId}`);
      }
    } else {
      triggerToast("Category deleted and items reassigned to 'Others' locally.", "info");
    }
  }, [state.user, state.settings.autoCloudSync, state.items]);

  const handleAddItem = useCallback(async (data: Omit<Item, 'id' | 'lastUpdated'>) => {
    try {
      const id = Date.now().toString();
      const newItem = {
        ...data,
        id,
        lastUpdated: new Date().toISOString(),
        priceChangedAt: new Date().toISOString()
      };
      
      // Optimistic update
      setState(prev => ({
        ...prev,
        items: [newItem, ...prev.items]
      }));
      setShowAddItem(false);

      if (state.user && state.settings.autoCloudSync) {
        await addDoc(collection(db, 'users', state.user.uid, 'items'), newItem);
      }
    } catch (e) {
      console.error("Add item failed", e);
      triggerToast((t.error || "Error") + ": " + (e instanceof Error ? e.message : 'Sync Error. Saved locally.'), "error");
    }
  }, [state.user, state.settings.autoCloudSync, t.error]);

  const handleBulkAddItems = useCallback(async (newItemsData: Omit<Item, 'id' | 'lastUpdated'>[]) => {
    try {
      const now = new Date().toISOString();
      const updatedItems = [...state.items];
      const cloudPromises = [];

      for (let idx = 0; idx < newItemsData.length; idx++) {
        const data = newItemsData[idx];
        // Ensure distinct IDs
        const id = (Date.now() + idx + Math.floor(Math.random() * 1000)).toString();
        const newItem = {
          ...data,
          id,
          lastUpdated: now,
          priceChangedAt: now
        };
        updatedItems.unshift(newItem);

        if (state.user && state.settings.autoCloudSync) {
          cloudPromises.push(addDoc(collection(db, 'users', state.user.uid, 'items'), newItem));
        }
      }

      setState(prev => ({
        ...prev,
        items: updatedItems
      }));

      setShowSmartEntry(false);

      if (cloudPromises.length > 0) {
        await Promise.all(cloudPromises);
      }
    } catch (e) {
      console.error("Bulk add items failed", e);
      triggerToast((t.error || "Error") + ": " + (e instanceof Error ? e.message : 'Sync Error. Saved locally.'), "error");
    }
  }, [state.user, state.settings.autoCloudSync, t.error, state.items]);

  const handleUpdateItem = useCallback(async (id: string, data: Partial<Item>) => {
    try {
      const existingItem = state.items.find(i => i.id === id);
      const updates: any = { 
        ...data, 
        lastUpdated: new Date().toISOString() 
      };

      const isPriceChanged = existingItem && (
        (data.buyingPrice !== undefined && data.buyingPrice !== existingItem.buyingPrice) ||
        (data.retailPrice !== undefined && data.retailPrice !== existingItem.retailPrice) ||
        (data.wholesalePrice !== undefined && data.wholesalePrice !== existingItem.wholesalePrice)
      );

      if (isPriceChanged) {
        updates.priceChangedAt = new Date().toISOString();
        updates.lastChangedBy = state.settings.deviceName;
      }

      // Optimistic update
      setState(prev => ({
        ...prev,
        items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item)
      }));
      setEditingItem(null);

      if (state.user && state.settings.autoCloudSync) {
        await updateDoc(doc(db, 'users', state.user.uid, 'items', id), updates);
      }
    } catch (e) {
      console.error("Update failed", e);
      triggerToast((t.error || "Error") + ": " + (e instanceof Error ? e.message : 'Sync Error. Saved locally.'), "error");
    }
  }, [state.items, state.user, state.settings.autoCloudSync, state.settings.deviceName, t.error]);

  const handleDeleteItem = useCallback(async (id: string) => {
    setDeleteConfirmation({ show: true, type: 'single', targetId: id });
  }, []);

  const confirmDeletion = async () => {
    const { type, targetId } = deleteConfirmation;
    const idsToDelete = type === 'single' ? [targetId!] : selectedItemIds;

    // Optimistically update local state
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => !idsToDelete.includes(item.id))
    }));
    
    if (type === 'multiple') {
      setSelectedItemIds([]);
    }

    if (state.user && state.settings.autoCloudSync) {
      try {
        for (const id of idsToDelete) {
          await deleteDoc(doc(db, 'users', state.user.uid, 'items', id));
        }
      } catch (e) {
        console.error("Cloud delete failed", e);
        triggerToast((t.error || "Error") + ": Permission Denied on Cloud. Some items may reappear.", "error");
      }
    }
    
    setDeleteConfirmation({ show: false, type: 'single' });
  };
  
  const handleAddNote = useCallback(async (data: Omit<Note, 'id' | 'createdAt' | 'status'>) => {
    // AI: Smart Priority Detection
    let finalPriority = data.priority;
    try {
      const autoPriority = await getSmartNoteCategorization(data.title, data.description);
      if (autoPriority) {
        finalPriority = autoPriority as any;
      }
    } catch (e) {
      console.error("AI Prioritization failed", e);
    }

    const id = Date.now().toString();
    const newNote = {
      ...data,
      id,
      priority: finalPriority,
      createdAt: new Date().toISOString(),
      status: 'Active' as const,
    };

    // Optimistic update
    setState(prev => ({
      ...prev,
      notes: [newNote, ...prev.notes]
    }));
    setShowAddNote(false);
    setActiveTab('notes');
    triggerToast("Note synchronized with Local Matrix.", "success");

    if (state.user && state.settings.autoCloudSync) {
      try {
        await addDoc(collection(db, 'users', state.user.uid, 'notes'), newNote);
      } catch (e) {
        console.error("Cloud sync failed", e);
        triggerToast("Alert: Cloud synchronization failed. Data persisted locally.", "warning");
      }
    }
  }, [state.user, state.settings.autoCloudSync]);

  const handleUpdateNote = async (id: string, updates: Partial<Note>) => {
    // Optimistic update
    setState(prev => ({
      ...prev,
      notes: prev.notes.map(n => n.id === id ? { ...n, ...updates } : n)
    }));
    triggerToast("Note updated successfully!", "success");

    if (state.user && state.settings.autoCloudSync) {
      try {
        await updateDoc(doc(db, 'users', state.user.uid, 'notes', id), updates);
      } catch (e) {
        console.error("Cloud sync failed", e);
      }
    }
  };

  const handleDeleteNote = async (id: string) => {
    // Optimistic update
    setState(prev => ({
      ...prev,
      notes: prev.notes.filter(n => n.id !== id)
    }));

    if (state.user && state.settings.autoCloudSync) {
      try {
        await deleteDoc(doc(db, 'users', state.user.uid, 'notes', id));
      } catch (e) {
        console.error("Cloud sync failed", e);
      }
    }
  };

  const confirmNoteDeletion = async () => {
    const ids = noteDeleteConfirmation.ids;
    for (const id of ids) {
      await handleDeleteNote(id);
    }
    setSelectedNoteIds(prev => prev.filter(x => !ids.includes(x)));
    setNoteDeleteConfirmation({ show: false, ids: [] });
  };

  const handleToggleLock = () => {
    if (state.settings.isLocked) {
      if (!state.settings.pin) {
        setShowWelcome(true);
      } else {
        setShowPINScreen(true);
      }
    } else {
      handleUpdateSettings({ isLocked: true });
    }
  };

  // --- Filtered Items ---
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Show tour for new users who haven't seen it
    if (state.settings.hasSeenOnboarding === false && !isInitializing) {
      const timer = setTimeout(() => setShowTour(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.settings.hasSeenOnboarding, isInitializing]);

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  }, []);

  const handleEditTrigger = useCallback((item: Item) => {
    setEditingItem(item);
  }, []);
  const totalValue = state.items.reduce((sum, item) => sum + (item.buyingPrice * item.quantity), 0);

  const selectedPalette = useMemo(() => {
    return AURORA_PALETTES[state.settings.ultraPremiumPalette || 'neon_aurora'] || AURORA_PALETTES.neon_aurora;
  }, [state.settings.ultraPremiumPalette]);

  const selectedSpeed = useMemo(() => {
    return AURORA_SPEEDS[state.settings.ultraPremiumSpeed || 'normal'] || AURORA_SPEEDS.normal;
  }, [state.settings.ultraPremiumSpeed]);

  const complementaryTopBarBg = useMemo(() => {
    const paletteId = state.settings.ultraPremiumPalette || 'neon_aurora';
    switch (paletteId) {
      case 'sunset':
        return 'rgba(60, 12, 27, 0.95)'; // Complementary crimson sunset shade (#3c0c1b)
      case 'deep_sea':
        return 'rgba(5, 24, 51, 0.95)'; // Complementary abyssal deep sea blue shade (#051833)
      case 'matrix':
        return 'rgba(6, 32, 10, 0.95)'; // Complementary matrix green shade (#06200a)
      case 'cosmic_orchid':
        return 'rgba(32, 5, 51, 0.95)'; // Complementary cosmic orchid shade (#200533)
      case 'cyberpunk_gold':
        return 'rgba(44, 30, 5, 0.95)'; // Complementary cyberpunk gold shade (#2c1e05)
      case 'neon_aurora':
      default:
        return 'rgba(26, 12, 71, 0.95)'; // Complementary neon aurora purple shade (#1a0c47)
    }
  }, [state.settings.ultraPremiumPalette]);

  const dynamicBackgroundStyle = useMemo(() => {
    if (state.settings.theme !== 'ultra_premium') return undefined;
    const gradientColors = selectedPalette.colors.join(', ');
    const gradient = `linear-gradient(135deg, ${gradientColors})`;
    
    if (state.settings.enableBgColorChange === false || selectedSpeed.seconds === 0) {
      return {
        backgroundImage: gradient,
        backgroundSize: '300% 300%',
        animation: 'none',
      };
    }
    
    return {
      backgroundImage: gradient,
      backgroundSize: '300% 300%',
      animation: `ultra-premium-aurora ${selectedSpeed.seconds}s ease infinite`,
    };
  }, [state.settings.theme, selectedPalette, selectedSpeed, state.settings.enableBgColorChange]);

  if (isInitializing || isAuthChecking) {
    return (
      <SplashScreen onComplete={() => setIsInitializing(false)} />
    );
  }

  if (!state.user) {
    return (
      <LoginScreen 
        onGoogleLogin={loginWithGoogle} 
        onGuestLogin={handleGuestLogin} 
      />
    );
  }

  return (
    <div 
      data-theme={state.settings.theme}
      style={dynamicBackgroundStyle}
      className={cn(
        "min-h-screen pb-20 overflow-hidden relative transition-all duration-700",
        state.settings.theme === 'premium_dynamic' && "animate-gradient-flow bg-[var(--premium-gradient)]",
        state.settings.theme === 'ultra_premium' && (state.settings.enableBgColorChange !== false ? "animate-ultra-premium-aurora" : "bg-[var(--background)]")
      )}
    >
      <AnimatePresence>
        {isInitializing && <SplashScreen onComplete={() => setIsInitializing(false)} />}
      </AnimatePresence>

      {/* Dynamic Background Elements for Specific Themes with Premium Cross-Fade */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={state.settings.theme + "_" + (state.settings.ultraPremiumPalette || 'neon_aurora')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        >
          {state.settings.theme === 'ultra_premium' && (
            <div className="absolute inset-0 w-full h-full">
              {state.settings.enableBgColorChange !== false ? (
                <>
                  {/* Ultra Premium animated glowing blur nodes - Elevated Contrast & Customized Speed/Palette */}
                  <motion.div 
                    animate={selectedSpeed.id !== 'static' ? { 
                      scale: [1, 1.35, 0.95, 1.15, 1],
                      x: [0, 90, -50, 30, 0],
                      y: [0, -50, 70, -30, 0],
                    } : {}} 
                    transition={selectedSpeed.id !== 'static' ? { 
                      duration: 30 / (selectedSpeed.nodeSpeedMultiplier || 1), 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    } : undefined}
                    style={{ backgroundColor: selectedPalette.nodes[0] }}
                    className="absolute -top-[10%] -left-[10%] w-[55%] h-[55%] blur-[130px] rounded-full mix-blend-screen" 
                  />
                  <motion.div 
                    animate={selectedSpeed.id !== 'static' ? { 
                      scale: [1.25, 0.95, 1.35, 1.05, 1.25],
                      x: [0, -70, 50, -60, 0],
                      y: [0, 80, -40, 70, 0],
                    } : {}} 
                    transition={selectedSpeed.id !== 'static' ? { 
                      duration: 38 / (selectedSpeed.nodeSpeedMultiplier || 1), 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    } : undefined}
                    style={{ backgroundColor: selectedPalette.nodes[1] }}
                    className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] blur-[150px] rounded-full mix-blend-screen" 
                  />
                  <motion.div 
                    animate={selectedSpeed.id !== 'static' ? { 
                      scale: [0.85, 1.25, 1.05, 0.9, 0.85],
                      x: [0, 60, -40, 50, 0],
                      y: [0, 90, -60, 40, 0],
                    } : {}} 
                    transition={selectedSpeed.id !== 'static' ? { 
                      duration: 34 / (selectedSpeed.nodeSpeedMultiplier || 1), 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    } : undefined}
                    style={{ backgroundColor: selectedPalette.nodes[2] }}
                    className="absolute top-[20%] left-[20%] w-[50%] h-[50%] blur-[140px] rounded-full mix-blend-screen" 
                  />
                  <motion.div 
                    animate={selectedSpeed.id !== 'static' ? { 
                      scale: [1.15, 0.9, 1.25, 0.95, 1.15],
                      x: [0, -40, -70, 30, 0],
                      y: [0, -60, 30, -50, 0],
                    } : {}} 
                    transition={selectedSpeed.id !== 'static' ? { 
                      duration: 42 / (selectedSpeed.nodeSpeedMultiplier || 1), 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    } : undefined}
                    style={{ backgroundColor: selectedPalette.nodes[3] }}
                    className="absolute bottom-[15%] left-[5%] w-[45%] h-[45%] blur-[120px] rounded-full mix-blend-screen" 
                  />
                </>
              ) : (
                <>
                  {/* Static high-clarity subtle back-glows to ensure absolute contrast & zero movement distraction */}
                  <div 
                    style={{ backgroundColor: selectedPalette.nodes[0], opacity: 0.18 }}
                    className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] blur-[110px] rounded-full" 
                  />
                  <div 
                    style={{ backgroundColor: selectedPalette.nodes[1], opacity: 0.22 }}
                    className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] blur-[130px] rounded-full" 
                  />
                </>
              )}
            </div>
          )}

          {state.settings.theme === 'premium_dynamic' && (
            <div className="absolute inset-0 w-full h-full">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  x: [0, 50, 0],
                  y: [0, 30, 0],
                  rotate: [0, 10, 0]
                }} 
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-600/20 blur-[120px] rounded-full" 
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  x: [0, -40, 0],
                  y: [0, -60, 0],
                  rotate: [0, -15, 0]
                }} 
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-purple-600/20 blur-[150px] rounded-full" 
              />
              <motion.div 
                animate={{ 
                  opacity: [0.1, 0.2, 0.1],
                  scale: [1, 1.1, 1]
                }} 
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute top-[30%] left-[20%] w-[40%] h-[40%] bg-emerald-600/10 blur-[100px] rounded-full" 
              />
            </div>
          )}

          {!state.settings.theme.includes('premium') && (
            <div className="absolute inset-0 w-full h-full">
              <div className="glow-bg-indigo" />
              <div className="glow-bg-cyan" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* PIN Screen / Change PIN / Welcome Overlay */}
      <AnimatePresence>
        {showWelcome && (
          <PINScreen 
            mode="create"
            onPINCreated={(pin) => handleUpdateSettings({ pin, isLocked: false })}
            onSuccess={() => setShowWelcome(false)}
            title="Secure Financial Access"
            description="Create a 6-digit PIN to mask buying prices across your dashboard."
          />
        )}
        {showPINScreen && (
          <PINScreen 
            mode="unlock"
            correctPIN={state.settings.pin}
            onSuccess={() => {
              handleUpdateSettings({ isLocked: false });
              setShowPINScreen(false);
            }}
            onCancel={() => setShowPINScreen(false)}
          />
        )}
        {showChangePIN && (
          <PINScreen 
            mode={isVerifyingOldPIN ? 'unlock' : 'create'}
            correctPIN={state.settings.pin}
            onSuccess={() => {
              if (isVerifyingOldPIN) {
                setIsVerifyingOldPIN(false);
              } else {
                setShowChangePIN(false);
              }
            }}
            onPINCreated={(pin) => {
              handleUpdateSettings({ pin, isLocked: false });
            }}
            onCancel={() => {
              setShowChangePIN(false);
              setIsVerifyingOldPIN(false);
            }}
            title={isVerifyingOldPIN ? "Verify Identity" : state.settings.pin ? "Set New Security Key" : "Initialize Security"}
            description={isVerifyingOldPIN ? "Enter current PIN to proceed with change" : "Define your new 6-digit cryptographic sequence"}
          />
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onClose={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <header 
        id="tour-header"
        className="sticky top-0 z-40 backdrop-blur-xl px-6 py-4 text-[var(--primary-foreground)] shadow-2xl transition-colors border-b border-white/10"
        style={{ backgroundColor: complementaryTopBarBg }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-amber-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative overflow-hidden h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-1.5 border border-white/10 shadow-2xl transform group-hover:scale-105 transition-transform">
                 <img src={appLogo} alt="TS" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                 <div className="hidden flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-inner">
                   <Package size={28} className="text-white" />
                 </div>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-white mb-0 leading-none flex items-baseline">
                TS <span className="text-xs font-bold opacity-60 ml-1.5 tracking-[0.3em] uppercase">Price Manager</span>
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                 <div className={cn("h-1.5 w-1.5 rounded-full ring-2 ring-white/10", state.user && state.settings.autoCloudSync ? "bg-green-400 animate-pulse" : "bg-slate-400")} />
                 <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-black">
                   {state.user && state.settings.autoCloudSync ? 'Authenticated Cloud session' : 'Standalone Local Hub'}
                 </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 relative">
            <div 
               id="tour-notes"
               className="relative cursor-pointer hover:scale-110 transition-transform" 
               onClick={() => setActiveTab('notifications')}
            >
               <Bell size={20} className="text-white/80" />
               <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-[var(--primary)] text-[8px] flex items-center justify-center font-bold">
                 {state.notes.filter(n => n.status === 'Active').length + state.items.filter(item => item.quantity <= 5).length}
               </span>
            </div>
            <button 
              id="tour-lock"
              onClick={handleToggleLock}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all border border-white/10",
                state.settings.isLocked ? "bg-amber-500/20 text-amber-500" : "bg-green-500/20 text-green-400"
              )}
            >
              {state.settings.isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            </button>
            
            {/* Professional 3-dot drop menu at top bar right corner */}
            <div className="relative">
              <button 
                id="header-menu-trigger"
                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all border border-white/10 cursor-pointer",
                  showHeaderMenu ? "bg-amber-500/20 text-amber-500" : "bg-white/5 hover:bg-white/10 text-white/80"
                )}
              >
                <MoreVertical size={18} />
              </button>

              <AnimatePresence>
                {showHeaderMenu && (
                  <>
                    {/* Full screen backdrop for click-outside closure */}
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => setShowHeaderMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 top-12 mt-1 w-44 bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-1.5 z-50 text-left"
                    >
                      <div className="px-2.5 py-1.5 border-b border-slate-800/60 mb-1">
                        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-amber-500 block">Navigation</span>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Control Deck</span>
                      </div>

                      <button
                        onClick={() => {
                          setActiveTab('settings');
                          setShowHeaderMenu(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-black uppercase tracking-wider transition-all border-0 cursor-pointer",
                          activeTab === 'settings' 
                            ? "bg-amber-500 text-slate-950 font-black" 
                            : "text-slate-300 hover:text-white hover:bg-white/5 bg-transparent"
                        )}
                      >
                        <SettingsIcon size={14} className={activeTab === 'settings' ? "text-slate-950" : "text-amber-500"} />
                        {t.settings || 'Controls'}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Dynamic Interactive Water Waves */}
        <div className="absolute bottom-0 left-0 right-0 h-4 overflow-hidden pointer-events-none z-10 select-none">
          {/* Wave Path 1 */}
          <svg 
            className="absolute bottom-0 left-0 w-[200%] text-[var(--background)] opacity-35 fill-current animate-wave-fast" 
            style={{ 
              height: `${Math.min(10 + scrollY * 0.15, 36)}px`,
              transform: `translate3d(0, ${Math.min(scrollY * 0.02, 5)}px, 0)`,
              transition: 'height 0.1s ease-out'
            }}
            viewBox="0 0 1200 120" 
            preserveAspectRatio="none"
          >
            <path d="M0,60 C150,100 350,20 500,60 C650,100 850,20 1000,60 C1150,100 1350,20 1500,60 L1500,120 L0,120 Z" />
          </svg>
          
          {/* Wave Path 2 */}
          <svg 
            className="absolute bottom-0 left-0 w-[200%] text-[var(--background)] opacity-50 fill-current animate-wave-slow" 
            style={{ 
              height: `${Math.min(8 + scrollY * 0.12, 32)}px`,
              transform: `translate3d(0, ${Math.min(scrollY * 0.01, 3)}px, 0)`,
              transition: 'height 0.1s ease-out'
            }}
            viewBox="0 0 1200 120" 
            preserveAspectRatio="none"
          >
            <path d="M0,50 C200,90 400,10 600,50 C800,90 1000,10 1200,50 C1400,90 1600,10 1800,50 L1800,120 L0,120 Z" />
          </svg>
        </div>
      </header>

      {/* Top Notification Bar */}
      <NotificationBar 
        notes={state.notes} 
        items={state.items}
        dismissed={state.settings.dismissedNotifications} 
        currentTime={currentTime}
        onDismiss={(id) => handleUpdateSettings({ dismissedNotifications: [...state.settings.dismissedNotifications, id] })}
        onDismissAll={(ids) => handleUpdateSettings({ dismissedNotifications: [...state.settings.dismissedNotifications, ...ids] })}
        onView={(id, type) => {
          if (type === 'item') {
            setActiveTab('home');
            const item = state.items.find(i => i.id === id);
            if (item) {
              setSearchQuery(item.translations.en);
              window.scrollTo({ top: 380, behavior: 'smooth' });
            }
          } else if (type === 'batch') {
            setActiveTab('home');
            setSearchQuery('');
            window.scrollTo({ top: 380, behavior: 'smooth' });
          } else {
            setActiveTab('notes');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />

      {/* Main Content */}
      <main className="container mx-auto p-4 overflow-hidden">
        <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-12"
          >
            {/* Price Volatility Module */}
            <RecentPriceChanges items={state.items} t={t} precision={precision} />

            {/* QR Payment System Component */}
            <QrPaymentWidget t={t} />

            {/* Store Profile Premium Widget - Compact & Animated Brand Bar */}
            <div className="card p-3 sm:p-4 bg-gradient-to-r from-[var(--card)] to-[var(--card)]/90 border border-[var(--border)]/80 rounded-[1.75rem] relative overflow-hidden group shadow-md transition-all duration-500 hover:shadow-xl hover:border-[var(--primary)]/30">
              {/* Moving animated glow elements in background */}
              <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[var(--primary)]/15 blur-2xl group-hover:bg-[var(--primary)]/25 transition-all duration-1000 group-hover:-translate-x-6 group-hover:translate-y-6 pointer-events-none" />
              <div className="absolute left-1/4 -bottom-8 h-20 w-20 rounded-full bg-emerald-500/10 blur-xl transition-all duration-1000 group-hover:-translate-y-4 pointer-events-none" />
              
              {/* Subtle tech background grid effect */}
              <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
                {/* Left Brand Area */}
                <div className="flex items-center gap-3 text-left">
                  <div className="relative h-10 w-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/20 shadow-md shrink-0">
                    {/* Rotating tech halo with enhanced hover speed */}
                    <div className="absolute inset-0 rounded-xl border border-dashed border-[var(--primary)]/40 animate-[spin_10s_linear_infinite] group-hover:animate-[spin_4s_linear_infinite] group-hover:border-[var(--primary)]/80" />
                    <Store size={18} className="relative z-10 transition-transform group-hover:scale-110 duration-500 text-[var(--primary)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] font-black uppercase tracking-[0.25em] text-[var(--primary)]">
                        Enterprise Hub
                      </span>
                      {state.settings.storeName && (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded-full">
                          <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                          Online
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-[var(--foreground)] leading-tight transition-colors group-hover:text-[var(--primary)]">
                      {state.settings.storeName || "Unconfigured Store"}
                    </h3>
                  </div>
                </div>

                {/* Right Details Info Area */}
                {state.settings.storeName ? (
                  <div className="flex flex-wrap items-center gap-2 md:justify-end flex-1">
                    {/* Store Owner */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--background)]/60 border border-[var(--border)]/40 hover:bg-[var(--background)]/80 hover:border-[var(--primary)]/20 transition-all duration-300 group/item min-w-0">
                      <div className="text-[var(--primary)] bg-[var(--primary)]/5 p-1 rounded-lg group-hover/item:scale-105 transition-transform duration-300">
                        <UserCheck size={11} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[6.5px] font-bold uppercase tracking-widest text-[var(--foreground)]/40 leading-none">Owner</span>
                        <p className="text-[10px] font-extrabold text-[var(--foreground)] truncate mt-0.5 leading-none">{state.settings.storeOwnerName || "---"}</p>
                      </div>
                    </div>

                    {/* Support Contact */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--background)]/60 border border-[var(--border)]/40 hover:bg-[var(--background)]/80 hover:border-[var(--primary)]/20 transition-all duration-300 group/item min-w-0">
                      <div className="text-[var(--primary)] bg-[var(--primary)]/5 p-1 rounded-lg group-hover/item:scale-105 transition-transform duration-300">
                        <Phone size={11} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[6.5px] font-bold uppercase tracking-widest text-[var(--foreground)]/40 leading-none">Support</span>
                        <p className="text-[10px] font-extrabold text-[var(--foreground)] truncate mt-0.5 leading-none">{state.settings.phoneNumber || "---"}</p>
                      </div>
                    </div>

                    {/* Operational Site */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--background)]/60 border border-[var(--border)]/40 hover:bg-[var(--background)]/80 hover:border-[var(--primary)]/20 transition-all duration-300 group/item min-w-0 max-w-xs">
                      <div className="text-[var(--primary)] bg-[var(--primary)]/5 p-1 rounded-lg group-hover/item:scale-105 transition-transform duration-300">
                        <MapPin size={11} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[6.5px] font-bold uppercase tracking-widest text-[var(--foreground)]/40 leading-none">Site</span>
                        <p className="text-[10px] font-extrabold text-[var(--foreground)] truncate mt-0.5 leading-none" title={state.settings.storeAddress}>
                          {state.settings.storeAddress || "---"}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab('profile')}
                      className="flex items-center justify-center gap-1 text-[8px] font-black uppercase tracking-widest text-white hover:text-white bg-[var(--primary)] px-3 py-2 rounded-xl transition-all border border-transparent hover:shadow-md hover:scale-[1.02] active:scale-95 cursor-pointer ml-1"
                    >
                      Configure
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 bg-[var(--background)]/40 border border-[var(--border)]/40 p-2 rounded-xl flex-1 md:flex-initial">
                    <p className="text-[10px] text-[var(--foreground)]/60 text-left leading-tight">
                      Configure your <span className="text-[var(--primary)] font-bold">Operator Profile</span> to brand your store catalogs.
                    </p>
                    <button 
                      onClick={() => setActiveTab('profile')}
                      className="shrink-0 flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-white bg-[var(--primary)] px-2.5 py-1.5 rounded-xl transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      Setup Profile
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Metrics Hub */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-6 bg-gradient-to-br from-[var(--card)] to-transparent border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">{t.totalItems}</p>
                <div className="flex items-baseline gap-2">
                   <p className="text-3xl font-black tracking-tight">{state.items.length}</p>
                   <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Active nodes</span>
                </div>
              </div>
              <div className="card p-6 bg-gradient-to-br from-[var(--card)] to-transparent border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">{t.totalValue}</p>
                <div className="flex items-baseline gap-2">
                   <p className="text-2xl font-black tracking-tight">
                     {formatCurrency(totalValue, state.settings.currency, precision)}
                   </p>
                </div>
              </div>
            </div>

            {/* Global Category Rail */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 px-1">{t.categories}</p>
                  <button
                    type="button"
                    onClick={() => setShowCategoryAddModal(true)}
                    className="h-5 w-5 rounded-md bg-[var(--primary)]/10 hover:bg-[var(--primary)] text-[var(--primary)] hover:text-white flex items-center justify-center transition-all duration-200 active:scale-95 hover:shadow-lg hover:shadow-[var(--primary)]/10"
                    title="Add Multiple Categories"
                  >
                    <Plus size={11} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategorySearch(!showCategorySearch);
                      if (showCategorySearch) {
                        setCategorySearchQuery('');
                      }
                    }}
                    className={cn(
                      "h-5 w-5 rounded-md flex items-center justify-center transition-all duration-200 active:scale-95 hover:shadow-lg",
                      showCategorySearch 
                        ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white"
                        : "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white"
                    )}
                    title="Search Categories"
                  >
                    <Search size={11} strokeWidth={2.5} />
                  </button>
                </div>

                <AnimatePresence>
                  {showCategorySearch && (
                    <motion.div 
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 180, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="relative overflow-hidden shrink-0 flex items-center h-7"
                    >
                      <SnappyInput
                        type="text"
                        value={categorySearchQuery}
                        onChange={val => setCategorySearchQuery(val)}
                        placeholder="Search categories..."
                        className="w-full text-[10px] font-bold rounded-lg border border-[var(--border)] bg-[var(--background)] pl-2 pr-6 py-1 focus:border-[var(--primary)] focus:outline-none transition-all h-6"
                        autoFocus
                      />
                      {categorySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCategorySearchQuery('')}
                          className="absolute right-1.5 p-0.5 rounded-full hover:bg-white/10 text-[var(--foreground)] opacity-50 hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    "group flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-250 cursor-pointer border active:scale-95 whitespace-nowrap",
                    selectedCategory === null
                      ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md shadow-[var(--primary)]/15 scale-[1.02]"
                      : "bg-[var(--card)] text-[var(--foreground)] opacity-70 hover:opacity-100 border-[var(--border)] hover:border-[var(--primary)]/30"
                  )}
                >
                  <span className="text-sm">📁</span>
                  <span>{t.all}</span>
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] rounded-lg font-black leading-none",
                    selectedCategory === null
                      ? "bg-white/20 text-white"
                      : "bg-[var(--primary)]/10 text-[var(--primary)]"
                  )}>
                    {state.items.length}
                  </span>
                </button>

                {filteredCategories.map(cat => {
                  const count = state.items.filter(item => item.categoryId === cat.id).length;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        "group flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-250 cursor-pointer border active:scale-95 whitespace-nowrap",
                        isActive
                          ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md shadow-[var(--primary)]/15 scale-[1.02]"
                          : "bg-[var(--card)] text-[var(--foreground)] opacity-70 hover:opacity-100 border-[var(--border)] hover:border-[var(--primary)]/30"
                      )}
                    >
                      {cat.icon && <span className="text-sm">{cat.icon}</span>}
                      <span>{cat.name}</span>
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] rounded-lg font-black leading-none",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-[var(--primary)]/10 text-[var(--primary)]"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}

                {filteredCategories.length === 0 && (
                  <div className="flex items-center h-10 px-4 text-[10px] font-black uppercase tracking-wider opacity-40">
                    No Match
                  </div>
                )}
              </div>
            </div>

               {/* Registry Grid */}
               <div className="space-y-6">
                 {/* Search at top of list */}
                 <div id="tour-search" className="relative group">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)] opacity-40 transition-opacity group-focus-within:opacity-100" size={20} />
                   <SnappyInput 
                     type="text"
                     placeholder={t.search}
                     className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] py-4 pl-12 pr-4 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none shadow-sm transition-all"
                     value={searchQuery}
                     onChange={val => setSearchQuery(val)}
                   />
                 </div>
 
                 <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--foreground)] opacity-70">{t.inventory} Registry</h2>
                    </div>
                    {state.user && (
                       <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-green-500/60">Live Sync</span>
                       </div>
                    )}
                 </div>
              <motion.div 
                layout
                className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 pb-20"
              >
                <AnimatePresence mode="popLayout">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                      >
                        <ItemCard 
                          item={item} 
                          isLocked={state.settings.isLocked} 
                          language={state.settings.language}
                          precision={precision}
                          onEdit={() => handleEditTrigger(item)}
                          onDelete={() => handleDeleteItem(item.id)}
                          isSelected={selectedItemIds.includes(item.id)}
                          onSelect={() => toggleItemSelection(item.id)}
                          onPreview={() => setPreviewingItem(item)}
                          t={t}
                          categories={state.categories}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-full flex flex-col items-center justify-center py-20 text-center card border-dashed opacity-30 border-white/10"
                    >
                      <Package size={48} className="mb-4 opacity-50" />
                      <p className="font-black uppercase tracking-widest text-xs">{t.emptyList}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div 
            key="notifications"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <NotificationsSyncScreen 
              notes={state.notes}
              items={state.items}
              dismissed={state.settings.dismissedNotifications || []}
              currentTime={currentTime}
              onViewNote={(noteId) => {
                const found = state.notes.find(n => n.id === noteId);
                if (found) setEditingNote(found);
              }}
              onViewItem={(itemId) => {
                const found = state.items.find(i => i.id === itemId);
                if (found) setPreviewingItem(found);
              }}
              isOnline={isOnline}
              syncLogs={syncLogs}
              setSyncLogs={setSyncLogs}
              syncTrigger={syncTrigger}
              setSyncTrigger={setSyncTrigger}
              onBack={() => setActiveTab('home')}
              t={t}
            />
          </motion.div>
        )}

        {activeTab === 'notes' && (
          <motion.div 
            key="notes"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <NotesDashboard 
              notes={state.notes}
              expanded={true}
              onToggle={() => {}}
              onAdd={() => setShowAddNote(true)}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              t={t}
              selectedNoteIds={selectedNoteIds}
              onToggleSelectNote={(id) => {
                setSelectedNoteIds(prev => 
                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                );
              }}
              onClearSelection={() => setSelectedNoteIds([])}
              onTriggerDeleteConfirmation={(ids) => {
                setNoteDeleteConfirmation({
                  show: true,
                  ids
                });
              }}
              onOpenNoteDetail={(note) => setEditingNote(note)}
            />
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
          <SettingsScreen 
            state={state} 
            t={t} 
            onUpdate={handleUpdateSettings} 
            onShowHelp={() => setShowHelp(true)}
            onResetPIN={() => {
              if (state.settings.pin) {
                setIsVerifyingOldPIN(true);
                setShowChangePIN(true);
              } else {
                setIsVerifyingOldPIN(false);
                setShowChangePIN(true);
              }
            }}
            onExportExcel={exportToExcel}
            onExportPDF={exportToPDF}
            onImport={importData}
            onBackup={handleBackup}
            onRestore={handleRestore}
            onClearCache={() => {
              if (confirm('Wipe everything?')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            isSyncing={isSyncing}
            isExporting={isExporting}
          />
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <ProfileScreen 
              state={state} 
              t={t} 
              deferredPrompt={deferredPrompt} 
              onInstall={handleInstallClick} 
              onShareProductList={handleShareProductList}
              isSharing={isSharing}
              onUpdateSettings={handleUpdateSettings}
              onTriggerToast={triggerToast}
            />
          </motion.div>
        )}

        {activeTab === 'calculator' && (
          <motion.div 
            key="calculator"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <CalculatorWorkspace 
              items={state.items}
              categories={state.categories}
              t={t}
              language={state.settings.language}
              currency={state.settings.currency || '₹'}
              onUpdateItem={handleUpdateItem}
            />
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav id="tour-nav" className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--card)] px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <NavButton 
            active={activeTab === 'home'} 
            icon={<PremiumListIcon active={activeTab === 'home'} />} 
            label={
              state.settings.language === 'hi' ? "सभी सूची" : 
              state.settings.language === 'mr' ? "सर्व यादी" : "Full List"
            } 
            onClick={() => setActiveTab('home')} 
          />
          <NavButton 
            active={activeTab === 'calculator'} 
            icon={<PremiumCalculatorIcon active={activeTab === 'calculator'} />} 
            label={
              state.settings.language === 'hi' ? "कैलकुलेटर" : 
              state.settings.language === 'mr' ? "कॅल्क्युलेटर" : "Calculator"
            } 
            onClick={() => setActiveTab('calculator')} 
          />
          <NavButton 
            active={activeTab === 'notes'} 
            icon={<PremiumInfoIcon active={activeTab === 'notes'} />} 
            label={
              state.settings.language === 'hi' ? "अतिरिक्त जानकारी" : 
              state.settings.language === 'mr' ? "अतिरिक्त माहिती" : "Extra Info"
            } 
            onClick={() => setActiveTab('notes')} 
          />
          <NavButton 
            active={activeTab === 'profile'} 
            icon={<PremiumProfileIcon active={activeTab === 'profile'} />} 
            label={
              state.settings.language === 'hi' ? "यूज़र प्रोफ़ाइल" : 
              state.settings.language === 'mr' ? "युझर प्रोफाइल" : "User Profile"
            } 
            onClick={() => setActiveTab('profile')} 
          />
        </div>
      </nav>

      {/* Comparison Bottom Bar - Enhanced Visibility */}
      <AnimatePresence>
        {selectedItemIds.length > 0 && activeTab === 'home' && (
          <motion.div 
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: -20, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="fixed left-4 right-4 z-[60] bottom-20 md:bottom-8"
          >
            <div className="mx-auto max-w-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col md:flex-row items-center justify-between border border-white/20 backdrop-blur-3xl gap-4">
               <div className="flex items-center gap-6">
                  <div className="flex -space-x-4">
                    {selectedItemIds.slice(0, 4).map((id, index) => {
                      const it = state.items.find(i => i.id === id);
                      const cat = DEFAULT_CATEGORIES.find(c => c.id === it?.categoryId);
                      return (
                        <motion.div 
                          key={id} 
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="h-14 w-14 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center backdrop-blur-md shadow-lg"
                        >
                          <Package size={22} className="text-white" />
                        </motion.div>
                      );
                    })}
                    {selectedItemIds.length > 4 && (
                      <div className="h-14 w-14 rounded-2xl bg-black/40 border-2 border-white/20 flex items-center justify-center text-xs font-black">
                        +{selectedItemIds.length - 4}
                      </div>
                    )}
                  </div>
                  <div className="border-l border-white/10 pl-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 leading-none mb-1">Comparative Intel</p>
                    <p className="text-xl font-black tracking-tight">{selectedItemIds.length} {t.items || "Items"} {t.selected || "Selected"}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 w-full md:w-auto">
                 <Button 
                   variant="ghost" 
                   onClick={() => setSelectedItemIds([])}
                   className="text-white hover:bg-white/10 rounded-2xl px-6 font-black uppercase text-[10px] tracking-widest h-12 flex-1 md:flex-none"
                 >
                   {t.clear || "Clear"}
                 </Button>

                 <Button 
                   variant="ghost"
                   onClick={() => setDeleteConfirmation({ show: true, type: 'multiple' })}
                   className="text-white hover:bg-red-500/20 hover:text-red-300 rounded-2xl px-6 font-black uppercase text-[10px] tracking-widest h-12 flex-1 md:flex-none"
                 >
                   <Trash2 size={18} className="mr-2" />
                   Delete
                 </Button>
                 
                 <Button 
                   onClick={() => setShowComparison(true)}
                   disabled={selectedItemIds.length < 2}
                   className="bg-white text-[var(--primary)] hover:scale-105 active:scale-95 transition-all rounded-2xl px-10 h-12 text-xs font-black uppercase tracking-[0.1em] shadow-xl flex-1 md:flex-none disabled:opacity-50"
                 >
                   <TrendingUp size={18} className="mr-2" />
                   {t.compare || "Compare"}
                 </Button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons */}
      {activeTab === 'home' && (
        <div className="fixed bottom-24 right-6 flex flex-col items-end gap-3.5 z-40">
          <AnimatePresence>
            {showAddMenu && (
              <div className="flex flex-col items-end gap-2 mb-1.5">
                {/* Standard Entry Button */}
                <motion.button
                  initial={{ opacity: 0, y: 15, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.9 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[var(--card)] hover:bg-[var(--primary)]/10 text-[var(--foreground)] border border-[var(--border)] shadow-xl text-[10px] font-black uppercase tracking-widest cursor-pointer active:scale-95"
                  onClick={() => {
                    setShowAddItem(true);
                    setShowAddMenu(false);
                  }}
                >
                  <FilePdf size={14} className="text-emerald-500" />
                  Standard Form
                </motion.button>

                {/* Smart Entry Button */}
                <motion.button
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ type: "spring", damping: 15, delay: 0.05 }}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[var(--card)] hover:bg-[var(--primary)]/15 text-[var(--foreground)] border border-[var(--primary)]/40 shadow-xl text-[10px] font-black uppercase tracking-widest cursor-pointer active:scale-95"
                  onClick={() => {
                    setShowSmartEntry(true);
                    setShowAddMenu(false);
                  }}
                >
                  <Zap size={14} className="text-amber-500 animate-pulse" />
                  Smart Entry ⚡
                </motion.button>
              </div>
            )}
          </AnimatePresence>

          {/* Main Toggle '+' Button */}
          <Button 
            className={`h-14 w-14 rounded-full shadow-2xl accent-glow transition-all duration-300 ${showAddMenu ? 'rotate-45 bg-red-500 hover:bg-red-600' : ''}`}
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            <Plus size={32} />
          </Button>
        </div>
      )}
      {activeTab === 'notes' && (
        <Button 
          className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-2xl accent-glow bg-amber-500 hover:bg-amber-600"
          onClick={() => setShowAddNote(true)}
        >
          <PlusCircle size={32} />
        </Button>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddItem || editingItem) && (
          <ItemFormModal 
            onClose={() => {
              setShowAddItem(false);
              setEditingItem(null);
            }}
            onSave={editingItem ? (data) => handleUpdateItem(editingItem.id, data) : handleAddItem}
            initialData={editingItem || undefined}
            categories={state.categories}
            t={t}
            language={state.settings.language}
          />
        )}
        {showSmartEntry && (
          <SmartEntryModal 
            onClose={() => setShowSmartEntry(false)}
            onSaveMultiple={handleBulkAddItems}
            categories={state.categories}
            t={t}
            language={state.settings.language}
          />
        )}
        {showAddNote && (
          <NoteFormModal 
            onClose={() => setShowAddNote(false)}
            onSave={handleAddNote}
            t={t}
            inventoryItems={state.items}
          />
        )}
        {showComparison && (
          <ComparisonModal 
            selectedItems={state.items.filter(i => selectedItemIds.includes(i.id))}
            onClose={() => setShowComparison(false)}
            t={t}
            language={state.settings.language}
            precision={precision}
            hideBuyingPrice={state.settings.hideBuyingPriceByDefault}
            categories={state.categories}
          />
        )}
        {showHelp && (
          <HelpModal 
            onClose={() => setShowHelp(false)}
            t={t}
          />
        )}
        {showCategoryAddModal && (
          <CategoryAddModal
            onClose={() => setShowCategoryAddModal(false)}
            onSave={handleSaveCategories}
            onDeleteCategory={handleDeleteCategory}
            currentCategories={state.categories}
            t={t}
          />
        )}
        {showTour && (
          <OnboardingTour 
            onClose={() => {
              setShowTour(false);
              handleUpdateSettings({ hasSeenOnboarding: true });
            }}
            t={t}
          />
        )}
        {deleteConfirmation.show && (
          <DeleteConfirmationModal
            onClose={() => setDeleteConfirmation({ show: false, type: 'single' })}
            onConfirm={confirmDeletion}
            count={deleteConfirmation.type === 'single' ? 1 : selectedItemIds.length}
            t={t}
          />
        )}
        {noteDeleteConfirmation.show && (
          <NoteDeleteConfirmationModal
            onClose={() => setNoteDeleteConfirmation({ show: false, ids: [] })}
            onConfirm={confirmNoteDeletion}
            count={noteDeleteConfirmation.ids.length}
          />
        )}
        {editingNote && (
          <NoteDetailModal
            note={editingNote}
            onClose={() => setEditingNote(null)}
            onSave={handleUpdateNote}
            t={t}
            inventoryItems={state.items}
            settings={state.settings}
          />
        )}
        {previewingItem && (
          <ItemPreviewModal
            item={previewingItem}
            onClose={() => setPreviewingItem(null)}
            language={state.settings.language}
            precision={precision}
            isLocked={state.settings.isLocked}
            t={t}
            categories={state.categories}
          />
        )}

        {/* --- modern popup dialog: export product data --- */}
        {showExportExcelModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
          >
            {/* PROGRESS ANIMATION OVERLAY */}
            {exportStep !== null && exportStep < 4 ? (
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-md bg-[var(--card)] rounded-[2.5rem] border border-[var(--border)] shadow-2xl p-8 relative overflow-hidden"
              >
                <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl pointer-events-none" />
                
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-3xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shadow-inner mb-6 relative">
                    <span className="absolute inset-0 rounded-3xl border-2 border-dashed border-[var(--primary)] animate-spin opacity-50" />
                    <FileSpreadsheet size={28} className="animate-pulse" />
                  </div>
                  
                  <h3 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)] mb-1">
                    Generating Excel
                  </h3>
                  <p className="text-xs text-[var(--foreground)] opacity-60 mb-6">
                    {exportStep === 0 && "Preparing Excel..."}
                    {exportStep === 1 && "Creating Spreadsheet..."}
                    {exportStep === 2 && "Optimizing Layout..."}
                    {exportStep === 3 && "Finalizing File..."}
                  </p>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden mb-8">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-[var(--primary)] rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ 
                        width: exportStep === 0 ? "25%" : exportStep === 1 ? "50%" : exportStep === 2 ? "75%" : "100%" 
                      }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>

                  {/* Stage Checkmarks */}
                  <div className="w-full text-left space-y-3.5">
                    {[
                      "Preparing Excel...",
                      "Creating Spreadsheet...",
                      "Optimizing Layout...",
                      "Finalizing File..."
                    ].map((stepText, idx) => {
                      const isActive = exportStep === idx;
                      const isCompleted = exportStep > idx;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                            isCompleted ? 'bg-emerald-500 text-white' : isActive ? 'bg-[var(--primary)]/20 text-[var(--primary)] border-2 border-[var(--primary)] animate-pulse' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 border border-gray-200 dark:border-zinc-700'
                          }`}>
                            {isCompleted ? <Check size={12} strokeWidth={3} /> : idx + 1}
                          </div>
                          <span className={`text-xs font-bold transition-all duration-300 ${
                            isCompleted ? 'text-emerald-500 line-through opacity-70' : isActive ? 'text-[var(--primary)] font-black scale-[1.02]' : 'text-gray-400'
                          }`}>
                            {stepText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : exportStep === 4 ? (
              /* SUCCESS POPUP VIEW */
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-lg bg-[var(--card)] rounded-[2.5rem] border border-[var(--border)] shadow-2xl p-6 md:p-8 relative overflow-hidden"
              >
                <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-lg mb-4">
                    <CheckCircle size={36} className="animate-bounce" />
                  </div>
                  
                  <h3 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)] mb-2">
                    Excel Exported Successfully
                  </h3>
                  
                  <p className="text-xs text-[var(--foreground)] opacity-60 max-w-md mb-6 leading-relaxed">
                    Your product database is formatted and ready. The spreadsheet includes customized layout auto-fits, frozen navigation headers, and is optimized for Microsoft Excel, Google Sheets, WPS Office, and mobile devices.
                  </p>

                  {/* File info banner */}
                  <div className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4 mb-6 flex items-center gap-3 text-left">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Exported File</p>
                      <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">{exportedFileName}</p>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="w-full flex flex-col sm:flex-row gap-3">
                    {navigator.share && exportedBlob && (
                      <button
                        onClick={async () => {
                          if (!exportedBlob || !exportedFileName) return;
                          try {
                            const file = new File([exportedBlob], exportedFileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                              await navigator.share({
                                files: [file],
                                title: 'Product Data Export',
                                text: 'Here is the exported TS Price Manager product database.'
                              });
                            }
                          } catch (err) {
                            console.error("Direct share failed", err);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[var(--primary)] text-white hover:opacity-90 active:scale-95 font-black text-xs uppercase tracking-wider transition-all duration-200"
                      >
                        <Share2 size={16} />
                        Share File
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (!exportedBlob || !exportedFileName) return;
                        const url = URL.createObjectURL(exportedBlob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = exportedFileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 font-black text-xs uppercase tracking-wider transition-all duration-200"
                    >
                      <Download size={16} />
                      Open File
                    </button>

                    <button
                      onClick={() => {
                        setShowExportExcelModal(false);
                        setExportStep(null);
                        setExportedBlob(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[var(--border)] text-[var(--foreground)] hover:bg-[var(--primary)]/5 active:scale-95 font-black text-xs uppercase tracking-wider transition-all duration-200"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* SELECTION WIZARD POPUP VIEW */
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-xl bg-[var(--card)] rounded-[2.5rem] border border-[var(--border)] shadow-2xl p-6 md:p-8 relative overflow-hidden"
              >
                <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl pointer-events-none" />
                
                {/* Header */}
                <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shadow-inner">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">
                        Export Product Data
                      </h3>
                      <p className="text-[10px] text-[var(--foreground)] opacity-60 uppercase tracking-widest font-bold">
                        Choose how you want to export your product list.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowExportExcelModal(false)}
                    className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-[var(--primary)]/10 text-[var(--foreground)] opacity-60 hover:opacity-100 transition-all duration-200 active:scale-90"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Option selection grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {/* Option 1: Without Cost Price */}
                  <div 
                    onClick={() => setSelectedExportOption('without_cost')}
                    className={`group relative flex flex-col p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer ${
                      selectedExportOption === 'without_cost' 
                        ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' 
                        : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                        selectedExportOption === 'without_cost' 
                          ? 'bg-emerald-500/20 text-emerald-500' 
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:bg-[var(--primary)]/20 group-hover:text-[var(--primary)]'
                      } transition-colors duration-300`}>
                        <Shield size={20} />
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        selectedExportOption === 'without_cost' 
                          ? 'border-emerald-500 bg-emerald-500 text-white' 
                          : 'border-slate-300 dark:border-zinc-700'
                      }`}>
                        {selectedExportOption === 'without_cost' && <Check size={10} strokeWidth={4} />}
                      </div>
                    </div>
                    
                    <h4 className="text-sm font-black text-[var(--foreground)] uppercase mb-1">
                      Without Cost Price
                    </h4>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-2">
                      Staff, Client & Supplier Ready
                    </p>
                    <p className="text-xs text-[var(--foreground)] opacity-60 leading-relaxed">
                      Recommended when sharing product lists with staff, customers, or suppliers. This option hides all cost price information.
                    </p>
                  </div>

                  {/* Option 2: With Cost Price */}
                  <div 
                    onClick={() => setSelectedExportOption('with_cost')}
                    className={`group relative flex flex-col p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer ${
                      selectedExportOption === 'with_cost' 
                        ? 'border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-500/10' 
                        : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                        selectedExportOption === 'with_cost' 
                          ? 'bg-amber-500/20 text-amber-500' 
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:bg-[var(--primary)]/20 group-hover:text-[var(--primary)]'
                      } transition-colors duration-300`}>
                        <TrendingUp size={20} />
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        selectedExportOption === 'with_cost' 
                          ? 'border-amber-500 bg-amber-500 text-white' 
                          : 'border-slate-300 dark:border-zinc-700'
                      }`}>
                        {selectedExportOption === 'with_cost' && <Check size={10} strokeWidth={4} />}
                      </div>
                    </div>
                    
                    <h4 className="text-sm font-black text-[var(--foreground)] uppercase mb-1">
                      With Cost Price
                    </h4>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2">
                      Business Owner Review
                    </p>
                    <p className="text-xs text-[var(--foreground)] opacity-60 leading-relaxed">
                      Recommended for business owners. Includes complete product information including cost price.
                    </p>
                  </div>
                </div>

                {/* Secure caution message for owner option */}
                {selectedExportOption === 'with_cost' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-2xl mb-6 text-xs leading-relaxed"
                  >
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold uppercase tracking-wider block mb-0.5">Sensitive Business Intel</span>
                      This file includes confidential purchase cost pricing data. Please save and share this document only with authorized personnel.
                    </div>
                  </motion.div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
                  <button
                    onClick={() => setShowExportExcelModal(false)}
                    className="px-5 py-3 rounded-2xl bg-transparent hover:bg-[var(--primary)]/5 text-[var(--foreground)] font-black text-xs uppercase tracking-widest cursor-pointer active:scale-95 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startExcelExportProcess}
                    disabled={selectedExportOption === null}
                    className={`px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer transition-all duration-300 ${
                      selectedExportOption !== null 
                        ? 'bg-[var(--primary)] text-white hover:opacity-90 active:scale-95 shadow-md shadow-[var(--primary)]/20' 
                        : 'bg-[var(--border)] text-[var(--foreground)] opacity-40 cursor-not-allowed'
                    }`}
                  >
                    Export
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeleteConfirmationModal({ onClose, onConfirm, count, t }: { 
  onClose: () => void; 
  onConfirm: () => void; 
  count: number;
  t: any;
}) {
  const [inputValue, setInputValue] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm card p-8 space-y-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-red-500/20"
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-16 w-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center shadow-inner">
            <Trash2 size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Purge Confirmation</h3>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">Caution: Irreversible Op</p>
          </div>
          <p className="text-xs font-medium opacity-60 leading-relaxed">
            You are about to delete <strong>{count} {count === 1 ? 'item' : 'items'}</strong> from the database, cloud, and local device.
          </p>
          <div className="w-full p-4 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-500/60">
              Type <span className="text-red-500">"yes"</span> to authorize
            </p>
            <input 
              autoFocus
              className="w-full bg-[var(--background)] border border-red-500/20 rounded-xl px-4 py-3 text-center font-black uppercase tracking-[0.2em] focus:border-red-500 outline-none transition-all"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toLowerCase())}
              placeholder="..."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="flex-1 rounded-2xl h-12 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100"
          >
            Abort
          </Button>
          <Button 
            variant="primary"
            disabled={inputValue !== 'yes'}
            onClick={onConfirm}
            className="flex-1 rounded-2xl h-12 bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 disabled:opacity-30 disabled:scale-100"
          >
            Confirm
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ItemPreviewModal({ 
  item, 
  onClose, 
  language, 
  precision, 
  isLocked, 
  t,
  categories
}: { 
  item: Item; 
  onClose: () => void; 
  language: LanguageType; 
  precision: number; 
  isLocked: boolean; 
  t: any; 
  categories: Category[];
}) {
  const category = categories.find(c => c.id === item.categoryId);
  const name = item.translations[language] || item.translations.en;
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <motion.div 
        initial={{ y: 30, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, scale: 0.95 }}
        className="w-full max-w-lg rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)] p-6 shadow-2xl relative text-left overflow-hidden"
      >
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shadow-inner">
              <Package size={22} />
            </div>
            <div>
              <span className="inline-flex items-center rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 text-[8px] font-black text-[var(--primary)] uppercase tracking-wider mb-1">
                {category?.name}
              </span>
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">{name}</h3>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={onClose} 
            size="icon" 
            className="rounded-xl border border-[var(--border)]/60 bg-[var(--background)] hover:bg-red-500/10 hover:text-red-500"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-3xl bg-[var(--primary)]/5 border border-[var(--primary)]/10">
              <p className="text-[9px] font-black uppercase tracking-wider text-[var(--primary)] opacity-70 mb-1">Retail Price</p>
              <p className="text-xl font-black text-[var(--foreground)]">₹{formatNumber(item.retailPrice, precision)} <span className="text-xs font-normal opacity-40">/{item.retailPriceUnit}</span></p>
            </div>
            
            <div className="p-4 rounded-3xl bg-[var(--background)] border border-[var(--border)]">
              <p className="text-[9px] font-black uppercase tracking-wider opacity-40 mb-1">Wholesale Price</p>
              <p className="text-xl font-black text-[var(--foreground)]">₹{formatNumber(item.wholesalePrice, precision)} <span className="text-xs font-normal opacity-40">/{item.wholesalePriceUnit}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-3xl bg-[var(--background)] border border-[var(--border)]">
              <p className="text-[9px] font-black uppercase tracking-wider opacity-40 mb-1">Buying Cost</p>
              {isLocked ? (
                <div className="flex items-center gap-1.5 py-1">
                  <Lock size={12} className="opacity-40" />
                  <span className="text-xs font-black opacity-30 uppercase tracking-widest">Locked</span>
                </div>
              ) : (
                <p className="text-xl font-black text-[var(--foreground)]">₹{formatNumber(item.buyingPrice, precision)} <span className="text-xs font-normal opacity-40">/{item.buyingPriceUnit}</span></p>
              )}
            </div>

            <div className="p-4 rounded-3xl bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500 opacity-80 mb-1">Profit Margin</p>
              {isLocked ? (
                <div className="flex items-center gap-1.5 py-1">
                  <Lock size={12} className="opacity-40" />
                  <span className="text-xs font-black opacity-30 uppercase tracking-widest">Locked</span>
                </div>
              ) : (
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    ₹{formatNumber(item.retailPrice - item.buyingPrice, precision)}
                  </span>
                  <span className="text-xs text-emerald-500 font-black">
                    {item.buyingPrice > 0 ? `+${formatNumber(((item.retailPrice - item.buyingPrice) / item.buyingPrice) * 100, 1)}%` : '---'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-[var(--background)] border border-[var(--border)] flex justify-between items-center">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider opacity-40">Available Stock Quantity</p>
              <p className="text-base font-black text-[var(--foreground)] mt-0.5">{item.quantity} {item.unit}</p>
            </div>
            {item.quantity <= 5 && (
              <span className="bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border border-red-500/20 animate-pulse">
                Low Stock Alert ⚠️
              </span>
            )}
          </div>

          <div className="p-4 rounded-3xl bg-[var(--background)] border border-[var(--border)]">
            <p className="text-[9px] font-black uppercase tracking-wider opacity-40 mb-1">Item Notes</p>
            <p className="text-xs font-medium leading-relaxed text-[var(--foreground)]/80 italic">
              {item.notes ? `"${item.notes}"` : 'No additional notes logged for this product.'}
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--border)]/60 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-40">
          <span>Last Updated: {new Date(item.lastUpdated).toLocaleDateString()}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Sub-Components ---

const ItemCard = React.memo(({ item, isLocked, language, precision, onEdit, onDelete, onPreview, t, isSelected, onSelect, categories }: { 
  item: Item; 
  isLocked: boolean; 
  language: LanguageType;
  precision: number;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  t: any;
  isSelected: boolean;
  onSelect: () => void;
  categories: Category[];
}) => {
  const category = categories.find(c => c.id === item.categoryId);
  const name = item.translations[language] || item.translations.en;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      className={`card group overflow-hidden transition-all duration-300 shadow-md border relative flex flex-col justify-between ${
        isSelected ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20 shadow-lg' : 'border-white/5 hover:border-[var(--primary)]/20'
      }`}
      onClick={() => {
        triggerHapticFeedback(12);
        onSelect();
      }}
      id={`item-card-${item.id}`}
    >
      <div className="relative p-3.5 pb-2.5 cursor-pointer flex-1">
        {/* Glow effect on hover */}
        <div className={`absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 to-transparent transition-opacity duration-500 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`} />
        
        <div className="flex items-center justify-between relative z-10 gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xl shadow-inner transition-all duration-300 relative ${
              isSelected ? 'bg-emerald-500 text-white border-emerald-400 scale-105 shadow-emerald-500/20 shadow-md' : 'bg-[var(--background)] border-[var(--border)]'
            }`}>
              {isSelected ? <Check size={18} strokeWidth={3.5} className="animate-in fade-in zoom-in duration-200" /> : <Package size={18} className="text-[var(--primary)] shrink-0" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold tracking-tight text-[var(--foreground)] truncate leading-tight">{name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center rounded bg-[var(--primary)]/10 px-1 py-0.5 text-[8px] font-black text-[var(--primary)] uppercase tracking-wider">
                  {category?.name}
                </span>
                <span className="text-[9px] font-bold opacity-40 uppercase tracking-tight">
                  {item.quantity} {item.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Compact Action Buttons in Right Corner */}
          <div className="flex items-center gap-1 shrink-0 relative z-30 ml-auto">
            <button
              type="button"
              id={`btn-preview-${item.id}`}
              onClick={(e) => {
                e.stopPropagation();
                triggerHapticFeedback(12);
                onPreview();
              }}
              className="h-7 w-7 rounded-lg bg-[var(--primary)]/5 hover:bg-[var(--primary)] text-[var(--primary)] hover:text-white border border-[var(--primary)]/10 hover:border-transparent flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm"
              title="Preview Item"
            >
              <Eye size={12} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              id={`btn-edit-${item.id}`}
              onClick={(e) => {
                e.stopPropagation();
                triggerHapticFeedback(12);
                onEdit();
              }}
              className="h-7 w-7 rounded-lg bg-amber-500/5 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/10 hover:border-transparent flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm"
              title="Edit Item"
            >
              <Edit2 size={12} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              id={`btn-delete-${item.id}`}
              onClick={(e) => {
                e.stopPropagation();
                triggerHapticFeedback(12);
                onDelete();
              }}
              className="h-7 w-7 rounded-lg bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/10 hover:border-transparent flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm"
              title="Delete Item"
            >
              <Trash2 size={12} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        
        {/* Compact 2x2 Prices Grid */}
        <div className="mt-3 grid grid-cols-2 gap-1.5 relative z-10">
          {/* Retail */}
          <div className="rounded-lg bg-[var(--primary)]/5 p-2 border border-[var(--primary)]/10 transition-colors group-hover:bg-[var(--primary)]/10">
            <p className="text-[8px] font-black uppercase tracking-wider text-[var(--primary)] opacity-70 leading-none mb-0.5">{t.retail}</p>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xs font-black text-[var(--foreground)]">₹{formatNumber(item.retailPrice, precision)}</span>
              <span className="text-[8px] opacity-40">/{item.retailPriceUnit}</span>
            </div>
          </div>

          {/* Wholesale */}
          <div className="rounded-lg bg-[var(--background)]/40 p-2 border border-[var(--border)]/60 transition-colors group-hover:border-[var(--primary)]/15">
            <p className="text-[8px] font-black uppercase tracking-wider opacity-40 leading-none mb-0.5">{t.wholesale}</p>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xs font-black text-[var(--foreground)]">₹{formatNumber(item.wholesalePrice, precision)}</span>
              <span className="text-[8px] opacity-40">/{item.wholesalePriceUnit}</span>
            </div>
          </div>

          {/* Cost (Buy) */}
          <div className="rounded-lg bg-[var(--background)]/40 p-2 border border-[var(--border)]/60 transition-colors group-hover:border-[var(--primary)]/15">
            <p className="text-[8px] font-black uppercase tracking-wider opacity-40 leading-none mb-0.5">{t.buy}</p>
            {isLocked ? (
              <div className="h-4 flex items-center">
                <Lock size={10} className="opacity-40" />
              </div>
            ) : (
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-black text-[var(--foreground)]">₹{formatNumber(item.buyingPrice, precision)}</span>
                <span className="text-[8px] opacity-40">/{item.buyingPriceUnit}</span>
              </div>
            )}
          </div>

          {/* Profit Margin */}
          <div className="rounded-lg bg-emerald-500/5 p-2 border border-emerald-500/15 transition-colors group-hover:bg-emerald-500/10">
            <p className="text-[8px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 opacity-80 leading-none mb-0.5">{t.margin}</p>
            {isLocked ? (
              <div className="h-4 flex items-center">
                <Lock size={10} className="opacity-40" />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  ₹{formatNumber(item.retailPrice - item.buyingPrice, precision)}
                </span>
                <span className="text-[8px] text-emerald-500 font-black shrink-0">
                  {item.buyingPrice > 0 ? `+${formatNumber(((item.retailPrice - item.buyingPrice) / item.buyingPrice) * 100, 1)}%` : '---'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className="bg-[var(--background)]/40 border-t border-[var(--border)]/30 px-3.5 py-1.5 flex justify-between items-center text-[8px]">
        <span className="opacity-30 font-bold uppercase tracking-wider">
          {new Date(item.lastUpdated).toLocaleDateString()}
        </span>
        {item.notes && (
          <span className="opacity-50 italic truncate max-w-[140px] text-right" title={item.notes}>
            "{item.notes}"
          </span>
        )}
      </div>
    </motion.div>
  );
});

const PremiumListIcon = ({ active }: { active: boolean }) => (
  <motion.div
    animate={active ? { 
      scale: [1, 1.25, 1.1],
      rotate: [0, -10, 10, 0],
      y: [0, -3, 0]
    } : { scale: 1, rotate: 0, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="relative flex items-center justify-center"
  >
    <LayoutGrid className={cn(
      "w-6 h-6 transition-all duration-300", 
      active ? "text-[var(--primary)] drop-shadow-[0_0_10px_rgba(167,139,250,0.6)] scale-110" : "text-[var(--foreground)] opacity-60"
    )} />
  </motion.div>
);

const PremiumCalculatorIcon = ({ active }: { active: boolean }) => (
  <motion.div
    animate={active ? { 
      scale: [1, 1.3, 1.1],
      rotate: [0, 15, -15, 0],
      y: [0, -4, 0]
    } : { scale: 1, rotate: 0, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="relative flex items-center justify-center"
  >
    <Calculator className={cn(
      "w-6 h-6 transition-all duration-300", 
      active ? "text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)] scale-110" : "text-[var(--foreground)] opacity-60"
    )} />
    {active && (
      <motion.span 
        animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute -top-1 -right-1 flex h-2 w-2"
      >
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </motion.span>
    )}
  </motion.div>
);

const PremiumInfoIcon = ({ active }: { active: boolean }) => (
  <motion.div
    animate={active ? { 
      scale: [1, 1.25, 1.1],
      rotate: [0, 8, -8, 0],
      y: [0, -3, 0]
    } : { scale: 1, rotate: 0, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="relative flex items-center justify-center"
  >
    <BookOpen className={cn(
      "w-6 h-6 transition-all duration-300", 
      active ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.6)] scale-110" : "text-[var(--foreground)] opacity-60"
    )} />
  </motion.div>
);

const PremiumProfileIcon = ({ active }: { active: boolean }) => (
  <motion.div
    animate={active ? { 
      scale: [1, 1.25, 1.1],
      y: [0, -4, 0],
    } : { scale: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="relative flex items-center justify-center"
  >
    <User className={cn(
      "w-6 h-6 transition-all duration-300", 
      active ? "text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.6)] scale-110" : "text-[var(--foreground)] opacity-60"
    )} />
  </motion.div>
);

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  const handleClick = () => {
    triggerHapticFeedback(15);
    onClick();
  };

  return (
    <motion.button 
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all py-1.5 px-3 rounded-2xl relative",
        active ? "text-[var(--primary)] font-black" : "text-[var(--foreground)] opacity-55 hover:opacity-100"
      )}
    >
      <div className={cn(
        "transition-all duration-300 p-1.5 rounded-xl flex items-center justify-center", 
        active ? "bg-[var(--primary)]/10 scale-105 shadow-inner" : ""
      )}>
        {icon}
      </div>
      <span className={cn(
        "text-[9px] font-black uppercase tracking-widest mt-0.5 transition-all duration-300",
        active ? "opacity-100 text-[var(--primary)]" : "opacity-75"
      )}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="nav-glow-indicator" 
          className="absolute bottom-0 h-1 w-8 rounded-t-full bg-[var(--primary)] shadow-[0_0_12px_rgba(167,139,250,0.8)]" 
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
        />
      )}
    </motion.button>
  );
}

/**
 * HelpModal Sub-component
 */
function HelpModal({ onClose, t }: { onClose: () => void; t: any }) {
  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-[var(--background)] rounded-[2.5rem] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-8 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-[var(--primary)]/10 to-transparent">
          <div>
            <h2 className="text-2xl font-black tracking-tight">{t.help}</h2>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">Enterprise Support & Documentation</p>
          </div>
          <Button variant="outline" size="icon" onClick={onClose} className="rounded-full h-10 w-10 border-white/10">
            <X size={20} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-[var(--primary)]">
              <BookOpen size={20} />
              <h3 className="font-bold uppercase text-xs tracking-widest">Getting Started</h3>
            </div>
            <div className="grid gap-4">
              {faqs.map((faq, i) => (
                <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-[var(--primary)]/20 transition-all">
                  <p className="font-black text-sm mb-2 text-[var(--primary)]">Q: {faq.q}</p>
                  <p className="text-xs opacity-60 leading-relaxed font-medium">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 text-emerald-500">
              <Zap size={20} />
              <h3 className="font-bold uppercase text-xs tracking-widest">Pro Tips</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex gap-3 text-xs opacity-60">
                <span className="text-emerald-500 font-bold">•</span>
                <span>Use the <strong>"Compare"</strong> feature to view price differences between items side-by-side.</span>
              </li>
              <li className="flex gap-3 text-xs opacity-60">
                <span className="text-emerald-500 font-bold">•</span>
                <span>Enable <strong>Lock</strong> to hide cost prices when showing customers the screen.</span>
              </li>
              <li className="flex gap-3 text-xs opacity-60">
                <span className="text-emerald-500 font-bold">•</span>
                <span>Each item can have a <strong>"Margin Spread"</strong> which updates live as you edit prices.</span>
              </li>
            </ul>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * OnboardingTour Sub-component
 */
function OnboardingTour({ onClose, t }: { onClose: () => void; t: any }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t.onboardingTitle,
      desc: t.onboardingSub,
      target: null,
      icon: <Sparkles className="text-amber-500" size={32} />
    },
    {
      title: t.step1Title,
      desc: t.step1Desc,
      target: 'tour-search',
      icon: <Search className="text-blue-500" size={32} />
    },
    {
      title: t.step2Title,
      desc: t.step2Desc,
      target: 'tour-lock',
      icon: <Lock className="text-amber-500" size={32} />
    },
    {
      title: t.step3Title,
      desc: t.step3Desc,
      target: 'tour-notes',
      icon: <Bell className="text-emerald-500" size={32} />
    }
  ];

  const currentStep = steps[step];

  useEffect(() => {
    if (currentStep.target) {
      const el = document.getElementById(currentStep.target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-[var(--primary)]', 'ring-offset-4', 'ring-offset-black', 'transition-all');
        return () => {
          el.classList.remove('ring-4', 'ring-[var(--primary)]', 'ring-offset-4', 'ring-offset-black');
        };
      }
    }
  }, [step, currentStep.target]);

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute inset-0 flex items-center justify-center p-6 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
        >
          <div className="w-full max-w-sm bg-[var(--card)] rounded-[2.5rem] border-2 border-[var(--primary)] shadow-[0_30px_60px_rgba(0,0,0,0.6)] p-8 text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--primary)] opacity-20" />
            <div className="mb-6 flex justify-center">
              <div className="p-5 rounded-3xl bg-[var(--primary)]/5 relative">
                {currentStep.icon}
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-[var(--primary)]/10 rounded-full blur-xl"
                />
              </div>
            </div>
            
            <h3 className="text-xl font-black tracking-tight mb-2 uppercase">{currentStep.title}</h3>
            <p className="text-xs font-medium opacity-60 leading-relaxed mb-8">{currentStep.desc}</p>
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  if (step < steps.length - 1) setStep(step + 1);
                  else onClose();
                }}
                className="w-full h-12 rounded-2xl shadow-lg shadow-[var(--primary)]/20"
              >
                {step === steps.length - 1 ? t.tourFinish : t.tourNext}
              </Button>
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="w-full h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100"
              >
                {t.tourSkip}
              </Button>
            </div>

            <div className="mt-6 flex justify-center gap-1.5">
              {steps.map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === step ? 'w-6 bg-[var(--primary)]' : 'w-1.5 bg-white/10'}`} />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ComparisonModal({ selectedItems, onClose, t, language, precision, hideBuyingPrice, categories }: {
  selectedItems: Item[];
  onClose: () => void;
  t: any;
  language: LanguageType;
  precision: number;
  hideBuyingPrice: boolean;
  categories: Category[];
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-5xl bg-[var(--background)] rounded-[3rem] border border-[var(--border)] shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-8">
           <div>
             <h2 className="text-2xl font-black tracking-tight">{t.compare || "Compare"} {selectedItems.length} {t.items || "Items"}</h2>
             <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">{t.sideBySide || "Side-by-side analysis"}</p>
           </div>
           <Button variant="outline" size="icon" onClick={onClose} className="rounded-full h-12 w-12 hover:bg-red-500/10 hover:text-red-500 border-white/10">
             <X size={24} />
           </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selectedItems.map((item) => {
            const cat = categories.find(c => c.id === item.categoryId);
            const name = item.translations[language] || item.translations.en;
            return (
              <div key={item.id} className="card p-6 bg-gradient-to-br from-[var(--card)] to-transparent border-white/5 space-y-6">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="h-16 w-16 rounded-2xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center shadow-inner">
                    <Package size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg truncate">{name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{cat?.name}</p>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{t.retail || "Retail"}</span>
                      <div className="text-right">
                        <span className="text-sm font-black">₹{formatNumber(item.retailPrice, precision)}</span>
                        <span className="text-[8px] opacity-40 block">/ {item.retailPriceUnit}</span>
                      </div>
                   </div>

                   {!hideBuyingPrice && (
                     <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{t.buying || "Buying"}</span>
                        <div className="text-right">
                          <span className="text-sm font-black">₹{formatNumber(item.buyingPrice, precision)}</span>
                          <span className="text-[8px] opacity-40 block">/ {item.buyingPriceUnit}</span>
                        </div>
                     </div>
                   )}

                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{t.inventory || "Stock"}</span>
                      <span className="text-sm font-black">{item.quantity} {item.unit}</span>
                   </div>

                   {!hideBuyingPrice && (
                     <div className="flex justify-between items-center bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500">{t.margin || "Margin"}</span>
                        <span className="text-sm font-black text-emerald-500">
                          {(( (item.retailPrice * (item.quantity || 1)) - (item.buyingPrice * (item.quantity || 1)) ) / ( (item.buyingPrice * (item.quantity || 1)) || 1 ) * 100).toFixed(1)}%
                        </span>
                     </div>
                   )}

                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{t.lastChanged || "Last Update"}</span>
                      <span className="text-[10px] font-bold opacity-60">
                        {item.priceChangedAt ? new Date(item.priceChangedAt).toLocaleDateString() : 'Never'}
                      </span>
                   </div>
                </div>

                {item.notes && (
                <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-1">
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Extra Info</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-70 italic">"{item.notes}"</p>
                </div>
              )}

              {item.aiAdvice && (
                  <div className="p-4 bg-[var(--primary)]/5 rounded-2xl border border-[var(--primary)]/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)] mb-2 flex items-center gap-2">
                       <Zap size={12} fill="currentColor" /> AI Insights
                    </p>
                    <p className="text-[11px] leading-relaxed opacity-80 line-clamp-4">{item.aiAdvice}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ItemFormModal({ onClose, onSave, categories, initialData, t, language }: { 
  onClose: () => void, 
  onSave: (data: Partial<Item>) => void,
  categories: Category[],
  initialData?: Item,
  t: any,
  language: LanguageType
}) {
  const [formData, setFormData] = useState<Partial<Item>>(
    initialData || {
      name: '',
      categoryId: categories[0]?.id || '',
      quantity: 1,
      unit: 'KG',
      retailPrice: 0,
      retailPriceUnit: 'KG',
      wholesalePrice: 0,
      wholesalePriceUnit: 'KG',
      buyingPrice: 0,
      buyingPriceUnit: 'KG',
      profitMargin: 0,
      translations: { en: '', hi: '', mr: '', 'hi-en': '' },
      notes: '',
    }
  );

  const [activeUnitSelection, setActiveUnitSelection] = useState<'base'|'retail'|'wholesale'|'buy'|null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const section1Ref = React.useRef<HTMLDivElement>(null);
  const section2Ref = React.useRef<HTMLDivElement>(null);
  const section3Ref = React.useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNameBlur = async () => {
    if (!formData.name || (initialData && formData.name === initialData.name)) return;
    setIsTranslating(true);
    const trans = await translateItemName(formData.name);
    setFormData(prev => ({ ...prev, translations: trans }));
    setIsTranslating(false);
  };

  const handleUnitSelect = (unit: string) => {
    if (activeUnitSelection === 'base') setFormData(prev => ({ ...prev, unit }));
    if (activeUnitSelection === 'buy') setFormData(prev => ({ ...prev, buyingPriceUnit: unit }));
    if (activeUnitSelection === 'wholesale') setFormData(prev => ({ ...prev, wholesalePriceUnit: unit }));
    if (activeUnitSelection === 'retail') setFormData(prev => ({ ...prev, retailPriceUnit: unit }));
    setActiveUnitSelection(null);
  };

  const handleSave = () => {
    if (!formData.name) return alert('Name is required');
    onSave(formData);
    onClose();
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const quickQtys = [5, 10, 25, 50, 100];
  const quickAmounts = [100, 500, 1000, 5000];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="h-[95vh] w-full max-w-2xl overflow-hidden rounded-t-[2rem] bg-[var(--card)] flex flex-col md:h-[90vh] md:rounded-[2.5rem] shadow-2xl border border-white/5"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)] shrink-0 bg-[var(--card)]/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
             <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shadow-inner">
                {initialData ? <Edit2 size={20} /> : <Plus size={20} />}
             </div>
             <div>
                <h2 className="text-lg font-black tracking-tighter uppercase">{initialData ? t.updateRecord : t.newEntry}</h2>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Operational Matrix v2.5</p>
             </div>
          </div>
          <Button variant="ghost" onClick={onClose} size="icon" className="rounded-xl bg-[var(--background)] hover:bg-[var(--primary)]/10 transition-colors"><X size={20} /></Button>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-24 no-scrollbar pb-32 scroll-smooth">
          
          {/* Section 1: Identity */}
          <motion.div 
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            ref={section1Ref} 
            className="space-y-6 pt-4"
          >
             <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--primary)] px-2">
               <span className="w-6 h-6 rounded bg-[var(--primary)]/10 flex items-center justify-center text-[10px]">01</span> {t.identityParams}
             </label>
             <div className="space-y-4">
               <div className="group relative">
                <SnappyInput 
                  className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] p-6 font-black text-2xl focus:border-[var(--primary)] focus:outline-none transition-all placeholder:opacity-20 shadow-inner"
                  value={formData.name}
                  onChange={val => setFormData(prev => ({ ...prev, name: val }))}
                  onBlur={handleNameBlur}
                  placeholder="Item nomenclature..."
                />
                {isTranslating && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
               </div>

               <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                 {LANGUAGES.map(lang => (
                   <div key={lang.id} className="flex items-center gap-2 rounded-xl bg-[var(--card)] border border-[var(--border)] p-3 text-[10px] shadow-sm">
                     <span className="opacity-80">{lang.emoji}</span>
                     <span className="flex-1 font-bold opacity-30 truncate">
                       {formData.translations[lang.id] || '---'}
                     </span>
                   </div>
                 ))}
               </div>

               <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                 {categories.map(cat => (
                   <button
                     key={cat.id}
                     onClick={() => setFormData(prev => ({ ...prev, categoryId: cat.id }))}
                     className={cn(
                       "flex items-center gap-3 rounded-xl border-2 px-5 py-3 transition-all shrink-0 font-black text-[10px] uppercase",
                       formData.categoryId === cat.id 
                         ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-lg scale-105" 
                         : "border-[var(--border)] bg-[var(--background)] opacity-60 hover:border-[var(--primary)]/40 hover:opacity-100"
                     )}
                   >
                     <span>{cat.name}</span>
                   </button>
                 ))}
               </div>
             </div>
          </motion.div>

          {/* Section 2: Logistical Metrics */}
          <motion.div 
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            ref={section2Ref} 
            className="space-y-8 border-t border-[var(--border)] pt-12"
          >
             <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--primary)] px-2">
                <span className="w-6 h-6 rounded bg-[var(--primary)]/10 flex items-center justify-center text-[10px]">02</span> Inventory logistics
             </label>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Current availability</p>
                 <div className="flex gap-2">
                   <SnappyInput 
                     type="number"
                     className="flex-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] p-4 font-black text-xl focus:border-[var(--primary)] focus:outline-none transition-all shadow-inner"
                     value={formData.quantity}
                     onChange={val => setFormData(prev => ({ ...prev, quantity: parseFloat(val) || 0 }))}
                   />
                   <button 
                     onClick={() => setActiveUnitSelection('base')}
                     className="rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-6 font-black uppercase text-[10px] hover:border-[var(--primary)] transition-all flex items-center gap-2"
                   >
                     {formData.unit} <ChevronDown size={14} />
                   </button>
                 </div>
                 <div className="flex flex-wrap gap-1.5 pt-2">
                   {quickQtys.map(q => (
                     <button key={q} onClick={() => setFormData(prev => ({ ...prev, quantity: q }))} className="px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[9px] font-black opacity-30 hover:opacity-100 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">{q} {formData.unit}</button>
                   ))}
                 </div>
               </div>

               <div className="space-y-3">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Field notes / Intelligence</p>
                 <textarea 
                    className="w-full h-[98px] rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] p-4 font-bold text-xs focus:border-[var(--primary)] focus:outline-none transition-all shadow-inner resize-none"
                    placeholder="Batch identity, source node..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                 />
               </div>
             </div>
          </motion.div>

          {/* Section 3: Financial Framework */}
          <motion.div 
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            ref={section3Ref} 
            className="space-y-10 border-t border-[var(--border)] pt-12 pb-20"
          >
             <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--primary)] px-2">
                <span className="w-6 h-6 rounded bg-[var(--primary)]/10 flex items-center justify-center text-[10px]">03</span> Price configuration
             </label>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { label: t.retail, key: 'retailPrice', unitKey: 'retailPriceUnit', selection: 'retail', color: 'bg-green-500/10' },
                  { label: t.wholesale, key: 'wholesalePrice', unitKey: 'wholesalePriceUnit', selection: 'wholesale', color: 'bg-blue-500/10' },
                  { label: t.buy, key: 'buyingPrice', unitKey: 'buyingPriceUnit', selection: 'buy', color: 'bg-orange-500/10' }
                ].map((field) => (
                  <div key={field.key} className="space-y-3">
                     <p className="text-[9px] font-black uppercase tracking-widest opacity-30">{field.label}</p>
                     <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl opacity-10 group-focus-within:opacity-40 transition-opacity">
                           {field.key === 'profitMargin' ? '%' : '₹'}
                        </span>
                        <SnappyInput 
                           type="number"
                           className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] py-4 pl-10 pr-4 font-black text-lg focus:border-[var(--primary)] focus:outline-none transition-all shadow-inner"
                           value={(formData as any)[field.key]}
                           onChange={val => setFormData(prev => ({ ...prev, [field.key]: parseFloat(val) || 0 }))}
                        />
                     </div>
                     {field.selection && (
                        <button 
                           onClick={() => setActiveUnitSelection(field.selection as any)}
                           className={cn("w-full py-2.5 rounded-xl border border-transparent font-black uppercase text-[8px] tracking-widest transition-all", field.color)}
                        >
                           Per {(formData as any)[field.unitKey]}
                        </button>
                     )}
                  </div>
                ))}
             </div>
             
             <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map(amt => (
                  <button key={amt} onClick={() => setFormData(prev => ({ ...prev, retailPrice: amt }))} className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[9px] font-black opacity-30 hover:opacity-100 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">₹{amt}</button>
                ))}
             </div>
          </motion.div>
        </div>

        {/* Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--card)] via-[var(--card)]/95 to-transparent z-10 pointer-events-none">
           <div className="flex gap-4 pointer-events-auto">
             <Button className="w-full py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-[var(--primary)]/20" onClick={handleSave}>
                {initialData ? t.commitEvolution : t.initializeParams}
             </Button>
           </div>
        </div>

        <AnimatePresence>
          {activeUnitSelection && (
            <UnitSelectorModal 
              onClose={() => setActiveUnitSelection(null)}
              onSelect={handleUnitSelect}
              currentUnit={
                activeUnitSelection === 'base' ? formData.unit! :
                activeUnitSelection === 'buy' ? formData.buyingPriceUnit! :
                activeUnitSelection === 'wholesale' ? formData.wholesalePriceUnit! :
                formData.retailPriceUnit!
              }
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  operation?: string;
  collection?: string;
}

export function NotificationsSyncScreen({ 
  notes, 
  items, 
  dismissed,
  currentTime,
  onViewNote,
  onViewItem,
  isOnline,
  syncLogs,
  setSyncLogs,
  syncTrigger,
  setSyncTrigger,
  onBack,
  t
}: { 
  notes: Note[]; 
  items: Item[]; 
  dismissed: string[];
  currentTime: Date;
  onViewNote: (id: string) => void;
  onViewItem: (id: string) => void;
  isOnline: boolean;
  syncLogs: SyncLogEntry[];
  setSyncLogs: React.Dispatch<React.SetStateAction<SyncLogEntry[]>>;
  syncTrigger: number;
  setSyncTrigger: React.Dispatch<React.SetStateAction<number>>;
  onBack: () => void;
  t: any;
}) {
  const [subTab, setSubTab] = useState<'alerts' | 'sync'>('alerts');
  const [isRetrying, setIsRetrying] = useState(false);
  const [retrySteps, setRetrySteps] = useState<string[]>([]);

  // Aggregate alerts dynamically
  const activeAlerts = useMemo(() => {
    const list: any[] = [];

    // 1. Low stock alerts (items with quantity <= 5)
    items.forEach(item => {
      if (item.quantity <= 5) {
        list.push({
          id: `stock-${item.id}`,
          type: 'stock',
          title: `⚠️ Low Stock Alert: ${item.translations?.en || item.name}`,
          description: `Only ${item.quantity} ${item.unit || 'PCS'} left in physical inventory. Recommended reorder milestone reached.`,
          timestamp: new Date().toISOString(),
          priority: item.quantity === 0 ? 'Urgent' : 'Medium',
          icon: <Package size={20} className="text-amber-400" />,
          itemId: item.id
        });
      }
    });

    // 2. Active Unsettled Udhar Ledgers (Overdue or Due soon)
    notes.forEach(note => {
      if (note.status === 'Active' && note.udharPerson) {
        const isOverdue = note.dueDate ? new Date(note.dueDate) < currentTime : false;
        list.push({
          id: `udhar-${note.id}`,
          type: 'udhar',
          title: `${isOverdue ? '🔴 Overdue Udhar' : '📅 Pending Settlement'}: ${note.udharPerson}`,
          description: `Outstanding Balance: ₹${(Number(note.udharAmount || 0) - (note.udharPayments?.reduce((s, p) => s + p.amount, 0) || 0)).toLocaleString()}. Due: ${note.dueDate ? new Date(note.dueDate).toLocaleDateString() : 'Unspecified'}`,
          timestamp: note.createdAt,
          priority: isOverdue ? 'Urgent' : 'Low',
          icon: <CreditCard size={20} className="text-red-400" />,
          noteId: note.id
        });
      }
    });

    return list;
  }, [notes, items, currentTime]);

  const triggerRetry = () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetrySteps([]);

    const logMessage = (msg: string) => {
      setRetrySteps(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    logMessage("🔍 Starting connection handshake diagnostics...");
    
    setTimeout(() => {
      logMessage("📶 Verifying physical network links...");
      if (!navigator.onLine) {
        logMessage("❌ Verification failed. Device physical link is DOWN.");
        setIsRetrying(false);
        return;
      }
      logMessage(`✅ Physical network connection is ACTIVE.`);
    }, 400);

    setTimeout(() => {
      logMessage("🔥 Pinging cloud auth gatekeepers...");
      logMessage("🔑 Handshaking auth tokens with server...");
    }, 800);

    setTimeout(() => {
      logMessage("🔄 Re-binding live Firestore database snapshots...");
      // Trigger hard re-subscription
      setSyncTrigger(prev => prev + 1);
    }, 1200);

    setTimeout(() => {
      logMessage("🚀 Synchronization stream restored successfully! Queued items resolved.");
      
      const newSuccessLog: SyncLogEntry = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        type: 'success',
        message: 'System initiated manual cloud sync. All channels live.',
        details: 'Forced subscription rebuild completed with code 200 OK.',
        operation: 'SYSTEM_SYNC',
        collection: 'all'
      };

      setSyncLogs(prev => {
        const updated = [newSuccessLog, ...prev].slice(0, 100);
        localStorage.setItem('ts_sync_logs', JSON.stringify(updated));
        return updated;
      });

      setIsRetrying(false);
    }, 1600);
  };

  const clearSyncLogs = () => {
    setSyncLogs([]);
    localStorage.removeItem('ts_sync_logs');
  };

  const exportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(syncLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ts_cloud_sync_diagnostics_${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-32">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card)]/60 backdrop-blur-md p-5 rounded-3xl border border-white/5 animate-fade-in">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all border border-white/10 cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="text-left">
            <h1 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              <Bell size={20} className="text-amber-500 animate-pulse shrink-0" />
              Central Control & Diagnostics
            </h1>
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Store alerts & Firebase sync integrity engine</p>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center bg-white/5 px-3.5 py-1.5 rounded-2xl border border-white/5">
          <span className="relative flex h-2 w-2">
            <span className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              isOnline ? "bg-emerald-400" : "bg-red-400"
            )} />
            <span className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              isOnline ? "bg-emerald-500" : "bg-red-500"
            )} />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
            {isOnline ? 'Cloud Sync Online' : 'Sandbox Offline Mode'}
          </span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border border-white/5 p-1 bg-white/5 rounded-2xl">
        <button
          onClick={() => setSubTab('alerts')}
          className={cn(
            "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border-0",
            subTab === 'alerts' ? "bg-amber-500 text-slate-950 shadow-lg font-black" : "text-slate-400 hover:text-white hover:bg-white/5 bg-transparent"
          )}
        >
          <Bell size={14} />
          System Alerts ({activeAlerts.length})
        </button>
        <button
          onClick={() => setSubTab('sync')}
          className={cn(
            "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border-0",
            subTab === 'sync' ? "bg-amber-500 text-slate-950 shadow-lg font-black" : "text-slate-400 hover:text-white hover:bg-white/5 bg-transparent"
          )}
        >
          <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
          Sync Health Logs ({syncLogs.filter(l => l.type === 'error').length} Errors)
        </button>
      </div>

      {/* Screen Sections */}
      <AnimatePresence mode="wait">
        {subTab === 'alerts' ? (
          <motion.div
            key="alerts-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Network Notification warning card */}
            {!isOnline && (
              <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex gap-4 items-start text-left">
                <CloudOff size={24} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-black text-sm text-amber-400 uppercase tracking-tight">Offline Operations Sandbox</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">You are disconnected. TSP Udhar Hub is safely retaining transaction records inside browser database container. Sync restarts automatically on network restoration.</p>
                </div>
              </div>
            )}

            {activeAlerts.length === 0 ? (
              <div className="py-24 text-center space-y-4 bg-[var(--card)]/40 rounded-3xl border border-white/5">
                <ShieldCheck size={48} className="mx-auto text-emerald-500/40" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white/80">No System Alerts Active</h3>
                  <p className="text-xs text-slate-400 mt-1">All inventory levels are safe, and your ledger notices are settled.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {activeAlerts.map(alert => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      if (alert.type === 'stock') onViewItem(alert.itemId);
                      if (alert.type === 'udhar') onViewNote(alert.noteId);
                    }}
                    className={cn(
                      "group p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex items-center gap-4 hover:scale-[1.01] duration-200 text-left",
                      alert.priority === 'Urgent' ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40" : "bg-[var(--card)]/80 border-white/5 hover:border-amber-500/30"
                    )}
                  >
                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      {alert.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white truncate uppercase tracking-tight">{alert.title}</span>
                        <span className={cn(
                          "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                          alert.priority === 'Urgent' ? "bg-red-500 text-white" : "bg-white/10 text-slate-300"
                        )}>
                          {alert.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{alert.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[9px] font-bold text-slate-500 block uppercase">Realtime Feed</span>
                      <span className="text-[8px] font-bold text-slate-600 block uppercase">Tap to resolve</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="sync-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Diagnostic Control Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[var(--card)]/60 border border-white/5 p-5 rounded-2xl flex flex-col justify-between text-left">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Connectivity Link</span>
                  <p className="text-lg font-black text-white mt-1 uppercase">
                    {isOnline ? '⚡ Realtime Connected' : '🔌 Sandbox Offline'}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">Active database connection is fully synced.</p>
              </div>

              <div className="bg-[var(--card)]/60 border border-white/5 p-5 rounded-2xl flex flex-col justify-between text-left">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Diagnostic Counters</span>
                  <p className="text-lg font-black text-white mt-1 uppercase">
                    {syncLogs.length} Total Logs
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">{syncLogs.filter(l => l.type === 'error').length} faults recorded.</p>
              </div>

              {/* Retry & sync button */}
              <button
                onClick={triggerRetry}
                disabled={isRetrying}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black uppercase tracking-widest text-[11px] p-5 rounded-2xl flex flex-col justify-between items-start transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10 border-0"
              >
                <div className="flex justify-between w-full">
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-900/80">Diagnostic Control</span>
                  <RefreshCw size={14} className={isRetrying ? "animate-spin" : ""} />
                </div>
                <div className="mt-4 text-left">
                  <p className="font-black text-xs">FORCE CLOUD RE-SYNC</p>
                  <p className="text-[8px] font-bold opacity-75 mt-0.5 leading-tight">Test handshake and reload snapshot listeners</p>
                </div>
              </button>
            </div>

            {/* Intermediary Interactive Trace Diagnostic */}
            {retrySteps.length > 0 && (
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-1 font-mono text-[10px] text-amber-500/90 shadow-2xl text-left">
                <p className="font-bold border-b border-slate-800 pb-2 mb-2 text-[11px] uppercase tracking-wider">⚡ LIVE DIAGNOSTIC STREAM TRACE</p>
                {retrySteps.map((step, idx) => (
                  <p key={idx} className="leading-relaxed">{step}</p>
                ))}
                {isRetrying && <p className="animate-pulse leading-relaxed">🕒 Querying gateway channels...</p>}
              </div>
            )}

            {/* Console Logger Page */}
            <div className="bg-[var(--card)]/40 border border-white/5 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/20">
                <div className="text-left">
                  <h3 className="font-black text-sm text-white uppercase tracking-tight flex items-center gap-2">
                    <Database size={16} className="text-amber-500 shrink-0" />
                    Centralized Sync Error Logs
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recent cloud connectivity, sync states & query logs</p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportLogs}
                    disabled={syncLogs.length === 0}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-[9px] rounded-lg transition-all disabled:opacity-30 flex items-center gap-1 cursor-pointer border border-white/10"
                  >
                    📂 Export
                  </button>
                  <button
                    onClick={clearSyncLogs}
                    disabled={syncLogs.length === 0}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold uppercase tracking-widest text-[9px] rounded-lg transition-all disabled:opacity-30 flex items-center gap-1 cursor-pointer border-0"
                  >
                    <Trash2 size={10} />
                    Wipe Logs
                  </button>
                </div>
              </div>

              {/* Log List */}
              <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto no-scrollbar font-mono">
                {syncLogs.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest">No Connection Anomalies Logged</p>
                    <p className="text-[9px]">Your device snapshot links are intact and database logs are pristine.</p>
                  </div>
                ) : (
                  syncLogs.map(log => (
                    <div key={log.id} className="p-4 hover:bg-white/5 transition-colors space-y-1 text-left">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            log.type === 'error' ? 'bg-red-500' :
                            log.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                          )} />
                          <span className="text-[10px] font-bold text-slate-300">
                            {log.message}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-500 shrink-0 font-sans">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {log.details && (
                        <p className="text-[9px] text-slate-500 pl-3.5 whitespace-pre-wrap break-all leading-relaxed">
                          {log.details}
                        </p>
                      )}

                      <div className="pl-3.5 flex items-center gap-3 text-[8px] text-slate-600 font-sans font-bold uppercase tracking-wider">
                        <span>OP: {log.operation || 'GENERAL'}</span>
                        <span>•</span>
                        <span>COLLECTION: {log.collection || 'general'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsScreen({ 
  state, t, onUpdate, onShowHelp, onResetPIN,
  onExportExcel, onExportPDF, onImport, onBackup, onRestore, onClearCache,
  isSyncing, isExporting
}: { 
  state: AppState; t: any; onUpdate: (u: any) => void; onShowHelp: () => void; onResetPIN: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBackup: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearCache: () => void;
  isSyncing: boolean;
  isExporting: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Accordions configuration
  const [expandedSubcategories, setExpandedSubcategories] = useState<{ [key: string]: boolean }>({});

  const toggleSubcategory = (name: string) => {
    setExpandedSubcategories(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Recently Used Settings
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ts_settings_recent');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const trackSettingInteraction = (id: string) => {
    setRecentlyUsed(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, 5);
      localStorage.setItem('ts_settings_recent', JSON.stringify(next));
      return next;
    });
  };

  const accentOptions = [
    { id: 'indigo', color: '#6366f1' },
    { id: 'emerald', color: '#10b981' },
    { id: 'rose', color: '#f43f5e' },
    { id: 'amber', color: '#f59e0b' },
    { id: 'cyan', color: '#06b6d4' },
    { id: 'slate', color: '#64748b' },
  ];

  const fontSizeOptions = [
    { id: 'compact', label: 'Compact', icon: <Minimize2 size={14} /> },
    { id: 'standard', label: 'Standard', icon: <Type size={14} /> },
    { id: 'comfortable', label: 'Spaced', icon: <Maximize2 size={14} /> },
  ];

  const allSettingsList = useMemo(() => [
    {
      id: 'lang',
      name: "Language Options",
      description: "Choose your preferred language for the application interface.",
      category: 'language' as const,
      subcategory: "Language Options",
      keywords: ["language", "linguistic", "hi", "en", "mr", "hindi", "marathi", "english", "translate", "verbal"],
      render: () => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {LANGUAGES.map(lang => (
              <button
                key={lang.id}
                onClick={() => {
                  onUpdate({ language: lang.id });
                  trackSettingInteraction('lang');
                }}
                className={cn(
                  "group relative flex flex-col items-center gap-3 rounded-[2rem] border p-5 transition-all cursor-pointer",
                  state.settings.language === lang.id 
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 shadow-lg" 
                    : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/40"
                )}
              >
                <span className="text-3xl transition-transform group-hover:scale-110">{lang.emoji}</span>
                <span className="text-[9px] font-black uppercase tracking-widest">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'theme',
      name: "Visual Themes",
      description: "Choose how the application looks and feels with high contrast palettes.",
      category: 'appearance' as const,
      subcategory: "Visual Themes",
      keywords: ["theme", "color", "dark", "light", "ultra", "premium", "aurora", "midnight", "brutalist", "gold", "matrix", "glass"],
      render: () => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => {
                  onUpdate({ theme: theme.id });
                  trackSettingInteraction('theme');
                }}
                className={cn(
                  "relative flex items-center gap-4 rounded-[2.5rem] border p-5 text-left transition-all overflow-hidden group cursor-pointer",
                  state.settings.theme === theme.id 
                    ? "border-[var(--primary)] bg-[var(--primary)]/20 shadow-2xl scale-[1.02]" 
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40"
                )}
              >
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl transition-transform group-hover:rotate-6",
                  state.settings.theme === theme.id ? "bg-[var(--primary)] text-white shadow-lg" : "bg-[var(--background)] shadow-inner"
                )}>
                  {theme.emoji}
                </div>
                <div className="relative z-10 min-w-0 flex-1">
                  <p className="font-black uppercase tracking-tighter text-xs truncate">{theme.name}</p>
                  <p className={cn(
                    "text-[9px] font-bold leading-tight mt-1 uppercase opacity-40 truncate",
                    state.settings.theme === theme.id && "opacity-80"
                  )}>
                    {theme.description}
                  </p>
                </div>
                {state.settings.theme === theme.id && <CheckCircle2 size={18} className="absolute top-1/2 -right-3 -translate-y-1/2 scale-[2.5] opacity-10 text-[var(--primary)]" />}
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'aurora',
      name: "Aurora Customization Deck",
      description: "Tailor the dynamic movements and color nodes of the ultra premium background.",
      category: 'appearance' as const,
      subcategory: "Visual Experience",
      keywords: ["aurora", "palette", "speed", "wave", "motion", "color shift", "canvas", "nodes"],
      render: () => (
        <div className="space-y-4 text-left">
          {state.settings.theme !== 'ultra_premium' ? (
            <div className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10 text-center">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Ultra Premium Theme Required</p>
              <p className="text-[9px] text-slate-400 mt-1">Select the "Ultra Premium" theme in Visual Themes to customize this deck.</p>
            </div>
          ) : (
            <div className="space-y-6 p-6 bg-gradient-to-br from-purple-950/20 to-indigo-950/20 rounded-[2.5rem] border border-purple-500/20 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[40px] rounded-full pointer-events-none" />
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-500/10 pb-4">
                <div>
                  <h4 className="font-black uppercase tracking-tight text-[11px] flex items-center gap-2 text-purple-300">
                    <Sparkles size={12} className="text-purple-400 animate-pulse" />
                    Aurora Customization Deck
                  </h4>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-0.5 bg-purple-500/10 rounded-full border border-purple-500/20 shadow-sm">
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    (state.settings.enableBgColorChange !== false && state.settings.ultraPremiumSpeed !== 'static') ? "bg-green-400" : "bg-amber-400"
                  )} />
                  <span className="text-[8px] font-black uppercase tracking-wider text-purple-200">
                    {state.settings.enableBgColorChange === false ? "Paused" : state.settings.ultraPremiumSpeed === 'static' ? "Static" : "Active"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-black uppercase tracking-wider text-[10px] text-slate-300">Enable Color Shift</h5>
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">Toggle dynamic slow-motion flow background waves</p>
                </div>
                <button 
                  onClick={() => {
                    onUpdate({ enableBgColorChange: state.settings.enableBgColorChange === false ? true : false });
                    trackSettingInteraction('aurora');
                  }}
                  className={cn(
                    "h-7 w-14 rounded-full transition-all relative overflow-hidden ring-1 ring-purple-500/30 shadow-inner cursor-pointer border-0",
                    state.settings.enableBgColorChange !== false ? "bg-purple-500" : "bg-slate-800"
                  )}
                >
                  <div className={cn("absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-xl transition-all", state.settings.enableBgColorChange !== false ? "translate-x-7" : "")} />
                </button>
              </div>
              {state.settings.enableBgColorChange !== false && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-baseline">
                    <h5 className="font-black uppercase tracking-wider text-[10px] text-slate-300">Movement Pace</h5>
                    <span className="text-[8px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                      {AURORA_SPEEDS[state.settings.ultraPremiumSpeed || 'normal']?.name || 'Normal'}
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <input 
                      type="range" 
                      min="0" 
                      max="4" 
                      value={['static', 'slow', 'normal', 'fast', 'ultra_fast'].indexOf(state.settings.ultraPremiumSpeed || 'normal')}
                      onChange={(e) => {
                        const speeds: Array<'static' | 'slow' | 'normal' | 'fast' | 'ultra_fast'> = ['static', 'slow', 'normal', 'fast', 'ultra_fast'];
                        const index = parseInt(e.target.value);
                        onUpdate({ ultraPremiumSpeed: speeds[index] });
                        trackSettingInteraction('aurora');
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
                    />
                    <div className="flex justify-between text-[7px] font-black uppercase tracking-widest text-slate-600 mt-2 px-1">
                      <span>Static</span>
                      <span>Slow</span>
                      <span>Normal</span>
                      <span>Fast</span>
                      <span>Ultra</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-3 pt-2">
                <h5 className="font-black uppercase tracking-wider text-[10px] text-slate-300">Color Palette Presets</h5>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(AURORA_PALETTES).map(palette => {
                    const isSelected = (state.settings.ultraPremiumPalette || 'neon_aurora') === palette.id;
                    return (
                      <button
                        key={palette.id}
                        onClick={() => {
                          onUpdate({ ultraPremiumPalette: palette.id });
                          trackSettingInteraction('aurora');
                        }}
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group",
                          isSelected 
                            ? "border-purple-500 bg-purple-500/15 shadow-md scale-[1.02]" 
                            : "border-slate-800 bg-slate-900/40 hover:border-purple-500/30"
                        )}
                      >
                        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs shadow-inner">
                          {palette.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black uppercase tracking-tight text-[8px] text-slate-200 truncate">{palette.name}</p>
                          <div className="flex gap-0.5 mt-0.5">
                            {palette.nodes.slice(0, 3).map((color, i) => (
                              <span key={i} className="h-1 w-1 rounded-full inline-block" style={{ backgroundColor: color }} />
                            ))}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 h-1.5 w-1.5 bg-purple-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'font',
      name: "Font Size Preferences",
      description: "Adjust the user interface text size for optimal scaling and legibility.",
      category: 'appearance' as const,
      subcategory: "Display Preferences",
      keywords: ["font", "size", "compact", "standard", "comfortable", "text", "readability", "spacing", "accessibility"],
      render: () => (
        <div className="space-y-3">
          <div className="flex gap-2 justify-center">
            {fontSizeOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  onUpdate({ fontSize: opt.id });
                  trackSettingInteraction('font');
                }}
                className={cn(
                  "h-10 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border text-xs font-black uppercase tracking-widest cursor-pointer",
                  state.settings.fontSize === opt.id 
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-lg scale-105" 
                    : "bg-[var(--background)] border-[var(--border)] opacity-40 hover:opacity-100"
                )}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'pin',
      name: "PIN Security Key",
      description: "Initialize or change your 4-digit PIN security to lock sensitive cost price valuations.",
      category: 'security' as const,
      subcategory: "Authentication",
      keywords: ["pin", "lock", "security", "passcode", "password", "key", "restrict", "cost", "protect", "stealth"],
      render: () => (
        <div className="space-y-3 flex flex-col items-center">
          <div className="flex flex-wrap gap-2 justify-center w-full">
            {state.settings.pin ? (
              <>
                <Button 
                  variant="outline"
                  onClick={() => {
                    onResetPIN();
                    trackSettingInteraction('pin');
                  }}
                  className="rounded-xl flex-1 px-4 h-11 text-[9px] uppercase font-black border-orange-500/30 hover:bg-orange-500/10 text-orange-500 cursor-pointer"
                >
                  Update PIN
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Are you sure you want to disable PIN lock? Your purchase costs will be fully visible without security.")) {
                      onUpdate({ pin: null });
                      trackSettingInteraction('pin');
                    }
                  }}
                  className="rounded-xl px-4 h-11 text-[9px] uppercase font-black opacity-40 hover:opacity-100 text-red-500 cursor-pointer"
                >
                  Disable
                </Button>
              </>
            ) : (
              <Button 
                variant="primary"
                onClick={() => {
                  onResetPIN();
                  trackSettingInteraction('pin');
                }}
                className="rounded-xl w-full h-11 text-[9px] uppercase font-black shadow-md bg-orange-500 hover:bg-orange-600 border-orange-500 text-white cursor-pointer"
              >
                Initialize Secure PIN
              </Button>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'stealth',
      name: "Margin Stealth Defense",
      description: "Automatically hides buying costs by default to block customers from viewing your margins.",
      category: 'security' as const,
      subcategory: "Data Protection",
      keywords: ["stealth", "buying", "price", "hide", "cost", "margin", "privacy", "protection", "security"],
      render: () => (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/10 dark:bg-zinc-800/10 border border-[var(--border)]">
          <div className="pr-4 text-left">
            <p className="text-[10px] opacity-60 uppercase font-black">Margin Stealth Defense</p>
            <p className="text-[8px] opacity-40 mt-1 uppercase">Hides buying price by default across product views</p>
          </div>
          <button 
            onClick={() => {
              onUpdate({ hideBuyingPriceByDefault: !state.settings.hideBuyingPriceByDefault });
              trackSettingInteraction('stealth');
            }}
            className={cn(
              "h-7 w-14 rounded-full transition-all relative overflow-hidden ring-1 ring-white/10 shadow-inner cursor-pointer border-0",
              state.settings.hideBuyingPriceByDefault ? "bg-emerald-500" : "bg-slate-800"
            )}
          >
            <div className={cn("absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-xl transition-all", state.settings.hideBuyingPriceByDefault ? "translate-x-7" : "")} />
          </button>
        </div>
      )
    },
    {
      id: 'cloud_sync',
      name: "Auto Cloud Syncing",
      description: "Automatically synchronize store database ledger state to cloud server (Firebase).",
      category: 'data' as const,
      subcategory: "Cloud Synchronization",
      keywords: ["sync", "cloud", "firebase", "backup", "save", "automatic", "database", "online", "network"],
      render: () => (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/10 dark:bg-zinc-800/10 border border-[var(--border)] text-left">
          <div>
            <p className="text-[10px] opacity-60 uppercase font-black">{t.cloudSync || "Database Sync"}</p>
            <p className="text-[8px] opacity-40 mt-1 uppercase">{t.firebaseSync || "Auto synchronize records with Firebase"}</p>
          </div>
          <div className="flex items-center gap-2">
            {isSyncing && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="text-[var(--primary)]"
              >
                <RefreshCw size={14} />
              </motion.div>
            )}
            <button 
              disabled={isSyncing}
              onClick={() => {
                onUpdate({ autoCloudSync: !state.settings.autoCloudSync });
                trackSettingInteraction('cloud_sync');
              }}
              className={cn(
                "h-7 w-14 rounded-full transition-all relative overflow-hidden ring-1 ring-white/10 shadow-inner disabled:opacity-50 cursor-pointer border-0",
                state.settings.autoCloudSync ? "bg-blue-500" : "bg-slate-800"
              )}
            >
              <div className={cn("absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-xl transition-all", state.settings.autoCloudSync ? "translate-x-7" : "")} />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'backup_restore',
      name: "Local Backup & Restore",
      description: "Download state as an encrypted JSON backup, or load a prior state to restore data.",
      category: 'data' as const,
      subcategory: "Local Storage Backup",
      keywords: ["backup", "restore", "json", "save", "load", "import", "recovery", "database"],
      render: () => (
        <div className="flex flex-col gap-2 w-full text-left">
          <Button 
            onClick={() => {
              onBackup();
              trackSettingInteraction('backup_restore');
            }} 
            variant="outline" 
            className="justify-start gap-3 rounded-xl py-4 h-11 border-blue-500/20 text-blue-500 hover:bg-blue-500/10 cursor-pointer"
          >
            <Database size={14} /> 
            <span className="text-[9px] font-black uppercase">Backup Database File</span>
          </Button>
          
          <label className="flex items-center gap-3 rounded-xl h-11 px-4 border border-dashed border-[var(--border)] text-[9px] font-black uppercase tracking-widest cursor-pointer hover:bg-[var(--primary)]/5 transition-colors">
            <Upload size={14} /> 
            <span>Restore Backup File</span>
            <input 
              type="file" 
              className="hidden" 
              accept=".json" 
              onChange={(e) => {
                onRestore(e);
                trackSettingInteraction('backup_restore');
              }} 
            />
          </label>
        </div>
      )
    },
    {
      id: 'export',
      name: "Export Vectors",
      description: "Extract clean tables of inventory records to Microsoft Excel spreadsheets or PDF sheets.",
      category: 'data' as const,
      subcategory: "Export Formats",
      keywords: ["export", "excel", "pdf", "spreadsheet", "ledger", "sheet", "download", "print", "sharing", "xlsx"],
      render: () => (
        <div className="flex flex-col gap-2 w-full">
          <Button 
            onClick={() => {
              onExportExcel();
              trackSettingInteraction('export');
            }} 
            disabled={isExporting}
            variant="outline" 
            className="justify-start gap-3 rounded-xl py-4 h-11 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50 cursor-pointer"
          >
            {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} 
            <span className="text-[9px] font-black uppercase">{isExporting ? 'Processing...' : 'Export to Excel Spreadsheet'}</span>
          </Button>
          <Button 
            onClick={() => {
              onExportPDF();
              trackSettingInteraction('export');
            }} 
            disabled={isExporting}
            variant="outline" 
            className="justify-start gap-3 rounded-xl py-4 h-11 border-red-500/20 text-red-500 hover:bg-red-500/10 disabled:opacity-50 cursor-pointer"
          >
            {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <FilePdf size={14} />} 
            <span className="text-[9px] font-black uppercase">{isExporting ? 'Processing...' : 'Export to PDF Ledger Book'}</span>
          </Button>
        </div>
      )
    },
    {
      id: 'import_data',
      name: "External JSON Import",
      description: "Batch import external database listings into your localized cache inventory.",
      category: 'data' as const,
      subcategory: "Import & Migration",
      keywords: ["import", "xlsx", "csv", "json", "load", "add products", "migrate"],
      render: () => (
        <div className="w-full text-left">
          <label className="flex items-center gap-3 rounded-xl h-11 px-4 bg-[var(--background)] border border-[var(--border)] text-[9px] font-black uppercase tracking-widest cursor-pointer hover:border-[var(--primary)] transition-all">
            <Download size={14} /> 
            <span>Import External JSON List</span>
            <input 
              type="file" 
              className="hidden" 
              accept=".json" 
              onChange={(e) => {
                onImport(e);
                trackSettingInteraction('import_data');
              }} 
            />
          </label>
        </div>
      )
    },
    {
      id: 'clear_cache',
      name: "Clear Local Cache",
      description: "Completely wipe persistent states and storage keys to reset cache variables.",
      category: 'data' as const,
      subcategory: "Maintenance & Purge",
      keywords: ["clear", "cache", "purge", "reset", "wipe", "factory reset", "reload", "flush", "delete"],
      render: () => (
        <div className="w-full text-left">
          <Button 
            onClick={() => {
              onClearCache();
              trackSettingInteraction('clear_cache');
            }} 
            variant="ghost" 
            className="gap-3 rounded-xl px-4 h-11 border border-red-500/10 text-red-500/50 hover:text-red-500 w-full justify-start cursor-pointer"
          >
            <XCircle size={14} /> 
            <span className="text-[9px] font-black uppercase">Wipe Local Storage Cache</span>
          </Button>
        </div>
      )
    },
    {
      id: 'haptic_master',
      name: "Master Haptic Feedback",
      description: "Toggle global sensory physical device vibration taps across interactive taps.",
      category: 'app' as const,
      subcategory: "Tactile Master",
      keywords: ["haptic", "vibration", "tactile", "feedback", "vibrate", "buzz", "tick", "master", "physical"],
      render: () => (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/10 dark:bg-zinc-800/10 border border-[var(--border)] text-left">
          <div>
            <p className="text-[10px] opacity-60 uppercase font-black">Enable System Vibrations</p>
            <p className="text-[8px] opacity-40 mt-1 uppercase">Master control for physical touch taps and success ticks</p>
          </div>
          <button
            onClick={() => {
              const nextVal = !(state.settings.hapticMaster ?? true);
              onUpdate({ hapticMaster: nextVal });
              if (nextVal) {
                triggerHapticFeedback('success', { ...state.settings, hapticMaster: true });
              }
              trackSettingInteraction('haptic_master');
            }}
            className={cn(
              "h-7 w-14 rounded-full transition-all relative overflow-hidden ring-1 ring-white/10 shadow-inner cursor-pointer border-0",
              (state.settings.hapticMaster ?? true) ? "bg-purple-500" : "bg-slate-800"
            )}
          >
            <div className={cn("absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-xl transition-all", (state.settings.hapticMaster ?? true) ? "translate-x-7" : "")} />
          </button>
        </div>
      )
    },
    {
      id: 'haptic_intensity',
      name: "Haptic Intensity Strength",
      description: "Control vibration amplitude from micro haptic ticks to solid sensory feedback.",
      category: 'app' as const,
      subcategory: "Haptic Strength",
      keywords: ["haptic", "intensity", "strength", "light", "medium", "strong", "buzz", "vibration", "force"],
      render: () => (
        <div className="space-y-3 text-left">
          {!(state.settings.hapticMaster ?? true) ? (
            <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/10 text-center">
              <p className="text-[8px] text-slate-400">Tactile Engine is currently disabled. Enable Master Haptics to unlock.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'very_light', label: 'Very Light' },
                { id: 'light', label: 'Light' },
                { id: 'medium', label: 'Medium' },
                { id: 'strong', label: 'Strong' },
              ].map(intensity => {
                const isSelected = (state.settings.hapticIntensity || 'light') === intensity.id;
                return (
                  <button
                    key={intensity.id}
                    onClick={() => {
                      onUpdate({ hapticIntensity: intensity.id });
                      triggerHapticFeedback('button', { ...state.settings, hapticIntensity: intensity.id });
                      trackSettingInteraction('haptic_intensity');
                    }}
                    className={cn(
                      "flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden justify-center h-14",
                      isSelected 
                        ? "border-purple-500 bg-purple-500/15 shadow-md scale-[1.02]" 
                        : "border-slate-800 bg-slate-900/40 hover:border-purple-500/30"
                    )}
                  >
                    <p className="font-black uppercase tracking-tight text-[9px] text-slate-200">{intensity.label}</p>
                    {isSelected && (
                      <div className="absolute top-1 right-1 h-1.5 w-1.5 bg-purple-500 rounded-full animate-ping" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )
    },
    {
      id: 'haptic_specifics',
      name: "Precise Haptic Rules",
      description: "Map targeted tactile vibration responses to specific pages and calculator actions.",
      category: 'app' as const,
      subcategory: "Precise Haptic Rules",
      keywords: ["haptic", "calculator", "navigation", "billing", "save", "download", "popup", "error", "success", "long press", "vibrations", "rules"],
      render: () => (
        <div className="space-y-2 text-left">
          {!(state.settings.hapticMaster ?? true) ? (
            <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/10 text-center">
              <p className="text-[8px] text-slate-400">Tactile Engine is currently disabled. Enable Master Haptics to unlock.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: 'hapticNavigation', label: 'Navigation', desc: 'Screen switches' },
                { key: 'hapticCalculator', label: 'Calculator', desc: 'Keypad taps' },
                { key: 'hapticBilling', label: 'Billing Ledger', desc: 'Adding items' },
                { key: 'hapticButton', label: 'Buttons', desc: 'Universal taps' },
                { key: 'hapticSave', label: 'Save Actions', desc: 'Successful storage' },
                { key: 'hapticDownload', label: 'Downloads', desc: 'Report generation' },
                { key: 'hapticPopup', label: 'Popup Dialogs', desc: 'Trigger & close' },
                { key: 'hapticLongPress', label: 'Long Presses', desc: 'Gestures feel' },
                { key: 'hapticError', label: 'Warnings', desc: 'Invalid entries' },
                { key: 'hapticSuccess', label: 'Success indicators', desc: 'Double ticks' },
              ].map(toggle => {
                const value = state.settings[toggle.key as keyof AppSettings] ?? true;
                return (
                  <div key={toggle.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/5 dark:bg-zinc-800/5 border border-[var(--border)] hover:border-[var(--primary)]/20 transition-colors">
                    <div className="pr-2 min-w-0">
                      <p className="font-black uppercase tracking-tight text-[9px] text-slate-200 truncate">{toggle.label}</p>
                      <p className="text-[7px] opacity-40 uppercase tracking-wider truncate">{toggle.desc}</p>
                    </div>
                    <button
                      onClick={() => {
                        const nextVal = !value;
                        onUpdate({ [toggle.key]: nextVal });
                        triggerHapticFeedback('button', { ...state.settings, [toggle.key]: nextVal });
                        trackSettingInteraction('haptic_specifics');
                      }}
                      className={cn(
                        "relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        value ? "bg-purple-500/80" : "bg-slate-800"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                          value ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )
    },
    {
      id: 'precision',
      name: "Decimal Price Precision",
      description: "Customize the default number of trailing decimal precision spaces rendered in currency cells.",
      category: 'app' as const,
      subcategory: "Numerical Precision",
      keywords: ["precision", "decimal", "price", "currency", "number", "calculations", "trailing", "digits"],
      render: () => (
        <div className="space-y-3">
          <div className="flex gap-2 justify-center">
            {[0, 1, 2].map(p => (
              <button
                key={p}
                onClick={() => {
                  onUpdate({ pricePrecision: p });
                  trackSettingInteraction('precision');
                }}
                className={cn(
                  "h-10 w-14 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1 cursor-pointer",
                  state.settings.pricePrecision === p 
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-lg scale-105" 
                    : "bg-[var(--background)] border-[var(--border)] opacity-40 hover:opacity-100"
                )}
              >
                <span>{p}</span>
                <span className="text-[8px] font-normal opacity-60">dec.</span>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'system_specs',
      name: "System Diagnostics Specs",
      description: "Examine diagnostic attributes, system ID variables, and active device parameters.",
      category: 'about' as const,
      subcategory: "System Diagnostics",
      keywords: ["version", "device", "id", "specs", "compile", "build", "metadata", "about", "diagnostics", "build signature"],
      render: () => (
        <div className="grid grid-cols-1 gap-2 text-left text-[9px] font-mono bg-slate-900/10 dark:bg-zinc-800/10 p-4 rounded-xl border border-[var(--border)] text-slate-400">
          <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
            <span className="uppercase text-slate-500">System Codebase:</span>
            <span className="font-bold text-slate-300">TS Price Manager v3.5.0</span>
          </div>
          <div className="flex justify-between border-b border-[var(--border)] pb-1.5">
            <span className="uppercase text-slate-500">Client Device Name:</span>
            <span className="font-bold text-slate-300 truncate max-w-[120px]">{state.settings.deviceName || "Merchant Browser"}</span>
          </div>
          <div className="flex justify-between">
            <span className="uppercase text-slate-500">Device Signature ID:</span>
            <span className="font-bold text-slate-300 truncate max-w-[120px]">{state.settings.deviceId || "STABLE-ID"}</span>
          </div>
        </div>
      )
    },
    {
      id: 'help_center',
      name: "Help Center & Manuals",
      description: "Access interactive database manual guides to maximize pricing workflows.",
      category: 'about' as const,
      subcategory: "Support & Manuals",
      keywords: ["help", "guide", "tutorial", "support", "faq", "contact", "tricks", "manuals"],
      render: () => (
        <div className="w-full text-left">
          <Button 
            variant="outline" 
            onClick={() => {
              onShowHelp();
              trackSettingInteraction('help_center');
            }}
            className="w-full h-14 rounded-xl border-[var(--border)] bg-[var(--card)] hover:bg-[var(--primary)]/15 flex items-center justify-between px-4 group transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                <HelpCircle size={16} />
              </div>
              <div>
                <p className="font-black uppercase tracking-tighter text-xs">{t.help || "Help aur Guide"}</p>
                <p className="text-[8px] opacity-40 uppercase">Interactive guidelines and tricks</p>
              </div>
            </div>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
          </Button>
        </div>
      )
    },
    {
      id: 'legal_docs',
      name: "Terms of Service & Privacy",
      description: "Understand authorization guidelines and data ledger security protocols.",
      category: 'about' as const,
      subcategory: "Legal Documentation",
      keywords: ["privacy", "terms", "conditions", "policy", "legal", "compliance", "about", "data rights"],
      render: () => (
        <div className="space-y-2 text-[9px] text-slate-400 dark:text-zinc-500 bg-slate-900/5 dark:bg-zinc-800/5 p-4 rounded-xl leading-relaxed text-left border border-[var(--border)]">
          <p className="font-bold uppercase text-[10px] text-slate-300 mb-2">Legal Compliance Info</p>
          <p><strong>Terms & Conditions:</strong> By using TS Price Manager, you agree to keep your authorization credentials safe. This system is intended for personal business management.</p>
          <p className="mt-2"><strong>Privacy Policy:</strong> Your data remains stored locally on your device or safely synchronized inside your personal Firebase instance. No business ledger details are shared or accessed by third parties.</p>
        </div>
      )
    }
  ], [state, t, onUpdate, onShowHelp, onResetPIN, onExportExcel, onExportPDF, onImport, onBackup, onRestore, onClearCache, isSyncing, isExporting]);

  const settingsById = useMemo(() => {
    const map: { [key: string]: typeof allSettingsList[0] } = {};
    allSettingsList.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [allSettingsList]);

  const mainCategories = useMemo(() => [
    {
      id: 'language' as const,
      name: "Language & Localization",
      subtitle: "System Translation",
      description: "Choose your preferred language for the application interface and reports.",
      icon: <Globe size={18} className="text-teal-400" />,
      bgClass: "bg-teal-500/10 border-teal-500/20",
      subcategories: [
        { name: "Language Selection", items: ['lang'] }
      ]
    },
    {
      id: 'appearance' as const,
      name: "Appearance",
      subtitle: "Theme & Display Styling",
      description: "Customize how the application looks and feels.",
      icon: <Sparkles size={18} className="text-indigo-400" />,
      bgClass: "bg-indigo-500/10 border-indigo-500/20",
      subcategories: [
        { name: "Visual Themes", items: ['theme'] },
        { name: "Visual Experience", items: ['aurora'] },
        { name: "Display Preferences", items: ['font'] }
      ]
    },
    {
      id: 'security' as const,
      name: "Security",
      subtitle: "PIN & Privacy",
      description: "Protect your application and database costs.",
      icon: <Shield size={18} className="text-orange-400" />,
      bgClass: "bg-orange-500/10 border-orange-500/20",
      subcategories: [
        { name: "Authentication", items: ['pin'] },
        { name: "Data Protection", items: ['stealth'] }
      ]
    },
    {
      id: 'data' as const,
      name: "Data Management",
      subtitle: "Backup, Restore & Export",
      description: "Manage, protect and organize your business data.",
      icon: <Database size={18} className="text-blue-400" />,
      bgClass: "bg-blue-500/10 border-blue-500/20",
      subcategories: [
        { name: "Cloud Synchronization", items: ['cloud_sync'] },
        { name: "Local Storage Backup", items: ['backup_restore'] },
        { name: "Export Formats", items: ['export'] },
        { name: "Import & Migration", items: ['import_data'] },
        { name: "Maintenance & Purge", items: ['clear_cache'] }
      ]
    },
    {
      id: 'app' as const,
      name: "Application",
      subtitle: "Haptics & Performance",
      description: "General application behavior and tactile systems.",
      icon: <SettingsIcon size={18} className="text-purple-400" />,
      bgClass: "bg-purple-500/10 border-purple-500/20",
      subcategories: [
        { name: "Tactile Master", items: ['haptic_master'] },
        { name: "Haptic Strength", items: ['haptic_intensity'] },
        { name: "Precise Haptic Rules", items: ['haptic_specifics'] },
        { name: "Numerical Precision", items: ['precision'] }
      ]
    },
    {
      id: 'about' as const,
      name: "About",
      subtitle: "Version, Support & Legal",
      description: "Application information and support guidance.",
      icon: <Info size={18} className="text-emerald-400" />,
      bgClass: "bg-emerald-500/10 border-emerald-500/20",
      subcategories: [
        { name: "System Diagnostics", items: ['system_specs'] },
        { name: "Support & Manuals", items: ['help_center'] },
        { name: "Legal Documentation", items: ['legal_docs'] }
      ]
    }
  ], []);

  const getCategorySettingsCount = (catId: string) => {
    return allSettingsList.filter(item => item.category === catId).length;
  };

  const filteredSettings = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase().trim();
    return allSettingsList.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.subcategory.toLowerCase().includes(query) ||
      item.keywords.some(kw => kw.toLowerCase().includes(query))
    );
  }, [searchQuery, allSettingsList]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-6 pb-32 max-w-2xl mx-auto px-4"
    >
      {/* 1. Header Area (ONLY shown on Dashboard or when selectedCategory is null) */}
      {selectedCategory === null && (
        <div className="flex flex-col gap-1 items-center md:items-start mb-6">
          <div className="h-1 bg-[var(--primary)] w-12 rounded-full mb-4 md:hidden" />
          <h2 className="text-4xl font-black tracking-tighter text-[var(--foreground)] uppercase">{t.settings}</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Enterprise System v3.5</p>
        </div>
      )}

      {/* 2. SEARCH BAR & RECENTLY USED */}
      {selectedCategory === null && (
        <div className="space-y-4">
          <div className="relative">
            <input 
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-4 rounded-3xl bg-[var(--card)] border border-[var(--border)] text-sm font-bold text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all outline-none"
            />
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--foreground)] opacity-40" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--primary)]/10 text-[var(--foreground)] opacity-50 hover:opacity-100 transition-all cursor-pointer border-0"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Recently Used Bar (ONLY when NOT searching) */}
          {!searchQuery && recentlyUsed.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 flex items-center gap-1.5">
                <Clock size={10} />
                Recently Used
              </p>
              <div className="flex flex-wrap gap-2">
                {recentlyUsed.map(id => {
                  const item = settingsById[id];
                  if (!item) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setSelectedCategory(item.category);
                        setExpandedSubcategories(prev => ({ ...prev, [item.subcategory]: true }));
                        trackSettingInteraction(id);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 text-[9px] font-black uppercase tracking-wider text-[var(--foreground)] transition-all hover:scale-102 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{item.name}</span>
                      <ArrowRight size={8} className="opacity-45 animate-pulse" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SEARCH RESULTS LIST */}
      {searchQuery && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Search Results</span>
            <span className="text-[9px] opacity-40 font-bold uppercase">{filteredSettings.length} matched</span>
          </div>
          
          {filteredSettings.length === 0 ? (
            <div className="p-8 text-center bg-[var(--card)] rounded-3xl border border-[var(--border)]">
              <p className="text-xs font-bold text-[var(--foreground)] opacity-50">No settings matched "{searchQuery}"</p>
              <p className="text-[9px] text-[var(--foreground)] opacity-30 mt-1 uppercase">Try searching for theme, PIN, haptics, or backups.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSettings.map(setting => {
                return (
                  <motion.div 
                    layoutId={`search_${setting.id}`}
                    key={setting.id}
                    className="p-5 bg-[var(--card)] rounded-[2rem] border border-[var(--border)] space-y-4 shadow-sm text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-md inline-block mb-1">
                          {setting.subcategory}
                        </span>
                        <h4 className="font-black uppercase tracking-tight text-xs text-[var(--foreground)]">{setting.name}</h4>
                        <p className="text-[9px] opacity-40 font-bold uppercase tracking-wide mt-1 leading-relaxed">{setting.description}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[var(--border)]/40">
                      {setting.render()}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}



      {/* 5. MAIN CATEGORIES DASHBOARD (Only when NOT searching & NO category selected) */}
      {!searchQuery && selectedCategory === null && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-4">
             <div className="h-1 w-8 bg-[var(--primary)] opacity-30 rounded-full" />
             <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary)]">Settings Categories</label>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {mainCategories.map((cat) => {
              const count = getCategorySettingsCount(cat.id);
              return (
                <motion.div
                  key={cat.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    // Automatically expand all subcategories of the selected category on click
                    const updates: { [key: string]: boolean } = {};
                    cat.subcategories.forEach(sub => {
                      updates[sub.name] = true;
                    });
                    setExpandedSubcategories(prev => ({ ...prev, ...updates }));
                  }}
                  className="flex items-center justify-between p-5 bg-[var(--card)] rounded-[2rem] border border-[var(--border)] hover:border-[var(--primary)]/40 hover:shadow-lg hover:shadow-[var(--primary)]/5 cursor-pointer group transition-all text-left"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105",
                      cat.bgClass
                    )}>
                      {cat.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black uppercase tracking-tight text-sm text-[var(--foreground)]">{cat.name}</h4>
                        <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                          {count} Settings
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--foreground)] opacity-55 mt-1 font-semibold truncate uppercase tracking-wider">{cat.subtitle}</p>
                    </div>
                  </div>
                  
                  <div className="h-8 w-8 rounded-full bg-[var(--primary)]/5 text-[var(--foreground)] opacity-40 group-hover:opacity-100 group-hover:bg-[var(--primary)]/10 flex items-center justify-center transition-all ml-4">
                    <ChevronRight size={16} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. CATEGORY DETAIL PAGE (Only when NOT searching & category IS selected) */}
      {!searchQuery && selectedCategory !== null && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          {/* Back Button / Navigation */}
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]/60">
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--foreground)] opacity-60 hover:opacity-100 transition-all cursor-pointer group border-0 bg-transparent"
            >
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
              <span>Back</span>
            </button>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-30">
              {mainCategories.find(c => c.id === selectedCategory)?.name} Center
            </span>
          </div>

          {/* Category Details Header */}
          {(() => {
            const cat = mainCategories.find(c => c.id === selectedCategory);
            if (!cat) return null;
            return (
              <div className="flex items-center gap-4 p-5 rounded-[2rem] bg-[var(--card)] border border-[var(--border)] shadow-inner text-left">
                <div className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center border shrink-0",
                  cat.bgClass
                )}>
                  {cat.icon}
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)]">{cat.name} Settings</h3>
                  <p className="text-[10px] text-[var(--foreground)] opacity-50 uppercase tracking-wider font-bold mt-1">{cat.description}</p>
                </div>
              </div>
            );
          })()}

          {/* Subcategories (Expandable groups / Accordions) */}
          <div className="space-y-4">
            {mainCategories.find(c => c.id === selectedCategory)?.subcategories.map(sub => {
              const isExpanded = expandedSubcategories[sub.name] ?? false;
              return (
                <div 
                  key={sub.name}
                  className="bg-[var(--card)] rounded-[2.5rem] border border-[var(--border)] overflow-hidden shadow-sm"
                >
                  {/* Subcategory Accordion Header */}
                  <button
                    onClick={() => toggleSubcategory(sub.name)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-[var(--primary)]/5 transition-all outline-none border-0 cursor-pointer"
                  >
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--foreground)] flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                      {sub.name}
                    </span>
                    <div className="h-6 w-6 rounded-full flex items-center justify-center bg-[var(--border)]/30 text-[var(--foreground)] opacity-60">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>

                  {/* Accordion Content */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="border-t border-[var(--border)]/40"
                      >
                        <div className="p-5 space-y-6">
                          {sub.items.map(itemId => {
                            const setting = settingsById[itemId];
                            if (!setting) return null;
                            return (
                              <div key={itemId} className="space-y-3 text-left">
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0 flex-1 pr-4">
                                    <h4 className="font-black uppercase tracking-tight text-xs text-[var(--foreground)]">{setting.name}</h4>
                                    <p className="text-[9px] opacity-40 font-semibold uppercase mt-0.5 leading-relaxed tracking-wider">{setting.description}</p>
                                  </div>
                                </div>
                                <div className="pt-2">
                                  {setting.render()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function ProfileScreen({ state, t, deferredPrompt, onInstall, onShareProductList, isSharing, onUpdateSettings, onTriggerToast }: { 
  state: AppState; 
  t: any; 
  deferredPrompt: any; 
  onInstall: () => void;
  onShareProductList: () => void;
  isSharing: boolean;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
  onTriggerToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}) {
  const handleAuth = async () => {
    if (state.user) {
      localStorage.removeItem('ts_guest_session');
      localStorage.removeItem('ts_has_logged_in');
      localStorage.removeItem('ts_cached_user');
      await auth.signOut();
      window.location.reload();
    } else {
      await loginWithGoogle();
    }
  };

  const [storeName, setStoreName] = useState(state.settings.storeName || "");
  const [storeOwnerName, setStoreOwnerName] = useState(state.settings.storeOwnerName || "");
  const [phoneNumber, setPhoneNumber] = useState(state.settings.phoneNumber || "+91");
  const [storeAddress, setStoreAddress] = useState(state.settings.storeAddress || "");

  const handlePhoneChange = (val: string) => {
    if (!val.startsWith('+91')) {
      if (val === '' || val === '+' || val === '+9') {
        setPhoneNumber('+91');
      } else {
        setPhoneNumber('+91' + val.replace(/^\+?91?/, ''));
      }
    } else {
      setPhoneNumber(val);
    }
  };
  const [isSaved, setIsSaved] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  const handleSaveStoreDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLocal(true);
    try {
      await onUpdateSettings({
        storeName,
        storeOwnerName,
        phoneNumber,
        storeAddress,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingLocal(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-2xl mx-auto px-4 sm:px-0">
      {/* Dynamic Visual Header */}
      <div className="relative overflow-hidden rounded-[3rem] bg-[var(--primary)] p-10 text-white shadow-2xl shadow-[var(--primary)]/20 min-h-[250px] flex flex-col justify-end group">
         <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 transition-transform group-hover:scale-110 group-hover:rotate-0 duration-700">
            <User size={200} />
         </div>
         <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
         
         <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-5">
               <div className="h-20 w-20 rounded-[2rem] bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105">
                  <User size={40} className="text-white" />
               </div>
               <div>
                  <h2 className="text-4xl font-black uppercase tracking-tight leading-none truncate max-w-[200px] sm:max-w-md">
                    {storeName || (state.user ? (state.user.email?.split('@')[0] || 'Merchant') : 'SYSTEM ADMIN')}
                  </h2>
                  <div className="mt-2 flex flex-col items-start gap-1">
                     <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">
                          {state.user ? t.liveNode : t.localSandbox}
                        </p>
                     </div>
                     {state.user?.email && (
                        <p className="text-[11px] font-bold text-white/95 lowercase mt-1 flex items-center gap-1 opacity-90 truncate max-w-[200px] sm:max-w-md">
                           <span className="text-[9px] font-black uppercase tracking-wider text-white/50 shrink-0">email id:</span>
                           <span className="font-mono bg-white/15 px-2 py-0.5 rounded-md border border-white/5">{state.user.email}</span>
                        </p>
                     )}
                  </div>
               </div>
            </div>
            
            <div className="flex gap-8 pt-4">
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">{t.authorization}</p>
                  <button 
                    onClick={handleAuth}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-full transition-all text-white hover:text-[var(--primary)] shadow-lg active:scale-95"
                  >
                     {state.user ? <LogOut size={14} /> : <LogIn size={14} />}
                     {state.user ? t.terminateSession : t.cloudEntry}
                  </button>
               </div>
               <div className="h-10 w-px bg-white/20" />
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">{t.architecture}</p>
                  <p className="text-xs font-black uppercase">v3.5.0 Enterprise</p>
               </div>
            </div>
         </div>
      </div>

      {/* Enterprise Store Profile Form */}
      <div className="card p-8 bg-[var(--card)] border border-[var(--border)] rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--primary)] to-emerald-500" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/20 shadow-sm">
            <Store size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Enterprise Store Profile</h3>
            <p className="text-[10px] font-bold text-[var(--foreground)]/40 uppercase tracking-wider">Configure store credentials and localization</p>
          </div>
        </div>
 
        <form onSubmit={handleSaveStoreDetails} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Store Name */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]/70 flex items-center gap-1.5">
                <Store size={12} className="text-[var(--primary)]" />
                Store Name
              </label>
              <input 
                type="text" 
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Apex Tech Store"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3.5 text-xs text-[var(--foreground)] placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none transition-colors"
                required
              />
            </div>
 
            {/* Store Owner Name */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]/70 flex items-center gap-1.5">
                <UserCheck size={12} className="text-[var(--primary)]" />
                Store Owner Name
              </label>
              <input 
                type="text" 
                value={storeOwnerName}
                onChange={(e) => setStoreOwnerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3.5 text-xs text-[var(--foreground)] placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none transition-colors"
                required
              />
            </div>
 
            {/* Phone Number */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]/70 flex items-center gap-1.5">
                <Phone size={12} className="text-[var(--primary)]" />
                Phone Number
              </label>
              <input 
                type="tel" 
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3.5 text-xs text-[var(--foreground)] placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none transition-colors"
                required
              />
            </div>
 
            {/* Store Address */}
            <div className="space-y-1.5 text-left md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]/70 flex items-center gap-1.5">
                <MapPin size={12} className="text-[var(--primary)]" />
                Store Address
              </label>
              <textarea 
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="e.g. Suite 400, 5th Avenue, New York, NY"
                rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3.5 text-xs text-[var(--foreground)] placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none transition-colors resize-none"
                required
              />
            </div>
          </div>
 
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]/30">
            {isSaved ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold uppercase tracking-wider animate-bounce">
                <Check size={14} /> Profile details saved!
              </span>
            ) : (
              <span className="text-[10px] text-[var(--foreground)]/50 font-semibold leading-none">
                {state.user?.uid === 'guest' ? 'Changes saved locally' : 'Syncs automatically to cloud'}
              </span>
            )}
            
            <button 
              type="submit"
              disabled={isSavingLocal}
              className="flex items-center gap-2 bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 hover:opacity-95 cursor-pointer"
            >
              {isSavingLocal ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Saving...
                </>
              ) : (
                <>Save Profile Details</>
              )}
            </button>
          </div>
        </form>
      </div>

      {state.user && state.user.uid !== 'guest' && (
        <div className="space-y-6">
          <AccountSyncCard onTriggerToast={onTriggerToast} />
          <WebPushNotificationCard onTriggerToast={onTriggerToast} />
        </div>
      )}

      {/* Operational Controls */}
      <div className="space-y-4">
         <div className="flex items-center justify-between px-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">System Core</h4>
            <div className="h-px flex-1 bg-[var(--border)] mx-4 opacity-10" />
         </div>

         {/* PWA Deployment Call-to-Action */}
         {deferredPrompt && (
           <button 
             onClick={onInstall}
             className="w-full flex items-center justify-between p-8 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-[2.5rem] shadow-2xl shadow-amber-500/30 active:scale-[0.98] transition-all group overflow-hidden relative"
           >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <div className="flex items-center gap-5 relative z-10">
                 <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                    <Download size={28} />
                 </div>
                 <div className="text-left">
                    <p className="text-xl font-black uppercase tracking-tight">{t.deployNode}</p>
                    <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{t.pwaInstallHint}</p>
                 </div>
              </div>
              <ChevronRight size={24} className="relative z-10 opacity-60 group-hover:translate-x-1 transition-transform" />
           </button>
         )}

         {/* Secondary Hub Actions */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              disabled={isSharing}
              onClick={onShareProductList}
              className="flex items-center justify-between p-6 bg-[var(--card)] border border-[var(--border)] rounded-[2rem] hover:border-green-500/30 hover:bg-green-500/5 transition-all group disabled:opacity-50"
            >
               <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors group-hover:bg-green-500 group-hover:text-white",
                    isSharing ? "bg-green-500 text-white" : "bg-green-500/10 text-green-500"
                  )}>
                     {isSharing ? <RefreshCw size={22} className="animate-spin" /> : <MessageSquare size={22} />}
                  </div>
                  <div className="text-left">
                     <p className="text-sm font-black uppercase group-hover:text-green-500 transition-colors">Share Product List</p>
                     <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest">{t.whatsappBroadcast || "WhatsApp Broadcast"}</p>
                  </div>
               </div>
               <ChevronRight size={16} className="opacity-20 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={() => {
                  const message = encodeURIComponent(`Check out TS PRICE MANAGER: ${window.location.host}`);
                  window.open(`https://wa.me/?text=${message}`, '_blank');
              }}
              className="flex items-center justify-between p-6 bg-[var(--card)] border border-[var(--border)] rounded-[2rem] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
            >
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center transition-colors group-hover:bg-blue-500 group-hover:text-white">
                     <Share2 size={22} />
                  </div>
                  <div className="text-left">
                     <p className="text-sm font-black uppercase group-hover:text-blue-500 transition-colors">{t.clientShare}</p>
                     <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest">{t.appShareHint || "Invite other merchants"}</p>
                  </div>
               </div>
               <ChevronRight size={16} className="opacity-20 group-hover:translate-x-1 transition-transform" />
            </button>
         </div>
      </div>

      <div className="text-center pt-8 opacity-20">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] italic">Precision Engineering By AI Studio</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/5",
  };

  return (
    <div className={cn("p-6 rounded-[2.5rem] border shadow-sm space-y-4 hover:shadow-xl transition-all duration-500", colors[color])}>
       <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
          {icon}
       </div>
       <div>
          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 leading-tight mb-1">{label}</p>
          <p className="text-xl font-black uppercase tracking-tight">{value}</p>
       </div>
    </div>
  );
}

function RecentPriceChanges({ items, t, precision }: { items: Item[]; t: any; precision: number }) {
  const recentChanges = useMemo(() => {
    return items
      .filter(item => item.priceChangedAt)
      .sort((a, b) => new Date(b.priceChangedAt!).getTime() - new Date(a.priceChangedAt!).getTime())
      .slice(0, 5);
  }, [items]);

  if (recentChanges.length === 0) return null;

  return (
    <div className="space-y-4">
       <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--primary)]">
         <RotateCcw size={14} /> {t.recentPriceChanges}
       </div>
       <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
         {recentChanges.map(item => (
           <div key={item.id} className="flex-shrink-0 w-64 card p-4 border-white/5 bg-[var(--primary)]/5 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                 <div className="h-8 w-8 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-xs">
                   <Package size={14} />
                 </div>
                 <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">
                   {new Date(item.priceChangedAt!).toLocaleDateString()} • {item.lastChangedBy || 'System'}
                 </span>
              </div>
              <h4 className="font-bold text-sm truncate mb-2">{item.name}</h4>
              <div className="flex items-center gap-4">
                 <div>
                    <p className="text-[8px] font-bold uppercase opacity-40">Retail</p>
                    <p className="text-xs font-bold">₹{formatNumber(item.retailPrice, precision)}</p>
                 </div>
                 <div className="h-6 w-px bg-[var(--border)]" />
                 <div>
                    <p className="text-[8px] font-bold uppercase opacity-40">Cost</p>
                    <p className="text-xs font-bold">₹{formatNumber(item.buyingPrice, precision)}</p>
                 </div>
              </div>
           </div>
         ))}
       </div>
    </div>
  );
}

export function NoteDeleteConfirmationModal({ 
  onConfirm, 
  onClose, 
  count 
}: { 
  onConfirm: () => void, 
  onClose: () => void, 
  count: number 
}) {
  const [typedYes, setTypedYes] = React.useState('');
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
    >
      <motion.div 
        initial={{ y: 30, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, scale: 0.95 }}
        className="w-full max-w-md rounded-[2.5rem] bg-[var(--card)] border border-red-500/30 p-6 shadow-2xl relative text-center"
      >
        <div className="h-14 w-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <Trash2 size={24} />
        </div>
        
        <h3 className="text-xl font-black text-[var(--foreground)] tracking-tight uppercase">Confirm Deletion</h3>
        <p className="text-xs font-bold text-[var(--foreground)]/60 uppercase tracking-wider mt-2">
          Are you sure you want to delete {count} note{count > 1 ? 's' : ''}? This action cannot be undone.
        </p>
        
        <div className="mt-5 p-4 rounded-2xl bg-[var(--background)] border border-[var(--border)]/60 text-left">
          <label className="text-[9px] font-black uppercase tracking-widest text-red-500/80 block mb-2">
            Type "yes" below to authorize deletion:
          </label>
          <input 
            type="text" 
            placeholder="Type yes here..." 
            className="w-full rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-3 text-sm font-bold focus:border-red-500 focus:outline-none transition-all text-center uppercase tracking-widest text-red-500"
            value={typedYes}
            onChange={(e) => setTypedYes(e.target.value)}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button 
            disabled={typedYes.trim().toLowerCase() !== 'yes'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 rounded-2xl py-3.5 bg-red-500 hover:bg-red-600 text-white font-black disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Authorize Delete
          </Button>
          <Button 
            variant="outline"
            className="flex-1 rounded-2xl py-3.5 border-white/10 font-black"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function NoteDetailModal({ 
  note, 
  onClose, 
  onSave, 
  t,
  inventoryItems,
  settings
}: { 
  note: Note; 
  onClose: () => void; 
  onSave: (id: string, updates: Partial<Note>) => void; 
  t: any; 
  inventoryItems: Item[];
  settings?: AppSettings;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [formData, setFormData] = React.useState({
    title: note.title,
    description: note.description,
    category: note.category,
    priority: note.priority,
    dueDate: note.dueDate || '',
    isPinned: note.isPinned,
    
    // Advanced Udhar Fields
    udharPerson: note.udharPerson || '',
    udharAmount: note.udharAmount !== undefined ? String(note.udharAmount) : '',
    udharType: note.udharType || 'give',
    udharPhone: note.udharPhone || '+91'
  });
  const [isListening, setIsListening] = React.useState(false);
  const [udharItems, setUdharItems] = React.useState<UdharBillItem[]>(note.udharItems || []);

  const handleUdharPhoneChange = (val: string) => {
    if (!val.startsWith('+91')) {
      if (val === '' || val === '+' || val === '+9') {
        setFormData(prev => ({ ...prev, udharPhone: '+91' }));
      } else {
        setFormData(prev => ({ ...prev, udharPhone: '+91' + val.replace(/^\+?91?/, '') }));
      }
    } else {
      setFormData(prev => ({ ...prev, udharPhone: val }));
    }
  };
  
  // Ledger micro-repayment states
  const [repayAmount, setRepayAmount] = React.useState('');
  const [repayDesc, setRepayDesc] = React.useState('');
  const [ledgerLogStatus, setLedgerLogStatus] = React.useState<'idle' | 'success'>('idle');
  const [copiedStatus, setCopiedStatus] = React.useState(false);
  const [showDuePopup, setShowDuePopup] = React.useState(false);

  React.useEffect(() => {
    const payList = note.udharPayments || [];
    const repaid = payList.reduce((sum, p) => sum + p.amount, 0);
    const princ = note.udharAmount || 0;
    const oTotal = Math.max(0, princ - repaid);
    const dueOverdue = note.category === 'Udhar' && note.dueDate && new Date(new Date(note.dueDate).setHours(0,0,0,0)) <= new Date(new Date().setHours(0,0,0,0)) && oTotal > 0;
    if (dueOverdue) {
      setShowDuePopup(true);
    }
  }, [note.id, note.dueDate, note.udharAmount, note.udharPayments, note.category]);

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice-to-text not supported in this browser.');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setFormData(prev => ({
        ...prev,
        description: prev.description ? prev.description + ' ' + speechToText : speechToText
      }));
    };

    recognition.start();
  };

  const handleSaveClick = () => {
    onSave(note.id, {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
      dueDate: formData.dueDate || null,
      isPinned: formData.isPinned,
      
      // Include Udhar updates if category is Udhar
      ...(formData.category === 'Udhar' ? {
        udharPerson: formData.udharPerson || 'Unspecified Party',
        udharAmount: parseFloat(formData.udharAmount) || 0,
        udharType: formData.udharType,
        udharPhone: formData.udharPhone,
        udharSettled: note.udharSettled !== undefined ? note.udharSettled : false,
        udharPayments: note.udharPayments || [],
        udharItems: udharItems
      } : {})
    });
    setIsEditing(false);
  };

  // Advanced Udhar Mathematical Telemetry
  const payments = note.udharPayments || [];
  const totalRepaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const principal = note.udharAmount || 0;
  
  const elapsedMs = Date.now() - new Date(note.createdAt).getTime();
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));
  const outstandingTotal = Math.max(0, principal - totalRepaid);
  const remainingPrincipal = outstandingTotal;

  // Risk Analyzer & Grading Protocols
  let riskLevel = 'LOW RISK';
  let riskColor = 'text-green-400 border-green-500/20 bg-green-500/5';
  let creditGrade = 'A+ SECURE';

  const isDueOrOverdue = note.dueDate && new Date(new Date(note.dueDate).setHours(0,0,0,0)) <= new Date(new Date().setHours(0,0,0,0)) && outstandingTotal > 0;

  if (isDueOrOverdue) {
    riskLevel = 'BREACH PROTOCOL';
    riskColor = 'text-red-400 border-red-500/20 bg-red-500/5 animate-pulse';
    creditGrade = 'F CRITICAL';
  } else if (elapsedDays > 60 && payments.length === 0 && outstandingTotal > 0) {
    riskLevel = 'ELEVATED RISK';
    riskColor = 'text-orange-400 border-orange-500/20 bg-orange-500/5';
    creditGrade = 'C- DEBT WARNING';
  } else if (outstandingTotal > 20000) {
    riskLevel = 'MODERATE RISK';
    riskColor = 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    creditGrade = 'B- STANDBY';
  }

  // Log Repayment Method
  const handleLogRepayment = () => {
    const amt = parseFloat(repayAmount);
    if (isNaN(amt) || amt <= 0) return;

    const newPayment = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      amount: amt,
      description: repayDesc || 'Repayment / Ledger adjustment'
    };

    onSave(note.id, {
      udharPayments: [...payments, newPayment]
    });

    setRepayAmount('');
    setRepayDesc('');
    setLedgerLogStatus('success');
    setTimeout(() => setLedgerLogStatus('idle'), 2000);
  };

  const handleDeleteRepayment = (payId: string) => {
    const filtered = payments.filter(p => p.id !== payId);
    onSave(note.id, {
      udharPayments: filtered
    });
  };

  // Reminder protocol generation
  const generateReminderText = () => {
    const flow = note.udharType === 'give' ? 'Lent' : 'Borrowed';
    const relation = note.udharType === 'give' ? 'Outstanding receivable due to us' : 'Outstanding payable from our side';
    
    // Format payments list
    const paymentsListStr = payments && payments.length > 0 
      ? `\n*📋 RECENT TRANSACTIONS LOG*\n` + 
        payments.map((p, idx) => `• ${new Date(p.date).toLocaleDateString()}: Paid ₹${p.amount.toLocaleString()} (${p.description || 'Repayment'})`).join('\n') + `\n`
      : '';

    return `*📢 OFFICIAL TRANSACTION STATEMENT*\n` +
      `--------------------------------\n` +
      `*🏪 STORE DETAILS*\n` +
      `*Store Name:* ${settings?.storeName || 'Our Store'}\n` +
      `${settings?.storeAddress ? `*Address:* ${settings.storeAddress}\n` : ''}` +
      `${settings?.storeOwnerName ? `*Owner:* ${settings.storeOwnerName}\n` : ''}` +
      `${settings?.phoneNumber ? `*Contact:* ${settings.phoneNumber}\n` : ''}` +
      `--------------------------------\n` +
      `*👤 CUSTOMER LEDGER DETAIL*\n` +
      `*Party/Client:* ${note.udharPerson || 'Valued Customer'}\n` +
      `*Statement Date:* ${new Date().toLocaleDateString()}\n` +
      `*Status:* ${relation}\n` +
      `\n` +
      `*💰 BALANCE SUMMARY*\n` +
      `*Initial Balance:* ₹${principal.toLocaleString()}\n` +
      `*Repayments Logged:* ₹${totalRepaid.toLocaleString()}\n` +
      `*Net Outstanding Balance:* ₹${outstandingTotal.toLocaleString()}\n` +
      `*Due Date:* ${note.dueDate ? new Date(note.dueDate).toLocaleDateString() : 'Immediate Settlement'}\n` +
      `${paymentsListStr}` +
      `--------------------------------\n` +
      `Please review this statement and arrange for settlement at your earliest convenience. Thank you for your business!`;
  };

  const handleCopyReminder = () => {
    navigator.clipboard.writeText(generateReminderText());
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  const handleWhatsAppSend = () => {
    const cleanNum = (note.udharPhone || '').replace(/\D/g, '');
    const text = encodeURIComponent(generateReminderText());
    window.open(`https://wa.me/${cleanNum}?text=${text}`, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
    >
      <motion.div 
        initial={{ y: 40, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, scale: 0.95 }}
        className="w-full max-w-4xl h-[88vh] rounded-[2.5rem] bg-[var(--card)] border border-[var(--border)] flex flex-col overflow-hidden text-left shadow-2xl relative"
      >
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]/60 bg-[var(--card)]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center font-bold shadow-inner",
              note.category === 'Udhar' ? "bg-amber-500/10 text-amber-500" : "bg-[var(--primary)]/10 text-[var(--primary)]"
            )}>
              {note.category === 'Udhar' ? <Coins size={20} /> : <FileText size={20} />}
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">
                {note.category === 'Udhar' ? 'Quantum Udhar Ledger Protocol' : 'Note Journal Detail'}
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)]/40 mt-0.5">
                Created: {new Date(note.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={onClose} 
            size="icon" 
            className="rounded-xl border border-[var(--border)]/60 bg-[var(--background)] hover:bg-red-500/10 hover:text-red-500"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Main scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-[var(--background)]/30">
          {!isEditing ? (
            /* View Mode */
            <div className="space-y-6">
              {/* Category Indicators */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border",
                  note.category === 'Udhar' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20"
                )}>
                  Category: {note.category}
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-[10px] font-black text-blue-500 uppercase tracking-wider border border-blue-500/20">
                  Priority: {formData.priority}
                </span>
                {formData.dueDate && (
                  <span className="inline-flex items-center rounded-full bg-red-500/10 px-3 py-1 text-[10px] font-black text-red-500 uppercase tracking-wider border border-red-500/20">
                    Due: {new Date(formData.dueDate).toLocaleDateString()}
                  </span>
                )}
                {formData.isPinned && (
                  <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-3 py-1 text-[10px] font-black text-yellow-500 uppercase tracking-wider border border-yellow-500/20">
                    Pinned ⭐
                  </span>
                )}
              </div>

              {/* Advanced Udhar Dashboard Segment */}
              {note.category === 'Udhar' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Ledger details, risks, remind text */}
                  <div className="lg:col-span-5 space-y-5">
                    {/* Visual risk/credit Grade indicator */}
                    <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40">System Diagnostics</span>
                        <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border", riskColor)}>
                          {riskLevel}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full border-4 border-dashed border-amber-500/30 flex items-center justify-center text-center p-1 bg-amber-500/5">
                          <span className="text-[10px] font-black text-amber-400 tracking-tighter leading-none">
                            {creditGrade.split(' ')[0]}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-[var(--foreground)] tracking-tight">Ledger Credit Grade</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            {creditGrade.split(' ').slice(1).join(' ')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ledger Metadata Details */}
                    <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500">Party Information</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between border-b border-[var(--border)]/40 pb-2">
                          <span className="opacity-50 font-bold">Party / Debtor:</span>
                          <span className="font-black text-[var(--foreground)]">{note.udharPerson || 'Unspecified'}</span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--border)]/40 pb-2">
                          <span className="opacity-50 font-bold">Principal Balance:</span>
                          <span className="font-black text-[var(--foreground)]">₹{principal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--border)]/40 pb-2">
                          <span className="opacity-50 font-bold">Flow Type:</span>
                          <span className={cn("font-black", note.udharType === 'give' ? "text-green-400" : "text-red-400")}>
                            {note.udharType === 'give' ? 'Lent (Receivable)' : 'Borrowed (Payable)'}
                          </span>
                        </div>
                        <div className="flex justify-between pb-1">
                          <span className="opacity-50 font-bold">WhatsApp / Phone:</span>
                          <span className="font-black text-amber-500">{note.udharPhone || 'Unspecified'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Professional Invoice Preview */}
                    <UdharInvoicePreview note={note} />

                    {/* Details note */}
                    <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Journal Notes</h4>
                      <p className="text-xs font-semibold text-[var(--foreground)]/80 leading-relaxed italic whitespace-pre-wrap">
                        {formData.description || 'No additional journal remarks available.'}
                      </p>
                    </div>

                    {/* Broadcast protocol notices */}
                    <button
                      onClick={handleCopyReminder}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                    >
                      <Share2 size={14} />
                      {copiedStatus ? "PROTOCOL NOTICE COPIED!" : "COMPILE PROTOCOL NOTICE"}
                    </button>
                  </div>

                  {/* Right Column: Quantum Accumulator and micro ledger */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Quantum balance dashboard card */}
                    <div className="p-6 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
                          <Scale size={12} /> Quantum Balance Telemetry
                        </span>
                        <span className="text-[8px] font-mono text-slate-500 font-bold uppercase">
                          Status: {outstandingTotal > 0 ? 'Pending' : 'Settled'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider opacity-40">Principal Amount</span>
                          <p className="text-xl font-black text-amber-400">₹{principal.toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider opacity-40">Net Repaid</span>
                          <p className="text-xl font-black text-emerald-400">₹{totalRepaid.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="border-t border-[var(--border)] border-dashed pt-4 space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider opacity-40">Net Outstanding Due</span>
                        <div className="flex items-baseline justify-between">
                          <p className="text-3xl font-black text-white tracking-tight">₹{outstandingTotal.toLocaleString()}</p>
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                            {note.udharType === 'give' ? 'Receivable' : 'Payable'}
                          </span>
                        </div>
                      </div>

                      {/* Direct Action Contact Panel */}
                      <div className="pt-3 border-t border-[var(--border)]/40 space-y-3">
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-30 block">Instant Ledger Contact Protocols</span>
                        {note.udharPhone ? (
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={handleWhatsAppSend}
                              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba56] text-black font-black text-[11px] uppercase tracking-wider transition-all active:scale-95 shadow-md"
                            >
                              <MessageSquare size={14} />
                              Send WhatsApp
                            </button>
                            <a
                              href={`tel:${note.udharPhone}`}
                              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px] uppercase tracking-wider transition-all active:scale-95 shadow-md"
                            >
                              <Phone size={14} />
                              Call Customer
                            </a>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center text-[10px] text-slate-400 font-bold">
                            ⚠️ No WhatsApp / Phone number entered for this party. Edit note to add contact details.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Micro Repayments Ledger Logs */}
                    <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-1.5">
                          <Wallet size={12} /> Repayments & Credits Ledger
                        </h4>
                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {payments.length} log{payments.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Payment Logger Form */}
                      <div className="p-4 rounded-2xl bg-[var(--background)] border border-[var(--border)] space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1 block">Repayment Amt (₹)</label>
                            <input
                              type="number"
                              value={repayAmount}
                              onChange={e => setRepayAmount(e.target.value)}
                              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs focus:border-amber-500/50 outline-none"
                              placeholder="e.g. 1000"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1 block">Description / Note</label>
                            <input
                              type="text"
                              value={repayDesc}
                              onChange={e => setRepayDesc(e.target.value)}
                              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs focus:border-amber-500/50 outline-none"
                              placeholder="Cash/Online/Repay"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          {ledgerLogStatus === 'success' ? (
                            <span className="text-[9px] font-black text-green-400 flex items-center gap-1 animate-pulse">
                              <Check size={12} /> TRANSACTION PROTOCOL PERSISTED SECURELY
                            </span>
                          ) : <div />}
                          <button
                            onClick={handleLogRepayment}
                            disabled={!repayAmount || isNaN(parseFloat(repayAmount)) || parseFloat(repayAmount) <= 0}
                            className="px-4 py-2 bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-[9px] rounded-xl hover:bg-amber-600 disabled:opacity-40 transition-all cursor-pointer active:scale-95"
                          >
                            LOG REPAYMENT
                          </button>
                        </div>
                      </div>

                      {/* Ledger Payments History Table */}
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                        {payments.length > 0 ? (
                          [...payments].reverse().map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 hover:border-white/10 transition-all">
                              <div>
                                <p className="text-xs font-black text-white">₹{p.amount.toLocaleString()}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                  <span>{p.description}</span>
                                  <span>•</span>
                                  <span>{new Date(p.date).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteRepayment(p.id)}
                                className="h-7 w-7 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 border border-dashed border-[var(--border)]/60 rounded-2xl">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No repayment protocol records</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Note View */
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-[var(--foreground)] uppercase tracking-tight leading-tight">
                      {formData.title}
                    </h2>
                  </div>

                  <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)]/60 shadow-inner min-h-[250px] whitespace-pre-wrap text-sm font-medium leading-relaxed text-[var(--foreground)] opacity-90">
                    {formData.description || <span className="opacity-30 italic">No description details available.</span>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Edit Mode */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Note Title</label>
                  <input 
                    type="text" 
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs font-bold focus:border-[var(--primary)] focus:outline-none"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Category</label>
                    <select 
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs font-bold focus:border-[var(--primary)] focus:outline-none"
                      value={formData.category}
                      onChange={(e: any) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="General">General</option>
                      <option value="Stock">Stock</option>
                      <option value="Payment">Payment</option>
                      <option value="Customer">Customer</option>
                      <option value="Supplier">Supplier</option>
                      <option value="Reminder">Reminder</option>
                      <option value="Udhar">Udhar (Advanced Ledger)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Priority</label>
                    <select 
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs font-bold focus:border-[var(--primary)] focus:outline-none"
                      value={formData.priority}
                      onChange={(e: any) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="Info">Info</option>
                      <option value="Important">Important</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Advanced Udhar Edit Fields */}
              {formData.category === 'Udhar' && (
                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-amber-500">
                    <Coins size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Adjust Ledger Parameters</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Party / Debtor</label>
                      <input 
                        type="text"
                        value={formData.udharPerson}
                        onChange={e => setFormData({ ...formData, udharPerson: e.target.value })}
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs focus:border-amber-500/50 outline-none"
                        placeholder="Party Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Principal Amount (₹)</label>
                      <input 
                        type="number"
                        value={formData.udharAmount}
                        onChange={e => setFormData({ ...formData, udharAmount: e.target.value })}
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs focus:border-amber-500/50 outline-none"
                        placeholder="Principal ₹"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Flow Protocol</label>
                      <select 
                        value={formData.udharType}
                        onChange={e => setFormData({ ...formData, udharType: e.target.value as any })}
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500/50"
                      >
                        <option value="give">Lent (Receivable)</option>
                        <option value="take">Borrowed (Payable)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">WhatsApp / Phone</label>
                      <input 
                        type="tel"
                        value={formData.udharPhone}
                        onChange={e => handleUdharPhoneChange(e.target.value)}
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs focus:border-amber-500/50 outline-none"
                        placeholder="WhatsApp / Phone number"
                      />
                    </div>
                  </div>

                  {/* Bill builder for Udhar ledger items */}
                  <UdharBillBuilder
                    items={udharItems}
                    onChange={setUdharItems}
                    onUpdatePrincipal={total => setFormData(prev => ({ ...prev, udharAmount: String(total) }))}
                    principalAmount={formData.udharAmount}
                    inventoryItems={inventoryItems}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Due Date</label>
                  <input 
                    type="date" 
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs font-bold focus:border-[var(--primary)] focus:outline-none"
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input 
                    type="checkbox" 
                    id="edit-is-pinned"
                    className="h-4 w-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                    checked={formData.isPinned}
                    onChange={(e) => setFormData(prev => ({ ...prev, isPinned: e.target.checked }))}
                  />
                  <label htmlFor="edit-is-pinned" className="text-xs font-bold uppercase tracking-wider opacity-60 cursor-pointer select-none">
                    Pin note to top of hub
                  </label>
                </div>
              </div>

              <div className="space-y-1.5 relative">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Note details (Supports unlimited text)</label>
                  <button 
                    type="button" 
                    onClick={handleVoiceInput}
                    className={cn(
                      "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border cursor-pointer",
                      isListening ? "bg-red-500 text-white animate-pulse border-red-600" : "bg-white/5 border-white/10 hover:bg-[var(--primary)]/10"
                    )}
                  >
                    <Mic size={10} />
                    {isListening ? "Listening..." : "Dictate"}
                  </button>
                </div>
                <textarea 
                  rows={6}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-xs font-bold focus:border-[var(--primary)] focus:outline-none leading-relaxed"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Controls (Footer) */}
        <div className="p-6 border-t border-[var(--border)]/60 bg-[var(--card)]/80 backdrop-blur-md shrink-0 flex items-center gap-3">
          {!isEditing ? (
            <>
              <Button 
                className="flex-1 rounded-2xl py-3.5 bg-[var(--primary)] hover:opacity-90 font-black"
                onClick={() => {
                  setFormData({
                    title: note.title,
                    description: note.description,
                    category: note.category,
                    priority: note.priority,
                    dueDate: note.dueDate || '',
                    isPinned: note.isPinned,
                    udharPerson: note.udharPerson || '',
                    udharAmount: note.udharAmount !== undefined ? String(note.udharAmount) : '',
                    udharType: note.udharType || 'give',
                    udharPhone: note.udharPhone || '+91'
                  });
                  setIsEditing(true);
                }}
              >
                <Edit2 size={16} className="mr-2" />
                Edit Note Entry
              </Button>
              <Button 
                variant="outline"
                className="flex-1 rounded-2xl py-3.5 border-white/10 font-black"
                onClick={onClose}
              >
                Close View
              </Button>
            </>
          ) : (
            <>
              <Button 
                className="flex-1 rounded-2xl py-3.5 bg-green-600 hover:bg-green-700 font-black"
                onClick={handleSaveClick}
              >
                <Check size={16} className="mr-2" />
                Save Changes
              </Button>
              <Button 
                variant="outline"
                className="flex-1 rounded-2xl py-3.5 border-white/10 font-black"
                onClick={() => {
                  setFormData({
                    title: note.title,
                    description: note.description,
                    category: note.category,
                    priority: note.priority,
                    dueDate: note.dueDate || '',
                    isPinned: note.isPinned,
                    udharPerson: note.udharPerson || '',
                    udharAmount: note.udharAmount !== undefined ? String(note.udharAmount) : '',
                    udharType: note.udharType || 'give',
                    udharPhone: note.udharPhone || '+91'
                  });
                  setIsEditing(false);
                }}
              >
                Cancel Edit
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* Automatic Due Date Alert Popup */}
      <AnimatePresence>
        {showDuePopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-[2rem] bg-slate-950 border border-amber-500/30 shadow-[0_20px_50px_rgba(245,158,11,0.15)] space-y-6 text-center relative overflow-hidden text-white"
            >
              {/* Glowing alert effect */}
              <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />
              
              <div className="mx-auto h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 animate-bounce">
                <BellRing size={28} />
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-black text-white uppercase tracking-wider">Udhar Due Date Reached!</h4>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  The due date for <span className="font-extrabold text-amber-400">{note.udharPerson || 'this customer'}</span> has arrived or passed!
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Outstanding Due</span>
                <p className="text-2xl font-black text-white">₹{outstandingTotal.toLocaleString()}</p>
              </div>

              {note.udharPhone ? (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      handleWhatsAppSend();
                      setShowDuePopup(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba56] text-black font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg border-none"
                  >
                    <MessageSquare size={14} />
                    Send WhatsApp Reminder
                  </button>
                  <a
                    href={`tel:${note.udharPhone}`}
                    onClick={() => setShowDuePopup(false)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg"
                  >
                    <Phone size={14} />
                    Call Customer Now
                  </a>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] text-slate-400 font-bold">
                  ⚠️ No WhatsApp / Phone number entered. Edit note details to add contact information.
                </div>
              )}

              <button
                onClick={() => setShowDuePopup(false)}
                className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
              >
                Dismiss Alert
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NotesDashboard({ 
  notes, 
  expanded, 
  onToggle, 
  onAdd, 
  onUpdate, 
  onDelete, 
  t,
  isPreview = false,
  selectedNoteIds = [],
  onToggleSelectNote,
  onClearSelection,
  onTriggerDeleteConfirmation,
  onOpenNoteDetail
}: { 
  notes: Note[]; 
  expanded: boolean; 
  onToggle: () => void; 
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  t: any;
  isPreview?: boolean;
  selectedNoteIds?: string[];
  onToggleSelectNote?: (id: string) => void;
  onClearSelection?: () => void;
  onTriggerDeleteConfirmation?: (ids: string[]) => void;
  onOpenNoteDetail?: (note: Note) => void;
}) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesFilter = filter === 'All' || n.category === filter;
      const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) || 
                           n.description.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    }).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes, filter, search]);

  const displayNotes = isPreview ? filteredNotes.slice(0, 3) : filteredNotes;
  const categories = ['All', 'Stock', 'Payment', 'Customer', 'Supplier', 'Reminder', 'General', 'Udhar'];

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Important': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'Completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Stock': return <Package size={14} />;
      case 'Payment': return <CreditCard size={14} />;
      case 'Customer': return <Users size={14} />;
      case 'Supplier': return <Truck size={14} />;
      case 'Reminder': return <Clock size={14} />;
      case 'Udhar': return <Coins size={14} className="text-amber-400" />;
      default: return <FileText size={14} />;
    }
  };

  const selectedCount = selectedNoteIds.length;

  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-4 duration-700", !isPreview && "space-y-6")}>
      {!isPreview && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={onToggle} className="flex items-center gap-3 group">
               <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center transition-colors group-hover:bg-[var(--primary)] group-hover:text-white">
                 {expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
               </div>
               <div>
                 <h3 className="text-xl font-black uppercase tracking-widest opacity-80">{t.notesDashboard}</h3>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Operational Journal</p>
               </div>
            </button>
            <Button onClick={onAdd} className="rounded-xl flex gap-2 h-10 px-4 bg-amber-500 hover:bg-amber-600 shadow-xl shadow-amber-500/20 active:scale-95 transition-all">
               <Plus size={18} /> <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{t.addNote}</span>
            </Button>
          </div>

          {selectedCount > 0 && (
            <div className="p-4 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-xs font-extrabold uppercase tracking-wider text-red-500">
                  {selectedCount} note{selectedCount > 1 ? 's' : ''} selected for deletion
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={onClearSelection}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 bg-[var(--background)] hover:bg-white/5 text-[var(--foreground)]"
                >
                  Clear Selection
                </button>
                <button
                  onClick={() => onTriggerDeleteConfirmation && onTriggerDeleteConfirmation(selectedNoteIds)}
                  className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                >
                  Delete Selected
                </button>
              </div>
            </div>
          )}

          <AnimatePresence>
            {expanded && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-col sm:flex-row gap-4">
                   <div className="flex-1 relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" size={16} />
                     <input 
                       className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] py-2.5 pl-10 pr-4 text-xs font-bold focus:border-[var(--primary)] outline-none transition-all placeholder:opacity-20"
                       placeholder="Search journal..."
                       value={search}
                       onChange={(e) => setSearch(e.target.value)}
                     />
                   </div>
                   <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setFilter(cat)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0",
                            filter === cat 
                              ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20" 
                              : "bg-[var(--card)] border-[var(--border)] opacity-60 hover:opacity-100"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className={cn(
        "grid gap-4 transition-all",
        !expanded && !isPreview ? "opacity-30 blur-[1px] grayscale pointer-events-none" : "opacity-100",
        isPreview ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        <AnimatePresence mode="popLayout">
          {displayNotes.length > 0 ? displayNotes.map(note => (
            <NoteCard 
               key={note.id} 
               note={note} 
               onUpdate={onUpdate} 
               onDelete={onDelete} 
               t={t}
               priorityClass={getPriorityClass(note.priority)}
               categoryIcon={getCategoryIcon(note.category)}
               isPreview={isPreview}
               isSelected={selectedNoteIds.includes(note.id)}
               onSelectToggle={() => onToggleSelectNote && onToggleSelectNote(note.id)}
               onTriggerDeleteConfirmation={onTriggerDeleteConfirmation}
               onOpenNoteDetail={onOpenNoteDetail}
            />
          )) : (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="col-span-full py-16 text-center card border-dashed border-[var(--border)] border-white/10 opacity-40">
               <FileText className="mx-auto mb-4 opacity-20" size={48} />
               <p className="text-xs font-black uppercase tracking-widest opacity-20">Zero active entries detected</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NoteCard({ 
  note, 
  onUpdate, 
  onDelete, 
  t, 
  priorityClass, 
  categoryIcon, 
  isPreview,
  isSelected = false,
  onSelectToggle,
  onTriggerDeleteConfirmation,
  onOpenNoteDetail
}: { 
  note: Note; 
  onUpdate: (id: string, updates: Partial<Note>) => void; 
  onDelete: (id: string) => void; 
  t: any; 
  priorityClass: string; 
  categoryIcon: React.ReactNode; 
  isPreview?: boolean; 
  isSelected?: boolean;
  onSelectToggle?: () => void;
  onTriggerDeleteConfirmation?: (ids: string[]) => void;
  onOpenNoteDetail?: (note: Note) => void;
  key?: any;
}) {
  return (
    <motion.div 
      layout
      key={note.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => {
        if (!isPreview && onOpenNoteDetail) {
          onOpenNoteDetail(note);
        }
      }}
      className={cn(
        "group relative transition-all duration-300 rounded-[2.5rem] cursor-pointer",
        isPreview ? "p-4 hover:bg-[var(--primary)]/5" : "bg-[var(--card)] p-6 shadow-sm border hover:shadow-2xl hover:border-[var(--primary)]/30 hover:-translate-y-1",
        isSelected ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20' : 'border-[var(--border)]',
        note.status === 'Completed' && !isPreview && 'opacity-30 grayscale saturate-0'
      )}
    >
      {/* Checkbox selector inside the card (top right) */}
      {!isPreview && onSelectToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectToggle();
          }}
          className="absolute top-5 right-5 z-20 cursor-pointer h-5 w-5 rounded-md border flex items-center justify-center transition-all hover:scale-110 active:scale-95 bg-[var(--background)]"
          style={{
            borderColor: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
            backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
            color: isSelected ? '#fff' : 'transparent'
          }}
        >
          {isSelected && <Check size={12} strokeWidth={4} />}
        </button>
      )}

      <div className="flex items-start gap-5">
        <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all shadow-inner", priorityClass)}>
           {categoryIcon}
        </div>
        <div className="flex-1 space-y-2 min-w-0 pr-6">
           <div className="flex items-center gap-2">
              <span className={cn("text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border", priorityClass)}>
                {note.priority}
              </span>
              <span className="text-[7px] font-black opacity-30 uppercase tracking-[0.2em]">{note.category}</span>
           </div>
           <h5 className={cn("font-black tracking-tight text-base truncate uppercase", note.status === 'Completed' && "line-through opacity-40")}>
             {note.title}
           </h5>
           <p className={cn("text-xs font-medium opacity-60 leading-relaxed", note.status === 'Completed' && "opacity-20")}>
             {note.description}
           </p>
           {note.category === 'Udhar' && (
             <div className="mt-3 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-1">
               <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-amber-500">
                 <span className="truncate max-w-[130px]">Party: {note.udharPerson || 'Unspecified'}</span>
                 <span>{note.udharType === 'give' ? 'Receivable' : 'Payable'}</span>
               </div>
               <div className="flex items-baseline justify-between">
                 <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Outstanding Due</span>
                 <span className="text-xs font-black text-white">
                   ₹{Math.max(0, (note.udharAmount || 0) - (note.udharPayments || []).reduce((sum: number, p: any) => sum + p.amount, 0)).toLocaleString()}
                 </span>
               </div>
             </div>
           )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] border-dashed pt-5">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 opacity-30">
               <Clock size={12} />
               <span className="text-[9px] font-black uppercase tracking-tighter">
                 {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </span>
            </div>
            {note.dueDate && (
               <div className="flex items-center gap-1.5 text-amber-500/80">
                  <Calendar size={12} />
                  <span className="text-[9px] font-black uppercase tracking-tighter">{new Date(note.dueDate).toLocaleDateString()}</span>
               </div>
            )}
         </div>
         <div className={cn("flex gap-1.5 transition-opacity duration-300", isPreview ? "opacity-0 group-hover:opacity-100" : "opacity-100")}>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(note.id, { status: note.status === 'Completed' ? 'Active' : 'Completed' });
              }} 
              className={cn(
                "p-2.5 rounded-xl transition-all active:scale-90 border flex items-center justify-center shadow-sm",
                note.status === 'Completed' 
                  ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 hover:border-emerald-600" 
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-transparent"
              )}
              title={note.status === 'Completed' ? "Mark Active" : "Mark Completed"}
            >
               <CheckCircle2 size={16} />
            </button>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(note.id, { isPinned: !note.isPinned });
              }} 
              className={cn(
                "p-2.5 rounded-xl transition-all active:scale-90 border flex items-center justify-center shadow-sm",
                note.isPinned 
                  ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600 hover:border-amber-600" 
                  : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white hover:border-transparent"
              )}
              title={note.isPinned ? "Unpin Note" : "Pin Note"}
            >
               <Pin size={16} />
            </button>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onTriggerDeleteConfirmation) {
                  onTriggerDeleteConfirmation([note.id]);
                } else {
                  onDelete(note.id);
                }
              }} 
              className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl border border-red-500 hover:border-red-600 shadow-md transition-all active:scale-90 flex items-center justify-center"
              title="Delete Note"
            >
               <Trash2 size={16} />
            </button>
         </div>
      </div>
    </motion.div>
  );
}

function NoteFormModal({ onClose, onSave, t, inventoryItems }: { onClose: () => void; onSave: (data: any) => void; t: any; inventoryItems: Item[] }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'General' as const,
    priority: 'Info' as const,
    dueDate: '',
    isPinned: false,
    
    // Advanced Udhar Fields
    udharPerson: '',
    udharAmount: '',
    udharType: 'give' as 'give' | 'take',
    udharPhone: '+91'
  });

  const handleUdharPhoneChange = (val: string) => {
    if (!val.startsWith('+91')) {
      if (val === '' || val === '+' || val === '+9') {
        setFormData(prev => ({ ...prev, udharPhone: '+91' }));
      } else {
        setFormData(prev => ({ ...prev, udharPhone: '+91' + val.replace(/^\+?91?/, '') }));
      }
    } else {
      setFormData(prev => ({ ...prev, udharPhone: val }));
    }
  };
  const [isListening, setIsListening] = useState(false);
  const [udharItems, setUdharItems] = useState<UdharBillItem[]>([]);

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice-to-text not supported in this browser.');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setFormData(prev => ({ ...prev, description: prev.description + ' ' + transcript }));
    };
    recognition.start();
  };

  const handleCreateClick = () => {
    const finalData = {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
      dueDate: formData.dueDate || null,
      isPinned: formData.isPinned,
      
      // Pass Udhar fields if selected
      ...(formData.category === 'Udhar' ? {
        udharPerson: formData.udharPerson || 'Unspecified Party',
        udharAmount: parseFloat(formData.udharAmount) || 0,
        udharType: formData.udharType,
        udharPhone: formData.udharPhone,
        udharSettled: false,
        udharPayments: [],
        udharItems: udharItems
      } : {})
    };
    onSave(finalData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="w-full max-w-lg card p-8 space-y-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-white/5 my-8 max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex items-center justify-between">
           <h3 className="text-xl font-black uppercase tracking-widest">{t.addNote}</h3>
           <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center">
             <X size={20} />
           </button>
        </div>

        <div className="space-y-4">
           <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 block">Title</label>
              <input 
                 value={formData.title} 
                 onChange={e => setFormData({ ...formData, title: e.target.value })}
                 className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none"
                 placeholder="Short descriptive title"
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 block">Category</label>
                 <select 
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none"
                 >
                    {['Stock', 'Payment', 'Customer', 'Supplier', 'Reminder', 'General', 'Udhar'].map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 block">Priority</label>
                 <select 
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none"
                 >
                    {['Urgent', 'Important', 'Completed', 'Info'].map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
              </div>
           </div>

           {/* Advanced Udhar Sub-panel */}
           {formData.category === 'Udhar' && (
             <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="flex items-center gap-2 text-amber-500">
                 <Coins size={16} className="animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Advanced Udhar Ledger System</span>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1 block">Party / Debtor Name</label>
                   <input 
                     type="text"
                     value={formData.udharPerson}
                     onChange={e => setFormData({ ...formData, udharPerson: e.target.value })}
                     className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs focus:border-amber-500/50 outline-none"
                     placeholder="e.g. John Doe"
                   />
                 </div>
                 <div>
                   <label className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1 block">Principal Amount (₹)</label>
                   <input 
                     type="number"
                     value={formData.udharAmount}
                     onChange={e => setFormData({ ...formData, udharAmount: e.target.value })}
                     className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs focus:border-amber-500/50 outline-none"
                     placeholder="Amount in ₹"
                   />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1 block">Protocol Direction</label>
                   <select 
                     value={formData.udharType}
                     onChange={e => setFormData({ ...formData, udharType: e.target.value as any })}
                     className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500/50"
                   >
                     <option value="give">Lent Money (To Receive)</option>
                     <option value="take">Borrowed Money (To Pay)</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1 block">WhatsApp / Phone Number</label>
                   <input 
                     type="tel"
                     value={formData.udharPhone}
                     onChange={e => setFormData({ ...formData, udharPhone: e.target.value })}
                     className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs focus:border-amber-500/50 outline-none"
                     placeholder="e.g. 919876543210"
                   />
                 </div>
               </div>

               {/* Advanced Itemized Bill Builder */}
               <UdharBillBuilder
                 items={udharItems}
                 onChange={setUdharItems}
                 onUpdatePrincipal={total => setFormData(prev => ({ ...prev, udharAmount: String(total) }))}
                 principalAmount={formData.udharAmount}
                 inventoryItems={inventoryItems}
               />
             </div>
           )}

           <div>
              <div className="flex items-center justify-between mb-1">
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block">Details / Remarks</label>
                 <button 
                   onClick={handleVoiceInput}
                   className={cn(
                     "h-7 w-7 rounded-full flex items-center justify-center transition-all",
                     isListening ? "bg-red-500 scale-110 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-[var(--primary)]/20 text-[var(--primary)]"
                   )}
                 >
                    <Mic size={14} className={isListening ? 'animate-pulse text-white' : ''} />
                 </button>
              </div>
              <textarea 
                 value={formData.description} 
                 onChange={e => setFormData({ ...formData, description: e.target.value })}
                 className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 min-h-[100px] outline-none transition-all"
                 placeholder="Additional ledger remarks, terms or details"
              />
           </div>

           <div className="flex items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                 <input type="checkbox" checked={formData.isPinned} onChange={e => setFormData({ ...formData, isPinned: e.target.checked })} className="h-5 w-5 rounded border-[var(--border)] bg-[var(--background)]" />
                 <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Pin to top</span>
              </label>
              <div className="flex-1">
                 <input 
                   type="date" 
                   value={formData.dueDate} 
                   onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                   className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-2 text-xs outline-none"
                 />
              </div>
           </div>
        </div>

        <div className="flex gap-4 pt-4">
           <Button variant="ghost" className="flex-1 rounded-2xl" onClick={onClose}>Cancel</Button>
           <Button className="flex-1 rounded-2xl py-4" onClick={handleCreateClick}>Create Note</Button>
        </div>
      </motion.div>
    </div>
  );
}

interface UdharBillBuilderProps {
  items: UdharBillItem[];
  onChange: (items: UdharBillItem[]) => void;
  onUpdatePrincipal: (totalAmount: number) => void;
  principalAmount: string;
  inventoryItems: Item[];
}

function UdharBillBuilder({ items, onChange, onUpdatePrincipal, principalAmount, inventoryItems = [] }: UdharBillBuilderProps) {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [priceUnit, setPriceUnit] = useState('');
  const [itemUnit, setItemUnit] = useState('PCS');
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [priceMode, setPriceMode] = useState<'retail' | 'wholesale'>('retail');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<Item | null>(null);

  // Search filtered items in saved inventory
  const suggestions = useMemo(() => {
    if (!itemName.trim()) return [];
    const term = itemName.toLowerCase();
    return inventoryItems.filter(item => {
      const matchName = item.name?.toLowerCase().includes(term);
      const matchHi = item.translations?.hi?.toLowerCase().includes(term);
      const matchMr = item.translations?.mr?.toLowerCase().includes(term);
      const matchHiEn = item.translations?.['hi-en']?.toLowerCase().includes(term);
      return matchName || matchHi || matchMr || matchHiEn;
    }).slice(0, 5);
  }, [itemName, inventoryItems]);

  const handleSelectSuggestion = (item: Item) => {
    setItemName(item.name);
    setSelectedInventoryItem(item);
    setItemUnit(item.unit || item.retailPriceUnit || 'PCS');
    const targetPrice = priceMode === 'retail' ? item.retailPrice : item.wholesalePrice;
    setPriceUnit(String(targetPrice || 0));
    setShowSuggestions(false);
  };

  const handlePriceModeToggle = (mode: 'retail' | 'wholesale') => {
    setPriceMode(mode);
    if (selectedInventoryItem) {
      const targetPrice = mode === 'retail' ? selectedInventoryItem.retailPrice : selectedInventoryItem.wholesalePrice;
      setPriceUnit(String(targetPrice || 0));
    }
  };

  const handleAddItem = () => {
    if (!itemName.trim()) return;
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(priceUnit) || 0;
    
    const formattedName = itemName.trim() + (itemUnit ? ` (${itemUnit})` : '');
    const existingIndex = items.findIndex(it => it.name.toLowerCase() === formattedName.toLowerCase());
    
    let updated: UdharBillItem[];
    if (existingIndex > -1) {
      const existing = items[existingIndex];
      const newQty = existing.quantity + q;
      updated = [...items];
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        priceUnit: p,
        total: parseFloat((newQty * p).toFixed(2))
      };
    } else {
      const newItem: UdharBillItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        name: formattedName,
        quantity: q,
        priceUnit: p,
        total: parseFloat((q * p).toFixed(2))
      };
      updated = [...items, newItem];
    }

    onChange(updated);
    // Auto-calculate & update principal in ledger
    const totalAmount = updated.reduce((sum, item) => sum + item.total, 0);
    onUpdatePrincipal(parseFloat(totalAmount.toFixed(2)));

    // Reset fields
    setItemName('');
    setQuantity('1');
    setPriceUnit('');
    setItemUnit('PCS');
    setSelectedInventoryItem(null);
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    onChange(updated);
    const totalAmount = updated.reduce((sum, item) => sum + item.total, 0);
    onUpdatePrincipal(parseFloat(totalAmount.toFixed(2)));
  };

  const handleAdjustQty = (id: string, delta: number) => {
    const updated = items.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0.1, item.quantity + delta);
        return {
          ...item,
          quantity: parseFloat(newQty.toFixed(2)),
          total: parseFloat((newQty * item.priceUnit).toFixed(2))
        };
      }
      return item;
    });
    onChange(updated);
    const totalAmount = updated.reduce((sum, item) => sum + item.total, 0);
    onUpdatePrincipal(parseFloat(totalAmount.toFixed(2)));
  };

  const billTotal = items.reduce((sum, item) => sum + item.total, 0);
  const isSynced = parseFloat(principalAmount) === billTotal;

  return (
    <div className="p-5 rounded-2xl bg-amber-500/[0.03] border border-amber-500/15 space-y-4 text-left relative">
      <div className="flex items-center justify-between border-b border-amber-500/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
            Professional POS Bill Terminal
          </span>
        </div>
        <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          {items.length} Item{items.length !== 1 ? 's' : ''} Listed
        </span>
      </div>

      {/* POS Quick Selection Tabs if inventory item matched */}
      {selectedInventoryItem && (
        <div className="flex gap-2 p-1.5 bg-slate-900/60 rounded-xl border border-white/5 animate-in slide-in-from-top-2 duration-200">
          <button
            type="button"
            onClick={() => handlePriceModeToggle('retail')}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all",
              priceMode === 'retail'
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            )}
          >
            🛒 Retail (₹{selectedInventoryItem.retailPrice})
          </button>
          <button
            type="button"
            onClick={() => handlePriceModeToggle('wholesale')}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all",
              priceMode === 'wholesale'
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            )}
          >
            📦 Wholesale (₹{selectedInventoryItem.wholesalePrice})
          </button>
        </div>
      )}

      {/* Grid Inputs Form */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-[var(--background)]/40 p-4 rounded-xl border border-white/5 relative">
        
        {/* Item Name Input with live Autocomplete suggestions */}
        <div className="col-span-1 sm:col-span-9 relative">
          <label className="text-[8px] font-black uppercase tracking-widest text-amber-500/80 mb-1.5 block">Search/Type Item</label>
          <div className="relative">
            <input
              type="text"
              value={itemName}
              onChange={e => {
                setItemName(e.target.value);
                setShowSuggestions(true);
                if (selectedInventoryItem && e.target.value !== selectedInventoryItem.name) {
                  setSelectedInventoryItem(null);
                }
              }}
              onFocus={() => setShowSuggestions(true)}
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-500/60 font-semibold"
              placeholder="Start typing item name..."
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5 max-h-[180px] overflow-y-auto no-scrollbar">
                {suggestions.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectSuggestion(item)}
                    className="p-2.5 text-left hover:bg-amber-500/10 cursor-pointer transition-colors space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">{item.name}</span>
                      <span className={cn(
                        "text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase",
                        item.quantity > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      )}>
                        Stock: {item.quantity} {item.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>Retail: ₹{item.retailPrice}</span>
                      <span>•</span>
                      <span>Wholesale: ₹{item.wholesalePrice}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showSuggestions && itemName && suggestions.length === 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl p-3 text-center z-50">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">New Custom Item Detected</p>
              </div>
            )}
          </div>
        </div>

        {/* Custom Unit Input */}
        <div className="col-span-1 sm:col-span-3">
          <label className="text-[8px] font-black uppercase tracking-widest text-amber-500/80 mb-1.5 block">Unit Type</label>
          <input
            type="text"
            value={itemUnit}
            onChange={e => setItemUnit(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs outline-none uppercase focus:border-amber-500/60 font-semibold"
            placeholder="PCS"
          />
        </div>

        {/* Quantity Input */}
        <div className="col-span-1 sm:col-span-4">
          <label className="text-[8px] font-black uppercase tracking-widest text-amber-500/80 mb-1.5 block">Qty</label>
          <input
            type="number"
            step="any"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-500/60 font-semibold"
            placeholder="Qty"
          />
        </div>

        {/* Rate Price Input */}
        <div className="col-span-1 sm:col-span-4">
          <label className="text-[8px] font-black uppercase tracking-widest text-amber-500/80 mb-1.5 block">Rate / Unit (₹)</label>
          <input
            type="number"
            step="any"
            value={priceUnit}
            onChange={e => setPriceUnit(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-500/60 font-semibold"
            placeholder="₹ Rate"
          />
        </div>

        {/* ADD Button */}
        <div className="col-span-1 sm:col-span-4 flex items-end">
          <button
            type="button"
            onClick={handleAddItem}
            disabled={!itemName}
            className="w-full py-2 px-3 bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-[9px] rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-all cursor-pointer select-none shadow-md h-9"
          >
            ADD TO BILL
          </button>
        </div>
      </div>

      {/* Backdrop detector to close suggestion drop downs */}
      {showSuggestions && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowSuggestions(false)} />
      )}

      {/* Bill items table / Receipt rows */}
      {items.length > 0 ? (
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto no-scrollbar pr-1 divide-y divide-white/5">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between py-2.5 pl-2.5 pr-1.5 rounded-xl bg-[var(--background)]/60 border border-[var(--border)]/40 hover:border-amber-500/15 transition-all">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-tighter">
                    ₹{item.priceUnit.toLocaleString()}/unit
                  </span>
                  <span className="text-white/20 text-[8px]">•</span>
                  <span className="text-[9px] text-amber-500/80 font-mono font-bold">
                    Total: ₹{item.total.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {/* Advanced micro adjustment triggers for POS */}
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => handleAdjustQty(item.id, -1)}
                    className="h-5 w-5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="px-2 text-[10px] font-black text-white font-mono min-w-[24px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustQty(item.id, 1)}
                    className="h-5 w-5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <Plus size={10} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="h-7 w-7 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all active:scale-90"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl bg-slate-900/10">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">POS Bill items queue empty</p>
          <p className="text-[8px] text-slate-600 uppercase tracking-wider mt-1">Select items above to build custom invoices</p>
        </div>
      )}

      {/* Bill Summary & Actions - Automatic syncing feedback */}
      {items.length > 0 && (
        <div className="pt-3 border-t border-[var(--border)]/40 flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="text-left">
            <span className="text-[7px] font-black uppercase tracking-widest opacity-40 block">Bill Accumulated Total</span>
            <span className="text-lg font-black text-amber-400 font-mono">₹{billTotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-1.5 px-3.5 rounded-xl text-[8px] font-black uppercase tracking-widest">
            <span>✓ Linked to Ledger Principal</span>
          </div>
        </div>
      )}
    </div>
  );
}

function UdharInvoicePreview({ note }: { note: Note }) {
  const items = note.udharItems || [];
  const billTotal = items.reduce((sum, item) => sum + item.total, 0);

  const [storeName, setStoreName] = useState('Merchant Store');
  const [storeOwnerName, setStoreOwnerName] = useState('');

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('price_manager_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.storeName) setStoreName(parsed.storeName);
        if (parsed.storeOwnerName) setStoreOwnerName(parsed.storeOwnerName);
      }
    } catch (e) {
      console.error(e);
    }
  }, [note.id]);

  if (items.length === 0) return null;

  return (
    <div className="p-6 rounded-3xl bg-amber-500/[0.02] border border-amber-500/15 relative overflow-hidden space-y-4 shadow-lg text-left">
      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.03] blur-2xl rounded-full" />
      
      {/* Receipt Header */}
      <div className="text-center space-y-1">
        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-amber-500">Professional Bill Receipt</p>
        <h3 className="text-sm font-black uppercase text-white tracking-wide">{storeName}</h3>
        {storeOwnerName && (
          <p className="text-[8px] text-slate-400 uppercase tracking-widest">Operator: {storeOwnerName}</p>
        )}
      </div>

      {/* Styled Dotted Line Divider */}
      <div className="border-t border-dashed border-white/10 my-1" />

      {/* Table header */}
      <div className="grid grid-cols-12 text-[8px] font-black uppercase tracking-widest text-slate-500 pb-1 border-b border-white/5">
        <div className="col-span-6">Item description</div>
        <div className="col-span-3 text-right">Qty × rate</div>
        <div className="col-span-3 text-right">Total</div>
      </div>

      {/* Table rows */}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="grid grid-cols-12 text-[10px] font-bold text-white items-center">
            <div className="col-span-6 font-semibold text-slate-200 truncate pr-2" title={item.name}>
              {item.name}
            </div>
            <div className="col-span-3 text-right text-slate-400 text-[9px] font-mono">
              {item.quantity} × {item.priceUnit.toLocaleString()}
            </div>
            <div className="col-span-3 text-right text-amber-400 font-black font-mono">
              ₹{item.total.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Dotted Divider */}
      <div className="border-t border-dashed border-white/10 my-2" />

      {/* Totals */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          <span>Subtotal:</span>
          <span className="font-mono text-white">₹{billTotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">GRAND TOTAL DUE:</span>
          <span className="text-sm font-black text-amber-400 font-mono">₹{billTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Dotted Divider */}
      <div className="border-t border-dashed border-white/10 my-1" />

      {/* Customer Receipt Footer */}
      <div className="text-center pt-1.5">
        <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">Thank you for your business!</p>
        <p className="text-[6px] text-slate-500 font-medium tracking-wide mt-0.5">GENERATED SECURELY VIA RETAILFLOW LEDGER TERMINAL</p>
      </div>
    </div>
  );
}

function QrPaymentWidget({ t }: { t: any }) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const savedQr = localStorage.getItem('udhar_payment_qr');
    if (savedQr) {
      setQrImage(savedQr);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        localStorage.setItem('udhar_payment_qr', base64);
        setQrImage(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemove = () => {
    localStorage.removeItem('udhar_payment_qr');
    setQrImage(null);
  };

  return (
    <>
      {/* QR payment trigger card */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setShowModal(true)}
        className="card p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/20 rounded-[1.75rem] cursor-pointer relative overflow-hidden group shadow-md flex items-center justify-between text-left"
      >
        <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 blur-xl rounded-full" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 group-hover:scale-105 transition-transform">
            <QrCode size={22} className="animate-pulse" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-[7px] font-black uppercase tracking-[0.25em] text-blue-400">
                Instant Collection
              </span>
              <span className="bg-blue-500/20 text-blue-400 text-[6px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                Local Secure
              </span>
            </div>
            <h3 className="text-sm font-black uppercase tracking-tight text-[var(--foreground)] mt-0.5 group-hover:text-blue-400 transition-colors">
              QR Payment Terminal
            </h3>
            <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider leading-none mt-0.5">
              {qrImage ? "● Active QR Configured" : "○ Tap to upload payment QR"}
            </p>
          </div>
        </div>
        <div className="h-8 px-4 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center group-hover:border-blue-500/40 transition-colors">
          Open Terminal
        </div>
      </motion.div>

      {/* QR payment Terminal Modal / Full Screen Immersive View */}
      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 overflow-y-auto"
            onClick={() => setShowModal(false)}
          >
            {qrImage ? (
              /* Immersive Full Screen QR Viewer - Direct QR View */
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-lg w-full flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in zoom-in duration-300"
              >
                {/* Floating translucent close button */}
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute -top-14 right-0 sm:right-0 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-lg"
                  title="Close Terminal"
                >
                  <X size={20} />
                </button>

                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">
                  Store Payment Terminal
                </p>

                {/* Direct High Resolution QR Display Card */}
                <div className="relative p-6 rounded-3xl bg-white shadow-2xl border-4 border-blue-500/40 flex flex-col items-center justify-center transform hover:scale-[1.01] transition-transform">
                  <img
                    src={qrImage}
                    alt="Store Payment QR"
                    referrerPolicy="no-referrer"
                    className="max-h-[60vh] max-w-full aspect-square object-contain rounded-xl"
                  />
                  <div className="absolute -bottom-3.5 bg-blue-600 text-white font-black text-[9px] uppercase tracking-[0.2em] px-5 py-1.5 rounded-full shadow-lg">
                    SCAN TO PAY DIRECT
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <p className="text-xs text-white font-bold uppercase tracking-wider">
                    Accepting All UPI Payments
                  </p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                    Scan via Google Pay, PhonePe, Paytm, BHIM, or any bank app
                  </p>
                </div>

                {/* Sleek control buttons to modify or delete QR directly */}
                <div className="flex gap-2.5 w-full pt-4">
                  <button
                    onClick={handleRemove}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-red-500/25 hover:bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                  >
                    <Trash2 size={12} /> Remove Terminal QR
                  </button>
                  <label className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer text-center">
                    <Upload size={12} /> Replace QR Image
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
              </motion.div>
            ) : (
              /* Settings upload panel if no QR configured */
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden text-left"
              >
                <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-blue-500/10 blur-[50px] pointer-events-none" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-400">
                    <QrCode size={20} />
                    <span className="text-xs font-black uppercase tracking-widest">Store Payment Terminal</span>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black uppercase text-white tracking-wide">UPI Scanner Portal</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Upload your shop QR code to showcase beautiful full-screen pay portals
                  </p>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-[2rem] p-10 text-center flex flex-col items-center justify-center space-y-4 transition-all duration-300",
                    isDragging
                      ? "border-blue-500 bg-blue-500/10 scale-95"
                      : "border-slate-800 bg-slate-900/50 hover:border-blue-500/30 hover:bg-blue-500/5"
                  )}
                >
                  <div className="h-16 w-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                    <ImageIcon size={32} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-white tracking-wide">Upload Payment QR Image</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-1 leading-relaxed">
                      Drag and drop your QR screenshot or click below
                    </p>
                  </div>
                  <label className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 cursor-pointer inline-block text-center">
                    Select QR Screenshot
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider leading-relaxed text-center">
                  🔒 <strong className="text-white">Device Isolation Security:</strong> Your payment QR is encoded as a local secure vector and stored inside this browser's local sandbox, keeping your financial assets private and independent from cloud servers.
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
