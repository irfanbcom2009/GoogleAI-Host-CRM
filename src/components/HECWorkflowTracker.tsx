import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  User, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  FileCheck, 
  CreditCard, 
  Lock, 
  Eye, 
  EyeOff,
  Plus,
  ArrowLeft,
  Search,
  History,
  ShieldCheck,
  Upload,
  Check,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs, where, Timestamp } from 'firebase/firestore';
import { HECApplicationWorkflow, HECWorkflowStage, User as UserType, Journal, Client } from '../types';
import { cn } from '../lib/utils';
import { Modal } from './Modal';

interface HECWorkflowTrackerProps {
  currentUser: UserType;
  onBack?: () => void;
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

export const HECWorkflowTracker: React.FC<HECWorkflowTrackerProps> = ({ currentUser, onBack }) => {
  const [workflows, setWorkflows] = useState<HECApplicationWorkflow[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<HECApplicationWorkflow | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newWorkflow, setNewWorkflow] = useState({
    journalId: '',
    assignments: {} as Record<number, string>,
    username: '',
    password: ''
  });

  useEffect(() => {
    const unsubWorkflows = onSnapshot(collection(db, 'hec_workflows'), (snapshot) => {
      setWorkflows(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HECApplicationWorkflow[]);
      setLoading(false);
    });

    const unsubJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Journal[]);
    });

