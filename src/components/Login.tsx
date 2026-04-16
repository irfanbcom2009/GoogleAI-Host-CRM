import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { Layers, LogIn, XCircle, ArrowLeft } from 'lucide-react';

interface LoginProps {
  error?: string | null;
  onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ error, onBack }) => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-10 text-center space-y-8 relative"
      >
        {onBack && (
          <button 
            onClick={onBack}
            className="absolute left-6 top-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Host A Journal</h1>
            <p className="text-slate-500 font-medium uppercase tracking-widest text-xs mt-1">Pvt Ltd CRM System</p>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-left"
          >
            <XCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm font-bold text-rose-600 leading-tight">{error}</p>
          </motion.div>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800">Welcome Back</h2>
          <p className="text-slate-500 text-sm">Please sign in with your Google account to access the CRM dashboard.</p>
        </div>

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 group"
        >
          <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
          Sign in with Google
        </button>

        <div className="pt-6 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
            Secure Enterprise Access Only
          </p>
        </div>
      </motion.div>
    </div>
  );
};
