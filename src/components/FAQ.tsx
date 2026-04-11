import React, { useState } from 'react';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Shield, 
  Globe, 
  DollarSign, 
  FileText,
  Mail,
  Phone,
  Clock,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { geminiService } from '../services/geminiService';
import { Sparkles, Send, Loader2 } from 'lucide-react';

const FAQ_DATA = [
  {
    category: 'General',
    icon: BookOpen,
    questions: [
      {
        id: 'g1',
        question: 'What is Host A Journal CRM?',
        answer: 'Host A Journal CRM is a comprehensive management system designed for academic publishers to track journals, ISSN requests, HEC applications, and client interactions efficiently. It centralizes all operations from domain management to indexing and financial tracking.'
      },
      {
        id: 'g2',
        question: 'How do I get started?',
        answer: 'New users can follow the "Quick Start" workflow available in the header. This guided process helps you set up a client, register a domain, and create your first journal entry in a few simple steps.'
      },
      {
        id: 'g3',
        question: 'What roles are available in the system?',
        answer: 'The system supports four main roles: Admin (full access), Manager (operational oversight), Employee (daily tasks and management), and Client (view-only access to their own journals and services).'
      }
    ]
  },
  {
    category: 'Publishing & ISSN',
    icon: FileText,
    questions: [
      {
        id: 'p1',
        question: 'How do I request an ISSN?',
        answer: 'Navigate to the ISSN Requests section and click "New Request". Fill in the journal details, publisher information, and frequency. You can track the status of your application (Pending, Approved, Rejected) directly from the list view.'
      },
      {
        id: 'p2',
        question: 'What is the difference between Print and Online ISSN?',
        answer: 'A Print ISSN is for physical publications, while an Online ISSN (e-ISSN) is for digital versions. Many journals apply for both to ensure full coverage across all distribution formats.'
      },
      {
        id: 'p3',
        question: 'How do I manage journal indexing?',
        answer: 'In the Indexing Agencies section, you can manage different indexing bodies. For each journal, you can track which agencies it has applied to and the current status of those applications.'
      }
    ]
  },
  {
    category: 'Domains & Hosting',
    icon: Globe,
    questions: [
      {
        id: 'd1',
        question: 'How do I track domain renewals?',
        answer: 'The Domains section provides a clear view of all registered domains and their expiry dates. The system automatically highlights domains nearing expiry to ensure timely renewals.'
      },
      {
        id: 'd2',
        question: 'Where can I find hosting credentials?',
        answer: 'Hosting credentials (EPP codes, panel links, etc.) are stored securely within the Domain Manager. Access is restricted based on user roles to ensure security.'
      }
    ]
  },
  {
    category: 'Finance & Points',
    icon: DollarSign,
    questions: [
      {
        id: 'f1',
        question: 'How are points calculated?',
        answer: 'Points are awarded to employees for completing tasks, managing journals, and successful ISSN/HEC approvals. These points contribute to the staff leaderboard and performance reviews.'
      },
      {
        id: 'f2',
        question: 'How do I generate an invoice?',
        answer: 'Invoices can be generated from the Invoices section or directly from an ISSN Request detail page. You can track payment status (Paid, Unpaid, Overdue) and send reminders to clients.'
      },
      {
        id: 'f3',
        question: 'Can I track daily expenses?',
        answer: 'Yes, the Expenses section allows Admins and Managers to record daily operational costs, categorized by type (Office, Marketing, Travel, etc.), with support for receipt attachments.'
      }
    ]
  },
  {
    category: 'Support & Security',
    icon: Shield,
    questions: [
      {
        id: 's1',
        question: 'Is my data secure?',
        answer: 'We use industry-standard encryption and Firebase security rules to ensure that data is only accessible to authorized users. Role-based access control (RBAC) is strictly enforced across all modules.'
      },
      {
        id: 's2',
        question: 'What should I do if I forget my password?',
        answer: 'Please contact your system administrator to reset your password. For security reasons, password resets must be handled through the official administrative channels.'
      }
    ]
  }
];

