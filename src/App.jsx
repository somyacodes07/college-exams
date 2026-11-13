import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Instagram, Sun, Moon, Database, Users, Calendar, Search as SearchIcon, CalendarPlus } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import Search from './components/Search';
import ScheduleCard from './components/ScheduleCard';
import AdPlacement from './components/AdPlacement';
import Spotlight from './components/ui/Spotlight';
import { BentoGrid, BentoCard } from './components/ui/BentoGrid';
import { getStudentCount, getStudentByRoll, checkServerHealth, getBatches, subscribeToIndex } from './utils/api';

const AdminModal = lazy(() => import('./components/AdminModal'));

const BATCH_COLORS = [
  'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  'bg-violet-100 dark:bg-violet-500/10 text-violet-800 dark:text-violet-400 border-violet-200 dark:border-violet-500/20',
  'bg-cyan-100 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20',
  'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
];

const STATUS_LABEL = { connecting: 'Connecting', online: 'Live', offline: 'Offline' };

const getRollFromUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('roll');
  } catch {
    return null;
  }
};

const setRollInUrl = (rollNo) => {
  try {
    const url = new URL(window.location.href);
    if (rollNo) url.searchParams.set('roll', rollNo);
    else url.searchParams.delete('roll');
    if (url.href !== window.location.href) window.history.pushState({ roll: rollNo || null }, '', url);
  } catch {
    /* ignore */
  }
};

