import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Play, 
  LayoutDashboard, 
  UserCircle, 
  Settings, 
  Trash2, 
  Plus, 
  Info,
  Maximize2,
  Minimize2,
  Monitor,
  Film,
  Activity,
  Zap,
  LogIn,
  ExternalLink,
  MessageCircle,
  Search,
  X,
  Download,
  Smartphone,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onSnapshot, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  writeBatch,
  runTransaction,
  getDocs,
  deleteField,
  serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signIn, signInRedirect, handleRedirectResult, signOut, firebaseConfigMissing, missingFirebaseKeys, handleFirestoreError, isIframe } from './lib/firebase';
import { Movie, Session, Group, Booking, HistoryItem, ViewMode, LaserTagSession } from './types';
import LaserTagView from './components/LaserTagView';
import { MOVIES, START_TIME, END_TIME, INTERVAL, SESSION_DURATION } from './utils/constants';
import { getNowHHMM, generateSessions, generateLaserTagSessions } from './utils/helpers';

// --- App Component ---

const MOVIE_DETAILS: Record<string, {
  genre: string;
  icon: string;
  color: string;
  duration: string;
  intensity: 'Düşük' | 'Orta' | 'Yüksek';
  desc: string;
}> = {
  '1': { genre: 'Keşif & Kültür', icon: '🏔️', color: 'from-orange-500/20 to-amber-500/10', duration: '11 Dakika', intensity: 'Düşük', desc: 'Sanal gerçeklikte Çin\'in büyüleyici nehirlerini ve tarihi Çin Seddi\'ni göklerden keşfedin.' },
  '2': { genre: 'Keşif & Kültür', icon: '🏮', color: 'from-indigo-500/20 to-purple-500/10', duration: '11 Dakika', intensity: 'Düşük', desc: 'Asya’nın mistik tapınaklarını ve Sakura ağaçları altındaki sakin doğasını yaşayın.' },
  '3': { genre: 'Aksiyon & Uçuş', icon: '🇺🇸', color: 'from-cyan-500/20 to-blue-500/10', duration: '11 Dakika', intensity: 'Orta', desc: 'Gökdelenlerin arasından süzülerek kanyonlarda nefes kesen bir uçuş simülasyonu.' },
  '4': { genre: 'Doğa & Macera', icon: '🦁', color: 'from-emerald-500/20 to-teal-500/10', duration: '11 Dakika', intensity: 'Düşük', desc: 'Vahşi yaşamın kalbine yolculuk yapın, aslanlar ve zürafalarla aynı ortamda bulunun.' },
  '5': { genre: 'Korku & Gerilim', icon: '👻', color: 'from-red-500/20 to-rose-500/10', duration: '11 Dakika', intensity: 'Yüksek', desc: 'Karanlık koridorlar ve gizemli olaylarla dolu, cesaretinizi sınayacak tüyler ürpetici bir VR deneyimi.' },
  '6': { genre: 'Doğa & Macera', icon: '🦖', color: 'from-yellow-500/20 to-amber-500/10', duration: '11 Dakika', intensity: 'Yüksek', desc: 'T-rex ve pterozorlar arasında hayatta kalmaya çalışacağınız, devasa canlılarla dolu bir dönem.' },
  '7': { genre: 'Keşif & Kültür', icon: '🌍', color: 'from-lime-500/20 to-green-500/10', duration: '11 Dakika', intensity: 'Düşük', desc: 'Dünya harikalarını ve en ünlü turistik merkezleri panoramik VR uçuşuyla seyre dalın.' },
  '8': { genre: 'Keşif & Kültür', icon: '🏜️', color: 'from-yellow-600/20 to-orange-500/10', duration: '11 Dakika', intensity: 'Orta', desc: 'Sonsuz çöl manzaraları ve fütüristik mimarinin harmanlandığı sıra dışı bir seyahat.' }
};

