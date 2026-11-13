import React, { useState, useMemo, useEffect } from 'react';
import { CalendarPlus, Copy, Check, ChevronDown, Share2, Printer } from 'lucide-react';
import { generateICS, downloadICS } from '../utils/icsGenerator';
import {
    isExamCompleted, sortExams, relativeDayLabel, displayTime, formatCountdown,
    examDateParts as dateParts, findNextExam as findNext,
} from '../utils/dateUtils';
import tutVideo from '../assets/tut.mp4';
import AtktSection from './AtktSection';
import { useAtkt } from '../hooks/useAtkt';
import { KIND } from './kind';

const STANDARD_FIELDS = ['date', 'subject', 'time', 'location', 'type', 'panel', 'professor', '_id', '__v', 'id'];

const hasValue = (v) => v && v !== 'TBD' && v !== 'Unknown' && String(v).trim() !== '';

const formatKeyName = (key) => {
    const result = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    return result.charAt(0).toUpperCase() + result.slice(1);
};

/** Re-renders every minute so "Done" states and the countdown stay current. */
const useNow = () => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60 * 1000);
        return () => clearInterval(id);
    }, []);
    return now;
};

/** Short-lived confirmation for a button ("Copied", "File downloaded"). */
const useFlash = () => {
    const [flash, setFlash] = useState(null);
    useEffect(() => {
        if (!flash) return undefined;
        const t = setTimeout(() => setFlash(null), 2500);
        return () => clearTimeout(t);
    }, [flash]);
    return [flash, setFlash];
};

