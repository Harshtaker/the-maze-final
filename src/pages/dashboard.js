import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { usePlayerStore } from '../lib/store';

export default function Dashboard() {
  // --- Zustand (persisted) state ---
  const team = usePlayerStore((s) => s.team);
  const revealedClue = usePlayerStore((s) => s.revealedClue);
  const isEliminated = usePlayerStore((s) => s.isEliminated);
  const isFinished = usePlayerStore((s) => s.isFinished);
  const setRevealedClue = usePlayerStore((s) => s.setRevealedClue);
  const setEliminated = usePlayerStore((s) => s.setEliminated);
  const advanceRound = usePlayerStore((s) => s.advanceRound);
  const syncFromDB = usePlayerStore((s) => s.syncFromDB);
  const logout = usePlayerStore((s) => s.logout);

  // --- Local UI state (not persisted) ---
  const [timeLeft, setTimeLeft] = useState(2400);
  const [isScanning, setIsScanning] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const router = useRouter();
  const scannerRef = useRef(null);
  const teamRef = useRef(null);
  const revealedClueRef = useRef(null);
  const isProcessingRef = useRef(false);

  // Keep refs in sync with Zustand state
  useEffect(() => { teamRef.current = team; }, [team]);
  useEffect(() => { revealedClueRef.current = revealedClue; }, [revealedClue]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // =========================
  // 1. HYDRATION + RECOVERY
  // =========================
  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage
    const unsub = usePlayerStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    // If already hydrated (hot reload / fast refresh)
    if (usePlayerStore.persist.hasHydrated()) {
      setHydrated(true);
    }

    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const currentTeam = usePlayerStore.getState().team;
    if (!currentTeam) {
      router.push('/');
      return;
    }

    // Background sync with DB (non-blocking)
    // This also pushes local-ahead state to DB if needed
    syncFromDB();
  }, [hydrated, router, syncFromDB]);

  // =========================
  // 2. LOGOUT
  // =========================
  const handleLogout = () => {
    if (confirm('Logout?')) {
      logout();
      router.push('/');
    }
  };

  // Full logout (clears all data)
  const handleFullLogout = () => {
    if (confirm('WARNING: This will clear ALL saved progress from this device. Continue?')) {
      logout();
      router.push('/');
    }
  };

  // =========================
  // 3. SCAN LOGIC
  // =========================
  const onScanSuccess = useCallback(async (decodedText) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    if (scannerRef.current) {
      try { await scannerRef.current.pause(true); } catch (_) {}
    }

    const code = decodedText.trim().toUpperCase();
    const currentTeam = teamRef.current;
    const targetRound = !revealedClueRef.current ? 1 : currentTeam.current_sector + 1;

    try {
      // DB Check for QR Validity
      const { data: clueData } = await supabase
        .from('clue_settings')
        .select('*')
        .eq('chamber_number', targetRound)
        .eq('qr_secret_key', code)
        .maybeSingle();

      if (!clueData) {
        setMsg({ type: 'error', text: 'WRONG LOCATION' });
        setTimeout(() => {
          setMsg({ type: '', text: '' });
          setIsProcessing(false);
          isProcessingRef.current = false;
          if (scannerRef.current) scannerRef.current.resume();
        }, 1200);
        return;
      }

      const isFinal = targetRound === 5;

      // advanceRound() does ALL of these atomically:
      // 1. Updates Zustand (auto-persisted to localStorage)
      // 2. Direct UPDATE to teams table in Supabase
      // 3. Broadcasts scan event to admin
      // 4. Calls RPC if it exists (belt + suspenders)
      await advanceRound(targetRound, clueData);

      // Reset timer for new round
      if (!isFinal) {
        setTimeLeft(2400);
      }

      setMsg({ type: 'success', text: isFinal ? 'VICTORY' : 'LEVEL UNLOCKED' });

      setTimeout(() => {
        setIsScanning(false);
        setIsProcessing(false);
        isProcessingRef.current = false;
        setMsg({ type: '', text: '' });
      }, 500);

      if (window.navigator.vibrate) window.navigator.vibrate(100);
    } catch (e) {
      console.error('Scan error:', e);
      setIsProcessing(false);
      isProcessingRef.current = false;
      if (scannerRef.current) {
        try { await scannerRef.current.resume(); } catch (_) {}
      }
    }
  }, [advanceRound]);

  // =========================
  // 4. TIMER LOGIC
  // =========================
  useEffect(() => {
    if (!revealedClue || !team?.last_clue_start || isEliminated || isFinished) return;
    
    // Calculate initial time remaining
    const start = new Date(team.last_clue_start).getTime();
    const initialElapsed = Math.floor((Date.now() - start) / 1000);
    const initialRemaining = 2400 - initialElapsed;
    
    if (initialRemaining <= 0) {
      setEliminated();
      return;
    }
    
    setTimeLeft(initialRemaining);
    
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = 2400 - elapsed;
      if (remaining <= 0) {
        setEliminated();
        clearInterval(timer);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [team?.last_clue_start, revealedClue, isEliminated, isFinished, setEliminated]);

  // =========================
  // 5. CAMERA START LOGIC
  // =========================
  useEffect(() => {
    if (isScanning && !isEliminated && !isFinished) {
      const start = async () => {
        try {
          scannerRef.current = new Html5Qrcode('reader');
          await scannerRef.current.start(
            { facingMode: 'environment' },
            { fps: 20, qrbox: { width: 250, height: 250 } },
            onScanSuccess
          );
        } catch (_) {
          setIsScanning(false);
        }
      };
      start();
    }
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isScanning, onScanSuccess, isEliminated, isFinished]);

  // =========================
  // 6. HELPERS
  // =========================
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sc = s % 60;
    return `${m}:${sc < 10 ? '0' : ''}${sc}`;
  };

  // --- RENDER ---

  // Wait for hydration before rendering anything
  if (!hydrated || !team) return null;

  if (isFinished)
    return (
      <div className="h-screen bg-[#050505] flex items-center justify-center text-white text-5xl f-h gold-glow text-center p-4">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap');
          .f-h { font-family: 'Cinzel', serif; }
          .gold-glow { text-shadow: 0 0 15px rgba(212, 175, 55, 0.5); }
        `}</style>
        MISSION COMPLETE
      </div>
    );

  if (isEliminated)
    return (
      <div className="h-screen bg-red-950 flex items-center justify-center text-white text-5xl f-h text-center p-4">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap');
          .f-h { font-family: 'Cinzel', serif; }
        `}</style>
        ELIMINATED
      </div>
    );

  return (
    <div className="min-h-screen bg-[#050505] text-[#f4e4bc] flex flex-col items-center p-6 relative overflow-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Space+Mono:wght@400;700&display=swap');
        .f-h { font-family: 'Cinzel', serif; }
        .f-b { font-family: 'Space Mono', monospace; }
        .glass { background: rgba(0, 0, 0, 0.85); border: 1px solid rgba(212, 175, 55, 0.2); backdrop-filter: blur(10px); }
        .gold-glow { text-shadow: 0 0 15px rgba(212, 175, 55, 0.5); }
      `}</style>

      <div className="fixed inset-0 z-0 opacity-20 bg-[url('/cave.webp')] bg-cover bg-center pointer-events-none" />

      <header className="w-full max-w-lg z-10 mb-8 pt-4 flex justify-between items-start">
        <div>
          <h2 className="f-h text-2xl text-white uppercase gold-glow tracking-tighter">{team.team_name}</h2>
          <p className="f-b text-[10px] text-[#d4af37] tracking-widest uppercase mt-1 opacity-70">
            {revealedClue ? `Round 0${team.current_sector} Active` : 'Ready to Start'}
          </p>
        </div>
        <button onClick={handleLogout} className="f-b text-[10px] text-white/30 border border-white/10 px-3 py-1 uppercase hover:bg-white/10 transition-all">
          Logout
        </button>
      </header>

      {/* TRACKER */}
      <div className="w-full max-w-sm flex justify-between mb-10 z-10 px-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center f-h transition-all duration-700 ${
              team.current_sector >= n && revealedClue
                ? 'bg-[#d4af37] border-[#d4af37] text-black shadow-[0_0_15px_#d4af37]'
                : 'border-white/10 text-white/20'
            }`}
          >
            {n}
          </div>
        ))}
      </div>

      <div
        className={`p-10 rounded-sm w-full max-w-xs text-center border-2 z-10 glass ${
          !revealedClue ? 'opacity-40 border-white/10' : 'border-[#d4af37]'
        }`}
      >
        <p className="f-b text-[10px] opacity-60 mb-2 uppercase">Chamber Clock</p>
        <span
          className={`text-6xl f-h tabular-nums ${
            timeLeft < 300 && revealedClue ? 'text-red-500 animate-pulse' : 'text-white'
          }`}
        >
          {formatTime(timeLeft)}
        </span>
      </div>

      <main className="w-full max-w-md mt-10 flex-grow z-10">
        <div className="glass rounded-sm p-8 min-h-[250px] flex flex-col items-center justify-center text-center border-t-2 border-t-[#d4af37]">
          <AnimatePresence mode="wait">
            {revealedClue ? (
              <motion.div key="clue" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="text-[#d4af37] text-[10px] f-b uppercase tracking-widest opacity-40">Ancient Scroll</span>
                <p className="f-h text-2xl md:text-3xl text-white mt-4 italic leading-relaxed">"{revealedClue}"</p>
              </motion.div>
            ) : (
              <div className="space-y-4 opacity-20">
                <div className="w-16 h-16 border border-white rounded-full flex items-center justify-center mx-auto text-2xl f-h">?</div>
                <p className="f-h text-white uppercase text-sm">Scan Round 01 to Start</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <button
        onClick={() => setIsScanning(true)}
        className="fixed bottom-10 w-full max-w-sm py-5 bg-[#d4af37] text-black f-h text-xl shadow-[0_0_40px_rgba(212,175,55,0.3)] z-20 uppercase font-black tracking-widest transition-transform"
      >
        Initiate Scan
      </button>

      {/* SCANNER OVERLAY */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-8 backdrop-blur-xl"
          >
            <div className="w-full max-w-sm aspect-square relative rounded-sm overflow-hidden border-2 border-[#d4af37]/30 bg-black">
              <div id="reader" className="w-full h-full scale-110"></div>
              <AnimatePresence>
                {msg.text && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`absolute inset-0 flex items-center justify-center z-[110] backdrop-blur-md ${
                      msg.type === 'error' ? 'bg-red-600/80' : 'bg-[#d4af37]/90'
                    }`}
                  >
                    <p className="f-h text-3xl text-white text-center font-black uppercase px-6 leading-tight">{msg.text}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={() => setIsScanning(false)} className="mt-12 text-white/40 f-b uppercase text-sm border-b border-white/10 pb-1">
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}