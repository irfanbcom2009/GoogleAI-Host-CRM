import React, { useState, useEffect } from 'react';
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
  Sparkles, 
  Send, 
  Loader2,
  Video,
  Play,
  X,
  Plus,
  Edit2,
  Trash2,
  Tv,
  CheckCircle2,
  Save,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { geminiService } from '../services/geminiService';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface FAQVideo {
  url: string;
  title: string;
  description?: string;
  duration?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  video?: FAQVideo;
}

export interface FAQCategory {
  category: string;
  icon: string;
  questions: FAQItem[];
}

const ICON_MAP: Record<string, any> = {
  BookOpen,
  FileText,
  Globe,
  ShieldCheck,
  DollarSign,
  Shield,
  HelpCircle
};

const DEFAULT_FAQ_DATA: FAQCategory[] = [
  {
    category: 'General',
    icon: 'BookOpen',
    questions: [
      {
        id: 'g1',
        question: 'What is Host A Journal CRM?',
        answer: 'Host A Journal CRM is an advanced Enterprise Resource Planning (ERP) and Customer Relationship Management (CRM) solution specifically tailored for academic publishing houses. It enables publishers to manage their entire lifecycle—from journal inception and domain registration to ISSN acquisition, HEC indexing, and ongoing editorial operations—within a unified, secure platform.',
        video: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Host A Journal CRM Introduction Tour',
          description: 'A brief conceptual tutorial showing the main navigation, dashboard counters, and core modules within Host A Journal.',
          duration: '4:12'
        }
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
    icon: 'FileText',
    questions: [
      {
        id: 'jo1',
        question: 'How do I register a new Journal?',
        answer: 'Navigate to the Journals section and click "Add New Journal". You will need to provide the journal name, select its category (e.g., Social Sciences, Medicine), specify the frequency (e.g., Quarterly, Monthly), and assign it to a client. You can also link it to an existing domain record immediately.',
        video: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Registering New Journals Walkthrough',
          description: 'Visual demonstration showing how to add journal metadata, assign publishers, and setup sub-categories.',
          duration: '3:05'
        }
      },
      {
        id: 'jo2',
        question: 'What is the ISSN request workflow?',
        answer: 'The ISSN request module automates the application tracking. You create a request, specify whether it is for Print, Online, or Both, and upload necessary documents. The system tracks the status through stages like "Pending", "Under Review", and "Received". Once received, the ISSN is automatically linked to the journal profile.',
        video: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Managing and Submitting ISSN Requests',
          description: 'A video overview on how to check required parameters for print or online ISSNs and request approvals.',
          duration: '5:18'
        }
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
    icon: 'Globe',
    questions: [
      {
        id: 'd1',
        question: 'How does the Domain Manager work?',
        answer: 'The Domain Manager tracks your entire URL portfolio. It records registrar details, nameservers, EPP codes, and registration/expiry dates. The dashboard provides automated alerts for domains expiring within 30, 60, or 90 days to prevent service interruptions.',
        video: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Working with the Domain Portfolios',
          description: 'Step-by-step master tutorial on configuring registrars, recording EPP codes, and tracking SSL status.',
          duration: '6:22'
        }
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
    icon: 'ShieldCheck',
    questions: [
      {
        id: 'w1',
        question: 'How are employee points calculated?',
        answer: 'Points are the core of our performance gamification. Employees earn points automatically for: \n- Successfully acquiring an ISSN (50-100 pts)\n- Completing assigned tasks (variable pts)\n- Managing journal milestones (e.g., Volume publication)\nManagers can also manually award bonus points for exceptional performance.'
      },
      {
        id: 'w2',
        question: 'How do I assign tasks to my team?',
        answer: 'Managers can use the Tasks module or click the "+" button in many views to create a task. You can set priority levels (High, Medium, Low), define deadlines, and attach relevant files. The "Activity Log" tracks all changes to a task from creation to completion.',
        video: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Interactive Workflow & Task Assignments',
          description: 'A look at assigning employee tasks, complexity multipliers, base points allocation, and live feedback logs.',
          duration: '4:40'
        }
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
    icon: 'DollarSign',
    questions: [
      {
        id: 'f1',
        question: 'How do I create an invoice for a client?',
        answer: 'Navigate to the Invoices section and click "Create Invoice". You can select a Client, add line items for various services (e.g., Domain Registration, ISSN Service, Web Development), and set tax rates. Invoices can be downloaded as PDF or shared directly via email.',
        video: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Invoice Creation & Cash Collections',
          description: 'Comprehensive walkthrough on billing services, adding offline cash collections, and tax declarations.',
          duration: '5:50'
        }
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
    icon: 'Shield',
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

interface FAQProps {
  currentUser?: any;
}

export const FAQ: React.FC<FAQProps> = ({ currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>('g1');
  const [activeCategory, setActiveCategory] = useState('All');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Dynamic FAQs State
  const [faqData, setFaqData] = useState<FAQCategory[]>(() => {
    const saved = localStorage.getItem('custom_faqs');
    return saved ? JSON.parse(saved) : DEFAULT_FAQ_DATA;
  });

  // Management State
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEdiModalOpen, setIsEdiModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'add' | 'edit'>('add');
  const [targetCategory, setTargetCategory] = useState('');
  const [targetFaqId, setTargetFaqId] = useState<string | null>(null);

  // Form states
  const [modalQuestion, setModalQuestion] = useState('');
  const [modalAnswer, setModalAnswer] = useState('');
  const [modalHasVideo, setModalHasVideo] = useState(false);
  const [modalVideoTitle, setModalVideoTitle] = useState('');
  const [modalVideoUrl, setModalVideoUrl] = useState('');
  const [modalVideoDesc, setModalVideoDesc] = useState('');
  const [modalVideoDuration, setModalVideoDuration] = useState('');

  // Playing video state
  const [playingVideo, setPlayingVideo] = useState<FAQVideo | null>(null);

  const isAuthorized = currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.email === 'irfanbcom2009@gmail.com';

  // Subscribing to Firestore settings for real-time FAQ updates
  useEffect(() => {
    const faqDocRef = doc(db, 'settings', 'faqs');
    const unsubscribe = onSnapshot(faqDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data().faqList;
        if (Array.isArray(data)) {
          setFaqData(data);
          localStorage.setItem('custom_faqs', JSON.stringify(data));
        }
      }
    }, (error) => {
      console.warn("Could not load dynamic FAQs from Firestore: ", error);
    });
    return () => unsubscribe();
  }, []);

  const saveFaqData = async (newFaqData: FAQCategory[]) => {
    setFaqData(newFaqData);
    localStorage.setItem('custom_faqs', JSON.stringify(newFaqData));

    if (isAuthorized) {
      try {
        await setDoc(doc(db, 'settings', 'faqs'), {
          faqList: newFaqData,
          lastUpdatedBy: currentUser?.name || 'Admin',
          lastUpdatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to save to Firestore settings settings/faqs: ", err);
      }
    }
  };

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

  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return null;
  };

  // Open Add FAQ Modal
  const openAddModal = (categoryName: string) => {
    setModalAction('add');
    setTargetCategory(categoryName);
    setTargetFaqId(null);
    setModalQuestion('');
    setModalAnswer('');
    setModalHasVideo(false);
    setModalVideoTitle('');
    setModalVideoUrl('');
    setModalVideoDesc('');
    setModalVideoDuration('');
    setIsEdiModalOpen(true);
  };

  // Open Edit FAQ Modal
  const openEditModal = (categoryName: string, faq: FAQItem) => {
    setModalAction('edit');
    setTargetCategory(categoryName);
    setTargetFaqId(faq.id);
    setModalQuestion(faq.question);
    setModalAnswer(faq.answer);
    if (faq.video) {
      setModalHasVideo(true);
      setModalVideoTitle(faq.video.title);
      setModalVideoUrl(faq.video.url);
      setModalVideoDesc(faq.video.description || '');
      setModalVideoDuration(faq.video.duration || '');
    } else {
      setModalHasVideo(false);
      setModalVideoTitle('');
      setModalVideoUrl('');
      setModalVideoDesc('');
      setModalVideoDuration('');
    }
    setIsEdiModalOpen(true);
  };

  // Handle Save
  const handleSaveModal = () => {
    if (!modalQuestion.trim() || !modalAnswer.trim()) {
      alert("Please fill in both Question and Answer.");
      return;
    }

    if (modalHasVideo && (!modalVideoUrl.trim() || !modalVideoTitle.trim())) {
      alert("Please provide the Video Title and Video URL.");
      return;
    }

    let videoObj: FAQVideo | undefined = undefined;
    if (modalHasVideo) {
      videoObj = {
        url: modalVideoUrl.trim(),
        title: modalVideoTitle.trim(),
        description: modalVideoDesc.trim() || undefined,
        duration: modalVideoDuration.trim() || undefined
      };
    }

    let updated = [...faqData];

    if (modalAction === 'add') {
      const newFaq: FAQItem = {
        id: 'faq_' + Math.random().toString(36).substring(2, 11),
        question: modalQuestion.trim(),
        answer: modalAnswer.trim(),
        ...(videoObj ? { video: videoObj } : {})
      };
      updated = updated.map(cat => {
        if (cat.category === targetCategory) {
          return {
            ...cat,
            questions: [...cat.questions, newFaq]
          };
        }
        return cat;
      });
    } else {
      updated = updated.map(cat => {
        if (cat.category === targetCategory) {
          return {
            ...cat,
            questions: cat.questions.map(q => {
              if (q.id === targetFaqId) {
                return {
                  ...q,
                  question: modalQuestion.trim(),
                  answer: modalAnswer.trim(),
                  video: videoObj
                };
              }
              return q;
            })
          };
        }
        return cat;
      });
    }

    saveFaqData(updated);
    setIsEdiModalOpen(false);
  };

  // Handle Delete
  const handleDeleteFaq = (categoryName: string, faqId: string) => {
    if (window.confirm("Are you sure you want to delete this FAQ item?")) {
      const updated = faqData.map(cat => {
        if (cat.category === categoryName) {
          return {
            ...cat,
            questions: cat.questions.filter(q => q.id !== faqId)
          };
        }
        return cat;
      });
      saveFaqData(updated);
    }
  };

  const categories = ['All', ...faqData.map(c => c.category)];

  const filteredFaqs = faqData.map(cat => ({
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
          Search our comprehensive knowledge base for answers to common questions about managing your journals, ISSN requests, and visual tutorial videos.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-2xl mx-auto">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search for questions, keywords, or topics..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg"
            value={searchQuery || ''}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {isAuthorized && (
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "px-5 py-4 rounded-2xl font-black text-sm flex items-center gap-2 whitespace-nowrap border transition-all shadow-sm",
              isEditMode 
                ? "bg-amber-500 text-white border-amber-600" 
                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
            )}
          >
            <Edit2 size={16} />
            {isEditMode ? "Exit Edit Mode" : "Manage FAQs"}
          </button>
        )}
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
                value={aiQuestion || ''}
                onChange={e => setAiQuestion(e.target.value)}
              />
              <button 
                type="submit"
                disabled={isAiLoading || !aiQuestion.trim()}
                className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black hover:bg-indigo-50 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isAiLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
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

        {filteredFaqs.map((category) => {
          const CategoryIcon = ICON_MAP[category.icon] || BookOpen;
          return (
            <div key={category.category} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <CategoryIcon size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{category.category}</h2>
                </div>

                {isEditMode && (
                  <button
                    onClick={() => openAddModal(category.category)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-550 border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-350 bg-white hover:bg-indigo-50/50 rounded-xl text-xs font-bold transition-all"
                  >
                    <Plus size={14} />
                    Add FAQ
                  </button>
                )}
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
                    <div className="flex items-center justify-between w-full pr-4">
                      <button 
                        onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                        className="flex-1 px-6 py-5 flex items-center justify-between text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "font-bold transition-colors",
                            openId === faq.id ? "text-indigo-600" : "text-slate-700 group-hover:text-slate-900"
                          )}>
                            {faq.question}
                          </span>
                          {faq.video && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-full text-[10px] font-black uppercase tracking-wider">
                              <Video size={10} />
                              Video
                            </span>
                          )}
                        </div>
                        {openId === faq.id ? (
                          <ChevronUp size={20} className="text-indigo-500" />
                        ) : (
                          <ChevronDown size={20} className="text-slate-400 group-hover:text-slate-600" />
                        )}
                      </button>

                      {isEditMode && (
                        <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
                          <button
                            onClick={() => openEditModal(category.category, faq)}
                            className="p-2 text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                            title="Edit FAQ & Video"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteFaq(category.category, faq.id)}
                            className="p-2 text-rose-600 hover:bg-slate-50 rounded-lg transition-all"
                            title="Delete FAQ"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {openId === faq.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-50 pt-4 space-y-4">
                            <p className="whitespace-pre-line text-sm">{faq.answer}</p>
                            
                            {/* Render Embedded Video Option */}
                            {faq.video && (
                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div className="p-2.5 bg-red-100 text-red-600 rounded-xl mt-0.5 shadow-sm">
                                    <Video size={18} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                      {faq.video.title}
                                      {faq.video.duration && (
                                        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold">
                                          {faq.video.duration}
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                                      {faq.video.description || "Learn through this interactive lesson and video training."}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setPlayingVideo(faq.video!)}
                                  className="w-full md:w-auto inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-rose-700 transition-all shadow-md shadow-rose-100 whitespace-nowrap"
                                >
                                  <Play size={13} fill="currentColor" />
                                  Watch Video
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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

      {/* Dynamic Edit/Add FAQ item modal */}
      {isEdiModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-slate-100 relative space-y-6">
            <button 
              onClick={() => setIsEdiModalOpen(false)}
              className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
            >
              <X size={18} />
            </button>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">
                {modalAction === 'add' ? 'Add New FAQ' : 'Edit FAQ Item'}
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest bg-slate-50 inline-block px-3 py-1 rounded-lg">
                Category: {targetCategory}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Question</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-semibold"
                  placeholder="e.g. How do I request a new DOI?"
                  value={modalQuestion || ''}
                  onChange={e => setModalQuestion(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Answer</label>
                <textarea 
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-semibold placeholder:text-slate-400"
                  placeholder="Provide a comprehensive answer..."
                  value={modalAnswer || ''}
                  onChange={e => setModalAnswer(e.target.value)}
                />
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Attach Lesson / Tutorial Video</h4>
                    <p className="text-xs text-slate-400">Add a helpful training video with details</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={modalHasVideo} 
                      onChange={e => setModalHasVideo(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-650 peer-checked:bg-rose-500"></div>
                  </label>
                </div>

                {modalHasVideo && (
                  <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Video Title / Name</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs font-semibold"
                        placeholder="e.g. Setting Up DOI Integrations"
                        value={modalVideoTitle || ''}
                        onChange={e => setModalVideoTitle(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Video URL (YouTube / Vimeo)</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs font-semibold"
                          placeholder="e.g. https://www.youtube.com/watch?v=..."
                          value={modalVideoUrl || ''}
                          onChange={e => setModalVideoUrl(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Duration / Time</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs font-semibold"
                          placeholder="e.g. 4 mins"
                          value={modalVideoDuration || ''}
                          onChange={e => setModalVideoDuration(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Brief Summary / Description</label>
                      <textarea 
                        rows={2}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs font-semibold"
                        placeholder="Briefly state key takeaways..."
                        value={modalVideoDesc || ''}
                        onChange={e => setModalVideoDesc(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setIsEdiModalOpen(false)}
                className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm text-center"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveModal}
                className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all text-sm text-center shadow-lg shadow-indigo-100"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Video Player Modal */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 text-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl relative border border-slate-800">
            <button 
              onClick={() => setPlayingVideo(null)}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-all z-20"
            >
              <X size={18} />
            </button>

            <div className="aspect-video w-full bg-black relative">
              {getEmbedUrl(playingVideo.url) ? (
                <iframe 
                  src={getEmbedUrl(playingVideo.url)!} 
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 space-y-4 text-center">
                  <Tv size={48} className="text-slate-500" />
                  <div className="space-y-1">
                    <p className="text-slate-300 font-bold">This external video has been linked.</p>
                    <p className="text-xs text-slate-500">Please click the button below to view it directly.</p>
                  </div>
                  <a 
                    href={playingVideo.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-500/20"
                  >
                    Open Tutorial
                  </a>
                </div>
              )}
            </div>

            <div className="p-8 space-y-4 bg-slate-950 border-t border-slate-900">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tight">{playingVideo.title}</h3>
                  {playingVideo.duration && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider">
                      <Clock size={10} />
                      {playingVideo.duration}
                    </span>
                  )}
                </div>
              </div>
              {playingVideo.description && (
                <p className="text-sm text-slate-400 leading-relaxed">
                  {playingVideo.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
