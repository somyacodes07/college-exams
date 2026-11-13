import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Calendar, Clock, MapPin, User as PersonIcon, Check, Tag, ChevronDown } from 'lucide-react';
import { sortExams, isExamCompleted, cleanDateLabel } from '../utils/dateUtils';

const chip = 'flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20';

const AtktItem = ({ exam }) => {
    const completed = isExamCompleted(exam);
    const dateLabel = cleanDateLabel(exam.date);
    const meta = completed
        ? 'bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20'
        : 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/5';

    return (
        <div className={`relative bg-white dark:bg-[#0f1422]/90 text-left rounded-2xl p-4 sm:p-5 border transition-all duration-200 ${completed
            ? 'border-emerald-500/20 opacity-85'
            : 'border-rose-200/80 dark:border-rose-500/20 hover:border-rose-400/60'}`}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                    <h4 className={`text-base sm:text-lg font-bold font-heading leading-snug flex-1 min-w-0 break-words ${completed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                        {exam.subject}
                    </h4>
                    {completed && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 uppercase tracking-wider flex-shrink-0">
                            <Check size={12} className="stroke-[3]" />
                            <span>Completed</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {exam.examType && (
                        <div className={chip}><Tag size={12} /><span>{exam.examType}</span></div>
                    )}
                    {exam.semester && (
                        <div className={`${chip} opacity-90`}><span>{exam.semester}{exam.batch ? ` · ${exam.batch}` : ''}</span></div>
                    )}
                    {exam.classroom && (
                        <div className={chip}><MapPin size={12} /><span>{exam.classroom}</span></div>
                    )}
                    {exam.faculty && (
                        <div className={chip}><PersonIcon size={12} /><span>{exam.faculty}</span></div>
                    )}
                    {exam.subjectCode && (
                        <div className={`${chip} opacity-80`}>
                            <span className="opacity-70 font-normal">Subject Code:</span><span>{exam.subjectCode}</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-mono">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border ${meta}`}>
                        <Calendar size={13} className="text-rose-600 dark:text-rose-400" />
                        <span>{dateLabel || 'Date to be announced'}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border ${meta}`}>
                        <Clock size={13} className="text-rose-600 dark:text-rose-400" />
                        <span>{exam.time || 'Time to be announced'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/** Re-exam (ATKT) schedule card. Renders nothing for students without ATKT. */
const PREVIEW_COUNT = 4;

const AtktSection = ({ exams }) => {
    const [showAll, setShowAll] = useState(false);
    // Upcoming first (soonest at the top), completed ones after
    const sorted = useMemo(() => {
        const list = sortExams(exams || []);
        return [...list.filter((e) => !isExamCompleted(e)), ...list.filter((e) => isExamCompleted(e))];
    }, [exams]);
    if (sorted.length === 0) return null;

    const pending = sorted.filter((e) => !isExamCompleted(e)).length;
    const subjects = new Set(sorted.map((e) => e.subjectCode || e.subject)).size;
    const visible = showAll ? sorted : sorted.slice(0, PREVIEW_COUNT);
    const hidden = sorted.length - visible.length;

    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            aria-label="ATKT re-exam schedule"
            className="flex flex-col bg-white dark:bg-[#0c101c]/50 rounded-3xl p-5 sm:p-6 border border-rose-200/90 dark:border-rose-500/20 backdrop-blur-xl shadow-sm dark:shadow-none"
        >
            <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6 pb-3.5 sm:pb-4 border-b border-slate-200/60 dark:border-white/5">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="p-2 sm:p-2.5 bg-rose-100 dark:bg-rose-500/10 rounded-2xl border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex-shrink-0">
                        <RotateCcw size={20} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">ATKT Re-exams</h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 font-mono">
                            {subjects} {subjects === 1 ? 'subject' : 'subjects'} · {pending > 0 ? `${pending} upcoming` : 'all completed'}
                        </p>
                    </div>
                </div>
                <span className="text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 flex-shrink-0">
                    {sorted.length} {sorted.length === 1 ? 'Exam' : 'Exams'}
                </span>
            </div>

            <div className="grid gap-3.5 sm:gap-4 lg:grid-cols-2">
                {visible.map((exam, idx) => (
                    <AtktItem key={`${exam.subjectCode}-${exam.examType}-${exam.date}-${exam.time}-${idx}`} exam={exam} />
                ))}
            </div>

            {sorted.length > PREVIEW_COUNT && (
                <button
                    onClick={() => setShowAll((v) => !v)}
                    aria-expanded={showAll}
                    className="mt-4 w-full flex items-center justify-center gap-2 min-h-[44px] rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/5 text-rose-700 dark:text-rose-300 text-sm font-semibold active:scale-[0.99] transition"
                >
                    {showAll ? 'Show less' : `Show all ${sorted.length} re-exams (${hidden} more)`}
                    <ChevronDown size={16} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
                </button>
            )}
        </motion.section>
    );
};

export default AtktSection;
