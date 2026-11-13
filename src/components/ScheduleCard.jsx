import React, { useState, useMemo } from 'react';
import { CalendarPlus, Copy, Check, ChevronDown } from 'lucide-react';
import { generateICS, downloadICS } from '../utils/icsGenerator';
import { isExamCompleted, sortExams, relativeDayLabel, displayTime, examDateParts as dateParts, findNextExam as findNext } from '../utils/dateUtils';
import tutVideo from '../assets/tut.mp4';
import AtktSection from './AtktSection';
import { useAtkt } from '../hooks/useAtkt';

const STANDARD_FIELDS = ['date', 'subject', 'time', 'location', 'type', 'panel', 'professor', '_id', '__v', 'id'];

const hasValue = (v) => v && v !== 'TBD' && v !== 'Unknown' && String(v).trim() !== '';

const formatKeyName = (key) => {
    const result = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    return result.charAt(0).toUpperCase() + result.slice(1);
};

const TimetableRow = ({ exam, isNext }) => {
    const completed = isExamCompleted(exam);
    const { weekday, day, parsed } = dateParts(exam);
    const rel = parsed ? relativeDayLabel(parsed.dayKey) : '';
    const isToday = rel === 'Today';

    const extras = Object.keys(exam).filter((key) => {
        if (STANDARD_FIELDS.includes(key) || key.startsWith('_')) return false;
        if (!exam[key] || typeof exam[key] === 'object') return false;
        if (key.toLowerCase().includes('noofstudent')) return false;
        return true;
    });
    const showLocation = hasValue(exam.location)
        && exam.location.trim().toLowerCase() !== (exam.panel || '').trim().toLowerCase();
    const panel = hasValue(exam.panel)
        ? (exam.professor ? exam.panel.split(' ').slice(0, 2).join(' ') : exam.panel)
        : null;

    return (
        <li className={`grid grid-cols-[4.75rem_1fr] sm:grid-cols-[5.5rem_1fr] gap-x-3 py-3.5 border-t border-rule first:border-t-0 ${completed ? 'text-ink-faint' : ''}`}>
            <div className="tnum leading-tight">
                <div className={`text-[13px] ${isToday ? 'font-bold text-ink' : 'text-ink-faint'}`}>{isToday ? 'Today' : weekday}</div>
                <div className={`text-[16px] font-bold ${completed ? 'text-ink-faint' : 'text-ink'}`}>{day}</div>
            </div>
            <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <p className={`text-[16px] font-bold leading-snug break-words ${completed ? 'text-ink-faint' : 'text-ink'}`}>
                        {isNext ? <span className="highlight">{exam.subject}</span> : exam.subject}
                    </p>
                    {completed && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[13px] text-ink-faint">
                            <Check size={14} strokeWidth={2.5} /> Done
                        </span>
                    )}
                </div>
                <p className={`tnum mt-0.5 text-[15px] ${completed ? 'text-ink-faint' : 'text-ink-soft'}`}>
                    {exam.time ? displayTime(exam.time) : 'Time to be announced'}
                    {showLocation && <span className={`ml-3 font-semibold ${completed ? '' : 'text-ink'}`}>{exam.location}</span>}
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

const Sheet = ({ title, note, exams, nextExam, emptyText, className = '' }) => (
    <section className={`bg-paper border border-rule rounded-xl px-4 sm:px-5 pt-4 pb-1.5 ${className}`}>
        <div className="flex items-baseline justify-between gap-3 pb-3 border-b-2 border-ink">
            <h3 className="text-[20px] font-extrabold tracking-[-0.01em]">{title}</h3>
            <span className="text-[14px] text-ink-faint tnum">{note}</span>
        </div>
        {exams.length === 0 ? (
            <p className="py-6 text-[15px] text-ink-soft">{emptyText}</p>
        ) : (
            <ol>
                {exams.map((exam, idx) => (
                    <TimetableRow key={idx} exam={exam} isNext={nextExam === exam} />
                ))}
            </ol>
        )}
    </section>
);

const TABS = [
    { id: 'all', label: 'All' },
    { id: 'theory', label: 'Theory' },
    { id: 'practical', label: 'Practical' },
];

const ScheduleCard = ({ student }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
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
        return findNext(pool);
    }, [hasAtkt, atktExams, theoryExams, practicalExams]);

    if (!student) return null;

    const roll = student.officialRollNo || student.rollNo;

    const handleExport = () => {
        const icsContent = generateICS(hasAtkt
            ? { ...student, theory: [], practical: [], reexams: atktExams }
            : student);
        downloadICS(`${student.name.replace(/[^a-z0-9]+/gi, '_')}_Exams.ics`, icsContent);
    };

    const handleCopyRoll = async () => {
        try {
            await navigator.clipboard.writeText(roll);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch {
            /* clipboard unavailable (e.g. non-HTTPS) */
        }
    };

    const nextLine = (() => {
        if (atktLoading) return null;
        if (!next) {
            const total = hasAtkt ? atktExams.length : theoryExams.length + practicalExams.length;
            return <span className="text-ink-soft">{total > 0 ? 'All your exams are done.' : 'No exams scheduled yet.'}</span>;
        }
        const { weekday, day } = dateParts(next.exam);
        const rel = relativeDayLabel(next.parsed.dayKey);
        const when = rel === 'Today' || rel === 'Tomorrow' ? rel : `${weekday} ${day}`;
        const start = String(next.exam.time || '').split(/\s*[-–—]\s*/)[0];
        const room = next.exam.location && hasValue(next.exam.location) ? next.exam.location : next.exam.classroom;
        return (
            <>
                <span className="text-ink-soft">Next: </span>
                <span className="highlight font-bold">{next.exam.subject}</span>
                <span className="text-ink-soft tnum">, {when}{start ? ` at ${start}` : ''}{hasValue(room) ? `, ${room}` : ''}</span>
            </>
        );
    })();

    return (
        <div className="w-full space-y-4 sm:space-y-5">
            {/* Admit-card style header */}
            <section className="bg-paper border border-rule rounded-xl p-4 sm:p-6" aria-label={`Schedule for ${student.name}`}>
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
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-md text-ink-faint hover:text-ink hover:bg-desk"
                                    aria-label="Copy roll number"
                                    title="Copy roll number"
                                >
                                    {isCopied ? <Check size={16} /> : <Copy size={15} />}
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

                    <button
                        onClick={handleExport}
                        className="self-start inline-flex items-center gap-2 h-11 px-4 rounded-md bg-ink text-paper font-bold text-[15px] hover:opacity-90 active:opacity-80 transition-opacity flex-shrink-0"
                    >
                        <CalendarPlus size={18} /> Add to calendar
                    </button>
                </div>

                {nextLine && <p className="mt-4 pt-4 border-t border-rule text-[16px] leading-relaxed">{nextLine}</p>}
            </section>

            {atktLoading ? (
                <div className="bg-paper border border-rule rounded-xl p-5 space-y-3" aria-label="Loading schedule">
                    <div className="h-5 w-32 rounded bg-desk" />
                    <div className="h-12 rounded bg-desk" />
                    <div className="h-12 rounded bg-desk" />
                </div>
            ) : hasAtkt ? (
                <AtktSection exams={atktExams} nextExam={next?.exam} />
            ) : (
                <>
                    {/* Tabs on phones; both sheets side by side from lg */}
                    <div className="lg:hidden flex border-b border-rule" role="tablist" aria-label="Exam type">
                        {TABS.map((t) => {
                            const count = t.id === 'all' ? theoryExams.length + practicalExams.length : t.id === 'theory' ? theoryExams.length : practicalExams.length;
                            const active = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`-mb-px h-11 px-3 sm:px-4 text-[15px] font-bold whitespace-nowrap border-b-2 transition-colors ${active ? 'border-ink text-ink' : 'border-transparent text-ink-faint hover:text-ink-soft'}`}
                                >
                                    {t.label} <span className="tnum font-normal">{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 items-start">
                        <Sheet
                            title="Theory"
                            note={`${theoryExams.length} ${theoryExams.length === 1 ? 'paper' : 'papers'}`}
                            exams={theoryExams}
                            nextExam={next?.exam}
                            emptyText="No theory exams scheduled."
                            className={activeTab === 'practical' ? 'hidden lg:block' : ''}
                        />
                        <Sheet
                            title="Practical"
                            note={`${practicalExams.length} ${practicalExams.length === 1 ? 'slot' : 'slots'}`}
                            exams={practicalExams}
                            nextExam={next?.exam}
                            emptyText="No practical exams scheduled."
                            className={activeTab === 'theory' ? 'hidden lg:block' : ''}
                        />
                    </div>
                </>
            )}

            {/* Calendar help: one quiet line, details on demand */}
            <section>
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
