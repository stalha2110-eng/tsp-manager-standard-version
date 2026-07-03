import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Sparkles,
  Zap,
  FolderOpen
} from 'lucide-react';
import { Category, Item, LanguageType } from '../types';
import { Button } from './ui/Button';

const POPULAR_UNITS = [
  'KG', 'Gram', '250gm', 'MG', 'Chatak', 'Tola', 'Quintal', 'Ton', 'Pound',
  'Packet', 'Box', 'Bag', 'Pouch', 'Sack', 'Jar', 'Bottle', 'Tin', 'Can', 'Carton', 'Crate',
  'Piece', 'Dozen', 'Bundle', 'Set', 'Pair', 'Unit'
];

function UnitSuggestionsPopup({ onSelect }: { onSelect: (val: string) => void }) {
  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onMouseDown={(e) => {
          e.preventDefault();
        }} 
        id="unit-suggestions-overlay"
      />
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 bg-[var(--card)] border border-[var(--primary)]/50 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 max-h-[160px] overflow-y-auto w-28 no-scrollbar" id="unit-suggestions-popup">
        {POPULAR_UNITS.map(unit => (
          <button
            key={unit}
            type="button"
            id={`unit-suggest-${unit}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(unit);
            }}
            className="w-full text-center py-1 rounded bg-[var(--background)] hover:bg-[var(--primary)] hover:text-white text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            {unit}
          </button>
        ))}
      </div>
    </>
  );
}

interface SmartItemRow {
  id: string;
  name: string;
  categoryId: string;
  retailPrice: string;
  retailUnit: string;
  wholesalePrice: string;
  wholesaleUnit: string;
  buyingPrice: string;
  buyingUnit: string;
  quantity: string;
  unit: string;
}

const FIELDS = [
  'name', 
  'retailPrice', 
  'retailUnit', 
  'wholesalePrice', 
  'wholesaleUnit', 
  'buyingPrice', 
  'buyingUnit'
] as const;

type FieldName = typeof FIELDS[number];

export function SmartEntryModal({ 
  onClose, 
  onSaveMultiple, 
  categories, 
  t, 
  language 
}: { 
  onClose: () => void, 
  onSaveMultiple: (items: Omit<Item, 'id' | 'lastUpdated'>[]) => void,
  categories: Category[],
  t: any,
  language: LanguageType
}) {
  const defaultCategory = categories[0]?.id || '';
  
  const createEmptyRow = (customIndex?: number): SmartItemRow => ({
    id: Math.random().toString(36).substring(7),
    name: '',
    categoryId: defaultCategory,
    retailPrice: '',
    retailUnit: 'KG',
    wholesalePrice: '',
    wholesaleUnit: 'KG',
    buyingPrice: '',
    buyingUnit: 'KG',
    quantity: '1',
    unit: 'KG',
  });

  const [rows, setRows] = useState<SmartItemRow[]>([createEmptyRow()]);
  const [focusedCoord, setFocusedCoord] = useState<{ rowIndex: number, fieldName: FieldName } | null>(null);
  const [activeCategoryDropdown, setActiveCategoryDropdown] = useState<number | null>(null);

  // Auto-focus handler
  useEffect(() => {
    if (focusedCoord) {
      const elementId = `smart-input-${focusedCoord.rowIndex}-${focusedCoord.fieldName}`;
      const element = document.getElementById(elementId) as HTMLInputElement | null;
      if (element) {
        element.focus();
        element.select();
      }
    }
  }, [focusedCoord]);

  const handleAddRow = () => {
    // Determine default unit from the previous row if available
    const lastRow = rows[rows.length - 1];
    const baseUnit = lastRow?.retailUnit || 'KG';
    const newRow = createEmptyRow();
    newRow.retailUnit = baseUnit;
    newRow.wholesaleUnit = baseUnit;
    newRow.buyingUnit = baseUnit;
    newRow.unit = baseUnit;
    newRow.categoryId = lastRow?.categoryId || defaultCategory;
    
    setRows(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      setRows([createEmptyRow()]);
      setFocusedCoord({ rowIndex: 0, fieldName: 'name' });
      return;
    }
    setRows(prev => prev.filter((_, i) => i !== index));
    
    // Adjust focus coordination if needed
    if (focusedCoord && focusedCoord.rowIndex >= index) {
      const newRowIndex = Math.max(0, focusedCoord.rowIndex - 1);
      setFocusedCoord({ rowIndex: newRowIndex, fieldName: focusedCoord.fieldName });
    }
  };

  const updateRowField = (rowIndex: number, field: keyof SmartItemRow, value: string) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== rowIndex) return row;
      const updated = { ...row, [field]: value };
      
      // Smart Auto-fill within the row:
      if (field === 'retailUnit') {
        const exactVal = value;
        updated.retailUnit = exactVal;
        if (!row.wholesaleUnit || row.wholesaleUnit === row.retailUnit) {
          updated.wholesaleUnit = exactVal;
        }
        if (!row.buyingUnit || row.buyingUnit === row.retailUnit) {
          updated.buyingUnit = exactVal;
        }
        if (!row.unit || row.unit === row.retailUnit) {
          updated.unit = exactVal;
        }
      } else if (field === 'wholesaleUnit') {
        updated.wholesaleUnit = value;
      } else if (field === 'buyingUnit') {
        updated.buyingUnit = value;
      }
      
      return updated;
    }));
  };

  const handleForward = () => {
    if (!focusedCoord) {
      setFocusedCoord({ rowIndex: 0, fieldName: 'name' });
      return;
    }
    const currentFieldIndex = FIELDS.indexOf(focusedCoord.fieldName);
    if (currentFieldIndex < FIELDS.length - 1) {
      setFocusedCoord({
        rowIndex: focusedCoord.rowIndex,
        fieldName: FIELDS[currentFieldIndex + 1]
      });
    } else {
      // Go to next row
      if (focusedCoord.rowIndex < rows.length - 1) {
        setFocusedCoord({
          rowIndex: focusedCoord.rowIndex + 1,
          fieldName: 'name'
        });
      } else {
        // Automatically append row and focus its first field
        handleAddRow();
        const nextIndex = focusedCoord.rowIndex + 1;
        setTimeout(() => {
          setFocusedCoord({
            rowIndex: nextIndex,
            fieldName: 'name'
          });
        }, 50);
      }
    }
  };

  const handleBackward = () => {
    if (!focusedCoord) return;
    const currentFieldIndex = FIELDS.indexOf(focusedCoord.fieldName);
    if (currentFieldIndex > 0) {
      setFocusedCoord({
        rowIndex: focusedCoord.rowIndex,
        fieldName: FIELDS[currentFieldIndex - 1]
      });
    } else {
      // Go to previous row
      if (focusedCoord.rowIndex > 0) {
        setFocusedCoord({
          rowIndex: focusedCoord.rowIndex - 1,
          fieldName: FIELDS[FIELDS.length - 1]
        });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, fieldName: FieldName) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleForward();
    } else if (e.key === 'Tab') {
      // Custom Tab order so navigation feels perfect with forward/backward
      e.preventDefault();
      if (e.shiftKey) {
        handleBackward();
      } else {
        handleForward();
      }
    }
  };

  const handleSave = () => {
    // Filter out rows that have no name
    const validRows = rows.filter(r => r.name.trim() !== '');
    if (validRows.length === 0) {
      alert('Please fill out at least one product name.');
      return;
    }

    const itemsToSave = validRows.map(row => {
      const retailPrice = parseFloat(row.retailPrice) || 0;
      const wholesalePrice = parseFloat(row.wholesalePrice) || 0;
      const buyingPrice = parseFloat(row.buyingPrice) || 0;
      const quantity = parseFloat(row.quantity) || 1;

      return {
        name: row.name.trim(),
        categoryId: row.categoryId,
        quantity,
        unit: row.unit || 'KG',
        retailPrice,
        retailPriceUnit: row.retailUnit || 'KG',
        wholesalePrice,
        wholesalePriceUnit: row.wholesaleUnit || 'KG',
        buyingPrice,
        buyingPriceUnit: row.buyingUnit || 'KG',
        profitMargin: retailPrice - buyingPrice,
        translations: { en: row.name.trim(), hi: '', mr: '', 'hi-en': '' },
        notes: '',
      } as Omit<Item, 'id' | 'lastUpdated'>;
    });

    onSaveMultiple(itemsToSave);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 md:items-center md:p-4 backdrop-blur-md"
    >
      <motion.div 
        initial={{ y: "100%", scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: "100%", scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className="h-[95vh] w-full max-w-5xl overflow-hidden rounded-t-[2.5rem] bg-[var(--card)] flex flex-col md:h-[85vh] md:rounded-[2.5rem] shadow-2xl border border-[var(--border)] relative"
      >
        {/* Abstract Glowing Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--primary)] via-emerald-500 to-amber-500 animate-pulse" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-[var(--border)]/60 bg-[var(--card)]/80 backdrop-blur-md shrink-0 z-30">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/20 shadow-md">
              <Zap size={22} className="animate-pulse" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight uppercase text-[var(--foreground)]">Smart Bulk Entry</h2>
                <span className="bg-gradient-to-r from-[var(--primary)]/20 to-emerald-500/20 text-[var(--primary)] text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-[var(--primary)]/30">
                  Advanced Auto-Fill
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)]/40 mt-0.5">
                Nomenclature = Retail Price / Unit , Wholesale Price / Unit , Cost Price / Unit
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={onClose} 
            size="icon" 
            className="rounded-2xl bg-[var(--background)] hover:bg-red-500/10 hover:text-red-500 transition-all border border-[var(--border)]/50"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Info Notification Bar */}
        <div className="bg-amber-500/10 border-b border-amber-500/10 px-6 py-2.5 text-left flex items-center gap-2">
          <Sparkles size={14} className="text-amber-500 shrink-0" />
          <p className="text-[10px] font-semibold text-amber-500/80 leading-tight">
            ⚡ <strong>Pro Tip:</strong> Symbols <strong>=</strong>, <strong>/</strong>, and <strong>,</strong> are non-editable. Type normally &amp; press <strong>Enter</strong> or use navigation buttons to auto-advance instantly.
          </p>
        </div>

        {/* Grid List Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-[var(--background)]/30 no-scrollbar">
          <div className="space-y-3.5">
            {rows.map((row, index) => {
              const selectedCategory = categories.find(c => c.id === row.categoryId) || categories[0];
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  key={row.id} 
                  className={`flex flex-col md:flex-row md:items-center gap-2.5 p-3.5 rounded-[1.5rem] bg-[var(--card)] border transition-all duration-300 ${
                    focusedCoord?.rowIndex === index 
                      ? 'border-[var(--primary)] shadow-md bg-[var(--card)]' 
                      : 'border-[var(--border)]/75 hover:border-[var(--border)] shadow-sm'
                  }`}
                >
                  {/* Item Index & Category Picker */}
                  <div className="flex items-center gap-2 shrink-0 justify-between md:justify-start">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[10px] font-black text-[var(--foreground)]/50 font-mono shadow-inner">
                        {index + 1}
                      </span>
                      
                      {/* Interactive Category Inline Picker */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveCategoryDropdown(activeCategoryDropdown === index ? null : index)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--background)] hover:bg-[var(--primary)]/10 border border-[var(--border)] text-xs transition-colors"
                          title="Select Asset Category"
                        >
                          <FolderOpen size={12} className="text-[var(--primary)] shrink-0" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--foreground)]/60 max-w-[50px] truncate">
                            {selectedCategory?.name}
                          </span>
                        </button>

                        <AnimatePresence>
                          {activeCategoryDropdown === index && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setActiveCategoryDropdown(null)} 
                              />
                              <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute left-0 mt-1.5 w-48 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl p-1.5 z-50 grid grid-cols-1 gap-1"
                              >
                                {categories.map(cat => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                      updateRowField(index, 'categoryId', cat.id);
                                      setActiveCategoryDropdown(null);
                                    }}
                                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-[var(--primary)]/10 transition-colors"
                                  >
                                    <FolderOpen size={12} className="text-[var(--primary)]/60 shrink-0" />
                                    <span className="font-extrabold text-[10px] uppercase tracking-wide text-[var(--foreground)]/80">
                                      {cat.name}
                                    </span>
                                  </button>
                                ))}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Quantity Selector inside row on Mobile */}
                    <div className="flex md:hidden items-center gap-1">
                      <span className="text-[9px] font-bold opacity-30">QTY:</span>
                      <input 
                        type="number" 
                        value={row.quantity} 
                        onChange={(e) => updateRowField(index, 'quantity', e.target.value)}
                        placeholder="1"
                        className="w-12 text-center text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--background)] py-0.5"
                      />
                    </div>
                  </div>

                  {/* SMART EQUATION LAYOUT */}
                  <div className="flex-1 flex flex-wrap items-center gap-1 bg-[var(--background)]/30 border border-[var(--border)]/40 p-1.5 md:p-2 rounded-2xl min-w-0">
                    
                    {/* Input: Product Name */}
                    <input 
                      id={`smart-input-${index}-name`}
                      placeholder="Product nomenclature..." 
                      className="flex-1 min-w-[130px] font-black text-xs bg-transparent border-none text-[var(--foreground)] placeholder-[var(--foreground)]/25 focus:ring-0 focus:outline-none px-2 py-1"
                      value={row.name}
                      onFocus={() => setFocusedCoord({ rowIndex: index, fieldName: 'name' })}
                      onChange={(e) => updateRowField(index, 'name', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index, 'name')}
                    />

                    {/* Static Symbol "=" */}
                    <div className="flex h-6 items-center px-1">
                      <span className="text-[var(--primary)] font-black select-none text-xs tracking-widest animate-pulse">=</span>
                    </div>

                    {/* Input: Retail Price */}
                    <input 
                      id={`smart-input-${index}-retailPrice`}
                      type="number"
                      placeholder="Retail ₹" 
                      className="w-16 md:w-20 text-center font-bold text-xs bg-[var(--card)] border border-[var(--border)]/60 text-[var(--foreground)] rounded-lg placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none px-1.5 py-1"
                      value={row.retailPrice}
                      onFocus={() => setFocusedCoord({ rowIndex: index, fieldName: 'retailPrice' })}
                      onChange={(e) => updateRowField(index, 'retailPrice', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index, 'retailPrice')}
                    />

                    {/* Static Symbol "/" */}
                    <span className="text-[var(--foreground)]/30 font-black text-xs select-none px-0.5">/</span>

                    {/* Input: Retail Unit */}
                    <div className="relative">
                      <input 
                        id={`smart-input-${index}-retailUnit`}
                        placeholder="Unit" 
                        className="w-12 text-center uppercase font-bold text-[10px] bg-[var(--card)] border border-[var(--border)]/60 text-[var(--foreground)] rounded-lg placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none px-1 py-1"
                        value={row.retailUnit}
                        onFocus={() => setFocusedCoord({ rowIndex: index, fieldName: 'retailUnit' })}
                        onChange={(e) => updateRowField(index, 'retailUnit', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'retailUnit')}
                      />
                      {focusedCoord?.rowIndex === index && focusedCoord?.fieldName === 'retailUnit' && (
                        <UnitSuggestionsPopup 
                          onSelect={(val) => {
                            updateRowField(index, 'retailUnit', val);
                            handleForward();
                          }}
                        />
                      )}
                    </div>

                    {/* Static Symbol "," */}
                    <span className="text-[var(--primary)] font-black text-sm select-none px-1">,</span>

                    {/* Input: Wholesale Price */}
                    <input 
                      id={`smart-input-${index}-wholesalePrice`}
                      type="number"
                      placeholder="Wholesale ₹" 
                      className="w-16 md:w-20 text-center font-bold text-xs bg-[var(--card)] border border-[var(--border)]/60 text-[var(--foreground)] rounded-lg placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none px-1.5 py-1"
                      value={row.wholesalePrice}
                      onFocus={() => setFocusedCoord({ rowIndex: index, fieldName: 'wholesalePrice' })}
                      onChange={(e) => updateRowField(index, 'wholesalePrice', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index, 'wholesalePrice')}
                    />

                    {/* Static Symbol "/" */}
                    <span className="text-[var(--foreground)]/30 font-black text-xs select-none px-0.5">/</span>

                    {/* Input: Wholesale Unit */}
                    <div className="relative">
                      <input 
                        id={`smart-input-${index}-wholesaleUnit`}
                        placeholder="Unit" 
                        className="w-12 text-center uppercase font-bold text-[10px] bg-[var(--card)] border border-[var(--border)]/60 text-[var(--foreground)] rounded-lg placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none px-1 py-1"
                        value={row.wholesaleUnit}
                        onFocus={() => setFocusedCoord({ rowIndex: index, fieldName: 'wholesaleUnit' })}
                        onChange={(e) => updateRowField(index, 'wholesaleUnit', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'wholesaleUnit')}
                      />
                      {focusedCoord?.rowIndex === index && focusedCoord?.fieldName === 'wholesaleUnit' && (
                        <UnitSuggestionsPopup 
                          onSelect={(val) => {
                            updateRowField(index, 'wholesaleUnit', val);
                            handleForward();
                          }}
                        />
                      )}
                    </div>

                    {/* Static Symbol "," */}
                    <span className="text-[var(--primary)] font-black text-sm select-none px-1">,</span>

                    {/* Input: Cost Price */}
                    <input 
                      id={`smart-input-${index}-buyingPrice`}
                      type="number"
                      placeholder="Cost ₹" 
                      className="w-16 md:w-20 text-center font-bold text-xs bg-[var(--card)] border border-[var(--border)]/60 text-[var(--foreground)] rounded-lg placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none px-1.5 py-1"
                      value={row.buyingPrice}
                      onFocus={() => setFocusedCoord({ rowIndex: index, fieldName: 'buyingPrice' })}
                      onChange={(e) => updateRowField(index, 'buyingPrice', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index, 'buyingPrice')}
                    />

                    {/* Static Symbol "/" */}
                    <span className="text-[var(--foreground)]/30 font-black text-xs select-none px-0.5">/</span>

                    {/* Input: Cost Unit */}
                    <div className="relative">
                      <input 
                        id={`smart-input-${index}-buyingUnit`}
                        placeholder="Unit" 
                        className="w-12 text-center uppercase font-bold text-[10px] bg-[var(--card)] border border-[var(--border)]/60 text-[var(--foreground)] rounded-lg placeholder-[var(--foreground)]/30 focus:border-[var(--primary)] focus:outline-none px-1 py-1"
                        value={row.buyingUnit}
                        onFocus={() => setFocusedCoord({ rowIndex: index, fieldName: 'buyingUnit' })}
                        onChange={(e) => updateRowField(index, 'buyingUnit', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, 'buyingUnit')}
                      />
                      {focusedCoord?.rowIndex === index && focusedCoord?.fieldName === 'buyingUnit' && (
                        <UnitSuggestionsPopup 
                          onSelect={(val) => {
                            updateRowField(index, 'buyingUnit', val);
                            handleForward();
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Quantity & Delete Actions (Desktop) */}
                  <div className="flex items-center gap-2.5 justify-end shrink-0">
                    <div className="hidden md:flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] px-2.5 py-1 rounded-xl">
                      <span className="text-[8px] font-black uppercase tracking-wider text-[var(--foreground)]/40 leading-none">Qty:</span>
                      <input 
                        type="number" 
                        value={row.quantity} 
                        onChange={(e) => updateRowField(index, 'quantity', e.target.value)}
                        placeholder="1"
                        className="w-10 text-center font-bold text-xs bg-transparent border-none text-[var(--foreground)] focus:outline-none focus:ring-0 p-0"
                      />
                    </div>
                    
                    <button 
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      className="p-2.5 rounded-xl bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/10 transition-colors cursor-pointer"
                      title="Delete entry row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Add Multiple Items action triggers */}
          <div className="flex justify-center pt-2">
            <button 
              type="button"
              onClick={handleAddRow}
              className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 px-6 py-3.5 rounded-2xl transition-all border border-[var(--primary)]/20 hover:border-[var(--primary)]/30 cursor-pointer active:scale-95"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
              Add Multiple Item Row
            </button>
          </div>
        </div>

        {/* Modal Controls (Footer Nav & Save) */}
        <div className="p-4 md:p-6 border-t border-[var(--border)]/60 bg-[var(--card)]/80 backdrop-blur-md shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 z-30">
          
          {/* Navigation helpers (Backward & Forward Buttons) */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleBackward}
              disabled={!focusedCoord}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]/60 bg-[var(--background)]/80 hover:bg-[var(--foreground)]/5 border border-[var(--border)] px-4 py-3 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft size={12} />
              Backward
            </button>
            <button
              type="button"
              onClick={handleForward}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]/60 bg-[var(--background)]/80 hover:bg-[var(--foreground)]/5 border border-[var(--border)] px-4 py-3 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              Forward
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Status info + Main save */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            <div className="text-right hidden md:block">
              <span className="block text-[8px] font-black uppercase tracking-wider text-[var(--foreground)]/40 leading-none">Registry Entries</span>
              <p className="text-xs font-black text-[var(--foreground)] mt-1">
                {rows.filter(r => r.name.trim() !== '').length} valid products to save
              </p>
            </div>
            
            <button 
              type="button"
              onClick={handleSave}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 text-xs font-black uppercase tracking-widest py-3.5 px-7 rounded-2xl transition-all shadow-lg shadow-[var(--primary)]/20 cursor-pointer active:scale-95"
            >
              <Check size={16} strokeWidth={3} />
              Batch Save Assets
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
