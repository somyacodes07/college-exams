import React, { useState, useMemo, useEffect } from 'react';
import { CalendarPlus, Copy, Check, ChevronDown, Share2 } from 'lucide-react';
import { generateICS, downloadICS } from '../utils/icsGenerator';
import {
    isExamCompleted, sortExams, relativeDayLabel, displayTime, formatCountdown,
    examDateParts as dateParts, findNextExam as findNext,
} from '../utils/dateUtils';
import { copyText, toast } from '../utils/copy';
import tutVideo from '../assets/tut.mp4';
import AtktSection from './AtktSection';
import { SheetSkeleton } from './ScheduleSkeleton';
import { useAtkt } from '../hooks/useAtkt';
import { KIND, ROW_GRID } from './kind';
import PrintButton from './PrintButton';

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

/** Short-lived confirmation state for a button. */
const useFlash = () => {
    const [flash, setFlash] = useState(null);
    useEffect(() => {
        if (!flash) return undefined;
        const t = setTimeout(() => setFlash(null), 2200);
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
        <li className={`${ROW_GRID} ${showDate ? 'pt-3 lg:pt-4 border-t border-rule first:border-t-0' : 'pt-1'} pb-1`}>
            <div className="tnum leading-tight pt-0.5">
                {showDate && (
                    <>
                        <div className={`text-[13px] lg:text-[15px] ${isToday ? 'font-bold text-ink' : 'text-ink-faint'}`}>{isToday ? 'Today' : weekday}</div>
                        <div className={`text-[16px] lg:text-[19px] font-bold ${completed ? 'text-ink-faint' : 'text-ink'}`}>{day}</div>
                    </>
                )}
            </div>
            <div className={`min-w-0 border-l-[3px] pl-3 lg:pl-4 py-0.5 pb-2 ${KIND[kind].bar} ${completed ? 'opacity-55' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                    <p className={`text-[16px] lg:text-[19px] font-bold leading-snug break-words ${completed ? 'text-ink-soft' : 'text-ink'}`}>
                        {isNext ? <span className="highlight">{exam.subject}</span> : exam.subject}
                    </p>
                    {completed && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[13px] lg:text-[15px] text-ink-soft">
                            <Check size={14} strokeWidth={2.5} /> Done
                        </span>
                    )}
                </div>
                <p className="tnum mt-0.5 text-[15px] lg:text-[17px] text-ink-soft">
                    <span className="whitespace-nowrap">{exam.time ? displayTime(exam.time) : 'Time to be announced'}</span>
                    {showLocation && <span className="ml-3 font-semibold text-ink">{exam.location}</span>}
                </p>
                {(panel || hasValue(exam.professor) || extras.length > 0) && (
                    <p className="mt-0.5 text-[14px] lg:text-[15px] text-ink-faint flex flex-wrap gap-x-3">
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

const Sheet = ({ title, kind, note, exams, nextExam, emptyText, now, className = '', style }) => (
    <section style={style} className={`reveal bg-paper border border-rule rounded-xl px-4 sm:px-5 lg:px-6 pt-4 lg:pt-5 pb-2 print:border-0 print:px-0 ${className}`}>
        <div className={`flex items-baseline justify-between gap-3 pb-3 border-b-[3px] ${KIND[kind].rule}`}>
            <h3 className="text-[20px] lg:text-[24px] font-extrabold tracking-[-0.01em]">{title}</h3>
            <span className="text-[14px] lg:text-[15px] text-ink-faint tnum">{note}</span>
        </div>
        {exams.length === 0 ? (
            <p className="py-6 text-[15px] lg:text-[17px] text-ink-soft">{emptyText}</p>
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

const TABS = [
    { id: 'all', label: 'All', kind: null },
    { id: 'theory', label: 'Theory', kind: 'theory' },
    { id: 'practical', label: 'Practical', kind: 'practical' },
];

const badge = 'ml-1.5 inline-block min-w-[1.5rem] px-1.5 rounded-full text-[12px] lg:text-[13px] leading-[20px] font-bold tnum text-center';

const ScheduleCard = ({ student }) => {
    const now = useNow();
    const [rollCopied, setRollCopied] = useFlash();
    const [calendarDone, setCalendarDone] = useFlash();
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
    const atktFailed = atktStatus === 'error';

    const next = useMemo(() => {
        const pool = hasAtkt ? atktExams : [...theoryExams, ...practicalExams];
        return findNext(pool, now);
    }, [hasAtkt, atktExams, theoryExams, practicalExams, now]);

    const roll = student ? String(student.officialRollNo || student.rollNo) : '';

    const copyRoll = async () => {
        if (await copyText(roll, `Roll number ${roll} copied`)) setRollCopied(true);
    };

    // Keyboard shortcut: press C to copy the roll number (when not typing)
    useEffect(() => {
        if (!roll) return undefined;
        const onKey = (e) => {
            const tag = document.activeElement?.tagName;
            if (e.metaKey || e.ctrlKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'c' || e.key === 'C') {
                e.preventDefault();
                copyText(roll, `Roll number ${roll} copied`).then((ok) => ok && setRollCopied(true));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [roll, setRollCopied]);

    if (!student) return null;

    const allRegular = [...theoryExams, ...practicalExams];
    const doneCount = allRegular.filter((e) => isExamCompleted(e, now)).length;
    const canHideDone = !hasAtkt && doneCount > 0 && doneCount < allRegular.length;
    const visible = (list) => (hideDone && canHideDone ? list.filter((e) => !isExamCompleted(e, now)) : list);

    const handleExport = () => {
        const icsContent = generateICS(hasAtkt
            ? { ...student, theory: [], practical: [], reexams: atktExams }
            : student);
        downloadICS(`${student.name.replace(/[^a-z0-9]+/gi, '_')}_Exams.ics`, icsContent);
        setCalendarDone(true);
        toast('Calendar file downloaded. Open it to add your exams.');
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/?roll=${encodeURIComponent(student.rollNo)}`;
        try {
            if (navigator.share) await navigator.share({ title: `${student.name}: exam schedule`, url });
            else await copyText(url, 'Link copied. Paste it anywhere to open this schedule.');
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
                {countdown && <span className="ml-2 whitespace-nowrap text-[0.9em] font-bold text-ink tnum">({countdown})</span>}
            </>
        );
    })();

    return (
        <div className="w-full space-y-4 sm:space-y-5 lg:space-y-6">
            {/* Admit-card style header */}
            <section className="reveal bg-paper border border-rule rounded-xl p-4 sm:p-6 lg:p-8 print:border-0 print:p-0" aria-label={`Schedule for ${student.name}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-[28px] sm:text-[40px] lg:text-[52px] font-extrabold leading-[1.05] tracking-[-0.025em] break-words">
                            {student.name}
                        </h2>
                        <div className="mt-3 lg:mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                            {/* The roll number is one big copy button: tap anywhere on it */}
                            <button
                                onClick={copyRoll}
                                className={`group inline-flex items-center gap-3 rounded-lg border px-3 lg:px-4 h-12 lg:h-14 transition-colors ${rollCopied ? 'pop border-practical bg-practical-tint' : 'border-rule hover:border-ink-faint bg-desk/60'}`}
                                aria-label={`Copy roll number ${roll}`}
                                title="Copy roll number (C)"
                            >
                                <span className="text-[13px] lg:text-[15px] text-ink-faint">Roll no.</span>
                                <span className="tnum text-[20px] lg:text-[26px] font-extrabold tracking-[0.01em] text-ink">{roll}</span>
                                <span className={`inline-flex items-center gap-1 text-[13px] lg:text-[15px] font-bold ${rollCopied ? 'text-practical' : 'text-ink-soft group-hover:text-ink'}`}>
                                    {rollCopied ? <><Check size={16} strokeWidth={2.5} /> Copied</> : <><Copy size={15} /> Copy</>}
                                </span>
                            </button>
                            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[15px] lg:text-[17px]">
                                {student.batch && (<div className="flex gap-2"><dt className="text-ink-faint">Batch</dt><dd className="tnum font-semibold">{student.batch}</dd></div>)}
                                {student.cohort && (<div className="flex gap-2"><dt className="text-ink-faint">Cohort</dt><dd className="font-semibold">{student.cohort}</dd></div>)}
                            </dl>
                        </div>
                        {student.rollPending && (
                            <p className="mt-2 text-[14px] lg:text-[16px] text-ink-soft">
                                Your roll number is being verified with the college. The schedule below is correct.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center gap-2 h-11 lg:h-12 px-4 lg:px-5 rounded-md bg-ink text-paper font-bold text-[15px] lg:text-[16px] hover:opacity-90 active:opacity-80 transition-opacity"
                        >
                            {calendarDone ? <><Check size={18} /> File downloaded</> : <><CalendarPlus size={18} /> Add to calendar</>}
                        </button>
                        <button
                            onClick={handleShare}
                            className="h-11 w-11 lg:h-12 lg:w-12 inline-flex items-center justify-center rounded-md border border-rule text-ink-soft hover:text-ink hover:border-ink-faint transition-colors"
                            aria-label="Share schedule link"
                            title="Share schedule link"
                        >
                            <Share2 size={18} />
                        </button>
                    </div>
                </div>

                {nextLine && (
                    <p className={`mt-4 lg:mt-5 rounded-lg px-3.5 lg:px-4 py-2.5 lg:py-3 text-[16px] lg:text-[19px] leading-relaxed ${next ? 'bg-mark-tint' : 'bg-desk'}`}>{nextLine}</p>
                )}
            </section>

            {atktFailed && (
                <p className="text-[14px] lg:text-[16px] text-ink-soft" role="status">
                    Couldn't check for re-exams right now. Trying again in a few seconds.
                </p>
            )}

            {atktLoading ? (
                <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
                    <SheetSkeleton />
                    <SheetSkeleton className="hidden lg:block" />
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
                                const activeBadge = t.kind ? `${KIND[t.kind].tint} text-ink` : 'bg-desk text-ink';
                                return (
                                    <button
                                        key={t.id}
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setActiveTab(t.id)}
                                        className={`-mb-px h-11 px-2.5 sm:px-4 text-[15px] font-bold whitespace-nowrap border-b-[3px] transition-colors ${active ? `${activeBorder} text-ink` : 'border-transparent text-ink-faint hover:text-ink-soft'}`}
                                    >
                                        {t.label}<span className={`${badge} ${active ? activeBadge : 'bg-desk text-ink-faint'}`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="ml-auto mb-1 lg:mb-0 flex items-center gap-1">
                            {canHideDone && (
                                <label className="inline-flex items-center gap-2 h-9 px-2 text-[14px] lg:text-[15px] text-ink-soft cursor-pointer select-none whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        checked={hideDone}
                                        onChange={(e) => setHideDone(e.target.checked)}
                                        className="w-4 h-4 accent-[var(--ink)]"
                                    />
                                    Hide finished
                                </label>
                            )}
                            <PrintButton />
                        </div>
                    </div>

                    <div key={`${activeTab}-${hideDone}`} className="swap grid lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 items-start">
                        <Sheet
                            title="Theory"
                            kind="theory"
                            note={`${theoryExams.length} ${theoryExams.length === 1 ? 'paper' : 'papers'}`}
                            exams={visible(theoryExams)}
                            nextExam={next?.exam}
                            emptyText={theoryExams.length ? 'All theory papers are done.' : 'No theory exams scheduled.'}
                            now={now}
                            style={{ animationDelay: '60ms' }}
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
                            style={{ animationDelay: '120ms' }}
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
                    className="inline-flex items-center gap-1.5 text-[15px] lg:text-[17px] font-semibold text-ink-soft hover:text-ink rounded-md"
                >
                    How to add this to your phone's calendar
                    <ChevronDown size={16} className={`transition-transform ${showHelp ? 'rotate-180' : ''}`} />
                </button>
                {showHelp && (
                    <div className="swap mt-3 bg-paper border border-rule rounded-xl p-4 sm:p-5 max-w-2xl">
                        <ol className="list-decimal pl-5 space-y-1 text-[15px] lg:text-[17px] text-ink-soft">
                            <li>Tap <strong className="text-ink">Add to calendar</strong> above.</li>
                            <li>Open the downloaded file.</li>
                            <li>Choose <strong className="text-ink">Add all</strong> in Google Calendar, Apple Calendar or Outlook.</li>
                        </ol>
                        <p className="mt-2 text-[14px] lg:text-[15px] text-ink-faint">You'll get a reminder a day before and an hour before each exam.</p>
                        <video src={tutVideo} controls playsInline preload="none" className="mt-4 w-full rounded-lg border border-rule bg-ink" />
                    </div>
                )}
            </section>
        </div>
    );
};

export default ScheduleCard;
