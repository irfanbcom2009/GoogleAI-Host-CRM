import React, { useState } from 'react';
import { Settings2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Column {
  id: string;
  label: string;
}

interface ColumnPickerProps {
  columns: Column[];
  selectedColumns: string[];
  onChange: (selected: string[]) => void;
  maxSelected?: number;
}

export const ColumnPicker: React.FC<ColumnPickerProps> = ({ 
  columns, 
  selectedColumns, 
  onChange, 
  maxSelected = 6 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleColumn = (columnId: string) => {
    if (selectedColumns.includes(columnId)) {
      if (selectedColumns.length > 1) {
        onChange(selectedColumns.filter(id => id !== columnId));
      }
    } else {
      if (selectedColumns.length < maxSelected) {
        onChange([...selectedColumns, columnId]);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
      >
        <Settings2 size={16} />
        Columns
        <span className="ml-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px]">
          {selectedColumns.length}/{maxSelected}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Display Columns</h4>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <div className="p-2 max-h-80 overflow-y-auto">
                {columns.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-all group",
                      selectedColumns.includes(col.id)
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {col.label}
                    <div className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                      selectedColumns.includes(col.id)
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-slate-200 group-hover:border-indigo-300"
                    )}>
                      {selectedColumns.includes(col.id) && <Check size={12} />}
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-medium text-center">
                Select up to {maxSelected} columns to display
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
