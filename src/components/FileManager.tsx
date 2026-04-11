import React, { useState, useEffect } from 'react';
import { 
  Folder as FolderIcon, 
  File, 
  Plus, 
  ChevronRight, 
  MoreHorizontal, 
  Download, 
  Trash2, 
  Search, 
  Filter,
  ArrowLeft,
  Upload,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  FileCode,
  FileArchive,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Folder, FileRecord, Client } from '../types';
import { FileRequests } from './FileRequests';

interface FileManagerProps {
  searchQuery?: string;
}

export const FileManager: React.FC<FileManagerProps> = ({ searchQuery = '' }) => {
  const [activeTab, setActiveTab] = useState<'files' | 'requests'>('files');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Form states
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');

  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    return () => unsubClients();
  }, []);

  useEffect(() => {
    setLoading(true);
    
    let folderQuery = query(collection(db, 'folders'), orderBy('createdAt', 'desc'));
    if (currentFolderId) {
      folderQuery = query(collection(db, 'folders'), where('parentId', '==', currentFolderId), orderBy('createdAt', 'desc'));
    } else {
      folderQuery = query(collection(db, 'folders'), where('parentId', '==', null), orderBy('createdAt', 'desc'));
    }

    const unsubFolders = onSnapshot(folderQuery, (snapshot) => {
      setFolders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Folder)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'folders'));

    let fileQuery = query(collection(db, 'files'), orderBy('createdAt', 'desc'));
    if (currentFolderId) {
      fileQuery = query(collection(db, 'files'), where('folderId', '==', currentFolderId), orderBy('createdAt', 'desc'));
    } else {
      fileQuery = query(collection(db, 'files'), where('folderId', '==', null), orderBy('createdAt', 'desc'));
    }

    const unsubFiles = onSnapshot(fileQuery, (snapshot) => {
      setFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileRecord)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'files'));

    return () => {
      unsubFolders();
      unsubFiles();
    };
  }, [currentFolderId]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;
    try {
      await addDoc(collection(db, 'folders'), {
        name: newFolderName,
        parentId: currentFolderId,
        clientId: selectedClientId,
        createdAt: serverTimestamp()
      });
      setIsFolderModalOpen(false);
      setNewFolderName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'folders');
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !auth.currentUser) return;
    try {
      await addDoc(collection(db, 'files'), {
        name: newFileName,
        url: newFileUrl || `https://picsum.photos/seed/${Math.random()}/800/600`,
        type: newFileName.split('.').pop() || 'file',
        size: Math.floor(Math.random() * 5000000) + 100000,
        folderId: currentFolderId,
        clientId: selectedClientId,
        uploadedBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setIsFileModalOpen(false);
      setNewFileName('');
      setNewFileUrl('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'files');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;
    try {
      await deleteDoc(doc(db, 'folders', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'folders');
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await deleteDoc(doc(db, 'files', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'files');
    }
  };

  const getFileIcon = (type: string) => {
    const t = type.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(t)) return <ImageIcon className="text-pink-500" />;
    if (['pdf', 'doc', 'docx', 'txt'].includes(t)) return <FileText className="text-blue-500" />;
    if (['zip', 'rar', '7z'].includes(t)) return <FileArchive className="text-amber-500" />;
    if (['js', 'ts', 'html', 'css', 'json'].includes(t)) return <FileCode className="text-emerald-500" />;
    return <File className="text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const currentFolder = folders.find(f => f.id === currentFolderId);
  const parentFolderId = currentFolder?.parentId || null;

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">File Manager</h2>
          <p className="text-slate-500 mt-1">Organize and manage client documents in a structured way.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 mr-4">
            <button
              onClick={() => setActiveTab('files')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'files' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Files
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'requests' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Requests
            </button>
          </div>
          {activeTab === 'files' && (
            <>
              <button 
                onClick={() => setIsFolderModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                <FolderIcon size={20} />
                New Folder
              </button>
              <button 
                onClick={() => setIsFileModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                <Upload size={20} />
                Upload File
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'requests' ? (
        <FileRequests searchQuery={searchQuery} />
      ) : (
        <>
          {/* Breadcrumbs / Navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-500 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <button 
          onClick={() => setCurrentFolderId(null)}
          className={cn("hover:text-indigo-600 transition-colors", !currentFolderId && "font-bold text-slate-900")}
        >
          Root
        </button>
        {currentFolderId && (
          <>
            <ChevronRight size={16} />
            <span className="font-bold text-slate-900">{currentFolder?.name}</span>
          </>
        )}
        {currentFolderId && (
          <button 
            onClick={() => setCurrentFolderId(parentFolderId)}
            className="ml-auto flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft size={14} />
            Back
          </button>
        )}
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-sm font-medium">Loading files and folders...</p>
          </div>
        ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
            <FolderIcon size={48} className="opacity-20" />
            <p className="text-sm font-medium">This folder is empty</p>
          </div>
        ) : (
          <>
            {filteredFolders.map(folder => (
              <motion.div 
                key={folder.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setCurrentFolderId(folder.id)}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <FolderIcon size={32} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 truncate w-full max-w-[120px]">{folder.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Folder</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id);
                  }}
                  className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
            {filteredFiles.map(file => (
              <motion.div 
                key={file.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-all">
                    {getFileIcon(file.type)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 truncate w-full max-w-[120px]">{file.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{formatSize(file.size)}</p>
                  </div>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <a 
                    href={file.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-indigo-600"
                  >
                    <Download size={14} />
                  </a>
                  <button 
                    onClick={() => handleDeleteFile(file.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* New Folder Modal */}
      <AnimatePresence>
        {isFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFolderModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Create New Folder</h3>
                <button 
                  onClick={() => setIsFolderModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreateFolder} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Folder Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Enter folder name"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Assign to Client</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={selectedClientId}
                    onChange={e => setSelectedClientId(e.target.value)}
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsFolderModalOpen(false)}
                    className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    Create Folder
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload File Modal */}
      <AnimatePresence>
        {isFileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFileModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Upload File</h3>
                <button 
                  onClick={() => setIsFileModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleUploadFile} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">File Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. document.pdf"
                    value={newFileName}
                    onChange={e => setNewFileName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">File Upload</label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-3 text-slate-400" />
                        <p className="mb-2 text-sm text-slate-500 font-bold">Click to upload</p>
                        <p className="text-xs text-slate-400 uppercase tracking-wider">PDF, PNG, JPG up to 10MB</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewFileName(file.name);
                            // In a real app, we'd upload to storage here
                            setNewFileUrl(`https://picsum.photos/seed/${file.name}/800/600`);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Assign to Client</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={selectedClientId}
                    onChange={e => setSelectedClientId(e.target.value)}
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsFileModalOpen(false)}
                    className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    Upload File
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
};
