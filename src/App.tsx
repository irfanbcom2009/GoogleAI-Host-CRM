import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Clients } from './components/Clients';
import { Domains } from './components/Domains';
import { Journals } from './components/Journals';
import { ISSNRequests } from './components/ISSNRequests';
import { Tasks } from './components/Tasks';
import { Points } from './components/Points';
import { Notifications } from './components/Notifications';
import { Publishers } from './components/Publishers';
import { HEC } from './components/HEC';
import { PaymentTaskLedger } from './components/PaymentTaskLedger';
import { TrashManagement } from './components/TrashManagement';
import { FileManager } from './components/FileManager';
import { FileRequests } from './components/FileRequests';
import { ClientSetupWorkflow } from './components/ClientSetupWorkflow';
import { IndexingAgencies } from './components/IndexingAgencies';
import { ApprovalRequests } from './components/ApprovalRequests';
import { DOIManagement } from './components/DOIManagement';
import { DOAJApplications } from './components/DOAJApplications';
import { Policies } from './components/Policies';
import { Employees } from './components/Employees';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { Expenses } from './components/Expenses';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { FAQ } from './components/FAQ';
import { ClientDashboard } from './components/ClientDashboard';
import { ChatBoard } from './components/ChatBoard';
import { ServiceCatalog } from './components/ServiceCatalog';
import { ServiceOrderSystem } from './components/ServiceOrderSystem';
import { ServiceOrderWizard } from './components/ServiceOrderWizard';
import { DynamicServiceRequester } from './components/DynamicServiceRequester';
import { Services } from './components/Services';
import { OrderManagement } from './components/OrderManagement';
import { FinanceDashboard } from './components/FinanceDashboard';
import { PayrollManager } from './components/PayrollManager';
import { OperationsFinanceManager } from './components/OperationsFinanceManager';
import { WorkflowHub } from './components/WorkflowHub';
import { LandingPage } from './components/LandingPage';
import { GlobalAddButton } from './components/GlobalAddButton';
import { StandaloneChat } from './components/StandaloneChat';
import { RegistrationFlow } from './components/RegistrationFlow';
import { RegistrationRequests } from './components/RegistrationRequests';
import { AccessLogs } from './components/AccessLogs';
import { ActivityHistory } from './components/ActivityHistory';
import { PermissionDenied } from './components/PermissionDenied';
import { CommandPalette } from './components/CommandPalette';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { Search, Bell, LogOut, Loader2, Shield, Layers, Sparkles, Send, X, CheckCircle2, ArrowRight, ShieldCheck, MessageSquare, UserPlus, ShieldAlert, Command, Keyboard, Home, BookOpen, ClipboardList, Menu, Sun, Moon } from 'lucide-react';
import { cn } from './lib/utils';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole, User as CRMUser, UserPermissions } from './types';
import { geminiService } from './services/geminiService';
import { FULL_MODULE_PERMISSIONS, canAccessModule } from './lib/permissions';

import { PerformanceLeaderboard } from './components/PerformanceLeaderboard';

interface MobileBottomNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unreadCount?: number;
}

