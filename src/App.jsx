import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Github, Instagram, Sun, Moon, Database } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import GradientASCII from './components/GradientASCII';
import Search from './components/Search';
import ScheduleCard from './components/ScheduleCard';
import ScheduleSkeleton from './components/ScheduleSkeleton';
import QuickCopy from './components/QuickCopy';
import Toast from './components/Toast';
import { getStudentCount, getStudentByRoll, checkServerHealth, getBatches, subscribeToIndex } from './utils/api';

const AdminModal = lazy(() => import('./components/AdminModal'));

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
  // True while a schedule is being fetched (shared link, search pick, quick open)
  const [opening, setOpening] = useState(() => !!getRollFromUrl());

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved;
    } catch { /* ignore */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff');
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
    if (roll) setOpening(true);
    const student = roll ? await getStudentByRoll(roll).catch(() => null) : null;
    setSelectedStudent(student || null);
    setOpening(false);
  }, []);

  useEffect(() => {
    const initialRoll = getRollFromUrl();
    if (initialRoll) {
      getStudentByRoll(initialRoll)
        .then((s) => s && setSelectedStudent(s))
        .catch(() => {})
        .finally(() => setOpening(false));
    }
    const onPop = () => openRoll(getRollFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [openRoll]);

  const handleSelectStudent = useCallback((student) => {
    setSelectedStudent(student);
    setOpening(false);
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

  // Opening a recent student from the home-page quick copy card
  const openRecent = useCallback(async (s) => {
    setOpening(true);
    const student = await getStudentByRoll(s.rollNo).catch(() => null);
    setOpening(false);
    if (student) handleSelectStudent(student);
  }, [handleSelectStudent]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const iconBtn = 'inline-flex size-9 items-center justify-center rounded-md text-ink-soft transition duration-200 hover:bg-muted hover:text-ink active:scale-95';
  const home = !selectedStudent;

  return (
    <div className="relative flex min-h-screen min-h-dvh flex-col bg-desk text-ink">
      {theme === 'dark' && (
        <div className="pointer-events-none fixed inset-0 z-0 print:hidden" aria-hidden="true">
          <GradientASCII
            colors={['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8']}
            shape="horizon"
            characters=" =+xX0S8#@"
            cellSize={18}
            density={0.8}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}
      <header
        className="sticky top-0 z-40 border-b border-rule bg-desk/90 backdrop-blur-md print:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto max-w-6xl h-14 lg:h-16 px-4 lg:px-6 flex items-center justify-between gap-3">
          <button
            onClick={() => handleSelectStudent(null)}
            className="flex items-center gap-2.5 min-w-0 rounded-md"
            aria-label="Exam Scheduler home"
          >
            <img src="/logo.svg" alt="" width="28" height="28" className="w-7 h-7 lg:w-8 lg:h-8 rounded-[7px] flex-shrink-0 dark:ring-1 dark:ring-rule" />
            <span className="font-semibold text-sm tracking-tight truncate">Exam Scheduler</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
              className={iconBtn}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setIsAdminOpen(true)} aria-label="Admin: sync schedules" title="Admin" className={iconBtn}>
              <Database size={18} />
            </button>
          </div>
        </div>
        {dbStatus === 'offline' && (
          <p className="border-t border-rule bg-muted px-4 py-1.5 text-center text-sm text-ink-soft">
            Can't reach the server right now. Search will work again once you're back online.
          </p>
        )}
      </header>

      <main
        className={home
          ? 'relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-12 text-center'
          : 'relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pt-8 sm:pt-14 lg:px-6 lg:pt-16'}
      >
        {home && (
          <div className="rise flex w-full max-w-xl flex-col items-center">
            <h1 className="text-4xl font-medium tracking-tight leading-[1.05] sm:text-5xl">
              Your exam date sheet
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft sm:text-base">
              Theory papers, practical vivas and ATKT re‑exams, with time and room. Search your name or roll number.
            </p>
          </div>
        )}

        <div className={`print:hidden relative z-30 w-full ${home ? 'rise d2 mt-8 max-w-xl' : ''}`}>
          <Search key={syncVersion} onSelectStudent={handleSelectStudent} selectedStudent={selectedStudent} onLoadingChange={setOpening} />
        </div>

        {home && (
          <ul className="rise d3 mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-soft" aria-label="Colour key">
            <li className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-theory" aria-hidden="true" />Theory</li>
            <li className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-practical" aria-hidden="true" />Practical</li>
            <li className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-reexam" aria-hidden="true" />Re-exam (ATKT)</li>
            <li className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-mark" aria-hidden="true" />Your next exam</li>
          </ul>
        )}

        {home && batches.length > 0 && (
          <p className="rise d4 mt-4 max-w-xl text-sm text-ink-faint tnum">
            {studentCount > 0 ? `${studentCount.toLocaleString('en-IN')} students` : 'Students'} in batches{' '}
            {batches.slice().sort().map((b, i, all) => (
              <span key={b} className="whitespace-nowrap">{b}{i < all.length - 1 ? ', ' : '.'}</span>
            ))}
          </p>
        )}

        <div id="schedule" className={home ? 'mt-6 w-full max-w-xl' : 'mt-6 scroll-mt-20 sm:mt-8'}>
          {opening ? (
            <ScheduleSkeleton />
          ) : (
            <ScheduleCard key={selectedStudent ? selectedStudent.rollNo : 'empty'} student={selectedStudent} />
          )}
          {home && !opening && <QuickCopy onOpen={openRecent} />}
        </div>
      </main>

      <footer
        className="rise d5 print:hidden relative z-10 mt-auto flex flex-wrap items-center justify-center gap-2 border-t border-rule/40 px-4 py-4 text-xs text-ink-soft"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <span>
          Made by{' '}
          <a href="https://somyacodes.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-4 transition-colors hover:text-ink">
            Somyajeet Singh
          </a>
        </span>
        <span aria-hidden="true" className="text-rule">·</span>
        <div className="flex items-center">
          <a href="https://github.com/somyacodes07" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className={iconBtn}>
            <Github size={17} />
          </a>
          <a href="https://instagram.com/somyajeet.op" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={iconBtn}>
            <Instagram size={17} />
          </a>
        </div>
      </footer>

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

      <Toast />
      <Analytics />
    </div>
  );
}

export default App;
