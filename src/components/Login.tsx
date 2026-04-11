import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { Layers, LogIn } from 'lucide-react';

export const Login: React.FC = () => {
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
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-10 text-center space-y-8"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Host A Journal</h1>
            <p className="text-slate-500 font-medium uppercase tracking-widest text-xs mt-1">Pvt Ltd CRM System</p>
          </div>
        </div>

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