const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({ activeTab, setActiveTab, unreadCount = 0 }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'journals', label: 'Journals', icon: BookOpen },
    { id: 'tasks', label: 'Tasks', icon: ClipboardList },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: unreadCount },
    { id: 'more', label: 'More', icon: Menu, action: () => {
      window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'));
    }}
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-16 flex items-center justify-around px-2 shrink-0 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.action) {
                item.action();
              } else {
                setActiveTab(item.id);
              }
            }}
            className="flex flex-col items-center justify-center flex-1 h-full py-1 relative group focus:outline-none cursor-pointer"
          >
            <div className={cn(
              "px-5 py-1 rounded-full transition-all duration-300 relative flex items-center justify-center",
              isActive ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            )}>
              <Icon size={20} className={cn("transition-transform duration-200 group-active:scale-90", isActive ? "scale-110" : "")} />
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className={cn(
              "text-[10px] tracking-tight mt-1 transition-colors duration-200",
              isActive ? "text-indigo-700 dark:text-indigo-400 font-semibold" : "text-slate-500 dark:text-slate-400"
            )}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [currentUserDoc, setCurrentUserDoc] = useState<CRMUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('Employee');
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState<{ id: string, role: UserRole, name: string, email: string } | null>(null);
  const [impersonatedUserDoc, setImpersonatedUserDoc] = useState<CRMUser | null>(null);
  const [selectedChatClientId, setSelectedChatClientId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteShowInfo, setCommandPaletteShowInfo] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [aiAssistantQuery, setAiAssistantQuery] = useState('');
  const [aiAssistantResponse, setAiAssistantResponse] = useState<string | null>(null);
  const [isAiAssistantLoading, setIsAiAssistantLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isStandaloneChat, setIsStandaloneChat] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [unauthorizedUser, setUnauthorizedUser] = useState<User | null>(null);
  const [branding, setBranding] = useState<{ name: string, logoUrl?: string, primaryColor?: string }>({ name: 'Host A Journal' });
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const { checkFirestoreConnection } = await import('./lib/firebase');
      const connected = await checkFirestoreConnection();
      setIsDbConnected(connected);
    };
    checkConnection();
    const connectionInterval = setInterval(checkConnection, 15000);
    return () => clearInterval(connectionInterval);
  }, []);

  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  const toggleGlobalTheme = () => {
    setCurrentTheme(prev => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark';
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', nextTheme);
      return nextTheme;
    });
  };

  useEffect(() => {
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', currentTheme);
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'chat') {
      setIsStandaloneChat(true);
    }
  }, [currentTheme]);

  useEffect(() => {
    const handleToggle = () => toggleGlobalTheme();
    window.addEventListener('toggle-global-theme', handleToggle);
    return () => window.removeEventListener('toggle-global-theme', handleToggle);
  }, []);

  const handleAiAssistantAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiAssistantQuery.trim()) return;
    setIsAiAssistantLoading(true);
    setAiAssistantResponse(null);
    try {
      const response = await geminiService.generateTaskDescription(aiAssistantQuery, "CRM General Support");
      setAiAssistantResponse(response);
    } catch (error) {
      console.error("AI Assistant error:", error);
    }
    setIsAiAssistantLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Real-time listener for the current user's document
        const userRef = doc(db, 'users', user.uid);
        const unsubDoc = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as CRMUser;
            
            // Check if portal access is enabled or user is inactive/hidden
            const systemAdminEmails = ['irfanbcom2009@gmail.com', 'ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'];
            const isSystemAdmin = systemAdminEmails.includes(user.email || '');

            if (!isSystemAdmin && (userData.portalEnabled === false || userData.isActive === false || userData.isHidden === true)) {
              const reason = userData.isHidden === true ? "access has been restricted" : 
                            userData.isActive === false ? "account is inactive" : 
                            "portal access has been disabled";
              setLoginError(`Your ${reason}. Please contact your administrator.`);
              await signOut(auth);
              setUser(null);
              setCurrentUserDoc(null);
              return;
            }

            setCurrentUserDoc({ ...userData, id: docSnap.id });
            setUserRole(userData.role as UserRole);
            setUser(user);

            // Special handling for Ayesha Tariq - ensure full employee and client access
            const ayeshaEmails = ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'];
            if (ayeshaEmails.includes(user.email || '')) {
              const currentPerms = (userData.permissions || {}) as any;
              const needsUpdate = !currentPerms.employees || 
                                 !currentPerms.employees.view || 
                                 !currentPerms.employees.edit || 
                                 !currentPerms.employees.add || 
                                 !currentPerms.employees.delete ||
                                 !currentPerms.clients ||
                                 !currentPerms.clients.add ||
                                 !currentPerms.clients.edit ||
                                 !currentPerms.approvalRequests ||
                                 !currentPerms.resources;
              
              if (needsUpdate) {
                const updatedPerms: UserPermissions = {
                  ...(userData.permissions || {} as any),
                  employees: FULL_MODULE_PERMISSIONS,
                  clients: FULL_MODULE_PERMISSIONS,
                  approvalRequests: FULL_MODULE_PERMISSIONS,
                  resources: FULL_MODULE_PERMISSIONS,
                  registrars: FULL_MODULE_PERMISSIONS,
                  journals: FULL_MODULE_PERMISSIONS,
                  domains: FULL_MODULE_PERMISSIONS,
                  tasks: FULL_MODULE_PERMISSIONS,
                  invoices: FULL_MODULE_PERMISSIONS,
                  expenses: FULL_MODULE_PERMISSIONS,
                  publishers: FULL_MODULE_PERMISSIONS
                };
                await updateDoc(userRef, { 
                  permissions: updatedPerms,
                  role: 'Admin', // Also upgrade her role to Admin to bypass all restrictions
                  updatedAt: serverTimestamp()
                });
                // Update local state as well
                setCurrentUserDoc(prev => prev ? { ...prev, permissions: updatedPerms, role: 'Admin' } : null);
              }
            }

            // Special handling for Tayyaba Riasat - ensure journals and indexing agencies access
            const tayyabaEmails = ['taiba000120@gmail.com'];
            if (user.email && tayyabaEmails.includes(user.email.toLowerCase())) {
              const currentPerms = (userData.permissions || {}) as any;
              const needsUpdate = !currentPerms.journals || 
                                 !currentPerms.journals.view || 
                                 !currentPerms.journals.add ||
                                 !currentPerms.journals.edit ||
                                 !currentPerms.journals.delete ||
                                 !currentPerms.indexingAgencies ||
                                 !currentPerms.indexingAgencies.view ||
                                 !currentPerms.indexingAgencies.add ||
                                 !currentPerms.indexingAgencies.edit ||
                                 !currentPerms.indexingAgencies.delete ||
                                 !currentPerms.hecApplications ||
                                 !currentPerms.hecApplications.view ||
                                 !currentPerms.doajApplications ||
                                 !currentPerms.doajApplications.view ||
                                 !currentPerms.issnRequests ||
                                 !currentPerms.issnRequests.view ||
                                 !currentPerms.doiManagement ||
                                 !currentPerms.doiManagement.view;
              
              if (needsUpdate) {
                const updatedPerms: UserPermissions = {
                  ...(userData.permissions || {} as any),
                  journals: FULL_MODULE_PERMISSIONS,
                  indexingAgencies: FULL_MODULE_PERMISSIONS,
                  hecApplications: FULL_MODULE_PERMISSIONS,
                  doajApplications: FULL_MODULE_PERMISSIONS,
                  issnRequests: FULL_MODULE_PERMISSIONS,
                  doiManagement: FULL_MODULE_PERMISSIONS
                };
                
                await updateDoc(userRef, { 
                  permissions: updatedPerms,
                  updatedAt: serverTimestamp()
                });
                // Update local state as well
                setCurrentUserDoc(prev => prev ? { ...prev, permissions: updatedPerms } : null);
              }
            }

            setLoading(false);
          } else {
            // If doc doesn't exist by UID, check by email (legacy or first-time)
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0];
              const userData = { ...userDoc.data() as CRMUser, id: userDoc.id };
              
              // Check status for legacy users found by email
              const systemAdminEmails = ['irfanbcom2009@gmail.com', 'ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'];
              const isSystemAdmin = systemAdminEmails.includes(user.email || '');

              if (!isSystemAdmin && (userData.portalEnabled === false || userData.isActive === false || userData.isHidden === true)) {
                const reason = userData.isHidden === true ? "access has been restricted" : 
                              userData.isActive === false ? "account is inactive" : 
                              "portal access has been disabled";
                setLoginError(`Your ${reason}. Please contact your administrator.`);
                await signOut(auth);
                setUser(null);
                setCurrentUserDoc(null);
                return;
              }

              // Link this user to their UID if it's not already linked
              // This is critical for Firestore rules to work correctly
              if (userDoc.id !== user.uid) {
                await setDoc(doc(db, 'users', user.uid), {
                  ...userData,
                  uid: user.uid,
                  updatedAt: serverTimestamp()
                });
                try {
                  await deleteDoc(doc(db, 'users', userDoc.id));
                  console.log(`Successfully deleted legacy unlinked user doc ${userDoc.id}`);
                } catch (delErr) {
                  console.error("Error deleting legacy unlinked user doc:", delErr);
                }
              }

              setCurrentUserDoc({ ...userData, id: user.uid });
              setUserRole(userData.role as UserRole);
              setUser(user);

              // Special handling for Ayesha Tariq - ensure full employee and client access
              const ayeshaEmails = ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'];
              if (ayeshaEmails.includes(user.email || '')) {
                const currentPerms = (userData.permissions || {}) as any;
                const needsUpdate = !currentPerms.employees || 
                                   !currentPerms.employees.view || 
                                   !currentPerms.employees.edit || 
                                   !currentPerms.employees.add ||
                                   !currentPerms.employees.delete ||
                                   !currentPerms.clients ||
                                   !currentPerms.clients.add ||
                                   !currentPerms.clients.edit ||
                                   !currentPerms.approvalRequests ||
                                   !currentPerms.resources;
                
                if (needsUpdate) {
                  const updatedPerms: UserPermissions = {
                    ...(userData.permissions || {} as any),
                    employees: FULL_MODULE_PERMISSIONS,
                    clients: FULL_MODULE_PERMISSIONS,
                    approvalRequests: FULL_MODULE_PERMISSIONS,
                    resources: FULL_MODULE_PERMISSIONS,
                    registrars: FULL_MODULE_PERMISSIONS,
                    journals: FULL_MODULE_PERMISSIONS,
                    domains: FULL_MODULE_PERMISSIONS,
                    tasks: FULL_MODULE_PERMISSIONS,
                    invoices: FULL_MODULE_PERMISSIONS,
                    expenses: FULL_MODULE_PERMISSIONS,
                    publishers: FULL_MODULE_PERMISSIONS
                  };
                  await updateDoc(doc(db, 'users', user.uid), { 
                    permissions: updatedPerms,
                    role: 'Admin', // Upgrade her role to Admin
                    updatedAt: serverTimestamp()
                  });
                  // Update local state as well
                  setCurrentUserDoc(prev => prev ? { ...prev, permissions: updatedPerms, role: 'Admin' } : null);
                }
              }

              // Special handling for Tayyaba Riasat - ensure journals and indexing agencies access
              const tayyabaEmails = ['taiba000120@gmail.com'];
              if (user.email && tayyabaEmails.includes(user.email.toLowerCase())) {
                const currentPerms = (userData.permissions || {}) as any;
                const needsUpdate = !currentPerms.journals || 
                                   !currentPerms.journals.view || 
                                   !currentPerms.journals.add ||
                                   !currentPerms.journals.edit ||
                                   !currentPerms.journals.delete ||
                                   !currentPerms.indexingAgencies ||
                                   !currentPerms.indexingAgencies.view ||
                                   !currentPerms.indexingAgencies.add ||
                                   !currentPerms.indexingAgencies.edit ||
                                   !currentPerms.indexingAgencies.delete ||
                                   !currentPerms.hecApplications ||
                                   !currentPerms.hecApplications.view ||
                                   !currentPerms.doajApplications ||
                                   !currentPerms.doajApplications.view ||
                                   !currentPerms.issnRequests ||
                                   !currentPerms.issnRequests.view ||
                                   !currentPerms.doiManagement ||
                                   !currentPerms.doiManagement.view;
                
                if (needsUpdate) {
                  const updatedPerms: UserPermissions = {
                    ...(userData.permissions || {} as any),
                    journals: FULL_MODULE_PERMISSIONS,
                    indexingAgencies: FULL_MODULE_PERMISSIONS,
                    hecApplications: FULL_MODULE_PERMISSIONS,
                    doajApplications: FULL_MODULE_PERMISSIONS,
                    issnRequests: FULL_MODULE_PERMISSIONS,
                    doiManagement: FULL_MODULE_PERMISSIONS
                  };
                  
                  await updateDoc(doc(db, 'users', user.uid), { 
                    permissions: updatedPerms,
                    updatedAt: serverTimestamp()
                  });
                  // Update local state as well
                  setCurrentUserDoc(prev => prev ? { ...prev, permissions: updatedPerms } : null);
                }
              }

              setLoading(false);
            } else if (user.email === 'irfanbcom2009@gmail.com') {
              // Default Admin
              const newUser = {
                name: user.displayName || 'Irfan Rashid',
                email: user.email,
                role: 'Admin' as UserRole,
                points: 0,
                photoURL: user.photoURL,
                portalEnabled: true,
                createdAt: serverTimestamp()
              };
              await setDoc(doc(db, 'users', user.uid), newUser);
              setCurrentUserDoc({ ...newUser, id: user.uid } as any);
              setUserRole('Admin');
              setUser(user);
              setLoading(false);
            } else {
              // Unauthorized access attempt
              setUnauthorizedUser(user);
              setIsUnauthorized(true);
              setLoading(false);
              
              // Log unauthorized attempt in access_logs
              try {
                await addDoc(collection(db, 'access_logs'), {
                  email: user.email,
                  timestamp: new Date().toISOString(),
                  status: 'unauthorized',
                  userAgent: navigator.userAgent
                });
                
                // Also log in activity_logs for admin visibility
                await addDoc(collection(db, 'activity_logs'), {
                  action: 'UNAUTHORIZED_LOGIN_ATTEMPT',
                  details: `Email: ${user.email}`,
                  userName: user.displayName || 'Unknown',
                  userId: user.uid,
                  timestamp: serverTimestamp()
                });
              } catch (logError) {
                console.error("Error logging unauthorized attempt:", logError);
              }
            }
          }
        }, (err) => {
          console.error("User doc listener error:", err);
          setLoading(false);
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        });

        return () => unsubDoc();
      } else {
        setUser(null);
        setCurrentUserDoc(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Synchronize full target user document when impersonating
  useEffect(() => {
    if (!impersonatedUser) {
      setImpersonatedUserDoc(null);
      return;
    }

    const targetUserRef = doc(db, 'users', impersonatedUser.id);
    const unsubscribe = onSnapshot(targetUserRef, (docSnap) => {
      if (docSnap.exists()) {
        setImpersonatedUserDoc({
          ...docSnap.data() as CRMUser,
          id: docSnap.id
        });
      } else {
        // Fallback if user doc doesn't exist yet in DB
        setImpersonatedUserDoc({
          id: impersonatedUser.id,
          role: impersonatedUser.role,
          name: impersonatedUser.name,
          email: impersonatedUser.email,
          points: 0,
          createdAt: new Date().toISOString()
        } as CRMUser);
      }
    }, (error) => {
      console.error("Error listening to impersonated user doc:", error);
      handleFirestoreError(error, OperationType.GET, `users/${impersonatedUser.id}`);
    });

    return () => unsubscribe();
  }, [impersonatedUser]);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.branding) {
            setBranding(data.branding);
          }
        }
      } catch (error) {
        // If offline or connection fails, log a friendly warning instead of a blocking error.
        console.warn("Could not load global branding server-side (operating in offline-friendly mode with client defaults):", (error as any).message || error);
      }
    };
    fetchBranding();
  }, []);

  useEffect(() => {
    if (!currentUserDoc) return;
    
    const runDeduplication = async () => {
      const isSystemAdmin = currentUserDoc.role === 'Admin' || 
                           ['irfanbcom2009@gmail.com', 'ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUserDoc.email || '');
      
      if (!isSystemAdmin) return;
      
      try {
        console.log("[Deduplication] Running proactive database deduplication...");
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        const allUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        
        // Group by email (case-insensitive)
        const grouped: { [email: string]: any[] } = {};
        allUsers.forEach(u => {
          if (u.email) {
            const email = u.email.toLowerCase().trim();
            if (!grouped[email]) grouped[email] = [];
            grouped[email].push(u);
          }
        });
        
        for (const email of Object.keys(grouped)) {
          const docs = grouped[email];
          if (docs.length > 1) {
            console.log(`[Deduplication] Found ${docs.length} duplicates for ${email}`);
            
            // Sort:
            // 1. Prioritize fully linked/migrated documents where document ID matches the Firebase UID
            // 2. Docs with uid property next
            // 3. Active status
            // 4. Higher points first
            const sorted = [...docs].sort((a, b) => {
              const aIsLinked = a.uid && a.id === a.uid;
              const bIsLinked = b.uid && b.id === b.uid;
              if (aIsLinked && !bIsLinked) return -1;
              if (!aIsLinked && bIsLinked) return 1;

              if (a.uid && !b.uid) return -1;
              if (!a.uid && b.uid) return 1;
              if (a.status === 'active' && b.status !== 'active') return -1;
              if (a.status !== 'active' && b.status === 'active') return 1;
              return (b.points || 0) - (a.points || 0);
            });
            
            const keep = sorted[0];
            const toDelete = sorted.slice(1);
            
            console.log(`[Deduplication] Keeping doc: ${keep.id} with points: ${keep.points || 0}`);
            
            let extraPoints = 0;
            for (const delDoc of toDelete) {
              // Never delete the currently logged-in user's document
              if (currentUserDoc && delDoc.id === currentUserDoc.id) {
                console.log(`[Deduplication] Skipping deletion of currently logged-in user doc: ${delDoc.id}`);
                continue;
              }
              extraPoints += (delDoc.points || 0);
              console.log(`[Deduplication] Deleting duplicate doc: ${delDoc.id} with points: ${delDoc.points || 0}`);
              try {
                await deleteDoc(doc(db, 'users', delDoc.id));
              } catch (delErr) {
                console.error(`[Deduplication] Failed to delete duplicate doc ${delDoc.id}:`, delErr);
              }
            }
            
            // Also ensure the kept document is properly active and has combined points
            try {
              await updateDoc(doc(db, 'users', keep.id), {
                points: (keep.points || 0) + extraPoints,
                status: 'active',
                portalEnabled: true,
                isActive: true,
                isHidden: false,
                endingDate: '',
                updatedAt: serverTimestamp()
              });
            } catch (updErr) {
              console.error(`[Deduplication] Failed to update kept doc ${keep.id}:`, updErr);
            }
          }
        }
      } catch (err) {
        console.error("[Deduplication] Error during deduplication:", err);
      }
    };
    
    runDeduplication();
  }, [currentUserDoc]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette (⌘+K / Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        setCommandPaletteShowInfo(false);
      }
      
      // Keyboard Shortcuts (?)
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        setIsKeyboardShortcutsOpen(prev => !prev);
      }

      // Navigation Shortcuts (Alt + Key)
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            setActiveTab('dashboard');
            break;
          case 'c':
            e.preventDefault();
            setActiveTab('clients');
            break;
          case 'j':
            e.preventDefault();
            setActiveTab('journals');
            break;
          case 't':
            e.preventDefault();
            setActiveTab('tasks');
            break;
          case 'i':
            e.preventDefault();
            setActiveTab('invoices');
            break;
          case 's':
            e.preventDefault();
            setActiveTab('settings');
            break;
          case 'n':
            e.preventDefault();
            // Trigger some quick add logic if needed, or just let users use the menu
            // For now, we'll just log or show a hint
            break;
        }
      }

      // Search focus (/)
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        setCommandPaletteShowInfo(false);
      }
    };
    
    const handleOpenPalette = (e: Event) => {
      setIsCommandPaletteOpen(true);
      const customEvent = e as CustomEvent;
      setCommandPaletteShowInfo(customEvent.detail?.showInfo ?? false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenPalette);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenPalette);
    };
  }, []);

  useEffect(() => {
    if (!user || (userRole !== 'Admin' && userRole !== 'Manager')) {
      setPendingApprovalsCount(0);
      return;
    }

    let issnCount = 0;
    let indexingCount = 0;
    let taskCount = 0;
    let registrationCount = 0;

    const updateCount = () => setPendingApprovalsCount(issnCount + indexingCount + taskCount + registrationCount);

    const unsubIssn = onSnapshot(
      query(collection(db, 'issn_requests'), where('status', '==', 'pending')),
      (snapshot) => {
        issnCount = snapshot.size;
        updateCount();
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'issn_requests')
    );

    const unsubIndexing = onSnapshot(
      query(collection(db, 'journal_indexing'), where('status', 'in', ['applied', 'pending'])),
      (snapshot) => {
        indexingCount = snapshot.size;
        updateCount();
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'journal_indexing')
    );

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('status', '==', 'review')),
      (snapshot) => {
        taskCount = snapshot.size;
        updateCount();
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'tasks')
    );

    const unsubRegistrations = onSnapshot(
      query(collection(db, 'registration_requests'), where('status', '==', 'pending')),
      (snapshot) => {
        registrationCount = snapshot.size;
        updateCount();
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'registration_requests')
    );

    return () => {
      unsubIssn();
      unsubIndexing();
      unsubTasks();
      unsubRegistrations();
    };
  }, [user, userRole]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="text-indigo-500 animate-spin" size={48} />
      </div>
    );
  }

  if (isStandaloneChat) {
    return <StandaloneChat />;
  }

  if (isUnauthorized && unauthorizedUser) {
    return (
      <RegistrationFlow 
        user={unauthorizedUser} 
        onClose={async () => {
          await signOut(auth);
          setIsUnauthorized(false);
          setUnauthorizedUser(null);
          setShowLogin(false);
        }} 
      />
    );
  }

  if (!user) {
    if (showLogin) return <Login error={loginError} onBack={() => {
      setShowLogin(false);
      setLoginError(null);
    }} />;
    return <LandingPage onLogin={() => setShowLogin(true)} />;
  }

  const currentUser = (impersonatedUserDoc || impersonatedUser || currentUserDoc || {
    id: user?.uid || '',
    name: user?.displayName || 'Admin User',
    email: user?.email || '',
    role: userRole,
    points: 0,
    createdAt: new Date().toISOString()
  }) as CRMUser;

  const handleImpersonate = (targetUser: { id: string, role: UserRole, name: string, email: string } | null) => {
    setImpersonatedUser(targetUser);
    if (targetUser) {
      setActiveTab('dashboard');
    }
  };

  const renderContent = () => {
    // Check permissions for the active tab
    const tabToPermissionMap: Record<string, keyof UserPermissions> = {
      'approvals': 'approvalRequests',
      'journals': 'journals',
      'indexing': 'indexingAgencies',
      'publishers': 'publishers',
      'hec': 'hecApplications',
      'doaj': 'doajApplications',
      'issn': 'issnRequests',
      'doi': 'doiManagement',
      'domains': 'domains',
      'files': 'dataTools',
      'invoices': 'invoices',
      'expenses': 'expenses',
      'chat': 'resources',
      'policies': 'resources',
      'faq': 'resources',
      'notifications': 'notifications',
      'trash': 'trash',
      'employees': 'employees',
      'clients': 'clients',
      'tasks': 'tasks',
      'catalog': 'serviceCatalog',
      'catalog-manager': 'serviceCatalog',
      'registration-requests': 'approvalRequests',
      'access-logs': 'approvalRequests',
      'orders': 'invoices',
      'finance-dashboard': 'invoices',
      'payroll': 'payroll',
      'points': 'resources',
      'settings': 'settings'
    };

    const requiredPermission = tabToPermissionMap[activeTab];
    if (requiredPermission) {
      if (!canAccessModule(currentUser, requiredPermission)) {
        return <PermissionDenied onBack={() => setActiveTab('dashboard')} />;
      }
    }

    switch (activeTab) {
      case 'dashboard': 
        if (currentUser.role === 'Client') return <ClientDashboard currentUser={currentUser} setActiveTab={setActiveTab} />;
        return currentUser.role === 'Employee' ? <EmployeeDashboard currentUser={currentUser} setActiveTab={setActiveTab} /> : <Dashboard currentUser={currentUser} setActiveTab={setActiveTab} onSelectClient={setSelectedClientId} />;
      case 'chat': return (
        <div className="p-8 h-full">
          <ChatBoard 
            currentUser={currentUser} 
            targetClientId={selectedChatClientId || undefined} 
          />
        </div>
      );
      case 'approvals': return <ApprovalRequests />;
      case 'workflow': return <ClientSetupWorkflow />;
      case 'indexing': return <IndexingAgencies currentUser={currentUser} />;
      case 'clients': return (
        <Clients 
          searchQuery={searchQuery} 
          currentUser={currentUser} 
          setActiveTab={setActiveTab} 
          onImpersonate={handleImpersonate} 
          onOpenChat={(clientId) => {
            setSelectedChatClientId(clientId);
            setActiveTab('chat');
          }}
          initialClientId={selectedClientId || undefined}
          onClearInitialId={() => setSelectedClientId(null)}
        />
      );
      case 'domains': return (
        <Domains 
          searchQuery={searchQuery} 
          currentUser={currentUser} 
          initialDomainId={selectedDomainId || undefined}
          onClearInitialId={() => setSelectedDomainId(null)}
        />
      );
      case 'journals': return (
        <Journals 
          searchQuery={searchQuery} 
          currentUser={currentUser} 
          initialJournalId={selectedJournalId || undefined}
          onClearInitialId={() => setSelectedJournalId(null)}
          onNavigateToPublisher={(id) => {
            setSelectedPublisherId(id);
            setActiveTab('publishers');
          }}
        />
      );
      case 'publishers': return (
        <Publishers 
          searchQuery={searchQuery} 
          currentUser={currentUser} 
          initialPublisherId={selectedPublisherId || undefined}
          onClearInitialId={() => setSelectedPublisherId(null)}
          onNavigate={(tab, id) => {
            if (tab === 'journals') setSelectedJournalId(id);
            if (tab === 'domains') setSelectedDomainId(id);
            if (tab === 'clients') setSelectedClientId(id);
            setActiveTab(tab as any);
          }}
        />
      );
      case 'hec': return (
        <HEC 
          searchQuery={searchQuery} 
          currentUser={currentUser} 
          onNavigateToPublisher={(id) => {
            setSelectedPublisherId(id);
            setActiveTab('publishers');
          }}
        />
      );
      case 'doaj': return <DOAJApplications searchQuery={searchQuery} currentUser={currentUser} />;
      case 'issn': return (
        <ISSNRequests 
          searchQuery={searchQuery} 
          currentUser={currentUser} 
          onNavigateToPublisher={(id) => {
            setSelectedPublisherId(id);
            setActiveTab('publishers');
          }}
        />
      );
      case 'doi': return <DOIManagement currentUser={currentUser} />;
      case 'workflow-dashboard':
      case 'workflow-orders':
      case 'workflow-team':
      case 'workflow-logs':
        return (
          <WorkflowHub 
            currentUser={currentUser} 
            activeSection={
              activeTab === 'workflow-dashboard' ? 'dashboard' :
              activeTab === 'workflow-orders' ? 'orders' :
              activeTab === 'workflow-team' ? 'team' :
              activeTab === 'workflow-logs' ? 'logs' :
              'dashboard'
            } 
          />
        );
      case 'invoices': 
      case 'expenses': 
      case 'catalog': 
      case 'orders': 
      case 'tasks':
      case 'finance-dashboard': 
      case 'payroll': 
      case 'points': 
      case 'ops-finance-hub':
        return (
          <OperationsFinanceManager 
            currentUser={currentUser} 
            activeSection={
              activeTab === 'ops-finance-hub' ? 'hub' : 
              activeTab === 'catalog' ? 'catalog' : 
              activeTab === 'orders' ? 'orders' : 
              activeTab === 'tasks' ? 'tasks' :
              activeTab === 'invoices' ? 'invoices' :
              activeTab === 'payroll' ? 'payroll' :
              activeTab === 'expenses' ? 'expenses' :
              activeTab === 'points' ? 'points' :
              'hub'
            }
            onSectionChange={setActiveTab}
          />
        );
      case 'files': return <FileManager searchQuery={searchQuery} currentUser={currentUser} />;
      case 'leaderboard': return <PerformanceLeaderboard />;
      case 'policies': return <Policies currentUser={currentUser} />;
      case 'employees': return (
        <Employees 
          onImpersonate={handleImpersonate} 
          currentUser={currentUser} 
          onOpenChat={(userId) => {
            setSelectedChatClientId(userId);
            setActiveTab('chat');
          }}
        />
      );
      case 'notifications': return <Notifications />;
      case 'activity-history': return <ActivityHistory currentUser={currentUser} />;
      case 'trash': return <TrashManagement />;
      case 'settings': return <Settings currentUser={currentUser} onImpersonate={handleImpersonate} setActiveTab={setActiveTab} />;
      case 'dynamic-service': return <DynamicServiceRequester currentUser={currentUser} onComplete={() => setActiveTab('dashboard')} />;
      case 'service-wizard': return <ServiceOrderWizard currentUser={currentUser} onComplete={() => setActiveTab('dashboard')} />;
      case 'faq': return <FAQ currentUser={currentUser} />;
      default: return <Dashboard currentUser={currentUser} setActiveTab={setActiveTab} onSelectClient={setSelectedClientId} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={currentUser.role} 
        userPermissions={currentUser.permissions}
        userEmail={currentUser.email}
        userPhotoURL={currentUser.photoURL}
        userDepartment={currentUser.department}
        userSubscriptions={currentUser.subscriptions}
        onLogout={handleLogout}
        isImpersonating={!!impersonatedUser}
        onStopImpersonating={() => setImpersonatedUser(null)}
        pendingApprovalsCount={pendingApprovalsCount}
        branding={branding}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Impersonation Banner */}
        {impersonatedUser && (
          <div className="bg-amber-500 text-white px-8 py-2 flex items-center justify-between text-sm font-bold shrink-0 z-20">
            <div className="flex items-center gap-2">
              <Shield size={16} />
              Impersonating: {impersonatedUser.name} ({impersonatedUser.role})
            </div>
            <button 
              onClick={() => setImpersonatedUser(null)}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-all"
            >
              Stop Impersonation
            </button>
          </div>
        )}

        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between shrink-0 z-10 gap-4 md:gap-8">
          <div className="flex items-center gap-4">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'));
              }}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all md:hidden shrink-0 cursor-pointer"
            >
              <Menu size={20} />
            </button>

            {/* Path Indicator Breadcrumb */}
            <div className="flex items-center gap-2 select-none">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Portal</span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="text-xs md:text-sm font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Global Theme Toggle Switch */}
            <button
              onClick={toggleGlobalTheme}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer shrink-0 shadow-2xs group",
                currentTheme === 'dark'
                  ? "bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-750 hover:border-amber-500/50"
                  : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 hover:border-indigo-300"
              )}
              title={`Switch to ${currentTheme === 'dark' ? 'White (Light) Theme' : 'Black (Dark) Theme'}`}
            >
              {currentTheme === 'dark' ? (
                <>
                  <Sun size={18} className="text-amber-400 group-hover:rotate-45 transition-transform duration-300 shrink-0" />
                  <span className="hidden sm:inline font-extrabold text-slate-100">White Mode</span>
                </>
              ) : (
                <>
                  <Moon size={18} className="text-indigo-600 group-hover:-rotate-12 transition-transform duration-300 shrink-0" />
                  <span className="hidden sm:inline font-extrabold text-slate-800">Black Mode</span>
                </>
              )}
            </button>

            {/* Unified Search Icon Only */}
            <button 
              onClick={() => {
                setIsCommandPaletteOpen(true);
                setCommandPaletteShowInfo(true);
              }}
              className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl transition-all cursor-pointer relative group flex items-center justify-center shrink-0"
              title="Search System (⌘ K or /)"
            >
              <Search size={20} className="group-hover:scale-110 transition-transform duration-200" />
            </button>

            <button 
              onClick={() => setIsKeyboardShortcutsOpen(true)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all group relative cursor-pointer"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[8px] font-black rounded flex items-center justify-center border border-white dark:border-slate-900">?</span>
            </button>
            <button 
              onClick={() => setIsAiAssistantOpen(true)}
              className="hidden sm:flex items-center justify-center p-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none cursor-pointer shrink-0"
              title="AI Assistant"
            >
              <Sparkles size={18} />
            </button>
            <button 
              onClick={() => setActiveTab('workflow')}
              className="hidden lg:flex items-center justify-center p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-all border border-indigo-100 dark:border-indigo-900/30 cursor-pointer shrink-0"
              title="Quick Start"
            >
              <Layers size={18} />
            </button>
            <div 
              className="hidden xl:flex items-center justify-center p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-100 dark:border-emerald-900/30 shrink-0"
              title="LIVE CRM"
            >
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all relative cursor-pointer",
                  isNotificationsOpen && "bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                )}
              >
                <Bell size={20} />
                {(pendingApprovalsCount > 0) && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsNotificationsOpen(false)} 
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-40 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Notifications</h3>
                        <button 
                          onClick={() => {
                            setActiveTab('notifications');
                            setIsNotificationsOpen(false);
                          }}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-wider"
                        >
                          View All
                        </button>
                      </div>
                      
                      <div className="max-h-[400px] overflow-y-auto">
                        {(userRole === 'Admin' || userRole === 'Manager') && pendingApprovalsCount > 0 && (
                          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-amber-50/30 dark:bg-amber-950/10">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                                <CheckCircle2 size={16} />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-slate-900 dark:text-white">Pending Approvals</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">You have {pendingApprovalsCount} items awaiting your review.</p>
                                <button 
                                  onClick={() => {
                                    setActiveTab('approvals');
                                    setIsNotificationsOpen(false);
                                  }}
                                  className="mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                                >
                                  Review Now <ArrowRight size={10} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="p-8 text-center space-y-2">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-850 rounded-full flex items-center justify-center mx-auto text-slate-300 dark:text-slate-600">
                            <Bell size={24} />
                          </div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No new system notifications</p>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold">{currentUser.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.email}</p>
              </div>
              <div className="relative group">
                <img 
                  src={currentUser.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full bg-indigo-100 border border-slate-200 dark:border-slate-800 cursor-pointer object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all font-bold cursor-pointer"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {isDbConnected === false && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-3 flex items-start gap-3 text-amber-800 dark:text-amber-300">
              <ShieldAlert size={20} className="shrink-0 mt-0.5 text-amber-500 animate-pulse" />
              <div className="text-xs leading-normal">
                <span className="font-bold">Database Connection Notice:</span> The app is currently operating in offline-friendly mode. If you are using an adblocker (like uBlock Origin or standard AdBlock) or a VPN, please consider disabling it or allowing connection to Google Firebase services, as they are likely blocking the connection to the Firestore servers.
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Responsive Mobile Bottom Navigation Bar */}
        <div className="md:hidden block shrink-0 z-40">
          <MobileBottomNavigation 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            unreadCount={0} 
          />
        </div>
      </main>

      {user && (currentUser.role === 'Admin' || currentUser.role === 'Manager' || currentUser.role === 'Employee') && (
        <GlobalAddButton setActiveTab={setActiveTab} currentUser={currentUser} />
      )}

      {/* AI Assistant Modal */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
        onOpenShortcuts={() => setIsKeyboardShortcutsOpen(true)}
        userRole={currentUser.role}
        showInfo={commandPaletteShowInfo}
      />

      <KeyboardShortcutsModal 
        isOpen={isKeyboardShortcutsOpen}
        onClose={() => setIsKeyboardShortcutsOpen(false)}
      />

      <AnimatePresence>
        {isAiAssistantOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAiAssistantOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="px-6 py-4 bg-indigo-600 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="font-black">CRM AI Assistant</h3>
                </div>
                <button 
                  onClick={() => setIsAiAssistantOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {!aiAssistantResponse && !isAiAssistantLoading && (
                  <div className="text-center space-y-4 py-10">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                      <Sparkles size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">How can I help you?</h4>
                    <p className="text-sm text-slate-500 px-10">
                      Ask me anything about managing journals, publishers, DOI applications, or any other workflow in the CRM.
                    </p>
                  </div>
                )}

                {isAiAssistantLoading && (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                    <Loader2 className="animate-spin" size={32} />
                    <p className="text-sm font-medium italic">Thinking...</p>
                  </div>
                )}

                {aiAssistantResponse && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                      <Sparkles size={14} />
                      AI Response
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {aiAssistantResponse}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                <form onSubmit={handleAiAssistantAsk} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ask a question..."
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm shadow-sm"
                    value={aiAssistantQuery || ''}
                    onChange={e => setAiAssistantQuery(e.target.value)}
                  />
                  <button 
                    type="submit"
                    disabled={isAiAssistantLoading || !aiAssistantQuery.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