const RealTimeClock = () => {
  const [time, setTime] = useState(getNowHHMM());
  useEffect(() => {
    const interval = setInterval(() => setTime(getNowHHMM()), 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{time}</>;
};

export default function App() {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const bootstrappedRef = useRef(false);
  const [authLoading, setAuthLoading] = useState(true);

  // --- State ---
  const [name, setName] = useState<string>(() => localStorage.getItem('zeplinx_operator_name') || '');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  
  // --- Laser Tag & Experience States ---
  const [activeExperience, setActiveExperience] = useState<'vrtiyatro' | 'lasertag'>('vrtiyatro');
  const [laserTagSessions, setLaserTagSessions] = useState<any[]>([]);
  const [laserTagStartIndex, setLaserTagStartIndex] = useState(0);
  const [showLaserTagBooking, setShowLaserTagBooking] = useState<{ sessionId: string } | null>(null);
  const [activeLaserTagId, setActiveLaserTagId] = useState<string | null>(null);
  const [laserTagSimLogs, setLaserTagSimLogs] = useState<{ id: string; timestamp: string; text: string; type: 'hit' | 'objective' | 'system' | 'elimination' }[]>([]);
  const [laserTagSimScores, setLaserTagSimScores] = useState<any[]>([]);
  const [laserTagSecsLeft, setLaserTagSecsLeft] = useState<number>(600);
  const [laserTagActiveTime, setLaserTagActiveTime] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('kasiyer');
  const [adminAuthenticated, setAdminAuthenticated] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [capacity, setCapacity] = useState(8);
  const [windowStartIndex, setWindowStartIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showMovieCatalog, setShowMovieCatalog] = useState(false);
  const [selectedMovieGenre, setSelectedMovieGenre] = useState<string>('Hepsi');
  const [showBookingModal, setShowBookingModal] = useState<{ sessionId: string, count: number } | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [showAttendees, setShowAttendees] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [currentTime, setCurrentTime] = useState(getNowHHMM());
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'info' | 'warning' }[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sessionSearch, setSessionSearch] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [lastAuthError, setLastAuthError] = useState<{ code: string; message: string } | null>(null);

  // --- PWA Installation State ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  if (firebaseConfigMissing) {
    return (
      <div className="min-h-screen bg-[#0B0D11] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 p-8 rounded-[32px] shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6">
            <Settings className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter mb-4">Yapılandırma Gerekli</h1>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Firebase bağlantısı kurulamadı. Lütfen projenin <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">.env</code> 
            ayarlarını veya platform üzerindeki API anahtarlarını kontrol edin.
          </p>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Eksik Anahtarlar:</p>
            <div className="flex flex-wrap gap-2">
              {missingFirebaseKeys.map(key => (
                <span key={key} className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded-md text-white/60">
                  {key}
                </span>
              ))}
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full mt-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all border border-white/5"
          >
            YENİDEN DENE
          </button>
        </div>
      </div>
    );
  }

  const addToast = (message: string, type: 'info' | 'warning' = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // --- Auth Effect ---
  useEffect(() => {
    if (firebaseConfigMissing) {
      setAuthLoading(false);
      return;
    }
    
    // Check for redirect result on initialization
    handleRedirectResult().catch(err => {
      console.error("Initialization redirect error:", err);
      // We don't set error here as it might just be a standard load
    });

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // --- PWA Installation Effect ---
  useEffect(() => {
    // Detect iOS
    const iosDetected = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iosDetected);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      addToast("Uygulama başarıyla cihazınıza kuruldu!", "info");
    };
    
    window.addEventListener('appinstalled', installedHandler);

    // If already in standalone mode, hide prompts
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setShowInstallBanner(false);
    } else if (iosDetected) {
      // For iOS devices, show banner manually since beforeinstallprompt is not supported
      setShowInstallBanner(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        addToast("iOS cihazlarda yüklemek için tarayıcı paylaş butonuna basıp 'Ana Ekrana Ekle' seçeneğini seçin.", "info");
      } else {
        // Fallback for manually prompting or checking
        addToast("iOS kullanıyorsanız Paylaş > Ana Ekrana Ekle yapabilirsiniz. Android için yukarıda indirme butonu yoksa Chrome menüsünden 'Yükle' seçeneğini seçebilirsiniz.", "info");
      }
      return;
    }
    
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User choice outcome: ${outcome}`);
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      }
    } catch (err) {
      console.error("Install prompt error:", err);
    }
  };

  // --- Firestore Sync Effects ---
  useEffect(() => {
    if (!user || firebaseConfigMissing) return;

    // Sync Sessions
    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap) => {
      const docs = snap.docs.map(d => d.data() as Session);
      if (docs.length === 0) {
        if (!bootstrappedRef.current) {
          bootstrappedRef.current = true;
          const initial = generateSessions();
        const batch = writeBatch(db);
        initial.forEach(s => batch.set(doc(db, 'sessions', s.id), s));
        batch.commit().catch(e => handleFirestoreError(e, 'WRITE' as any, 'sessions'));
        }
      } else {
        setSessions(docs.sort((a, b) => a.time.localeCompare(b.time)).map(s => {
          const nowStr = getNowHHMM();
          const [hours, mins] = s.time.split(':').map(Number);
          const [nowH, nowM] = nowStr.split(':').map(Number);
          return {
            ...s,
            isFinished: (hours * 60 + mins + INTERVAL) <= (nowH * 60 + nowM)
          };
        }));
      }
    }, (error) => handleFirestoreError(error, 'LIST' as any, 'sessions'));

    // Sync Laser Tag Sessions
    const unsubLaserTag = onSnapshot(collection(db, 'lasertag_sessions'), (snap) => {
      const docs = snap.docs.map(d => d.data());
      if (docs.length === 0) {
        if (!bootstrappedRef.current) {
          const initial = generateLaserTagSessions();
          const batch = writeBatch(db);
          initial.forEach(s => batch.set(doc(db, 'lasertag_sessions', s.id), s));
          batch.commit().catch(e => handleFirestoreError(e, 'WRITE' as any, 'lasertag_sessions'));
        }
      } else {
        setLaserTagSessions(docs.sort((a, b) => a.time.localeCompare(b.time)).map(s => {
          const nowStr = getNowHHMM();
          const [hours, mins] = s.time.split(':').map(Number);
          const [nowH, nowM] = nowStr.split(':').map(Number);
          return {
            ...s,
            isFinished: (hours * 60 + mins + 20) <= (nowH * 60 + nowM)
          };
        }));
      }
    }, (error) => handleFirestoreError(error, 'LIST' as any, 'lasertag_sessions'));

    // Sync Groups
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      setGroups(snap.docs.map(d => d.data() as Group));
    }, (error) => handleFirestoreError(error, 'LIST' as any, 'groups'));

    // Sync History
    const unsubHistory = onSnapshot(query(collection(db, 'history'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setHistory(snap.docs.map(d => d.data() as HistoryItem));
    }, (error) => handleFirestoreError(error, 'LIST' as any, 'history'));

    // Sync Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.capacity) setCapacity(data.capacity);
        if (data.operatorName) {
          setName(data.operatorName);
          localStorage.setItem('zeplinx_operator_name', data.operatorName);
        }
      } else {
        const defaultName = localStorage.getItem('zeplinx_operator_name') || 'Ana Şube';
        setDoc(doc(db, 'settings', 'global'), { capacity: 8, operatorName: defaultName })
          .catch(e => handleFirestoreError(e, 'WRITE' as any, 'settings/global'));
      }
      setSettingsLoaded(true);
    }, (error) => {
      handleFirestoreError(error, 'GET' as any, 'settings/global');
      setSettingsLoaded(true);
    });

    return () => {
      unsubSessions();
      unsubLaserTag();
      unsubGroups();
      unsubHistory();
      unsubSettings();
    };
  }, [user]);

  // Timer Effect for Countdown & State
  useEffect(() => {
    // Timer Effect is now purely for local UI calculation, done natively in computed properties, 
    // but we still need to trigger re-renders to update timestamps correctly.
    // RealTimeClock handles the header time. This interval only exists to push state updates if we used them,
    // actually we can just drop it entirely if we calculate `isFinished` dynamically based on `getNowHHMM()`.
  }, [sessions]);

  // Check for upcoming notifications
  useEffect(() => {
    if (viewMode !== 'kasiyer') return;

    const intervalId = setInterval(() => {
      const nowMs = Date.now();
      
      sessions.forEach(s => {
        if (!s.isFinished && (s.bookings || []).length > 0) {
          const [hours, mins] = s.time.split(':').map(Number);
          const t = new Date();
          t.setHours(hours, mins, 0, 0);
          
          const timeDiffMs = t.getTime() - nowMs;
          const timeDiffMins = Math.floor(timeDiffMs / 60000);
          
          // Use toast instead of alert to prevent blocking the UI
          if (timeDiffMins === 4) {
            const customers = (s.bookings || []).map(b => b.customerName).join(', ');
            addToast(`DIKKAT: Saat ${s.time} seansına 4 dakika kaldı! Müşteriler: ${customers}`, 'warning');
          }
        }
      });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [sessions, viewMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = getNowHHMM();
      setCurrentTime(now);
      
      const nowMs = Date.now();

      setSessions(prev => {
        const nextSessions = prev.map(s => {
          const [hours, mins] = s.time.split(':').map(Number);
          const sessionMins = hours * 60 + mins;
          const [nowH, nowM] = now.split(':').map(Number);
          const nowMins = nowH * 60 + nowM;
          const finished = sessionMins + INTERVAL <= nowMins;
          
          if (s.isFinished !== finished) {
            return { ...s, isFinished: finished };
          }
          return s;
        });

        // Also check if any active session should be stopped
        const activeSession = nextSessions.find(s => s.status === 'active');
        if (activeSession && activeSession.activeSince) {
          const elapsedMins = (nowMs - activeSession.activeSince) / 60000;
          if (elapsedMins >= SESSION_DURATION) {
            // Un-active it
            (async () => {
              try {
                const { writeBatch, doc, deleteField } = await import('firebase/firestore');
                const batch = writeBatch(db);
                batch.update(doc(db, 'sessions', activeSession.id), { status: 'open', activeSince: deleteField() });
                batch.update(doc(db, 'settings', 'global'), { activeSessionId: deleteField() });
                await batch.commit();
              } catch(e) { console.error("Active session clear error", e); }
            })();
          }
        }
        
        return nextSessions;
      });
    }, 10000); // check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Sync window start index once
  const initializedWindowRef = useRef(false);
  useEffect(() => {
    if (sessions.length > 0 && !initializedWindowRef.current) {
      const nowIdx = sessions.findIndex(s => s.time >= currentTime);
      if (nowIdx !== -1) {
        setWindowStartIndex(Math.max(0, nowIdx));
        initializedWindowRef.current = true;
      }
    }
  }, [sessions, currentTime]);

  // --- Business Logic with Firestore ---
  const addHistory = async (action: string, details: string) => {
    if (!user) return;
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'history', id), {
      id,
      timestamp: getNowHHMM(),
      action,
      details
    });
  };

  const updateSession = async (sessionId: string, updates: Partial<Session>) => {
    if (!user) return;
    await updateDoc(doc(db, 'sessions', sessionId), updates);
  };

  const updateLaserTagSession = async (sessionId: string, updates: Partial<LaserTagSession>) => {
    if (!user) return;
    await updateDoc(doc(db, 'lasertag_sessions', sessionId), updates as any);
  };

  const changeSessionMovie = async (sessionId: string, movieId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.isFinished) return;
    
    const updatedBookings = (session.bookings || []).map(b => ({ ...b, movieId }));
    await updateSession(sessionId, { movieId, bookings: updatedBookings });
    await addHistory("Film Değiştirildi", `${session.time} seansının filmi değiştirildi.`);
  };

  const addPerson = async (sessionId: string, count: number) => {
    try {
      await runTransaction(db, async (transaction) => {
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists()) throw new Error("Seans bulunamadı");
        
        const sessionData = sessionDoc.data() as Session;
        if (sessionData.isFinished) throw new Error("Bu seans bitmiş!");
        
        const currentCount = sessionData.peopleCount || 0;
        
        if (currentCount + count > capacity) {
          const remaining = capacity - currentCount;
          if (remaining <= 0) throw new Error("Kapasite yetersiz!");
          transaction.update(sessionRef, { peopleCount: capacity });
          return remaining; // returning to know how much added
        } else {
          transaction.update(sessionRef, { peopleCount: currentCount + count });
          return count;
        }
      }).then(async (added) => {
        await addHistory("Kişi Eklendi", `${sessions.find(s => s.id === sessionId)?.time} seansına ${added} kişi eklendi.`);
      });
    } catch (e: any) {
      addToast(e.message, 'warning');
    }
  };

  const registerCustomer = async (sessionId: string, customerName: string, phone: string, count: number, movieId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists()) throw new Error("Seans bulunamadı");
        
        const sessionData = sessionDoc.data() as Session;
        if (sessionData.isFinished) throw new Error("Bu seans bitmiş!");
        
        const currentCount = sessionData.peopleCount || 0;
        if (currentCount + count > capacity) {
          throw new Error("Kapasite yetersiz!");
        }

        const finalMovieId = movieId || sessionData.movieId || MOVIES[0].id;
        const newBooking: Booking = {
          id: crypto.randomUUID(),
          customerName,
          phone,
          count,
          movieId: finalMovieId
        };

        const currentBookings = (sessionData.bookings || []).map(b => ({ ...b, movieId: finalMovieId }));
        
        transaction.update(sessionRef, {
          peopleCount: currentCount + count,
          bookings: [...currentBookings, newBooking],
          movieId: finalMovieId
        });
      });
      await addHistory("Müşteri Kaydı", `${sessions.find(s => s.id === sessionId)?.time} seansı: ${customerName} (+${count})`);
    } catch (e: any) {
      addToast(e.message, 'warning');
      throw e; // re-throw to allow component to handle it if needed
    }
  };

  const shiftSessions = async (startSessionId: string, minutes: number) => {
    const startIdx = sessions.findIndex(s => s.id === startSessionId);
    if (startIdx === -1) return;

    const batch = writeBatch(db);
    sessions.forEach((s, idx) => {
      if (idx >= startIdx) {
        const [hours, mins] = s.time.split(':').map(Number);
        const date = new Date(2000, 0, 1, hours, mins);
        date.setMinutes(date.getMinutes() + minutes);
        
        const newTime = date.toTimeString().slice(0, 5);
        const newId = `session-${newTime.replace(':', '')}`;
        const sessionMins = date.getHours() * 60 + date.getMinutes();
        const [nowH, nowM] = currentTime.split(':').map(Number);
        const isFinished = sessionMins + INTERVAL <= (nowH * 60 + nowM);

        if (s.id !== newId) {
          batch.delete(doc(db, 'sessions', s.id));
          batch.set(doc(db, 'sessions', newId), { 
            ...s, 
            time: newTime, 
            id: newId,
            isFinished 
          });
        } else {
          batch.update(doc(db, 'sessions', s.id), { time: newTime, isFinished });
        }
      }
    });

    await batch.commit();
    await addHistory("Zaman Kaydırma", `${sessions[startIdx].time} ve sonrası ${minutes < 0 ? 'geri' : 'ileri'} alındı.`);
  };

  const removePerson = async (sessionId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists()) throw new Error("Seans bulunamadı");

        const sessionData = sessionDoc.data() as Session;
        if (sessionData.isFinished || sessionData.peopleCount <= 0) return; // Do nothing silently

        const bookingsTotal = (sessionData.bookings || []).reduce((acc: number, b: any) => acc + b.count, 0);
        if (sessionData.peopleCount <= bookingsTotal) {
          throw new Error("Kayıtlı kişi sayısından daha azına inilemez. Kaydı silmeniz gerekir.");
        }

        transaction.update(sessionRef, { peopleCount: sessionData.peopleCount - 1 });
      }).then(async () => {
        await addHistory("Kişi Çıkarıldı", `${sessions.find(s => s.id === sessionId)?.time} seansından 1 kişi çıkarıldı (Walk-in).`);
      });
    } catch (e: any) {
      if (e.message) addToast(e.message, 'warning');
    }
  };

  const removeBooking = async (sessionId: string, bookingId: string) => {
    try {
      let removedName = "";
      await runTransaction(db, async (transaction) => {
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists()) return;

        const sessionData = sessionDoc.data() as Session;
        if (sessionData.isFinished) return;

        const booking = (sessionData.bookings || []).find((b: any) => b.id === bookingId);
        if (!booking) return;

        removedName = booking.customerName;

        transaction.update(sessionRef, {
          peopleCount: Math.max(0, sessionData.peopleCount - booking.count),
          bookings: (sessionData.bookings || []).filter((b: any) => b.id !== bookingId)
        });
      });
      if (removedName) {
         await addHistory("Kayıt Silindi", `${sessions.find(s => s.id === sessionId)?.time} seansından ${removedName} kaydı silindi.`);
      }
    } catch (e: any) {
       console.error("Remove booking failed:", e);
    }
  };

  const startSession = async (sessionId: string) => {
    // Basic local safeguard before attempting transaction
    const activeSession = sessions.find(s => s.status === 'active');
    if (activeSession) {
      addToast("Zaten aktif bir seans var! Önce onun bitmesini bekleyin.", 'warning');
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const sessionRef = doc(db, 'sessions', sessionId);
        const lockRef = doc(db, 'settings', 'global');
        const [sessionDoc, lockDoc] = await Promise.all([
           transaction.get(sessionRef),
           transaction.get(lockRef)
        ]);
        
        if (lockDoc.exists()) {
           const data = lockDoc.data();
           if (data.activeSessionId && data.activeSessionId !== sessionId) {
              throw new Error("Başka bir cihazda aktif seans başlatılmış olabilir!");
           }
        }
    
        
        if (!sessionDoc.exists()) {
          throw new Error("Seans bulunamadı");
        }
        
        const sessionData = sessionDoc.data() as Session;
        if (sessionData.status === 'active') {
          throw new Error("Bu seans zaten başlatılmış!");
        }
        if (sessionData.status === 'maintenance' || sessionData.isFinished) {
          throw new Error("Bu seans başlatılamaz.");
        }

        // Technically we can't query all active sessions in a transaction. 
        // We rely on local state guard above for general overlap, and this transaction guards the specific session race condition.
        transaction.update(sessionRef, { status: 'active', activeSince: Date.now() });
        transaction.set(lockRef, { activeSessionId: sessionId }, { merge: true });
      });
      await addHistory("Seans Başlatıldı", `${sessions.find(s => s.id === sessionId)?.time} seansı operatör tarafından başlatıldı.`);
    } catch (e: any) {
      addToast(e.message || "Seans başlatılamadı", 'warning');
    }
  };

  const suggestSession = () => {
    const now = getNowHHMM();
    const suggested = sessions.find(s => !s.isFinished && s.time >= now && s.peopleCount < capacity && !s.groupId);
    if (suggested) {
      const idx = sessions.indexOf(suggested);
      // Ensure we don't go out of bounds for the 12-session view, and never drop below 0
      setWindowStartIndex(Math.max(0, Math.min(Math.max(0, sessions.length - 12), idx)));
    }
  };

  const addGroup = async (groupName: string, peopleCount: number, startSessionId: string) => {
    const startIdx = sessions.findIndex(s => s.id === startSessionId);
    if (startIdx === -1) return;
    
    const sessionsNeeded = Math.ceil(peopleCount / capacity);
    const targetSessionIds: string[] = [];
    
    for (let i = 0; i < sessionsNeeded; i++) {
      const s = sessions[startIdx + i];
      if (!s) break;
      if (s.isFinished || s.status === 'active' || (s.bookings && s.bookings.length > 0)) {
        addToast(`${s.time} seansı meşgul veya aktif! Lütfen başka bir başlangıç saati seçin.`, 'warning');
        return;
      }
      targetSessionIds.push(s.id);
    }

    if (targetSessionIds.length < sessionsNeeded) {
      addToast("Bu gruptan sonra yeterli seans yok!", 'warning');
      return;
    }

    const groupId = crypto.randomUUID();
    const newGroup: Group = {
      id: groupId,
      name: groupName,
      peopleCount,
      sessionsBlocked: targetSessionIds
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'groups', groupId), newGroup);
    let remaining = peopleCount;
    targetSessionIds.forEach(id => {
      const c = Math.min(capacity, remaining);
      remaining -= c;
      batch.update(doc(db, 'sessions', id), { groupId, peopleCount: c });
    });
    await batch.commit();

    await addHistory("Grup Eklendi", `${groupName} (${peopleCount} kişi)`);
    setPinInput('');
  };

  const deleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const batch = writeBatch(db);
    batch.delete(doc(db, 'groups', groupId));
    group.sessionsBlocked.forEach(id => {
      batch.update(doc(db, 'sessions', id), { groupId: deleteField(), peopleCount: 0, bookings: [] }); 
    });
    await batch.commit();

    await addHistory("Grup Silindi", `${group.name} rezeryasyonu iptal edildi.`);
  };

  const updateGlobalSettings = async (updates: { capacity?: number, operatorName?: string }) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'settings', 'global'), updates);
      await addHistory("Ayarlar Güncellendi", "Sistem ayarları yönetici tarafından değiştirildi.");
    } catch (e: any) {
      addToast("Ayarlar güncellenemedi: " + (e.message || "Bilinmeyen hata"), 'warning');
    }
  };

  const resetDay = async () => {
    setConfirmAction({
      message: "Günü sıfırlamak istediğinize emin misiniz? Tüm veriler silinecek.",
      onConfirm: async () => {
        try {
          const allHistory = await getDocs(collection(db, 'history'));
          
          let opCount = 0;
          let currentBatch = writeBatch(db);
          const commitBatch = async () => {
            if (opCount > 0) {
              await currentBatch.commit();
              currentBatch = writeBatch(db);
              opCount = 0;
            }
          };

          const doOp = async (op: () => void) => {
            op();
            opCount++;
            if (opCount === 490) await commitBatch();
          };

          const initial = generateSessions();
          for (const s of sessions) await doOp(() => currentBatch.delete(doc(db, 'sessions', s.id)));
          for (const s of initial) await doOp(() => currentBatch.set(doc(db, 'sessions', s.id), s));
          for (const g of groups) await doOp(() => currentBatch.delete(doc(db, 'groups', g.id)));
          for (const docSnap of allHistory.docs) await doOp(() => currentBatch.delete(docSnap.ref));
          
          await commitBatch();
          await addHistory("Sistem Sıfırlandı", "Yeni bir gün başlatıldı.");
        } catch (e: any) {
          addToast(e.message || "Sıfırlama başarısız", 'warning');
        }
      }
    });
  };

  const filteredWindowSessions = useMemo(() => {
    let result = sessions;
    const isSearching = sessionSearch.trim().length > 0;
    
    if (isSearching) {
      const search = sessionSearch.toLowerCase();
      result = sessions.filter(s => {
        const bookings = s.bookings || [];
        const isSelectedByBooking = bookings.some(b => 
          b.customerName.toLowerCase().includes(search) || 
          b.phone.includes(search)
        );
        const isSelectedByTime = s.time.includes(search);
        
        let isSelectedByGroup = false;
        if (s.groupId) {
          const group = groups.find(g => g.id === s.groupId);
          if (group?.name) {
            isSelectedByGroup = group.name.toLowerCase().includes(search);
          }
        }
        
        return isSelectedByBooking || isSelectedByTime || isSelectedByGroup;
      });
    }
    
    // Desktop: Show more per window
    const pageSize = viewMode === 'kasiyer' ? (showSidebar ? 12 : 24) : 12;
    const start = isSearching ? 0 : windowStartIndex;
    return result.slice(start, start + pageSize);
  }, [sessions, windowStartIndex, viewMode, showSidebar, sessionSearch, groups]);

  const stats = useMemo(() => {
    const totalPeople = sessions.reduce((acc, s) => acc + s.peopleCount, 0);
    const fullSessions = sessions.filter(s => s.peopleCount >= capacity).length;
    
    return { totalPeople, fullSessions };
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
  if (authLoading || (user && !settingsLoaded)) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500 font-bold tracking-widest uppercase text-[10px]">Bulut Verileri Yükleniyor...</span>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 text-[10px] text-white/20 hover:text-white/40 underline uppercase tracking-widest"
          >
            Bağlantıyı Yenile
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(255,133,0,0.05),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(159,122,234,0.05),transparent_40%)]">
        <div className="max-w-md w-full glass p-12 rounded-[40px] border border-white/5 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-orange to-brand-purple" />
          <div className="w-20 h-20 bg-brand-orange/10 flex items-center justify-center rounded-3xl mb-8">
            <Zap className="text-brand-orange w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-4 uppercase">Zeplinx VR</h1>
          <p className="text-slate-400 text-sm mb-8 font-medium">Bulut tabanlı seans yönetimi ve merkez takibi için lütfen personel hesabınızla giriş yapın.</p>
          
          {isIframe() && (
            <div className="bg-brand-orange/10 border border-brand-orange/20 rounded-2xl p-4 mb-8 text-left animate-pulse">
              <div className="flex items-center gap-2 text-brand-orange font-bold text-xs mb-1 uppercase tracking-tighter">
                <Info size={14} />
                Önemli Uyarı
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                Uygulama şu an bir önizleme penceresinde çalışıyor. <strong>"Siteye ulaşılamıyor"</strong> hatası alıyorsanız, lütfen en alttaki <strong>"YENİ SEKMEDE AÇ"</strong> butonunu kullanarak devam edin.
              </p>
            </div>
          )}

          <button 
            disabled={authSubmitting}
            onClick={async () => {
              setAuthSubmitting(true);
              try {
                setLastAuthError(null);
                await signIn();
              } catch (e: any) {
                console.error("Sign-in failed", e);
                setLastAuthError({ code: e.code || 'unknown', message: e.message || 'Bilinmeyen hata' });
                
                if (e.code === 'auth/popup-blocked') {
                  addToast("Açılır pencere engellendi! Lütfen izin verin.", "warning");
                } else if (e.code === 'auth/popup-closed-by-user') {
                  addToast("Giriş penceresi kapatıldı.", "info");
                } else if (e.code === 'auth/unauthorized-domain') {
                  addToast("Yetkisiz alan adı! Firebase Console'dan bu domaini eklemelisiniz.", "warning");
                } else {
                  addToast("Giriş hatası! Lütfen detayları kontrol edin.", "warning");
                }
              } finally {
                setAuthSubmitting(false);
              }
            }}
            className="w-full flex items-center justify-center gap-4 bg-white text-dark-bg py-5 rounded-2xl font-black text-lg transition-all hover:bg-brand-orange hover:text-white group active:scale-95 shadow-xl mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {authSubmitting ? (
              <div className="w-6 h-6 border-2 border-dark-bg border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={24} />
                PERSONEL GİRİŞİ YAP
              </>
            )}
          </button>

          <button 
            disabled={authSubmitting}
            onClick={async () => {
              setAuthSubmitting(true);
              try {
                setLastAuthError(null);
                await signInRedirect();
              } catch (e: any) {
                setLastAuthError({ code: e.code || 'unknown', message: e.message || 'Bilinmeyen hata' });
                addToast("Alternatif giriş başlatılamadı.", "warning");
              } finally {
                setAuthSubmitting(false);
              }
            }}
            className="w-full flex items-center justify-center gap-3 bg-white/5 text-white/60 py-4 rounded-xl font-bold text-xs transition-all hover:bg-white/10 hover:text-white border border-white/5 mb-8"
          >
            <ExternalLink size={16} />
            ALTERNATİF GİRİŞ YÖNTEMİ (REDIRECT)
          </button>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-left w-full">
            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Info size={12} />
              GİRİŞ SORUNU GİDERME
            </h4>
            
            {lastAuthError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] text-red-400 font-bold uppercase">Tespit Edilen Hata:</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`Code: ${lastAuthError.code}\nMessage: ${lastAuthError.message}`);
                      addToast("Hata kopyalandı", "info");
                    }}
                    className="text-[9px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded hover:bg-red-500/30 transition-colors"
                  >
                    KOPYALA
                  </button>
                </div>
                <code className="text-[10px] font-mono text-white/70 block break-all leading-tight bg-black/20 p-2 rounded">
                  Kod: {lastAuthError.code}<br/>
                  {lastAuthError.message}
                </code>
              </div>
            )}

            <div className="text-[11px] text-slate-500 space-y-2 font-medium leading-relaxed">
              <p>• Eğer <strong>"Siteye ulaşılamıyor"</strong> hatası alıyorsanız, lütfen sağ üstteki butondan uygulamayı <strong>yeni sekmede açın</strong>.</p>
              <p>• Giriş penceresi hemen kapanıyorsa tarayıcınızın <strong>pop-up engelleyicisini</strong> kapatın.</p>
            </div>
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-5 flex items-center justify-center gap-2 w-full py-3 bg-white/10 hover:bg-brand-purple text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest border border-white/5 shadow-lg group"
            >
              <ExternalLink size={14} className="group-hover:scale-110 transition-transform" />
              UYGULAMAYI YENİ SEKMEDE AÇ
            </a>
          </div>
          
          <p className="mt-8 text-[10px] text-slate-600 font-bold uppercase tracking-widest">ZEPLINX VR OPERASYON MERKEZİ v2.1</p>
        </div>
      </div>
    );
  }

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
            placeholder="Şube/Kasa İsmi Girin..."
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 mb-6 focus:outline-none focus:border-brand-orange transition-colors text-white text-center font-bold"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button 
            onClick={() => {
              if (name) {
                localStorage.setItem('zeplinx_operator_name', name);
                updateGlobalSettings({ operatorName: name });
              }
            }}
            className="btn-orange w-full py-4 text-lg font-black tracking-widest"
          >
            SİSTEMİ BULUTA BAĞLA
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen flex bg-[#0B0D11] text-slate-200 selection:bg-brand-orange/30 font-sans overflow-hidden">
      {/* Toast System */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none max-w-[400px] w-full">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/5 backdrop-blur-xl flex items-center justify-between gap-4 ${
                toast.type === 'warning' ? 'bg-brand-orange/20 border-l-4 border-l-brand-orange' : 'bg-cyan-500/20 border-l-4 border-l-cyan-400'
              }`}
            >
              <div className="flex items-center gap-3">
                {toast.type === 'warning' ? <Zap className="text-brand-orange" size={20} /> : <Info className="text-cyan-400" size={20} />}
                <span className="text-xs font-bold leading-tight">{toast.message}</span>
              </div>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="shrink-0 p-1 hover:bg-white/10 rounded-md transition-colors">
                <Plus size={16} className="rotate-45 opacity-50" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-[280px] bg-[#0F1115] border-r border-white/5 p-6 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-orange rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-orange/20">
                    <Zap size={24} className="text-white fill-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-black tracking-tighter text-white">ZEPLINX VR</h1>
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest leading-none mt-0.5">Admin-Panel v2</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-white active:scale-95 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mobile Experience Switcher (Fully Activated) */}
              <div className="mb-6 bg-white/[0.02] border border-white/5 p-1 rounded-2xl shrink-0">
                <div className="flex items-center justify-between gap-1">
                  <button 
                    onClick={() => setActiveExperience('vrtiyatro')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                      activeExperience === 'vrtiyatro'
                        ? 'bg-brand-orange/15 text-brand-orange border border-brand-orange/20 shadow-lg shadow-brand-orange/5'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Zap size={12} className={activeExperience === 'vrtiyatro' ? 'fill-brand-orange text-brand-orange animate-pulse' : 'text-slate-400'} />
                    <span>VR TİYATRO</span>
                  </button>
                  <button 
                    onClick={() => setActiveExperience('lasertag')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                      activeExperience === 'lasertag'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/5'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Target size={12} className={activeExperience === 'lasertag' ? 'text-cyan-400 animate-pulse' : 'text-slate-400'} />
                    <span>LASER TAG</span>
                  </button>
                </div>
              </div>

              <nav className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scroll pr-2">
                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 px-4">Paneller</div>
                {[
                  { id: 'kasiyer', icon: LayoutDashboard, label: 'Kasiyer Paneli' },
                  { id: 'admin', icon: Settings, label: 'Yönetici Paneli' },
                  { id: 'musteri', icon: Monitor, label: 'Müşteri Ekranı' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setViewMode(item.id as ViewMode);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group ${
                      viewMode === item.id 
                        ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20' 
                        : 'text-slate-500 bg-white/[0.02] hover:bg-white/5 hover:text-slate-300'
                    }`}
                  >
                    <item.icon size={22} />
                    <span className="font-bold text-base">{item.label}</span>
                  </button>
                ))}

                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-6 mb-2 px-4">Hızlı Erisim</div>
                <button 
                  onClick={() => { setShowMovieCatalog(true); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-4 px-4 py-4 rounded-2xl transition-all text-slate-500 bg-white/[0.02] hover:bg-white/5 hover:text-slate-300"
                >
                  <Film size={22} />
                  <span className="font-bold text-base">Film Kataloğu</span>
                </button>
                <button 
                  onClick={() => { toggleFullScreen(); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-4 px-4 py-4 rounded-2xl transition-all text-slate-500 bg-white/[0.02] hover:bg-white/5 hover:text-slate-300"
                >
                  {isFullScreen ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
                  <span className="font-bold text-base">{isFullScreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Yap'}</span>
                </button>
              </nav>

              {/* Mobile PWA Install Button */}
              <div className="mt-6 mb-2 border-t border-white/5 pt-4 shrink-0">
                <button 
                  onClick={() => {
                    handleInstallClick();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all text-brand-orange bg-brand-orange/10 hover:bg-brand-orange/20 border border-brand-orange/15 shadow-md shadow-brand-orange/10"
                >
                  <Smartphone size={22} className="shrink-0 animate-bounce" />
                  <div className="text-left">
                    <span className="font-extrabold text-sm block leading-none text-white">Uygulamayı İndir</span>
                    <span className="text-[10px] font-medium text-slate-400 block mt-1 leading-tight">Cihaza kurup tam ekran çalıştırın</span>
                  </div>
                </button>
              </div>

              <div className="pt-4 border-t border-white/5 mt-auto">
                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-brand-purple/20 flex items-center justify-center text-brand-purple">
                    <UserCircle size={24} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate text-slate-300">{user?.displayName || name}</p>
                    <button 
                      onClick={signOut}
                      className="text-[10px] font-black text-red-500/70 hover:text-red-500 uppercase tracking-widest mt-0.5 transition-colors"
                    >
                      Çıkış Yap
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persistence Sidebar (Desktop) */}
      {viewMode !== 'musteri' && (
        <aside className={`hidden lg:flex flex-col w-20 xl:w-64 bg-[#0F1115] border-r border-white/5 transition-all duration-300 shrink-0 overflow-hidden`}>
        <div className="p-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-orange rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-orange/20">
              <Zap size={24} className="text-white fill-white" />
            </div>
            <div className="hidden xl:block overflow-hidden">
              <h1 className="text-lg font-black tracking-tighter truncate">ZEPLINX VR</h1>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-widest leading-none mt-0.5">Admin-Panel v2</p>
            </div>
          </div>

          {/* Desktop Sidebar Switcher (Fully Activated) */}
          <div className="hidden xl:flex items-center bg-white/[0.02] border border-white/5 p-1 rounded-2xl mt-6">
            <button 
              onClick={() => setActiveExperience('vrtiyatro')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                activeExperience === 'vrtiyatro'
                  ? 'bg-brand-orange/15 text-brand-orange border border-brand-orange/25 shadow-lg shadow-brand-orange/5'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Zap size={11} className={activeExperience === 'vrtiyatro' ? 'fill-brand-orange text-brand-orange animate-pulse' : 'text-slate-400'} />
              <span>VR TİYATRO</span>
            </button>
            <button 
              onClick={() => setActiveExperience('lasertag')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                activeExperience === 'lasertag'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 shadow-lg shadow-cyan-500/5'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Target size={11} className={activeExperience === 'lasertag' ? 'text-cyan-400 animate-pulse' : 'text-slate-400'} />
              <span>LASER TAG</span>
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 flex flex-col gap-1">
          {[
            { id: 'kasiyer', icon: LayoutDashboard, label: 'Kasiyer Paneli' },
            { id: 'admin', icon: Settings, label: 'Yönetici Paneli' },
            { id: 'musteri', icon: Monitor, label: 'Müşteri Ekranı' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setViewMode(item.id as ViewMode);
              }}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${
                viewMode === item.id 
                  ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20' 
                  : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
              }`}
            >
              <item.icon size={20} />
              <span className="hidden xl:block font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Desktop PWA Install Button */}
        <div className="px-3 mb-2 border-t border-white/5 pt-4">
          <button 
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center xl:justify-start gap-4 px-4 py-3 rounded-xl transition-all text-brand-orange bg-brand-orange/5 hover:bg-brand-orange/15 hover:text-brand-orange group border border-brand-orange/10 shrink-0"
            title="Uygulamayı İndir"
          >
            <Smartphone size={18} className="shrink-0 transition-transform group-hover:scale-110" />
            <div className="hidden xl:block text-left overflow-hidden">
              <span className="font-extrabold text-xs block truncate leading-none text-white">Uygulamayı Yükle</span>
              <span className="text-[9px] font-medium text-slate-500 block truncate mt-1">Hızlı ve Çevrimdışı Çalışır</span>
            </div>
          </button>
        </div>

        <div className="p-4 border-t border-white/5 mx-2 mb-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-purple/20 flex items-center justify-center text-brand-purple">
              <UserCircle size={20} />
            </div>
            <div className="hidden xl:block overflow-hidden">
              <p className="text-xs font-bold truncate text-slate-300">{user?.displayName || name}</p>
              <button 
                onClick={signOut}
                className="text-[10px] font-black text-red-500/70 hover:text-red-500 uppercase tracking-widest mt-0.5 transition-colors"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </aside>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 relative h-screen">
        {/* Modern Top Header */}
        {viewMode !== 'musteri' && (
          <header className="h-20 bg-[#0B0D11]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mobile Menu Trigger */}
            <div className="lg:hidden">
              <button 
                className="p-2.5 glass rounded-xl text-brand-orange border border-brand-orange/20 active:scale-95 transition-all shadow-lg" 
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <LayoutDashboard size={20} />
              </button>
            </div>
            
            {/* Experience Switcher Tabs (Upper Left) - Fully Responsive & Activated */}
            <div className="flex items-center bg-white/[0.03] border border-white/5 p-1 rounded-2xl shrink-0">
              <button 
                onClick={() => setActiveExperience('vrtiyatro')}
                className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                  activeExperience === 'vrtiyatro'
                    ? 'bg-brand-orange/15 text-brand-orange border border-brand-orange/20 shadow-lg shadow-brand-orange/5'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Zap size={12} className={activeExperience === 'vrtiyatro' ? 'fill-brand-orange text-brand-orange animate-pulse shrink-0' : 'text-slate-400 shrink-0'} />
                <span className="hidden min-[400px]:inline">VR TİYATRO</span>
                <span className="min-[400px]:hidden">VR</span>
              </button>
              <button 
                onClick={() => setActiveExperience('lasertag')}
                className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                  activeExperience === 'lasertag'
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/5'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Target size={12} className={activeExperience === 'lasertag' ? 'text-cyan-400 animate-pulse shrink-0' : 'text-slate-400 shrink-0'} />
                <span className="hidden min-[400px]:inline">LASER TAG</span>
                <span className="min-[400px]:hidden">TAG</span>
              </button>
            </div>

            <div className="hidden md:flex flex-col border-l border-white/5 pl-3 sm:pl-4">
              <h2 className="text-[9px] sm:text-sm font-black uppercase tracking-[0.2em] text-white/30 leading-none mb-1">Operasyon Modu</h2>
              <p className="text-sm sm:text-xl font-bold tracking-tight uppercase flex items-center gap-2 truncate max-w-[120px] sm:max-w-none">
                {viewMode === 'kasiyer' ? 'Kasiyer' : viewMode === 'admin' ? 'Yönetim' : 'Ekran'}
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1 shrink-0" />
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            {/* Real-time Clock */}
            <div className="flex flex-col items-end">
              <span className="text-[9px] sm:text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">Canlı Zaman</span>
              <div className="text-xl sm:text-3xl font-mono font-black text-brand-orange tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(255,122,0,0.2)]">
                {<RealTimeClock />}
                <span className="hidden sm:inline text-[0.6em] opacity-40 ml-1">:{(new Date().getSeconds()).toString().padStart(2, '0')}</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                onClick={toggleFullScreen}
                className="p-2 sm:p-2.5 glass rounded-xl text-white/40 hover:text-white transition-all active:scale-95 border-white/5"
                title="Tam Ekran"
              >
                {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button 
                onClick={() => setShowMovieCatalog(true)}
                className="hidden sm:block p-2.5 glass rounded-xl text-white/40 hover:text-white transition-all active:scale-95 border-white/5"
                title="Film Kataloğu"
              >
                <Film size={18} />
              </button>
            </div>
          </div>
        </header>
        )}

        {/* Content Area */}
        <main className={`flex-1 overflow-y-auto custom-scroll bg-[#0B0D11] ${viewMode === 'musteri' ? 'p-0' : 'p-4 lg:p-6'}`}>
          {activeExperience === 'lasertag' ? (
            <LaserTagView 
              sessions={laserTagSessions}
              viewMode={viewMode}
              onUpdateSession={updateLaserTagSession}
              onAddHistory={addHistory}
              user={user}
              addToast={addToast}
            />
          ) : (
            <AnimatePresence mode="wait">
            {viewMode === 'kasiyer' && (
            <motion.div 
              key="kasiyer"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-12 gap-6"
            >
              {/* Left Column: Sessions Content */}
              <div className={`col-span-12 ${showSidebar ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} flex flex-col gap-6`}>
                
                {/* Control Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-3 sm:p-4 glass rounded-2xl border border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => setShowSidebar(!showSidebar)}
                      className="hidden lg:flex p-2.5 glass rounded-xl text-white/40 hover:text-white transition-all border-white/5"
                    >
                      {showSidebar ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    
                    {/* Search Field */}
                    <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                      <input 
                         type="text" 
                        placeholder="Müşteri veya grup ara..." 
                        value={sessionSearch}
                        onChange={(e) => setSessionSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 sm:py-2 pl-10 pr-4 text-xs font-bold outline-none focus:border-brand-orange/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    <div className="flex gap-1 h-10 p-1 bg-white/5 rounded-xl border border-white/5 shrink-0">
                      <button 
                        onClick={() => setWindowStartIndex(Math.max(0, windowStartIndex - 6))}
                        disabled={windowStartIndex === 0}
                        className="px-3 rounded-lg hover:bg-white/10 transition-all disabled:opacity-20"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          const nowIdx = sessions.findIndex(s => s.time >= currentTime);
                          if (nowIdx !== -1) setWindowStartIndex(Math.max(0, nowIdx));
                        }}
                        className="px-3 sm:px-4 rounded-lg bg-brand-orange/10 text-brand-orange text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-brand-orange/20"
                      >
                        ŞİMDİ
                      </button>
                      <button 
                        onClick={() => setWindowStartIndex(windowStartIndex + 6)}
                        disabled={windowStartIndex + (showSidebar ? 12 : 24) >= sessions.length}
                        className="px-3 rounded-lg hover:bg-white/10 transition-all disabled:opacity-20"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <button 
                      onClick={suggestSession}
                      className="h-10 px-4 rounded-xl bg-cyan-400/10 text-cyan-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-cyan-400/20 whitespace-nowrap active:scale-95 transition-all shrink-0"
                    >
                      ÖNER
                    </button>
                  </div>
                </div>

                {/* Dense Grid */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${showSidebar ? 'xl:grid-cols-3' : 'xl:grid-cols-4'} gap-4 auto-rows-fr`}>
                  {filteredWindowSessions.map((session) => (
                    <motion.div 
                      key={session.id}
                      layout
                      className={`glass p-4 rounded-2xl flex flex-col border transition-all relative overflow-hidden min-h-[160px] ${
                        session.isFinished 
                          ? 'border-white/5 opacity-50 grayscale' 
                          : session.status === 'active'
                            ? 'border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_30px_rgba(34,211,238,0.1)] ring-1 ring-cyan-500/20'
                            : session.groupId 
                              ? 'border-brand-purple/40 bg-brand-purple/5 ring-1 ring-brand-purple/20' 
                              : session.peopleCount >= capacity 
                                ? 'border-red-500/40 bg-red-500/5' 
                                : 'border-white/10 hover:border-brand-orange/30 group bg-white/[0.01]'
                      }`}
                    >
                      {session.status === 'active' && !session.isFinished && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
                      )}
                      
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <div className={`text-2xl sm:text-3xl font-mono font-black tabular-nums transition-colors ${
                            session.isFinished ? 'text-white/20' : 
                            session.status === 'active' ? 'text-cyan-400' : 'text-brand-orange'
                          }`}>
                            {session.time}
                          </div>
                          
                          <select 
                            value={session.movieId || ''}
                            onChange={(e) => changeSessionMovie(session.id, e.target.value)}
                            disabled={session.isFinished || session.status === 'active'}
                            className={`bg-transparent text-[10px] sm:text-xs font-bold ${session.movieId ? 'text-white/80' : 'text-brand-orange animate-pulse'} outline-none w-[100px] sm:w-[120px] truncate mt-0.5 appearance-none cursor-pointer disabled:cursor-not-allowed`}
                          >
                            <option value="" disabled className="bg-[#0B0D11]">FİLM SEÇİLMEDİ</option>
                            {MOVIES.map(m => (
                              <option key={m.id} value={m.id} className="bg-[#0B0D11]">{m.name}</option>
                            ))}
                          </select>

                          {session.status === 'active' && session.activeSince && (
                            <div className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-black text-cyan-400/80 uppercase">
                              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-ping shrink-0" />
                              <span className="truncate">{Math.max(0, Math.floor(SESSION_DURATION - ((Date.now() - session.activeSince) / 60000)))}D KALDI</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-[0.1em] ${
                            session.isFinished ? 'bg-white/5 text-white/30' :
                            session.status === 'maintenance' ? 'bg-red-500/20 text-red-500' :
                            session.status === 'active' ? 'bg-cyan-500/20 text-cyan-400' :
                            session.groupId ? 'bg-brand-purple/20 text-brand-purple' : 
                            session.peopleCount >= capacity ? 'bg-red-500/20 text-red-500' : 'bg-green-500/10 text-green-400'
                          }`}>
                            {session.isFinished ? 'BİTTİ' : 
                             session.status === 'active' ? 'AKTİF' : 
                             session.groupId ? 'GRUP' : 
                             session.peopleCount >= capacity ? 'DOLU' : 'MUSAİT'}
                          </div>
                          
                          {!session.isFinished && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => shiftSessions(session.id, -1)}
                                className="w-6 h-5 flex items-center justify-center bg-white/5 border border-white/5 rounded-md text-[8px] font-black text-white/30 hover:bg-white/10 hover:text-white transition-all"
                                title="1dk Geri"
                              >
                                -1dk
                              </button>
                              <button 
                                onClick={() => shiftSessions(session.id, 1)}
                                className="w-6 h-5 flex items-center justify-center bg-white/5 border border-white/5 rounded-md text-[8px] font-black text-white/30 hover:bg-white/10 hover:text-white transition-all"
                                title="1dk İleri"
                              >
                                +1dk
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col items-center justify-center my-1 py-1 sm:my-1">
                        <div className="relative group/val transition-transform duration-500 hover:scale-105">
                          {session.groupId ? (
                            <div className="flex flex-col items-center p-2 sm:p-3 bg-brand-purple/5 rounded-3xl border border-brand-purple/20 backdrop-blur-sm">
                              <span className="text-sm sm:text-base font-black text-brand-purple italic uppercase tracking-tighter">GRUP</span>
                              <span className="text-[10px] sm:text-xs font-black text-brand-purple/80 uppercase tracking-widest">{session.peopleCount} KİŞİ</span>
                            </div>
                          ) : session.peopleCount >= capacity ? (
                            <div className="flex flex-col items-center">
                              <span className="text-2xl sm:text-4xl font-black text-red-500 tracking-tighter italic drop-shadow-[0_0_15px_rgba(239,68,68,0.2)]">TAM DOLU</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <div className="flex items-baseline gap-1">
                                <span className="text-5xl sm:text-7xl font-black text-white leading-none tracking-tighter">
                                  {capacity - session.peopleCount}
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-white/10 uppercase italic">/ {capacity}</span>
                              </div>
                              <span className="text-[10px] sm:text-xs font-black text-brand-orange uppercase tracking-[0.2em] mt-1 opacity-60">
                                BOŞ YER
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5 gap-1.5 sm:gap-2">
                        {!session.isFinished ? (
                          <>
                            <div className="flex items-center gap-1">
                              <button onClick={() => removePerson(session.id)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:bg-white/10 active:scale-95 transition-all">-</button>
                              <div className="w-6 sm:w-8 h-8 flex items-center justify-center text-[11px] sm:text-xs font-black text-brand-orange">{session.peopleCount}</div>
                              <button onClick={() => addPerson(session.id, 1)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-orange/20 text-brand-orange flex items-center justify-center hover:bg-brand-orange/30 active:scale-95 transition-all text-base sm:text-lg">+</button>
                            </div>
                            <div className="flex flex-1 gap-1">
                              {session.peopleCount > 0 && !session.groupId && (
                                <button 
                                  onClick={() => setShowAttendees(session.id)}
                                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white/5 rounded-lg text-white/40 hover:bg-white/10 active:scale-95 transition-all"
                                  title="Kişi Listesi"
                                >
                                  <Users size={14} />
                                </button>
                              )}
                              <button 
                                onClick={() => setShowBookingModal({ sessionId: session.id, count: 1 })}
                                disabled={session.peopleCount >= capacity}
                                className="flex-1 h-7 sm:h-8 bg-brand-orange rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-brand-orange/10 hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                              >
                                {session.peopleCount >= capacity ? 'DOLU' : 'KAYIT'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <span className="text-[9px] sm:text-[10px] font-black text-white/10 uppercase tracking-[0.2em] sm:tracking-[0.4em] mx-auto">ARŞİV</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>


              {/* Right Column: Sidebar */}
              {showSidebar && (
                <aside className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
                  {/* Stats Dashboard */}
                  <div className="grid grid-cols-2 gap-3 shrink-0">
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
                    {sessions.filter(s => !s.isFinished && s.status !== 'active' && s.peopleCount < capacity && !s.groupId).slice(0, 3).map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group" onClick={() => {
                        const idx = sessions.findIndex(session => session.id === s.id);
                        setWindowStartIndex(Math.min(sessions.length - 12, Math.max(0, idx)));
                      }}>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-lg text-white group-hover:text-brand-orange transition-colors">{s.time}</span>
                          <span className="text-xs font-bold text-slate-400 capitalize">{MOVIES.find(m => m.id === s.movieId)?.name || 'Film Bekleniyor'}</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[10px] font-black text-brand-orange">{capacity - s.peopleCount} BOŞ</span>
                        </div>
                      </div>
                    ))}
                    {sessions.filter(s => !s.isFinished && s.status !== 'active' && s.peopleCount < capacity && !s.groupId).length === 0 && (
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
            )}
          </motion.div>
        )}

          {viewMode === 'musteri' && (
            <motion.div 
              key="musteri"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={`flex flex-col gap-4 w-full mx-auto px-4 py-4 transition-all bg-black lg:h-full lg:max-h-full lg:overflow-hidden ${isFullScreen ? 'fixed inset-0 z-[200] overflow-y-auto lg:overflow-hidden p-4 sm:p-6 !max-w-none' : 'max-w-7xl'}`}
            >
              {/* Top Header: Responsive */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/5 pb-4 shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-orange rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                      <Play className="text-white w-5 h-5 sm:w-6 sm:h-6 fill-white" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-3xl font-black tracking-tighter italic text-white leading-none">ZEPLINX VR</h1>
                      <p className="text-[8px] sm:text-[10px] font-black tracking-[0.2em] text-white/30 uppercase italic">Sürükleyici Eğlence Merkezi</p>
                    </div>
                 </div>

                 <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <button 
                      onClick={() => setViewMode('kasiyer')}
                      className="px-6 py-3 bg-brand-orange/10 hover:bg-brand-orange/20 border border-brand-orange/30 rounded-2xl text-brand-orange text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-xl active:scale-95 group"
                    >
                      <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                      <span>GERİ DÖN</span>
                    </button>
                    
                    <div className="text-3xl sm:text-4xl font-mono font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(255,122,0,0.2)]">
                      {<RealTimeClock />}
                    </div>

                    <button 
                      onClick={toggleFullScreen}
                      className="p-2 sm:p-2.5 glass rounded-xl text-white/40 hover:text-white transition-all active:scale-95 border border-white/5"
                    >
                      {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                 </div>
              </div>

              {/* Layout: Flexible Grid */}
              <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-4 mt-2 min-h-0 lg:overflow-hidden pb-2">
                {/* BIG CARD (Primary Focus) */}
                <div className="lg:col-span-8 flex flex-col min-h-0 lg:overflow-hidden">
                  {(() => {
                    const featured = sessions.find(s => s.status === 'active') || sessions.find(s => !s.isFinished && s.status !== 'maintenance');
                    if (!featured) return (
                      <div className="flex-1 flex flex-col items-center justify-center bg-white/[0.02] rounded-[32px] sm:rounded-[40px] border border-white/5 gap-6 shadow-2xl">
                        <Activity size={48} className="text-white/10" />
                        <span className="text-2xl sm:text-4xl font-black text-white/20 uppercase tracking-widest italic tracking-tighter">SEANS BULUNAMADI</span>
                      </div>
                    );
                    
                    return (
                      <div className={`flex-1 flex flex-col rounded-[32px] sm:rounded-[40px] border border-white/10 p-6 sm:p-8 lg:p-12 relative overflow-hidden transition-all shadow-2xl ${
                        featured.status === 'active' 
                          ? 'bg-gradient-to-br from-cyan-900/40 via-slate-900/90 to-black border-t-4 border-t-cyan-500' 
                          : 'bg-gradient-to-br from-brand-orange/20 via-slate-900/90 to-black border-t-4 border-t-brand-orange'
                      }`}>
                        
                        {featured.status === 'active' && (
                          <div className="absolute top-0 right-4 sm:right-10 px-4 sm:px-8 py-2 sm:py-3 bg-cyan-500 text-dark-bg font-black rounded-b-xl sm:rounded-b-2xl text-xs sm:text-xl animate-pulse tracking-widest shadow-[0_10px_40px_rgba(6,182,212,0.4)] z-10">
                            ŞU AN OYNANIYOR
                          </div>
                        )}

                        <div className="flex-1 flex flex-col justify-center relative z-10">
                          {/* Giant Background Time */}
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8rem] sm:text-[15rem] lg:text-[25rem] font-mono font-black text-white/[0.02] tracking-tighter pointer-events-none select-none z-[-1]">
                            {featured.time}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6 lg:gap-8 mb-6 lg:mb-10">
                            <span className={`text-6xl sm:text-8xl lg:text-[10rem] font-mono font-black leading-none tracking-tighter drop-shadow-2xl transition-colors ${featured.status === 'active' ? 'text-cyan-400' : 'text-white'}`}>
                              {featured.time}
                            </span>
                            <div className="flex flex-col pb-1 sm:pb-4 lg:pb-8">
                               <span className="text-[10px] sm:text-sm lg:text-base font-black text-white/40 uppercase tracking-[0.4em] mb-1">DURUM</span>
                               <span className={`text-xl sm:text-3xl lg:text-4xl font-black uppercase tracking-widest leading-none drop-shadow-lg ${featured.status === 'active' ? 'text-cyan-400' : 'text-brand-orange'}`}>
                                 {featured.status === 'active' ? 'AKTİF' : 'BEKLİYOR'}
                               </span>
                            </div>
                          </div>
                          
                          <div className="space-y-3 sm:space-y-4 lg:space-y-6 max-w-[95%]">
                             <div className="flex items-center gap-4">
                                <div className="h-1 w-12 sm:w-16 bg-white/20 rounded-full" />
                                <span className="text-[10px] sm:text-xs lg:text-sm font-black text-white/40 tracking-[0.4em] uppercase italic">SIRADAKİ DENEYİM</span>
                             </div>
                             <h2 className="text-3xl sm:text-5xl lg:text-7xl font-black tracking-tighter italic uppercase text-white leading-[1.1] drop-shadow-2xl line-clamp-2">
                                {featured.status === 'maintenance' ? 'TEKNİK BAKIM' : featured.groupId ? 'GRUP REZERVASYONU' : MOVIES.find(m => m.id === featured.movieId)?.name || 'FİLM SEÇİLMEDİ'}
                             </h2>
                          </div>
                        </div>

                        {/* Capacity Info (Display Only) */}
                        <div className="mt-4 sm:mt-8 flex flex-wrap items-center gap-6 sm:gap-8 lg:gap-16 pt-4 sm:pt-8 border-t border-white/10 shrink-0">
                           <div className="flex flex-col gap-1 sm:gap-2">
                              <span className="text-[10px] sm:text-xs lg:text-sm font-black text-white/30 uppercase tracking-[0.3em]">KATILIMCI</span>
                              <div className="flex items-baseline gap-2">
                                 <span className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-none tracking-tighter">{featured.peopleCount}</span>
                                 <span className="text-sm sm:text-lg font-black text-white/20 uppercase italic tracking-widest mb-1">/ {capacity}</span>
                              </div>
                           </div>
                           
                           <div className="w-px h-10 sm:h-16 bg-white/10 hidden xs:block" />
                           
                           <div className="flex flex-col gap-1 sm:gap-2">
                              <span className="text-[10px] sm:text-xs lg:text-sm font-black text-brand-orange/60 uppercase tracking-[0.3em]">BOŞ YER</span>
                              <div className="flex items-baseline gap-2 sm:gap-3">
                                 <span className="text-3xl sm:text-5xl lg:text-6xl font-black text-brand-orange leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(255,107,0,0.3)]">{capacity - featured.peopleCount}</span>
                                 <span className="text-sm sm:text-lg font-black text-brand-orange/40 uppercase italic tracking-widest mb-1">KİŞİ</span>
                              </div>
                           </div>

                           <div className="ml-auto flex items-center gap-3">
                              <button 
                                onClick={() => setShowMovieCatalog(true)}
                                className="h-12 sm:h-16 px-4 sm:px-8 bg-white/5 border border-white/10 text-white font-black rounded-2xl text-xs sm:text-sm lg:text-base hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center gap-2 sm:gap-3 uppercase tracking-widest shadow-xl"
                              >
                                <Film size={20} className="sm:w-6 sm:h-6" />
                                <span className="hidden sm:inline">KATALOG</span>
                                <span className="sm:hidden">FİLMLER</span>
                              </button>
                           </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Upcoming List */}
                <div className="lg:col-span-4 flex flex-col min-h-[300px] lg:min-h-0 lg:overflow-hidden bg-white/[0.02] rounded-[32px] sm:rounded-[40px] border border-white/5 shadow-2xl">
                  <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-white/5 flex items-center gap-4 shrink-0 bg-white/[0.01]">
                     <Clock size={18} className="text-brand-orange" />
                     <span className="text-[10px] sm:text-sm font-black text-white/40 tracking-[0.4em] uppercase italic">SIRADAKİ SEANSLAR</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto scrollbar-hide">
                     {(() => {
                       const featured = sessions.find(s => s.status === 'active') || sessions.find(s => !s.isFinished && s.status !== 'maintenance');
                       const upcomingSessions = sessions.filter(s => !s.isFinished && s.id !== featured?.id).slice(0, 9);
                       
                       if (upcomingSessions.length === 0) {
                         return (
                           <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-4 py-8">
                             <Clock size={32} />
                             <span className="text-[10px] font-black uppercase tracking-widest">Başka seans yok</span>
                           </div>
                         );
                       }
                       
                       return (
                        <div className="flex flex-col gap-2 sm:gap-3">
                          {upcomingSessions.map((s, index) => (
                            <motion.div 
                              key={s.id}
                              initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-white/5 bg-black/40 hover:bg-white/[0.04] transition-all flex items-center justify-between group shadow-lg"
                            >
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-end gap-3">
                                   <span className="text-2xl sm:text-3xl font-mono font-black text-white tracking-tighter leading-none">{s.time}</span>
                                </div>
                                <span className="text-[10px] sm:text-sm font-bold text-white/40 truncate pr-4 uppercase tracking-wider">
                                  {s.groupId ? 'DOLU / GRUP' : MOVIES.find(m => m.id === s.movieId)?.name || 'Film Bekleniyor'}
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0 px-3 py-2 border border-white/10 rounded-xl bg-white/[0.02]">
                                 <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.1em]">BOŞ</span>
                                 <span className="text-xl sm:text-2xl font-black text-brand-orange leading-none tabular-nums tracking-tighter">{capacity - s.peopleCount}</span>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                       );
                     })()}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {viewMode === 'admin' && (
             <motion.div 
                key="admin"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className="w-full pb-12"
             >
               {false ? (
                  <div className="flex flex-col items-center justify-center py-16 md:py-32 glass rounded-[40px] border border-white/5 mx-auto max-w-sm w-full px-6 shadow-2xl">
                    <div className="w-16 h-16 bg-brand-orange/10 rounded-2xl flex items-center justify-center mb-6 border border-brand-orange/20">
                      <Settings className="text-brand-orange" size={32} />
                    </div>
                    <h2 className="text-xl font-black mb-1 tracking-tighter">GÜVENLİ GİRİŞ</h2>
                    <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-10">Yönetici PIN Kodunu Giriniz</p>
                    
                    <div className="flex gap-4 mb-10">
                      {[1, 2, 3, 4].map((_, i) => (
                        <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${pinInput.length > i ? 'bg-brand-orange border-brand-orange scale-110 shadow-[0_0_10px_rgba(255,122,0,0.5)]' : 'bg-transparent border-white/10'}`} />
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map(val => (
                        <button
                          key={val}
                          onClick={() => {
                            const checkPin = (input: string) => {
                              const envPin = import.meta.env.VITE_ADMIN_PIN || '0000';
                              if (input === envPin) {
                                setAdminAuthenticated(true);
                                addToast('Yönetici yetkisi onaylandı', 'info');
                                setPinInput('');
                                return true;
                              }
                              return false;
                            };

                            if (val === 'C') setPinInput('');
                            else if (val === 'OK') {
                              if (!checkPin(pinInput)) {
                                addToast('Geçersiz PIN Kodu!', 'warning');
                                setPinInput('');
                              }
                            }
                            else if (pinInput.length < 4) {
                              const newInput = pinInput + val;
                              setPinInput(newInput);
                              if (newInput.length === 4) {
                                // Auto-check when reaching 4 digits
                                if (!checkPin(newInput)) {
                                  // Don't toast immediately on auto-check to avoid annoying the user 
                                  // if they are still typing or made a mistake they want to clear
                                  // Actually, most systems toast or shake. Let's wait a tiny bit then toast or just wait for OK.
                                  // Better: just wait for OK or auto-submit if it's CORRECT.
                                }
                              }
                            }
                          }}
                          className={`h-14 rounded-2xl flex items-center justify-center font-bold text-lg transition-all active:scale-90 ${
                            val === 'OK' ? 'bg-brand-orange text-white' : 
                            val === 'C' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
               ) : (
                <div className="grid grid-cols-12 gap-6">
                  {/* Stats Row */}
                  <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-cyan-500/10 rounded-xl">
                          <Users className="text-cyan-400" size={20} />
                        </div>
                        <span className="text-[10px] font-black text-green-500 bg-green-500/10 px-2 py-0.5 rounded-md leading-none">+12%</span>
                      </div>
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Müşteri Trafiği</p>
                      <h4 className="text-3xl font-black tracking-tight">{stats.totalPeople} <span className="text-sm font-bold text-white/20">KİŞİ</span></h4>
                    </div>

                    <div className="glass p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-brand-orange/10 rounded-xl">
                          <Zap className="text-brand-orange" size={20} />
                        </div>
                        <span className="text-[10px] font-black text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-md leading-none">%{Math.round((stats.fullSessions / sessions.length) * 100)}</span>
                      </div>
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Verimlilik</p>
                      <h4 className="text-3xl font-black tracking-tight">{stats.fullSessions} <span className="text-sm font-bold text-white/20">DOLU SEANS</span></h4>
                    </div>

                    <div className="glass p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-brand-purple/10 rounded-xl">
                          <Activity className="text-brand-purple" size={20} />
                        </div>
                      </div>
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Kalan Kapasite</p>
                      <h4 className="text-3xl font-black tracking-tight">{(sessions.filter(s => !s.isFinished).length * capacity) - sessions.filter(s => !s.isFinished).reduce((acc, curr) => acc + curr.peopleCount, 0)} <span className="text-sm font-bold text-white/20">KİŞİ</span></h4>
                    </div>

                    <div className="glass p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-white/5 rounded-xl">
                          <Trash2 className="text-white/20" size={20} />
                        </div>
                        <button onClick={resetDay} className="text-[10px] font-black text-red-500 hover:underline">Sıfırla</button>
                      </div>
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Operasyon Durumu</p>
                      <h4 className="text-xl font-black tracking-tight text-green-500">ÇALIŞIYOR</h4>
                    </div>
                  </div>

                  {/* Left Column: Settings & Reset */}
                  <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                    <section className="glass rounded-[32px] border border-white/5 p-8 h-full bg-white/[0.01]">
                        <div className="flex items-center gap-3 mb-8">
                          <Settings className="text-brand-orange" size={20} />
                          <h3 className="text-sm font-black tracking-widest uppercase">Sistem Parametreleri</h3>
                        </div>

                        <div className="space-y-10">
                          <div className="w-full">
                            <div className="flex items-center justify-between mb-4">
                              <label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Makine Kapasitesi</label>
                              <span className="text-2xl font-black text-brand-orange">{capacity}</span>
                            </div>
                            <input 
                              type="range" min="1" max="8" value={capacity} 
                              onChange={(e) => updateGlobalSettings({ capacity: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-brand-orange"
                            />
                            <div className="flex justify-between text-[8px] font-black text-white/20 mt-2 px-1">
                               <span>1 KİŞİ</span>
                               <span>8 KİŞİ</span>
                            </div>
                          </div>

                          <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl relative overflow-hidden">
                            <div className="relative z-10">
                              <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">Tehlikeli Bölge</h4>
                              <p className="text-[10px] text-white/40 leading-relaxed mb-6">Tüm kayıtları, grupları ve seans verilerini kalıcı olarak siler.</p>
                              <button 
                                onClick={resetDay}
                                className="w-full py-3.5 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-xs font-black transition-all active:scale-95 border border-red-500/20"
                              >
                                GÜNÜ SIFIRLA
                              </button>
                            </div>
                            <Trash2 className="absolute -bottom-6 -right-6 text-red-500 opacity-5" size={80} />
                          </div>
                        </div>
                    </section>
                  </div>

                  {/* Right Column: Group Management */}
                  <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
                    <section className="glass rounded-[32px] border border-white/5 flex flex-col bg-white/[0.01] overflow-hidden min-h-[500px]">
                      <div className="p-8 border-b border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <Users className="text-brand-purple" size={20} />
                           <h3 className="text-sm font-black tracking-widest uppercase">Rezervasyon Yönetimi</h3>
                         </div>
                         <span className="text-[10px] font-black text-brand-purple bg-brand-purple/10 px-3 py-1 rounded-full">{groups.length} GRUP</span>
                      </div>
                      
                      <div className="flex-1 p-6 overflow-y-auto custom-scroll max-h-[400px]">
                        {groups.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center opacity-20 py-12">
                             <Activity size={48} className="mb-4" />
                             <p className="text-[10px] font-black uppercase tracking-[0.3em]">Bekleyen grup yok</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {groups.map(g => (
                              <div key={g.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/10 rounded-2xl hover:border-brand-purple/30 transition-all group">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center text-brand-purple font-black text-sm">
                                    {g.peopleCount}
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-black text-slate-200 group-hover:text-brand-purple transition-colors">{g.name}</h4>
                                    <div className="flex gap-1 mt-1">
                                      {g.sessionsBlocked.map(sid => (
                                        <span key={sid} className="text-[8px] font-mono font-bold text-white/30 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                          {sessions.find(s => s.id === sid)?.time}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => deleteGroup(g.id)}
                                  className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                        <h4 className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-4 ml-2">Yeni Grup Ekle</h4>
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const name = formData.get('groupName') as string;
                            const count = parseInt(formData.get('count') as string);
                            const startSid = formData.get('startSid') as string;
                            if (name && count > 0 && startSid) {
                              addGroup(name, count, startSid);
                              e.currentTarget.reset();
                            }
                          }}
                          className="grid grid-cols-1 sm:grid-cols-4 gap-3"
                        >
                          <input name="groupName" required placeholder="Grup/Kurum Adı" className="sm:col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-brand-purple/50" />
                          <input name="count" type="number" required placeholder="Kişi" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-brand-purple/50" />
                          <div className="relative">
                            <select name="startSid" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-brand-purple/50 appearance-none">
                              {sessions.filter(s => !s.isFinished && !s.groupId).map(s => (
                                <option key={s.id} value={s.id} className="bg-zinc-950 font-mono">{s.time}</option>
                              ))}
                            </select>
                            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 rotate-90 pointer-events-none" />
                          </div>
                          <button type="submit" className="sm:col-span-4 py-3.5 bg-brand-purple text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-purple/20 active:scale-95 transition-all">
                             GRUP REZERVASYONU OLUŞTUR
                          </button>
                        </form>
                      </div>
                    </section>
                  </div>
                </div>
               )}
             </motion.div>
          )}
        </AnimatePresence>
          )}
      </main>

      {/* Movie Catalog Modal (Pure Simplified & Beautifully Redesigned) */}
      <AnimatePresence>
        {showMovieCatalog && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-dark-bg/98 backdrop-blur-3xl flex flex-col p-4 sm:p-8 md:p-12 overflow-y-auto"
          >
            <div className="w-full max-w-6xl mx-auto flex flex-col min-h-full">
                  {/* Top Header: Responsive */}
                  <div className="flex justify-between items-center mb-6 sm:mb-12">
                     <div className="flex items-center gap-3 sm:gap-6">
                        <div className="w-10 h-10 sm:w-16 sm:h-16 bg-brand-orange/20 rounded-xl sm:rounded-2xl flex items-center justify-center border border-brand-orange/30 shadow-lg shadow-brand-orange/10 shrink-0">
                          <Film className="text-brand-orange w-5 h-5 sm:w-8 sm:h-8" />
                        </div>
                        <div>
                          <h2 className="text-xl sm:text-5xl font-black tracking-tighter uppercase italic text-white leading-none">VR FİLM KATALOĞU</h2>
                          <p className="text-[9px] sm:text-[11px] font-semibold text-slate-400 mt-1 sm:mt-2">Seçkin sanal gerçeklik & 3D simülasyon arşivimiz</p>
                        </div>
                     </div>
                     <button 
                       onClick={() => {
                         setShowMovieCatalog(false);
                         setSelectedMovieGenre('Hepsi');
                       }} 
                       className="w-10 h-10 sm:w-16 sm:h-16 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-full flex items-center justify-center transition-all active:scale-95 border border-white/5 shadow-lg shrink-0"
                     >
                       <X size={20} className="sm:hidden" />
                       <X size={32} className="hidden sm:block" />
                     </button>
                  </div>

                  {/* Dynamic Category Filtering Buttons */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 sm:mb-8 border-b border-white/5 scrollbar-hide shrink-0">
                    {['Hepsi', 'Keşif & Kültür', 'Doğa & Macera', 'Sıra Dışı Deneyimler'].map((genre) => (
                      <button
                        key={genre}
                        onClick={() => setSelectedMovieGenre(genre)}
                        className={`px-4 py-2 sm:px-6 sm:py-3 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border whitespace-nowrap active:scale-95 ${
                          selectedMovieGenre === genre
                            ? 'bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/10'
                            : 'bg-white/5 text-slate-400 hover:text-white border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>

                  {/* Optimized Beautiful Bento Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 flex-1">
                     {(() => {
                        const filteredMovies = MOVIES.filter(movie => {
                          if (selectedMovieGenre === 'Hepsi') return true;
                          const details = MOVIE_DETAILS[movie.id];
                          if (!details) return false;
                          if (selectedMovieGenre === 'Sıra Dışı Deneyimler') {
                            return details.genre === 'Aksiyon & Uçuş' || details.genre === 'Korku & Gerilim';
                          }
                          return details.genre === selectedMovieGenre;
                        });

                        return filteredMovies.map((movie) => {
                          const details = MOVIE_DETAILS[movie.id] || {
                            genre: 'VR Simülasyon',
                            icon: '🎬',
                            color: 'from-orange-500/20 to-amber-500/10',
                            duration: '11 Dakika',
                            intensity: 'Orta',
                            desc: 'Eşsiz sanal gerçeklik deneyimi.'
                          };

                          return (
                            <div 
                              key={movie.id}
                              className={`glass rounded-3xl p-5 sm:p-7 border border-white/5 bg-gradient-to-br ${details.color} hover:border-white/15 hover:shadow-2xl transition-all relative overflow-hidden group flex flex-col justify-between`}
                            >
                              {/* Design Background Lighting Glow */}
                              <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] blur-[40px] -z-10 group-hover:bg-white/[0.04] transition-all" />
                              
                              {/* Card Content Head */}
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  {/* Icon & Badge */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl sm:text-2xl filter drop-shadow-md select-none">{details.icon}</span>
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                                      {details.genre}
                                    </span>
                                  </div>
                                  <span className="font-mono text-xs sm:text-sm font-black text-white/20 select-none">
                                    #0{movie.id}
                                  </span>
                                </div>

                                <h3 className="text-base sm:text-2xl font-black tracking-tight text-white uppercase italic group-hover:text-brand-orange transition-colors">
                                  {movie.name}
                                </h3>

                                <p className="text-[11px] sm:text-xs text-slate-400 font-medium leading-relaxed mt-2.5 mb-6 opacity-85 group-hover:opacity-100 transition-opacity">
                                  {details.desc}
                                </p>
                              </div>

                              {/* Card Stats Bar */}
                              <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-auto">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Süre</span>
                                  <span className="text-[10px] sm:text-xs font-black text-white leading-none">{details.duration}</span>
                                </div>

                                <div className="flex flex-col items-end">
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Adrenalin</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className={`w-2 h-2 rounded-full ${details.intensity === 'Düşük' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : details.intensity === 'Orta' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                                    <span className={`text-[10px] font-black ${details.intensity === 'Düşük' ? 'text-green-400' : details.intensity === 'Orta' ? 'text-yellow-400' : 'text-red-400'}`}>
                                      {details.intensity}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                     })()}
                  </div>
               
               {/* Footer Branding */}
               <div className="mt-12 sm:mt-24 pb-8 text-center border-t border-white/5 shrink-0">
                  <span className="text-white/10 font-bold tracking-[0.5em] sm:tracking-[1em] uppercase text-[10px] sm:text-[13px]">ZEPLINX VR EXPERIENCE</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registration Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0B0D11] p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] w-full max-w-xl shadow-2xl relative border border-white/5 overflow-y-auto max-h-[90vh]"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/5 blur-[100px] -z-10" />
              
              <button 
                onClick={() => setShowBookingModal(null)}
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-95 group"
              >
                <X size={20} className="text-white/30 group-hover:text-white" />
              </button>

              <div className="mb-8 flex items-start justify-between">
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                   <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase italic text-white leading-none">Kayit</h2>
                   <span className="text-brand-orange font-black text-sm sm:text-xl uppercase tracking-tighter mb-0.5">{sessions.find(s => s.id === showBookingModal.sessionId)?.time} SEANSI</span>
                </div>
                
                {/* SMALL PERSON COUNT HERE */}
                <div className="flex flex-col gap-1 items-end mt-1">
                   <span className="text-[10px] uppercase font-black text-white/30 tracking-[0.2em] mr-1">KAÇ KİŞİ?</span>
                   <div className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/10 p-1">
                       <button type="button" onClick={() => setShowBookingModal(prev => prev ? { ...prev, count: Math.max(1, prev.count - 1) } : prev)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-lg font-black hover:bg-white/10 active:scale-95 transition-all">-</button>
                       <input name="count" value={showBookingModal.count} type="number" className="bg-transparent text-lg font-black text-center w-6 outline-none appearance-none" readOnly />
                       <button type="button" onClick={() => setShowBookingModal(prev => prev ? { ...prev, count: Math.min(capacity - (sessions.find(s => s.id === prev.sessionId)?.peopleCount || 0), prev.count + 1) } : prev)} className="w-8 h-8 rounded-lg bg-brand-orange/20 text-brand-orange flex items-center justify-center text-lg font-black hover:bg-brand-orange/30 active:scale-95 transition-all">+</button>
                   </div>
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (isSubmittingBooking) return;
                setIsSubmittingBooking(true);
                try {
                  const formData = new FormData(e.currentTarget);
                  const cname = formData.get('customerName') as string;
                  const rawPhone = formData.get('phone') as string;
                  const { normalizePhoneNumber } = await import('./utils/helpers');
                  const phone = normalizePhoneNumber(rawPhone);
                  
                  if (!phone) {
                    addToast("Geçersiz telefon numarası!", "warning");
                    setIsSubmittingBooking(false);
                    return;
                  }
                  
                  const movieId = formData.get('movieId') as string;
                  const count = showBookingModal.count;
                  const sessionId = showBookingModal.sessionId;
                  
                  if (cname && phone && count > 0 && movieId) {
                    setShowBookingModal(null);
                    await registerCustomer(sessionId, cname, phone, count, movieId);
                  }
                } finally {
                  setIsSubmittingBooking(false);
                }
              }} className="space-y-5">
                <div className="grid grid-cols-1 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-white/30 tracking-[0.2em] ml-2">FİLM SEÇİMİ</label>
                    <div className="relative">
                      <Film className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                      {(() => {
                        const s = sessions.find(s => s.id === showBookingModal.sessionId);
                        return (
                          <>
                             <select name="movieId" required defaultValue={s?.movieId || ''} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 sm:py-5 pl-12 sm:pl-14 pr-6 font-bold text-base sm:text-lg outline-none focus:border-brand-orange/50 transition-all text-white appearance-none cursor-pointer">
                               <option value="" disabled className="bg-[#0B0D11] text-white/50">Film Seçiniz</option>
                               {MOVIES.map(movie => (
                                 <option key={movie.id} value={movie.id} className="bg-[#0B0D11]">{movie.name}</option>
                               ))}
                             </select>
                             <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 rotate-90 pointer-events-none" size={20} />
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-white/30 tracking-[0.2em] ml-2">MÜŞTERİ ADI SOYADI</label>
                    <div className="relative">
                      <UserCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                      <input name="customerName" required type="text" placeholder="Ad Soyad yazınız..." className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 sm:py-5 pl-12 sm:pl-14 pr-6 font-bold text-base sm:text-lg outline-none focus:border-brand-orange/50 transition-all placeholder:text-white/10 text-white" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black text-white/30 tracking-[0.2em] ml-2">İLETİŞİM TELEFONU</label>
                    <div className="relative">
                      <MessageCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                      <input name="phone" required type="text" defaultValue="05" placeholder="05xx ..." className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 sm:py-5 pl-12 sm:pl-14 pr-6 font-bold text-base sm:text-lg outline-none focus:border-brand-orange/50 transition-all placeholder:text-white/10 text-white" />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isSubmittingBooking} className="w-full py-6 bg-brand-orange hover:bg-orange-600 rounded-[32px] font-black text-xl uppercase tracking-widest text-white shadow-2xl shadow-brand-orange/20 transition-all active:scale-[0.98] mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmittingBooking ? 'KAYDEDİLİYOR...' : 'KAYDI TAMAMLA'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Attendee List Modal */}
      <AnimatePresence>
        {showAttendees && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-[#121418] p-6 sm:p-10 rounded-3xl sm:rounded-[40px] w-full max-w-2xl border border-white/5 shadow-2xl relative"
             >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-orange/40 to-transparent" />
                
                <button 
                  onClick={() => setShowAttendees(null)}
                  className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all group"
                >
                  <X size={20} className="text-white/30 group-hover:text-white" />
                </button>

                <div className="mb-8">
                  <div className="flex items-center gap-4 mb-2">
                     <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-brand-orange/10 flex items-center justify-center">
                        <Users className="text-brand-orange" size={20} />
                     </div>
                     <div>
                        <h2 className="text-2xl sm:text-4xl font-black tracking-tighter uppercase italic text-white leading-none">Müşteriler</h2>
                        <span className="text-[10px] sm:text-xs font-bold text-white/30 tracking-[0.2em] uppercase">
                          {sessions.find(s => s.id === showAttendees)?.time} SEANSI LİSTESİ
                        </span>
                     </div>
                  </div>
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scroll pr-2 mb-6">
                  {sessions.find(s => s.id === showAttendees)?.bookings?.map((b) => (
                    <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-white/[0.03] rounded-2xl sm:rounded-3xl border border-white/5 group hover:border-brand-orange/30 transition-all gap-4">
                       <div className="flex flex-col gap-1">
                          <span className="text-base sm:text-lg font-black text-white uppercase tracking-tighter">{b.customerName}</span>
                          <div className="flex flex-col gap-2 mt-1">
                             {b.movieId && (
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-cyan-400 bg-cyan-400/10 w-fit px-2 py-0.5 rounded-md uppercase tracking-widest">
                                   <Film size={10} />
                                   {MOVIES.find(m => m.id === b.movieId)?.name || 'FİLM'}
                                </div>
                             )}
                             <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-white/30">
                                   <MessageCircle size={12} />
                                   <span>{b.phone}</span>
                                </div>
                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                <span className="text-[10px] sm:text-xs font-black text-brand-orange uppercase">{b.count} KİŞİ</span>
                             </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-2 self-end sm:self-auto">
                          <a 
                            href={`https://wa.me/${b.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`${b.customerName} selamlar, Zeplinx VR seansınız (${sessions.find(s => s.id === showAttendees)?.time}) için randevunuz oluşturulmuştur.`)}`}
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 sm:p-3 bg-green-500/10 text-green-500 rounded-xl sm:rounded-2xl hover:bg-green-500 hover:text-white transition-all shadow-lg"
                          >
                             <MessageCircle className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" />
                          </a>
                          <button 
                            onClick={() => {
                              removeBooking(showAttendees, b.id);
                              if ((sessions.find(s => s.id === showAttendees)?.bookings?.length || 0) <= 1) setShowAttendees(null);
                            }}
                            className="p-2 sm:p-3 bg-red-500/10 text-red-500 rounded-xl sm:rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                          >
                             <Trash2 className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" />
                          </button>
                       </div>
                    </div>
                  )) || (
                    <div className="py-10 text-center opacity-20">
                       <Users size={32} className="mx-auto mb-2" />
                       <p className="font-black uppercase tracking-[0.2em] text-xs">Kayıt Bulunamadı</p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setShowAttendees(null)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] transition-all"
                >
                  KAPAT
                </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 p-6 md:p-8 rounded-3xl max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4">Onay Bekleniyor</h3>
              <p className="text-sm font-medium text-white/70 mb-8">{confirmAction.message}</p>
              
              <div className="flex items-center justify-end gap-3">
                <button 
                  onClick={() => setConfirmAction(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-all"
                >
                  İPTAL
                </button>
                <button 
                  onClick={() => {
                    confirmAction.onConfirm();
                    setConfirmAction(null);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-sm transition-all shadow-lg shadow-red-500/20"
                >
                  ONAYLA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scroll {
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
          overscroll-behavior-y: contain;
        }
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
    </div>
  );
}
