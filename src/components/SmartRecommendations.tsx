import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Globe,
  Building2,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Shuffle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Recommendation } from '../services/recommendationService';
import { cn } from '../lib/utils';

interface SmartRecommendationsProps {
  recommendations: Recommendation[];
  onSelectService: (service: any) => void;
}

export const SmartRecommendations: React.FC<SmartRecommendationsProps> = ({ 
  recommendations,
  onSelectService
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const allRecommendations = useMemo(() => {
    const high = recommendations.filter(r => r.priority === 'high');
    const others = recommendations.filter(r => r.priority !== 'high');
    return [...high, ...others];
  }, [recommendations]);

  if (allRecommendations.length === 0) return null;

  const currentRec = allRecommendations[currentIndex % allRecommendations.length];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allRecommendations.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + allRecommendations.length) % allRecommendations.length);
  };

  const handleShuffle = () => {
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * allRecommendations.length);
    } while (nextIndex === currentIndex && allRecommendations.length > 1);
    setCurrentIndex(nextIndex);
  };

  const getIcon = (stage: string) => {
    switch (stage) {
      case 'Client': return <Building2 size={16} />;
      case 'Publisher': return <Globe size={16} />;
      case 'Domain': return <Globe size={16} />;
      case 'Journal': return <BookOpen size={16} />;
      default: return <Sparkles size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Smart Recommendations</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Next Best Actions for your Journal</p>
          </div>
        </div>

        {allRecommendations.length > 1 && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleShuffle}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
              title="Shuffle"
            >
              <Shuffle size={18} />
            </button>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <button 
                onClick={handlePrev}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-[10px] font-bold text-slate-400 px-1">
                {currentIndex + 1} / {allRecommendations.length}
              </span>
              <button 
                onClick={handleNext}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {currentRec.priority === 'high' ? (
              <div
                className="group relative bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer overflow-hidden"
                onClick={() => onSelectService(currentRec.service)}
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp size={80} className="text-indigo-600" />
                </div>

                <div className="flex items-start justify-between mb-6">
                  <div className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                    "bg-indigo-50 text-indigo-600"
                  )}>
                    {getIcon(currentRec.stage)}
                    {currentRec.stage} Stage
                  </div>
                  {currentRec.isEligible === false ? (
                    <div className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase flex items-center gap-1.5">
                      <ShieldCheck size={12} />
                      Pending
                    </div>
                  ) : (
                    <div className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase">
                      High Priority
                    </div>
                  )}
                </div>

                <h4 className={cn(
                  "text-xl font-bold mb-2 transition-colors",
                  currentRec.isEligible === false ? "text-slate-400" : "text-slate-900 group-hover:text-indigo-600"
                )}>
                  {currentRec.title}
                </h4>
                <p className={cn(
                  "text-base mb-6 max-w-2xl",
                  currentRec.isEligible === false ? "text-slate-300" : "text-slate-500"
                )}>
                  {currentRec.description}
                </p>

                <div className={cn(
                  "rounded-2xl p-4 mb-6",
                  currentRec.isEligible === false ? "bg-slate-50/50" : "bg-slate-50"
                )}>
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className={cn("shrink-0 mt-0.5", currentRec.isEligible === false ? "text-slate-300" : "text-indigo-500")} />
                    <p className={cn("text-sm font-medium italic", currentRec.isEligible === false ? "text-slate-400" : "text-slate-600")}>
                      "{currentRec.reason}"
                    </p>
                  </div>
                </div>

                {currentRec.requirements && currentRec.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {currentRec.requirements.map((req, idx) => (
                      <span key={`${req}-${idx}`} className={cn(
                        "text-xs px-3 py-1 rounded-lg font-medium flex items-center gap-1.5",
                        currentRec.isEligible === false ? "bg-slate-50 text-slate-300" : "bg-indigo-50 text-indigo-600"
                      )}>
                        {currentRec.isEligible === false ? <X size={12} /> : <Check size={12} />}
                        {req}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className={cn("text-sm font-bold", currentRec.isEligible === false ? "text-slate-300" : "text-indigo-600")}>
                    {currentRec.isEligible === false ? "Requirements Pending" : "Get Started Now"}
                  </span>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    currentRec.isEligible === false ? "bg-slate-50 text-slate-300" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                  )}>
                    {currentRec.isEligible === false ? <ShieldCheck size={20} /> : <ArrowRight size={20} />}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="group bg-white border border-slate-200 rounded-3xl p-8 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer"
                onClick={() => onSelectService(currentRec.service)}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    {getIcon(currentRec.stage)}
                    {currentRec.stage} Stage
                  </div>
                  {currentRec.priority === 'medium' && (
                    <div className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">Recommended</div>
                  )}
                </div>

                <h4 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  {currentRec.title}
                </h4>
                <p className="text-base text-slate-500 mb-8 max-w-2xl">
                  {currentRec.description}
                </p>

                <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Suggested Next Action</span>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    <span>Learn More</span>
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
