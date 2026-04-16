import React, { useState, useRef, useEffect } from 'react';
import { Check, Settings2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Column {
  id: string;
  label: string;
}

interface ColumnSelectorProps {
  availableColumns: Column[];
  selectedColumns: string[];
  onChange: (selected: string[]) => void;
  maxSelection?: number;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  availableColumns,
  selectedColumns,
  onChange,
  maxSelection = 20
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      if (selectedColumns.length > 1) {
        onChange(selectedColumns.filter(id => id !== columnId));
      }
    } else {
      if (selectedColumns.length < maxSelection) {
        onChange([...selectedColumns, columnId]);
      }
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 font-bold text-sm ${
          isOpen 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Settings2 size={20} />
        <span className="hidden sm:inline">Columns</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Columns</h4>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-200 rounded-full transition-all">
                <X size={14} />
              </button>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {availableColumns.map((column) => {
                const isSelected = selectedColumns.includes(column.id);
                const isDisabled = !isSelected && selectedColumns.length >= maxSelection;

                return (
                  <button
                    key={column.id}
                    disabled={isDisabled}
                    onClick={() => toggleColumn(column.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
                      isSelected 
                        ? 'bg-indigo-50 text-indigo-700 font-bold' 
                        : isDisabled 
                          ? 'opacity-40 cursor-not-allowed' 
                          : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{column.label}</span>
                    {isSelected && <Check size={16} />}
                  </button>
                );
              })}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-medium text-center">
                Selected {selectedColumns.length} of {maxSelection} max
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
