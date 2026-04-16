import React, { useState } from 'react';
import { Plus, Trash2, X, Save, Loader2, Settings2 } from 'lucide-react';
import { Modal } from './Modal';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { JournalCategory } from '../types';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fieldName: string;
  type: 'string-list' | 'journal-categories';
  initialItems: any[];
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  title,
  fieldName,
  type,
  initialItems
}) => {
  const [items, setItems] = useState<any[]>(initialItems);
  const [newItem, setNewItem] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    if (type === 'string-list') {
      if (items.includes(newItem.trim())) return;
      setItems([...items, newItem.trim()]);
    } else if (type === 'journal-categories') {
      if (items.find(i => i.name === newItem.trim())) return;
      setItems([...items, { id: crypto.randomUUID(), name: newItem.trim(), subCategories: [] }]);
    }
    setNewItem('');
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleAddSubCategory = (categoryIndex: number, subName: string) => {
    if (!subName.trim()) return;
    const newItems = [...items];
    if (!newItems[categoryIndex].subCategories.includes(subName.trim())) {
      newItems[categoryIndex].subCategories.push(subName.trim());
      setItems(newItems);
    }
  };

  const handleRemoveSubCategory = (categoryIndex: number, subIndex: number) => {
    const newItems = [...items];
    newItems[categoryIndex].subCategories.splice(subIndex, 1);
    setItems(newItems);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsRef = doc(db, 'settings', 'global');
      await updateDoc(settingsRef, {
        [fieldName]: items,
        updatedAt: new Date().toISOString()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="2xl">
      <div className="space-y-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={`Add new ${type === 'journal-categories' ? 'category' : 'item'}...`}
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddItem()}
          />
          <button
            onClick={handleAddItem}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Add
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {items.map((item, index) => (
            <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{type === 'string-list' ? item : item.name}</span>
                <button
                  onClick={() => handleRemoveItem(index)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {type === 'journal-categories' && (
                <div className="pl-4 space-y-2 border-l-2 border-slate-200">
                  <div className="flex flex-wrap gap-2">
                    {item.subCategories.map((sub: string, subIndex: number) => (
                      <span
                        key={subIndex}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600"
                      >
                        {sub}
                        <button
                          onClick={() => handleRemoveSubCategory(index, subIndex)}
                          className="hover:text-rose-600"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add sub-category..."
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleAddSubCategory(index, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <div className="py-12 text-center text-slate-400 italic">
              No items configured yet.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
};
