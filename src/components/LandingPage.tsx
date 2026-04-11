import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Globe, 
  Shield, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Search, 
  HelpCircle, 
  FileText,
  Package,
  Mail,
  Phone,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Sparkles,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { Journal, Domain, ISSNRequest } from '../types';
import { useServices } from '../hooks/useServices';
import { FAQ } from './FAQ';
import { Policies } from './Policies';
import { Services } from './Services';

export const LandingPage: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const { catalog: SERVICES_CATALOG } = useServices();
  const [latestJournals, setLatestJournals] = useState<Journal[]>([]);
  const [latestDomains, setLatestDomains] = useState<Domain[]>([]);
  const [latestIssn, setLatestIssn] = useState<ISSNRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'home' | 'faq' | 'policies' | 'services'>('home');

  useEffect(() => {
    const unsubJournals = onSnapshot(
      query(collection(db, 'journals'), orderBy('createdAt', 'desc'), limit(5)),
      (snapshot) => {
        setLatestJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)));
      }
    );

    const unsubDomains = onSnapshot(
      query(collection(db, 'domains'), orderBy('createdAt', 'desc'), limit(5)),
      (snapshot) => {
        setLatestDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Domain)));
      }
    );

    const unsubIssn = onSnapshot(
      query(collection(db, 'issn_requests'), where('status', '==', 'approved'), orderBy('createdAt', 'desc'), limit(5)),
      (snapshot) => {
        setLatestIssn(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ISSNRequest)));
      }
    );

    setLoading(false);
    return () => {
      unsubJournals();
      unsubDomains();
      unsubIssn();
    };
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case 'faq': return <FAQ />;
      case 'policies': return <Policies currentUser={null} />;
      case 'services': return <Services currentUser={null} />;
      default: return (
        <div className="space-y-20 pb-20">
          {/* Hero Section */}
          <section className="relative pt-20 pb-32 overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-50/50 -skew-x-12 translate-x-1/4 z-0" />
            <div className="max-w-7xl mx-auto px-8 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-black uppercase tracking-widest">
                    <Sparkles size={18} />
                    The Future of Academic Publishing
                  </div>
                  <h1 className="text-6xl font-black text-slate-900 leading-tight tracking-tight">
                    Manage Your <span className="text-indigo-600">Journals</span> with Precision
                  </h1>
                  <p className="text-xl text-slate-500 leading-relaxed max-w-lg">
                    The all-in-one CRM for academic publishers. Track ISSN requests, manage indexing, and grow your publishing house with AI-powered insights.
                  </p>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={onLogin}
                      className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2"
                    >
                      Get Started Now
                      <ArrowRight size={20} />
                    </button>
                    <button 
                      onClick={() => setActiveSection('services')}
                      className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black text-lg hover:bg-slate-50 transition-all"
                    >
                      View Services
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -inset-4 bg-indigo-500/10 blur-3xl rounded-full" />
                  <img 
                    src="https://picsum.photos/seed/publishing/800/600" 
                    alt="Dashboard Preview" 
                    className="relative rounded-3xl shadow-2xl border border-white/50"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Stats / Latest Data Section */}
          <section className="max-w-7xl mx-auto px-8 space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-black text-slate-900">Recent Activity</h2>
              <p className="text-slate-500 font-medium">Stay updated with the latest journals, domains, and ISSN approvals on our platform.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Latest Journals Card */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden group">
                <div className="p-8 bg-indigo-600 text-white flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black">Latest Journals</h3>
                    <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">New Publications</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <BookOpen size={24} />
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  {latestJournals.length > 0 ? latestJournals.map(j => (
                    <div key={j.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group/item hover:bg-indigo-50 hover:border-indigo-100 transition-all cursor-pointer">
                      <div className="truncate pr-4">
                        <p className="text-sm font-black text-slate-900 truncate group-hover/item:text-indigo-600 transition-colors">{j.title}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">{j.category}</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover/item:text-indigo-400 group-hover/item:translate-x-1 transition-all" />
                    </div>
                  )) : (
                    <div className="py-10 text-center text-slate-400 italic text-sm">No journals found</div>
                  )}
                </div>
              </div>

              {/* Latest ISSN Card */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden group">
                <div className="p-8 bg-emerald-600 text-white flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black">ISSN Approvals</h3>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">Verified Records</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <CheckCircle2 size={24} />
                  </div>
                </div>
                <div className="p-6 space-y-3">
                      {latestIssn.length > 0 ? latestIssn.map(i => (
                    <div key={i.id} className="flex items-center justify-between p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100 group/item hover:bg-emerald-50 transition-all">
                      <div>
                        <p className="text-sm font-black text-slate-900">ISSN: {i.issn || i.printIssn || i.onlineIssn || 'N/A'}</p>
                        <p className="text-[10px] text-emerald-600 uppercase font-black tracking-widest mt-0.5">{i.type || i.requestType} Edition</p>
                      </div>
                      <div className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-xl uppercase shadow-lg shadow-emerald-200">Verified</div>
                    </div>
                  )) : (
                    <div className="py-10 text-center text-slate-400 italic text-sm">No ISSN approvals found</div>
                  )}
                </div>
              </div>

              {/* Latest Domains Card */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden group">
                <div className="p-8 bg-amber-600 text-white flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black">Latest Domains</h3>
                    <p className="text-amber-100 text-xs font-bold uppercase tracking-widest mt-1">Active Assets</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Globe size={24} />
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  {latestDomains.length > 0 ? latestDomains.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-4 bg-amber-50/30 rounded-2xl border border-amber-100 group/item hover:bg-amber-50 transition-all">
                      <div className="truncate pr-4">
                        <p className="text-sm font-black text-slate-900 truncate">{d.domainName}</p>
                        <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest mt-0.5">Active & Secured</p>
                      </div>
                      <ExternalLink size={16} className="text-amber-300 group-hover/item:text-amber-500 transition-all" />
                    </div>
                  )) : (
                    <div className="py-10 text-center text-slate-400 italic text-sm">No domains found</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Contact / Order Section */}
          <section className="max-w-7xl mx-auto px-8">
            <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-3xl" />
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h2 className="text-4xl font-black tracking-tight">Ready to launch your journal?</h2>
                  <p className="text-slate-400 text-lg">
                    Our team of experts is ready to help you with ISSN registration, OJS setup, and indexing applications.
                  </p>
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Mail className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Email Us</p>
                        <p className="text-lg font-bold">info@hostajournal.com</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Phone className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Call Us</p>
                        <p className="text-lg font-bold">+92 300 480023</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-3xl p-8 text-slate-900 shadow-2xl">
                  <h3 className="text-2xl font-black mb-6">Order a Service</h3>
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Name</label>
                        <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="John Doe" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                        <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="john@example.com" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Service</label>
                      <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                        <option>ISSN Registration</option>
                        <option>OJS Setup & Hosting</option>
                        <option>Journal Indexing</option>
                        <option>DOI Application</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Message</label>
                      <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="Tell us about your journal..." />
                    </div>
                    <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                      Send Inquiry
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-[100]">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setActiveSection('home')}
            >
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <BookOpen size={24} />
              </div>
              <span className="text-xl font-black tracking-tight">Host A Journal <span className="text-indigo-600">CRM</span></span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => setActiveSection('home')}
                className={cn("text-sm font-bold transition-all", activeSection === 'home' ? "text-indigo-600" : "text-slate-500 hover:text-slate-900")}
              >
                Home
              </button>
              <button 
                onClick={() => setActiveSection('services')}
                className={cn("text-sm font-bold transition-all", activeSection === 'services' ? "text-indigo-600" : "text-slate-500 hover:text-slate-900")}
              >
                Services
              </button>
              <button 
                onClick={() => setActiveSection('faq')}
                className={cn("text-sm font-bold transition-all", activeSection === 'faq' ? "text-indigo-600" : "text-slate-500 hover:text-slate-900")}
              >
                FAQ
              </button>
              <button 
                onClick={() => setActiveSection('policies')}
                className={cn("text-sm font-bold transition-all", activeSection === 'policies' ? "text-indigo-600" : "text-slate-500 hover:text-slate-900")}
              >
                Policies
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onLogin}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Login / Register
            </button>
          </div>
        </div>
      </nav>

      <main>
        {renderSection()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <BookOpen size={18} />
            </div>
            <span className="font-black text-slate-900">Host A Journal CRM</span>
          </div>
          <p className="text-slate-400 text-sm">© 2026 Host A Journal. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => setActiveSection('policies')} className="text-sm text-slate-500 hover:text-indigo-600 font-medium">Privacy Policy</button>
            <button onClick={() => setActiveSection('policies')} className="text-sm text-slate-500 hover:text-indigo-600 font-medium">Terms of Service</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
