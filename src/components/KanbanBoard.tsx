import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical, 
  User as UserIcon,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { Task, TaskStatus } from '../types';
import { cn } from '../lib/utils';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'pending', label: 'Pending', color: 'bg-slate-100 text-slate-600' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-indigo-100 text-indigo-600' },
  { id: 'review', label: 'Review', color: 'bg-amber-100 text-amber-600' },
  { id: 'rework', label: 'Rework', color: 'bg-rose-100 text-rose-600' },
  { id: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-600' }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onTaskClick, onStatusChange }) => {
  const [filterService, setFilterService] = React.useState<string>('All');
  
  const filteredTasks = filterService === 'All' ? tasks : tasks.filter(t => t.serviceType === filterService);
  const getTasksByStatus = (status: TaskStatus) => filteredTasks.filter(t => t.status === status);

  const services = ['All', ...Array.from(new Set(tasks.map(t => t.serviceType)))];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-rose-600 bg-rose-50 border-rose-100';
      case 'high': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'medium': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Service Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {services.map((service, idx) => (
          <button
            key={`${service}-${idx}`}
            onClick={() => setFilterService(service)}
            className={cn(
              "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
              filterService === service 
                ? "bg-slate-900 text-white shadow-lg" 
                : "bg-white text-slate-500 border border-slate-100 hover:border-indigo-200"
            )}
          >
            {service}
          </button>
        ))}
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide min-h-[calc(100vh-320px)]">
      {COLUMNS.map((column) => (
        <div key={column.id} className="flex-shrink-0 w-80">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider", column.color)}>
                {column.label}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {getTasksByStatus(column.id).length}
              </span>
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreVertical size={16} />
            </button>
          </div>

          <div 
            className="space-y-4 min-h-[500px] p-2 bg-slate-50/50 rounded-3xl border border-slate-100/50"
            onDragOver={(e: React.DragEvent) => e.preventDefault()}
            onDrop={(e: React.DragEvent) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData('taskId');
              if (taskId) onStatusChange(taskId, column.id);
            }}
          >
            <AnimatePresence mode="popLayout">
              {getTasksByStatus(column.id).map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  draggable
                  onDragStart={(e: any) => e.dataTransfer.setData('taskId', task.id)}
                  onClick={() => onTaskClick(task)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={cn("px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border", getPriorityColor(task.priority))}>
                      {task.priority}
                    </span>
                    <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all">
                      <MoreVertical size={14} />
                    </button>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">
                        {task.assignedToName?.charAt(0) || 'U'}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        <Calendar size={10} />
                        {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                      {task.points > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                          <CheckCircle2 size={10} />
                          {task.points} pts
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Warning for overdue */}
                  {new Date(task.dueDate) < new Date() && task.status !== 'completed' && (
                    <div className="mt-3 flex items-center gap-1.5 text-[9px] font-bold text-rose-500 bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                      <AlertTriangle size={12} />
                      OVERDUE
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {getTasksByStatus(column.id).length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-300">
                <Clock size={24} className="opacity-20" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">No Tasks</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);
};
