import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { parseExamDateTime, isExamCompleted, relativeDayLabel, examDateParts, displayTime } from '../utils/dateUtils';
import { KIND } from './kind';

const KIND_ORDER = ['Theory', 'Project Eval', 'Practical', 'Viva'];
const semNumber = (s) => parseInt(String(s || '').replace(/\D/g, ''), 10) || 99;

/** Groups entries into semester -> kind -> exams, each sorted by date/time. */
function buildGroups(exams) {
  const sems = new Map();
  exams.forEach((exam, index) => {
    const sem = exam.semester || 'Other';
    const kind = exam.kind || exam.group || 'Re-exams';
    if (!sems.has(sem)) sems.set(sem, new Map());
    const kinds = sems.get(sem);
    if (!kinds.has(kind)) kinds.set(kind, []);
    kinds.get(kind).push({ exam, index, parsed: parseExamDateTime(exam.date, exam.time) });
  });

  const byTime = (a, b) => {
    if (a.parsed && b.parsed) return a.parsed.start - b.parsed.start || a.index - b.index;
    if (a.parsed) return -1;
    if (b.parsed) return 1;
    return a.index - b.index;
  };

  return [...sems.entries()]
    .sort((a, b) => semNumber(a[0]) - semNumber(b[0]))
    .map(([semester, kinds]) => ({
      semester,
      kinds: [...kinds.entries()]
        .sort((a, b) => {
          const ia = KIND_ORDER.indexOf(a[0]);
          const ib = KIND_ORDER.indexOf(b[0]);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a[0].localeCompare(b[0]);
        })
        .map(([kind, items]) => ({ kind, items: items.sort(byTime) })),
    }));
}

/** The tab holding the soonest upcoming exam (falls back to the first tab). */
function defaultTab(groups, now) {
  let best = null;
  for (const g of groups) {
    for (const k of g.kinds) {
      const next = k.items.find((i) => i.parsed && i.parsed.end.getTime() >= now);
      if (next && (!best || next.parsed.start < best.start)) best = { semester: g.semester, kind: k.kind, start: next.parsed.start };
    }
  }
  if (best) return best;
  return groups[0] ? { semester: groups[0].semester, kind: groups[0].kinds[0].kind } : null;
}

const Row = ({ exam, kind, isNext, showDate, now }) => {
  const completed = isExamCompleted(exam, now);
  const { weekday, day, parsed } = examDateParts(exam);
  const isToday = parsed ? relativeDayLabel(parsed.dayKey, now) === 'Today' : false;
  // Only show the exam type when it adds something beyond the tab name
  const showType = exam.examType && !exam.examType.toLowerCase().startsWith(kind.toLowerCase().split(' ')[0]);

  return (
    <li className={`grid grid-cols-[4.75rem_1fr] sm:grid-cols-[5.5rem_1fr] gap-x-3 ${showDate ? 'pt-3 border-t border-rule first:border-t-0' : 'pt-1'} pb-1`}>
      <div className="tnum leading-tight pt-0.5">
        {showDate && (
          <>
            <div className={`text-[13px] ${isToday ? 'font-bold text-ink' : 'text-ink-faint'}`}>{parsed ? (isToday ? 'Today' : weekday) : ''}</div>
            <div className={`text-[16px] font-bold ${completed ? 'text-ink-faint' : 'text-ink'}`}>{day}</div>
          </>
        )}
      </div>
      <div className={`min-w-0 border-l-[3px] pl-3 py-0.5 pb-2 ${KIND.reexam.bar} ${completed ? 'opacity-55' : ''}`}>
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
        <p className={`tnum mt-0.5 text-[15px] whitespace-nowrap ${completed ? 'text-ink-faint' : 'text-ink-soft'}`}>
          {exam.time ? displayTime(exam.time) : 'Time to be announced'}
        </p>
        {showType && <p className="text-[14px] text-ink-soft">{exam.examType}</p>}
        {/* Faculty and room are always shown, so students can see what's still pending */}
        <dl className={`mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-[14px] ${completed ? 'text-ink-faint' : ''}`}>
          <dt className="text-ink-faint">Faculty</dt>
          <dd className={exam.faculty ? (completed ? '' : 'text-ink') : 'text-ink-faint italic'}>{exam.faculty || 'To be announced'}</dd>
          <dt className="text-ink-faint">Room</dt>
          <dd className={exam.classroom ? (completed ? 'font-semibold' : 'text-ink font-semibold') : 'text-ink-faint italic'}>{exam.classroom || 'To be announced'}</dd>
        </dl>
      </div>
    </li>
  );
};

const tabClass = (active) =>
  `-mb-px h-11 px-3 sm:px-4 text-[15px] font-bold whitespace-nowrap border-b-[3px] transition-colors ${active ? `${KIND.reexam.rule} text-ink` : 'border-transparent text-ink-faint hover:text-ink-soft'}`;

