import React, { useState } from 'react';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Shield, 
  ShieldCheck,
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
        answer: 'Host A Journal CRM is an advanced Enterprise Resource Planning (ERP) and Customer Relationship Management (CRM) solution specifically tailored for academic publishing houses. It enables publishers to manage their entire lifecycle—from journal inception and domain registration to ISSN acquisition, HEC indexing, and ongoing editorial operations—within a unified, secure platform.'
      },
      {
        id: 'g2',
        question: 'How do I get started as a new Administrator?',
        answer: 'Administrators should begin by configuring the Global Settings. This includes setting up custom categories for journals, defining department structures, and setting up office subscriptions. Once the backbone is ready, you can start onboarding employees and managers through the Employees module.'
      },
      {
        id: 'g3',
        question: 'What are the different user roles and their permissions?',
        answer: 'The system uses a granular Role-Based Access Control (RBAC) model:\n- Admin: Comprehensive system control, financial overview, and user management.\n- Manager: Departmental oversight, task approval, and operational reporting.\n- Employee: Daily operational execution, journal management, and task fulfillment.\n- Client: Secure portal access to view their specific journals, track service status, and order new publishing services.'
      },
      {
        id: 'g4',
        question: 'Can I customize the branding of my portal?',
        answer: 'Yes, Administrators can navigate to Settings > Organization Branding to upload a custom logo, define primary brand colors, and set the organization name. These changes reflect across the dashboard and client portal for a consistent professional experience.'
      }
    ]
  },
  {
    category: 'Journal Operations',
    icon: FileText,
    questions: [
      {
        id: 'jo1',
        question: 'How do I register a new Journal?',
        answer: 'Navigate to the Journals section and click "Add New Journal". You will need to provide the journal name, select its category (e.g., Social Sciences, Medicine), specify the frequency (e.g., Quarterly, Monthly), and assign it to a client. You can also link it to an existing domain record immediately.'
      },
      {
        id: 'jo2',
        question: 'What is the ISSN request workflow?',
        answer: 'The ISSN request module automates the application tracking. You create a request, specify whether it is for Print, Online, or Both, and upload necessary documents. The system tracks the status through stages like "Pending", "Under Review", and "Received". Once received, the ISSN is automatically linked to the journal profile.'
      },
      {
        id: 'jo3',
        question: 'How do I manage the Editorial Board?',
        answer: 'Each journal profile includes an "Editorial Board" section where you can add editors, reviewers, and board members. You can track their profiles, institutional affiliations, and specific roles within the journal to meet HEC and indexing requirements.'
      },
      {
        id: 'jo4',
        question: 'What is HEC Journal Recognition tracking?',
        answer: 'For journals seeking recognition from the Higher Education Commission (HEC), the system provides a specific module to track the application status for various categories (W, X, Y, Z). It stores the history of applications, HEC feedback, and current recognition tier.'
      }
    ]
  },
  {
    category: 'Domains & Infrastructure',
    icon: Globe,
    questions: [
      {
        id: 'd1',
        question: 'How does the Domain Manager work?',
        answer: 'The Domain Manager tracks your entire URL portfolio. It records registrar details, nameservers, EPP codes, and registration/expiry dates. The dashboard provides automated alerts for domains expiring within 30, 60, or 90 days to prevent service interruptions.'
      },
      {
        id: 'd2',
        question: 'Can I manage hosting and CPanel details?',
        answer: 'Yes, each domain entry has a dedicated section for Hosting Details. You can store CPanel URLs, usernames, and server IPs. For security, these highly sensitive credentials are only visible to authorized Roles (Admin/Manager).'
      },
      {
        id: 'd3',
        question: 'What should I do when a domain renews?',
        answer: 'After successfully renewing a domain with your registrar, locate the domain in the Domain Manager, click "Edit", and update the Expiry Date. This will automatically update the status and reset the renewal reminders.'
      }
    ]
  },
  {
    category: 'Performance & Workflow',
    icon: ShieldCheck,
    questions: [
      {
        id: 'w1',
        question: 'How are employee points calculated?',
        answer: 'Points are the core of our performance gamification. Employees earn points automatically for: \n- Successfully acquiring an ISSN (50-100 pts)\n- Completing assigned tasks (variable pts)\n- Managing journal milestones (e.g., Volume publication)\nManagers can also manually award bonus points for exceptional performance.'
      },
      {
        id: 'w2',
        question: 'How do I assign tasks to my team?',
        answer: 'Managers can use the Tasks module or click the "+" button in many views to create a task. You can set priority levels (High, Medium, Low), define deadlines, and attach relevant files. The "Activity Log" tracks all changes to a task from creation to completion.'
      },
      {
        id: 'w3',
        question: 'What is the Attendance & Leave system?',
        answer: 'Employees can "Clock In" and "Clock Out" daily through the dashboard. The system records work hours and calculates monthly attendance reports. Leave requests (Sick, Casual, Paid) can be submitted for Manager approval through the same interface.'
      }
    ]
  },
  {
    category: 'Finance & Invoicing',
    icon: DollarSign,
    questions: [
      {
        id: 'f1',
        question: 'How do I create an invoice for a client?',
        answer: 'Navigate to the Invoices section and click "Create Invoice". You can select a Client, add line items for various services (e.g., Domain Registration, ISSN Service, Web Development), and set tax rates. Invoices can be downloaded as PDF or shared directly via email.'
      },
      {
        id: 'f2',
        question: 'How does the Expense Manager work?',
        answer: 'The system allows tracking of all office and operational expenses. Expenses are categorized by "Head" (e.g., Utilities, Marketing, Salaries). You can upload proof of payment (bills/receipts) and view monthly expense summaries for financial balancing.'
      },
      {
        id: 'f3',
        question: 'Can I track client payments?',
        answer: 'Yes, each invoice tracks its own "Payment Status" (Unpaid, Partially Paid, Paid). When a client pays, you can record the transaction details, including the payment method (Bank, JazzCash, EasyPaisa) and transaction ID.'
      }
    ]
  },
  {
    category: 'Support & Security',
    icon: Shield,
    questions: [
      {
        id: 's1',
        question: 'Who has access to my data?',
        answer: 'Access is strictly limited based on the role assigned to each user. Clients can ONLY see their own journals and services. Employees see journals and tasks relevant to their assignments. All data is protected by Firebase Security Rules which enforce these restrictions at the database level.'
      },
      {
        id: 's2',
        question: 'How do I report a bug or request a feature?',
        answer: 'You can submit feedback directly through the "Live Chat" feature or by contacting your dedicated Account Manager. For technical emergencies, please use the contact numbers provided at the bottom of the Help Center.'
      },
      {
        id: 's3',
        question: 'Can I export my journal data?',
        answer: 'Yes, Administrators can export core data lists (Journals, Domains, Clients) to CSV or Excel format for external reporting or offline backups. This feature is located within the "Resources" or specific module list views.'
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
