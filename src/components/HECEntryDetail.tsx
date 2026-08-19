import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Key, 
  Eye, 
  EyeOff, 
  Save, 
  Workflow, 
  Plus, 
  Lock, 
  Upload, 
  ShieldCheck, 
  Check, 
  Loader2, 
  Calendar, 
  GraduationCap, 
  Building, 
  User,
  Settings,
  X,
  CreditCard
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, updateDoc, addDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { HECEntry, Journal, Client, User as UserType, HECApplicationWorkflow, HECWorkflowStage } from '../types';
import { cn } from '../lib/utils';

interface HECEntryDetailProps {
  entry: HECEntry;
  currentUser: UserType;
  journals: Journal[];
  clients: Client[];
  onBack: () => void;
  onUpdateEntry: (updated: HECEntry) => void;
}

const HEC_STAGES = [
  { id: 1, name: "Initial Review", description: "Verification of initial application documents." },
  { id: 2, name: "Editorial Check", description: "Evaluation of the editorial board members' profiles." },
  { id: 3, name: "Policy Verification", description: "Checking ethical and publication policies." },
  { id: 4, name: "Technical Audit", description: "Website speed, SSL, and technical compliance." },
  { id: 5, name: "Similarity Check", description: "Verification of plagiarism reports for last issues." },
  { id: 6, name: "Board Verification", description: "Direct verification of editorial board associations." },
  { id: 7, name: "Regularity Check", description: "Analysis of issues regularity and timeliness." },
  { id: 8, name: "Indexing Audit", description: "Verification of claimed indexing databases." },
  { id: 9, name: "Committee Review", description: "Preparing the case for HEC SRC committee." },
  { id: 10, name: "Payment & Completion", description: "Processing final fees and generating PSID." }
];

const HEC_DISCIPLINES: Record<string, Record<string, string[]>> = {
  'Social Sciences': {
    'Psychology': ['Clinical Psychology', 'Social Psychology', 'Developmental Psychology'],
    'Sociology': ['Urban Sociology', 'Rural Sociology', 'Medical Sociology'],
    'Education': ['Higher Education', 'Primary Education', 'Special Education']
  },
  'Natural Sciences': {
    'Physics': ['Quantum Physics', 'Astrophysics', 'Nuclear Physics'],
    'Chemistry': ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry'],
    'Biology': ['Molecular Biology', 'Genetics', 'Botany']
  },
  'Engineering & Technology': {
    'Computer Science': ['Artificial Intelligence', 'Software Engineering', 'Cyber Security'],
    'Electrical Engineering': ['Power Systems', 'Electronics', 'Telecommunications'],
    'Civil Engineering': ['Structural Engineering', 'Environmental Engineering', 'Transportation Engineering']
  },
  'Medical Sciences': {
    'Medicine': ['Internal Medicine', 'Surgery', 'Pediatrics'],
    'Pharmacy': ['Pharmacology', 'Pharmaceutics', 'Clinical Pharmacy'],
    'Dentistry': ['Orthodontics', 'Periodontics', 'Prosthodontics']
  }
};