/** ATKT re-exams, split into the sheet's tabs (semester, then Theory / Project Eval). */
const AtktSection = ({ exams, nextExam, now: nowProp }) => {
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp ?? mountedAt;
  const groups = useMemo(() => buildGroups(exams || []), [exams]);
  const initial = useMemo(() => defaultTab(groups, now), [groups, now]);
  const [picked, setPicked] = useState(null);
  const activeSemRef = useRef(null);
  const activeSem = picked?.semester ?? initial?.semester;

  // Keep the selected semester tab visible in the scrolling tab row
  useEffect(() => {
    activeSemRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeSem]);

  if (groups.length === 0 || !initial) return null;

  // Keep the user's pick only while it still exists in the data
  const semGroup = groups.find((g) => g.semester === (picked?.semester ?? initial.semester)) || groups[0];
  const kindGroup = semGroup.kinds.find((k) => k.kind === (picked?.kind ?? initial.kind)) || semGroup.kinds[0];
  const upcoming = exams.filter((e) => !isExamCompleted(e, now)).length;
  const doneShare = exams.length ? (exams.length - upcoming) / exams.length : 0;

  return (
    <section aria-label="ATKT re-exam schedule" className="bg-paper border border-rule rounded-xl px-4 sm:px-5 pt-4 pb-2 print:border-0 print:px-0">
      <div className={`flex items-center justify-between gap-3 pb-3 border-b-[3px] ${KIND.reexam.rule}`}>
        <div className="flex items-center gap-2.5">
          <h3 className="text-[20px] font-extrabold tracking-[-0.01em]">Re-exams</h3>
          <span className="text-[12px] font-bold text-stamp border-[1.5px] border-stamp rounded-[3px] px-1.5 leading-[18px]">ATKT</span>
        </div>
        <span className="text-[14px] text-ink-faint tnum">
          {upcoming > 0 ? `${upcoming} of ${exams.length} to go` : 'All done'}
        </span>
      </div>
      {/* How far through the re-exams the student is */}
      <div className="mt-2 h-1.5 rounded-full bg-reexam-tint overflow-hidden" role="progressbar" aria-label="Re-exams finished" aria-valuemin={0} aria-valuemax={exams.length} aria-valuenow={exams.length - upcoming}>
        <div className={`h-full ${KIND.reexam.dot} transition-[width] duration-500`} style={{ width: `${Math.round(doneShare * 100)}%` }} />
      </div>

      {groups.length > 1 && (
        <div
          className={`flex overflow-x-auto overscroll-x-contain border-b border-rule [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${groups.length > 3 ? 'max-sm:[mask-image:linear-gradient(to_right,black_82%,transparent)]' : ''}`}
          role="tablist"
          aria-label="Semester"
        >
          {groups.map((g) => {
            const count = g.kinds.reduce((n, k) => n + k.items.length, 0);
            return (
              <button
                key={g.semester}
                ref={g.semester === semGroup.semester ? activeSemRef : undefined}
                role="tab"
                aria-selected={g.semester === semGroup.semester}
                onClick={() => setPicked({ semester: g.semester, kind: kindGroup.kind })}
                className={tabClass(g.semester === semGroup.semester)}
              >
                {g.semester}<span className={`ml-1.5 inline-block min-w-[1.5rem] px-1.5 rounded-full text-[12px] leading-[20px] font-bold tnum text-center ${g.semester === semGroup.semester ? 'bg-reexam-tint text-ink' : 'bg-desk text-ink-faint'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {semGroup.kinds.length > 1 ? (
        <div className="mt-3 inline-flex rounded-md border border-rule p-0.5" role="tablist" aria-label="Exam type">
          {semGroup.kinds.map((k) => {
            const active = k.kind === kindGroup.kind;
            return (
              <button
                key={k.kind}
                role="tab"
                aria-selected={active}
                onClick={() => setPicked({ semester: semGroup.semester, kind: k.kind })}
                className={`h-9 px-3 rounded-[5px] text-[14px] font-bold whitespace-nowrap transition-colors ${active ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'}`}
              >
                {k.kind}<span className={`ml-1.5 inline-block min-w-[1.5rem] px-1.5 rounded-full text-[12px] leading-[20px] font-bold tnum text-center ${active ? 'bg-paper/20 text-paper' : 'bg-desk text-ink-faint'}`}>{k.items.length}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[15px] font-bold text-ink-soft">{kindGroup.kind}</p>
      )}

      <ol className="mt-1">
        {kindGroup.items.map((item, i) => {
          // A date is printed once per day, like a real timetable
          const prev = kindGroup.items[i - 1];
          const key = (it) => it.parsed?.dayKey || `raw-${it.exam.date}`;
          const showDate = !prev || key(prev) !== key(item);
          return <Row key={item.index} exam={item.exam} kind={kindGroup.kind} isNext={item.exam === nextExam} showDate={showDate} now={now} />;
        })}
      </ol>
    </section>
  );
};

export default AtktSection;