const TimetableRow = ({ exam, kind, isNext, showDate, now }) => {
    const completed = isExamCompleted(exam, now);
    const { weekday, day, parsed } = dateParts(exam);
    const isToday = parsed ? relativeDayLabel(parsed.dayKey, now) === 'Today' : false;

    const extras = Object.keys(exam).filter((key) => {
        if (STANDARD_FIELDS.includes(key) || key.startsWith('_')) return false;
        if (!exam[key] || typeof exam[key] === 'object') return false;
        return !key.toLowerCase().includes('noofstudent');
    });
    const showLocation = hasValue(exam.location)
        && exam.location.trim().toLowerCase() !== (exam.panel || '').trim().toLowerCase();
    const panel = hasValue(exam.panel)
        ? (exam.professor ? exam.panel.split(' ').slice(0, 2).join(' ') : exam.panel)
        : null;

    return (
        <li className={`grid grid-cols-[4.75rem_1fr] sm:grid-cols-[5.5rem_1fr] gap-x-3 ${showDate ? 'pt-3 border-t border-rule first:border-t-0' : 'pt-1'} pb-1`}>
            <div className="tnum leading-tight pt-0.5">
                {showDate && (
                    <>
                        <div className={`text-[13px] ${isToday ? 'font-bold text-ink' : 'text-ink-faint'}`}>{isToday ? 'Today' : weekday}</div>
                        <div className={`text-[16px] font-bold ${completed ? 'text-ink-faint' : 'text-ink'}`}>{day}</div>
                    </>
                )}
            </div>
            <div className={`min-w-0 border-l-[3px] pl-3 py-0.5 pb-2 ${KIND[kind].bar} ${completed ? 'opacity-55' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                    <p className={`text-[16px] font-bold leading-snug break-words ${completed ? 'text-ink-soft' : 'text-ink'}`}>
                        {isNext ? <span className="highlight">{exam.subject}</span> : exam.subject}
                    </p>
                    {completed && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[13px] text-ink-soft">
                            <Check size={14} strokeWidth={2.5} /> Done
                        </span>
                    )}
                </div>
                <p className="tnum mt-0.5 text-[15px] text-ink-soft">
                    <span className="whitespace-nowrap">{exam.time ? displayTime(exam.time) : 'Time to be announced'}</span>
                    {showLocation && <span className="ml-3 font-semibold text-ink">{exam.location}</span>}
                </p>
                {(panel || hasValue(exam.professor) || extras.length > 0) && (
                    <p className="mt-0.5 text-[14px] text-ink-faint flex flex-wrap gap-x-3">
                        {panel && <span>{panel}</span>}
                        {hasValue(exam.professor) && <span>{exam.professor}</span>}
                        {extras.map((key) => <span key={key} className="tnum">{formatKeyName(key)} {exam[key]}</span>)}
                    </p>
                )}
            </div>
        </li>
    );
};

const dayKeyOf = (exam) => dateParts(exam).parsed?.dayKey || `raw-${exam.date}`;

const Sheet = ({ title, kind, note, exams, nextExam, emptyText, now, className = '' }) => {
    return (
        <section className={`bg-paper border border-rule rounded-xl px-4 sm:px-5 pt-4 pb-2 print:border-0 print:px-0 ${className}`}>
            <div className={`flex items-baseline justify-between gap-3 pb-3 border-b-[3px] ${KIND[kind].rule}`}>
                <h3 className="text-[20px] font-extrabold tracking-[-0.01em]">{title}</h3>
                <span className="text-[14px] text-ink-faint tnum">{note}</span>
            </div>
            {exams.length === 0 ? (
                <p className="py-6 text-[15px] text-ink-soft">{emptyText}</p>
            ) : (
                <ol className="pt-1">
                    {exams.map((exam, idx) => {
                        // A date is printed once per day, like a real timetable
                        const showDate = idx === 0 || dayKeyOf(exams[idx - 1]) !== dayKeyOf(exam);
                        return <TimetableRow key={idx} exam={exam} kind={kind} isNext={nextExam === exam} showDate={showDate} now={now} />;
                    })}
                </ol>
            )}
        </section>
    );
};

const TABS = [
    { id: 'all', label: 'All', kind: null },
    { id: 'theory', label: 'Theory', kind: 'theory' },
    { id: 'practical', label: 'Practical', kind: 'practical' },
];

const iconButton = 'h-11 w-11 inline-flex items-center justify-center rounded-md border border-rule text-ink-soft hover:text-ink hover:border-ink-faint transition-colors';

const ScheduleCard = ({ student }) => {
    const now = useNow();
    const [rollFlash, flashRoll] = useFlash();
    const [actionFlash, flashAction] = useFlash();
    const [activeTab, setActiveTab] = useState('all');
    const [hideDone, setHideDone] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Chronological order (sheets list exams in arbitrary order)
    const theoryExams = useMemo(() => sortExams(student?.theory || []), [student]);
    const practicalExams = useMemo(() => sortExams(student?.practical || []), [student]);
    const { exams: atktExams, status: atktStatus } = useAtkt(student?.rollNo);
    // Students with ATKT see only their re-exams; their finished schedule is hidden
    const hasAtkt = atktExams.length > 0;
    const atktLoading = atktStatus === 'loading';

    const next = useMemo(() => {
        const pool = hasAtkt ? atktExams : [...theoryExams, ...practicalExams];
        return findNext(pool, now);
    }, [hasAtkt, atktExams, theoryExams, practicalExams, now]);

    if (!student) return null;

    const roll = student.officialRollNo || student.rollNo;
    const allRegular = [...theoryExams, ...practicalExams];
    const doneCount = allRegular.filter((e) => isExamCompleted(e, now)).length;
    const canHideDone = !hasAtkt && doneCount > 0 && doneCount < allRegular.length;
    const visible = (list) => (hideDone && canHideDone ? list.filter((e) => !isExamCompleted(e, now)) : list);

    const handleExport = () => {
        const icsContent = generateICS(hasAtkt
            ? { ...student, theory: [], practical: [], reexams: atktExams }
            : student);
        downloadICS(`${student.name.replace(/[^a-z0-9]+/gi, '_')}_Exams.ics`, icsContent);
        flashAction('calendar');
    };

    const handleCopyRoll = async () => {
        try {
            await navigator.clipboard.writeText(roll);
            flashRoll('copied');
        } catch {
            /* clipboard unavailable (e.g. non-HTTPS) */
        }
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/?roll=${encodeURIComponent(student.rollNo)}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: `${student.name}: exam schedule`, url });
            } else {
                await navigator.clipboard.writeText(url);
                flashAction('link');
            }
        } catch {
            /* share sheet dismissed */
        }
    };

    const nextLine = (() => {
        if (atktLoading) return null;
        if (!next) {
            const total = hasAtkt ? atktExams.length : allRegular.length;
            return <span className="text-ink-soft">{total > 0 ? 'All your exams are done.' : 'No exams scheduled yet.'}</span>;
        }
        const { weekday, day } = dateParts(next.exam);
        const rel = relativeDayLabel(next.parsed.dayKey, now);
        const nearDay = rel === 'Today' || rel === 'Tomorrow';
        const when = nearDay ? rel.toLowerCase() : `${weekday} ${day}`;
        const start = String(next.exam.time || '').split(/\s*[-–—]\s*/)[0];
        const room = hasValue(next.exam.location) ? next.exam.location : next.exam.classroom;
        const startsIn = next.parsed.start.getTime() - now;
        const countdown = startsIn <= 0 ? 'happening now' : rel === 'Today' ? `in ${formatCountdown(startsIn)}` : nearDay ? null : rel.toLowerCase();
        return (
            <>
                <span className="text-ink-soft">Next: </span>
                <span className="highlight font-bold">{next.exam.subject}</span>
                <span className="text-ink-soft tnum">, {when}{start ? ` at ${start}` : ''}{hasValue(room) ? `, ${room}` : ''}</span>
                {countdown && <span className="ml-2 whitespace-nowrap text-[14px] font-bold text-ink tnum">({countdown})</span>}
            </>
        );
    })();

    return (
        <div className="w-full space-y-4 sm:space-y-5">
            {/* Admit-card style header */}
            <section className="bg-paper border border-rule rounded-xl p-4 sm:p-6 print:border-0 print:p-0" aria-label={`Schedule for ${student.name}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-[28px] sm:text-[40px] font-extrabold leading-[1.05] tracking-[-0.025em] break-words">
                            {student.name}
                        </h2>
                        <dl className="mt-3 grid grid-cols-[auto_1fr] sm:flex sm:flex-wrap gap-x-4 gap-y-1 text-[15px]">
                            <dt className="text-ink-faint">Roll no.</dt>
                            <dd className="flex items-center gap-1 sm:mr-4">
                                <span className="tnum font-bold text-[17px] select-all">{roll}</span>
                                <button
                                    onClick={handleCopyRoll}
                                    className="h-8 px-2 inline-flex items-center gap-1 rounded-md text-[13px] text-ink-faint hover:text-ink hover:bg-desk print:hidden"
                                    aria-label="Copy roll number"
                                >
                                    {rollFlash ? <><Check size={15} /> Copied</> : <Copy size={15} />}
                                </button>
                            </dd>
                            {student.batch && (<><dt className="text-ink-faint">Batch</dt><dd className="tnum font-semibold sm:mr-4">{student.batch}</dd></>)}
                            {student.cohort && (<><dt className="text-ink-faint">Cohort</dt><dd className="font-semibold">{student.cohort}</dd></>)}
                        </dl>
                        {student.rollPending && (
                            <p className="mt-2 text-[14px] text-ink-soft">
                                Your roll number is being verified with the college. The schedule below is correct.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-ink text-paper font-bold text-[15px] hover:opacity-90 active:opacity-80 transition-opacity"
                        >
                            {actionFlash === 'calendar' ? <><Check size={18} /> File downloaded</> : <><CalendarPlus size={18} /> Add to calendar</>}
                        </button>
                        <button onClick={handleShare} className={iconButton} aria-label="Share schedule link" title="Share schedule link">
                            {actionFlash === 'link' ? <Check size={18} /> : <Share2 size={18} />}
                        </button>
                        <button onClick={() => window.print()} className={iconButton} aria-label="Print or save as PDF" title="Print or save as PDF">
                            <Printer size={18} />
                        </button>
                    </div>
                </div>
                {actionFlash === 'link' && <p className="mt-2 text-[14px] text-ink-soft print:hidden">Link copied. Paste it anywhere to open this schedule.</p>}

                {nextLine && <p className="mt-4 pt-4 border-t border-rule text-[16px] leading-relaxed">{nextLine}</p>}
            </section>

            {atktLoading ? (
                <div className="bg-paper border border-rule rounded-xl p-5 space-y-3" aria-label="Loading schedule">
                    <div className="h-5 w-32 rounded bg-desk" />
                    <div className="h-12 rounded bg-desk" />
                    <div className="h-12 rounded bg-desk" />
                </div>
            ) : hasAtkt ? (
                <AtktSection exams={atktExams} nextExam={next?.exam} now={now} />
            ) : (
                <>
                    <div className="flex items-end justify-between gap-3 border-b border-rule lg:border-b-0 print:hidden">
                        {/* Tabs on phones; both sheets side by side from lg */}
                        <div className="lg:hidden flex" role="tablist" aria-label="Exam type">
                            {TABS.map((t) => {
                                const count = t.id === 'all' ? allRegular.length : t.id === 'theory' ? theoryExams.length : practicalExams.length;
                                const active = activeTab === t.id;
                                const activeBorder = t.kind ? KIND[t.kind].rule : 'border-ink';
                                return (
                                    <button
                                        key={t.id}
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setActiveTab(t.id)}
                                        className={`-mb-px h-11 px-2.5 sm:px-4 text-[15px] font-bold whitespace-nowrap border-b-[3px] transition-colors ${active ? `${activeBorder} text-ink` : 'border-transparent text-ink-faint hover:text-ink-soft'}`}
                                    >
                                        {t.label}<span className={`ml-1.5 inline-block min-w-[1.5rem] px-1.5 rounded-full text-[12px] leading-[20px] font-bold tnum text-center ${active ? 'bg-desk text-ink' : 'bg-desk text-ink-faint'}`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {canHideDone && (
                            <label className="ml-auto mb-2.5 lg:mb-0 inline-flex items-center gap-2 text-[14px] text-ink-soft cursor-pointer select-none whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={hideDone}
                                    onChange={(e) => setHideDone(e.target.checked)}
                                    className="w-4 h-4 accent-[var(--ink)]"
                                />
                                Hide finished
                            </label>
                        )}
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 items-start">
                        <Sheet
                            title="Theory"
                            kind="theory"
                            note={`${theoryExams.length} ${theoryExams.length === 1 ? 'paper' : 'papers'}`}
                            exams={visible(theoryExams)}
                            nextExam={next?.exam}
                            emptyText={theoryExams.length ? 'All theory papers are done.' : 'No theory exams scheduled.'}
                            now={now}
                            className={activeTab === 'practical' ? 'hidden lg:block print:block' : ''}
                        />
                        <Sheet
                            title="Practical"
                            kind="practical"
                            note={`${practicalExams.length} ${practicalExams.length === 1 ? 'slot' : 'slots'}`}
                            exams={visible(practicalExams)}
                            nextExam={next?.exam}
                            emptyText={practicalExams.length ? 'All practicals are done.' : 'No practical exams scheduled.'}
                            now={now}
                            className={activeTab === 'theory' ? 'hidden lg:block print:block' : ''}
                        />
                    </div>
                </>
            )}

            {/* Calendar help: one quiet line, details on demand */}
            <section className="print:hidden">
                <button
                    onClick={() => setShowHelp((v) => !v)}
                    aria-expanded={showHelp}
                    className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-soft hover:text-ink rounded-md"
                >
                    How to add this to your phone's calendar
                    <ChevronDown size={16} className={`transition-transform ${showHelp ? 'rotate-180' : ''}`} />
                </button>
                {showHelp && (
                    <div className="mt-3 bg-paper border border-rule rounded-xl p-4 sm:p-5 max-w-2xl">
                        <ol className="list-decimal pl-5 space-y-1 text-[15px] text-ink-soft">
                            <li>Tap <strong className="text-ink">Add to calendar</strong> above.</li>
                            <li>Open the downloaded file.</li>
                            <li>Choose <strong className="text-ink">Add all</strong> in Google Calendar, Apple Calendar or Outlook.</li>
                        </ol>
                        <p className="mt-2 text-[14px] text-ink-faint">You'll get a reminder a day before and an hour before each exam.</p>
                        <video src={tutVideo} controls playsInline preload="none" className="mt-4 w-full rounded-lg border border-rule bg-ink" />
                    </div>
                )}
            </section>
        </div>
    );
};

export default ScheduleCard;