export const HECEntryDetail: React.FC<HECEntryDetailProps> = ({ 
  entry, 
  currentUser, 
  journals, 
  clients, 
  onBack,
  onUpdateEntry 
}) => {
  // Edit Form state
  const [formData, setFormData] = useState<HECEntry>({ ...entry });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Workflow integration state
  const [workflow, setWorkflow] = useState<HECApplicationWorkflow | null>(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(true);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [showWorkflowPassword, setShowWorkflowPassword] = useState(false);
  const [isInitializingWorkflow, setIsInitializingWorkflow] = useState(false);

  // Workflow initialization form state
  const [newWorkflowAssignments, setNewWorkflowAssignments] = useState<Record<number, string>>({});
  const [newWorkflowU, setNewWorkflowU] = useState(entry.loginCredentials.username || '');
  const [newWorkflowP, setNewWorkflowP] = useState(entry.loginCredentials.password || '');

  useEffect(() => {
    setFormData({ ...entry });
    setNewWorkflowU(entry.loginCredentials.username || '');
    setNewWorkflowP(entry.loginCredentials.password || '');
  }, [entry]);

  // Sync real-time updates for the workflow matching this journal
  useEffect(() => {
    if (!entry.journalId) {
      setLoadingWorkflow(false);
      return;
    }
    setLoadingWorkflow(true);
    const q = query(collection(db, 'hec_workflows'), where('journalId', '==', entry.journalId));
    const unsubscribeWorkflow = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setWorkflow({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as HECApplicationWorkflow);
      } else {
        setWorkflow(null);
      }
      setLoadingWorkflow(false);
    }, (error) => {
      console.error("Error fetching matching workflow:", error);
      setLoadingWorkflow(false);
    });

    const unsubEmployees = onSnapshot(
      query(collection(db, 'users'), where('role', 'in', ['Employee', 'Manager', 'Admin'])), 
      (snapshot) => {
        setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserType[]);
      }
    );

    return () => {
      unsubscribeWorkflow();
      unsubEmployees();
    };
  }, [entry.journalId]);

  // Handle saving core details edit form
  const handleSaveCoreDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const entryRef = doc(db, 'hec_entries', entry.id);
      const updatedFields = {
        journalId: formData.journalId,
        year: Number(formData.year),
        frequency: formData.frequency,
        loginCredentials: {
          username: formData.loginCredentials.username,
          password: formData.loginCredentials.password
        },
        appNo: formData.appNo,
        psid: formData.psid,
        ownerInfo: formData.ownerInfo || '',
        discipline: formData.discipline,
        subjectArea: formData.subjectArea,
        subCategory: formData.subCategory,
        status: formData.status,
        category: formData.category || '',
        points: Number(formData.points || 0),
        fees: Number(formData.fees || 0),
        expirationDate: formData.expirationDate,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      };

      await updateDoc(entryRef, updatedFields);
      
      onUpdateEntry({
        ...entry,
        ...updatedFields
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hec_entries');
    } finally {
      setIsSaving(false);
    }
  };

  // Workflow initialization action
  const handleInitializeWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    const journal = journals.find(j => j.id === entry.journalId);
    if (!journal) return;

    const stages: HECWorkflowStage[] = HEC_STAGES.map(stage => ({
      stageId: stage.id,
      name: stage.name,
      description: stage.description,
      assignedEmployeeId: newWorkflowAssignments[stage.id] || '',
      assignedEmployeeName: employees.find(emp => emp.id === newWorkflowAssignments[stage.id])?.name || 'Unassigned',
      status: 'Pending'
    }));

    try {
      await addDoc(collection(db, 'hec_workflows'), {
        journalId: journal.id,
        journalTitle: journal.title,
        clientId: journal.clientId,
        clientName: journal.clientName || 'Unknown Client',
        currentStage: 1,
        status: 'Incomplete',
        stages,
        payment: { status: 'Unpaid' },
        loginCredentials: {
          username: newWorkflowU,
          password: newWorkflowP
        },
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id
      });
      setIsInitializingWorkflow(false);
    } catch (error) {
      console.error('Error starting workflow:', error);
    }
  };

  // Complete currently active stage in the workflow
  const handleCompleteStage = async (workflowId: string, stageId: number) => {
    if (!workflow) return;

    const updatedStages = [...workflow.stages];
    const stageIndex = updatedStages.findIndex(s => s.stageId === stageId);
    updatedStages[stageIndex].status = 'Completed';
    updatedStages[stageIndex].completedAt = new Date().toISOString();

    const nextStage = stageId + 1;
    const isFinished = stageId === 10;

    const updates: any = {
      stages: updatedStages,
      currentStage: isFinished ? 10 : nextStage,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name
    };

    if (isFinished) {
      if (workflow.payment.status === 'Paid' && workflow.payment.verifiedAt) {
        updates.status = 'Completed';
      }
    }

    try {
      await updateDoc(doc(db, 'hec_workflows', workflowId), updates);
      
      // Notify next employee
      if (!isFinished) {
        const nextEmployeeId = updatedStages[stageIndex + 1]?.assignedEmployeeId;
        if (nextEmployeeId) {
          await addDoc(collection(db, 'notifications'), {
            userId: nextEmployeeId,
            title: "HEC Stage Assigned",
            message: `You are assigned to Stage ${nextStage} for ${workflow.journalTitle}`,
            type: 'hec_workflow',
            link: `/hec?workflowId=${workflowId}`,
            isRead: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error completing stage:', error);
    }
  };

  // Handle stage assignment update
  const handleUpdateStageAssignment = async (stageId: number, employeeId: string) => {
    if (!workflow) return;

    const updatedStages = [...workflow.stages];
    const stageIndex = updatedStages.findIndex(s => s.stageId === stageId);
    if (stageIndex === -1) return;

    const employeeName = employees.find(emp => emp.id === employeeId)?.name || 'Unassigned';
    updatedStages[stageIndex].assignedEmployeeId = employeeId;
    updatedStages[stageIndex].assignedEmployeeName = employeeName;

    try {
      await updateDoc(doc(db, 'hec_workflows', workflow.id), {
        stages: updatedStages,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name
      });
    } catch (error) {
      console.error('Error updating stage assignment:', error);
    }
  };

  // Handle workflow payment statuses
  const handlePaymentAction = async (workflowId: string, action: 'generate_psid' | 'upload_screenshot' | 'verify') => {
    if (!workflow) return;

    const updates: any = { ...workflow.payment };

    if (action === 'generate_psid') {
      updates.psid = `HEC-${Math.floor(100000 + Math.random() * 900000)}`;
    } else if (action === 'upload_screenshot') {
      updates.screenshotUrl = "https://picsum.photos/seed/payment/800/600";
    } else if (action === 'verify') {
      updates.status = 'Paid';
      updates.verifiedAt = new Date().toISOString();
      updates.verifiedBy = currentUser.name;
      updates.verifiedById = currentUser.id;
    }

    try {
      const finalUpdates: any = { payment: updates };
      const allStagesDone = workflow.stages.every(s => s.status === 'Completed');
      if (allStagesDone && updates.status === 'Paid' && updates.verifiedAt) {
        finalUpdates.status = 'Completed';
      }

      await updateDoc(doc(db, 'hec_workflows', workflowId), finalUpdates);
    } catch (error) {
      console.error('Error updating payment:', error);
    }
  };

  const getJournalTitle = (journalId: string) => {
    return journals.find(j => j.id === journalId)?.title || 'Unknown Journal';
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to HEC Applications
          </button>
          
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-indigo-600">APP:</span> {entry.appNo || 'N/A'}
              <span className="text-slate-300 font-normal">/</span>
              <span className="text-slate-500 text-2xl font-mono">PSID: {entry.psid || 'N/A'}</span>
            </h2>
            {entry.isVerified ? (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 size={13} /> Verified
              </span>
            ) : (
              <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                <Clock size={13} /> Reviewing
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm font-medium">
            Managed for journal <span className="font-bold text-slate-800">{getJournalTitle(entry.journalId)}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Core application details & edit options (8 columns wide) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Settings size={20} className="text-indigo-600" />
              Edit Application Parameters
            </h3>
            {saveSuccess && (
              <span className="text-sm text-emerald-600 font-bold flex items-center gap-1 animate-pulse">
                <Check size={16} /> Saved Successfully
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCoreDetails} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Application Number</label>
                <input 
                  type="text" 
                  required
                  value={formData.appNo || ''}
                  onChange={(e) => setFormData({ ...formData, appNo: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">PSID</label>
                <input 
                  type="text" 
                  required
                  value={formData.psid || ''}
                  onChange={(e) => setFormData({ ...formData, psid: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Select Journal</label>
                <select 
                  required
                  value={formData.journalId || ''}
                  onChange={(e) => setFormData({ ...formData, journalId: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                >
                  <option value="">Select a Journal...</option>
                  {journals.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Year</label>
                <input 
                  type="number" 
                  required
                  value={formData.year || ''}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Frequency</label>
                <select 
                  required
                  value={formData.frequency || ''}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                >
                  <option value="Quarterly">Quarterly</option>
                  <option value="Bi-Annual">Bi-Annual</option>
                  <option value="Annual">Annual</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Discipline</label>
                <select 
                  required
                  value={formData.discipline || ''}
                  onChange={(e) => setFormData({ ...formData, discipline: e.target.value, subjectArea: '', subCategory: '' })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                >
                  <option value="">Select Discipline...</option>
                  {Object.keys(HEC_DISCIPLINES).map(disc => (
                    <option key={disc} value={disc}>{disc}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Subject Area</label>
                <select 
                  required
                  disabled={!formData.discipline}
                  value={formData.subjectArea || ''}
                  onChange={(e) => setFormData({ ...formData, subjectArea: e.target.value, subCategory: '' })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold disabled:opacity-50"
                >
                  <option value="">Select Subject Area...</option>
                  {formData.discipline && Object.keys(HEC_DISCIPLINES[formData.discipline] || {}).map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Sub Category</label>
                <select 
                  required
                  disabled={!formData.subjectArea}
                  value={formData.subCategory || ''}
                  onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold disabled:opacity-50"
                >
                  <option value="">Select Sub Category...</option>
                  {formData.discipline && formData.subjectArea && (HEC_DISCIPLINES[formData.discipline]?.[formData.subjectArea] || []).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Desired Category</label>
                <input 
                  type="text" 
                  placeholder="e.g. W, X, Y, Z"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value.toUpperCase() })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold uppercase"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Expiration Date</label>
                <input 
                  type="date" 
                  value={formData.expirationDate || ''}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Application Points</label>
                <input 
                  type="number" 
                  value={formData.points !== undefined ? formData.points : 0 || ''}
                  onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Fees Paid ($)</label>
                <input 
                  type="number" 
                  value={formData.fees !== undefined ? formData.fees : 0 || ''}
                  onChange={(e) => setFormData({ ...formData, fees: Number(e.target.value) })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Application Status</label>
                <select 
                  value={formData.status || ''}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as HECEntry['status'] })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                >
                  <option value="active">Active</option>
                  <option value="expiring">Expiring</option>
                  <option value="missing">Missing</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Owner / Portal Info</label>
                <textarea 
                  rows={2}
                  value={formData.ownerInfo || ''}
                  onChange={(e) => setFormData({ ...formData, ownerInfo: e.target.value })}
                  placeholder="Any details of key contact or coordinator..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm leading-relaxed"
                />
              </div>

            </div>

            {/* Portal Credentials panel */}
            <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
              <div className="flex items-center gap-2 text-indigo-700">
                <Key size={16} />
                <h4 className="text-xs font-black uppercase tracking-wider">HEC Portal Login Credentials</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-indigo-600 uppercase">Username</label>
                  <input 
                    type="text" 
                    value={formData.loginCredentials?.username || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      loginCredentials: { ...formData.loginCredentials, username: e.target.value }
                    })}
                    className="w-full p-2.5 bg-white border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono text-indigo-900"
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-indigo-600 uppercase">Password</label>
                    <button 
                      type="button"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      className="text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {showFormPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <input 
                    type={showFormPassword ? "text" : "password"} 
                    value={formData.loginCredentials?.password || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      loginCredentials: { ...formData.loginCredentials, password: e.target.value }
                    })}
                    className="w-full p-2.5 bg-white border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono text-indigo-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 h-[46px] cursor-pointer"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? 'Saving Changes...' : 'Save Application Details'}
              </button>
            </div>
          </form>
        </div>

        {/* Right column: Interactive HEC Workflow stages and assignments (5 columns wide) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-8 space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Workflow size={160} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Workflow size={20} />
                <span className="text-xs font-black uppercase tracking-wider">Multi-Stage Workflow Integration</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight">Active HEC Workflow</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Step-by-step progress and operational checkpoints required for academic journals.
              </p>
            </div>

            {loadingWorkflow ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-xs font-bold">Checking workflow channels...</p>
              </div>
            ) : workflow ? (
              // Display the active workflow details
              <div className="space-y-6">
                
                {/* Visual Status Indicator & Progress bar */}
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-widest">
                      Stage {workflow.currentStage} of 10
                    </span>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                      workflow.status === 'Completed' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    )}>
                      {workflow.status}
                    </span>
                  </div>

                  {(() => {
                    const completedStages = workflow.stages.filter(s => s.status === 'Completed').length;
                    const progress = (completedStages / 10) * 100;
                    return (
                      <div className="space-y-2">
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                          <span>Workflow Completeness</span>
                          <span>{Math.round(progress)}% ({completedStages}/10 stages)</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ACTIVE STAGE CHEVRON & COMPLETION BUTTON */}
                {(() => {
                  const currentStage = workflow.stages.find(s => s.stageId === workflow.currentStage);
                  const isAssignedToMe = currentStage?.assignedEmployeeId === currentUser.id || currentUser.role === 'Admin';
                  
                  return (
                    <div className="p-5 bg-indigo-550 bg-indigo-600 rounded-2xl space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/20">
                          <Clock size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-indigo-200">Current Task Required</p>
                          <h4 className="text-sm font-bold text-white leading-tight">{currentStage?.name}</h4>
                        </div>
                      </div>
                      
                      <p className="text-xs text-indigo-100 leading-relaxed pt-1">
                        {currentStage?.description}
                      </p>

                      {isAssignedToMe && (
                        <div className="pt-3">
                          {workflow.currentStage === 10 ? (
                            <div className="space-y-3 bg-black/20 p-3.5 rounded-xl border border-white/5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-300">PSID Fee Receipt</span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                  workflow.payment.status === 'Paid' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                )}>{workflow.payment.status}</span>
                              </div>

                              {workflow.payment.psid ? (
                                <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5">
                                  <span className="text-xs font-mono font-bold text-indigo-300">{workflow.payment.psid}</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">Generated PSID</span>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => handlePaymentAction(workflow.id, 'generate_psid')}
                                  className="w-full py-2 bg-indigo-500 text-white rounded-lg text-xs font-black uppercase hover:bg-indigo-400 transition-all cursor-pointer"
                                >
                                  Generate PSID
                                </button>
                              )}

                              {!workflow.payment.screenshotUrl && workflow.payment.psid && (
                                <button 
                                  onClick={() => handlePaymentAction(workflow.id, 'upload_screenshot')}
                                  className="w-full py-2 border border-dashed border-white/20 text-slate-200 rounded-lg text-xs font-bold hover:border-white hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Upload size={14} /> Upload Receipt Screenshot
                                </button>
                              )}

                              {workflow.payment.screenshotUrl && !workflow.payment.verifiedAt && (
                                <div className="space-y-2">
                                  <img src={workflow.payment.screenshotUrl} className="w-full h-16 object-cover rounded-lg" alt="receipt" referrerPolicy="no-referrer" />
                                  <button 
                                    onClick={() => handlePaymentAction(workflow.id, 'verify')}
                                    className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase hover:bg-emerald-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <ShieldCheck size={14} /> Verify Fee Payment
                                  </button>
                                </div>
                              )}

                              {workflow.payment.verifiedAt && (
                                <div className="p-2 bg-emerald-500/15 rounded-lg border border-emerald-500/20 flex items-center gap-2">
                                  <CheckCircle2 size={13} className="text-emerald-400" />
                                  <span className="text-[10px] font-bold text-emerald-300">Verified by {workflow.payment.verifiedBy}</span>
                                </div>
                              )}

                              <button 
                                onClick={() => handleCompleteStage(workflow.id, workflow.currentStage)}
                                disabled={workflow.payment.status !== 'Paid'}
                                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <Check size={16} /> Finalize Complete Application
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleCompleteStage(workflow.id, workflow.currentStage)}
                              className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              Complete Active Stage <Check size={16} />
                            </button>
                          )}
                        </div>
                      )}

                      {!isAssignedToMe && (
                        <div className="flex items-center gap-2 text-indigo-200 bg-white/5 p-3 rounded-xl border border-white/10 text-xs">
                          <User size={13} />
                          <span>Task assigned to: <strong className="text-white">{currentStage?.assignedEmployeeName}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* STAGES LIST TIMELINE */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-1">
                    Timeline stage-assignments & operational checks
                  </h4>
                  
                  <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 select-none">
                    {workflow.stages.map((stage) => {
                      const isActive = stage.stageId === workflow.currentStage;
                      const isCompleted = stage.status === 'Completed';

                      return (
                        <div 
                          key={stage.stageId} 
                          className={cn(
                            "p-3 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border transition-all",
                            isActive ? "bg-white/10 border-indigo-500/40 shadow-inner" : 
                            isCompleted ? "bg-white/5 border-white/5" : "bg-black/20 border-white/5 opacity-55"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0",
                              isCompleted ? "bg-emerald-500 text-slate-950" :
                              isActive ? "bg-indigo-500 text-white animate-pulse" : "bg-white/10 text-slate-400"
                            )}>
                              {isCompleted ? <Check size={14} /> : stage.stageId}
                            </div>
                            
                            <div className="space-y-0.5">
                              <h5 className="text-xs font-bold text-white">{stage.name}</h5>
                              {stage.completedAt && (
                                <p className="text-[9px] text-slate-400 font-mono">
                                  Done {new Date(stage.completedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Quick stage assignment dropdown (Admin/Manager can re-assign on the fly) */}
                          <div className="shrink-0">
                            {currentUser.role === 'Admin' || currentUser.role === 'Manager' ? (
                              <select
                                value={stage.assignedEmployeeId || ''}
                                onChange={(e) => handleUpdateStageAssignment(stage.stageId, e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg text-[10px] font-bold text-slate-350 p-1.5 focus:border-indigo-500 select-none outline-none max-w-[130px] cursor-pointer"
                              >
                                <option value="" className="bg-slate-900">Unassigned</option>
                                {employees.map(emp => (
                                  <option key={emp.id} value={emp.id} className="bg-slate-900">{emp.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 font-mono">
                                {stage.assignedEmployeeName}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              // Option to initialize workflow if none exists
              <div className="py-8 space-y-6">
                <div className="flex flex-col items-center text-center p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                  <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                    <Workflow size={36} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-black tracking-tight">Stage-by-Stage Tracking Offline</h4>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
                      There is no interactive multi-stage audit tracker active for this journal right now. Initialize one to start tracking HEC audit steps.
                    </p>
                  </div>

                  {!isInitializingWorkflow && (
                    <button
                      type="button"
                      onClick={() => setIsInitializingWorkflow(true)}
                      className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Plus size={16} />
                      Initialize HEC Tracker
                    </button>
                  )}
                </div>

                {isInitializingWorkflow && (
                  <form onSubmit={handleInitializeWorkflow} className="p-6 bg-black/20 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="text-xs font-black uppercase text-indigo-400">Tracker Initialization Flow</span>
                      <button 
                        type="button" 
                        onClick={() => setIsInitializingWorkflow(false)}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Default Username Sync</label>
                        <input 
                          type="text" 
                          required
                          value={newWorkflowU || ''}
                          onChange={(e) => setNewWorkflowU(e.target.value)}
                          className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Default Password Sync</label>
                        <input 
                          type="text" 
                          required
                          value={newWorkflowP || ''}
                          onChange={(e) => setNewWorkflowP(e.target.value)}
                          className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stage Assignments</h5>
                      <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                        {HEC_STAGES.map(stage => (
                          <div key={stage.id} className="flex justify-between items-center gap-2 text-xs bg-slate-900/50 p-2 rounded-lg">
                            <span className="text-[10px] font-bold text-slate-400">Stg {stage.id}: {stage.name}</span>
                            <select 
                              required
                              className="bg-black/50 border border-white/10 text-[10px] font-semibold text-white rounded p-1 outline-none cursor-pointer"
                              value={newWorkflowAssignments[stage.id] || ''}
                              onChange={(e) => setNewWorkflowAssignments({
                                ...newWorkflowAssignments,
                                [stage.id]: e.target.value
                              })}
                            >
                              <option value="">Select Employee...</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id} className="bg-slate-900">{emp.name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsInitializingWorkflow(false)}
                        className="flex-1 py-2 bg-slate-900 text-slate-400 text-xs font-bold rounded-lg hover:text-white transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-indigo-500 transition-colors cursor-pointer"
                      >
                        Start Tracker
                      </button>
                    </div>

                  </form>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
