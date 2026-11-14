import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Github, Instagram, Sun, Moon, Database } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1f283c' : '#ffffff');
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

  const iconBtn = 'w-10 h-10 inline-flex items-center justify-center rounded-md text-ink-soft hover:text-ink hover:bg-desk transition-colors';

  return (
    <div className="min-h-screen min-h-dvh bg-desk text-ink">
      <header
        className="sticky top-0 z-40 bg-paper/95 border-b border-rule print:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto max-w-6xl h-14 lg:h-16 px-4 lg:px-6 flex items-center justify-between gap-3">
          <button
            onClick={() => handleSelectStudent(null)}
            className="flex items-center gap-2.5 min-w-0 rounded-md"
            aria-label="Exam Scheduler home"
          >
            <img src="/logo.svg" alt="" width="28" height="28" className="w-7 h-7 lg:w-8 lg:h-8 rounded-[7px] flex-shrink-0 dark:ring-1 dark:ring-rule" />
            <span className="font-bold text-[17px] lg:text-[19px] tracking-[-0.01em] truncate">Exam Scheduler</span>
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
          <p className="border-t border-rule bg-desk px-4 py-1.5 text-center text-[13px] text-ink-soft">
            Can't reach the server right now. Search will work again once you're back online.
          </p>
        )}
      </header>

      <main
        className="mx-auto max-w-6xl px-4 lg:px-6 pt-8 sm:pt-14 lg:pt-16"
        style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
      >
        {!selectedStudent && (
          <div className="reveal max-w-3xl">
            <h1 className="text-[2.25rem] sm:text-[3.25rem] lg:text-[4.25rem] font-extrabold leading-[1.03] tracking-[-0.03em]">
              Your exam date sheet
            </h1>
            <p className="mt-3 lg:mt-4 text-[17px] lg:text-[21px] text-ink-soft max-w-[36rem]">
              Theory papers, practical vivas and ATKT re‑exams, with time and room. Search your name or roll number.
            </p>
          </div>
        )}

        <div className={`print:hidden ${selectedStudent ? '' : 'mt-6 sm:mt-8'}`}>
          <Search key={syncVersion} onSelectStudent={handleSelectStudent} selectedStudent={selectedStudent} onLoadingChange={setOpening} />
        </div>

        {!selectedStudent && (
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] lg:text-[16px] text-ink-soft" aria-label="Colour key">
            <li className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-[3px] bg-theory" aria-hidden="true" />Theory</li>
            <li className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-[3px] bg-practical" aria-hidden="true" />Practical</li>
            <li className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-[3px] bg-reexam" aria-hidden="true" />Re-exam (ATKT)</li>
            <li className="inline-flex items-center gap-2"><span className="w-5 h-3 rounded-[2px] bg-mark" aria-hidden="true" />Your next exam</li>
          </ul>
        )}

        {!selectedStudent && batches.length > 0 && (
          <p className="mt-4 text-[14px] lg:text-[16px] text-ink-faint tnum max-w-2xl">
            {studentCount > 0 ? `${studentCount.toLocaleString('en-IN')} students` : 'Students'} in batches{' '}
            {batches.slice().sort().map((b, i, all) => (
              <span key={b} className="whitespace-nowrap">{b}{i < all.length - 1 ? ', ' : '.'}</span>
            ))}
          </p>
        )}

        <div id="schedule" className="mt-6 sm:mt-8 scroll-mt-20">
          {opening ? (
            <ScheduleSkeleton />
          ) : (
            <ScheduleCard key={selectedStudent ? selectedStudent.rollNo : 'empty'} student={selectedStudent} />
          )}
          {!selectedStudent && !opening && <QuickCopy onOpen={openRecent} />}
        </div>


        <footer className="print:hidden mt-10 pt-5 border-t border-rule flex flex-wrap items-center justify-between gap-3 text-[14px] text-ink-soft">
          <span>
            Made by{' '}
            <a href="https://somyacodes.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
              Somyajeet Singh
            </a>
          </span>
          <div className="flex items-center gap-1">
            <a href="https://github.com/somyacodes07" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className={iconBtn}>
              <Github size={17} />
            </a>
            <a href="https://instagram.com/somyajeet.op" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={iconBtn}>
              <Instagram size={17} />
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

      <Toast />
      <Analytics />
    </div>
  );
}

export default App;
