import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  History, 
  Trash2, 
  Plus, 
  Minus, 
  Search, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Keyboard, 
  Percent, 
  Settings, 
  FolderDown, 
  Tag, 
  Check, 
  ShoppingBag, 
  X, 
  FileText, 
  Star, 
  Settings2, 
  Coins, 
  Info,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Eye,
  Save,
  Download,
  RefreshCw,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Undo,
  Redo
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Item, Category } from '../types';
import { triggerHapticFeedback, playSynthesizedSound } from '../lib/utils';
import { auth, db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface OptimizedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChange: (val: string) => void;
}

function OptimizedInput({ value, onChange, ...props }: OptimizedInputProps) {
  const [localValue, setLocalValue] = useState(String(value ?? ''));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(String(value ?? ''));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    
    // Defer parent state update to the next tick to prioritize instant browser rendering
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

interface CalculatorWorkspaceProps {
  items: Item[];
  categories: Category[];
  t: any;
  language: string;
  currency: string;
  onUpdateItem: (id: string, data: Partial<Item>) => Promise<any>;
}

interface POSBillItem {
  id: string; // unique billing item id
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  priceType: 'retail' | 'wholesale';
  discount: number; // flat discount
  tax: number; // percentage
  notes: string;
  retailPrice: number;
  wholesalePrice: number;
}

interface CalcHistoryEntry {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
  createdAt: number;
  label?: string;
}

interface DraftBill {
  id: string;
  name: string;
  items: POSBillItem[];
  timestamp: string;
}

interface SavedBill {
  id: string;
  billNumber: string;
  items: POSBillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  timestamp: string;
  createdAt: number;
  customerName: string;
  notes?: string;
}

interface ToastMsg {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

export default function CalculatorWorkspace({
  items,
  categories,
  t,
  language,
  currency,
  onUpdateItem
}: CalculatorWorkspaceProps) {
  // Mode selection
  const [mode, setMode] = useState<'universal' | 'pos' | 'history'>('universal');

  // Local beautiful notification toast state
  const [localToasts, setLocalToasts] = useState<ToastMsg[]>([]);
  const addToast = (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setLocalToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setLocalToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Bill History State
  const [savedBills, setSavedBills] = useState<SavedBill[]>(() => {
    const saved = localStorage.getItem('ts_saved_bills');
    return saved ? JSON.parse(saved) : [];
  });

  // Additional Invoicing details
  const [customerName, setCustomerName] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

  // View & Preview modals
  const [activePreviewBill, setActivePreviewBill] = useState<SavedBill | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 30-day automatic permanent deletion popup states
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [expiredBills, setExpiredBills] = useState<SavedBill[]>([]);

  // Settings state
  const [settings, setSettings] = useState(() => {
    const defaults = {
      calcSounds: true,
      calcVibration: true,
      largeButtons: false,
      keyboardNav: true,
      autoFocusSearch: true,
      voiceSearch: true,
      rememberLastMode: true,
      showLiveSummary: true,
      enableSmartCash: true,
      showRecentProducts: true,
      enableCalculationHistory: true,
    };
    const saved = localStorage.getItem('ts_calc_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Map old enableCalcHistory if present
        if (parsed.enableCalcHistory !== undefined && parsed.enableCalculationHistory === undefined) {
          parsed.enableCalculationHistory = parsed.enableCalcHistory;
        }
        return { ...defaults, ...parsed };
      } catch (e) { /* fallback */ }
    }
    return defaults;
  });

  // Save settings on update
  useEffect(() => {
    localStorage.setItem('ts_calc_settings', JSON.stringify(settings));
  }, [settings]);

  // Remember last mode
  useEffect(() => {
    if (settings.rememberLastMode) {
      const savedMode = localStorage.getItem('ts_calc_last_mode');
      if (savedMode === 'universal' || savedMode === 'pos' || savedMode === 'history') {
        setMode(savedMode);
      }
    }
  }, [settings.rememberLastMode]);

  const handleModeChange = (newMode: 'universal' | 'pos' | 'history') => {
    setMode(newMode);
    if (settings.rememberLastMode) {
      localStorage.setItem('ts_calc_last_mode', newMode);
    }
    playClickSound(800, 0.08);
    triggerVibration();
  };

  // Web Audio feedback
  const playClickSound = (frequency = 1000, duration = 0.05) => {
    if (!settings.calcSounds) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = frequency;
      gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // AudioContext blocked or unsupported
    }
  };

  const triggerVibration = () => {
    if (settings.calcVibration !== false) {
      triggerHapticFeedback(20);
    }
  };

  // ---------------------------------------------------------------------------
  // UNIVERSAL MODE STATE
  // ---------------------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcResultPreview, setCalcResultPreview] = useState('');
  const [memoryValue, setMemoryValue] = useState(0);
  const [calcHistory, setCalcHistory] = useState<CalcHistoryEntry[]>([]);
  const [showHistoryPane, setShowHistoryPane] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingLabelText, setEditingLabelText] = useState('');
  const calcInputRef = useRef<HTMLInputElement>(null);
  const [showWorkspaceSettingsModal, setShowWorkspaceSettingsModal] = useState(false);
  
  // Custom states for navigation, search, highlighting, and named saving
  const [isCalcInputFocused, setIsCalcInputFocused] = useState(false);
  const [calcHistorySearchQuery, setCalcHistorySearchQuery] = useState('');
  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(null);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [saveNameText, setSaveNameText] = useState('');

  // Advanced features state
  const [showScientific, setShowScientific] = useState(false);
  const [calcUndoStack, setCalcUndoStack] = useState<string[]>(['0']);
  const [calcRedoStack, setCalcRedoStack] = useState<string[]>([]);
  const [billToDeleteId, setBillToDeleteId] = useState<string | null>(null);
  const [showClearAllBillsConfirm, setShowClearAllBillsConfirm] = useState(false);

  // Monitor Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Synchronize and load calculations
  useEffect(() => {
    const loadCalculations = async () => {
      // 1. Load local calculations
      let localEntries: CalcHistoryEntry[] = [];
      try {
        const saved = localStorage.getItem('ts_calc_history');
        if (saved) {
          const parsed: CalcHistoryEntry[] = JSON.parse(saved);
          const now = Date.now();
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          
          // Unnamed local entries are permanently deleted if older than 30 days
          localEntries = parsed.filter(entry => {
            const created = entry.createdAt || now;
            return (now - created) < thirtyDaysMs;
          });
          
          if (localEntries.length !== parsed.length) {
            localStorage.setItem('ts_calc_history', JSON.stringify(localEntries));
          }
        }
      } catch (e) {
        console.error("Local history load failed:", e);
      }

      if (currentUser) {
        try {
          const calcCol = collection(db, 'users', currentUser.uid, 'calculations');
          const snapshot = await getDocs(calcCol);
          const cloudEntries: CalcHistoryEntry[] = [];
          const now = Date.now();
          const twentyEightDaysMs = 28 * 24 * 60 * 60 * 1000;

          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const created = data.createdAt || now;
            
            if (now - created >= twentyEightDaysMs) {
              // 28 days completed for that saved name calculation: delete permanently!
              try {
                await deleteDoc(doc(db, 'users', currentUser.uid, 'calculations', docSnap.id));
              } catch (e) {
                console.error("Expired cloud calculation cleanup failed:", e);
              }
            } else {
              cloudEntries.push({
                id: docSnap.id,
                expression: data.expression || '',
                result: data.result || '',
                timestamp: data.timestamp || '',
                createdAt: data.createdAt || now,
                label: data.label || ''
              });
            }
          }

          // Merge: local entries that do not have a label, and cloud entries
          const merged = [
            ...localEntries.filter(item => !item.label),
            ...cloudEntries
          ].sort((a, b) => b.createdAt - a.createdAt);

          setCalcHistory(merged);

          // Auto-migrate local labeled items to Firestore if signed in
          const localLabeled = localEntries.filter(item => item.label && item.label.trim() !== '');
          if (localLabeled.length > 0) {
            for (const item of localLabeled) {
              try {
                await setDoc(doc(db, 'users', currentUser.uid, 'calculations', item.id), {
                  id: item.id,
                  expression: item.expression,
                  result: item.result,
                  timestamp: item.timestamp,
                  createdAt: item.createdAt,
                  label: item.label
                });
              } catch (e) {
                console.error("Failed to migrate local calculation to cloud:", e);
              }
            }
            // Clear labeled entries from local storage since they are now in Firestore
            const cleanedLocal = localEntries.filter(item => !item.label);
            localStorage.setItem('ts_calc_history', JSON.stringify(cleanedLocal));
            
            // Re-merge
            setCalcHistory(prev => {
              const cloudIds = new Set(cloudEntries.map(c => c.id));
              const deduplicatedLocal = prev.filter(item => !item.label || cloudIds.has(item.id));
              return [
                ...deduplicatedLocal,
                ...localLabeled
              ].sort((a, b) => b.createdAt - a.createdAt);
            });
            
            addToast(`Migrated ${localLabeled.length} named calculations to cloud!`, "success");
          }
        } catch (e) {
          console.error("Cloud history load failed:", e);
          setCalcHistory(localEntries.sort((a, b) => b.createdAt - a.createdAt));
        }
      } else {
        // Not logged in: show all local calculations (including local labeled ones)
        setCalcHistory(localEntries.sort((a, b) => b.createdAt - a.createdAt));
      }
    };

    loadCalculations();
  }, [currentUser]);

  // Save/Sync name/label updates for calculations
  const saveCalculationLabel = async (id: string, label: string) => {
    const entry = calcHistory.find(item => item.id === id);
    if (!entry) return;

    const trimmedLabel = label.trim();
    const updatedEntry = { ...entry, label: trimmedLabel };

    if (currentUser && trimmedLabel) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'calculations', id), {
          id,
          expression: entry.expression,
          result: entry.result,
          timestamp: entry.timestamp,
          createdAt: entry.createdAt,
          label: trimmedLabel
        });
        addToast("Saved to cloud successfully!", "success");
      } catch (e) {
        console.error("Cloud save failed:", e);
        addToast("Saved locally.", "warning");
      }
    } else if (trimmedLabel) {
      addToast("Saved locally! Login to backup to cloud.", "info");
    }

    setCalcHistory(prev => {
      const updated = prev.map(item => item.id === id ? updatedEntry : item);
      // Write local-only (unnamed, or all if offline) to localStorage
      const localToSave = updated.filter(item => !item.label || !currentUser);
      localStorage.setItem('ts_calc_history', JSON.stringify(localToSave));
      return updated;
    });
  };

  // Delete calculation history entry (handles both local and cloud)
  const handleDeleteHistoryEntry = async (id: string) => {
    playClickSound(850, 0.08);
    triggerVibration();

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'calculations', id));
      } catch (e) {
        console.error("Cloud delete failed:", e);
      }
    }

    setCalcHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      const localToSave = updated.filter(item => !item.label || !currentUser);
      localStorage.setItem('ts_calc_history', JSON.stringify(localToSave));
      return updated;
    });

    addToast("Calculation deleted.", "success");
  };

  // Save calc history (unnamed, local-only by default)
  const addHistoryEntry = (expression: string, result: string) => {
    const newEntry: CalcHistoryEntry = {
      id: Math.random().toString(36).substring(2, 11),
      expression,
      result,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      createdAt: Date.now()
    };
    setCalcHistory(prev => {
      const updated = [newEntry, ...prev].slice(0, 50);
      const localToSave = updated.filter(item => !item.label || !currentUser);
      localStorage.setItem('ts_calc_history', JSON.stringify(localToSave));
      return updated;
    });
  };

  // Move manual navigation cursor
  const moveCursorLeft = () => {
    const input = calcInputRef.current;
    if (input) {
      const start = input.selectionStart ?? 0;
      const newPos = Math.max(0, start - 1);
      input.setSelectionRange(newPos, newPos);
      input.focus();
    }
  };

  const moveCursorRight = () => {
    const input = calcInputRef.current;
    if (input) {
      const start = input.selectionStart ?? 0;
      const newPos = Math.min(calcDisplay.length, start + 1);
      input.setSelectionRange(newPos, newPos);
      input.focus();
    }
  };

  // Save named calculation handler
  const handleOpenSaveNameModal = () => {
    if (!calcDisplay || calcDisplay === '0' || calcDisplay === 'Error') {
      addToast("Nothing to name yet. Enter an expression!", "warning");
      return;
    }
    const result = evaluateExpression(calcDisplay);
    if (!result || result === 'Error') {
      addToast("Invalid expression to save.", "error");
      return;
    }
    setSaveNameText('');
    setShowSaveNameModal(true);
  };

  const handleSaveNamedCalculation = async () => {
    const label = saveNameText.trim();
    if (!label) {
      addToast("Please enter a name.", "warning");
      return;
    }

    const result = evaluateExpression(calcDisplay);
    const newId = Math.random().toString(36).substring(2, 11);
    const newEntry: CalcHistoryEntry = {
      id: newId,
      expression: calcDisplay,
      result: result || '0',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      createdAt: Date.now(),
      label
    };

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'calculations', newId), {
          id: newId,
          expression: calcDisplay,
          result: result || '0',
          timestamp: newEntry.timestamp,
          createdAt: newEntry.createdAt,
          label
        });
        addToast("Saved to cloud successfully!", "success");
      } catch (e) {
        console.error("Cloud save failed:", e);
        addToast("Saved locally.", "warning");
      }
    } else {
      addToast("Saved locally! Login to backup to cloud.", "info");
    }

    setCalcHistory(prev => {
      const updated = [newEntry, ...prev].slice(0, 50);
      const localToSave = updated.filter(item => !item.label || !currentUser);
      localStorage.setItem('ts_calc_history', JSON.stringify(localToSave));
      return updated;
    });

    setShowSaveNameModal(false);
  };

  // Evaluate current expression safely
  const evaluateExpression = (expr: string): string => {
    try {
      let sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/π/g, 'Math.PI')
        .replace(/e/g, 'Math.E')
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/ln\(/g, 'Math.log(')
        .replace(/log\(/g, 'Math.log10(')
        .replace(/√\(/g, 'Math.sqrt(');

      // Handle power of 2 like x²: represented as ² in UI
      sanitized = sanitized.replace(/²/g, '**2');

      // Strip trailing operators/dots/unfinished structures for live preview evaluation
      let cleanExpr = sanitized;
      while (
        cleanExpr && 
        (['+', '-', '*', '/', '.', '('].includes(cleanExpr.slice(-1)) || 
         cleanExpr.endsWith('Math.sin') || 
         cleanExpr.endsWith('Math.cos') || 
         cleanExpr.endsWith('Math.tan') || 
         cleanExpr.endsWith('Math.log') || 
         cleanExpr.endsWith('Math.log10') || 
         cleanExpr.endsWith('Math.sqrt') || 
         cleanExpr.endsWith('Math.PI') || 
         cleanExpr.endsWith('Math.E'))
      ) {
        if (cleanExpr.endsWith('Math.sin') || cleanExpr.endsWith('Math.cos') || cleanExpr.endsWith('Math.tan') || cleanExpr.endsWith('Math.log') || cleanExpr.endsWith('Math.sqrt')) {
          cleanExpr = cleanExpr.slice(0, -8);
        } else if (cleanExpr.endsWith('Math.log10')) {
          cleanExpr = cleanExpr.slice(0, -10);
        } else if (cleanExpr.endsWith('Math.PI') || cleanExpr.endsWith('Math.E')) {
          cleanExpr = cleanExpr.slice(0, -7);
        } else {
          cleanExpr = cleanExpr.slice(0, -1);
        }
      }

      // Automatically balance/close unmatched parentheses
      const openBrackets = (cleanExpr.match(/\(/g) || []).length;
      const closeBrackets = (cleanExpr.match(/\)/g) || []).length;
      if (openBrackets > closeBrackets) {
        cleanExpr += ')'.repeat(openBrackets - closeBrackets);
      }

      if (!cleanExpr.trim()) return '';
      // Safe execution using standard Function wrapper
      const result = new Function(`return (${cleanExpr})`)();
      if (result === undefined || isNaN(result) || !isFinite(result)) return 'Error';
      // Format to maximum 6 decimal places to prevent float errors
      return String(Number(result.toFixed(6)));
    } catch (e) {
      return '';
    }
  };

  // Centralized calculator display and undo/redo stack manager
  const updateCalcDisplay = (nextDisp: string) => {
    setCalcUndoStack(prev => {
      if (prev[prev.length - 1] === nextDisp) return prev;
      return [...prev, nextDisp];
    });
    setCalcRedoStack([]); // Clear redo stack on any new input
    setCalcDisplay(nextDisp);
    setCalcResultPreview(evaluateExpression(nextDisp));
  };

  // Undo and Redo actions
  const handleUndo = () => {
    if (calcUndoStack.length <= 1) return;
    const current = calcUndoStack[calcUndoStack.length - 1];
    const previousStack = calcUndoStack.slice(0, -1);
    const previousValue = previousStack[previousStack.length - 1];
    
    setCalcUndoStack(previousStack);
    setCalcRedoStack(prev => [...prev, current]);
    setCalcDisplay(previousValue);
    setCalcResultPreview(evaluateExpression(previousValue));
    
    playClickSound(950, 0.05);
    triggerVibration();
  };

  const handleRedo = () => {
    if (calcRedoStack.length === 0) return;
    const nextValue = calcRedoStack[calcRedoStack.length - 1];
    
    setCalcUndoStack(prev => [...prev, nextValue]);
    setCalcRedoStack(prev => prev.slice(0, -1));
    setCalcDisplay(nextValue);
    setCalcResultPreview(evaluateExpression(nextValue));
    
    playClickSound(1050, 0.05);
    triggerVibration();
  };

  // Handle keypress inside Universal mode with support for Cursor position manual navigation!
  const handleCalcKeyPress = (val: string) => {
    playClickSound(1000, 0.04);
    triggerVibration();

    let start = calcDisplay.length;
    let end = calcDisplay.length;

    const inputEl = calcInputRef.current;
    if (inputEl) {
      start = inputEl.selectionStart ?? calcDisplay.length;
      end = inputEl.selectionEnd ?? calcDisplay.length;
    }

    if (val === 'C') {
      updateCalcDisplay('0');
      setTimeout(() => {
        if (calcInputRef.current) {
          calcInputRef.current.focus();
          calcInputRef.current.setSelectionRange(1, 1);
        }
      }, 5);
    } else if (val === '⌫') {
      let nextDisp = '';
      let nextCursor = 0;
      if (start === end) {
        if (start === 0) return;
        nextDisp = calcDisplay.slice(0, start - 1) + calcDisplay.slice(start);
        nextCursor = start - 1;
      } else {
        nextDisp = calcDisplay.slice(0, start) + calcDisplay.slice(end);
        nextCursor = start;
      }
      if (nextDisp === '') nextDisp = '0';
      updateCalcDisplay(nextDisp);
      setTimeout(() => {
        if (calcInputRef.current) {
          calcInputRef.current.focus();
          calcInputRef.current.setSelectionRange(nextCursor, nextCursor);
        }
      }, 5);
    } else if (val === '=') {
      const result = evaluateExpression(calcDisplay);
      if (result && result !== 'Error') {
        addHistoryEntry(calcDisplay, result);
        updateCalcDisplay(result);
      } else {
        updateCalcDisplay('Error');
      }
    } else if (val === '%') {
      try {
        const result = Number(evaluateExpression(calcDisplay)) / 100;
        updateCalcDisplay(String(result));
      } catch (e) {
        updateCalcDisplay('Error');
      }
    } else if (['+', '-', '×', '÷'].includes(val)) {
      const before = calcDisplay.slice(0, start);
      const after = calcDisplay.slice(end);
      let nextDisp = '';
      let nextCursor = start;

      const lastChar = before.slice(-1);
      if (['+', '-', '×', '÷'].includes(lastChar)) {
        nextDisp = before.slice(0, -1) + val + after;
        nextCursor = start;
      } else {
        nextDisp = before + val + after;
        nextCursor = start + 1;
      }
      updateCalcDisplay(nextDisp);
      setTimeout(() => {
        if (calcInputRef.current) {
          calcInputRef.current.focus();
          calcInputRef.current.setSelectionRange(nextCursor, nextCursor);
        }
      }, 5);
    } else {
      const before = calcDisplay.slice(0, start);
      const after = calcDisplay.slice(end);
      let nextDisp = '';
      let nextCursor = start;

      if (calcDisplay === '0' || calcDisplay === 'Error') {
        nextDisp = val;
        nextCursor = val.length;
      } else {
        nextDisp = before + val + after;
        nextCursor = start + val.length;
      }
      updateCalcDisplay(nextDisp);
      setTimeout(() => {
        if (calcInputRef.current) {
          calcInputRef.current.focus();
          calcInputRef.current.setSelectionRange(nextCursor, nextCursor);
        }
      }, 5);
    }
  };

  // Memory keys handlers
  const handleMemoryOp = (op: 'MC' | 'MR' | 'M+' | 'M-') => {
    playClickSound(1100, 0.05);
    triggerVibration();
    const currentVal = Number(evaluateExpression(calcDisplay) || calcDisplay) || 0;

    if (op === 'MC') {
      setMemoryValue(0);
    } else if (op === 'MR') {
      updateCalcDisplay(String(memoryValue));
    } else if (op === 'M+') {
      setMemoryValue(prev => prev + currentVal);
    } else if (op === 'M-') {
      setMemoryValue(prev => prev - currentVal);
    }
  };


  // ---------------------------------------------------------------------------
  // POS BILLING WORKSPACE STATE
  // ---------------------------------------------------------------------------
  const [billItems, setBillItems] = useState<POSBillItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [billingMode, setBillingMode] = useState<'retail' | 'wholesale'>('retail');
  const [manualDiscount, setManualDiscount] = useState<string>(''); // Flat discount on whole bill
  const [manualTax, setManualTax] = useState<string>(''); // Tax rate on whole bill
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Suggested Cash / Change Drawer
  const [cashProvided, setCashProvided] = useState<number | null>(null);
  const [manualCashInput, setManualCashInput] = useState<string>("");

  // Saved Draft Bills State
  const [draftBills, setDraftBills] = useState<DraftBill[]>(() => {
    const saved = localStorage.getItem('ts_calc_draft_bills');
    return saved ? JSON.parse(saved) : [];
  });
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftName, setDraftName] = useState('');

  // ---------------------------------------------------------------------------
  // CORE BILL PERSISTENCE, PDF GENERATION & 30-DAY RETENTION ENGINE
  // ---------------------------------------------------------------------------

  // Toggle/exchange rate retail/wholesale rate on specific item
  const toggleItemPriceType = (id: string) => {
    setBillItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextType = item.priceType === 'retail' ? 'wholesale' : 'retail';
        const nextPrice = nextType === 'retail' ? item.retailPrice : item.wholesalePrice;
        return {
          ...item,
          priceType: nextType,
          price: nextPrice
        };
      }
      return item;
    }));
    addToast("Exchanged rate between Retail and Wholesale!", "info");
    playClickSound(1000, 0.05);
    triggerVibration();
  };

  // Single active/history bill PDF generator
  const downloadSingleBillPDF = (bill: SavedBill | {
    billNumber: string;
    createdAt: number;
    customerName: string;
    items: POSBillItem[];
    subtotal: number;
    discount: number;
    tax: number;
    grandTotal: number;
    notes?: string;
  }) => {
    try {
      const doc = new jsPDF();
      
      // Header band
      doc.setFillColor(31, 41, 55); // Dark Slate
      doc.rect(0, 0, 210, 45, 'F');
      
      doc.setFillColor(245, 158, 11); // Amber Accent Band
      doc.rect(0, 45, 210, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('TAX ESTIMATION / INVOICE', 14, 20);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('TS PRICE MANAGER', 14, 28);
      doc.text('Professional POS Estimation & Billing System', 14, 33);
      
      doc.setTextColor(255, 255, 255);
      doc.text(`Invoice No: ${bill.billNumber}`, 140, 20);
      doc.text(`Date: ${new Date(bill.createdAt).toLocaleString()}`, 140, 26);
      doc.text(`Customer: ${bill.customerName || 'Walk-in Customer'}`, 140, 32);

      // Bill items table
      const tableData = bill.items.map((item, idx) => {
        const netAmount = Math.round(item.quantity * item.price - item.discount + ((item.quantity * item.price - item.discount) * item.tax / 100));
        return [
          idx + 1,
          item.name,
          `${item.quantity}`,
          `₹${item.price.toLocaleString()}`,
          `₹${item.discount.toLocaleString()}`,
          `${item.tax}%`,
          `₹${netAmount.toLocaleString()}`
        ];
      });

      autoTable(doc, {
        startY: 55,
        head: [['S.No', 'Product/Service', 'Quantity', 'Unit Rate', 'Discount', 'Tax %', 'Net Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { cellWidth: 70 },
          2: { halign: 'center', cellWidth: 18 },
          3: { halign: 'right', cellWidth: 22 },
          4: { halign: 'right', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 15 },
          6: { halign: 'right', cellWidth: 25 }
        },
        styles: { fontSize: 8.5, cellPadding: 3.5 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;

      // Summary table display on right
      doc.setFillColor(249, 250, 251);
      doc.rect(115, finalY, 81, 42, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.rect(115, finalY, 81, 42, 'S');

      doc.setTextColor(75, 85, 99);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Subtotal:`, 120, finalY + 8);
      doc.text(`Total Discounts:`, 120, finalY + 16);
      doc.text(`Total Taxes:`, 120, finalY + 24);
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Grand Total:`, 120, finalY + 34);

      doc.setTextColor(31, 41, 55);
      doc.text(`₹${bill.subtotal.toLocaleString()}`, 190, finalY + 8, { align: 'right' });
      doc.setTextColor(16, 185, 129); // Green
      doc.text(`- ₹${bill.discount.toLocaleString()}`, 190, finalY + 16, { align: 'right' });
      doc.setTextColor(31, 41, 55);
      doc.text(`+ ₹${bill.tax.toLocaleString()}`, 190, finalY + 24, { align: 'right' });
      
      doc.setFontSize(11);
      doc.setTextColor(245, 158, 11); // Amber
      doc.text(`₹${bill.grandTotal.toLocaleString()}`, 190, finalY + 34, { align: 'right' });

      // Optional Invoice Notes on the left
      if (bill.notes) {
        doc.setTextColor(107, 114, 128);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Invoice Remarks:', 14, finalY + 8);
        const splitNotes = doc.splitTextToSize(bill.notes, 90);
        doc.text(splitNotes, 14, finalY + 14);
      }

      // Footer
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text('Generated using TS Price Manager system', 105, 280, { align: 'center' });

      doc.save(`${bill.billNumber}_${bill.customerName ? bill.customerName.replace(/\s+/g, '_') : 'Invoice'}.pdf`);
      addToast("PDF downloaded successfully!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to download PDF.", "error");
    }
  };

  // Mass archived bills PDF summary report generator
  const downloadArchivedBillsPDF = (billsToArchive: SavedBill[]) => {
    try {
      const doc = new jsPDF();
      
      doc.setFillColor(31, 41, 55); // Dark Slate
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('TS PRICE MANAGER', 14, 18);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('SYSTEM ARCHIVE - HISTORICAL BILLING EXPORT (30-DAY RETENTION CLEANUP)', 14, 26);
      
      doc.setTextColor(200, 200, 200);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);
      doc.text(`Total Records Archived: ${billsToArchive.length}`, 140, 34);

      let currentY = 50;

      billsToArchive.forEach((bill, index) => {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFillColor(243, 244, 246);
        doc.rect(14, currentY, 182, 8, 'F');
        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(`[${index + 1}] Invoice: ${bill.billNumber}  |  Date: ${new Date(bill.createdAt).toLocaleString()}  |  Customer: ${bill.customerName || 'N/A'}`, 16, currentY + 5.5);
        currentY += 11;

        const itemsRows = bill.items.map((item, itemIdx) => [
          `${itemIdx + 1}`,
          item.name,
          `${item.quantity}`,
          `₹${item.price.toLocaleString()}`,
          `₹${item.discount.toLocaleString()}`,
          `${item.tax}%`,
          `₹${Math.round(item.quantity * item.price - item.discount + ((item.quantity * item.price - item.discount) * item.tax / 100)).toLocaleString()}`
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['S.No', 'Item Name', 'Qty', 'Rate', 'Disc', 'Tax %', 'Net Amount']],
          body: itemsRows,
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [75, 85, 99], textColor: 255, fontStyle: 'bold' },
          margin: { left: 14, right: 14 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 4;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(55, 65, 81);
        doc.text(`Subtotal: ₹${bill.subtotal.toLocaleString()}  |  Discounts: -₹${bill.discount.toLocaleString()}  |  Taxes: +₹${bill.tax.toLocaleString()}  |  Grand Total: ₹${bill.grandTotal.toLocaleString()}`, 14, currentY);
        
        currentY += 10;
      });

      doc.save(`TS_Price_Manager_Archive_${new Date().toISOString().split('T')[0]}.pdf`);
      addToast("Archived report downloaded successfully!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to download archive PDF.", "error");
    }
  };

  // Perform permanent cleanup of bills older than 30 days
  const handlePermanentlyDeleteExpired = (downloadFirst: boolean) => {
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expired = savedBills.filter(bill => (now - bill.createdAt) >= thirtyDaysInMs);
    const remaining = savedBills.filter(bill => (now - bill.createdAt) < thirtyDaysInMs);

    if (downloadFirst && expired.length > 0) {
      downloadArchivedBillsPDF(expired);
    }

    setSavedBills(remaining);
    localStorage.setItem('ts_saved_bills', JSON.stringify(remaining));
    setShowCleanupModal(false);
    setExpiredBills([]);
    addToast(`Successfully deleted ${expired.length} expired bill(s) permanently!`, "success");
    playClickSound(1400, 0.1);
  };

  // Active check on loaded bills for 30-day compliance
  useEffect(() => {
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expired = savedBills.filter(bill => (now - bill.createdAt) >= thirtyDaysInMs);
    if (expired.length > 0) {
      setExpiredBills(expired);
      setShowCleanupModal(true);
    }
  }, [savedBills]);

  // Save/Update active invoice
  const handleSaveActiveBill = () => {
    if (billItems.length === 0) {
      addToast("Cannot save empty invoice.", "warning");
      return;
    }

    const now = Date.now();
    const formattedDate = new Date(now).toLocaleString();

    if (editingBillId) {
      // Editing Mode
      setSavedBills(prev => {
        const updated = prev.map(bill => {
          if (bill.id === editingBillId) {
            return {
              ...bill,
              items: billItems,
              subtotal: billSummary.subtotal,
              discount: billSummary.discount,
              tax: billSummary.tax,
              grandTotal: billSummary.grandTotal,
              customerName: customerName.trim() || 'Walk-in Customer',
              notes: invoiceNotes.trim() || undefined
            };
          }
          return bill;
        });
        localStorage.setItem('ts_saved_bills', JSON.stringify(updated));
        return updated;
      });

      addToast("Saved bill updated successfully!", "success");
      setEditingBillId(null);
    } else {
      // New Bill Mode
      const invoiceNum = `INV-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(savedBills.length + 101).toString()}`;
      
      const newBill: SavedBill = {
        id: Math.random().toString(36).substring(2, 11),
        billNumber: invoiceNum,
        items: billItems,
        subtotal: billSummary.subtotal,
        discount: billSummary.discount,
        tax: billSummary.tax,
        grandTotal: billSummary.grandTotal,
        timestamp: formattedDate,
        createdAt: now,
        customerName: customerName.trim() || 'Walk-in Customer',
        notes: invoiceNotes.trim() || undefined
      };

      setSavedBills(prev => {
        const updated = [newBill, ...prev];
        localStorage.setItem('ts_saved_bills', JSON.stringify(updated));
        return updated;
      });

      addToast(`Invoice ${invoiceNum} created & saved!`, "success");
    }

    // Reset fields
    setBillItems([]);
    setCustomerName('');
    setInvoiceNotes('');
    setCashProvided(null);
    setManualCashInput("");
    playClickSound(1300, 0.15);
    playSynthesizedSound('save');
  };

  // Restores a saved bill for editing
  const handleLoadBillForEdit = (bill: SavedBill) => {
    playClickSound(1200, 0.08);
    setBillItems(bill.items);
    setManualDiscount('');
    setManualTax('');
    setCustomerName(bill.customerName);
    setInvoiceNotes(bill.notes || '');
    setEditingBillId(bill.id);
    setMode('pos');
    addToast(`Loaded ${bill.billNumber} into active editor!`, "info");
  };

  // Permanently delete specific bill
  const handleDeleteBillPermanently = (billId: string) => {
    playClickSound(950, 0.06);
    playSynthesizedSound('delete');
    setSavedBills(prev => {
      const updated = prev.filter(b => b.id !== billId);
      localStorage.setItem('ts_saved_bills', JSON.stringify(updated));
      return updated;
    });
    addToast("Bill permanently deleted from history.", "success");
  };

  // Permanent Price update Dialog state
  const [priceUpdatePending, setPriceUpdatePending] = useState<{
    itemId: string;
    productId: string;
    newPrice: number;
    priceType: 'retail' | 'wholesale';
  } | null>(null);

  // Favorite / Pinned Products
  const [pinnedProductIds, setPinnedProductIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('ts_calc_pinned_products');
    return saved ? JSON.parse(saved) : [];
  });

  // Recent products history
  const [recentProductIds, setRecentProductIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('ts_calc_recent_products');
    return saved ? JSON.parse(saved) : [];
  });

  const togglePinProduct = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedProductIds(prev => {
      const updated = prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId];
      localStorage.setItem('ts_calc_pinned_products', JSON.stringify(updated));
      return updated;
    });
  };

  // Keyboard navigation for Product Search input
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!settings.keyboardNav) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSearchIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSearchIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length > 0 && filteredProducts[activeSearchIndex]) {
        addAndFocusItem(filteredProducts[activeSearchIndex]);
      }
    }
  };

  // Add Item to bill and focus its Quantity Input
  const addAndFocusItem = (item: Item) => {
    playClickSound(1200, 0.05);
    playSynthesizedSound('add');
    triggerVibration();
    
    // Add item to recent history
    setRecentProductIds(prev => {
      const filtered = prev.filter(id => id !== item.id);
      const updated = [item.id, ...filtered].slice(0, 10);
      localStorage.setItem('ts_calc_recent_products', JSON.stringify(updated));
      return updated;
    });

    const initialPrice = billingMode === 'retail' ? item.retailPrice : item.wholesalePrice;
    
    const newBillItem: POSBillItem = {
      id: Math.random().toString(36).substring(2, 11),
      productId: item.id,
      name: item.translations?.[language as any] || item.name || 'Product',
      quantity: 1,
      price: initialPrice,
      priceType: billingMode,
      discount: 0,
      tax: 0,
      notes: '',
      retailPrice: item.retailPrice,
      wholesalePrice: item.wholesalePrice
    };

    setBillItems(prev => [...prev, newBillItem]);
    setSearchQuery('');
    setActiveSearchIndex(0);

    // Auto focus quantity field for immediate keyboard typing
    setTimeout(() => {
      const qtyInput = document.getElementById(`qty-input-${newBillItem.id}`);
      if (qtyInput) {
        qtyInput.focus();
        (qtyInput as HTMLInputElement).select();
      }
    }, 100);
  };

  const addManualItem = () => {
    playClickSound(1000, 0.04);
    playSynthesizedSound('add');
    const newBillItem: POSBillItem = {
      id: Math.random().toString(36).substring(2, 11),
      name: `Manual Item #${billItems.length + 1}`,
      quantity: 1,
      price: 0,
      priceType: 'retail',
      discount: 0,
      tax: 0,
      notes: '',
      retailPrice: 0,
      wholesalePrice: 0
    };
    setBillItems(prev => [...prev, newBillItem]);

    setTimeout(() => {
      const nameInput = document.getElementById(`name-input-${newBillItem.id}`);
      if (nameInput) {
        nameInput.focus();
        (nameInput as HTMLInputElement).select();
      }
    }, 100);
  };

  // Real-time catalog search filtering
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return items.filter(item => {
      const matchesName = (item.name || '').toLowerCase().includes(query) ||
                          (item.translations?.en || '').toLowerCase().includes(query) ||
                          (item.translations?.hi || '').toLowerCase().includes(query) ||
                          (item.translations?.mr || '').toLowerCase().includes(query) ||
                          (item.translations?.['hi-en'] || '').toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
      return matchesName && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory, language]);

  // Favorite pinned products list
  const pinnedProducts = useMemo(() => {
    return items.filter(item => pinnedProductIds.includes(item.id));
  }, [items, pinnedProductIds]);

  // Frequently used / recent items
  const recentProducts = useMemo(() => {
    return items.filter(item => recentProductIds.includes(item.id));
  }, [items, recentProductIds]);

  // Speech Recognition API setup
  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Voice search is not supported in this browser environment.");
      return;
    }
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningVoice(true);
      playClickSound(1400, 0.1);
      recognition.start();

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setSearchQuery(text);
        setIsListeningVoice(false);
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };
    } catch (e) {
      setIsListeningVoice(false);
    }
  };

  // Switching overall billing mode Retail/Wholesale
  const toggleBillingMode = (mode: 'retail' | 'wholesale') => {
    playClickSound(1100, 0.08);
    setBillingMode(mode);
    setBillItems(prev => prev.map(item => {
      if (item.productId) {
        // apply the corresponding product default price
        const price = mode === 'retail' ? item.retailPrice : item.wholesalePrice;
        return { ...item, price, priceType: mode };
      }
      return item;
    }));
  };

  // Modify individual billing item property
  const handleUpdateBillItem = (id: string, field: keyof POSBillItem, value: any) => {
    setBillItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Check and trigger catalog update prompt when user finishes editing the price input (onBlur / Enter)
  const handlePriceInputBlur = (id: string, finalValue: number) => {
    const item = billItems.find(i => i.id === id);
    if (item && item.productId) {
      const originalPrice = item.priceType === 'retail' ? item.retailPrice : item.wholesalePrice;
      if (finalValue !== originalPrice && finalValue > 0) {
        setPriceUpdatePending({
          itemId: id,
          productId: item.productId,
          newPrice: finalValue,
          priceType: item.priceType
        });
      }
    }
  };

  // Apply permanent price updates
  const confirmPermanentPriceUpdate = async () => {
    if (!priceUpdatePending) return;
    const { productId, newPrice, priceType } = priceUpdatePending;
    playClickSound(1500, 0.12);
    triggerVibration();

    try {
      const fieldsToUpdate = priceType === 'retail' 
        ? { retailPrice: newPrice } 
        : { wholesalePrice: newPrice };
      
      await onUpdateItem(productId, fieldsToUpdate);
      
      // Update our bill items baseline so it matches
      setBillItems(prev => prev.map(item => {
        if (item.productId === productId) {
          return {
            ...item,
            retailPrice: priceType === 'retail' ? newPrice : item.retailPrice,
            wholesalePrice: priceType === 'wholesale' ? newPrice : item.wholesalePrice,
          };
        }
        return item;
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setPriceUpdatePending(null);
    }
  };

  const removeBillItem = (id: string) => {
    playClickSound(900, 0.04);
    playSynthesizedSound('delete');
    setBillItems(prev => prev.filter(item => item.id !== id));
  };

  // Live Bill totals calculation
  const billSummary = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    billItems.forEach(item => {
      const itemSub = item.quantity * item.price;
      const itemDisc = item.discount; // flat discount
      const itemTaxVal = ((itemSub - itemDisc) * item.tax) / 100;
      
      subtotal += itemSub;
      totalDiscount += itemDisc;
      totalTax += itemTaxVal;
    });

    // Add manual whole-bill discount and tax if present
    const billFlatDiscount = Number(manualDiscount) || 0;
    const billTaxRate = Number(manualTax) || 0;
    
    const grossAfterItemDisc = Math.max(0, subtotal - totalDiscount);
    const finalDiscount = grossAfterItemDisc > 0 ? Math.min(grossAfterItemDisc, billFlatDiscount) : 0;
    
    const taxableAmount = grossAfterItemDisc - finalDiscount;
    const finalTax = totalTax + (taxableAmount * billTaxRate) / 100;
    const grandTotal = Math.max(0, taxableAmount + finalTax);

    return {
      subtotal,
      discount: totalDiscount + finalDiscount,
      tax: finalTax,
      grandTotal: Math.round(grandTotal),
      totalItems: billItems.reduce((sum, item) => sum + item.quantity, 0)
    };
  }, [billItems, manualDiscount, manualTax]);

  // Suggested Cash assistance logic
  const cashSuggestions = useMemo(() => {
    const total = billSummary.grandTotal;
    if (total <= 0) return [];

    const suggestions = [total];
    
    // Nearest clean notes suggestions
    const noteSteps = [10, 20, 50, 100, 200, 500, 2000];
    noteSteps.forEach(step => {
      const nextClean = Math.ceil(total / step) * step;
      if (nextClean > total && !suggestions.includes(nextClean)) {
        suggestions.push(nextClean);
      }
    });

    // Rounded multipliers like 100s, 500s, 1000s
    [50, 100, 200, 500, 1000, 2000].forEach(note => {
      if (note > total && !suggestions.includes(note)) {
        suggestions.push(note);
      }
    });

    return suggestions.sort((a, b) => a - b).slice(0, 4);
  }, [billSummary.grandTotal]);

  // Save Draft Bill
  const handleSaveDraft = () => {
    if (billItems.length === 0) return;
    const name = draftName.trim() || `Draft #${draftBills.length + 1} (${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`;
    const newDraft: DraftBill = {
      id: Math.random().toString(36).substring(2, 11),
      name,
      items: billItems,
      timestamp: new Date().toLocaleString()
    };

    setDraftBills(prev => {
      const updated = [newDraft, ...prev];
      localStorage.setItem('ts_calc_draft_bills', JSON.stringify(updated));
      return updated;
    });

    setShowDraftModal(false);
    setDraftName('');
    setBillItems([]);
    setCashProvided(null);
    setManualCashInput("");
    playClickSound(1300, 0.1);
  };

  const handleRestoreDraft = (draft: DraftBill) => {
    playClickSound(1200, 0.08);
    setBillItems(draft.items);
    setDraftBills(prev => {
      const updated = prev.filter(d => d.id !== draft.id);
      localStorage.setItem('ts_calc_draft_bills', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteDraft = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playClickSound(900, 0.05);
    setDraftBills(prev => {
      const updated = prev.filter(d => d.id !== draftId);
      localStorage.setItem('ts_calc_draft_bills', JSON.stringify(updated));
      return updated;
    });
  };

  // Keyboard navigation on Universal input from device physical keys
  useEffect(() => {
    if (!settings.keyboardNav || mode !== 'universal') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement?.tagName;
      if (activeEl === 'INPUT' || activeEl === 'TEXTAREA') return;

      const keyMap: { [key: string]: string } = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        '.': '.', '+': '+', '-': '-', '*': '×', '/': '÷',
        '%': '%', 'Enter': '=', '=': '=', 'Backspace': '⌫',
        'Escape': 'C', 'c': 'C', 'C': 'C'
      };

      if (keyMap[e.key]) {
        e.preventDefault();
        handleCalcKeyPress(keyMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calcDisplay, mode, settings.keyboardNav]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-32">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card)]/60 backdrop-blur-md p-5 rounded-3xl border border-[var(--border)] animate-fade-in text-left">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <Calculator className="text-amber-500 animate-pulse" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)] flex items-center gap-2">
              Calculator Workspace
              <span className="text-[9px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">PRO</span>
            </h1>
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-[var(--foreground)]">Hybrid Ledger Estimator & POS invoicing unit</p>
          </div>
        </div>

        {/* Switch Mode tabs */}
        <div className="flex bg-[var(--foreground)]/5 p-1 rounded-2xl border border-[var(--border)]">
          <button
            onClick={() => handleModeChange('universal')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer border-0 ${
              mode === 'universal' 
                ? 'bg-amber-500 text-slate-950 shadow-md' 
                : 'text-[var(--foreground)]/60 hover:text-[var(--foreground)] bg-transparent'
            }`}
          >
            Universal
          </button>
          <button
            onClick={() => handleModeChange('pos')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer border-0 ${
              mode === 'pos' 
                ? 'bg-amber-500 text-slate-950 shadow-md' 
                : 'text-[var(--foreground)]/60 hover:text-[var(--foreground)] bg-transparent'
            }`}
          >
            POS Billing
          </button>
          <button
            onClick={() => handleModeChange('history')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer border-0 flex items-center gap-1 ${
              mode === 'history' 
                ? 'bg-amber-500 text-slate-950 shadow-md' 
                : 'text-[var(--foreground)]/60 hover:text-[var(--foreground)] bg-transparent'
            }`}
          >
            Bill History
            {savedBills.length > 0 && (
              <span className={`px-1.5 py-0.5 text-[8px] font-black rounded-full ${
                mode === 'history' ? 'bg-amber-600 text-slate-950' : 'bg-amber-500/20 text-amber-500'
              }`}>
                {savedBills.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'universal' && (
          <motion.div
            key="universal-panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left/Middle Calculator panel */}
            <div className="lg:col-span-2 space-y-4">
              {/* Display Panel */}
              <div className="bg-[var(--card)]/80 rounded-3xl p-6 border border-[var(--border)] relative shadow-lg text-right overflow-hidden flex flex-col justify-between h-44">
                {/* Memory and status flags */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    {memoryValue !== 0 && (
                      <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase">M: {memoryValue}</span>
                    )}
                    <div className="flex flex-col items-start gap-1">
                      <button
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenSaveNameModal();
                        }}
                        className="text-[9px] font-black text-amber-500 bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer outline-none"
                        title="Name and save current calculation"
                      >
                        <Save size={9} /> Name
                      </button>
                      <span className="text-[8px] font-black opacity-30 uppercase pl-1 mt-0.5">RAD</span>
                    </div>
                  </div>
                  <div className="text-[8px] font-black opacity-30 uppercase tracking-widest">
                    Manual Selection Mode
                  </div>
                </div>

                <div className="space-y-1.5">
                  {/* Current formula display - Interactive cursor-input for manual navigation */}
                  <input
                    ref={calcInputRef}
                    type="text"
                    inputMode="none"
                    value={calcDisplay}
                    onFocus={() => setIsCalcInputFocused(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        if (document.activeElement !== calcInputRef.current) {
                          setIsCalcInputFocused(false);
                        }
                      }, 150);
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      const processed = val.replace(/\*/g, '×').replace(/\//g, '÷');
                      updateCalcDisplay(processed);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCalcKeyPress('=');
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCalcKeyPress('C');
                      }
                    }}
                    className="w-full bg-transparent border-0 text-right font-mono text-3xl font-light text-[var(--foreground)] tracking-tight outline-none focus:ring-0 p-0"
                    placeholder="0"
                  />
                  {/* Intermediate results helper */}
                  <div className="font-mono text-base font-bold text-amber-500/60 break-all h-6">
                    {calcResultPreview && `≈ ${calcResultPreview}`}
                  </div>
                </div>
              </div>

              {/* Move Undo, Redo, and History buttons just below the screen at the right corner */}
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-[var(--foreground)]/30 font-black uppercase tracking-widest flex items-center gap-1">
                    <span className="h-1 w-1 bg-green-500 rounded-full animate-ping" />
                    Manual Navigate Active
                  </span>

                  <AnimatePresence>
                    {isCalcInputFocused && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, x: -10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, x: -10 }}
                        className="flex items-center gap-1 bg-amber-500/10 p-0.5 rounded-lg border border-amber-500/20 shadow-sm ml-2"
                      >
                        <button
                          onPointerDown={(e) => {
                            e.preventDefault();
                            moveCursorLeft();
                          }}
                          className="h-6 w-8 rounded bg-[var(--card)] hover:bg-amber-500/20 text-amber-500 flex items-center justify-center border border-[var(--border)] transition-all cursor-pointer font-bold active:scale-90 text-[11px] outline-none"
                          title="Move cursor left"
                        >
                          ←
                        </button>
                        <button
                          onPointerDown={(e) => {
                            e.preventDefault();
                            moveCursorRight();
                          }}
                          className="h-6 w-8 rounded bg-[var(--card)] hover:bg-amber-500/20 text-amber-500 flex items-center justify-center border border-[var(--border)] transition-all cursor-pointer font-bold active:scale-90 text-[11px] outline-none"
                          title="Move cursor right"
                        >
                          →
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-1 bg-[var(--foreground)]/5 p-1 rounded-xl border border-[var(--border)] shadow-sm">
                  <button
                    onClick={handleUndo}
                    disabled={calcUndoStack.length <= 1}
                    className="h-8 px-2.5 rounded-lg hover:bg-[var(--foreground)]/10 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--foreground)]/60 hover:text-amber-500 transition-all cursor-pointer border-0 bg-transparent outline-none"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo size={11} /> Undo
                  </button>
                  <div className="h-4 w-[1px] bg-[var(--border)]" />
                  <button
                    onClick={handleRedo}
                    disabled={calcRedoStack.length === 0}
                    className="h-8 px-2.5 rounded-lg hover:bg-[var(--foreground)]/10 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--foreground)]/60 hover:text-amber-500 transition-all cursor-pointer border-0 bg-transparent outline-none"
                    title="Redo (Ctrl+Y)"
                  >
                    Redo <Redo size={11} />
                  </button>
                  <div className="h-4 w-[1px] bg-[var(--border)]" />
                  <button 
                    onClick={() => {
                      playClickSound();
                      setShowHistoryPane(true);
                    }}
                    className="h-8 px-2.5 rounded-lg hover:bg-[var(--foreground)]/10 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--foreground)]/60 hover:text-amber-500 transition-all cursor-pointer border-0 bg-transparent outline-none"
                    title="Calculation History Ledger"
                  >
                    <History size={11} /> History
                  </button>
                </div>
              </div>

              {/* Memory panel actions */}
              <div className="grid grid-cols-4 gap-2">
                {['MC', 'MR', 'M+', 'M-'].map(op => (
                  <button
                    key={op}
                    onClick={() => handleMemoryOp(op as any)}
                    className="py-2.5 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 border border-[var(--border)] rounded-xl text-[10px] font-black text-[var(--foreground)]/60 hover:text-amber-500 transition-all cursor-pointer"
                  >
                    {op}
                  </button>
                ))}
              </div>

              {/* Keyboard Grid */}
              <div className={`grid grid-cols-4 gap-2.5 ${settings.largeButtons ? 'md:gap-4' : ''}`}>
                {/* Row 1 */}
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('C'); }}
                  className="py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black border border-red-500/25 transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                >
                  C
                </button>
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('⌫'); }}
                  className="py-4 rounded-2xl bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/80 font-black border border-[var(--border)] transition-all shadow-md active:scale-95 cursor-pointer text-xs flex items-center justify-center outline-none"
                >
                  ⌫
                </button>
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('%'); }}
                  className="py-4 rounded-2xl bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/80 font-black border border-[var(--border)] transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                >
                  %
                </button>
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('÷'); }}
                  className="py-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-black border border-amber-500/25 transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                >
                  ÷
                </button>

                {/* Row 2 */}
                {['7', '8', '9'].map(num => (
                  <button
                    key={num}
                    onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress(num); }}
                    className="py-4 rounded-2xl bg-[var(--foreground)]/10 hover:bg-[var(--foreground)]/20 text-[var(--foreground)] font-black border border-[var(--border)] transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('×'); }}
                  className="py-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-black border border-amber-500/25 transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                >
                  ×
                </button>

                {/* Row 3 */}
                {['4', '5', '6'].map(num => (
                  <button
                    key={num}
                    onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress(num); }}
                    className="py-4 rounded-2xl bg-[var(--foreground)]/10 hover:bg-[var(--foreground)]/20 text-[var(--foreground)] font-black border border-[var(--border)] transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('-'); }}
                  className="py-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-black border border-amber-500/25 transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                >
                  -
                </button>

                {/* Row 4 */}
                {['1', '2', '3'].map(num => (
                  <button
                    key={num}
                    onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress(num); }}
                    className="py-4 rounded-2xl bg-[var(--foreground)]/10 hover:bg-[var(--foreground)]/20 text-[var(--foreground)] font-black border border-[var(--border)] transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('+'); }}
                  className="py-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-black border border-amber-500/25 transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                >
                  +
                </button>

                {/* Row 5 */}
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('.'); }}
                  className="py-4 rounded-2xl bg-[var(--foreground)]/10 hover:bg-[var(--foreground)]/20 text-[var(--foreground)] font-black border border-[var(--border)] transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                >
                  .
                </button>
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('0'); }}
                  className="py-4 rounded-2xl bg-[var(--foreground)]/10 hover:bg-[var(--foreground)]/20 text-[var(--foreground)] font-black border border-[var(--border)] transition-all shadow-md active:scale-95 cursor-pointer text-xs outline-none"
                >
                  0
                </button>
                <button
                  onPointerDown={(e) => { e.preventDefault(); handleCalcKeyPress('='); }}
                  className="col-span-2 py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all active:scale-95 cursor-pointer text-xs border-0 outline-none"
                >
                  =
                </button>
              </div>
            </div>

            {/* Right Side: History or Instructions panel */}
            <div className="bg-[var(--card)]/40 border border-[var(--border)] rounded-3xl p-5 flex flex-col justify-between text-left min-h-[350px]">
              <div>
                <h3 className="font-black text-xs text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5 mb-4 pb-2 border-b border-[var(--border)]">
                  <History size={14} className="text-amber-500" />
                  Calculation History
                </h3>
                
                {settings.enableCalculationHistory ? (
                  <div className="flex flex-col h-full">
                    {/* Calculation History Search bar */}
                    <div className="relative flex items-center bg-[var(--foreground)]/5 rounded-xl border border-[var(--border)] px-2.5 py-1.5 mb-3 focus-within:border-amber-500/40 transition-colors">
                      <Search size={13} className="text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={calcHistorySearchQuery}
                        onChange={(e) => setCalcHistorySearchQuery(e.target.value)}
                        placeholder="Search saved/named calculations..."
                        className="w-full bg-transparent border-0 text-[var(--foreground)] text-[10px] outline-none px-2 py-0 placeholder-[var(--foreground)]/30 focus:ring-0"
                      />
                      {calcHistorySearchQuery && (
                        <button
                          onClick={() => setCalcHistorySearchQuery('')}
                          className="text-slate-400 hover:text-[var(--foreground)] bg-transparent border-0 p-0 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar font-mono text-[11px]">
                      {(() => {
                        const filtered = calcHistory.filter(entry => {
                          if (!calcHistorySearchQuery.trim()) return true;
                          const q = calcHistorySearchQuery.toLowerCase();
                          return (entry.label && entry.label.toLowerCase().includes(q)) ||
                                 entry.expression.toLowerCase().includes(q) ||
                                 entry.result.toLowerCase().includes(q);
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="py-12 text-center text-[var(--foreground)]/50">
                              {calcHistorySearchQuery ? "No matching calculations." : "No calculations performed."}
                            </div>
                          );
                        }

                        return filtered.map(entry => (
                          <div key={entry.id} className="relative overflow-hidden rounded-xl bg-red-500/10 border border-red-500/20 select-none">
                            {/* Swipe Delete Background */}
                            <div className="absolute inset-0 flex items-center justify-end px-4 bg-red-500 text-slate-950 font-bold text-[9px] uppercase tracking-wider rounded-xl pointer-events-none">
                              <span className="flex items-center gap-1.5 text-slate-950 font-black">
                                <Trash2 size={11} /> Swipe Delete
                              </span>
                            </div>

                            {/* Swipeable calculation card */}
                            <motion.div
                              drag="x"
                              dragDirectionLock
                              dragConstraints={{ left: -100, right: 0 }}
                              dragElastic={{ left: 0.1, right: 0 }}
                              onDragEnd={(e, info) => {
                                if (info.offset.x < -65) {
                                  handleDeleteHistoryEntry(entry.id);
                                }
                              }}
                              onClick={() => {
                                updateCalcDisplay(entry.expression);
                                playClickSound(1000, 0.04);
                                setSelectedCalcId(entry.id);
                                setTimeout(() => setSelectedCalcId(null), 1500);
                              }}
                              animate={selectedCalcId === entry.id ? {
                                scale: [1, 1.02, 1],
                                borderColor: ["rgba(245, 158, 11, 0.2)", "#f59e0b", "rgba(245, 158, 11, 0.2)"],
                                boxShadow: [
                                  "0 0 0 rgba(245,158,11,0)",
                                  "0 0 12px rgba(245,158,11,0.3)",
                                  "0 0 0 rgba(245,158,11,0)"
                                ]
                              } : {}}
                              transition={{ duration: 1.2 }}
                              className="p-2.5 rounded-xl bg-[var(--card)] hover:bg-[var(--foreground)]/5 transition-colors cursor-pointer border border-[var(--border)] flex flex-col gap-1.5 relative z-10"
                            >
                              <div className="flex justify-between items-start gap-1">
                                {editingEntryId === entry.id ? (
                                  <div className="flex gap-1.5 w-full" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={editingLabelText}
                                      onChange={e => setEditingLabelText(e.target.value)}
                                      placeholder="Name calculation..."
                                      className="flex-1 bg-[var(--background)] border border-amber-500/40 rounded px-2 py-0.5 text-[9px] text-[var(--foreground)] outline-none"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          saveCalculationLabel(entry.id, editingLabelText);
                                          setEditingEntryId(null);
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveCalculationLabel(entry.id, editingLabelText);
                                        setEditingEntryId(null);
                                      }}
                                      className="p-1 bg-amber-500 text-slate-950 rounded text-[9px] font-black uppercase px-2 cursor-pointer border-0"
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-center w-full">
                                    {entry.label ? (
                                      <div className="flex items-center gap-1">
                                        <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded tracking-wider flex items-center gap-1">
                                          🏷️ {entry.label}
                                        </span>
                                        {currentUser && (
                                          <span className="text-[7px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1 py-0.2 rounded uppercase font-black tracking-wider">Cloud</span>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingEntryId(entry.id);
                                          setEditingLabelText(entry.label || '');
                                        }}
                                        className="text-[8px] text-slate-400 hover:text-amber-500 uppercase tracking-wider underline cursor-pointer bg-transparent border-0 p-0"
                                      >
                                        + Add Name
                                      </button>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                      {entry.label && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingEntryId(entry.id);
                                            setEditingLabelText(entry.label || '');
                                          }}
                                          className="text-[8px] text-slate-400 hover:text-amber-500 underline cursor-pointer bg-transparent border-0 p-0"
                                        >
                                          Rename
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteHistoryEntry(entry.id);
                                        }}
                                        className="text-slate-400 hover:text-red-400 cursor-pointer bg-transparent border-0 p-0"
                                        title="Delete Calculation"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <span className="text-[var(--foreground)]/60 break-all text-right">{entry.expression}</span>
                              <div className="flex justify-between items-center text-amber-500 font-bold border-t border-[var(--border)] pt-1 mt-0.5">
                                <span className="text-[8px] text-[var(--foreground)]/40 font-sans font-bold">{entry.timestamp}</span>
                                <span>= {entry.result}</span>
                              </div>
                            </motion.div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-[var(--foreground)]/50 text-xs">
                    History logging disabled in settings.
                  </div>
                )}
              </div>

              {calcHistory.length > 0 && settings.enableCalculationHistory && (
                <button
                  onClick={() => {
                    playClickSound(900);
                    setCalcHistory([]);
                    localStorage.removeItem('ts_calc_history');
                  }}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border-0 mt-4 cursor-pointer"
                >
                  Clear Logs
                </button>
              )}
            </div>
          </motion.div>
        )}

        {mode === 'pos' && (
          <motion.div
            key="pos-panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Split layout: UPPER LIVE BILL workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Product catalog / Instant Search search bar (Left col 5) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[var(--card)]/60 rounded-3xl p-5 border border-[var(--border)] text-left space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xs text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag size={14} className="text-amber-500" />
                      Add to Estimator
                    </h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleBillingMode('retail')}
                        className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-md transition-all border-0 cursor-pointer ${
                          billingMode === 'retail' ? 'bg-amber-500 text-slate-950' : 'bg-[var(--foreground)]/10 text-[var(--foreground)]/60'
                        }`}
                      >
                        Retail
                      </button>
                      <button
                        onClick={() => toggleBillingMode('wholesale')}
                        className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-md transition-all border-0 cursor-pointer ${
                          billingMode === 'wholesale' ? 'bg-amber-500 text-slate-950' : 'bg-[var(--foreground)]/10 text-[var(--foreground)]/60'
                        }`}
                      >
                        Wholesale
                      </button>
                    </div>
                  </div>

                  {/* Interactive input */}
                  <div className="relative flex items-center bg-[var(--foreground)]/5 rounded-xl border border-[var(--border)] px-3 py-1 focus-within:border-amber-500/40 transition-colors">
                    <Search size={16} className="text-slate-500" />
                    <input
                      id="calc-search-input"
                      type="text"
                      value={searchQuery ?? ''}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        setActiveSearchIndex(0);
                      }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search items by keyboard..."
                      autoFocus={settings.autoFocusSearch}
                      className="w-full bg-transparent border-0 text-[var(--foreground)] text-xs outline-none px-2.5 py-2 placeholder-[var(--foreground)]/40"
                    />
                    {settings.enableVoiceSearch && (
                      <button
                        onClick={startVoiceSearch}
                        className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors border-0 bg-transparent cursor-pointer ${
                          isListeningVoice ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-[var(--foreground)]/60 hover:text-[var(--foreground)]'
                        }`}
                      >
                        {isListeningVoice ? <MicOff size={13} /> : <Mic size={13} />}
                      </button>
                    )}
                  </div>

                  {/* Search results suggestions */}
                  <AnimatePresence>
                    {searchQuery.trim() && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="max-h-[160px] overflow-y-auto divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--card)] backdrop-blur-md rounded-2xl no-scrollbar font-sans"
                      >
                        {filteredProducts.length === 0 ? (
                          <div className="p-4 text-center text-[var(--foreground)]/50 text-[10px] uppercase">
                            No matching items found.
                          </div>
                        ) : (
                          filteredProducts.map((prod, idx) => (
                            <div
                              key={prod.id}
                              onClick={() => addAndFocusItem(prod)}
                              className={`p-3 cursor-pointer flex items-center justify-between text-left transition-colors ${
                                idx === activeSearchIndex ? 'bg-amber-500/10 text-[var(--foreground)] border-l-2 border-amber-500' : 'hover:bg-[var(--foreground)]/5 text-[var(--foreground)]/80'
                              }`}
                            >
                              <div>
                                <p className="text-xs font-bold">{prod.translations?.[language as any] || prod.name}</p>
                                <p className="text-[9px] text-[var(--foreground)]/50 mt-0.5">Stock: {prod.quantity} {prod.unit}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-amber-500">₹{billingMode === 'retail' ? prod.retailPrice : prod.wholesalePrice}</p>
                                <span className="text-[8px] opacity-40 uppercase font-black">
                                  {billingMode === 'retail' ? 'Retail' : 'Wholesale'}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Favorite / Pinned products section */}
                  {pinnedProducts.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-40">📌 Frequently sold (Pinned)</span>
                      <div className="flex flex-wrap gap-2">
                        {pinnedProducts.map(prod => (
                          <button
                            key={prod.id}
                            onClick={() => addAndFocusItem(prod)}
                            className="bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 hover:border-amber-500/25 border border-[var(--border)] text-[var(--foreground)] font-bold text-[10px] px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>{prod.translations?.[language as any] || prod.name}</span>
                            <span className="text-amber-500 font-black">₹{billingMode === 'retail' ? prod.retailPrice : prod.wholesalePrice}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Frequently sold / popular catalog templates suggestions */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">⭐ Catalog Suggestions</span>
                    <div className="flex flex-wrap gap-1.5">
                      {items.slice(0, 5).map(prod => {
                        const isPinned = pinnedProductIds.includes(prod.id);
                        return (
                          <div
                            key={prod.id}
                            onClick={() => addAndFocusItem(prod)}
                            className="bg-[var(--foreground)]/5 border border-[var(--border)] hover:border-amber-500/30 text-[var(--foreground)]/80 font-bold text-[9px] pl-2.5 pr-1.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <span>{prod.translations?.[language as any] || prod.name}</span>
                            <button
                               onClick={(e) => togglePinProduct(prod.id, e)}
                              className="p-1 hover:bg-[var(--foreground)]/10 rounded-md border-0 bg-transparent text-slate-500 hover:text-amber-500 cursor-pointer"
                            >
                              <Star size={10} className={isPinned ? "fill-amber-500 text-amber-500" : "text-slate-600"} />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        onClick={addManualItem}
                        className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-500 font-black text-[9px] px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus size={10} /> Manual Item
                      </button>
                    </div>
                  </div>
                </div>

                {/* Draft bills control dashboard */}
                <div className="bg-[var(--card)]/40 rounded-3xl p-5 border border-[var(--border)] text-left space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xs text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5">
                      <FolderDown size={14} className="text-amber-500" />
                      Estimation Drafts ({draftBills.length})
                    </h3>
                    {billItems.length > 0 && (
                      <button
                        onClick={() => {
                          setDraftName('');
                          setShowDraftModal(true);
                        }}
                        className="px-2.5 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/25 text-[8px] font-black uppercase rounded-lg cursor-pointer"
                      >
                        Save Draft
                      </button>
                    )}
                  </div>

                  {draftBills.length === 0 ? (
                    <p className="text-[10px] text-[var(--foreground)]/50 uppercase tracking-wide">No pending estimations saved as drafts.</p>
                  ) : (
                    <div className="space-y-2 max-h-[140px] overflow-y-auto no-scrollbar">
                      {draftBills.map(draft => (
                        <div
                          key={draft.id}
                          onClick={() => handleRestoreDraft(draft)}
                          className="p-2.5 rounded-xl bg-[var(--foreground)]/5 border border-[var(--border)] hover:border-amber-500/30 transition-all flex items-center justify-between cursor-pointer text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-white truncate uppercase tracking-tight">{draft.name}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{draft.items.length} items • {draft.timestamp}</p>
                          </div>
                          <button
                            onClick={(e) => handleDeleteDraft(draft.id, e)}
                            className="p-1 text-slate-500 hover:text-red-400 bg-transparent hover:bg-white/5 rounded border-0 cursor-pointer ml-2"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Live active estimations list table (Right col 7) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-[var(--card)]/80 rounded-3xl border border-[var(--border)] overflow-hidden shadow-lg flex flex-col min-h-[400px]">
                  <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--foreground)]/5 text-left">
                    <div>
                      <h3 className="font-black text-sm text-[var(--foreground)] uppercase tracking-tight flex items-center gap-1.5">
                        <ShoppingBag size={15} className="text-amber-500 animate-pulse" />
                        Live Estimations Bill
                      </h3>
                      <p className="text-[9px] text-[var(--foreground)]/60 font-bold uppercase tracking-wider mt-0.5">{billItems.length} active items on table</p>
                    </div>
                    {billItems.length > 0 && (
                      <button
                        onClick={() => {
                          playClickSound(800);
                          setBillItems([]);
                          setCashProvided(null);
                          setManualCashInput("");
                        }}
                        className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold uppercase text-[9px] tracking-wider rounded-lg border-0 cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 size={10} /> Clear Bill
                      </button>
                    )}
                  </div>

                  {/* Estimations Scroll list */}
                  <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-[380px] no-scrollbar">
                    {billItems.length === 0 ? (
                      <div className="py-24 text-center space-y-3 opacity-30">
                        <ShoppingBag size={48} className="mx-auto text-[var(--foreground)]" />
                        <p className="font-black uppercase tracking-widest text-xs text-[var(--foreground)]">Bill is currently empty</p>
                        <p className="text-[10px] text-[var(--foreground)]/60 max-w-xs mx-auto">Use the catalog search or templates on the left to add items to your estimates.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1.5 scrollbar-thin">
                        {billItems.map((item, idx) => {
                          const netValue = Math.round(item.quantity * item.price - item.discount + ((item.quantity * item.price - item.discount) * item.tax / 100));
                          return (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-xl bg-[var(--foreground)]/5 border border-[var(--border)] hover:border-amber-500/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-left relative group animate-slide-in"
                            >
                              {/* Left side: S.No + Name + Info badge & exchange rate */}
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className="text-[10px] font-mono font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 w-6 h-6 rounded-md flex items-center justify-center shrink-0" title={`Serial Number #${idx + 1}`}>
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <OptimizedInput
                                    id={`name-input-${item.id}`}
                                    type="text"
                                    value={item.name ?? ''}
                                    onChange={val => handleUpdateBillItem(item.id, 'name', val)}
                                    className="font-bold text-xs text-[var(--foreground)] uppercase tracking-tight bg-transparent border-0 border-b border-transparent hover:border-[var(--border)] focus:border-amber-500/40 focus:outline-none w-full py-0.5"
                                  />
                                  <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                                    {item.productId && (
                                      <span className="text-[7px] bg-[var(--foreground)]/10 text-[var(--foreground)]/60 px-1 py-0.5 rounded uppercase font-bold tracking-wider">
                                        Linked Catalog Item
                                      </span>
                                    )}
                                    {item.productId && (
                                      <button
                                        onClick={() => toggleItemPriceType(item.id)}
                                        className="text-[7px] px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all cursor-pointer uppercase font-bold tracking-wider inline-flex items-center gap-1"
                                        title="Switch rate between retail and wholesale"
                                      >
                                        Exchange Rate ({item.priceType === 'retail' ? 'Retail' : 'Wholesale'} ⇄ {item.priceType === 'retail' ? 'Wholesale' : 'Retail'})
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right side: Compact multi-column controls */}
                              <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap shrink-0">
                                {/* Quantity with tiny steppers */}
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[7px] font-black uppercase text-slate-500 tracking-wider">Quantity</span>
                                  <div className="flex items-center bg-[var(--foreground)]/5 border border-[var(--border)] rounded-lg h-7 overflow-hidden w-20">
                                    <button
                                      onClick={() => handleUpdateBillItem(item.id, 'quantity', Math.max(0.1, item.quantity - 1))}
                                      className="px-1.5 h-full text-[var(--foreground)]/60 hover:bg-[var(--foreground)]/10 border-0 bg-transparent cursor-pointer"
                                    >
                                      <Minus size={8} />
                                    </button>
                                    <OptimizedInput
                                      id={`qty-input-${item.id}`}
                                      type="number"
                                      step="any"
                                      value={item.quantity ?? 0}
                                      onChange={val => handleUpdateBillItem(item.id, 'quantity', Number(val) || 0)}
                                      className="w-full text-center bg-transparent border-0 text-[var(--foreground)] font-mono text-[10px] outline-none"
                                    />
                                    <button
                                      onClick={() => handleUpdateBillItem(item.id, 'quantity', item.quantity + 1)}
                                      className="px-1.5 h-full text-[var(--foreground)]/60 hover:bg-[var(--foreground)]/10 border-0 bg-transparent cursor-pointer"
                                    >
                                      <Plus size={8} />
                                    </button>
                                  </div>
                                </div>

                                {/* Price */}
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[7px] font-black uppercase text-slate-500 tracking-wider">Unit Price</span>
                                  <div className="flex items-center bg-[var(--foreground)]/5 border border-[var(--border)] rounded-lg h-7 px-1.5 w-20">
                                    <span className="text-[8px] text-slate-500 mr-0.5">₹</span>
                                    <OptimizedInput
                                      id={`price-input-${item.id}`}
                                      type="number"
                                      value={item.price ?? 0}
                                      onChange={val => handleUpdateBillItem(item.id, 'price', Number(val) || 0)}
                                      onBlur={e => handlePriceInputBlur(item.id, Number(e.target.value) || 0)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className="w-full bg-transparent border-0 text-[var(--foreground)] font-mono text-[10px] outline-none"
                                    />
                                  </div>
                                </div>

                                {/* Discount */}
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[7px] font-black uppercase text-slate-500 tracking-wider">Discount (Flat)</span>
                                  <div className="flex items-center bg-[var(--foreground)]/5 border border-[var(--border)] rounded-lg h-7 px-1.5 w-16" title="Discount">
                                    <span className="text-[8px] text-slate-500 mr-0.5">₹</span>
                                    <OptimizedInput
                                      id={`discount-input-${item.id}`}
                                      type="number"
                                      value={item.discount ?? 0}
                                      onChange={val => handleUpdateBillItem(item.id, 'discount', Number(val) || 0)}
                                      className="w-full bg-transparent border-0 text-[var(--foreground)] font-mono text-[10px] outline-none"
                                    />
                                  </div>
                                </div>

                                {/* Tax % */}
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[7px] font-black uppercase text-slate-500 tracking-wider">Tax (%)</span>
                                  <div className="flex items-center bg-[var(--foreground)]/5 border border-[var(--border)] rounded-lg h-7 px-1 w-12" title="Tax %">
                                    <OptimizedInput
                                      id={`tax-input-${item.id}`}
                                      type="number"
                                      value={item.tax ?? 0}
                                      onChange={val => handleUpdateBillItem(item.id, 'tax', Number(val) || 0)}
                                      className="w-full bg-transparent border-0 text-[var(--foreground)] font-mono text-[10px] outline-none"
                                    />
                                    <span className="text-[8px] text-slate-500 ml-0.5">%</span>
                                  </div>
                                </div>

                                {/* Net column */}
                                <div className="flex flex-col gap-0.5 text-right min-w-[70px] px-1">
                                  <span className="text-[7px] font-black uppercase text-slate-500 tracking-wider block">Net Total</span>
                                  <span className="font-mono text-[10.5px] font-black text-amber-500">
                                    ₹{netValue.toLocaleString()}
                                  </span>
                                </div>

                                {/* Action: Delete */}
                                <div className="flex flex-col gap-0.5 self-end">
                                  <button
                                    onClick={() => removeBillItem(item.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 bg-transparent hover:bg-[var(--foreground)]/5 rounded-lg border-0 cursor-pointer h-7 flex items-center justify-center"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Summary / Invoicing control footer panel */}
                  <div className="p-5 border-t border-[var(--border)] bg-[var(--foreground)]/5 text-left space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-500 block">Subtotal</span>
                        <p className="font-bold text-[var(--foreground)] mt-0.5">₹{billSummary.subtotal.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-500 block">Discounts</span>
                        <p className="font-bold text-emerald-400 mt-0.5">- ₹{billSummary.discount.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-500 block">Taxes</span>
                        <p className="font-bold text-slate-400 mt-0.5">+ ₹{billSummary.tax.toLocaleString()}</p>
                      </div>
                      <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                        <span className="text-[8px] font-black uppercase text-amber-500 block">Grand Total</span>
                        <p className="text-sm font-black text-amber-500 mt-0.5">₹{billSummary.grandTotal.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Customer Details section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="flex items-center bg-[var(--foreground)]/5 rounded-xl border border-[var(--border)] px-2.5 py-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-500 mr-2 shrink-0">Client:</span>
                        <input
                          type="text"
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder="Walk-in Customer"
                          className="bg-transparent border-0 text-[var(--foreground)] text-xs outline-none w-full placeholder-[var(--foreground)]/40"
                        />
                      </div>
                      <div className="flex items-center bg-[var(--foreground)]/5 rounded-xl border border-[var(--border)] px-2.5 py-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-500 mr-2 shrink-0">Remarks:</span>
                        <input
                          type="text"
                          value={invoiceNotes}
                          onChange={e => setInvoiceNotes(e.target.value)}
                          placeholder="e.g. Paid in cash, discount applied"
                          className="bg-transparent border-0 text-[var(--foreground)] text-xs outline-none w-full placeholder-[var(--foreground)]/40"
                        />
                      </div>
                    </div>

                    {/* Quick action modifiers */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 flex gap-2">
                        {/* Whole bill flat discount input */}
                        <div className="flex-1 flex items-center bg-[var(--foreground)]/5 rounded-xl border border-[var(--border)] px-2.5 py-1.5">
                          <Tag size={12} className="text-slate-500 mr-1.5 shrink-0" />
                          <input
                            type="number"
                            value={manualDiscount ?? ''}
                            onChange={e => setManualDiscount(e.target.value)}
                            placeholder="Whole-bill discount"
                            className="bg-transparent border-0 text-[var(--foreground)] text-xs outline-none w-full placeholder-[var(--foreground)]/40 font-mono"
                          />
                        </div>
                        {/* Whole bill tax percentage */}
                        <div className="flex-1 flex items-center bg-[var(--foreground)]/5 rounded-xl border border-[var(--border)] px-2.5 py-1.5">
                          <Percent size={12} className="text-slate-500 mr-1.5 shrink-0" />
                          <input
                            type="number"
                            value={manualTax ?? ''}
                            onChange={e => setManualTax(e.target.value)}
                            placeholder="Whole bill tax %"
                            className="bg-transparent border-0 text-[var(--foreground)] text-xs outline-none w-full placeholder-[var(--foreground)]/40 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Primary Action Buttons */}
                    <div className="grid grid-cols-3 gap-2.5 pt-2">
                      <button
                        onClick={() => {
                          if (billItems.length === 0) {
                            addToast("Cannot preview an empty bill.", "warning");
                            return;
                          }
                          const invoiceNum = editingBillId ? (savedBills.find(b => b.id === editingBillId)?.billNumber || 'INV-TEMP') : 'INV-PREVIEW';
                          setActivePreviewBill({
                            id: 'preview',
                            billNumber: invoiceNum,
                            items: billItems,
                            subtotal: billSummary.subtotal,
                            discount: billSummary.discount,
                            tax: billSummary.tax,
                            grandTotal: billSummary.grandTotal,
                            timestamp: new Date().toLocaleString(),
                            createdAt: Date.now(),
                            customerName: customerName.trim() || 'Walk-in Customer',
                            notes: invoiceNotes.trim() || undefined
                          });
                          setShowPreviewModal(true);
                          playClickSound(1050, 0.08);
                        }}
                        className="py-2.5 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/80 font-black uppercase text-[9.5px] tracking-wider rounded-xl border border-[var(--border)] cursor-pointer transition-all flex items-center justify-center gap-1.5"
                        title="Preview bill details & breakdown"
                      >
                        <Eye size={12} className="text-amber-500" />
                        Preview Bill
                      </button>

                      <button
                        onClick={handleSaveActiveBill}
                        className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase text-[9.5px] tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 border-0 shadow-lg shadow-emerald-500/10"
                        title={editingBillId ? "Update saved bill" : "Save bill to history"}
                      >
                        <Save size={12} />
                        {editingBillId ? 'Update Bill' : 'Save Bill'}
                      </button>

                      <button
                        onClick={() => {
                          if (billItems.length === 0) {
                            addToast("Cannot download PDF for an empty bill.", "warning");
                            return;
                          }
                          downloadSingleBillPDF({
                            billNumber: editingBillId ? (savedBills.find(b => b.id === editingBillId)?.billNumber || 'INV-TEMP') : 'INV-TEMP',
                            createdAt: Date.now(),
                            customerName: customerName || 'Walk-in Customer',
                            items: billItems,
                            subtotal: billSummary.subtotal,
                            discount: billSummary.discount,
                            tax: billSummary.tax,
                            grandTotal: billSummary.grandTotal,
                            notes: invoiceNotes
                          });
                          playClickSound(1150, 0.08);
                        }}
                        className="py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase text-[9.5px] tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 border-0 shadow-lg shadow-amber-500/10"
                        title="Download as PDF Invoice"
                      >
                        <Download size={12} />
                        Download PDF
                      </button>
                    </div>
                  </div>
                </div>

                {/* Suggested Cash & Change Assistant Drawer */}
                {billSummary.grandTotal > 0 && settings.enableSmartCash && (
                  <div className="bg-[var(--card)]/60 p-5 rounded-3xl border border-[var(--border)] text-left space-y-4 shadow-md">
                    <div className="flex items-center gap-1.5">
                      <Coins className="text-amber-500 shrink-0" size={16} />
                      <h4 className="font-black text-xs text-[var(--foreground)] uppercase tracking-wider">Suggested Cash & Change Assistant</h4>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {cashSuggestions.map(amt => (
                        <button
                          key={amt}
                          onClick={() => {
                            playClickSound(1100, 0.05);
                            setCashProvided(amt);
                            setManualCashInput(amt.toString());
                          }}
                          className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all border-0 cursor-pointer ${
                            cashProvided === amt 
                              ? 'bg-amber-500 text-slate-950 shadow-md' 
                              : 'bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/80'
                          }`}
                        >
                          ₹{amt.toLocaleString()}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          playClickSound(1000, 0.05);
                          setCashProvided(null);
                          setManualCashInput("");
                        }}
                        className="px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl bg-[var(--foreground)]/10 hover:bg-[var(--foreground)]/20 text-[var(--foreground)]/80 border-0 cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>

                    {/* Manual Input field */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Manual Cash Input</span>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">₹</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Or enter custom cash amount..."
                          value={manualCashInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            setManualCashInput(val);
                            const num = parseFloat(val);
                            if (!isNaN(num) && num >= 0) {
                              setCashProvided(num);
                            } else {
                              setCashProvided(null);
                            }
                          }}
                          className="w-full pl-8 pr-4 py-3 rounded-xl text-xs font-bold bg-[var(--background)] border border-[var(--border)] focus:border-amber-500/50 focus:outline-none text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground)]/30 font-mono"
                        />
                      </div>
                    </div>

                    {cashProvided !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex justify-between items-center"
                      >
                        <div>
                          <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Change to Return</span>
                          <p className="text-2xl font-black text-amber-500 font-mono mt-1">
                            ₹{Math.max(0, cashProvided - billSummary.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-bold text-slate-500 block uppercase">Cash Received</span>
                          <span className="text-xs font-bold text-slate-300 font-mono">₹{cashProvided.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'history' && (
          <motion.div
            key="history-panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6 animate-fade-in"
          >
            {/* Beautiful Dashboard Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[var(--card)]/60 backdrop-blur-md p-5 rounded-3xl border border-[var(--border)] text-left flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider font-sans">Total Sales Invoiced</span>
                  <p className="text-2xl font-black text-amber-500 font-mono mt-1">
                    ₹{savedBills.reduce((sum, b) => sum + b.grandTotal, 0).toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <TrendingUp size={16} className="text-amber-500" />
                </div>
              </div>

              <div className="bg-[var(--card)]/60 backdrop-blur-md p-5 rounded-3xl border border-[var(--border)] text-left flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider font-sans">Total Orders Saved</span>
                  <p className="text-2xl font-black text-[var(--foreground)] font-mono mt-1">
                    {savedBills.length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-[var(--foreground)]/10 flex items-center justify-center border border-[var(--border)]">
                  <FileText size={16} className="text-[var(--foreground)]/80" />
                </div>
              </div>

              <div className="bg-amber-500/5 backdrop-blur-md p-4 rounded-3xl border border-amber-500/20 text-left flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0 mt-0.5">
                  <Calendar size={14} className="text-amber-500" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-amber-500 tracking-wider font-sans">30-Day Auto Retention</span>
                  <p className="text-[10px] text-[var(--foreground)]/70 leading-relaxed font-medium">
                    Bills older than 30 days are automatically checked and permanently deleted on startup to keep ledger sizes lean.
                  </p>
                </div>
              </div>
            </div>

            {/* Invoices List Grid */}
            <div className="bg-[var(--card)]/60 backdrop-blur-md rounded-3xl border border-[var(--border)] p-6 space-y-4 shadow-sm text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div>
                  <h3 className="font-black text-sm text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <History size={16} className="text-amber-500" />
                    Saved Invoices Directory
                  </h3>
                  <p className="text-[9px] text-[var(--foreground)]/50 uppercase tracking-widest mt-0.5">Historical ledger of POS invoices</p>
                </div>

                {savedBills.length > 0 && (
                  <button
                    onClick={() => {
                      playClickSound(1000, 0.05);
                      setShowClearAllBillsConfirm(true);
                    }}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-500 font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Clear All History
                  </button>
                )}
              </div>

              {savedBills.length === 0 ? (
                <div className="py-12 text-center space-y-3.5">
                  <CheckCircle2 size={44} className="mx-auto text-[var(--foreground)]/20 animate-pulse" />
                  <p className="font-black uppercase tracking-widest text-xs text-[var(--foreground)]/60">No invoices saved yet</p>
                  <p className="text-[9px] text-[var(--foreground)]/40 max-w-xs mx-auto uppercase">Create estimators inside POS Billing tab and click "Save Bill" to start tracking records.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedBills.map(bill => (
                    <div
                      key={bill.id}
                      className="p-4 rounded-2xl bg-[var(--foreground)]/5 border border-[var(--border)] hover:border-amber-500/15 transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[var(--foreground)] uppercase tracking-tight">{bill.billNumber}</span>
                            <span className="text-[8px] bg-[var(--foreground)]/10 text-[var(--foreground)]/60 px-1.5 py-0.5 rounded font-mono font-bold">{bill.items.length} items</span>
                          </div>
                          <p className="text-[10px] text-[var(--foreground)]/70 font-semibold mt-1">Client: {bill.customerName}</p>
                          <p className="text-[8px] font-mono text-slate-500 mt-0.5">{bill.timestamp}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-black text-slate-500 block uppercase tracking-wider">Grand Total</span>
                          <span className="text-sm font-black text-amber-500 font-mono">₹{bill.grandTotal.toLocaleString()}</span>
                        </div>
                      </div>

                      {bill.notes && (
                        <p className="text-[9px] text-[var(--foreground)]/50 italic bg-[var(--foreground)]/5 p-2 rounded-lg border border-[var(--border)]/60">
                          "{bill.notes}"
                        </p>
                      )}

                      <div className="flex justify-between items-center border-t border-[var(--border)] pt-3 mt-1">
                        <button
                          onClick={() => {
                            setActivePreviewBill(bill);
                            setShowPreviewModal(true);
                            playClickSound(1050, 0.05);
                          }}
                          className="px-2.5 py-1.5 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[9px] font-black uppercase tracking-wider rounded-lg border border-[var(--border)] cursor-pointer text-[var(--foreground)]/80 flex items-center gap-1 transition-all"
                        >
                          <Eye size={11} className="text-amber-500" />
                          View Details
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleLoadBillForEdit(bill)}
                            className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 font-black text-[9px] uppercase tracking-wider rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                            title="Load items back into editor to revise invoice"
                          >
                            <RefreshCw size={11} />
                            Edit
                          </button>

                          <button
                            onClick={() => {
                              playClickSound(950, 0.05);
                              setBillToDeleteId(bill.id);
                            }}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg cursor-pointer border-0 flex items-center justify-center transition-all h-7 w-7"
                            title="Delete permanently"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed Workspace Control Settings Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => {
            playClickSound();
            setShowWorkspaceSettingsModal(true);
          }}
          className="px-5 py-2.5 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/60 hover:text-amber-500 font-black text-[10px] uppercase tracking-wider rounded-2xl border border-[var(--border)] transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
        >
          <Settings2 size={13} className="text-amber-500 animate-spin-slow" />
          Workspace Module Settings
        </button>
      </div>

      {/* Save Draft Modal */}
      {showDraftModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4 text-left shadow-2xl"
          >
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <h3 className="font-black text-sm text-[var(--foreground)] uppercase tracking-tight flex items-center gap-1.5">
                <FolderDown size={16} className="text-amber-500" />
                Save Draft Estimation
              </h3>
              <button 
                onClick={() => setShowDraftModal(false)}
                className="p-1 hover:bg-[var(--foreground)]/5 rounded border-0 bg-transparent text-slate-500 hover:text-[var(--foreground)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[8px] font-black uppercase tracking-wider text-slate-500 block">Draft Name</label>
              <input
                type="text"
                value={draftName ?? ''}
                onChange={e => setDraftName(e.target.value)}
                placeholder="e.g., Evening bulk delivery, Party Client"
                className="w-full bg-[var(--foreground)]/5 border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs text-[var(--foreground)] focus:border-amber-500/40 outline-none placeholder-[var(--foreground)]/40"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDraftModal(false)}
                className="flex-1 py-2.5 bg-[var(--foreground)]/10 text-[var(--foreground)]/60 font-black uppercase text-[10px] rounded-xl border border-[var(--border)] hover:text-[var(--foreground)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDraft}
                className="flex-1 py-2.5 bg-amber-500 text-slate-950 font-black uppercase text-[10px] rounded-xl border-0 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                Save Draft
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Permanent Price update confirmation Popup dialog */}
      {priceUpdatePending && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4 text-left shadow-2xl"
          >
            <div className="flex items-center gap-2 text-amber-500">
              <Sparkles size={18} className="animate-pulse" />
              <h3 className="font-black text-sm uppercase tracking-tight text-[var(--foreground)]">Item Price Modification</h3>
            </div>
            
            <p className="text-xs text-[var(--foreground)]/80 leading-relaxed">
              You updated the price of this product inside the workspace. Would you like to save this new price permanently in your shop catalog or use it for this active estimation only?
            </p>

            <div className="bg-[var(--foreground)]/5 p-3 rounded-xl border border-[var(--border)] font-mono text-[10px] flex justify-between items-center text-[var(--foreground)]/60">
              <span>Updated price:</span>
              <span className="text-amber-500 font-black">₹{priceUpdatePending.newPrice}</span>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={confirmPermanentPriceUpdate}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-xl cursor-pointer border-0 flex items-center justify-center gap-1.5"
              >
                <Check size={13} /> Update Shop Catalog Permanently
              </button>
              <button
                onClick={() => setPriceUpdatePending(null)}
                className="w-full py-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/80 font-black uppercase tracking-widest text-[10px] rounded-xl border border-[var(--border)] cursor-pointer"
              >
                Use For This Estimate Only
              </button>
              <button
                onClick={() => {
                  // Revert the price to original
                  const pending = priceUpdatePending;
                  setBillItems(prev => prev.map(item => {
                    if (item.id === pending.itemId) {
                      const originalPrice = pending.priceType === 'retail' ? item.retailPrice : item.wholesalePrice;
                      return { ...item, price: originalPrice };
                    }
                    return item;
                  }));
                  setPriceUpdatePending(null);
                }}
                className="w-full py-3 text-slate-500 hover:text-slate-400 text-[10px] font-black uppercase tracking-widest cursor-pointer bg-transparent border-0"
              >
                Cancel Edit
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 30-Day Cleanup Maintenance Modal popup */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-[var(--card)] border border-red-500/20 rounded-3xl p-6 space-y-5 text-left shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500"></div>
            
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={24} className="text-red-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm uppercase tracking-tight text-[var(--foreground)]">30-Day Ledger Maintenance Alert</h3>
                <span className="text-[9px] text-red-400 font-black uppercase tracking-wider block">Critical Storage Lifecycle Event</span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-[var(--foreground)]/80 leading-relaxed">
              <p>
                To maintain optimal application speeds and strictly adhere to your store's storage hygiene policy, saved bills older than <strong className="text-red-400">30 days</strong> must be permanently deleted.
              </p>
              <p>
                We detected <strong className="text-amber-500 font-mono text-sm">{expiredBills.length}</strong> expired invoices that require immediate maintenance action.
              </p>
              
              <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/10 space-y-1.5 max-h-[140px] overflow-y-auto pr-1.5 scrollbar-thin">
                <span className="text-[8px] font-black uppercase text-slate-500 block">Pending Cleanup List ({expiredBills.length}):</span>
                {expiredBills.map((b, i) => (
                  <div key={b.id} className="flex justify-between text-[10px] font-mono text-[var(--foreground)]/60">
                    <span>{i + 1}. {b.billNumber} ({b.customerName})</span>
                    <span>₹{b.grandTotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handlePermanentlyDeleteExpired(false)}
                className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-black uppercase tracking-wider text-[10px] rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} />
                Permanently Delete
              </button>
              
              <button
                onClick={() => handlePermanentlyDeleteExpired(true)}
                className="py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-wider text-[10px] rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
              >
                <Download size={13} />
                Permanently Delete & Download PDF
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom Invoice Delete Confirmation Modal */}
      {billToDeleteId && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-6 text-left shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-black text-sm text-[var(--foreground)] uppercase tracking-tight">Delete Invoice</h3>
                <p className="text-[8px] text-[var(--foreground)]/50 uppercase tracking-widest mt-0.5">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-[var(--foreground)]/70 leading-relaxed">
              Are you sure you want to permanently delete invoice <strong>{savedBills.find(b => b.id === billToDeleteId)?.billNumber}</strong>? All transaction records for this invoice will be permanently deleted from your browser storage.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  playClickSound(900, 0.05);
                  setBillToDeleteId(null);
                }}
                className="px-4 py-2 hover:bg-[var(--foreground)]/5 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[var(--border)] cursor-pointer text-slate-500 hover:text-[var(--foreground)] transition-all bg-transparent outline-none"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteBillPermanently(billToDeleteId);
                  setBillToDeleteId(null);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer border-0 shadow-lg shadow-red-500/10 transition-all outline-none"
              >
                Delete Permanently
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom Clear All History Confirmation Modal */}
      {showClearAllBillsConfirm && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-6 text-left shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-black text-sm text-[var(--foreground)] uppercase tracking-tight">Clear All Invoices</h3>
                <p className="text-[8px] text-[var(--foreground)]/50 uppercase tracking-widest mt-0.5">Archive Backup & Purge</p>
              </div>
            </div>

            <p className="text-xs text-[var(--foreground)]/70 leading-relaxed">
              Are you sure you want to download a backup of all <strong>{savedBills.length}</strong> invoices and clear your entire history? This action will completely empty your database ledger.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  playClickSound(900, 0.05);
                  setShowClearAllBillsConfirm(false);
                }}
                className="px-4 py-2 hover:bg-[var(--foreground)]/5 text-[10px] font-black uppercase tracking-wider rounded-xl border border-[var(--border)] cursor-pointer text-slate-500 hover:text-[var(--foreground)] transition-all bg-transparent outline-none"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  downloadArchivedBillsPDF(savedBills);
                  setSavedBills([]);
                  localStorage.setItem('ts_saved_bills', JSON.stringify([]));
                  addToast("History cleared!", "success");
                  setShowClearAllBillsConfirm(false);
                  playClickSound(1050, 0.05);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer border-0 shadow-lg shadow-red-500/10 transition-all outline-none"
              >
                Backup & Clear All
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Invoice Preview details Modal popup */}
      {showPreviewModal && activePreviewBill && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-6 text-left shadow-2xl relative overflow-hidden"
          >
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="font-black text-sm text-[var(--foreground)] uppercase tracking-tight flex items-center gap-1.5">
                  <FileText size={16} className="text-amber-500" />
                  Invoice Preview Details
                </h3>
                <p className="text-[8px] text-[var(--foreground)]/50 uppercase tracking-widest mt-0.5">Professional document rendering breakdown</p>
              </div>
              <button 
                onClick={() => {
                  setShowPreviewModal(false);
                  setActivePreviewBill(null);
                }}
                className="p-1 hover:bg-[var(--foreground)]/5 rounded-lg border-0 bg-transparent text-slate-500 hover:text-[var(--foreground)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1.5 scrollbar-thin text-xs">
              <div className="grid grid-cols-2 gap-4 bg-[var(--foreground)]/5 p-4 rounded-2xl border border-[var(--border)]">
                <div>
                  <span className="text-[8px] font-black uppercase text-slate-500 block tracking-wider">Invoice No.</span>
                  <p className="font-mono font-bold text-[var(--foreground)] mt-0.5">{activePreviewBill.billNumber}</p>
                  
                  <span className="text-[8px] font-black uppercase text-slate-500 block tracking-wider mt-3">Date & Time</span>
                  <p className="text-[10px] text-[var(--foreground)]/80 font-medium mt-0.5">{activePreviewBill.timestamp}</p>
                </div>
                <div>
                  <span className="text-[8px] font-black uppercase text-slate-500 block tracking-wider">Customer / Client</span>
                  <p className="font-bold text-[var(--foreground)] mt-0.5">{activePreviewBill.customerName}</p>
                  
                  {activePreviewBill.notes && (
                    <>
                      <span className="text-[8px] font-black uppercase text-slate-500 block tracking-wider mt-3">Invoice Notes / Remarks</span>
                      <p className="text-[10px] text-[var(--foreground)]/70 italic mt-0.5">"{activePreviewBill.notes}"</p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider block">Invoiced Line Items</span>
                <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--card)]">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-[var(--foreground)]/5 border-b border-[var(--border)] text-slate-500 font-bold uppercase tracking-wider text-[8px]">
                        <th className="py-2 px-3 w-8 text-center">#</th>
                        <th className="py-2 px-3">Item Details</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Discount</th>
                        <th className="py-2 px-3 text-center">Tax %</th>
                        <th className="py-2 px-3 text-right pr-4">Net Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/50">
                      {activePreviewBill.items.map((item, index) => {
                        const rowTotal = item.quantity * item.price - item.discount + ((item.quantity * item.price - item.discount) * item.tax / 100);
                        return (
                          <tr key={item.id} className="hover:bg-[var(--foreground)]/5 transition-colors">
                            <td className="py-2 px-3 text-center font-mono text-slate-500">{index + 1}</td>
                            <td className="py-2 px-3 font-bold text-[var(--foreground)] uppercase truncate max-w-[140px]" title={item.name}>{item.name}</td>
                            <td className="py-2 px-3 text-center font-mono">{item.quantity}</td>
                            <td className="py-2 px-3 text-right font-mono">₹{item.price.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-400">₹{item.discount.toLocaleString()}</td>
                            <td className="py-2 px-3 text-center font-mono">{item.tax}%</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-amber-500 pr-4">₹{rowTotal.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <div className="w-64 bg-[var(--foreground)]/5 border border-[var(--border)] rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-[10px] text-[var(--foreground)]/60">
                    <span>Subtotal</span>
                    <span className="font-mono">₹{activePreviewBill.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-emerald-400">
                    <span>Discounts</span>
                    <span className="font-mono">- ₹{activePreviewBill.discount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Taxes</span>
                    <span className="font-mono">+ ₹{activePreviewBill.tax.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-[var(--border)] pt-2 flex justify-between items-center bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    <span className="text-[10px] font-black uppercase text-amber-500">Grand Total</span>
                    <span className="text-xs font-black text-amber-500 font-mono">₹{activePreviewBill.grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setActivePreviewBill(null);
                }}
                className="flex-1 py-2.5 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/60 font-black uppercase text-[10px] rounded-xl border border-[var(--border)] hover:text-[var(--foreground)] cursor-pointer transition-all"
              >
                Close View
              </button>
              <button
                onClick={() => {
                  downloadSingleBillPDF({
                    billNumber: activePreviewBill.billNumber,
                    createdAt: activePreviewBill.createdAt,
                    customerName: activePreviewBill.customerName,
                    items: activePreviewBill.items,
                    subtotal: activePreviewBill.subtotal,
                    discount: activePreviewBill.discount,
                    tax: activePreviewBill.tax,
                    grandTotal: activePreviewBill.grandTotal,
                    notes: activePreviewBill.notes
                  });
                  playClickSound(1150, 0.08);
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase text-[10px] rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 border-0 shadow-lg shadow-amber-500/10"
              >
                <Download size={12} />
                Download Invoice PDF
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Calculation History Modal Dialog */}
      {showHistoryPane && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4 text-left shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <div>
                <h3 className="font-black text-sm text-[var(--foreground)] uppercase tracking-tight flex items-center gap-1.5 font-sans">
                  <History size={16} className="text-amber-500" />
                  Calculation Ledger ({calcHistory.length})
                </h3>
                <p className="text-[8px] text-[var(--foreground)]/50 uppercase tracking-widest mt-0.5">Device local store (auto-deletes in 30 days)</p>
              </div>
              <button 
                onClick={() => setShowHistoryPane(false)}
                className="p-1 hover:bg-[var(--foreground)]/5 rounded border-0 bg-transparent text-slate-500 hover:text-[var(--foreground)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 no-scrollbar font-mono text-[11px] flex-1">
              {calcHistory.length === 0 ? (
                <div className="py-12 text-center text-[var(--foreground)]/50">
                  No calculations performed.
                </div>
              ) : (
                calcHistory.map(entry => (
                  <div 
                    key={entry.id} 
                    onClick={() => {
                      updateCalcDisplay(entry.expression);
                      setShowHistoryPane(false);
                      playClickSound();
                    }}
                    className="p-3 rounded-xl bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 transition-all cursor-pointer border border-[var(--border)] flex flex-col gap-1.5 hover:border-amber-500/20 text-left"
                  >
                    <div className="flex justify-between items-start gap-1">
                      {editingEntryId === entry.id ? (
                        <div className="flex gap-1.5 w-full" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingLabelText}
                            onChange={e => setEditingLabelText(e.target.value)}
                            placeholder="Name calculation..."
                            className="flex-1 bg-[var(--background)] border border-amber-500/40 rounded px-2 py-0.5 text-[9px] text-[var(--foreground)] outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const label = editingLabelText.trim();
                                setCalcHistory(prev => {
                                  const updated = prev.map(item => item.id === entry.id ? { ...item, label } : item);
                                  localStorage.setItem('ts_calc_history', JSON.stringify(updated));
                                  return updated;
                                });
                                setEditingEntryId(null);
                              }
                            }}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const label = editingLabelText.trim();
                              setCalcHistory(prev => {
                                const updated = prev.map(item => item.id === entry.id ? { ...item, label } : item);
                                localStorage.setItem('ts_calc_history', JSON.stringify(updated));
                                return updated;
                              });
                              setEditingEntryId(null);
                            }}
                            className="p-1 bg-amber-500 text-slate-950 rounded text-[9px] font-black uppercase px-2 cursor-pointer border-0"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center w-full">
                          {entry.label ? (
                            <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded tracking-wider">
                              🏷️ {entry.label}
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEntryId(entry.id);
                                setEditingLabelText(entry.label || '');
                              }}
                              className="text-[8px] text-slate-400 hover:text-amber-500 uppercase tracking-wider underline cursor-pointer bg-transparent border-0 p-0"
                            >
                              + Add Name
                            </button>
                          )}
                          {entry.label && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEntryId(entry.id);
                                setEditingLabelText(entry.label || '');
                              }}
                              className="text-[8px] text-slate-400 hover:text-amber-500 underline cursor-pointer bg-transparent border-0 p-0"
                            >
                              Rename
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <span className="text-[var(--foreground)]/60 break-all text-right">{entry.expression}</span>
                    <div className="flex justify-between items-center text-amber-500 font-bold border-t border-[var(--border)] pt-1 mt-0.5">
                      <span className="text-[8px] text-[var(--foreground)]/40 font-sans font-bold">{entry.timestamp}</span>
                      <span>= {entry.result}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
              {calcHistory.length > 0 && (
                <button
                  onClick={() => {
                    playClickSound(900);
                    setCalcHistory([]);
                    localStorage.removeItem('ts_calc_history');
                  }}
                  className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border-0 cursor-pointer"
                >
                  Clear Logs
                </button>
              )}
              <button
                onClick={() => setShowHistoryPane(false)}
                className="flex-1 py-2 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/60 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-[var(--border)] cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Workspace Settings Modal Popup */}
      {showWorkspaceSettingsModal && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-6 text-left shadow-2xl relative overflow-hidden"
          >
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="font-black text-sm text-[var(--foreground)] uppercase tracking-tight flex items-center gap-1.5 font-sans">
                  <Settings2 size={16} className="text-amber-500" />
                  Workspace Module Settings
                </h3>
                <p className="text-[8px] text-[var(--foreground)]/50 uppercase tracking-widest mt-0.5">Configure hybrid ledger & estimator parameters</p>
              </div>
              <button 
                onClick={() => setShowWorkspaceSettingsModal(false)}
                className="p-1 hover:bg-[var(--foreground)]/5 rounded-lg border-0 bg-transparent text-slate-500 hover:text-[var(--foreground)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 rounded-2xl border border-[var(--border)] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!settings.calcSounds}
                  onChange={e => setSettings(prev => ({ ...prev, calcSounds: e.target.checked }))}
                  className="accent-amber-500"
                />
                <div className="text-left">
                  <span className="text-xs font-black text-[var(--foreground)] uppercase tracking-wide block">Beep Audio Sounds</span>
                  <span className="text-[8px] text-[var(--foreground)]/40 font-bold uppercase tracking-wide">Auditory interface feedback</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 rounded-2xl border border-[var(--border)] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!settings.calcVibration}
                  onChange={e => setSettings(prev => ({ ...prev, calcVibration: e.target.checked }))}
                  className="accent-amber-500"
                />
                <div className="text-left">
                  <span className="text-xs font-black text-[var(--foreground)] uppercase tracking-wide block">Tactile Vibrations</span>
                  <span className="text-[8px] text-[var(--foreground)]/40 font-bold uppercase tracking-wide">Haptic response feedback</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 rounded-2xl border border-[var(--border)] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!settings.largeButtons}
                  onChange={e => setSettings(prev => ({ ...prev, largeButtons: e.target.checked }))}
                  className="accent-amber-500"
                />
                <div className="text-left">
                  <span className="text-xs font-black text-[var(--foreground)] uppercase tracking-wide block">Spacious Pads</span>
                  <span className="text-[8px] text-[var(--foreground)]/40 font-bold uppercase tracking-wide">Wider button spacing for accessibility</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 rounded-2xl border border-[var(--border)] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!settings.keyboardNav}
                  onChange={e => setSettings(prev => ({ ...prev, keyboardNav: e.target.checked }))}
                  className="accent-amber-500"
                />
                <div className="text-left">
                  <span className="text-xs font-black text-[var(--foreground)] uppercase tracking-wide block">Physical Keyboard sync</span>
                  <span className="text-[8px] text-[var(--foreground)]/40 font-bold uppercase tracking-wide">Enter and num keys bindings</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 rounded-2xl border border-[var(--border)] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!settings.enableSmartCash}
                  onChange={e => setSettings(prev => ({ ...prev, enableSmartCash: e.target.checked }))}
                  className="accent-amber-500"
                />
                <div className="text-left">
                  <span className="text-xs font-black text-[var(--foreground)] uppercase tracking-wide block">Change Suggester</span>
                  <span className="text-[8px] text-[var(--foreground)]/40 font-bold uppercase tracking-wide">Cash estimation drawer</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 rounded-2xl border border-[var(--border)] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!settings.enableCalculationHistory}
                  onChange={e => setSettings(prev => ({ ...prev, enableCalculationHistory: e.target.checked }))}
                  className="accent-amber-500"
                />
                <div className="text-left">
                  <span className="text-xs font-black text-[var(--foreground)] uppercase tracking-wide block">Save calc history</span>
                  <span className="text-[8px] text-[var(--foreground)]/40 font-bold uppercase tracking-wide">Store math calculations trail</span>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setShowWorkspaceSettingsModal(false)}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase text-[10px] tracking-wider rounded-xl transition-all cursor-pointer border-0 shadow-lg shadow-amber-500/10 font-sans"
              >
                Apply & Save Settings
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Save Named Calculation Modal */}
      {showSaveNameModal && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4 text-left shadow-2xl relative"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500">
                <Tag size={18} />
                <h3 className="font-black text-sm uppercase tracking-tight text-[var(--foreground)]">Save Named Calculation</h3>
              </div>
              <button 
                onClick={() => setShowSaveNameModal(false)}
                className="text-slate-400 hover:text-[var(--foreground)] bg-transparent border-0 p-0 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1 bg-[var(--foreground)]/5 p-3 rounded-2xl border border-[var(--border)] font-mono text-[11px] text-[var(--foreground)]/70">
              <div className="flex justify-between items-center">
                <span>Expression:</span>
                <span className="font-black text-[var(--foreground)]">{calcDisplay}</span>
              </div>
              <div className="flex justify-between items-center border-t border-[var(--border)] pt-1.5 mt-1.5">
                <span>Result:</span>
                <span className="font-black text-amber-500">= {evaluateExpression(calcDisplay)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 block">Calculation Tag Name</label>
              <input
                type="text"
                value={saveNameText}
                onChange={(e) => setSaveNameText(e.target.value)}
                placeholder="e.g. Monthly Rent, Total Groceries..."
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-amber-500 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveNamedCalculation();
                  }
                }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSaveNameModal(false)}
                className="flex-1 py-2.5 bg-[var(--foreground)]/10 hover:bg-[var(--foreground)]/20 text-[var(--foreground)]/60 font-black uppercase text-[10px] rounded-xl border border-[var(--border)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNamedCalculation}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase text-[10px] rounded-xl border-0 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                Save Calculation
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Local Toast notifications */}
      <div className="fixed bottom-5 right-5 z-[250] flex flex-col gap-2 max-w-sm pointer-events-none">
        {localToasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border text-xs font-black uppercase tracking-wider pointer-events-auto ${
              toast.type === 'success' 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                : toast.type === 'error' 
                ? 'bg-red-500/15 border-red-500/30 text-red-400' 
                : 'bg-amber-500/15 border-amber-500/30 text-amber-500'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={14} className="shrink-0" />
            ) : (
              <Sparkles size={14} className="shrink-0 animate-pulse" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
