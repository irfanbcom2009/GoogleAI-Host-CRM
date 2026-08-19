import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  User, 
  Shield, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Package,
  Loader2,
  MessageSquare,
  Search,
  Users as UsersIcon,
  Paperclip,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  where,
  doc, 
  getDoc,
  setDoc, 
  updateDoc,
  limit
} from 'firebase/firestore';
import { ChatMessage, ChatSession, User as UserType, ServiceType, Domain, Journal } from '../types';
import { cn } from '../lib/utils';
import { useServices } from '../hooks/useServices';

interface ChatBoardProps {
  currentUser: UserType;
  targetClientId?: string; // If admin is viewing, they need to know which client
  targetClientName?: string;
  onBack?: () => void;
}

export const ChatBoard: React.FC<ChatBoardProps> = ({ currentUser, targetClientId, targetClientName, onBack }) => {
  const { catalog: SERVICES_CATALOG } = useServices();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(targetClientId || (currentUser.role === 'Client' ? currentUser.id : null));
  const [activeClientName, setActiveClientName] = useState<string | null>(targetClientName || (currentUser.role === 'Client' ? currentUser.name : null));
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [hasSubscribedServices, setHasSubscribedServices] = useState<boolean | null>(null);

  useEffect(() => {
    if (currentUser.role !== 'Client') {
      setHasSubscribedServices(true);
      return;
    }

    // Check for subscribed domains or journals from us
    const unsubscribeDomains = onSnapshot(
      query(collection(db, 'domains'), where('clientId', '==', currentUser.id)),
      (snapshot) => {
        const domains = snapshot.docs.map(doc => doc.data() as Domain);
        const hasSubscribedDomain = domains.some(d => d.isDomainSubscribedFromUs || d.isHostingSubscribedFromUs);
        
        if (hasSubscribedDomain) {
          setHasSubscribedServices(true);
        } else {
          // If no domains, check journals
          onSnapshot(
            query(collection(db, 'journals'), where('clientId', '==', currentUser.id)),
            (journalSnapshot) => {
              const journals = journalSnapshot.docs.map(doc => doc.data() as Journal);
              const hasSubscribedJournal = journals.some(j => 
                j.isOjsSubscribedFromUs || 
                j.isIssnSubscribedFromUs || 
                j.isHecSubscribedFromUs || 
                j.isDoiSubscribedFromUs
              );
              setHasSubscribedServices(hasSubscribedJournal);
            }
          );
        }
      }
    );

    return () => unsubscribeDomains();
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    if (targetClientId && !targetClientName) {
      // Fetch name if only ID is provided
      getDoc(doc(db, 'users', targetClientId)).then(docSnap => {
        if (docSnap.exists()) {
          setActiveClientName(docSnap.data().name);
        }
      }).catch(console.error);
    }
  }, [targetClientId, targetClientName]);

  useEffect(() => {
    if (targetClientId) {
      setActiveClientId(targetClientId);
    }
    if (targetClientName) {
      setActiveClientName(targetClientName);
    }
  }, [targetClientId, targetClientName]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [orderForm, setOrderForm] = useState({
    serviceType: 'Hosting' as ServiceType | string,
    amount: 0,
    description: '',
    isCustom: true
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch all users for new chat
  useEffect(() => {
    if (currentUser.role === 'Client' || !isNewChatModalOpen) return;

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as UserType))
        .filter(u => u.id !== currentUser.id);
      setAllUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    return () => unsubscribe();
  }, [currentUser.role, isNewChatModalOpen, currentUser.id]);

  // Fetch all chat sessions for staff
  useEffect(() => {
    if (currentUser.role === 'Client') return;

    const q = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatSession[]);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'chats'));

    return () => unsubscribe();
  }, [currentUser.role]);

  useEffect(() => {
    if (!activeClientId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'chats', activeClientId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(messageData);
      setLoading(false);
      
      // Mark as read if admin/manager
      if (currentUser.role !== 'Client') {
        updateDoc(doc(db, 'chats', activeClientId), {
          unreadCount: 0
        }).catch(console.error);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${activeClientId}/messages`);
    });

    return () => unsubscribe();
  }, [activeClientId, currentUser.role]);

  useEffect(() => {
    if (scrollRef.current && !messageSearchQuery) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, messageSearchQuery]);

  const filteredMessages = messages.filter(m => 
    m.text.toLowerCase().includes(messageSearchQuery.toLowerCase()) ||
    (m.orderData?.description && m.orderData.description.toLowerCase().includes(messageSearchQuery.toLowerCase())) ||
    m.senderName.toLowerCase().includes(messageSearchQuery.toLowerCase())
  );

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleStartChat = (user: UserType) => {
    setActiveClientId(user.id);
    setActiveClientName(user.name);
    setIsNewChatModalOpen(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeClientId) return;

    const messageText = newMessage;
    setNewMessage('');

    try {
      const messageData = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        text: messageText,
        type: 'text',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'chats', activeClientId, 'messages'), messageData);

      // Update session
      await setDoc(doc(db, 'chats', activeClientId), {
        clientId: activeClientId,
        clientName: activeClientName || 'Unknown Client',
        lastMessage: messageText,
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unreadCount: currentUser.role === 'Client' ? 1 : 0 // Simple unread logic
      }, { merge: true });

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${activeClientId}/messages`);
    }
  };

  const handleFileAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeClientId) return;

    // Limit file size to 1MB for Firestore
    if (file.size > 1024 * 1024) {
      alert("File size exceeds 1MB. Please upload a smaller file.");
      return;
    }

    setIsAttaching(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      
      const messageData = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        text: file.name,
        fileData: base64,
        type: 'file',
        createdAt: new Date().toISOString()
      };

      try {
        await addDoc(collection(db, 'chats', activeClientId, 'messages'), messageData);
        
        // Update session
        await setDoc(doc(db, 'chats', activeClientId), {
          clientId: activeClientId,
          clientName: activeClientName || 'Unknown Client',
          lastMessage: `File: ${file.name}`,
          lastMessageAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          unreadCount: currentUser.role === 'Client' ? 1 : 0
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `chats/${activeClientId}/messages`);
      } finally {
        setIsAttaching(false);
      }
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClientId || orderForm.amount <= 0 || !orderForm.description.trim()) return;

    setLoading(true);
    try {
      // 1. Create Order Message
      const messageData = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        text: `New Order: ${orderForm.serviceType} - ${orderForm.description}`,
        type: 'order',
        orderData: { ...orderForm },
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'chats', activeClientId, 'messages'), messageData);

      // 2. Create Invoice
      const invoiceRef = await addDoc(collection(db, 'invoices'), {
        clientId: activeClientId,
        clientName: activeClientName,
        items: [{
          description: `${orderForm.serviceType}: ${orderForm.description}`,
          quantity: 1,
          unitPrice: orderForm.amount,
          total: orderForm.amount
        }],
        subtotal: orderForm.amount,
        tax: 0,
        total: orderForm.amount,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        isVerified: false
      });

      // 3. Create Todo Task
      await addDoc(collection(db, 'tasks'), {
        clientId: activeClientId,
        clientName: activeClientName,
        serviceType: orderForm.serviceType,
        title: `Order: ${orderForm.serviceType} for ${activeClientName}`,
        description: orderForm.description,
        assignedTo: '', // Unassigned initially
        status: 'pending',
        priority: 'medium',
        points: 10,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isClientVisible: true,
        invoiceId: invoiceRef.id
      });

      setIsOrdering(false);
      setOrderForm({ serviceType: 'Hosting', amount: 0, description: '', isCustom: true });
      
      // Update session
      await setDoc(doc(db, 'chats', activeClientId), {
        clientId: activeClientId,
        clientName: activeClientName,
        lastMessage: `ORDER PLACED: ${orderForm.serviceType}`,
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'order');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !activeClientId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mr-2" />
        Loading chats...
      </div>
    );
  }

  if (currentUser.role === 'Client' && hasSubscribedServices === false) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-2">
          <Shield size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Subscription Required</h2>
        <p className="text-slate-500 max-w-md font-medium">
          Live chat is only available for clients with at least one active service subscription. 
          Please subscribe to a service or contact support via email to enable this feature.
        </p>
        <div className="pt-4">
          <button 
            onClick={onBack}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // If staff and no client selected, show session list
  if (currentUser.role !== 'Client' && !activeClientId) {
    return (
      <div className="h-full flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900">Live Chat Sessions</h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsNewChatModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={18} />
              New Chat
            </button>
            <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">
              {sessions.length} Active Conversations
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2">
          {sessions.map((session) => (
            <motion.button
              key={session.id}
              whileHover={{ y: -4 }}
              onClick={() => {
                setActiveClientId(session.id);
                setActiveClientName(session.clientName);
              }}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group relative overflow-hidden"
            >
              {session.unreadCount > 0 && (
                <div className="absolute top-0 right-0 bg-red-500 text-white px-3 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-wider">
                  {session.unreadCount} New
                </div>
              )}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xl">
                  {session.clientName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{session.clientName}</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {session.lastMessageAt ? new Date(session.lastMessageAt).toLocaleString() : 'No messages'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600 line-clamp-2 font-medium italic">
                "{session.lastMessage || 'Start a conversation...'}"
              </p>
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">View Chat</span>
                <MessageSquare size={16} className="text-slate-300 group-hover:text-indigo-600 transition-all" />
              </div>
            </motion.button>
          ))}

          {sessions.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold">No active chat sessions found.</p>
              <p className="text-xs mt-1">Start a new chat or wait for clients to message you.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all border border-transparent hover:border-slate-200 lg:hidden"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          {currentUser.role !== 'Client' && !onBack && (
            <button 
              onClick={() => setActiveClientId(null)}
              className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all border border-transparent hover:border-slate-200"
            >
              <Plus className="rotate-45" size={20} />
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
            {activeClientName?.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{activeClientName}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Live Support
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 transition-all",
            isSearchVisible ? "w-48 sm:w-64 opacity-100" : "w-0 opacity-0 overflow-hidden border-transparent p-0"
          )}>
            <Search size={14} className="text-slate-400 mr-2" />
            <input 
              type="text"
              placeholder="Search messages..."
              className="bg-transparent text-xs outline-none w-full font-medium"
              value={messageSearchQuery || ''}
              onChange={e => setMessageSearchQuery(e.target.value)}
            />
            {messageSearchQuery && (
              <button onClick={() => setMessageSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button 
            onClick={() => {
              setIsSearchVisible(!isSearchVisible);
              if (isSearchVisible) setMessageSearchQuery('');
            }}
            className={cn(
              "p-2 rounded-xl transition-all",
              isSearchVisible ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 bg-white border border-slate-200"
            )}
            title="Search history"
          >
            <Search size={20} />
          </button>
          <button 
            onClick={() => setIsOrdering(true)}
            disabled={hasSubscribedServices === false}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-indigo-700 transition-all shadow-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="hidden xs:inline">Place Order</span>
            <span className="xs:hidden">Order</span>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <Loader2 className="animate-spin" size={24} />
            <p className="text-xs font-medium">Loading conversation...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 text-center max-w-xs mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Search size={32} className="opacity-20" />
            </div>
            <div>
              <p className="font-bold text-slate-600">{messageSearchQuery ? 'No results found' : 'Start a conversation'}</p>
              <p className="text-xs">{messageSearchQuery ? `No messages matching "${messageSearchQuery}"` : 'Ask a question or place an order for any service.'}</p>
            </div>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div 
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.senderId === currentUser.id ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "px-4 py-3 rounded-2xl text-sm shadow-sm",
                msg.senderId === currentUser.id 
                  ? "bg-indigo-600 text-white rounded-tr-none" 
                  : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
              )}>
                {msg.type === 'order' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-bold border-b border-white/20 pb-2 mb-2">
                      <Package size={16} />
                      SERVICE ORDER
                    </div>
                    <p className="font-medium">{msg.orderData?.serviceType}</p>
                    <p className="text-xs opacity-90">{msg.orderData?.description}</p>
                    <div className="flex items-center gap-1 font-bold text-lg">
                      <DollarSign size={16} />
                      {msg.orderData?.amount}
                    </div>
                  </div>
                ) : msg.type === 'file' ? (
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      msg.senderId === currentUser.id ? "bg-white/20" : "bg-indigo-50"
                    )}>
                      <Paperclip size={20} className={msg.senderId === currentUser.id ? "text-white" : "text-indigo-600"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-xs">{msg.text}</p>
                      <a 
                        href={msg.fileData} 
                        download={msg.text}
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-widest hover:underline mt-1 inline-block",
                          msg.senderId === currentUser.id ? "text-white/80" : "text-indigo-600"
                        )}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{msg.senderName}</span>
                <span className="text-[10px] text-slate-300 font-medium tracking-tight">
                  {formatMessageTime(msg.createdAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleSendMessage}
        className="p-4 bg-white border-t border-slate-100 flex items-center gap-3"
      >
        <input 
          type="file"
          id="chat-attachment"
          className="hidden"
          onChange={handleFileAttachment}
        />
        <button
          type="button"
          disabled={isAttaching || hasSubscribedServices === false}
          onClick={() => document.getElementById('chat-attachment')?.click()}
          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Attach File"
        >
          {isAttaching ? <Loader2 className="animate-spin" size={20} /> : <Paperclip size={20} />}
        </button>
        <input 
          type="text" 
          placeholder={hasSubscribedServices === false ? "Support restricted to subscribed services only" : "Type your message..."}
          disabled={hasSubscribedServices === false}
          className="flex-1 px-4 py-2.5 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          value={newMessage || ''}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button 
          type="submit"
          disabled={!newMessage.trim() || hasSubscribedServices === false}
          className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={20} />
        </button>
      </form>

      {/* Order Modal */}
      <AnimatePresence>
        {isNewChatModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                    <UsersIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Start New Chat</h3>
                    <p className="text-xs text-slate-500">Select a client or employee</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search users..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    value={userSearchQuery || ''}
                    onChange={e => setUserSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {allUsers
                  .filter(u => 
                    u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                  )
                  .map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleStartChat(user)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{user.name}</p>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                            user.role === 'Client' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                          )}>
                            {user.role}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">{user.email}</span>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-all" />
                    </button>
                  ))
                }
                {allUsers.length === 0 && (
                  <div className="py-10 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" />
                    <p className="text-sm">Loading users...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {isOrdering && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Place New Order</h3>
                    <p className="text-xs text-slate-500">Select service and details</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOrdering(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <AlertCircle className="rotate-45" size={24} />
                </button>
              </div>

              <form onSubmit={handlePlaceOrder} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Service Type</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                    value={orderForm.isCustom ? 'custom' : orderForm.serviceType || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setOrderForm(prev => ({ ...prev, isCustom: true, serviceType: 'Hosting' }));
                      } else {
                        const [catId, itemTitle] = val.split('|');
                        const category = SERVICES_CATALOG.find(c => c.id === catId);
                        const item = category?.items.find(i => i.title === itemTitle);
                        if (item) {
                          setOrderForm({
                            serviceType: item.title,
                            amount: item.price,
                            description: item.description,
                            isCustom: false
                          });
                        }
                      }
                    }}
                  >
                    <option value="custom">Custom Service</option>
                    {SERVICES_CATALOG.map(cat => (
                      <optgroup key={cat.id} label={cat.category}>
                        {cat.items.map(item => (
                          <option key={item.title} value={`${cat.id}|${item.title}`}>
                            {item.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {orderForm.isCustom && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Custom Service Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      placeholder="e.g. Specialized Indexing"
                      value={orderForm.serviceType || ''}
                      onChange={e => setOrderForm(prev => ({ ...prev, serviceType: e.target.value }))}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Amount (PKR)</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">PKR</div>
                    <input 
                      type="number" 
                      required
                      min="1"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      placeholder="0"
                      value={orderForm.amount || ''}
                      onChange={e => setOrderForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Description</label>
                  <textarea 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium min-h-[100px]"
                    placeholder="Describe what you need..."
                    value={orderForm.description || ''}
                    onChange={e => setOrderForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsOrdering(false)}
                    className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    Confirm Order
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
