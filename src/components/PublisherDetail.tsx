import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Building2, 
  User, 
  FileText, 
  ShieldCheck, 
  Upload, 
  Download, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  Loader2,
  Globe,
  BookOpen,
  Hash,
  Mail,
  Ticket,
  Lock,
  Settings2
} from 'lucide-react';
import { Publisher, Client, Journal, Domain, DOIApplication, ServiceType } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, addDoc, orderBy } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Modal } from './Modal';

interface PublisherDetailProps {
  publisherId: string;
  onBack: () => void;
}

export const PublisherDetail: React.FC<PublisherDetailProps> = ({ publisherId, onBack }) => {
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [doiApplications, setDoiApplications] = useState<DOIApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDoiModalOpen, setIsDoiModalOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Publisher>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const [newDoi, setNewDoi] = useState({
    memberName: '',
    doiPrefix: '',
    role: 'Member',
    password: '',
    ticketNo: '',
    otherEmails: '',
    domainName: '',
    contactEmail: '',
    sponsoringOrgName: '',
    orgUrl: '',
    orgPubUrl: '',
    remarks: '',
    journalId: ''
  });

  useEffect(() => {
    let unsubJournals: (() => void) | null = null;
    let unsubDomains: (() => void) | null = null;

    const unsubPub = onSnapshot(doc(db, 'publishers', publisherId), (doc) => {
      if (doc.exists()) {
        const pubData = { id: doc.id, ...doc.data() } as Publisher;
        setPublisher(pubData);
        setEditData(pubData);
        
        // Fetch journals for this publisher
        if (!unsubJournals) {
          const journalsQuery = query(
            collection(db, 'journals'), 
            where('publisherId', '==', publisherId)
          );
          unsubJournals = onSnapshot(journalsQuery, (snapshot) => {
            setJournals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Journal)));
          });
        }

        // Fetch domains for this publisher
        if (!unsubDomains) {
          const domainsQuery = query(
            collection(db, 'domains'),
            where('publisherId', '==', publisherId)
          );
          unsubDomains = onSnapshot(domainsQuery, (snapshot) => {
            setDomains(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Domain)));
          });
        }

        // Fetch DOI applications for this publisher
        const doiQuery = query(
          collection(db, 'doi_applications'),
          where('publisherId', '==', publisherId)
        );
        const unsubDoi = onSnapshot(doiQuery, (snapshot) => {
          setDoiApplications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DOIApplication)));
        });

        setLoading(false);
        return () => {
          unsubDoi();
        };
      } else {
        setPublisher(null);
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'publishers');
      setLoading(false);
    });

    return () => {
      unsubPub();
      if (unsubJournals) unsubJournals();
      if (unsubDomains) unsubDomains();
    };
  }, [publisherId]);

  const handleFileUpload = async (docType: keyof Publisher['documents'], e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !publisher) return;

    setUploading(docType);
    try {
      // In a real app, we would upload to Firebase Storage here.
      // For now, we'll simulate it by using a placeholder URL.
      const simulatedUrl = `https://placeholder-storage.com/${publisherId}/${docType}/${file.name}`;
      
      await updateDoc(doc(db, 'publishers', publisherId), {
        [`documents.${docType}`]: simulatedUrl,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'publishers');
    } finally {
      setUploading(null);
    }
  };

  const removeDocument = async (docType: keyof Publisher['documents']) => {
    if (!publisher) return;
    try {
      await updateDoc(doc(db, 'publishers', publisherId), {
        [`documents.${docType}`]: '',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'publishers');
    }
  };

  const handleSave = async () => {
    if (!publisher) return;
    try {
      await updateDoc(doc(db, 'publishers', publisherId), {
        ...editData,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'publishers');
    }
  };

  const handleCreateDoi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publisher) return;

    try {
      await addDoc(collection(db, 'doi_applications'), {
        ...newDoi,
        publisherId: publisher.id,
        publisherName: publisher.name,
        clientId: publisher.clientId,
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsDoiModalOpen(false);
      setNewDoi({
        memberName: '',
        doiPrefix: '',
        role: 'Member',
        password: '',
        ticketNo: '',
        otherEmails: '',
        domainName: '',
        contactEmail: '',
        sponsoringOrgName: '',
        orgUrl: '',
        orgPubUrl: '',
        remarks: '',
        journalId: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'doi_applications');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  if (!publisher) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500 font-medium">Publisher not found.</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 font-bold hover:underline">Go Back</button>
      </div>
    );
  }

  const documentTypes = [
    { id: 'aoa', label: 'AOA (Articles of Association)', icon: FileText },
    { id: 'moa', label: 'MOA (Memorandum of Association)', icon: FileText },
    { id: 'cnicFront', label: 'CNIC Front', icon: ShieldCheck },
    { id: 'cnicBack', label: 'CNIC Back', icon: ShieldCheck },
    { id: 'ntn', label: 'NTN Certificate', icon: FileText },
    { id: 'secp', label: 'SECP Registration', icon: ShieldCheck },
  ] as const;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-bold group"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:border-slate-300 shadow-sm">
            <ArrowLeft size={20} />
          </div>
          Back to Publishers
        </button>
        <div className="flex gap-3">
          {isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                Save Changes
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
            >
              Edit Details
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <div className="w-24 h-24 rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-4xl font-black shadow-inner">
                {publisher.name.charAt(0)}
              </div>
              <div>
                {isEditing ? (
                  <input 
                    type="text"
                    className="text-2xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full text-center"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                ) : (
                  <h1 className="text-2xl font-black text-slate-900">{publisher.name}</h1>
                )}
                <p className="text-slate-500 font-medium">Publisher Profile</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Owner Name</p>
                <div className="flex items-center gap-2 text-slate-700">
                  <User size={16} className="text-slate-400" />
                  {isEditing ? (
                    <input 
                      type="text"
                      className="font-bold bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                      value={editData.ownerName || ''}
                      onChange={(e) => setEditData({ ...editData, ownerName: e.target.value })}
                    />
                  ) : (
                    <span className="font-bold">{publisher.ownerName}</span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">SECP Registration</p>
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck size={16} className="text-slate-400" />
                  {isEditing ? (
                    <input 
                      type="text"
                      className="font-mono font-bold bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                      value={editData.secpRegistration || ''}
                      onChange={(e) => setEditData({ ...editData, secpRegistration: e.target.value })}
                    />
                  ) : (
                    <span className="font-mono font-bold">{publisher.secpRegistration}</span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NTN Number</p>
                <div className="flex items-center gap-2 text-slate-700">
                  <FileText size={16} className="text-slate-400" />
                  {isEditing ? (
                    <input 
                      type="text"
                      className="font-mono font-bold bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                      value={editData.ntn || ''}
                      onChange={(e) => setEditData({ ...editData, ntn: e.target.value })}
                    />
                  ) : (
                    <span className="font-mono font-bold">{publisher.ntn}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Documents */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Legal Documents</h3>
                  <p className="text-sm text-slate-500">Upload and manage required publisher documentation.</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Uploaded Documents */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Uploaded Documents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentTypes.filter(dt => publisher.documents[dt.id as keyof Publisher['documents']]).map((docType) => {
                    const docUrl = publisher.documents[docType.id as keyof Publisher['documents']];
                    return (
                      <div key={docType.id} className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <docType.icon size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{docType.label}</p>
                            <p className="text-[10px] text-emerald-600 font-medium">Verified & Stored</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={docUrl as string} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Document"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button 
                            onClick={() => removeDocument(docType.id as keyof Publisher['documents'])}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Remove Document"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {documentTypes.filter(dt => publisher.documents[dt.id as keyof Publisher['documents']]).length === 0 && (
                    <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400">No documents uploaded yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Missing Documents */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle size={14} />
                  Missing Documents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentTypes.filter(dt => !publisher.documents[dt.id as keyof Publisher['documents']]).map((docType) => {
                    const isUploading = uploading === docType.id;
                    return (
                      <div key={docType.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-indigo-200 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white text-slate-400 flex items-center justify-center border border-slate-100">
                            <docType.icon size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{docType.label}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Action Required</p>
                          </div>
                        </div>
                        <label className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer">
                          {isUploading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Upload size={16} />
                          )}
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(docType.id as keyof Publisher['documents'], e)}
                            disabled={!!uploading}
                          />
                        </label>
                      </div>
                    );
                  })}
                  {documentTypes.filter(dt => !publisher.documents[dt.id as keyof Publisher['documents']]).length === 0 && (
                    <div className="col-span-full py-8 text-center bg-emerald-50 rounded-2xl border border-dashed border-emerald-200">
                      <p className="text-sm text-emerald-600 font-bold">All required documents are uploaded!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Associated Assets Section */}
          <div className="space-y-8">
            {/* Domains Section */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Globe size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Associated Domains</h3>
                    <p className="text-sm text-slate-500">Domains managed under this publisher.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {domains.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Globe className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-sm text-slate-500">No domains associated with this publisher.</p>
                  </div>
                ) : (
                  domains.map((domain) => (
                    <div key={domain.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 font-bold">
                          {domain.domainName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-all">{domain.domainName}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{domain.registrar}</p>
                        </div>
                      </div>
                      <ExternalLink size={16} className="text-slate-300 group-hover:text-emerald-600" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Journals Section */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Associated Journals</h3>
                    <p className="text-sm text-slate-500">Journals published under this publisher.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {journals.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <BookOpen className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-sm text-slate-500">No journals associated with this publisher.</p>
                  </div>
                ) : (
                  journals.map((journal) => (
                    <div key={journal.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-bold">
                          {journal.title.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-all">{journal.title}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{journal.category}</p>
                        </div>
                      </div>
                      <ExternalLink size={16} className="text-slate-300 group-hover:text-indigo-600" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* DOI Applications Section */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <Hash size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">DOI Applications</h3>
                    <p className="text-sm text-slate-500">Manage Digital Object Identifier applications.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDoiModalOpen(true)}
                  className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                >
                  <Plus size={16} />
                  New Application
                </button>
              </div>

              <div className="space-y-4">
                {doiApplications.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Hash className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-sm text-slate-500">No DOI applications found for this publisher.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {doiApplications.map((app) => (
                      <div key={app.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                              <Hash size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{app.doiPrefix || 'Pending Prefix'}</p>
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{app.memberName}</p>
                            </div>
                          </div>
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            app.status === 'Approved' ? "bg-emerald-100 text-emerald-600" :
                            app.status === 'Rejected' ? "bg-rose-100 text-rose-600" :
                            "bg-amber-100 text-amber-600"
                          )}>
                            {app.status}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[11px] text-slate-600">
                            <Globe size={12} className="text-slate-400" />
                            <span className="font-medium">{app.domainName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-600">
                            <Mail size={12} className="text-slate-400" />
                            <span className="font-medium">{app.contactEmail}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-3xl border border-amber-100 p-6 flex items-start gap-4">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900">Compliance Notice</h4>
              <p className="text-sm text-amber-700 mt-1">
                All uploaded documents must be clear, legible, and valid. Expired or blurred documents may lead to rejection during the verification process.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Modal 
        isOpen={isDoiModalOpen} 
        onClose={() => setIsDoiModalOpen(false)} 
        title="New DOI Application"
        maxWidth="3xl"
      >
        <form onSubmit={handleCreateDoi} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hierarchy Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={16} />
                Hierarchy & Journal
              </h3>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Journal</label>
                <select 
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.journalId}
                  onChange={e => setNewDoi(prev => ({ ...prev, journalId: e.target.value }))}
                >
                  <option value="">Select Journal</option>
                  {journals.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Member Name</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.memberName}
                  onChange={e => setNewDoi(prev => ({ ...prev, memberName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">DOI Prefix</label>
                <input 
                  required
                  type="text"
                  placeholder="10.xxxx"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.doiPrefix}
                  onChange={e => setNewDoi(prev => ({ ...prev, doiPrefix: e.target.value }))}
                />
              </div>
            </div>

            {/* Application Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <FileText size={16} />
                Application Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDoi.role}
                    onChange={e => setNewDoi(prev => ({ ...prev, role: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="password"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newDoi.password}
                      onChange={e => setNewDoi(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket No</label>
                  <div className="relative">
                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newDoi.ticketNo}
                      onChange={e => setNewDoi(prev => ({ ...prev, ticketNo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Domain Name</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      required
                      type="text"
                      placeholder="example.com"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newDoi.domainName}
                      onChange={e => setNewDoi(prev => ({ ...prev, domainName: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    required
                    type="email"
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDoi.contactEmail}
                    onChange={e => setNewDoi(prev => ({ ...prev, contactEmail: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Crossref Metadata */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
              <Settings2 size={16} />
              Crossref Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sponsoring Org Name</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.sponsoringOrgName}
                  onChange={e => setNewDoi(prev => ({ ...prev, sponsoringOrgName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Org URL</label>
                <input 
                  type="url"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.orgUrl}
                  onChange={e => setNewDoi(prev => ({ ...prev, orgUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Org Pub URL</label>
                <input 
                  type="url"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.orgPubUrl}
                  onChange={e => setNewDoi(prev => ({ ...prev, orgPubUrl: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
              <textarea 
                rows={2}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newDoi.remarks}
                onChange={e => setNewDoi(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-rose-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-rose-700 transition-all shadow-xl shadow-rose-200"
            >
              Submit DOI Application
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