function App() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [batches, setBatches] = useState(getBatches);
  const [syncVersion, setSyncVersion] = useState(0);
  const [dbStatus, setDbStatus] = useState('connecting');

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved;
    } catch { /* ignore */ }
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0f19' : '#f8fafc');
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);

  // Stats + health
  useEffect(() => {
    let active = true;
    getStudentCount().then((count) => active && setStudentCount(count));
    checkServerHealth().then((ok) => active && setDbStatus(ok ? 'online' : 'offline'));
    const unsubscribe = subscribeToIndex((index) => {
      if (!active) return;
      setStudentCount(index.length);
      setBatches(getBatches());
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [syncVersion]);

  // Deep link: ?roll=XXXX opens that student's schedule, and back/forward work
  const openRoll = useCallback(async (roll) => {
    const student = roll ? await getStudentByRoll(roll) : null;
    setSelectedStudent(student || null);
  }, []);

  useEffect(() => {
    const initialRoll = getRollFromUrl();
    if (initialRoll) getStudentByRoll(initialRoll).then((s) => s && setSelectedStudent(s));
    const onPop = () => openRoll(getRollFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [openRoll]);

  const handleSelectStudent = useCallback((student) => {
    setSelectedStudent(student);
    setRollInUrl(student?.rollNo);
    if (student) {
      requestAnimationFrame(() => {
        document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  // Clean legacy caches and check for app updates when the tab regains focus
  useEffect(() => {
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((key) => {
        if (key === 'exam-scheduler-v1' || key === 'exam-scheduler-v2') caches.delete(key);
      })).catch(() => {});
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update()).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const iconBtn = 'w-10 h-10 flex items-center justify-center rounded-full transition-colors active:scale-95';

  return (
    <div className="min-h-screen min-h-dvh bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500/30 transition-colors duration-300 relative cyber-grid overflow-x-hidden">
      {/* Ambient light (desktop only, saves GPU on phones) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 hidden md:block" aria-hidden="true">
        <Spotlight fill="#10b981" className="-top-40 left-1/4 opacity-20 dark:opacity-40" />
        <Spotlight fill="#06b6d4" className="top-1/2 -right-40 opacity-20 dark:opacity-40" />
      </div>

      {/* Header */}
      <header
        className="fixed top-0 inset-x-0 z-50 px-3 sm:px-4"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="max-w-5xl mx-auto pl-3.5 pr-1.5 py-1.5 sm:pl-5 sm:pr-2 rounded-full bg-white/95 dark:bg-[#0c101c]/95 md:bg-white/85 md:dark:bg-[#0c101c]/80 md:backdrop-blur-lg border border-slate-200/90 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-none flex justify-between items-center">
          <button
            onClick={() => handleSelectStudent(null)}
            className="flex items-center gap-2 min-w-0 text-left"
            aria-label="Exam Scheduler home"
          >
            <img src="/logo.svg" alt="" width="28" height="28" className="w-7 h-7 rounded-lg flex-shrink-0" />
            <span className="font-heading font-bold text-sm sm:text-base tracking-tight truncate">Exam Scheduler</span>
            <span
              className="flex max-[359px]:hidden items-center gap-1.5 ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10"
              title={dbStatus === 'offline' ? 'Server unreachable, showing bundled data' : 'Connected to live database'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'online' ? 'bg-emerald-500' : dbStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
              {STATUS_LABEL[dbStatus]}
            </span>
          </button>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => setIsAdminOpen(true)}
              aria-label="Admin: sync database"
              title="Admin: sync database"
              className={`${iconBtn} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5`}
            >
              <Database size={17} />
            </button>
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title="Toggle theme"
              className={`${iconBtn} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 overflow-hidden`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ y: -14, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 14, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
                </motion.span>
              </AnimatePresence>
            </button>
            <a
              href="https://github.com/somyacodes07"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className={`${iconBtn} hidden sm:flex text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5`}
            >
              <Github size={17} />
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto px-4 pt-24 sm:pt-32 pb-12 max-w-5xl" style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}>
        {/* Hero */}
        <AnimatePresence initial={false}>
          {!selectedStudent && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="text-center mb-6 sm:mb-10"
            >
              <h1 className="text-[2.5rem] sm:text-6xl md:text-7xl font-extrabold font-heading tracking-tight text-slate-900 dark:text-white leading-[1.05]">
                Find your<br className="sm:hidden" /> <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">exam slots</span>
              </h1>
              <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-lg max-w-md mx-auto leading-relaxed">
                Theory papers and practical vivas for every batch, in one timeline.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <Search key={syncVersion} onSelectStudent={handleSelectStudent} selectedStudent={selectedStudent} />

        <div id="schedule" className="mt-6 sm:mt-10 scroll-mt-28">
          <ScheduleCard key={selectedStudent ? selectedStudent.rollNo : 'empty'} student={selectedStudent} />
        </div>

        {!selectedStudent && (
          <div className="mt-8 sm:mt-14 space-y-4 sm:space-y-6">
            {/* How it works */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { icon: SearchIcon, title: 'Search', text: 'Name or roll no.' },
                { icon: Calendar, title: 'View', text: 'Day-by-day timeline' },
                { icon: CalendarPlus, title: 'Save', text: 'Add to your calendar' },
              ].map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="rounded-2xl bg-white dark:bg-[#0c101c]/80 border border-slate-200/90 dark:border-white/10 p-3 sm:p-5 text-center sm:text-left"
                >
                  <div className="mx-auto sm:mx-0 w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <step.icon size={17} />
                  </div>
                  <div className="mt-2 font-bold text-sm text-slate-900 dark:text-white">
                    <span className="font-mono text-slate-400 mr-1">{i + 1}</span>{step.title}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug">{step.text}</div>
                </motion.div>
              ))}
            </div>

            <BentoGrid>
              <BentoCard title="Students" description="Schedules indexed across all batches." icon={Users} delay={0.1}>
                <div className="text-2xl sm:text-3xl font-bold font-heading text-emerald-600 dark:text-emerald-400">
                  {studentCount.toLocaleString('en-IN')}
                </div>
              </BentoCard>

              <BentoCard title="Active batches" description="Academic years with published schedules." icon={Calendar} delay={0.15}>
                <div className="text-xs font-mono font-bold flex flex-wrap gap-1.5">
                  {batches.map((b, i) => (
                    <span key={b} className={`px-2 py-0.5 rounded border ${BATCH_COLORS[i % BATCH_COLORS.length]}`}>{b}</span>
                  ))}
                </div>
              </BentoCard>

              <BentoCard title="Data source" description="Synced from the official exam sheets." icon={Database} delay={0.2}>
                <div className="text-xs font-mono font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dbStatus === 'online' ? 'bg-emerald-500' : dbStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span className="truncate">
                    {dbStatus === 'online' ? 'Live database connected' : dbStatus === 'connecting' ? 'Connecting…' : 'Showing saved copy'}
                  </span>
                </div>
              </BentoCard>
            </BentoGrid>
          </div>
        )}

        <AdPlacement />

        <footer className="mt-10 pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Built by{' '}
            <a href="https://somyacodes.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              Somyajeet Singh
            </a>
          </span>
          <div className="flex items-center gap-1">
            <a href="https://github.com/somyacodes07" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className={`${iconBtn} hover:text-slate-900 dark:hover:text-white`}>
              <Github size={16} />
            </a>
            <a href="https://instagram.com/somyajeet.op" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={`${iconBtn} hover:text-pink-500`}>
              <Instagram size={16} />
            </a>
          </div>
        </footer>
      </main>

      {isAdminOpen && (
        <Suspense fallback={null}>
          <AdminModal
            isOpen={isAdminOpen}
            onClose={() => setIsAdminOpen(false)}
            onSyncSuccess={() => {
              handleSelectStudent(null);
              setSyncVersion((prev) => prev + 1);
            }}
          />
        </Suspense>
      )}

      <Analytics />
    </div>
  );
}

export default App;
