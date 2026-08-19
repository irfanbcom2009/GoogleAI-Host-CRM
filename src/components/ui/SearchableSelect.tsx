import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface Option {
  label: string;
  value: string;
  subLabel?: string;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  required?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  label,
  error,
  className,
  required
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Sort and filter options
  const filteredOptions = useMemo(() => {
    const sorted = [...options].sort((a, b) => 
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );

    if (!search) return sorted;

    const lowerSearch = search.toLowerCase();
    return sorted.filter(opt => 
      opt.label.toLowerCase().includes(lowerSearch) || 
      opt.subLabel?.toLowerCase().includes(lowerSearch)
    );
  }, [options, search]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={cn("space-y-2 relative", className)} ref={containerRef}>
      {label && (
        <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none transition-all cursor-pointer flex justify-between items-center",
          isOpen ? "ring-2 ring-indigo-500 border-indigo-500 bg-white" : "hover:border-indigo-300",
          error ? "border-rose-300 bg-rose-50" : ""
        )}
      >
        <div className="flex items-center gap-3 truncate">
          {selectedOption ? (
            <>
              {selectedOption.icon && <div className="shrink-0">{selectedOption.icon}</div>}
              <div className="truncate">
                <p className="text-sm font-bold text-slate-900 truncate">{selectedOption.label}</p>
                {selectedOption.subLabel && (
                  <p className="text-[10px] text-slate-400 font-medium truncate">{selectedOption.subLabel}</p>
                )}
              </div>
            </>
          ) : (
            <span className="text-slate-400 font-medium text-sm">{placeholder}</span>
          )}
        </div>
        <ChevronDown 
          size={18} 
          className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} 
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-[100] w-full bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50">
              <Search size={16} className="text-slate-400 ml-2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                className="w-full bg-transparent outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300"
                value={search || ''}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={14} className="text-slate-400" />
                </button>
              )}
            </div>
            
            <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, index) => (
                  <div
                    key={`${opt.value}-${index}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between group",
                      value === opt.value ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      {opt.icon && (
                        <div className={cn(
                          "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                          value === opt.value ? "bg-indigo-500" : "bg-slate-100 text-indigo-600"
                        )}>
                          {opt.icon}
                        </div>
                      )}
                      <div className="truncate">
                        <p className={cn("text-sm font-bold truncate", value === opt.value ? "text-white" : "text-slate-900")}>
                          {opt.label}
                        </p>
                        {opt.subLabel && (
                          <p className={cn("text-[10px] font-medium truncate", value === opt.value ? "text-indigo-100" : "text-slate-400")}>
                            {opt.subLabel}
                          </p>
                        )}
                      </div>
                    </div>
                    {value === opt.value && <Check size={16} className="text-white shrink-0" />}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No results found</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {error && <p className="text-[10px] font-bold text-rose-500 mt-1">{error}</p>}
    </div>
  );
};
