import React from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Zap,
  Lock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Journal, JournalHealthScore } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface JournalHealthDashboardProps {
  journal: Journal;
}

export const JournalHealthDashboard: React.FC<JournalHealthDashboardProps> = ({ journal }) => {
  // Default health calculation logic if not pre-calculated
  const health: JournalHealthScore = journal.healthScore || {
    totalScore: 0,
    components: {
      issn: !!(journal.issnPrint || journal.issnOnline),
      doi: !!(journal.doiId || journal.issnPrint), // placeholder logic
      ojs: !!journal.ojsVersion,
      indexed: false,
      security: !!journal.sslStatus && journal.sslStatus === 'Active'
    },
    suggestions: [
      !journal.issnPrint && !journal.issnOnline && "Register for Print or Online ISSN to improve credibility.",
      !journal.ojsVersion && "Upgrade OJS to the latest stable version for security patches.",
      journal.sslStatus !== 'Active' && "Activate SSL certificate to secure your journal portal.",
      "Submit your journal to DOAJ and HEC for higher recognition."
    ].filter(Boolean) as string[]
  };

  // Re-calculate total score based on components for this demo
  const componentCount = Object.values(health.components).filter(Boolean).length;
  const totalScore = Math.round((componentCount / 5) * 100);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-rose-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-50 border-emerald-100";
    if (score >= 50) return "bg-amber-50 border-amber-100";
    return "bg-rose-50 border-rose-100";
  };

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <div className={cn("p-8 rounded-[2rem] border transition-all shadow-sm", getScoreBg(totalScore))}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm",
              totalScore >= 80 ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
            )}>
              {totalScore >= 80 ? <ShieldCheck size={32} /> : <ShieldAlert size={32} />}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Journal Health Score</h3>
              <p className="text-sm font-medium text-slate-500">Real-time operational analysis</p>
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-4xl font-black tracking-tighter", getScoreColor(totalScore))}>
              {totalScore}%
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overall Health</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-white/50 rounded-full overflow-hidden mb-8 border border-white/20">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${totalScore}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full shadow-sm",
              totalScore >= 80 ? "bg-emerald-500" : "bg-amber-500"
            )}
          />
        </div>

        {/* Components Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(health.components).map(([key, value]) => (
            <div key={key} className="bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white/40 flex flex-col items-center gap-2 text-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                value ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
              )}>
                {value ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">{key}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Suggestion Box */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-xs">
            <Zap size={14} />
            Optimization Suggestions
          </div>
          <div className="space-y-3">
            {health.suggestions.map((suggestion, idx) => (
              <div key={idx} className="flex items-start gap-3 group">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-200 shrink-0 group-hover:bg-indigo-400 transition-colors" />
                <p className="text-xs text-slate-600 leading-relaxed font-medium">{suggestion}</p>
              </div>
            ))}
            {health.suggestions.length === 0 && (
              <div className="text-center py-4">
                <p className="text-xs text-emerald-600 font-bold">Your journal health is optimized! 🚀</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 font-black uppercase tracking-widest text-xs">
            <Activity size={14} />
            Immediate Improvements
          </div>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-white transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center">
                  <ExternalLink size={16} />
                </div>
                <span className="text-xs font-bold">Request ISSN Registration</span>
              </div>
              <ChevronRight size={14} className="text-slate-500 group-hover:text-white transition-all" />
            </button>
            <button className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-white transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center">
                  <Lock size={16} />
                </div>
                <span className="text-xs font-bold">Configure Secure Vault</span>
              </div>
              <ChevronRight size={14} className="text-slate-500 group-hover:text-white transition-all" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
