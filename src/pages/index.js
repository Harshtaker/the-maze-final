import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { usePlayerStore, useAdminStore } from '../lib/store';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showInstallGate, setShowInstallGate] = useState(false);
  const [adminData, setAdminData] = useState({ username: '', password: '' });
  const router = useRouter();

  const playerLogin = usePlayerStore((s) => s.login);
  const existingTeam = usePlayerStore((s) => s.team);
  const adminLogin = useAdminStore((s) => s.loginAdmin);
  const isAdmin = useAdminStore((s) => s.isAdmin);

  const [formData, setFormData] = useState({
    teamName: '',
    password: '',
    leaderName: '',
    leaderPhone: '',
    member2: '',
    member3: '',
    member4: '',
  });

  // Wait for hydration before showing resume options
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    
    // Check if app is not running in standalone (PWA) mode AND hasn't been dismissed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');
    const dismissed = localStorage.getItem('maze_install_dismissed');
    
    if (!isStandalone && !dismissed) {
      setShowInstallGate(true);
    }
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', adminData.username)
      .eq('password', adminData.password)
      .single();

    if (error || !data) {
      alert('Staff access denied. Check your password.');
    } else {
      adminLogin();
      router.push('/admin/dashboard');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Fetch ALL columns to get actual progress from DB
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('team_name', formData.teamName)
      .eq('password', formData.password)
      .single();

    if (error || !data) {
      setErrorMsg('Wrong Team Name or Password!');
    } else {
      // playerLogin() intelligently merges DB + local state
      playerLogin(data);
      router.push('/dashboard');
    }
    setLoading(false);
  };

  if (hydrated && showInstallGate) {
    return (
      <div className="relative w-screen h-screen flex flex-col items-center justify-center bg-[#050505] p-6 text-center select-none">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Space+Mono:wght@400;700&display=swap');
          .hunt-title { font-family: 'Cinzel', serif; }
          .hunt-text { font-family: 'Space Mono', monospace; }
        `}</style>
        
        <div className="absolute inset-0 z-0 bg-[url('/cave.webp')] bg-cover opacity-20 grayscale brightness-50 pointer-events-none" />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="z-10 bg-black/80 border border-[#d4af37]/30 p-8 md:p-12 max-w-md w-full backdrop-blur-md rounded-lg shadow-[0_0_40px_rgba(212,175,55,0.15)]"
        >
          <img src="/icon.png" alt="App Icon" className="w-24 h-24 mx-auto mb-6 rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.4)] border border-[#d4af37]/40 p-1" />
          
          <h2 className="hunt-title text-2xl md:text-3xl text-white mb-2 uppercase drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]">Install App</h2>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent my-4" />
          
          <p className="text-[#f4e4bc] text-sm md:text-base opacity-80 mb-8 leading-relaxed">
            For maximum stability and fullscreen mode, you must install The Maze on your device before starting.
          </p>

          <div className="space-y-4 text-left hunt-text text-[11px] text-[#d4af37] opacity-90 tracking-widest bg-black/60 p-5 border border-white/10 rounded-md mb-8 shadow-inner">
            <p className="leading-relaxed">
              <strong className="text-white">iOS (Safari):</strong><br/>Tap the Share icon <span className="text-white border border-white/30 px-1 rounded mx-1 pb-1">[↑]</span> at the bottom, then scroll down and tap &quot;Add to Home Screen&quot; <span className="text-white border border-white/30 px-1 rounded mx-1 pb-1">[+]</span>.
            </p>
            <div className="h-[1px] bg-white/10 w-full" />
            <p className="leading-relaxed">
              <strong className="text-white">Android (Chrome):</strong><br/>Tap the Menu icon <span className="text-white border border-white/30 px-1 rounded mx-1 pb-1">[⋮]</span> at the top right, then tap &quot;Install app&quot; or &quot;Add to Home screen&quot;.
            </p>
          </div>

          <button 
            onClick={() => {
              localStorage.setItem('maze_install_dismissed', 'true');
              setShowInstallGate(false);
            }}
            className="w-full bg-[#d4af37] text-black py-4 font-black text-sm tracking-[0.2em] uppercase rounded-sm hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          >
            I&apos;ve Installed It
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen flex items-center justify-center overflow-hidden bg-[#050505]">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Space+Mono:wght@400;700&display=swap');
        .hunt-title { font-family: 'Cinzel', serif; font-size: clamp(2.5rem, 8vw, 5rem); color: #fff; text-shadow: 0 0 30px rgba(212,175,55,0.4); text-transform: uppercase; letter-spacing: -0.05em; line-height: 0.9; }
        .hunt-text { font-family: 'Space Mono', monospace; letter-spacing: 0.3em; color: #d4af37; text-transform: uppercase; }
        .portal-input-adv { background: rgba(255,255,255,0.05); border: 1px solid rgba(212,175,55,0.3); color: #f4e4bc; font-family: 'Space Mono', monospace; transition: all 0.4s ease; }
        .portal-input-adv:focus { border-color: #d4af37; background: rgba(212,175,55,0.1); box-shadow: 0 0 20px rgba(212,175,55,0.2); outline: none; }
        .custom-vignette { background: radial-gradient(circle, transparent 20%, black 100%); }
        .hunt-font { font-family: 'Cinzel', serif; }
      `}</style>

      {/* STAFF ACCESS BUTTON */}
      <div className="absolute top-8 right-8 z-50">
        <button
          onClick={() => setShowAdminLogin(true)}
          className="group relative flex flex-col items-end"
        >
          <span className="hunt-text text-[10px] mb-2 opacity-60 group-hover:opacity-100 transition-opacity">
            Staff_Only
          </span>
          <div className="flex items-center gap-3 bg-black/60 border border-[#d4af37]/30 px-5 py-3 backdrop-blur-md group-hover:border-[#d4af37] transition-all duration-500">
            <div className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
            <span className="hunt-font text-[12px] tracking-widest text-white uppercase font-bold">
              Admin Login
            </span>
          </div>
        </button>
      </div>

      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
          src="/cave.webp"
          className="w-full h-full object-cover opacity-40 grayscale"
          alt="Cave Background"
        />
        <div className="absolute inset-0 custom-vignette opacity-80" />
      </div>

      {/* LANTERN (ON THE RIGHT) */}
      <motion.img
        animate={{ y: [0, -20, 0], rotate: [0, -3, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        src="/lantern.webp"
        className="absolute top-[18%] right-[10%] w-28 md:w-44 z-10 opacity-70 pointer-events-none drop-shadow-[0_0_60px_rgba(212,175,55,0.4)]"
      />

      {/* CHEST */}
      <motion.img
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 0.8 }}
        src="/chest.webp"
        className="absolute bottom-[-50px] left-[-50px] w-[300px] md:w-[500px] z-10 hidden lg:block pointer-events-none brightness-50"
      />

      {/* LOGIN BOX */}
      <main className="relative z-20 w-full max-w-xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="hunt-title">The Maze</h1>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="h-[1px] w-12 bg-[#d4af37]/40" />
            <p className="hunt-text text-sm font-bold">Ambedkar Nagar ▸ 2026</p>
            <div className="h-[1px] w-12 bg-[#d4af37]/40" />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {hydrated && (existingTeam || isAdmin) ? (
            <motion.div
              key="resume-box"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 p-8 border border-[#d4af37]/30 bg-black/60 rounded-sm"
            >
              <h2 className="hunt-text text-[#d4af37] text-lg font-bold mb-6">ACTIVE SESSION FOUND</h2>
              {existingTeam && (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="w-full bg-[#d4af37] text-black py-4 font-black uppercase tracking-widest shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:scale-[1.02] transition-all"
                >
                  RESUME {existingTeam.team_name}
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => router.push('/admin/dashboard')}
                  className="w-full bg-[#d4af37] text-black py-4 font-black uppercase tracking-widest shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:scale-[1.02] transition-all"
                >
                  RESUME ADMIN PANEL
                </button>
              )}
              <div className="pt-4 mt-4 border-t border-[#d4af37]/20">
                <button
                  type="button"
                  onClick={() => {
                    if (existingTeam) usePlayerStore.getState().logout();
                    if (isAdmin) useAdminStore.getState().logoutAdmin();
                  }}
                  className="w-full text-white/50 text-xs py-3 font-bold uppercase tracking-widest hover:text-red-400 hover:bg-red-950/30 transition-all border border-transparent hover:border-red-500/30"
                >
                  CLEAR SESSIONS
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form key="login-form" layout onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="wait">
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-sm text-center font-bold uppercase tracking-widest bg-red-950/20 py-2 border border-red-500/30"
                  >
                    {errorMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                <input
                  required
                  type="text"
                  placeholder="TEAM NAME"
                  className="portal-input-adv w-full py-5 text-center text-xl font-bold tracking-widest uppercase"
                  onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                />
                <input
                  required
                  type="password"
                  placeholder="TEAM PASSWORD"
                  className="portal-input-adv w-full py-5 text-center text-xl font-bold tracking-widest uppercase"
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <motion.button
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                className="w-full bg-[#d4af37] text-black py-4 font-black text-lg tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50 mt-6 rounded-sm"
              >
                {loading ? 'Authenticating...' : 'Start Game'}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </main>

      {/* ADMIN MODAL */}
      <AnimatePresence>
        {showAdminLogin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="w-full max-w-sm p-10 border border-[#d4af37]/30 bg-[#0a0a0a]"
            >
              <div className="text-center mb-8">
                <h2 className="hunt-font text-3xl text-[#d4af37] uppercase font-bold italic tracking-widest">Admin Access</h2>
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent mt-4" />
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-5">
                <input required type="text" placeholder="USERNAME" className="portal-input-adv w-full py-4 text-lg text-center font-bold" onChange={(e) => setAdminData({ ...adminData, username: e.target.value })} />
                <input required type="password" placeholder="PASSWORD" className="portal-input-adv w-full py-4 text-lg text-center font-bold" onChange={(e) => setAdminData({ ...adminData, password: e.target.value })} />
                <button className="w-full bg-[#d4af37] text-black py-4 font-black uppercase text-base tracking-widest">Login</button>
                <button
                  type="button"
                  onClick={() => setShowAdminLogin(false)}
                  className="w-full text-white/40 hover:text-white hunt-text text-xs transition-colors pt-4"
                >
                  [ Cancel ]
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 z-40 bg-[url('https://www.transparenttextures.com/patterns/dust.png')] opacity-20" />
    </div>
  );
}