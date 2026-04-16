import React, { useState, useEffect } from 'react';
import { ChatBoard } from './ChatBoard';
import { Login } from './Login';
import { User as UserType, UserRole } from '../types';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, MessageSquare, ArrowLeft } from 'lucide-react';

export const StandaloneChat: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [currentUserDoc, setCurrentUserDoc] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            setCurrentUserDoc({ ...userDoc.data() as UserType, id: userDoc.id });
            setUser(user);
          } else {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const doc = querySnapshot.docs[0];
              setCurrentUserDoc({ ...doc.data() as UserType, id: doc.id });
              setUser(user);
            } else {
              await signOut(auth);
              setShowLogin(true);
            }
          }
        } catch (error) {
          console.error("Error fetching user:", error);
        }
      } else {
        setShowLogin(true);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 animate-pulse">
          <MessageSquare size={32} />
        </div>
        <Loader2 className="text-indigo-600 animate-spin" size={24} />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Initializing Chat...</p>
      </div>
    );
  }

  if (!user || !currentUserDoc) {
    return (
      <div className="fixed inset-0 bg-white z-[200] overflow-y-auto">
        <div className="max-w-md mx-auto pt-10 px-6">
          <div className="text-center mb-8 space-y-2">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 mx-auto mb-4">
              <MessageSquare size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Live Support Chat</h1>
            <p className="text-slate-500 text-sm">Please login to start a conversation with our team.</p>
          </div>
          <Login onBack={() => window.location.href = '/'} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatBoard 
          currentUser={currentUserDoc} 
          onBack={() => window.location.href = '/'}
        />
      </div>
      
      {/* PWA/Mobile optimization meta tags would go in index.html, 
          but we can simulate the feel here by ensuring no scroll on body */}
      <style dangerouslySetInnerHTML={{ __html: `
        body { overflow: hidden !important; position: fixed; width: 100%; height: 100%; }
        #root { height: 100%; }
      `}} />
    </div>
  );
};