    const unsubEmployees = onSnapshot(query(collection(db, 'users'), where('role', 'in', ['Employee', 'Manager', 'Admin'])), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserType[]);
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[]);
    });

    return () => {
      unsubWorkflows();
      unsubJournals();
      unsubEmployees();
      unsubClients();
    };
  }, []);

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    const journal = journals.find(j => j.id === newWorkflow.journalId);
    if (!journal) return;

    const stages: HECWorkflowStage[] = HEC_STAGES.map(stage => ({
      stageId: stage.id,
      name: stage.name,
      description: stage.description,
      assignedEmployeeId: newWorkflow.assignments[stage.id],
      assignedEmployeeName: employees.find(e => e.id === newWorkflow.assignments[stage.id])?.name || 'Unassigned',
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
          username: newWorkflow.username,
          password: newWorkflow.password
        },
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id
      });
      setIsNewModalOpen(false);
    } catch (error) {
      console.error('Error creating workflow:', error);
    }
  };

  const handleCompleteStage = async (workflowId: string, stageId: number) => {
    const workflow = workflows.find(w => w.id === workflowId);
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
        // Double check payment for completion
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

  const handlePaymentAction = async (workflowId: string, action: 'generate_psid' | 'upload_screenshot' | 'verify') => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return;

    const updates: any = { ...workflow.payment };

    if (action === 'generate_psid') {
      updates.psid = `HEC-${Math.floor(100000 + Math.random() * 900000)}`;
    } else if (action === 'upload_screenshot') {
      // Mock upload for now
      updates.screenshotUrl = "https://picsum.photos/seed/payment/800/600";
    } else if (action === 'verify') {
      updates.status = 'Paid';
      updates.verifiedAt = new Date().toISOString();
      updates.verifiedBy = currentUser.name;
      updates.verifiedById = currentUser.id;
    }

    try {
      const finalUpdates: any = { payment: updates };
      
      // Check for total completion
      const allStagesDone = workflow.stages.every(s => s.status === 'Completed');
      if (allStagesDone && updates.status === 'Paid' && updates.verifiedAt) {
          finalUpdates.status = 'Completed';
      }

      await updateDoc(doc(db, 'hec_workflows', workflowId), finalUpdates);
    } catch (error) {
      console.error('Error updating payment:', error);
    }
  };

  const filteredWorkflows = workflows.filter(w => 
    w.journalTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-end gap-3 px-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search application..."
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-2xl w-64 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
          <button 
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-2xl text-xs font-bold hover:bg-black transition-all shadow-lg shadow-slate-200"
          >
            <Plus size={18} /> New Workflow
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
            <Loader2 className="animate-spin" size={40} />
            <p className="font-bold">Syncing workflow data...</p>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-slate-300">
            <ClipboardList size={64} />
            <p className="text-xl font-bold">No applications tracked yet.</p>
          </div>
        ) : filteredWorkflows.map(workflow => {
          const currentStage = workflow.stages.find(s => s.stageId === workflow.currentStage);
          const isAssignedToMe = currentStage?.assignedEmployeeId === currentUser.id || currentUser.role === 'Admin';
          const progress = (workflow.stages.filter(s => s.status === 'Completed').length / 10) * 100;

          return (
            <motion.div 
              layoutId={workflow.id}
              key={workflow.id}
              className="bg-white rounded-[2rem] border border-slate-200 p-6 space-y-6 shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full w-fit">
                    <span className="text-[10px] font-black uppercase tracking-widest">Stage {workflow.currentStage} of 10</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 leading-tight">{workflow.journalTitle}</h3>
                  <p className="text-sm font-medium text-slate-500">{workflow.clientName}</p>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  workflow.status === 'Completed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                )}>
                  {workflow.status}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-indigo-600 rounded-full"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>

              {/* Active Stage Info */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Active Task</p>
                    <p className="text-sm font-bold text-slate-900">{currentStage?.name}</p>
                  </div>
                </div>
                {isAssignedToMe && (
                   <div className="pt-2">
                     <p className="text-xs text-slate-500 mb-3 leading-relaxed">{currentStage?.description}</p>
                     
                     {/* Credential Visibility for assigned employee */}
                     <div className="mb-4 p-3 bg-indigo-100/50 rounded-xl border border-indigo-200">
                       <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2 text-indigo-700">
                           <Lock size={14} />
                           <span className="text-[10px] font-bold uppercase">HEC Credentials</span>
                         </div>
                         <button onClick={() => setShowPassword(!showPassword)} className="text-indigo-600">
                           {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                         </button>
                       </div>
                       <div className="space-y-1">
                         <p className="text-xs font-mono text-indigo-900 selection:bg-indigo-300">U: {workflow.loginCredentials?.username}</p>
                         <p className="text-xs font-mono text-indigo-900 selection:bg-indigo-300">
                            P: {showPassword ? workflow.loginCredentials?.password : '••••••••'}
                         </p>
                       </div>
                     </div>

                     {workflow.currentStage === 10 ? (
                       <div className="space-y-3">
                         <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Payment Info</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                                    workflow.payment.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                )}>{workflow.payment.status}</span>
                            </div>
                            
                            {workflow.payment.psid ? (
                                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span className="text-xs font-mono font-bold text-indigo-600">{workflow.payment.psid}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Generated PSID</span>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => handlePaymentAction(workflow.id, 'generate_psid')}
                                    className="w-full py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all"
                                >
                                    Generate PSID
                                </button>
                            )}

                            {!workflow.payment.screenshotUrl && workflow.payment.psid && (
                                <button 
                                    onClick={() => handlePaymentAction(workflow.id, 'upload_screenshot')}
                                    className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Upload size={14} /> Upload Screenshot
                                </button>
                            )}

                            {workflow.payment.screenshotUrl && !workflow.payment.verifiedAt && (
                                <div className="space-y-2">
                                    <div className="relative group/img overflow-hidden rounded-xl border border-slate-200">
                                        <img src={workflow.payment.screenshotUrl} className="w-full h-20 object-cover" alt="payment" referrerPolicy="no-referrer" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-all">
                                            <a href={workflow.payment.screenshotUrl} target="_blank" className="text-white text-[10px] font-bold underline">View Full</a>
                                        </div>
                                    </div>
                                    {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                                        <button 
                                            onClick={() => handlePaymentAction(workflow.id, 'verify')}
                                            className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <ShieldCheck size={14} /> Verify Payment
                                        </button>
                                    )}
                                </div>
                            )}

                            {workflow.payment.verifiedAt && (
                                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-emerald-600" />
                                    <span className="text-[10px] font-bold text-emerald-700">Verified by {workflow.payment.verifiedBy}</span>
                                </div>
                            )}
                         </div>

                         <button 
                           onClick={() => handleCompleteStage(workflow.id, workflow.currentStage)}
                           disabled={workflow.payment.status !== 'Paid'}
                           className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                         >
                           <Check size={18} /> Finalize Application
                         </button>
                       </div>
                     ) : (
                       <button 
                         onClick={() => handleCompleteStage(workflow.id, workflow.currentStage)}
                         className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                       >
                         Complete Stage Review <ArrowRight size={18} />
                       </button>
                     )}
                   </div>
                )}
                {!isAssignedToMe && (
                    <div className="flex items-center gap-2 text-slate-400 bg-slate-100/50 p-3 rounded-xl">
                        <User size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-tight">Assigned to: {currentStage?.assignedEmployeeName}</span>
                    </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button 
                  onClick={() => setSelectedWorkflow(workflow)}
                  className="text-[10px] font-bold text-indigo-600 underline underline-offset-4 uppercase tracking-widest hover:text-indigo-800"
                >
                  View Full Timeline
                </button>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  Created {new Date(workflow.createdAt).toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* New Workflow Modal */}
      <Modal 
        isOpen={isNewModalOpen} 
        onClose={() => setIsNewModalOpen(false)}
        title="Initialize HEC Workflow"
        maxWidth="3xl"
      >
        <form onSubmit={handleCreateWorkflow} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Select Journal</label>
              <select 
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={newWorkflow.journalId}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, journalId: e.target.value })}
              >
                <option value="">Select a Journal...</option>
                {journals.map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">HEC Login Username</label>
              <input 
                type="text"
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={newWorkflow.username}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">HEC Login Password</label>
              <input 
                type="password"
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={newWorkflow.password}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, password: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-sm font-black text-slate-900 uppercase">Stage Assignments</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {HEC_STAGES.map(stage => (
                <div key={stage.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-indigo-600 uppercase">Stage {stage.id}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{stage.name}</span>
                  </div>
                  <select 
                    required
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                    value={newWorkflow.assignments[stage.id] || ''}
                    onChange={(e) => setNewWorkflow({
                        ...newWorkflow,
                        assignments: { ...newWorkflow.assignments, [stage.id]: e.target.value }
                    })}
                  >
                    <option value="">Assign Employee...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
             <button 
              type="button" 
              onClick={() => setIsNewModalOpen(false)}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              Start Workflow
            </button>
          </div>
        </form>
      </Modal>

      {/* Timeline Modal */}
      <Modal
        isOpen={!!selectedWorkflow}
        onClose={() => setSelectedWorkflow(null)}
        title="Application History & Timeline"
        maxWidth="3xl"
      >
        {selectedWorkflow && (
            <div className="space-y-8 py-4">
                <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                    <div>
                        <h4 className="text-xl font-black text-slate-900">{selectedWorkflow.journalTitle}</h4>
                        <p className="text-sm text-slate-500">{selectedWorkflow.clientName}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Status</p>
                        <p className={cn(
                            "text-sm font-black",
                            selectedWorkflow.status === 'Completed' ? "text-emerald-600" : "text-amber-600"
                        )}>{selectedWorkflow.status}</p>
                    </div>
                </div>

                <div className="relative space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {selectedWorkflow.stages.map((stage, idx) => (
                        <div key={stage.stageId} className="relative flex gap-6 items-start group">
                            <div className={cn(
                                "z-10 w-10 h-10 rounded-full border-4 border-white shadow-md flex items-center justify-center transition-all shrink-0",
                                stage.status === 'Completed' ? "bg-emerald-500 text-white" : 
                                stage.stageId === selectedWorkflow.currentStage ? "bg-indigo-600 text-white animate-pulse" :
                                "bg-slate-200 text-slate-400 group-hover:bg-slate-300"
                            )}>
                                {stage.status === 'Completed' ? <Check size={18} /> : <span>{stage.stageId}</span>}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-start">
                                    <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">{stage.name}</h5>
                                    {stage.completedAt && (
                                        <span className="text-[10px] font-bold text-slate-400">{new Date(stage.completedAt).toLocaleDateString()}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                    <User size={12} />
                                    <span>{stage.assignedEmployeeName}</span>
                                    {stage.status === 'Completed' && (
                                        <>
                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span className="text-emerald-600 font-bold">Done</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-6 border-t border-slate-100">
                    <button 
                        onClick={() => setSelectedWorkflow(null)}
                        className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all border border-slate-100"
                    >
                        Close History
                    </button>
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
};
