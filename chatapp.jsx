import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  onSnapshot, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Phone, 
  Video, 
  Monitor, 
  FileText, 
  Download, 
  Image as ImageIcon, 
  Send, 
  Paperclip, 
  User, 
  Settings, 
  LogOut, 
  Users, 
  ChevronLeft,
  X,
  Mic, 
  MicOff,
  PhoneOff,
  Bell,
  Sun,
  Moon,
  ExternalLink,
  Edit2,
  Navigation,
  Loader2
} from 'lucide-react';

// --- Configuración Firebase ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Estilos Globales (Tipografía Inter & Scroll) ---
const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
      -webkit-font-smoothing: antialiased; 
    }
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(155, 155, 155, 0.2); border-radius: 10px; }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
  `}} />
);

// --- Utilidad para Links Clickables ---
const renderMessageText = (text) => {
  if (typeof text !== 'string') return text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline break-all hover:opacity-80">
          {part}
        </a>
      );
    }
    return part;
  });
};

// --- Componentes Reutilizables ---
const Avatar = ({ name, size = "md", src = null, status = null }) => {
  const sizes = {
    sm: "w-8 h-8 text-[10px]",
    md: "w-10 h-10 text-xs",
    lg: "w-11 h-11 text-sm",
    xl: "w-16 h-16 text-lg",
    "2xl": "w-24 h-24 text-2xl"
  };
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || "??";
  return (
    <div className="relative flex-shrink-0">
      {src ? (
        <img src={src} className={`${sizes[size]} rounded-full object-cover border dark:border-zinc-800`} alt={name} />
      ) : (
        <div className={`${sizes[size]} rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-semibold text-zinc-500 dark:text-zinc-400 border dark:border-zinc-800`}>
          {initials}
        </div>
      )}
      {status === 'online' && (
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-950 bg-green-500" />
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [view, setView] = useState('chats'); 
  const [darkMode, setDarkMode] = useState(true);
  
  // Signaling States
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, incoming, active
  const [activeCall, setActiveCall] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // 1. Auth Inicialización (Regla 3)
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Listener de Llamadas (Signaling)
  useEffect(() => {
    if (!user) return;
    const callsRef = collection(db, 'artifacts', appId, 'public', 'data', 'calls');
    const unsubscribe = onSnapshot(callsRef, (snapshot) => {
      const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const myCall = calls.find(c => c.to === user.uid || c.from === user.uid);
      
      if (myCall) {
        setActiveCall(myCall);
        if (myCall.status === 'pending' && myCall.to === user.uid) setCallStatus('incoming');
        else if (myCall.status === 'pending' && myCall.from === user.uid) setCallStatus('calling');
        else if (myCall.status === 'accepted') setCallStatus('active');
      } else {
        setCallStatus('idle');
        setActiveCall(null);
      }
    }, (error) => console.error("Error calls listener:", error));
    return () => unsubscribe();
  }, [user]);

  // 3. Carga de Chats y Mensajes
  useEffect(() => {
    if (!user) return;
    const chatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats');
    const unsubscribe = onSnapshot(chatsRef, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(chatList);
      if (chatList.length === 0) {
        addDoc(chatsRef, { name: "Workspace General", type: "group", members: [user.uid], lastMsg: "Bienvenidos al equipo" });
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !activeChat) return;
    const msgsRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const unsubscribe = onSnapshot(msgsRef, (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = allMsgs
        .filter(m => m.chatId === activeChat.id)
        .sort((a, b) => a.createdAt - b.createdAt);
      setMessages(filtered);
    });
    return () => unsubscribe();
  }, [user, activeChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, callStatus]);

  // Funciones de Negocio
  const toggleDarkMode = () => setDarkMode(!darkMode);

  const startCall = async () => {
    if (!activeChat || !user) return;
    const callsRef = collection(db, 'artifacts', appId, 'public', 'data', 'calls');
    await addDoc(callsRef, {
      from: user.uid,
      fromName: user.displayName || "Usuario",
      to: activeChat.id,
      toName: activeChat.name,
      status: 'pending',
      createdAt: Date.now()
    });
  };

  const acceptCall = async () => {
    if (!activeCall) return;
    const callRef = doc(db, 'artifacts', appId, 'public', 'data', 'calls', activeCall.id);
    await updateDoc(callRef, { status: 'accepted' });
  };

  const endCall = async () => {
    if (!activeCall) return;
    const callRef = doc(db, 'artifacts', appId, 'public', 'data', 'calls', activeCall.id);
    await deleteDoc(callRef);
  };

  const handleSendMessage = async (text = input, type = 'text', file = null) => {
    if (!text.trim() && type === 'text') return;
    const msgsRef = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    await addDoc(msgsRef, {
      chatId: activeChat.id,
      senderId: user.uid,
      senderName: user.displayName || "Usuario",
      text, type, file,
      createdAt: Date.now()
    });
    const chatRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChat.id);
    await updateDoc(chatRef, { lastMsg: type === 'file' ? `Archivo: ${file.name}` : text });
    setInput('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setTimeout(() => {
      handleSendMessage('', 'file', { name: file.name, size: (file.size/1024).toFixed(1) + 'KB' });
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 1200);
  };

  return (
    <div className={`${darkMode ? 'dark' : ''} h-screen flex flex-col overflow-hidden`}>
      <GlobalStyles />
      <div className="flex-1 flex bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
        
        {/* SIDEBAR */}
        <aside className={`w-[320px] border-r dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 z-20 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="h-16 flex-shrink-0 border-b dark:border-zinc-800 flex justify-between items-center px-6">
            <h1 className="text-[19px] font-bold tracking-tight uppercase">ChatApp</h1>
            <div className="flex items-center gap-1">
              <button onClick={toggleDarkMode} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors text-zinc-500">
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
              <input type="text" placeholder="Buscar chats..." className="w-full bg-zinc-100 dark:bg-zinc-900/50 border-none rounded-xl py-2 pl-9 pr-4 text-sm outline-none font-medium placeholder:font-normal" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b dark:border-zinc-800 flex items-center gap-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
              <div className="w-11 h-11 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900">
                <Navigation size={18} className="rotate-90" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-[15px]">New chat</h3>
                <p className="text-zinc-400 text-xs font-normal">Invite someone by email</p>
              </div>
            </div>

            {chats.map(chat => (
              <div 
                key={chat.id} 
                onClick={() => { setActiveChat(chat); setView('chats'); }}
                className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${activeChat?.id === chat.id ? 'bg-zinc-100 dark:bg-zinc-900' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/30'}`}
              >
                <Avatar name={chat.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-semibold text-[15px] truncate leading-tight">{chat.name}</h3>
                    <span className="text-[10px] text-zinc-400 font-medium">11:35 AM</span>
                  </div>
                  <p className="text-[13px] text-zinc-400 truncate font-normal leading-tight">{chat.lastMsg}</p>
                </div>
              </div>
            ))}
          </div>

          {/* User Footer (Discord Style) */}
          <div className="h-16 flex-shrink-0 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-t dark:border-zinc-800 flex items-center gap-3">
            <div className="cursor-pointer hover:opacity-80" onClick={() => setView('profile')}>
              <Avatar name={user?.displayName || "Me"} size="sm" status="online" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold truncate leading-tight mb-0.5">{user?.displayName || "Usuario Anon"}</p>
              <p className="text-[9px] text-green-500 font-bold uppercase tracking-wider leading-none">En línea</p>
            </div>
            <div className="flex gap-0.5">
              <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"><Mic size={15} /></button>
              <button 
                onClick={() => setView(view === 'profile' ? 'chats' : 'profile')}
                className={`p-1.5 rounded-lg transition-colors ${view === 'profile' ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
              >
                <Settings size={15} />
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN AREA */}
        <main className="flex-1 flex flex-col relative bg-white dark:bg-zinc-950">
          
          {/* Llamada Entrante Modal */}
          {callStatus === 'incoming' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs animate-in slide-in-from-top duration-300">
              <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={activeCall?.fromName} />
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Incoming call</p>
                    <p className="text-sm font-semibold">{activeCall?.fromName}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={endCall} className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl hover:bg-red-200"><X size={18} /></button>
                  <button onClick={acceptCall} className="p-2 bg-green-500 text-white rounded-xl hover:bg-green-600 animate-pulse"><Phone size={18} /></button>
                </div>
              </div>
            </div>
          )}

          {activeChat && view === 'chats' ? (
            <>
              <header className="h-16 flex-shrink-0 border-b dark:border-zinc-800 px-6 flex justify-between items-center bg-white dark:bg-zinc-950 z-10">
                <div className="flex items-center gap-4">
                  <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 text-zinc-500"><ChevronLeft size={20} /></button>
                  <Avatar name={activeChat.name} size="md" />
                  <div>
                    <h2 className="font-semibold text-[15px] leading-tight">{activeChat.name}</h2>
                    <span className="text-zinc-400 text-xs font-normal">Active now</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={startCall}
                    disabled={callStatus !== 'idle'}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-semibold uppercase transition-all ${callStatus !== 'idle' ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400' : 'bg-green-600 text-white hover:bg-green-700'}`}
                  >
                    <Phone size={14} fill="currentColor" />
                    <span>{callStatus === 'calling' ? 'Calling...' : 'Llamada'}</span>
                  </button>
                  <button onClick={() => setIsSharingScreen(!isSharingScreen)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                    <Monitor size={18} />
                  </button>
                  <button className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </header>

              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* CALL INTERFACE (Pinned top) */}
                {(callStatus === 'active' || callStatus === 'calling') && (
                  <div className="flex-shrink-0 p-4 bg-zinc-50 dark:bg-zinc-900/30 border-b dark:border-zinc-800 animate-in slide-in-from-top duration-500">
                    <div className="max-w-3xl mx-auto bg-zinc-950 rounded-[2rem] aspect-video relative overflow-hidden shadow-2xl border dark:border-zinc-800 flex flex-col items-center justify-center">
                      <div className="absolute top-6 left-6 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full z-10">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">{callStatus === 'active' ? 'LIVE' : 'CONNECTING'}</span>
                      </div>
                      
                      <div className="flex flex-col items-center text-center p-8">
                        <Avatar name={activeCall?.toName || activeChat.name} size="xl" />
                        <h3 className="text-white font-bold uppercase tracking-widest text-lg mt-6 leading-none">{activeCall?.toName || activeChat.name}</h3>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-3">{callStatus === 'calling' ? 'Calling contact...' : isSharingScreen ? 'Sharing screen' : 'Voice call'}</p>
                      </div>

                      <div className="absolute bottom-8 flex items-center gap-4 px-6 py-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10">
                        <button onClick={() => setIsMicMuted(!isMicMuted)} className={`p-3 rounded-xl transition-all ${isMicMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}</button>
                        <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white"><Video size={18} /></button>
                        <button onClick={() => setIsSharingScreen(!isSharingScreen)} className={`p-3 rounded-xl transition-all ${isSharingScreen ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}><Monitor size={18} /></button>
                        <button onClick={endCall} className="p-3.5 bg-red-600 hover:bg-red-700 rounded-2xl text-white shadow-lg transform active:scale-95 transition-all"><PhoneOff size={22} /></button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages List (Agrupados) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-1 custom-scrollbar">
                  {messages.map((msg, idx) => {
                    const isOwn = msg.senderId === user?.uid;
                    const isSameSender = messages[idx-1]?.senderId === msg.senderId;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} ${!isSameSender ? 'mt-6' : 'mt-0.5'}`}>
                        <div className="flex items-end gap-3 max-w-[85%] md:max-w-[70%]">
                          {!isOwn && <div className="w-8">{!isSameSender && <Avatar name={msg.senderName} size="sm" />}</div>}
                          <div className={`group relative px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm transition-all ${isOwn ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-br-none font-medium' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 rounded-bl-none border dark:border-zinc-800 font-normal'}`}>
                            {msg.type === 'file' ? (
                              <div className="flex items-center gap-3 py-1">
                                <div className={`p-2 rounded-lg ${isOwn ? 'bg-white/10' : 'bg-zinc-200 dark:bg-zinc-800'}`}><FileText size={18} /></div>
                                <div className="min-w-0"><p className="font-semibold truncate text-xs">{msg.file?.name}</p><p className="text-[10px] opacity-60 uppercase">{msg.file?.size}</p></div>
                                <button className="ml-2 hover:opacity-70"><Download size={16} /></button>
                              </div>
                            ) : renderMessageText(msg.text)}
                            <div className={`absolute top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${isOwn ? '-left-14' : '-right-14'}`}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Input Footer */}
              <footer className="p-4 border-t dark:border-zinc-800">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                    {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                  </button>
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-full px-5 py-2.5">
                    <input 
                      type="text" 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..." 
                      className="w-full bg-transparent border-none outline-none text-[14px] font-normal"
                    />
                  </div>
                  <button onClick={() => handleSendMessage()} disabled={!input.trim()} className="p-2.5 bg-zinc-400 dark:bg-zinc-700 text-white rounded-xl hover:bg-zinc-900 transition-all disabled:opacity-30"><Send size={18} /></button>
                </div>
              </footer>
            </>
          ) : view === 'profile' ? (
            <div className="flex-1 flex flex-col animate-in fade-in duration-300">
              <header className="h-16 flex-shrink-0 border-b dark:border-zinc-800 px-8 flex items-center bg-white dark:bg-zinc-950">
                <h2 className="text-lg font-bold uppercase tracking-tight">User Settings</h2>
              </header>
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-zinc-50/50 dark:bg-zinc-900/10">
                <div className="max-w-xl mx-auto space-y-8">
                  <div className="flex items-center gap-8 p-8 bg-white dark:bg-zinc-900 rounded-3xl border dark:border-zinc-800 shadow-sm">
                    <Avatar name={user?.displayName || "Admin"} size="xl" status="online" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          defaultValue={user?.displayName} 
                          onBlur={(e) => {
                            updateProfile(auth.currentUser, { displayName: e.target.value });
                            setUser({...auth.currentUser, displayName: e.target.value});
                          }} 
                          className="bg-transparent text-xl font-bold outline-none border-b border-transparent focus:border-zinc-400" 
                        />
                        <Edit2 size={16} className="text-zinc-400" />
                      </div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">ID: {user?.uid?.substring(0, 16)}...</p>
                    </div>
                  </div>
                  <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border dark:border-zinc-800 space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 px-2">Appearance</h4>
                    <button onClick={toggleDarkMode} className="w-full flex justify-between items-center p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-2xl transition-all">
                      <div className="flex items-center gap-3">{darkMode ? <Sun size={18} /> : <Moon size={18} />}<span className="text-sm font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span></div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${darkMode ? 'bg-zinc-100' : 'bg-zinc-800'}`}><div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${darkMode ? 'right-1 bg-zinc-900' : 'left-1 bg-zinc-400'}`} /></div>
                    </button>
                    <button onClick={() => signOut(auth)} className="w-full py-4 flex items-center justify-center gap-2 border-2 border-red-500 text-red-500 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all transform active:scale-95"><LogOut size={16} /> Logout</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-400 bg-zinc-50/20 dark:bg-zinc-900/10">
              <div className="w-20 h-20 bg-white dark:bg-zinc-900 rounded-[2rem] shadow-xl flex items-center justify-center mb-8 border dark:border-zinc-800"><Bell size={32} /></div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-zinc-900 dark:text-zinc-100">Welcome</h2>
              <p className="max-w-xs text-[10px] font-bold uppercase tracking-widest mt-4">Select a chat to start working.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}