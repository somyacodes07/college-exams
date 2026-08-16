import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, BookOpen, Code, AlertCircle, MapPin, Download, User as PersonIcon, Copy, Check, X } from 'lucide-react';
import { generateICS, downloadICS } from '../utils/icsGenerator';
import { isExamCompleted } from '../utils/dateUtils';
import tutVideo from '../assets/tut.mp4';

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
};

const formatKeyName = (key) => {
    const result = key.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
};

const ExamItem = ({ exam, type }) => {
    const isTheory = type === 'theory';
    const completed = isExamCompleted(exam);
    const accentColor = completed 
        ? 'text-rose-500 dark:text-rose-400'
        : isTheory 
            ? 'text-purple-600 dark:text-purple-400' 
            : 'text-emerald-600 dark:text-emerald-400';
            
    const borderHover = completed
        ? 'border-rose-300 dark:border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/20'
        : isTheory 
            ? 'hover:border-purple-500/40 hover:shadow-md dark:hover:shadow-[0_0_25px_-5px_rgba(168,85,247,0.25)]' 
            : 'hover:border-emerald-500/40 hover:shadow-md dark:hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.25)]';
            
    const badgeBg = completed
        ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20'
        : isTheory
            ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20'
            : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20';

    const standardFields = ['date', 'subject', 'time', 'location', 'type', 'panel', 'professor', '_id', '__v'];
    const extraFields = Object.keys(exam).filter(key => {
        if (standardFields.includes(key)) return false;
        if (!exam[key]) return false;
        if (key.toLowerCase().includes('noofstudent')) {
            const hasLocation = exam.location && exam.location !== 'TBD' && exam.location.trim() !== '';
            if (!hasLocation) return false;
        }
        return true;
    });

    return (
        <motion.div
            variants={itemVariants}
            className={`group relative overflow-hidden bg-white dark:bg-[#0f1422]/90 text-left rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-white/10 ${borderHover} transition-all duration-300 backdrop-blur-xl shadow-sm dark:shadow-none ${completed ? 'opacity-85' : ''}`}
        >
            {/* Red SVG Cross Overlay for Completed Exam */}
            {completed && (
                <>
                    <svg 
                        className="absolute inset-0 w-full h-full pointer-events-none z-20 text-rose-500/60 dark:text-rose-500/50" 
                        preserveAspectRatio="none"
                        viewBox="0 0 100 100"
                    >
                        <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3" />
                        <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3" />
                    </svg>
                    <div className="absolute top-3 right-3 z-30 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white shadow-md uppercase tracking-wider">
                        <X size={12} strokeWidth={3} />
                        <span>Completed</span>
                    </div>
                </>
            )}

            <div className="flex flex-col gap-3.5 relative z-10">
                {/* Subject Header */}
                <div className="flex flex-col gap-2 pr-20">
                    <h4 className={`text-base sm:text-lg md:text-xl font-bold font-heading ${completed ? 'text-slate-600 dark:text-slate-300 line-through decoration-rose-500/70 decoration-2' : 'text-slate-900 dark:text-white'} leading-snug ${isTheory ? 'group-hover:text-purple-600 dark:group-hover:text-purple-400' : 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400'} transition-colors`}>
                        {exam.subject}
                    </h4>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {exam.location && exam.location !== 'TBD' && exam.location.trim().toLowerCase() !== (exam.panel || '').trim().toLowerCase() && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold ${badgeBg}`}>
                                <MapPin size={12} />
                                <span>{exam.location}</span>
                            </div>
                        )}
                        {exam.professor && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold ${badgeBg}`}>
                                <PersonIcon size={12} />
                                <span>{exam.professor}</span>
                            </div>
                        )}
                        {exam.panel && exam.panel !== 'Unknown' && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold ${badgeBg} opacity-90`}>
                                <span>
                                    {exam.professor ? exam.panel.split(' ').slice(0, 2).join(' ') : exam.panel}
                                </span>
                            </div>
                        )}
                        {extraFields.map(key => (
                            <div key={key} className={`flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold ${badgeBg} opacity-80`}>
                                <span className="opacity-70 font-normal">{formatKeyName(key)}: </span>
                                <span>{exam[key]}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Date & Time Badges */}
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                    <div className={`flex items-center gap-1.5 ${completed ? 'bg-rose-100/60 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/20' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/5'} px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border`}>
                        <Calendar size={13} className={accentColor} />
                        <span>{exam.date ? exam.date.replace(/^Day \d+:\s*/, '') : 'NA'}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${completed ? 'bg-rose-100/60 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/20' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/5'} px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border`}>
                        <Clock size={13} className={accentColor} />
                        <span>{exam.time || 'NA'}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const ScheduleCard = ({ student }) => {
    const [isCopied, setIsCopied] = useState(false);

    if (!student) return null;

    const theoryExams = student.theory || [];
    const practicalExams = student.practical || [];

    const handleExport = () => {
        const icsContent = generateICS(student);
        downloadICS(`${student.name.replace(/\s+/g, '_')}_Schedule.ics`, icsContent);
    };

    const handleCopyRoll = () => {
        navigator.clipboard.writeText(student.rollNo);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        show: {
            opacity: 1,
            y: 0,
            transition: { staggerChildren: 0.08 }
        }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full space-y-6 sm:space-y-8"
        >
            {/* Student Header Card - Big Prominent Roll Number & Compact Calendar Pill */}
            <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#0c101c]/90 border border-slate-200/90 dark:border-white/10 p-5 sm:p-8 backdrop-blur-2xl shadow-xl dark:shadow-none transition-all duration-300">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500" />
                <div className="absolute top-0 right-0 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6 relative z-10">
                    <div className="text-center md:text-left space-y-3 w-full md:w-auto">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 sm:gap-3">
                            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold font-heading text-slate-900 dark:text-white tracking-tight leading-tight">
                                {student.name}
                            </h2>
                            {student.batch && (
                                <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                    Batch {student.batch}
                                </span>
                            )}
                        </div>

                        {/* PROMINENT HUGE ROLL NUMBER BADGE */}
                        <div className="inline-flex items-center gap-2.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-emerald-100/80 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-mono text-xl sm:text-2xl md:text-3xl font-black tracking-wider shadow-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                            <span>{student.rollNo}</span>
                            <button
                                onClick={handleCopyRoll}
                                className="ml-1 p-1.5 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 rounded-xl transition-colors text-emerald-700 dark:text-emerald-400 active:scale-95"
                                title="Copy Roll Number"
                            >
                                {isCopied ? <Check size={18} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* DISCREET COMPACT CALENDAR BUTTON */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleExport}
                        className="px-3.5 py-2 sm:px-4 sm:py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs whitespace-nowrap active:scale-95 self-center md:self-start"
                        title="Export schedule to calendar file"
                    >
                        <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Export Calendar (.ics)</span>
                    </motion.button>
                </div>
            </div>

            {/* Theory vs Practical Split Layout */}
            <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-start">
                {/* Theory Section */}
                <div className="flex flex-col h-full bg-white dark:bg-[#0c101c]/50 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-white/10 backdrop-blur-xl shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between mb-5 sm:mb-6 pb-3.5 sm:pb-4 border-b border-slate-200/60 dark:border-white/5">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="p-2 sm:p-2.5 bg-purple-100 dark:bg-purple-500/10 rounded-2xl border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 flex-shrink-0">
                                <BookOpen size={20} className="sm:w-5 sm:h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">Theory Schedule</h3>
                                <p className="text-[11px] sm:text-xs text-slate-500 font-mono">Classroom & Written Exams</p>
                            </div>
                        </div>
                        <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 flex-shrink-0">
                            {theoryExams.length} Papers
                        </span>
                    </div>

                    <div className="space-y-3.5 sm:space-y-4 flex-1">
                        {theoryExams.length === 0 ? (
                            <div className="h-full min-h-[160px] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-white/10 text-center text-slate-500 dark:text-slate-400">
                                <AlertCircle className="mb-2 opacity-40 w-8 h-8 sm:w-10 sm:h-10" />
                                <p className="text-xs sm:text-sm">No theory exams scheduled.</p>
                            </div>
                        ) : (
                            theoryExams.map((exam, idx) => (
                                <ExamItem key={idx} exam={exam} type="theory" />
                            ))
                        )}
                    </div>
                </div>

                {/* Practical Section */}
                <div className="flex flex-col h-full bg-white dark:bg-[#0c101c]/50 rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-white/10 backdrop-blur-xl shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between mb-5 sm:mb-6 pb-3.5 sm:pb-4 border-b border-slate-200/60 dark:border-white/5">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="p-2 sm:p-2.5 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                <Code size={20} className="sm:w-5 sm:h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">Practical Schedule</h3>
                                <p className="text-[11px] sm:text-xs text-slate-500 font-mono">Lab Vivas & Projects</p>
                            </div>
                        </div>
                        <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex-shrink-0">
                            {practicalExams.length} Labs
                        </span>
                    </div>

                    <div className="space-y-3.5 sm:space-y-4 flex-1">
                        {practicalExams.length === 0 ? (
                            <div className="h-full min-h-[160px] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-white/10 text-center text-slate-500 dark:text-slate-400">
                                <AlertCircle className="mb-2 opacity-40 w-8 h-8 sm:w-10 sm:h-10" />
                                <p className="text-xs sm:text-sm">No practical exams scheduled.</p>
                            </div>
                        ) : (
                            practicalExams.map((exam, idx) => (
                                <ExamItem key={idx} exam={exam} type="practical" />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Calendar Tutorial Card */}
            <motion.div
                variants={itemVariants}
                className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#0c101c]/90 border border-slate-200/90 dark:border-white/10 p-5 sm:p-8 backdrop-blur-2xl shadow-xl dark:shadow-none"
            >
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
                    <div className="space-y-3 text-center md:text-left w-full md:max-w-lg">
                        <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600 dark:text-emerald-500 font-bold text-base sm:text-lg">
                            <Calendar size={20} />
                            <span>Calendar Sync Workflow</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            Optional calendar sync for Google Calendar, Apple Calendar, or Outlook.
                        </p>
                        <ol className="text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1.5 list-decimal list-inside bg-slate-50 dark:bg-slate-900/60 p-3.5 sm:p-4 rounded-2xl border border-slate-200/60 dark:border-white/5">
                            <li>Click <strong>Export Calendar</strong> button</li>
                            <li>Open the downloaded <code className="text-emerald-600 dark:text-emerald-400">.ics</code> file</li>
                            <li>Confirm <strong>Add All</strong> in your calendar app</li>
                        </ol>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleExport}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 text-xs active:scale-95"
                    >
                        <Download size={14} />
                        <span>Export (.ics)</span>
                    </motion.button>
                </div>

                {/* Tutorial Video Frame */}
                <div className="mt-6 sm:mt-8 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-xl bg-slate-900">
                    <video
                        src={tutVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity"
                    />
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ScheduleCard;
