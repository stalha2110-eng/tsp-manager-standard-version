import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, FolderOpen, AlertCircle, Save, Info, Trash2, Shield, Sparkles } from 'lucide-react';
import { Category } from '../types';
import { Button } from './ui/Button';

interface CategoryAddModalProps {
  onClose: () => void;
  onSave: (categories: { name: string; icon: string }[]) => void;
  onDeleteCategory?: (id: string) => void;
  currentCategories: Category[];
  t: any;
}

const EMOJI_PRESETS = [
  '🥜', '🌶️', '🌿', '🌻', '🫘', '📦', '🥛', '🍎', '🍬', '🧼', 
  '🍞', '🥩', '🐟', '🍳', '🥤', '🍽️', '🍕', '🍰', '🍌', '🧅', 
  '🥔', '🍯', '🧂', '🧀', '🍗', '🥬', '🥕', '🍦', '🍩', '🛍️'
];

export function CategoryAddModal({ onClose, onSave, onDeleteCategory, currentCategories, t }: CategoryAddModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  
  // Create tab states
  const [inputValue, setInputValue] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📦');
  const [pendingCategories, setPendingCategories] = useState<{ name: string; icon: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [catToDelete, setCatToDelete] = useState<{ id: string; name: string } | null>(null);

  // System vs Custom Categories check
  const systemCategoryIds = ['1', '2', '3', '4', '5', '6'];

  const handleAddPending = () => {
    if (!inputValue.trim()) return;

    // Split by commas or new lines
    const parsed = inputValue
      .split(/[\n,]+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);

    const duplicates: string[] = [];
    const valid: { name: string; icon: string }[] = [];

    parsed.forEach(name => {
      const lowerName = name.toLowerCase();
      // Check if already exists in saved categories
      const existsInSaved = currentCategories.some(c => c.name.toLowerCase() === lowerName);
      // Check if already exists in pending list
      const existsInPending = pendingCategories.some(p => p.name.toLowerCase() === lowerName);
      const existsInParsed = valid.some(v => v.name.toLowerCase() === lowerName);

      if (existsInSaved || existsInPending || existsInParsed) {
        duplicates.push(name);
      } else {
        // If bulk adding, default to box emoji '📦'. If single item, use selected emoji.
        valid.push({ 
          name, 
          icon: parsed.length === 1 ? selectedEmoji : '📦' 
        });
      }
    });

    if (duplicates.length > 0) {
      setError(`Notice: "${duplicates.slice(0, 2).join(', ')}" was ignored as it already exists.`);
    } else {
      setError(null);
    }

    if (valid.length > 0) {
      setPendingCategories(prev => [...prev, ...valid]);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddPending();
    }
  };

  const removePending = (index: number) => {
    setPendingCategories(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (pendingCategories.length === 0) {
      setError('Please add at least one category to staging first.');
      return;
    }
    onSave(pendingCategories);
    onClose();
  };

  const handleDeleteClick = (catId: string, catName: string) => {
    setCatToDelete({ id: catId, name: catName });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-[var(--card)] rounded-[2.5rem] border border-[var(--border)] shadow-2xl p-6 md:p-8 relative overflow-hidden"
      >
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[var(--primary)]/10 blur-3xl pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shadow-inner">
              <FolderOpen size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">
                Category Manager
              </h3>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                Classification Control Hub
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="rounded-full h-8 w-8 hover:bg-white/10 flex items-center justify-center border border-white/5 transition-colors cursor-pointer text-[var(--foreground)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[var(--border)] mb-6 p-1 bg-[var(--background)] rounded-2xl">
          <button
            type="button"
            onClick={() => { setActiveTab('create'); setError(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'create' 
                ? 'bg-[var(--primary)] text-white shadow' 
                : 'text-[var(--foreground)] opacity-50 hover:opacity-100'
            }`}
          >
            Create Staging
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('manage'); setError(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'manage' 
                ? 'bg-[var(--primary)] text-white shadow' 
                : 'text-[var(--foreground)] opacity-50 hover:opacity-100'
            }`}
          >
            Manage Active ({currentCategories.length})
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'create' ? (
            <motion.div
              key="create-tab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {/* Quick instructions */}
              <div className="flex items-start gap-2 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/15 text-blue-400 text-[10px] font-semibold leading-relaxed">
                <Info size={14} className="shrink-0 mt-0.5" />
                <div>
                  Enter category names. Separate with commas to bulk upload (e.g. <span className="text-white font-bold">Beverages, Grains, Sweets</span>) or create standard single entries with a custom emoji.
                </div>
              </div>

              {/* Single Creator Emoji Selection */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40 flex items-center gap-1">
                  <Sparkles size={10} className="text-[var(--primary)]" />
                  Category Emoji Accent
                </label>
                <div className="flex items-center gap-3 bg-[var(--background)] p-3 rounded-2xl border border-[var(--border)]">
                  <div className="h-12 w-12 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-2xl shadow-inner">
                    {selectedEmoji}
                  </div>
                  <div className="flex-1 grid grid-cols-10 gap-1.5 max-h-[80px] overflow-y-auto pr-1 no-scrollbar">
                    {EMOJI_PRESETS.map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setSelectedEmoji(em)}
                        className={`h-7 w-7 rounded-lg flex items-center justify-center text-base hover:bg-[var(--primary)]/10 active:scale-95 transition-all cursor-pointer ${
                          selectedEmoji === em ? 'bg-[var(--primary)]/20 border border-[var(--primary)]' : ''
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input Area */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Staging Input</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type name & hit Enter or comma..."
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-xs focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none shadow-sm transition-all text-[var(--foreground)]"
                  />
                  <Button 
                    type="button" 
                    onClick={handleAddPending}
                    className="rounded-xl px-4 cursor-pointer"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>

              {/* Staged Category Chips */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest opacity-40">Staged to Sync ({pendingCategories.length})</h4>
                <div className="min-h-[70px] max-h-[140px] overflow-y-auto rounded-2xl bg-[var(--background)] border border-[var(--border)] p-3 flex flex-wrap gap-2 items-start content-start no-scrollbar">
                  <AnimatePresence>
                    {pendingCategories.length === 0 ? (
                      <div className="text-[10px] text-center w-full py-4 opacity-30 font-bold uppercase tracking-wider">
                        Staging area empty.
                      </div>
                    ) : (
                      pendingCategories.map((cat, idx) => (
                        <motion.span
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 shadow-sm"
                        >
                          <span className="text-xs">{cat.icon}</span>
                          <span>{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => removePending(idx)}
                            className="hover:bg-[var(--primary)]/25 rounded-full p-0.5 text-[var(--primary)]/70 hover:text-[var(--primary)] transition-colors cursor-pointer"
                          >
                            <X size={10} strokeWidth={3} />
                          </button>
                        </motion.span>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Feedback/Errors */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest border-white/5 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirm}
                  disabled={pendingCategories.length === 0}
                  className="flex-1 rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest gap-2 cursor-pointer"
                >
                  <Save size={14} /> Commit & Sync
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="manage-tab"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Active list details */}
              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-widest opacity-40">Active Classifications ({currentCategories.length})</h4>
                <div className="max-h-[300px] overflow-y-auto rounded-2xl bg-[var(--background)] border border-[var(--border)] p-2 divide-y divide-[var(--border)]/30 no-scrollbar">
                  {currentCategories.map(cat => {
                    const isSystem = systemCategoryIds.includes(cat.id);
                    return (
                      <div 
                        key={cat.id} 
                        className="flex items-center justify-between p-3.5 hover:bg-[var(--card)] rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl shrink-0">{cat.icon || '📦'}</span>
                          <span className="text-xs font-black uppercase tracking-tight text-[var(--foreground)] truncate">
                            {cat.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          {isSystem ? (
                            <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg">
                              <Shield size={10} />
                              System Protected
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(cat.id, cat.name)}
                              className="h-8 w-8 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center border border-red-500/20 transition-all active:scale-95 cursor-pointer shadow-sm hover:shadow-red-500/15"
                              title="Delete Category"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Close Action */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="w-full rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest border-white/5 cursor-pointer"
                >
                  Exit Control Center
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Category Delete confirmation overlay */}
        {catToDelete && (
          <div className="absolute inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex flex-col justify-center p-6 text-left space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white uppercase tracking-tight">Delete Category</h4>
                <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-0.5">Reassignment notice</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete category <strong>"{catToDelete.name}"</strong>? All active products under this category will be automatically reassigned to the <strong>"Others"</strong> group.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCatToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest bg-transparent hover:bg-white/5 transition-all text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCategory) {
                    onDeleteCategory(catToDelete.id);
                  }
                  setCatToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-0"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
