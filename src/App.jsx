import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Github, Instagram, Sun, Moon, Database, Users, Calendar, HelpCircle, Sparkles } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import Search from './components/Search';
import ScheduleCard from './components/ScheduleCard';
import AdminModal from './components/AdminModal';
import Spotlight from './components/ui/Spotlight';
import { BentoGrid, BentoCard } from './components/ui/BentoGrid';
import { getStudentCount } from './utils/api';

function App() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [syncVersion, setSyncVersion] = useState(0);
  const [dbStatus, setDbStatus] = useState('connecting'); // connecting | online | offline
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const count = await getStudentCount();
        setStudentCount(count);
        setDbStatus('online');
      } catch (err) {
        console.error('Failed to fetch database stats:', err);
        setDbStatus('offline');
      }
    }
    fetchStats();
  }, [selectedStudent]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500/30 transition-colors duration-300 relative cyber-grid overflow-x-hidden">
      {/* Ambient Spotlight */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <Spotlight fill="#10b981" className="-top-40 left-1/4 opacity-20 dark:opacity-40" />
        <Spotlight fill="#06b6d4" className="top-1/2 -right-40 opacity-20 dark:opacity-40" />
      </div>

      {/* Floating Header Dock - Mobile Optimized */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 max-w-5xl mx-auto z-50 px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-full bg-white/90 dark:bg-[#0c101c]/80 backdrop-blur-2xl border border-slate-200/90 dark:border-white/10 shadow-lg shadow-slate-200/50 dark:shadow-none flex justify-between items-center"
      >
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[11px] sm:text-xs">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dbStatus === 'online' ? 'bg-emerald-500 animate-pulse' : dbStatus === 'connecting' ? 'bg-amber-500 animate-spin' : 'bg-rose-500'}`} />
            <span className="font-bold tracking-wider uppercase">{dbStatus}</span>
          </div>
          <span className="hidden md:inline text-slate-300 dark:text-slate-700">|</span>
          <span className="hidden md:inline text-slate-600 dark:text-slate-400 font-sans text-xs">
            By <a href="https://somyacodes.in" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Somyajeet Singh</a>
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsAdminOpen(true)}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/5 hover:border-emerald-500/50 transition-colors active:scale-95"
            title="Admin: Sync Database"
          >
            <Database size={16} className="text-emerald-600 dark:text-emerald-400" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleTheme}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/5 transition-colors active:scale-95"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-700" />}
          </motion.button>
          <a
            href="https://github.com/somyacodes07"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            title="GitHub Repository"
          >
            <Github size={16} />
          </a>
          <a
            href="https://instagram.com/somyajeet.op"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:text-pink-500 transition-colors"
            title="Instagram Profile"
          >
            <Instagram size={16} />
          </a>
        </div>
      </motion.header>

      {/* Main Content Area - Mobile Padding Adjustments */}
      <div className="relative z-10 container mx-auto px-4 pt-24 sm:pt-36 pb-16 max-w-5xl">
        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-10 px-2"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest mb-3 sm:mb-4">
            <Sparkles size={12} className="sm:w-3.5 sm:h-3.5" />
            <span>Academic Schedule Engine</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold font-heading mb-2.5 tracking-tight text-slate-900 dark:text-white leading-tight">
            Exam Scheduler
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base md:text-lg max-w-xl mx-auto font-sans leading-relaxed">
            Multi-Batch Theory & Practical Viva Slots
          </p>
        </motion.div>

        {/* Command Search */}
        <Search
          key={syncVersion}
          onSelectStudent={setSelectedStudent}
        />

        {/* Schedule Display Component */}
        <div className="mt-8 sm:mt-10">
          <ScheduleCard
            key={selectedStudent ? selectedStudent.rollNo : 'empty'}
            student={selectedStudent}
          />
        </div>

        {/* Bento Grid System Dashboard (Shown when no student is selected) */}
        {!selectedStudent && (
          <div className="mt-10 sm:mt-14 space-y-6">
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                System Overview & Quick Guide
              </h2>
            </div>

            <BentoGrid>
              <BentoCard
                title="Database Link"
                description="Live connection status with MongoDB cloud cluster."
                icon={Database}
                badge="Realtime"
                delay={0.1}
              >
                <div className="mt-2 text-xs font-mono font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dbStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="truncate">{dbStatus === 'online' ? 'MongoDB Cluster Online' : 'Connecting to Cluster...'}</span>
                </div>
              </BentoCard>

              <BentoCard
                title="Total Schedules"
                description="Indexed student exam records across active batches."
                icon={Users}
                badge="Indexed"
                delay={0.2}
              >
                <div className="mt-2 text-xl sm:text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400">
                  {studentCount} <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">Students</span>
                </div>
              </BentoCard>

              <BentoCard
                title="Active Batches"
                description="Supported academic years and semester schedules."
                icon={Calendar}
                badge="3 Batches"
                delay={0.3}
              >
                <div className="mt-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">2023-27</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">2024-28</span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">2025-29</span>
                </div>
              </BentoCard>
            </BentoGrid>

            {/* How-To Guide pod */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-3xl bg-white dark:bg-[#0c101c]/70 border border-slate-200/90 dark:border-white/10 p-5 sm:p-8 backdrop-blur-xl max-w-5xl mx-auto space-y-4 shadow-sm dark:shadow-none"
            >
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold font-heading text-sm sm:text-base">
                <HelpCircle className="text-emerald-600 dark:text-emerald-500 flex-shrink-0" size={20} />
                <span>How to Lookup & Export Schedule</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5 sm:gap-4 text-xs">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/5 space-y-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-[10px] flex-shrink-0">1</span>
                    <span>Search Student</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Type your full Name or Roll Number in the search bar to preview matches instantly.
                  </p>
                </div>

                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/5 space-y-1">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-[10px] flex-shrink-0">2</span>
                    <span>Calendar Export</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Tap "Export to Calendar" to download `.ics` file and sync with Google or Apple Calendar.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Admin Sync Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onSyncSuccess={() => {
          setSelectedStudent(null);
          setSyncVersion(prev => prev + 1);
        }}
      />

      <Analytics />
    </div>
  );
}

export default App;
