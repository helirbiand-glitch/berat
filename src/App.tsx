import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Play, 
  CheckCircle2, 
  LayoutDashboard, 
  UserCircle, 
  Settings, 
  BarChart3, 
  Trash2, 
  Plus, 
  Minus, 
  History,
  Info,
  Maximize2,
  Minimize2,
  Monitor,
  Gamepad2,
  Film,
  Activity,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type Movie = {
  id: string;
  name: string;
};

type Group = {
  id: string;
  name: string;
  peopleCount: number;
  sessionsBlocked: string[]; // List of session IDs
};

type Booking = {
  id: string;
  customerName: string;
  phone: string;
  count: number;
};

type Session = {
  id: string;
  time: string; // HH:mm
  movieId: string;
  peopleCount: number;
  bookings: Booking[];
  groupId?: string;
  isFinished: boolean;
};

type HistoryItem = {
  id: string;
  timestamp: string;
  action: string;
  details: string;
};

type ViewMode = 'kasiyer' | 'musteri' | 'admin';

// --- Constants ---
const MOVIES: Movie[] = [
  { id: '1', name: 'Çin Turu' },
  { id: '2', name: 'Asya Turu' },
  { id: '3', name: 'Amerika Turu' },
  { id: '4', name: 'Hayvanlar Alemi' },
  { id: '5', name: 'Korku Evi' },
  { id: '6', name: 'Jurassic Dönemi' },
  { id: '7', name: 'Dünya Turu' },
  { id: '8', name: 'Arap Dünyası' },
];

const START_TIME = "10:00";
const END_TIME = "21:40";
const INTERVAL = 12; // 12 minutes

// --- Helper Functions ---
const generateSessions = (): Session[] => {
  const sessions: Session[] = [];
  let currentTime = new Date(`2000-01-01T${START_TIME}:00`);
  const endTime = new Date(`2000-01-01T${END_TIME}:00`);
  
  while (currentTime <= endTime) {
    const timeStr = currentTime.toTimeString().slice(0, 5);
    sessions.push({
      id: `session-${timeStr.replace(':', '')}`,
      time: timeStr,
      movieId: MOVIES[0].id,
      peopleCount: 0,
      bookings: [],
      isFinished: false,
    });
    currentTime.setMinutes(currentTime.getMinutes() + INTERVAL);
  }
  return sessions;
};

const getNowHHMM = () => {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
};

