import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Clock, Calendar, Phone, FileText, Check, Trash2, Play, CheckCircle2, 
  Activity, X, Plus, AlertCircle, LayoutDashboard, List, PlusCircle, ArrowRight, User
} from 'lucide-react';

export interface LTBooking {
  id: string;
  customerName: string;
  phone: string;
  date: string;
  duration: number;
  note: string;
  sessionTime: string;
  players: string[];
  status: 'bekliyor' | 'oyunda' | 'tamamlandi';
  createdAt: number;
}

const HOURS = [
  "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", 
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
];

const CAPACITY = 16;

export default function LaserTagView({ addToast }: any) {
  const [activeTab, setActiveTab] = useState<'yeni' | 'liste' | 'durum'>('yeni');
  const [bookings, setBookings] = useState<LTBooking[]>([]);

  // Firebase bağlantısı (Kalıcı veritabanı)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'lasertag_bookings_v2'), snap => {
      const data = snap.docs.map(d => d.data() as LTBooking);
      setBookings(data);
    });
    return () => unsub();
  }, []);

  const getOccupancy = (date: string, time: string) => {
    // Sadece aktif olan rezervasyonları say (tamamlanmamış ve bu saate ait)
    const timeBookings = bookings.filter(b => b.date === date && b.sessionTime === time && b.status !== 'tamamlandi');
    return timeBookings.reduce((sum, b) => sum + b.players.length, 0);
  };

  return (
    <div className="flex flex-col gap-6 w-full text-white">
      {/* Üst Sekmeler */}
      <div className="flex flex-col sm:flex-row items-center gap-2 p-2 bg-white/[0.02] rounded-[24px] border border-white/5 shadow-lg shrink-0">
        <TabButton 
          active={activeTab === 'yeni'} 
          onClick={() => setActiveTab('yeni')} 
          icon={<PlusCircle size={18} />} 
          label="Yeni Rezervasyon" 
        />
        <TabButton 
          active={activeTab === 'liste'} 
          onClick={() => setActiveTab('liste')} 
          icon={<List size={18} />} 
          label="Rezervasyonlar" 
        />
        <TabButton 
          active={activeTab === 'durum'} 
          onClick={() => setActiveTab('durum')} 
          icon={<LayoutDashboard size={18} />} 
          label="Arena Durumu" 
        />
      </div>

      {/* Ana İçerik */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'yeni' && (
            <motion.div key="yeni" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <TabYeniRezervasyon bookings={bookings} addToast={addToast} getOccupancy={getOccupancy} setActiveTab={setActiveTab} />
            </motion.div>
          )}
          {activeTab === 'liste' && (
            <motion.div key="liste" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <TabRezervasyonlar bookings={bookings} addToast={addToast} />
            </motion.div>
          )}
          {activeTab === 'durum' && (
            <motion.div key="durum" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <TabArenaDurumu bookings={bookings} getOccupancy={getOccupancy} addToast={addToast} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2.5 px-6 py-3.5 rounded-[18px] font-bold text-sm transition-all flex-1 w-full justify-center ${
        active 
          ? 'bg-purple-600 border border-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.3)] text-white' 
          : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
      }`}
    >
      {icon}
      <span>{label}</span>
      {active && <ArrowRight size={14} className="ml-auto opacity-50 hidden sm:block" />}
    </button>
  );
}

// ----------------------------------------------------------------------------
// YENİ REZERVASYON SEKMESİ
// ----------------------------------------------------------------------------
function TabYeniRezervasyon({ bookings, addToast, getOccupancy, setActiveTab }: any) {
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    date: today,
    duration: 30, // 20 | 30 | 45 | 60
    note: '',
    sessionTime: ''
  });
  const [players, setPlayers] = useState<string[]>(['', '']); // Varsayılan 2 boş satır
  const [successBanner, setSuccessBanner] = useState(false);

  const addPlayer = () => {
    if(players.length < CAPACITY) {
      setPlayers([...players, '']);
    }
  };

  const removePlayer = (idx: number) => {
    if(players.length > 2) {
      setPlayers(players.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = async () => {
    if (!formData.customerName || !formData.phone || !formData.date || !formData.sessionTime) {
      addToast("Ad, Telefon, Tarih ve Seans saati zorunludur.", "warning");
      return;
    }
    const filledPlayers = players.filter(p => p.trim() !== '');
    if (filledPlayers.length === 0) {
      addToast("En az 1 oyuncu adı girmelisiniz.", "warning");
      return;
    }

    const currentOcc = getOccupancy(formData.date, formData.sessionTime);
    if (currentOcc + filledPlayers.length > CAPACITY) {
      addToast(`Seçilen seansta kapasite aşıldı! Kalan yer: ${CAPACITY - currentOcc}. Lütfen oyuncu sayısını azaltın veya başka seans seçin.`, "warning");
      return;
    }

    const newBooking: LTBooking = {
      id: crypto.randomUUID(),
      ...formData,
      players: filledPlayers,
      status: 'bekliyor',
      createdAt: Date.now()
    };

    try {
      await setDoc(doc(db, 'lasertag_bookings_v2', newBooking.id), newBooking);
      
      // Başarı Banner'ı
      setSuccessBanner(true);
      setTimeout(() => setSuccessBanner(false), 4000);
      
      // Formu temizle
      setFormData({ ...formData, customerName: '', phone: '', note: '', sessionTime: '' });
      setPlayers(['', '']);
    } catch(e:any) {
      addToast("Kayıt hatası: " + e.message, "warning");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
      {/* Yeşil Onay Banner'ı (Tam istenilen 4 saniye) */}
      <AnimatePresence>
        {successBanner && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black shadow-[0_10px_40px_rgba(16,185,129,0.4)] flex items-center gap-3 w-full max-w-sm"
          >
            <div className="bg-white/20 p-1 rounded-full"><CheckCircle2 size={24} /></div>
            <span>Rezervasyon Kaydedildi!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sol Sütun: Temel Bilgiler ve Saat Seçimi */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <div className="bg-[#12151C] p-6 rounded-[32px] border border-white/5 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="text-purple-400" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Grup & İletişim</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-400 pl-1">Müşteri / Grup Adı *</span>
              <input type="text" placeholder="Grup Adı" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 transition-colors" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-400 pl-1">Telefon *</span>
              <input type="text" placeholder="05XX..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 transition-colors" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-400 pl-1">Tarih Seçimi *</span>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value, sessionTime: ''})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 transition-colors" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-400 pl-1">Oyun Süresi</span>
              <select value={formData.duration} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} className="bg-[#1a1f2b] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 transition-colors">
                <option value={20}>20 Dakika (Hızlı)</option>
                <option value={30}>30 Dakika (Standart)</option>
                <option value={45}>45 Dakika (Uzatılmış)</option>
                <option value={60}>60 Dakika (Turnuva)</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 mt-2">
            <span className="text-xs font-bold text-slate-400 pl-1">İsteğe Bağlı Not (Doğum günü vs.)</span>
            <input type="text" placeholder="Örn: 10. yaş doğum günü sürprizi..." value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 transition-colors" />
          </label>
        </div>

        {/* Seans Saatleri (Seçilen tarihe göre) */}
        <div className="bg-[#12151C] p-6 rounded-[32px] border border-white/5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="text-purple-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Seans Seçimi</h2>
            </div>
            <span className="text-[10px] font-bold text-slate-500 px-3 py-1 bg-white/5 rounded-full">{formData.date}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {HOURS.map(hour => {
              const occ = getOccupancy(formData.date, hour);
              const isFull = occ >= CAPACITY;
              const isSelected = formData.sessionTime === hour;
              
              let boxClass = 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'; // Default Empty
              let indClass = 'bg-emerald-500 font-black'; // Green indicator

              if (isFull) {
                boxClass = 'bg-red-500/5 border-red-500/10 text-slate-500 opacity-60 cursor-not-allowed';
                indClass = 'bg-red-500'; // Red
              } else if (occ >= 8) {
                indClass = 'bg-yellow-500'; // Yellow
              }

              return (
                <button
                  key={hour}
                  disabled={isFull}
                  onClick={() => setFormData({...formData, sessionTime: hour})}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${boxClass} ${
                    isSelected ? '!bg-purple-600/10 !border-purple-500 ring-2 ring-purple-500/50 text-white' : ''
                  }`}
                >
                  <span className="text-xl font-black font-mono tracking-tighter mb-1">{hour}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${indClass}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                      {isFull ? 'DOLU' : `${occ}/${CAPACITY} DOLU`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sağ Sütun: Oyuncular */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-[#12151C] p-6 rounded-[32px] border border-white/5 flex flex-col h-full max-h-[800px]">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <User className="text-purple-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Oyuncular</h2>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-white/5 px-2 py-1 rounded-md">{players.length}/{CAPACITY}</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll space-y-2 pr-2">
            {players.map((p, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 focus-within:text-purple-400 text-slate-500 transition-colors">
                <span className="text-[10px] font-bold uppercase tracking-widest pl-1">Oyuncu {idx + 1}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ad"
                    value={p}
                    onChange={e => updatePlayer(idx, e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 text-white transition-colors text-sm font-semibold"
                  />
                  {players.length > 2 && (
                    <button onClick={() => removePlayer(idx)} className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-colors">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 pt-4 flex flex-col gap-3 border-t border-white/5 mt-4">
            <button 
              onClick={addPlayer} 
              disabled={players.length >= CAPACITY}
              className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-xl text-slate-300 font-bold transition-all disabled:opacity-30"
            >
              <Plus size={18} />
              <span>Oyuncu Ekle</span>
            </button>
            <button 
              onClick={handleSubmit}
              className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest transition-all"
            >
              Rezervasyon Oluştur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// REZERVASYONLAR SEKMESİ
// ----------------------------------------------------------------------------
function TabRezervasyonlar({ bookings, addToast }: any) {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<'all'|'bekliyor'|'oyunda'|'tamamlandi'>('all');

  const filtered = bookings.filter(b => {
    if (b.date !== filterDate) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    return true;
  }).sort((a,b) => a.sessionTime.localeCompare(b.sessionTime));

  const updateStatus = async (id: string, s: 'bekliyor'|'oyunda'|'tamamlandi') => {
    try {
      await updateDoc(doc(db, 'lasertag_bookings_v2', id), { status: s });
      addToast(`Durum güncellendi: ${s.toUpperCase()}`, 'info');
    } catch(e:any) {
      addToast("Hata: " + e.message, "warning");
    }
  };

  const deleteBooking = async (id: string) => {
    if(window.confirm("Bu rezervasyonu sistemden tamamen silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, 'lasertag_bookings_v2', id));
        addToast("Rezervasyon başarıyla silindi.", "info");
      } catch(e:any) {
        addToast("Hata: " + e.message, "warning");
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-4 bg-[#12151C] p-4 rounded-2xl border border-white/5">
        <label className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl">
          <Calendar size={18} className="text-slate-400" />
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)} 
            className="bg-transparent text-white font-bold outline-none"
          />
        </label>
        
        <div className="flex gap-1 overflow-x-auto">
          {[{v:'all', l:'Tüm Durumlar'}, {v:'bekliyor', l:'Bekleyenler'}, {v:'oyunda', l:'Oyunda Olanlar'}, {v:'tamamlandi', l:'Tamamlananlar'}].map(f => (
            <button 
              key={f.v} 
              onClick={() => setFilterStatus(f.v as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                filterStatus === f.v ? 'bg-purple-600 border border-purple-500 shadow-md text-white' : 'bg-white/5 border border-transparent text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-white/5 border-dashed rounded-3xl text-slate-500 flex flex-col items-center">
            <LayoutDashboard size={48} className="mb-4 opacity-50" />
            <h3 className="text-lg font-black uppercase tracking-widest">BULUNAMADI</h3>
            <p className="text-sm mt-2">Bu filtreler için rezervasyon kaydı bulunamadı.</p>
          </div>
        ) : (
          filtered.map(b => {
             // Rozet Stili
             let badgeCls = "bg-purple-500/20 text-purple-400 border-purple-500/30";
             let badgeTxt = "BEKLİYOR";
             if (b.status === 'oyunda') {
                badgeCls = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                badgeTxt = "OYUNDA";
             } else if (b.status === 'tamamlandi') {
                badgeCls = "bg-slate-500/20 text-slate-400 border-slate-500/30";
                badgeTxt = "TAMAMLANDI";
             }

             return (
               <div key={b.id} className="bg-[#12151C] border border-white/5 rounded-3xl overflow-hidden flex flex-col">
                 {/* Kart Başlığı */}
                 <div className="p-5 border-b border-white/5 flex justify-between items-start bg-white/[0.01]">
                   <div>
                     <h3 className="text-xl font-black text-white truncate max-w-[200px]">{b.customerName}</h3>
                     <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                       <Phone size={12} /> {b.phone}
                     </p>
                   </div>
                   <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${badgeCls}`}>
                     {badgeTxt}
                   </span>
                 </div>

                 {/* Gövde */}
                 <div className="p-5 space-y-4 flex-1">
                   <div className="flex items-center gap-4 text-sm font-mono text-slate-300">
                     <div className="flex items-center gap-2">
                       <Clock size={16} className="text-purple-400" />
                       <span className="font-extrabold text-lg tracking-tighter">{b.sessionTime}</span>
                     </div>
                     <span className="text-xs bg-white/5 px-2 py-1 rounded-md">{b.duration} DK</span>
                   </div>

                   <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                     <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Oyuncular ({b.players.length})</span>
                     </div>
                     <div className="flex flex-wrap gap-1.5">
                       {b.players.slice(0, 5).map((p, i) => (
                         <span key={i} className="text-[10px] bg-white/5 text-slate-300 px-2 py-1 rounded-md font-bold">{p}</span>
                       ))}
                       {b.players.length > 5 && (
                         <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-md font-bold">+{b.players.length - 5} Diğer</span>
                       )}
                     </div>
                   </div>

                   {b.note && (
                     <div className="text-xs text-slate-400 bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl italic">
                       "{b.note}"
                     </div>
                   )}
                 </div>

                 {/* İşlem Butonları */}
                 <div className="p-3 border-t border-white/5 bg-black/20 flex items-center gap-2">
                   {b.status === 'bekliyor' && (
                     <button onClick={() => updateStatus(b.id, 'oyunda')} className="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-500 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                       Oyunu Başlat
                     </button>
                   )}
                   {b.status === 'oyunda' && (
                     <button onClick={() => updateStatus(b.id, 'tamamlandi')} className="flex-1 py-3 bg-slate-500/20 hover:bg-slate-500 hover:text-white text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest transition-all gap-2 flex items-center justify-center">
                       <Check size={16} /> Tamamla
                     </button>
                   )}
                   <button onClick={() => deleteBooking(b.id)} className="p-3 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all" title="Veriyi Sil">
                     <Trash2 size={18} />
                   </button>
                 </div>
               </div>
             );
          })
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// ARENA DURUMU SEKMESİ
// ----------------------------------------------------------------------------
function TabArenaDurumu({ bookings, getOccupancy, addToast }: any) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const todaysBookings = bookings.filter((b: LTBooking) => b.date === date);
  const activeGames = todaysBookings.filter((b: LTBooking) => b.status === 'oyunda').length;
  const completedGames = todaysBookings.filter((b: LTBooking) => b.status === 'tamamlandi').length;
  const totalPlayers = todaysBookings.reduce((sum: number, b: LTBooking) => sum + b.players.length, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Tarih Seçimi Header */}
      <div className="flex items-center justify-between p-6 bg-[#12151C] rounded-[32px] border border-white/5">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest">Arena Tablosu</h2>
          <p className="text-xs text-slate-400 mt-1">Saatlik doluluk oranları ve sistem özeti.</p>
        </div>
        <input 
          type="date" 
          value={date} 
          onChange={e => setDate(e.target.value)} 
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 transition-colors text-white font-bold"
        />
      </div>

      {/* 4 Özet Kartı */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col items-center text-center justify-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">T. Rezervasyon</span>
          <span className="text-4xl font-black text-white">{todaysBookings.length}</span>
        </div>
        <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl flex flex-col items-center text-center justify-center">
          <span className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest mb-2">Aktif Oyun</span>
          <span className="text-4xl font-black text-emerald-400 leading-none">{activeGames}</span>
        </div>
        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col items-center text-center justify-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tamamlanan</span>
          <span className="text-4xl font-black text-slate-300 leading-none">{completedGames}</span>
        </div>
        <div className="p-6 bg-purple-500/5 border border-purple-500/20 rounded-3xl flex flex-col items-center text-center justify-center">
          <span className="text-[10px] font-bold text-purple-400/70 uppercase tracking-widest mb-2">Günlük Oyuncu</span>
          <span className="text-4xl font-black text-purple-400 leading-none">{totalPlayers}</span>
        </div>
      </div>

      {/* Saatlik Doluluk Tablosu */}
      <div className="bg-[#12151C] p-6 rounded-[32px] border border-white/5">
        <h3 className="text-xs font-black tracking-[0.2em] text-white/40 uppercase mb-6 flex items-center gap-2">
          <Clock size={16} /> Günlük Doluluk (Kapasite: 16)
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {HOURS.map(hour => {
            const occ = getOccupancy(date, hour);
            let bgColor = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"; // Yeşil: 0VeyaAz
            let indColor = "bg-emerald-400";
            
            if (occ >= CAPACITY) {
              bgColor = "bg-red-500/10 border-red-500/30 text-red-500"; // Kırmızı: Tamamen Dolu
              indColor = "bg-red-500";
            } else if (occ >= 8) {
              bgColor = "bg-yellow-500/10 border-yellow-500/40 text-yellow-500"; // Sarı: %50-%80 arası
              indColor = "bg-yellow-400";
            }

            return (
              <div key={hour} className={`flex flex-col items-center justify-center p-4 rounded-2xl border ${bgColor}`}>
                <span className="text-lg font-black font-mono tracking-tighter mb-2 text-white">{hour}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${indColor} shadow-[0_0_8px_currentColor]`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-black/40 rounded-md">
                    {occ}/{CAPACITY}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
