import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAdminStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const teams = useAdminStore((s) => s.teams);
  const stats = useAdminStore((s) => s.stats);
  const lastSync = useAdminStore((s) => s.lastSync);
  const fetchTeams = useAdminStore((s) => s.fetchTeams);
  const subscribeRealtime = useAdminStore((s) => s.subscribeRealtime);
  const logoutAdmin = useAdminStore((s) => s.logoutAdmin);
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [installCount, setInstallCount] = useState(0);

  // Wait for Zustand hydration
  useEffect(() => {
    const unsub = useAdminStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAdminStore.persist.hasHydrated()) setHydrated(true);
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAdmin) { router.push('/'); return; }

    // Initial fetch
    fetchTeams();

    // Subscribe to Supabase Realtime for instant updates
    const unsubscribe = subscribeRealtime();

    const fetchAnalytics = async () => {
      try {
        const { data } = await supabase.from('app_metrics').select('install_count').single();
        if (data) setInstallCount(data.install_count);
      } catch (_) {}
    };
    fetchAnalytics();

    // Fallback poll every 5s (guarantees updates even if Realtime hiccups)
    const fallbackInterval = setInterval(() => {
      fetchTeams();
      fetchAnalytics();
    }, 5000);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      clearInterval(fallbackInterval);
    };
  }, [hydrated, isAdmin, router, fetchTeams, subscribeRealtime]);

  const handleLogout = () => {
    logoutAdmin();
    router.push('/');
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-[#f4e4bc] p-4 md:p-12 relative font-sans uppercase overflow-y-auto custom-scroll selection:bg-[#d4af37] selection:text-black">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Space+Mono:wght@400;700&display=swap');
        .legend-font { font-family: 'Cinzel', serif; }
        .data-font { font-family: 'Space Mono', monospace; }
        .chamber-glow { text-shadow: 0 0 15px rgba(212, 175, 55, 0.6); }
        .glass-tablet { background: rgba(10, 10, 10, 0.8); border: 1px solid rgba(212, 175, 55, 0.15); backdrop-filter: blur(20px); }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: #050505; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #d4af37; border-radius: 10px; }
        
        @keyframes scanline {
          0% { bottom: 100%; }
          100% { bottom: 0%; }
        }
        .scanner-line {
          position: fixed;
          top: 0; left: 0; right: 0; height: 100px;
          background: linear-gradient(to bottom, transparent, rgba(212, 175, 55, 0.05), transparent);
          animation: scanline 8s linear infinite;
          pointer-events: none;
          z-index: 60;
        }
      `}</style>

      <div className="scanner-line" />

      {/* BACKGROUND IMAGE */}
      <div className="fixed inset-0 z-0 opacity-15 pointer-events-none grayscale brightness-50">
        <img src="/cave.webp" className="w-full h-full object-cover" alt="" />
      </div>

      {/* HEADER SECTION */}
      <header className="relative z-10 max-w-7xl mx-auto mb-16 border-b border-[#d4af37]/20 pb-10">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 bg-red-600 animate-pulse rounded-full shadow-[0_0_12px_red]" />
               <p className="data-font text-[10px] tracking-[0.2em] text-red-500 font-bold uppercase">System Live • Sync: {lastSync}</p>
            </div>
            <h1 className="legend-font text-6xl md:text-8xl tracking-tighter text-white leading-none">
              ADMIN <span className="text-[#d4af37] chamber-glow">PANEL</span>
            </h1>
            <nav className="flex flex-wrap gap-x-10 gap-y-4 pt-4">
              <Link href="#" className="data-font text-[11px] tracking-[0.2em] text-[#d4af37] border-b-2 border-[#d4af37] pb-1 font-bold">ALL TEAMS</Link>
              <Link href="/admin/clues" className="data-font text-[11px] tracking-[0.2em] opacity-50 hover:opacity-100 hover:text-[#d4af37] transition-all pb-1 font-bold">MANAGE CLUES</Link>
              <button onClick={handleLogout} className="data-font text-[11px] tracking-[0.2em] text-red-500/80 hover:text-red-500 transition-all font-bold">LOGOUT</button>
            </nav>
          </div>

          <div className="flex gap-16 p-6 glass-tablet rounded-sm">
            <div className="text-center">
              <p className="data-font text-[10px] opacity-60 tracking-widest mb-2 uppercase">Total Teams</p>
              <p className="legend-font text-5xl text-white">{teams.length}</p>
            </div>
            <div className="text-center">
              <p className="data-font text-[10px] opacity-60 tracking-widest mb-2 text-[#d4af37]/80 uppercase">App Installs</p>
              <p className="legend-font text-5xl text-[#d4af37]">{installCount}</p>
            </div>
            <div className="text-center">
              <p className="data-font text-[10px] opacity-60 tracking-widest mb-2 text-green-500/80 uppercase">Active</p>
              <p className="legend-font text-5xl text-green-500">{stats.active}</p>
            </div>
            <div className="text-center">
              <p className="data-font text-[10px] opacity-60 tracking-widest mb-2 text-red-500/80 uppercase">Eliminated</p>
              <p className="legend-font text-5xl text-red-600">{stats.eliminated}</p>
            </div>
          </div>
        </div>
      </header>

      {/* TEAM GRID */}
      <main className="grid grid-cols-1 gap-6 relative z-10 max-w-7xl mx-auto pb-32">
        <AnimatePresence mode='popLayout'>
          {teams.map((team, index) => (
            <motion.div
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              key={team.id}
              className={`glass-tablet px-8 py-10 flex flex-col lg:flex-row items-center justify-between gap-10 group transition-all duration-700 rounded-sm relative overflow-hidden ${team.status === 'ELIMINATED' ? 'opacity-40 grayscale' : 'hover:border-[#d4af37]/50'}`}
            >
              {/* Progress Bar Underlay */}
              <div className="absolute bottom-0 left-0 h-1 bg-[#d4af37]/5 w-full" />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(team.current_sector / 5) * 100}%` }}
                className="absolute bottom-0 left-0 h-1 bg-[#d4af37] shadow-[0_0_15px_#d4af37]"
              />

              <div className="flex flex-col md:flex-row items-center gap-12 w-full lg:w-3/4">
                {/* Sector Badge */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-[#d4af37]/10 blur-xl rounded-full scale-150" />
                  <div className={`w-24 h-24 border-2 flex flex-col items-center justify-center relative z-10 rounded-full ${team.status === 'ELIMINATED' ? 'border-red-900/50' : 'border-[#d4af37]/40'}`}>
                    <span className={`legend-font text-4xl leading-none ${team.status === 'ELIMINATED' ? 'text-red-900' : 'text-white chamber-glow'}`}>
                      {team.current_sector}
                    </span>
                    <p className="data-font text-[10px] opacity-70 mt-1 tracking-widest">ROUND</p>
                  </div>
                </div>

                <div className="text-center md:text-left space-y-3">
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <h3 className="legend-font text-4xl md:text-5xl text-white tracking-tight group-hover:text-[#d4af37] transition-colors duration-500">
                      {team.team_name}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 max-w-md">
                    <div className="data-font text-[11px] flex flex-col">
                      <span className="opacity-50 tracking-wider">Team Leader</span>
                      <span className="text-[#f4e4bc] font-bold">{team.leader_name}</span>
                    </div>
                    <div className="data-font text-[11px] flex flex-col">
                      <span className="opacity-50 tracking-wider">Contact No</span>
                      <span className="text-[#f4e4bc] font-bold">{team.leader_phone}</span>
                    </div>
                  </div>
                </div>

                {/* Mini Map Visualization */}
                <div className="hidden xl:flex gap-2 ml-auto">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div
                      key={s}
                      className={`w-6 h-10 border transition-all duration-700 ${
                        team.current_sector >= s
                          ? 'bg-[#d4af37] border-[#d4af37] shadow-[0_0_10px_#d4af37]'
                          : 'bg-white/5 border-white/10'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="w-full lg:w-auto text-center lg:text-right">
                <div className={`inline-block min-w-[180px] px-8 py-3 border-2 text-[14px] font-bold tracking-[0.2em] shadow-lg ${
                  team.status === 'ELIMINATED'
                    ? 'border-red-900 text-red-600 bg-red-950/20'
                    : team.status === 'FINISHED'
                    ? 'border-green-700 text-green-500 bg-green-950/20'
                    : 'border-[#d4af37] text-[#d4af37] bg-white/5'
                }`}>
                  {team.status === 'ELIMINATED' ? 'ELIMINATED' : team.status === 'FINISHED' ? 'FINISHED' : 'ACTIVE'}
                </div>
                <p className="data-font text-[10px] opacity-40 mt-3 tracking-wider lowercase">
                   Team ID: {team.id.toString().substring(0,8)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {teams.length === 0 && (
          <div className="text-center py-40 border-2 border-dashed border-[#d4af37]/30 rounded-lg">
            <p className="legend-font text-2xl opacity-50 tracking-[0.2em]">WAITING FOR TEAMS...</p>
          </div>
        )}
      </main>

      {/* OVERLAY EFFECTS */}
      <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(212,175,55,0.01),rgba(0,255,0,0.005),rgba(0,0,255,0.01))] bg-[length:100%_3px,3px_100%]" />
      <div className="pointer-events-none fixed inset-0 z-40 shadow-[inset_0_0_300px_rgba(0,0,0,1)] opacity-90" />
    </div>
  );
}