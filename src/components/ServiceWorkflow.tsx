import React from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  FileUp, 
  MessageSquare, 
  AlertCircle,
  ChevronRight,
  MoreVertical,
  Paperclip,
  User,
  Shield,
  Briefcase
} from 'lucide-react';
import { 
  ClientService, 
  ServiceStep, 
  UserRole 
} from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface ServiceWorkflowProps {
  clientService: ClientService;
  steps: ServiceStep[];
  userRole: UserRole;
  currentUserId: string;
  onChecklistUpdate?: (stepId: string, checklistId: string, value: any) => void;
  onTaskUpdate?: (stepId: string, taskId: string, status: string, notes?: string, proofUrl?: string) => void;
  onStepComplete?: (stepId: string) => void;
}

export const ServiceWorkflow: React.FC<ServiceWorkflowProps> = ({
  clientService,
  steps,
  userRole,
  currentUserId,
  onChecklistUpdate,
  onTaskUpdate,
  onStepComplete
}) => {
  const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentStepId = steps[clientService.currentStepIndex]?.id;

  return (
    <div className="space-y-8">
      {/* Workflow Progress Bar */}
      <div className="relative flex items-center justify-between px-4">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 -z-10" />
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-indigo-500 transition-all duration-500 -translate-y-1/2 -z-10"
          style={{ width: `${(clientService.currentStepIndex / (steps.length - 1)) * 100}%` }}
        />
        
        {sortedSteps.map((step, idx) => {
          const isCompleted = idx < clientService.currentStepIndex || clientService.stepProgress[step.id]?.status === 'completed';
          const isCurrent = idx === clientService.currentStepIndex;
          
          return (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div 
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300",
                  isCompleted ? "bg-emerald-500 border-emerald-100 text-white" :
                  isCurrent ? "bg-indigo-600 border-indigo-100 text-white shadow-lg shadow-indigo-200" :
                  "bg-white border-slate-100 text-slate-400"
                )}
              >
                {isCompleted ? <CheckCircle2 size={20} /> : <span className="text-sm font-bold">{idx + 1}</span>}
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                isCurrent ? "text-indigo-600" : "text-slate-400"
              )}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current Step Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Client Checklist Container */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                <FileUp size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Client Checklist</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Required Documents & Data</p>
              </div>
            </div>
            {clientService.stepProgress[currentStepId]?.status === 'completed' && (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase">Step Verified</span>
            )}
          </div>
          
          <div className="p-6 space-y-4">
            {steps[clientService.currentStepIndex]?.clientChecklist.map((item) => {
              const progress = clientService.stepProgress[currentStepId]?.clientChecklist?.[item.id];
              const isCompleted = progress?.status === 'completed';
              
              return (
                <div 
                  key={item.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all",
                    isCompleted ? "bg-emerald-50/50 border-emerald-100" : "bg-white border-slate-100 hover:border-slate-200"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <button 
                      disabled={userRole !== 'Client' && userRole !== 'Admin'}
                      onClick={() => onChecklistUpdate?.(currentStepId, item.id, { status: isCompleted ? 'pending' : 'completed' })}
                      className={cn(
                        "mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 text-transparent"
                      )}
                    >
                      <CheckCircle2 size={12} />
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-slate-900">{item.label}</span>
                        {item.required && (
                          <span className="text-[8px] font-black text-rose-500 uppercase">Required</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                      
                      {item.type === 'document' && (
                        <div className="mt-3 flex items-center gap-2">
                          {progress?.fileUrl ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 rounded-lg text-xs font-medium text-slate-600 max-w-xs truncate">
                              <Paperclip size={12} />
                              <span className="truncate">{progress.fileUrl.split('/').pop()}</span>
                              <a href={progress.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline ml-auto">View</a>
                            </div>
                          ) : (
                            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100/50">
                              <FileUp size={14} />
                              Upload Document
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Employee Tasks Container */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-indigo-50/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                <Briefcase size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Process & Execution</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Internal Workflow Status</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {steps[clientService.currentStepIndex]?.employeeTasks.map((task) => {
              const progress = clientService.stepProgress[currentStepId]?.employeeTasks?.[task.id];
              const isCompleted = progress?.status === 'completed';
              const needsRevision = progress?.status === 'revision';
              
              return (
                <div 
                  key={task.id}
                  className={cn(
                    "p-5 rounded-2xl border transition-all",
                    isCompleted ? "bg-emerald-50/50 border-emerald-100" : 
                    needsRevision ? "bg-rose-50/50 border-rose-100" :
                    "bg-white border-slate-100"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "mt-1 shrink-0 w-8 h-8 rounded-xl flex items-center justify-center",
                      isCompleted ? "bg-emerald-100 text-emerald-600" :
                      needsRevision ? "bg-rose-100 text-rose-600" :
                      "bg-slate-100 text-slate-400"
                    )}>
                      {isCompleted ? <CheckCircle2 size={16} /> : 
                       needsRevision ? <AlertCircle size={16} /> :
                       <Circle size={16} />}
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{task.label}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                              <Shield size={10} /> {task.department}
                            </span>
                            <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                              <Clock size={10} /> {task.daysToComplete} Days
                            </span>
                          </div>
                        </div>
                        {userRole !== 'Client' && (
                          <div className="flex items-center gap-2">
                             <button 
                               onClick={() => onTaskUpdate?.(currentStepId, task.id, isCompleted ? 'pending' : 'completed')}
                               className={cn(
                                 "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                                 isCompleted ? "bg-white text-slate-400 border border-slate-200" : "bg-emerald-600 text-white shadow-sm"
                               )}
                             >
                               {isCompleted ? 'Rollback' : 'Approve Step'}
                             </button>
                             {isCompleted && (
                               <button 
                                 onClick={() => onTaskUpdate?.(currentStepId, task.id, 'revision')}
                                 className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                               >
                                 <AlertCircle size={16} />
                               </button>
                             )}
                          </div>
                        )}
                      </div>

                      {progress?.notes && (
                        <div className="bg-white/50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600 leading-relaxed italic">
                          "{progress.notes}"
                        </div>
                      )}

                      {progress?.proofUrl && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100/50 rounded-xl border border-emerald-100 text-[10px] font-bold text-emerald-700">
                          <Paperclip size={12} />
                          Proof Uploaded: 
                          <a href={progress.proofUrl} target="_blank" rel="noreferrer" className="underline">View Document</a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {userRole !== 'Client' && (
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => onStepComplete?.(currentStepId)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200"
              >
                Proceed to next step <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