export const FAQ: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>('g1');
  const [activeCategory, setActiveCategory] = useState('All');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setIsAiLoading(true);
    setAiAnswer(null);
    try {
      const response = await geminiService.generateTaskDescription(aiQuestion, "FAQ Support");
      setAiAnswer(response);
    } catch (error) {
      console.error("AI FAQ error:", error);
    }
    setIsAiLoading(false);
  };

  const categories = ['All', ...FAQ_DATA.map(c => c.category)];

  const filteredFaqs = FAQ_DATA.map(cat => ({
    ...cat,
    questions: cat.questions.filter(q => 
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => 
    (activeCategory === 'All' || cat.category === activeCategory) && 
    cat.questions.length > 0
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-bold border border-indigo-100 uppercase tracking-wider">
          <HelpCircle size={18} />
          Help Center
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">How can we help you today?</h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Search our comprehensive knowledge base for answers to common questions about managing your journals, ISSN requests, and more.
        </p>
      </div>

      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search for questions, keywords, or topics..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all border",
              activeCategory === cat 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20" 
                : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-12 pt-4">
        {/* AI Assistant Section */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                <Sparkles size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black">AI Support Assistant</h2>
                <p className="text-indigo-100 text-sm">Ask anything about the CRM or publishing workflows.</p>
              </div>
            </div>

            <form onSubmit={handleAiAsk} className="flex gap-2">
              <input 
                type="text"
                placeholder="How do I manage DOI applications?"
                className="flex-1 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl outline-none focus:ring-2 focus:ring-white/50 placeholder:text-indigo-200 text-white"
                value={aiQuestion}
                onChange={e => setAiQuestion(e.target.value)}
              />
              <button 
                type="submit"
                disabled={isAiLoading || !aiQuestion.trim()}
                className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black hover:bg-indigo-50 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isAiLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                Ask AI
              </button>
            </form>

            <AnimatePresence>
              {aiAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6"
                >
                  <div className="flex items-center gap-2 mb-3 text-indigo-200 text-xs font-black uppercase tracking-widest">
                    <Sparkles size={14} />
                    AI Response
                  </div>
                  <p className="text-white leading-relaxed whitespace-pre-wrap text-sm">
                    {aiAnswer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {filteredFaqs.map((category) => (
          <div key={category.category} className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <category.icon size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{category.category}</h2>
            </div>

            <div className="grid gap-4">
              {category.questions.map((faq) => (
                <div 
                  key={faq.id}
                  className={cn(
                    "bg-white border rounded-2xl transition-all overflow-hidden",
                    openId === faq.id ? "border-indigo-200 shadow-md" : "border-slate-100 hover:border-slate-200 shadow-sm"
                  )}
                >
                  <button 
                    onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left group"
                  >
                    <span className={cn(
                      "font-bold transition-colors",
                      openId === faq.id ? "text-indigo-600" : "text-slate-700 group-hover:text-slate-900"
                    )}>
                      {faq.question}
                    </span>
                    {openId === faq.id ? (
                      <ChevronUp size={20} className="text-indigo-500" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400 group-hover:text-slate-600" />
                    )}
                  </button>
                  <AnimatePresence>
                    {openId === faq.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-50 pt-4">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-3xl p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tight">Still have questions?</h2>
            <p className="text-slate-400 max-w-md">
              Our support team is available Monday through Friday to help you with any technical or operational issues.
            </p>
            <div className="flex flex-wrap gap-6 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail size={16} className="text-indigo-400" />
                info@hostajournal.com
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone size={16} className="text-indigo-400" />
                +92 300 480023
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} className="text-indigo-400" />
                9:00 AM - 6:00 PM PKT
              </div>
            </div>
          </div>
          <button className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black hover:bg-slate-100 transition-all shadow-xl whitespace-nowrap">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};
