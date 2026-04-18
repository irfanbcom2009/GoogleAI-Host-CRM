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
import { InvoiceModule } from './components/InvoiceModule';
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
import { Services } from './components/Services';
import { CatalogManager } from './components/CatalogManager';
import { OrderManagement } from './components/OrderManagement';
import { FinanceDashboard } from './components/FinanceDashboard';
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
import { Search, Bell, LogOut, Loader2, Shield, Layers, Sparkles, Send, X, CheckCircle2, ArrowRight, ShieldCheck, MessageSquare, UserPlus, ShieldAlert, Command, Keyboard } from 'lucide-react';
import { cn } from './lib/utils';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole, User as CRMUser, UserPermissions } from './types';
import { geminiService } from './services/geminiService';
import { FULL_MODULE_PERMISSIONS } from './lib/permissions';

import { PerformanceLeaderboard } from './components/PerformanceLeaderboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [currentUserDoc, setCurrentUserDoc] = useState<CRMUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('Employee');
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState<{ id: string, role: UserRole, name: string, email: string } | null>(null);
  const [selectedChatClientId, setSelectedChatClientId] = useState<string | null>(null);
  const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
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

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'chat') {
      setIsStandaloneChat(true);
    }
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
            if (userData.portalEnabled === false || userData.isActive === false || userData.isHidden === true) {
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
              if (userData.portalEnabled === false || userData.isActive === false || userData.isHidden === true) {
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
                  await updateDoc(doc(db, 'users', userData.id), { 
                    permissions: updatedPerms,
                    role: 'Admin', // Upgrade her role to Admin
                    updatedAt: serverTimestamp()
                  });
                  // Update local state as well
                  setCurrentUserDoc(prev => prev ? { ...prev, permissions: updatedPerms, role: 'Admin' } : null);
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
        console.error("Error fetching branding:", error);
      }
    };
    fetchBranding();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette (⌘+K / Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const currentUser = (impersonatedUser || currentUserDoc || {
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
      'points': 'resources',
      'settings': 'settings'
    };

    const requiredPermission = tabToPermissionMap[activeTab];
    if (requiredPermission && currentUser.permissions) {
      const modulePerms = (currentUser.permissions as any)[requiredPermission];
      if (modulePerms && typeof modulePerms === 'object') {
        if (modulePerms.view === false) {
          return <PermissionDenied onBack={() => setActiveTab('dashboard')} />;
        }
      }
    }

    switch (activeTab) {
      case 'dashboard': 
        if (currentUser.role === 'Client') return <ClientDashboard currentUser={currentUser} setActiveTab={setActiveTab} />;
        return currentUser.role === 'Employee' ? <EmployeeDashboard currentUser={currentUser} setActiveTab={setActiveTab} /> : <Dashboard currentUser={currentUser} setActiveTab={setActiveTab} />;
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
            setActiveTab(tab as any);
          }}
        />
      );
      case 'hec': return <HEC searchQuery={searchQuery} currentUser={currentUser} />;
      case 'doaj': return <DOAJApplications searchQuery={searchQuery} currentUser={currentUser} />;
      case 'issn': return <ISSNRequests searchQuery={searchQuery} currentUser={currentUser} />;
      case 'doi': return <DOIManagement currentUser={currentUser} />;
      case 'invoices': return <InvoiceModule currentUser={currentUser} />;
      case 'expenses': return <Expenses currentUser={currentUser} />;
      case 'files': return <FileManager searchQuery={searchQuery} />;
      case 'file-requests': return <FileRequests searchQuery={searchQuery} />;
      case 'tasks': return <Tasks searchQuery={searchQuery} currentUser={currentUser} />;
      case 'catalog': return <ServiceCatalog currentUser={currentUser} />;
      case 'catalog-manager': return <CatalogManager currentUser={currentUser} />;
      case 'registration-requests': return <RegistrationRequests />;
      case 'access-logs': return <AccessLogs />;
      case 'orders': return <OrderManagement currentUser={currentUser} />;
      case 'finance-dashboard': return <FinanceDashboard currentUser={currentUser} />;
      case 'points': return <Points />;
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
      case 'faq': return <FAQ />;
      default: return <Dashboard currentUser={currentUser} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={currentUser.role} 
        userPermissions={currentUser.permissions}
        userEmail={currentUser.email}
        userPhotoURL={currentUser.photoURL}
        userDepartment={currentUser.department}
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
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 z-10 gap-8">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsCommandPaletteOpen(true)}
              className="relative w-full group transition-all"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors" size={20} />
              <div className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-slate-500 group-hover:bg-white group-hover:border-indigo-300 group-hover:shadow-md transition-all cursor-text">
                <span className="text-sm font-medium tracking-tight">Search for anything... (Employee, Journal, ISSN, Domain, Client)</span>
                <div className="flex items-center gap-1.5 px-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Quick Search</span>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold shadow-sm">⌘ K</kbd>
                  <kbd className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold shadow-sm">/</kbd>
                </div>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsKeyboardShortcutsOpen(true)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all group relative"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-slate-200 text-slate-600 text-[8px] font-black rounded flex items-center justify-center border border-white">?</span>
            </button>
            <button 
              onClick={() => setIsAiAssistantOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Sparkles size={18} />
              AI Assistant
            </button>
            <button 
              onClick={() => setActiveTab('workflow')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all border border-indigo-100"
            >
              <Layers size={18} />
              Quick Start
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              LIVE CRM
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all relative",
                  isNotificationsOpen && "bg-slate-100 text-indigo-600"
                )}
              >
                <Bell size={20} />
                {(pendingApprovalsCount > 0) && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
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
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-40 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-sm text-slate-900">Notifications</h3>
                        <button 
                          onClick={() => {
                            setActiveTab('notifications');
                            setIsNotificationsOpen(false);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                        >
                          View All
                        </button>
                      </div>
                      
                      <div className="max-h-[400px] overflow-y-auto">
                        {(userRole === 'Admin' || userRole === 'Manager') && pendingApprovalsCount > 0 && (
                          <div className="p-4 border-b border-slate-100 bg-amber-50/30">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                <CheckCircle2 size={16} />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-slate-900">Pending Approvals</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">You have {pendingApprovalsCount} items awaiting your review.</p>
                                <button 
                                  onClick={() => {
                                    setActiveTab('approvals');
                                    setIsNotificationsOpen(false);
                                  }}
                                  className="mt-2 text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 uppercase tracking-wider"
                                >
                                  Review Now <ArrowRight size={10} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="p-8 text-center space-y-2">
                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                            <Bell size={24} />
                          </div>
                          <p className="text-xs font-medium text-slate-500">No new system notifications</p>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold">{currentUser.name}</p>
                <p className="text-xs text-slate-500">{currentUser.email}</p>
              </div>
              <div className="relative group">
                <img 
                  src={currentUser.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full bg-indigo-100 border border-slate-200 cursor-pointer object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-all font-bold"
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
                    value={aiAssistantQuery}
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