export default function App() {
  // --- State ---
  const [name, setName] = useState<string>(() => localStorage.getItem('ft_name') || '');
  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('ft_sessions');
    return saved ? JSON.parse(saved) : generateSessions();
  });
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('ft_groups');
    return saved ? JSON.parse(saved) : [];
  });
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('ft_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [viewMode, setViewMode] = useState<ViewMode>('kasiyer');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [capacity, setCapacity] = useState(() => {
    const saved = localStorage.getItem('ft_capacity');
    return saved ? parseInt(saved) : 7;
  });
  const [windowStartIndex, setWindowStartIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'theater' | 'laser'>('theater');
  const [showMovieCatalog, setShowMovieCatalog] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState<{ sessionId: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(getNowHHMM());

  const containerRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = getNowHHMM();
      setCurrentTime(now);
      
      // Update session finished states
      setSessions(prev => prev.map(s => ({
        ...s,
        isFinished: s.time < now
      })));
    }, 10000); // Check every 10 seconds
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    localStorage.setItem('ft_sessions', JSON.stringify(sessions));
    localStorage.setItem('ft_groups', JSON.stringify(groups));
    localStorage.setItem('ft_history', JSON.stringify(history));
    localStorage.setItem('ft_capacity', capacity.toString());
    if (name) localStorage.setItem('ft_name', name);
  }, [sessions, groups, history, name, capacity]);

  // Sync window start index with current time once on load
  useEffect(() => {
    const nowIdx = sessions.findIndex(s => s.time >= currentTime);
    if (nowIdx !== -1) {
      setWindowStartIndex(Math.max(0, nowIdx));
    }
  }, []);

  // --- Business Logic ---
  const addHistory = (action: string, details: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: getNowHHMM(),
      action,
      details
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50));
  };

  const updateSession = (sessionId: string, updates: Partial<Session>) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const updated = { ...s, ...updates };
        return updated;
      }
      return s;
    }));
  };

  const addPerson = (sessionId: string, count: number) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.isFinished) return;
    
    const newCount = Math.min(capacity, session.peopleCount + count);
    if (newCount !== session.peopleCount) {
      updateSession(sessionId, { peopleCount: newCount });
      addHistory("Kişi Eklendi", `${session.time} seansına ${count} kişi eklendi.`);
    }
  };

  const registerCustomer = (sessionId: string, customerName: string, phone: string, count: number) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.isFinished) return;

    if (session.peopleCount + count > capacity) {
      alert("Kapasite yetersiz!");
      return;
    }

    const newBooking: Booking = {
      id: Date.now().toString(),
      customerName,
      phone,
      count
    };

    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const currentBookings = s.bookings || [];
        return {
          ...s,
          peopleCount: s.peopleCount + count,
          bookings: [...currentBookings, newBooking]
        };
      }
      return s;
    }));

    addHistory("Müşteri Kaydı", `${session.time} seansı: ${customerName} (+${count})`);
    setShowBookingModal(null);
  };

  const shiftSessions = (startSessionId: string, minutes: number) => {
    const startIdx = sessions.findIndex(s => s.id === startSessionId);
    if (startIdx === -1) return;

    setSessions(prev => prev.map((s, idx) => {
      if (idx < startIdx) return s;

      const [hours, mins] = s.time.split(':').map(Number);
      const date = new Date(2000, 0, 1, hours, mins);
      date.setMinutes(date.getMinutes() + minutes);
      
      const newTime = date.toTimeString().slice(0, 5);
      return { 
        ...s, 
        time: newTime,
        id: `session-${newTime.replace(':', '')}-${idx}`, // regenerate ID to avoid duplicates if shifted
        isFinished: newTime < currentTime 
      };
    }));

    addHistory("Zaman Kaydırma", `${sessions[startIdx].time} ve sonrası ${minutes < 0 ? 'geri' : 'ileri'} alındı.`);
  };

  const removePerson = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.isFinished || session.peopleCount <= 0) return;
    
    const bookingsTotal = (session.bookings || []).reduce((acc, b) => acc + b.count, 0);
    if (session.peopleCount <= bookingsTotal) {
      alert("Kayıtlı kişi sayısından daha azına inilemez. Kaydı silmeniz gerekir.");
      return;
    }
    
    updateSession(sessionId, { peopleCount: session.peopleCount - 1 });
    addHistory("Kişi Çıkarıldı", `${session.time} seansından 1 kişi çıkarıldı (Walk-in).`);
  };

  const removeBooking = (sessionId: string, bookingId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.isFinished) return;

    const booking = (session.bookings || []).find(b => b.id === bookingId);
    if (!booking) return;

    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          peopleCount: Math.max(0, s.peopleCount - booking.count),
          bookings: (s.bookings || []).filter(b => b.id !== bookingId)
        };
      }
      return s;
    }));

    addHistory("Kayıt Silindi", `${session.time} seansından ${booking.customerName} kaydı silindi.`);
  };

  const changeMovie = (sessionId: string, movieId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    const movie = MOVIES.find(m => m.id === movieId);
    if (!session || !movie) return;
    
    updateSession(sessionId, { movieId });
    addHistory("Film Değişti", `${session.time} seansı: ${movie.name}`);
  };

  const suggestSession = () => {
    const now = getNowHHMM();
    const suggested = sessions.find(s => !s.isFinished && s.time >= now && s.peopleCount < capacity && !s.groupId);
    if (suggested) {
      const idx = sessions.indexOf(suggested);
      // Ensure we don't go out of bounds for the 12-session view
      setWindowStartIndex(Math.min(sessions.length - 12, Math.max(0, idx)));
    }
  };

  const addGroup = (groupName: string, peopleCount: number, startSessionId: string) => {
    const startIdx = sessions.findIndex(s => s.id === startSessionId);
    if (startIdx === -1) return;
    
    const sessionsNeeded = Math.ceil(peopleCount / capacity);
    const targetSessionIds: string[] = [];
    
    for (let i = 0; i < sessionsNeeded; i++) {
      const s = sessions[startIdx + i];
      if (s && !s.isFinished) {
        targetSessionIds.push(s.id);
      }
    }

    if (targetSessionIds.length < sessionsNeeded) {
      alert("Bu gruptan sonra yeterli seans yok!");
      return;
    }

    const newGroup: Group = {
      id: Date.now().toString(),
      name: groupName,
      peopleCount,
      sessionsBlocked: targetSessionIds
    };

    setGroups(prev => [...prev, newGroup]);
    setSessions(prev => prev.map(s => {
      if (targetSessionIds.includes(s.id)) {
        return { ...s, groupId: newGroup.id, peopleCount: capacity };
      }
      return s;
    }));
    addHistory("Grup Eklendi", `${groupName} (${peopleCount} kişi)`);
  };

  const removeGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    setGroups(prev => prev.filter(g => g.id !== groupId));
    setSessions(prev => prev.map(s => {
      if (s.groupId === groupId) {
        return { ...s, groupId: undefined, peopleCount: 0 };
      }
      return s;
    }));
    addHistory("Grup Silindi", `${group.name} grubu kaldırıldı.`);
  };

  const resetDay = () => {
    if (confirm("Günü sıfırlamak istediğinize emin misiniz? Tüm veriler silinecek.")) {
      setSessions(generateSessions());
      setGroups([]);
      setHistory([]);
      addHistory("Sistem Sıfırlandı", "Yeni bir gün başlatıldı.");
    }
  };

  // --- Computed Values ---
  const currentWindowSessions = useMemo(() => {
    return sessions.slice(windowStartIndex, windowStartIndex + 12);
  }, [sessions, windowStartIndex]);

  const finishedSessions = useMemo(() => {
    return sessions.filter(s => s.isFinished).slice(-4).reverse();
  }, [sessions]);

  const stats = useMemo(() => {
    const totalPeople = sessions.reduce((acc, s) => acc + s.peopleCount, 0);
    const fullSessions = sessions.filter(s => s.peopleCount >= capacity).length;
    
    const hourStats: Record<string, number> = {};
    sessions.forEach(s => {
      const hour = s.time.split(':')[0];
      hourStats[hour] = (hourStats[hour] || 0) + s.peopleCount;
    });
    const peakHour = Object.entries(hourStats).sort((a, b) => b[1] - a[1])[0]?.[0] || '10';
    
    return { totalPeople, fullSessions, peakHour };
  }, [sessions]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  // --- UI Logic ---
  if (!name) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-bg p-6 text-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-10 rounded-2xl w-full max-w-md text-center"
        >
          <div className="w-20 h-20 bg-brand-orange/20 flex items-center justify-center rounded-2xl mx-auto mb-6">
            <Play className="text-brand-orange w-10 h-10 fill-brand-orange" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Flying Theater</h1>
          <p className="text-white/60 mb-8">Devam etmek için bir isim girin</p>
          <input 
            type="text" 
            placeholder="İsim Girin..."
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 mb-6 focus:outline-none focus:border-brand-orange transition-colors text-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setName((e.target as HTMLInputElement).value);
            }}
          />
          <button 
            onClick={(e) => {
              const input = (e.currentTarget.previousSibling as HTMLInputElement).value;
              if (input) setName(input);
            }}
            className="btn-orange w-full py-4 text-lg"
          >
            Sisteme Giriş Yap
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col bg-dark-bg text-white transition-all overflow-x-hidden">
      {/* Top Navbar */}
      <header className="p-4 glass rounded-xl flex items-center justify-between sticky top-4 z-50 mx-4 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Lokasyon</span>
            <span className="text-lg font-bold">FLYING THEATER <span className="text-brand-orange">ANKARA</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-4 border-l border-white/10 pl-8">
            <button 
              onClick={() => setActiveTab('theater')}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-all ${activeTab === 'theater' ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30' : 'text-neutral-500 opacity-50'}`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === 'theater' ? 'bg-brand-orange animate-pulse' : 'bg-neutral-500'}`}></div>
              Flying Theater
            </button>
            <button 
              className="flex items-center gap-2 px-3 py-1 rounded-lg text-neutral-500 grayscale cursor-not-allowed opacity-50"
              disabled
            >
              Laser Tag <span className="text-[10px] bg-neutral-800 px-1 rounded">YAKINDA</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Açık Operatör</span>
              <span className="font-extrabold uppercase tracking-tight text-white">{name}</span>
            </div>
          
          <div className="text-3xl font-mono text-brand-orange font-bold tabular-nums tracking-tighter">
            {currentTime}:<span className="text-[0.6em] opacity-50">{(new Date().getSeconds()).toString().padStart(2, '0')}</span>
          </div>

                <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/[0.05]">
            {[
              { id: 'kasiyer', icon: LayoutDashboard, label: 'Kasiyer' },
              { id: 'musteri', icon: UserCircle, label: 'Müşteri' },
              { id: 'admin', icon: Settings, label: 'Panel' }
            ].map(mode => (
              <button 
                key={mode.id}
                onClick={() => {
                  if (mode.id === 'admin' && !adminAuthenticated) {
                    setViewMode('admin');
                  } else {
                    setViewMode(mode.id as ViewMode);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[11px] font-black uppercase tracking-wider ${viewMode === mode.id ? 'bg-brand-orange text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <mode.icon size={14} />
                <span className="hidden lg:inline">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-[1600px] mx-auto">
        <AnimatePresence mode="wait">
          {viewMode === 'kasiyer' && (
            <motion.div 
              key="kasiyer"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-12 gap-4"
            >
              {/* Left Column: Sessions */}
              <div className="col-span-12 xl:col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setWindowStartIndex(Math.max(0, windowStartIndex - 6))}
                      className="glass px-4 py-2 rounded-lg hover:bg-white/10 text-sm disabled:opacity-20"
                      disabled={windowStartIndex === 0}
                    >
                      Önceki 6
                    </button>
                    <button 
                      onClick={() => {
                        const nowIdx = sessions.findIndex(s => s.time >= currentTime);
                        if (nowIdx !== -1) setWindowStartIndex(Math.max(0, nowIdx));
                      }}
                      className="glass px-4 py-2 rounded-lg hover:bg-white/10 text-sm font-bold border-brand-orange/40 text-brand-orange"
                    >
                      Şu Ana Dön
                    </button>
                    <button 
                      onClick={() => setWindowStartIndex(Math.min(sessions.length - 12, windowStartIndex + 6))}
                      className="glass px-4 py-2 rounded-lg hover:bg-white/10 text-sm disabled:opacity-20"
                      disabled={windowStartIndex >= sessions.length - 12}
                    >
                      Sonraki 6
                    </button>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={suggestSession}
                      className="btn-orange px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                    >
                      ⭐ Önerilen Seans
                    </button>
                    <button 
                      onClick={() => setViewMode('admin')}
                      className="bg-brand-purple hover:bg-brand-purple/80 px-4 py-2 rounded-lg text-sm font-bold"
                    >
                      + Grup Yönetimi
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentWindowSessions.map((session) => (
                    <motion.div 
                      key={session.id}
                      className={`glass p-4 rounded-xl session-card flex flex-col justify-between border transition-all relative overflow-hidden ${
                        session.isFinished 
                          ? 'border-white/5 opacity-60 grayscale h-[180px]' 
                          : session.groupId 
                            ? 'border-brand-purple/30 h-[180px]' 
                            : session.peopleCount >= capacity 
                              ? 'border-red-500/30 h-auto min-h-[180px]' 
                              : 'border-white/10 h-auto min-h-[180px]'
                      }`}
                    >
                      {/* Status Accent Bar */}
                      <div className={`absolute top-0 left-0 bottom-0 w-1 ${
                        session.isFinished ? 'bg-neutral-700' :
                        session.groupId ? 'bg-brand-purple' :
                        session.peopleCount >= capacity ? 'bg-red-500' : 'bg-brand-orange'
                      }`} />
                      <div className="flex justify-between items-start">
                        <span className={`text-2xl font-mono font-bold ${session.isFinished ? 'text-neutral-500' : 'text-brand-orange'}`}>{session.time}</span>
                        <div className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          session.isFinished 
                            ? 'bg-neutral-800 text-neutral-500' 
                            : session.groupId 
                              ? 'bg-brand-purple/20 text-brand-purple' 
                              : session.peopleCount >= capacity 
                                ? 'bg-red-500/20 text-red-500' 
                                : 'bg-green-500/20 text-green-400'
                        }`}>
                          {session.isFinished ? 'Bitti' : session.groupId ? 'Grup' : session.peopleCount >= capacity ? 'Dolu' : 'Açık'}
                        </div>
                      </div>

                      {/* Time Adjustment Controls */}
                      {!session.isFinished && (
                        <div className="flex gap-2 mb-2">
                          <button 
                            onClick={() => shiftSessions(session.id, -1)}
                            className="bg-white/5 hover:bg-white/10 p-1 rounded text-[10px] font-bold text-neutral-500"
                          >
                            -1 Dakika
                          </button>
                          <button 
                            onClick={() => shiftSessions(session.id, 1)}
                            className="bg-white/5 hover:bg-white/10 p-1 rounded text-[10px] font-bold text-neutral-500"
                          >
                            +1 Dakika
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col my-1">
                        <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest leading-none mb-1">Film</span>
                        <select 
                          className={`bg-transparent text-lg font-bold border-none focus:ring-0 p-0 appearance-none cursor-pointer truncate ${session.isFinished ? 'pointer-events-none text-neutral-600' : 'text-white'}`}
                          value={session.movieId}
                          onChange={(e) => changeMovie(session.id, e.target.value)}
                          disabled={session.isFinished || !!session.groupId}
                        >
                          {MOVIES.map(m => <option key={m.id} value={m.id} className="bg-zinc-950 text-white text-base">{m.name}</option>)}
                        </select>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className={`flex items-center gap-1.5 text-2xl font-black font-mono ${session.isFinished ? 'text-neutral-600' : ''}`}>
                          {session.peopleCount}
                          <span className="text-xs text-neutral-500 font-bold">/ {capacity} Kişi</span>
                        </div>
                        
                        {!session.isFinished && !session.groupId ? (
                          <div className="flex gap-1">
                            <button 
                              onClick={() => setShowBookingModal({ sessionId: session.id })}
                              className="px-3 rounded bg-brand-orange/10 border border-brand-orange/20 text-[10px] font-bold text-brand-orange hover:bg-brand-orange/20 mr-1"
                            >
                              Kayıt Al
                            </button>
                            <button 
                              onClick={() => removePerson(session.id)}
                              className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-xl font-bold hover:bg-white/10"
                            >
                              -
                            </button>
                            <button 
                              onClick={() => addPerson(session.id, 1)}
                              className="w-10 h-10 rounded bg-brand-orange flex items-center justify-center text-xl font-bold hover:bg-orange-600"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{session.groupId ? 'REZERVASYON' : 'KAPALI'}</span>
                        )}
                      </div>

                      {/* Display Bookings if any */}
                      {(session.bookings || []).length > 0 && !session.isFinished && (
                        <div className="mt-3 pt-2 border-t border-white/5 flex flex-col gap-1 max-h-24 overflow-y-auto custom-scroll">
                          {(session.bookings || []).map(b => (
                            <div key={b.id} className="flex justify-between items-center bg-white/10 px-2 py-1.5 rounded text-[10px] font-bold group/booking">
                              <div className="flex flex-col truncate pr-2">
                                <span className="truncate text-white/90">{b.customerName}</span>
                                <span className="text-white/30 text-[8px]">{b.phone}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-brand-orange">{b.count}K</span>
                                <button 
                                  onClick={() => removeBooking(session.id, b.id)}
                                  className="text-red-500 hover:text-red-400 opacity-0 group-hover/booking:opacity-100 transition-opacity p-1"
                                  title="Kaydı Sil"
                                >
                                  <Plus size={12} className="rotate-45" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Right Column: Sidebar */}
              <aside className="col-span-12 xl:col-span-4 flex flex-col gap-4">
                {/* Stats Dashboard */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div className="glass p-4 rounded-2xl flex flex-col items-center border border-white/[0.03] group hover:border-brand-orange/30 transition-all">
                    <Users size={16} className="text-brand-orange opacity-50 mb-2 group-hover:opacity-100 transition-all" />
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">Toplam Kişi</span>
                    <span className="text-3xl font-black text-white">{stats.totalPeople}</span>
                  </div>
                  <div className="glass p-4 rounded-2xl flex flex-col items-center border border-white/[0.03] group hover:border-brand-purple/30 transition-all">
                    <Zap size={16} className="text-brand-purple opacity-50 mb-2 group-hover:opacity-100 transition-all" />
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">Dolu Seans</span>
                    <span className="text-3xl font-black text-white">{stats.fullSessions}</span>
                  </div>
                </div>

                {/* Dashboard: Gelecek İlk 3 Seans */}
                <div className="glass p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-orange">Sıradaki Uygun Seanslar</h3>
                    <div className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {sessions.filter(s => !s.isFinished && s.peopleCount < capacity && !s.groupId).slice(0, 3).map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group" onClick={() => {
                        const idx = sessions.findIndex(session => session.id === s.id);
                        setWindowStartIndex(Math.min(sessions.length - 12, Math.max(0, idx)));
                      }}>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-lg text-white group-hover:text-brand-orange transition-colors">{s.time}</span>
                          <span className="text-xs font-bold text-slate-400 capitalize">{MOVIES.find(m => m.id === s.movieId)?.name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[10px] font-black text-brand-orange">{capacity - s.peopleCount} BOŞ</span>
                        </div>
                      </div>
                    ))}
                    {sessions.filter(s => !s.isFinished && s.peopleCount < capacity && !s.groupId).length === 0 && (
                      <p className="text-[10px] text-slate-500 italic text-center py-4">Tüm seanslar dolu</p>
                    )}
                  </div>
                </div>

                {/* Quick Movies / Katalog */}
                <div className="glass p-5 rounded-2xl flex flex-col gap-4 flex-1 min-h-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Aktif Film Havuzu</h3>
                    <Film size={14} className="text-cyan-400 opacity-50" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1 flex-1 custom-scroll">
                    {MOVIES.map((m, idx) => (
                      <div 
                        key={m.id}
                        className="bg-white/[0.02] p-3 rounded-xl text-left border border-white/[0.05] flex items-center gap-3 group hover:border-cyan-500/30 transition-all"
                      >
                        <span className="text-[10px] font-mono opacity-20 group-hover:opacity-100 group-hover:text-cyan-400 transition-all">0{idx + 1}</span>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black group-hover:text-white transition-colors">{m.name}</span>
                          <span className="text-[9px] font-bold text-slate-500 tracking-wider">ZEPLINX VR</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action History Summary */}
                <div className="glass p-4 rounded-xl flex flex-col gap-3 shrink-0 border-t-2 border-t-brand-purple/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">Son Hareketler</h3>
                    <Activity size={14} className="text-brand-purple opacity-50" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {history.slice(0, 3).map(h => (
                      <div key={h.id} className="text-[9px] font-bold flex flex-col leading-tight border-l-2 border-brand-purple/40 pl-2">
                        <span className="text-slate-200">{h.action}</span>
                        <span className="text-slate-500 italic">{h.details}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </motion.div>
          )}

          {viewMode === 'musteri' && (
            <motion.div 
              key="musteri"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col gap-12 max-w-7xl mx-auto py-12"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left border-b border-white/5 pb-12">
                 <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-brand-orange flex items-center justify-center rounded-[32px] shadow-[0_0_40px_rgba(255,133,0,0.2)]">
                      <Play className="text-white w-12 h-12 fill-white -mr-1" />
                    </div>
                    <div>
                      <h1 className="text-5xl font-black tracking-tighter mb-2">FLYING THEATER</h1>
                      <p className="text-white/40 uppercase tracking-[0.6em] font-black text-xs">ANKARA EĞLENCE MERKEZİ</p>
                    </div>
                 </div>
                 
                 <div className="flex flex-col items-center md:items-end">
                    <h2 className="text-8xl font-mono font-black text-brand-orange tracking-tighter drop-shadow-[0_0_20px_rgba(255,133,0,0.3)]">{currentTime}</h2>
                    <span className="text-sm font-black text-white/20 tracking-widest mt-2 uppercase">CANLI SEANS SAATİ</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {sessions.filter(s => !s.isFinished).slice(0, 6).map(s => (
                    <motion.div 
                      key={s.id} 
                      className={`glass p-10 rounded-[40px] flex items-center justify-between border-b-[12px] group transition-all ${s.peopleCount >= capacity || s.groupId ? 'border-red-500/40 opacity-50 grayscale-[0.5]' : 'border-brand-orange hover:shadow-[0_30px_60px_-15px_rgba(255,133,0,0.15)]'}`}
                    >
                      <div className="flex flex-col gap-3">
                        <span className="text-6xl font-mono font-black text-white leading-none tracking-tighter">{s.time}</span>
                        <span className="text-2xl font-bold text-brand-orange tracking-tight">
                          {s.groupId ? 'GRUP İÇİN KAPALI' : MOVIES.find(m => m.id === s.movieId)?.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-8">
                        <div className="flex flex-col items-center">
                           <span className="text-4xl font-black text-white">{s.peopleCount} <span className="text-sm text-white/20 font-bold uppercase ml-1">/ {capacity}</span></span>
                           <span className="text-[10px] text-white/40 tracking-[0.2em] font-black uppercase mt-2">DOLULUK</span>
                        </div>
                      </div>
                    </motion.div>
                 ))}
              </div>

              <div className="flex justify-center mt-8">
                 <button 
                  onClick={() => setShowMovieCatalog(true)}
                  className="px-16 py-8 bg-white text-dark-bg font-black rounded-[24px] text-3xl hover:bg-brand-orange hover:text-white transition-all transform active:scale-95 shadow-2xl flex items-center gap-4"
                 >
                   <Film size={32} /> <span>TÜM FİLMLERİMİZ</span>
                 </button>
              </div>
            </motion.div>
          )}

          {viewMode === 'admin' && (
             <motion.div 
                key="admin"
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
                className="max-w-5xl mx-auto w-full pb-20"
             >
               {!adminAuthenticated ? (
                  <div className="flex flex-col items-center justify-center py-32 glass rounded-[32px] border border-white/5 mx-auto max-w-md">
                    <Settings className="text-brand-orange mb-6" size={64} />
                    <h2 className="text-2xl font-black mb-2 tracking-tighter">ADMİN GİRİŞİ</h2>
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-8">4 HANELİ PIN GİRİNİZ</p>
                    <div className="flex gap-4 mb-8">
                      {[1, 2, 3, 4].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full border-2 border-brand-orange ${pinInput.length > i ? 'bg-brand-orange' : 'bg-transparent'}`} />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map(val => (
                        <button
                          key={val}
                          onClick={() => {
                            if (val === 'C') setPinInput('');
                            else if (val === 'OK') {
                              if (pinInput === '0004') setAdminAuthenticated(true);
                              else { alert('Hatalı PIN!'); setPinInput(''); }
                            }
                            else if (pinInput.length < 4) setPinInput(p => p + val);
                          }}
                          className="w-16 h-16 rounded-2xl glass flex items-center justify-center font-bold text-xl hover:bg-white/10 active:scale-95"
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
               ) : (
                <>
                 <div className="flex items-center justify-between mb-12">
                   <div className="flex items-center gap-4">
                      <div className="p-4 bg-brand-orange/10 rounded-2xl">
                        <Settings className="text-brand-orange" size={32} />
                      </div>
                      <div>
                        <h2 className="text-4xl font-black tracking-tighter">SİSTEM AYARLARI</h2>
                        <p className="text-white/40 font-medium tracking-wide uppercase text-xs">RAPORLAMA VE GRUP YÖNETİMİ</p>
                      </div>
                   </div>
                   <button 
                    onClick={() => { setAdminAuthenticated(false); setPinInput(''); setViewMode('kasiyer'); }}
                    className="btn-ghost px-4 py-2"
                   >
                     Çıkış Yap
                   </button>
                 </div>

                 <div className="mb-12">
                   <section className="glass rounded-[32px] border border-white/5 p-8">
                      <h3 className="text-lg font-black tracking-widest uppercase mb-6">DONANIM AYARLARI</h3>
                      <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="flex-1 w-full">
                          <label className="text-[10px] uppercase font-black text-white/30 block mb-2 ml-4">MAKİNE KAPASİTESİ (KİŞİ)</label>
                          <div className="flex items-center gap-4">
                            <input 
                              type="range" 
                              min="1" 
                              max="20" 
                              value={capacity} 
                              onChange={(e) => setCapacity(parseInt(e.target.value))}
                              className="flex-1 accent-brand-orange"
                            />
                            <span className="text-3xl font-black font-mono w-12 text-center text-brand-orange">{capacity}</span>
                          </div>
                        </div>
                        <p className="text-xs text-neutral-500 italic max-w-xs">
                          Makine kapasitesini değiştirdiğinizde, tüm yeni seanslar ve grup rezervasyonları bu sayıyı baz alarak hesaplanacaktır.
                        </p>
                      </div>
                   </section>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <section className="glass rounded-[32px] overflow-hidden border border-white/5 flex flex-col">
                    <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                       <h3 className="text-lg font-black tracking-widest uppercase">GÜNLÜK VERİ ANALİZİ</h3>
                    </div>
                    <div className="p-8 flex-1 flex flex-col gap-6">
                       <div className="flex items-center justify-between">
                         <span className="text-sm font-bold text-white/40 uppercase">Dolu Seans Oranı</span>
                         <span className="text-2xl font-black text-brand-orange tracking-tighter">%{Math.round((stats.fullSessions / sessions.length) * 100)}</span>
                       </div>
                       <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-orange rounded-full" style={{ width: `${(stats.fullSessions / sessions.length) * 100}%` }} />
                       </div>

                       <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="p-6 bg-white/5 rounded-2xl text-center">
                            <Users size={24} className="mx-auto mb-2 text-brand-orange opacity-40" />
                            <p className="text-[10px] font-black uppercase text-white/30 mb-1">Müşteri Sayısı</p>
                            <h4 className="text-3xl font-black tracking-tighter">{stats.totalPeople}</h4>
                          </div>
                          <div className="p-6 bg-white/5 rounded-2xl text-center">
                            <Clock size={24} className="mx-auto mb-2 text-brand-orange opacity-40" />
                            <p className="text-[10px] font-black uppercase text-white/30 mb-1">Kalan Seans</p>
                            <h4 className="text-3xl font-black tracking-tighter">{sessions.filter(s => !s.isFinished).length}</h4>
                          </div>
                       </div>
                    </div>
                  </section>

                  <section className="glass rounded-[32px] border border-white/5 p-8 flex flex-col justify-between overflow-hidden relative">
                    <div className="relative z-10">
                      <h3 className="text-lg font-black tracking-widest uppercase mb-2">SİSTEM SIFIRLAMA</h3>
                      <p className="text-sm text-white/40 leading-relaxed mb-8">Bu işlem tüm seansları başlangıç durumuna döndürür, aktif grupları siler ve geçmişi temizler. Operasyon bitişinde kullanın.</p>
                      
                      <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl mb-8">
                         <div className="flex items-start gap-4">
                            <div className="p-2 bg-red-500/20 rounded-lg">
                              <Info className="text-red-500" size={20} />
                            </div>
                            <p className="text-xs text-red-500 font-bold leading-tight uppercase">Dikkat: Bu işlemin geri dönüşü yoktur. Verileriniz kalıcı olarak silinecek!</p>
                         </div>
                      </div>
                    </div>

                    <button 
                      onClick={resetDay}
                      className="w-full py-5 bg-red-500 hover:bg-red-600 rounded-[24px] font-black text-xl transition-all shadow-xl active:scale-95 z-10"
                    >
                      KAYITLARI TEMİZLE
                    </button>
                    
                    <Trash2 className="absolute -bottom-10 -right-10 text-white/[0.02]" size={200} />
                  </section>
               </div>

               <section className="glass rounded-[32px] overflow-hidden border border-white/5 shadow-2xl">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                     <h3 className="text-xl font-black tracking-widest uppercase">GRUP YÖNETİMİ</h3>
                     <span className="text-[10px] bg-brand-purple text-white px-3 py-1 rounded-full font-black uppercase tracking-widest">{groups.length} AKTİF GRUP</span>
                  </div>
                  <div className="p-8">
                    <div className="space-y-4 mb-12">
                      {groups.length === 0 ? (
                        <div className="text-center py-20 bg-white/[0.01] rounded-3xl border border-dashed border-white/10">
                          <Users size={40} className="mx-auto mb-4 text-white/10" />
                          <p className="text-xs font-black text-white/20 tracking-widest uppercase">AKTİF REZERVASYON KAYDI BULUNMUYOR</p>
                        </div>
                      ) : (
                        groups.map(g => (
                          <div key={g.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-white/[0.03] rounded-3xl border border-white/5 hover:border-brand-purple/30 transition-all">
                            <div className="flex flex-col mb-4 md:mb-0">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-2xl font-black tracking-tighter">{g.name}</span>
                                <span className="bg-brand-orange/20 text-brand-orange text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest">
                                  {g.peopleCount} KİŞİ
                                </span>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {g.sessionsBlocked.map(sid => (
                                  <span key={sid} className="text-[11px] font-mono font-bold text-white/40 bg-white/5 px-3 py-1 rounded-xl">
                                    {sessions.find(s => s.id === sid)?.time}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button 
                              onClick={() => removeGroup(g.id)}
                              className="self-start md:self-center p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 transition-all hover:text-white group"
                            >
                              <Trash2 size={24} className="group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="bg-white/[0.02] border border-white/10 rounded-[40px] p-10">
                      <h4 className="text-sm font-black tracking-widest uppercase mb-8 ml-2 flex items-center gap-3">
                        <Plus size={16} className="text-brand-orange" /> YENİ GRUP REZERVASYONU
                      </h4>
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const gname = formData.get('groupName') as string;
                          const pcount = parseInt(formData.get('peopleCount') as string);
                          const startSid = formData.get('sessionTime') as string;
                          if (gname && pcount > 0 && startSid) {
                            addGroup(gname, pcount, startSid);
                            e.currentTarget.reset();
                          }
                        }}
                        className="grid grid-cols-1 md:grid-cols-6 gap-6"
                      >
                        <div className="md:col-span-3">
                          <label className="text-[10px] uppercase font-black text-white/30 block mb-2 ml-4">GRUP / KURUM ADI</label>
                          <input name="groupName" required type="text" placeholder="Örn: Ankara Ortaokulu Gezisi" className="w-full bg-dark-bg border-4 border-white/5 rounded-[24px] p-5 focus:border-brand-orange outline-none font-bold text-lg" />
                        </div>
                        <div className="md:col-span-1">
                          <label className="text-[10px] uppercase font-black text-white/30 block mb-2 ml-4">KİŞİ SAYISI</label>
                          <input name="peopleCount" required type="number" min="1" placeholder="30" className="w-full bg-dark-bg border-4 border-white/5 rounded-[24px] p-5 focus:border-brand-orange outline-none font-bold text-lg" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] uppercase font-black text-white/30 block mb-2 ml-4">BAŞLANGIÇ SAATİ</label>
                          <div className="relative">
                            <select name="sessionTime" className="w-full bg-dark-bg border-4 border-white/5 rounded-[24px] p-5 focus:border-brand-orange outline-none font-bold text-lg appearance-none cursor-pointer">
                              {sessions.filter(s => !s.isFinished && !s.groupId).map(s => (
                                <option key={s.id} value={s.id} className="bg-zinc-950">{s.time} (UYGUN)</option>
                              ))}
                            </select>
                            <ChevronRight size={24} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none rotate-90" />
                          </div>
                        </div>
                        <div className="md:col-span-6 mt-4">
                          <button type="submit" className="btn-orange w-full py-6 rounded-[24px] text-2xl font-black shadow-2xl flex items-center justify-center gap-4">
                            SİSTEMİ BLOKLA VE KAYDET
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
               </section>
               </>
               )}
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Navigation */}
      <footer className="p-2 glass rounded-xl flex items-center justify-between sticky bottom-4 z-50 mx-4 shrink-0">
        <div className="flex gap-6 px-4">
          <button 
            onClick={() => setViewMode('kasiyer')} 
            className={`text-sm font-bold transition-all ${viewMode === 'kasiyer' ? 'active-tab pb-1' : 'text-neutral-500 hover:text-white'}`}
          >
            Kasiyer Paneli
          </button>
          <button 
            onClick={() => {
              if (!adminAuthenticated) {
                setViewMode('admin');
              } else {
                setViewMode('admin');
              }
            }} 
            className={`text-sm font-bold transition-all ${viewMode === 'admin' ? 'active-tab pb-1' : 'text-neutral-500 hover:text-white'}`}
          >
            Yönetici Paneli (PIN)
          </button>
          <button 
            onClick={() => setViewMode('musteri')} 
            className={`text-sm font-bold transition-all ${viewMode === 'musteri' ? 'active-tab pb-1' : 'text-neutral-500 hover:text-white'}`}
          >
            Müşteri Ekranı
          </button>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono text-neutral-500 uppercase font-black">
          <span>SYSTEM OK - STABLE</span>
          <span>LOC_ANKARA_FT_01</span>
        </div>
      </footer>

      {/* Movie Catalog Modal */}
      <AnimatePresence>
        {showMovieCatalog && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-dark-bg/95 backdrop-blur-3xl flex flex-col p-6 md:p-20 overflow-y-auto"
          >
            <div className="w-full max-w-5xl mx-auto flex flex-col min-h-full">
               <div className="flex w-full justify-between items-center mb-16 md:mb-32">
                  <div className="flex items-center gap-8">
                    <div className="w-20 h-20 bg-brand-orange rounded-[24px] flex items-center justify-center shadow-[0_0_40px_rgba(255,133,0,0.3)]">
                      <Film className="text-white w-10 h-10 fill-white" />
                    </div>
                    <div>
                      <h2 className="text-5xl font-black tracking-tighter mb-2">FİLM KATALOĞU</h2>
                      <p className="text-brand-orange text-sm font-black tracking-[0.6em] uppercase">FLYING THEATER DENEYİMİ</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowMovieCatalog(false)} 
                    className="p-6 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/5 group"
                  >
                    <Trash2 size={40} className="rotate-45 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                  {MOVIES.map(movie => (
                    <motion.div 
                      key={movie.id}
                      whileHover={{ scale: 1.02 }}
                      className="glass p-12 rounded-[48px] border-l-[16px] border-brand-orange flex items-center justify-between group transition-all"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] mb-2">TUR SEÇENEĞİ #{movie.id}</span>
                        <h3 className="text-5xl font-black tracking-tighter">{movie.name}</h3>
                      </div>
                      <div className="w-20 h-20 rounded-full border-4 border-white/5 flex items-center justify-center text-white/10 group-hover:border-brand-orange group-hover:text-brand-orange group-hover:shadow-[0_0_30px_rgba(255,133,0,0.2)] transition-all duration-700">
                        <Play fill="currentColor" size={32} />
                      </div>
                    </motion.div>
                  ))}
               </div>
               
               <div className="mt-auto py-20 text-center">
                  <p className="text-white/20 font-black tracking-[0.8em] uppercase text-sm">ZEPLINX GÜVENCESİYLE</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registration Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-8 rounded-[32px] w-full max-w-lg shadow-2xl relative"
            >
              <button 
                onClick={() => setShowBookingModal(null)}
                className="absolute top-6 right-6 text-white/40 hover:text-white"
              >
                <Plus size={24} className="rotate-45" />
              </button>

              <h2 className="text-2xl font-black mb-2 tracking-tighter">MÜŞTERİ KAYDI</h2>
              <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest mb-8">
                {sessions.find(s => s.id === showBookingModal.sessionId)?.time} SEANSI İÇİN
              </p>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const cname = formData.get('customerName') as string;
                const phone = formData.get('phone') as string;
                const count = parseInt(formData.get('count') as string);
                if (cname && phone && count > 0) {
                  registerCustomer(showBookingModal.sessionId, cname, phone, count);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-white/30 block mb-1 ml-4">AD SOYAD</label>
                  <input name="customerName" required type="text" placeholder="Ad Soyad..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-brand-orange" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-white/30 block mb-1 ml-4">TELEFON</label>
                  <input name="phone" required type="text" placeholder="05xx..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-brand-orange" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-white/30 block mb-1 ml-4">KİŞİ SAYISI</label>
                  <input name="count" required type="number" min="1" max={capacity} placeholder="1" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-brand-orange" />
                </div>
                <button type="submit" className="btn-orange w-full py-4 rounded-2xl font-black text-lg mt-4">
                  Kayıt Oluştur
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 133, 0, 0.2);
          border-radius: 10px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 133, 0, 0.5);
        }
      `}</style>
    </div>
  );
}
