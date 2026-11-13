import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Calendar, Check, User as PersonIcon, MapPin } from 'lucide-react';
import { parseExamDateTime, isExamCompleted, formatDayLabel, relativeDayLabel, cleanDateLabel } from '../utils/dateUtils';

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

/** Groups a tab's items by day for a compact, scannable list. */
function byDay(items) {
  const days = [];
  for (const item of items) {
    const key = item.parsed ? item.parsed.dayKey : `raw:${cleanDateLabel(item.exam.date)}`;
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, dayKey: item.parsed?.dayKey || null, rawDate: cleanDateLabel(item.exam.date), items: [] };
      days.push(day);
    }
    day.items.push(item);
  }
  return days;
}

const splitTime = (time) => {
  const [start, end] = String(time || '').split(/\s*[-–—]\s*/);
  return { start: start || '—', end: end || '' };
};

const Row = ({ exam, kind }) => {
  const completed = isExamCompleted(exam);
  const { start, end } = splitTime(exam.time);
  // Only show the exam type when it adds something beyond the tab name
  const showType = exam.examType && !exam.examType.toLowerCase().startsWith(kind.toLowerCase().split(' ')[0]);

  return (
    <li className={`flex gap-3 py-3 ${completed ? 'opacity-55' : ''}`}>
      <div className="w-[74px] flex-shrink-0 whitespace-nowrap">
        <div className={`font-mono text-[13px] font-bold leading-tight ${completed ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
          {start}
        </div>
        {end && <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">to {end}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-semibold text-slate-900 dark:text-white leading-snug break-words">{exam.subject}</p>
          {completed && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
              <Check size={11} className="stroke-[3]" /> Done
            </span>
          )}
        </div>
        {(showType || exam.faculty || exam.classroom) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {showType && <span className="font-medium text-rose-700 dark:text-rose-300">{exam.examType}</span>}
            {exam.faculty && <span className="inline-flex items-center gap-1"><PersonIcon size={11} />{exam.faculty}</span>}
            {exam.classroom && <span className="inline-flex items-center gap-1"><MapPin size={11} />{exam.classroom}</span>}
          </div>
        )}
      </div>
    </li>
  );
};

const pill = (active) =>
  `flex-shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-3 rounded-xl text-sm font-semibold min-h-[40px] transition ${active
    ? 'bg-rose-600 text-white shadow-sm'
    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'}`;

/** ATKT re-exams, split into the sheet's tabs (semester × Theory / Project Eval). */
const AtktSection = ({ exams }) => {
  const [now] = useState(() => Date.now());
  const groups = useMemo(() => buildGroups(exams || []), [exams]);
  const initial = useMemo(() => defaultTab(groups, now), [groups, now]);
  const [picked, setPicked] = useState(null);

  if (groups.length === 0 || !initial) return null;

  // Keep the user's pick only while it still exists in the data
  const semGroup = groups.find((g) => g.semester === (picked?.semester ?? initial.semester)) || groups[0];
  const kindGroup = semGroup.kinds.find((k) => k.kind === (picked?.kind ?? initial.kind)) || semGroup.kinds[0];

  const total = exams.length;
  const upcoming = exams.filter((e) => !isExamCompleted(e)).length;
  const days = byDay(kindGroup.items);
  const tabKey = `${semGroup.semester}|${kindGroup.kind}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      aria-label="ATKT re-exam schedule"
      className="bg-white dark:bg-[#0c101c]/60 rounded-3xl p-4 sm:p-6 border border-rose-200/90 dark:border-rose-500/20 shadow-sm dark:shadow-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 bg-rose-100 dark:bg-rose-500/10 rounded-2xl border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex-shrink-0">
            <RotateCcw size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">ATKT Re-exams</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 font-mono">
              {upcoming > 0 ? `${upcoming} of ${total} upcoming` : 'All re-exams completed'}
            </p>
          </div>
        </div>
      </div>

      {/* Semester tabs */}
      {groups.length > 1 && (
        <div className="mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Semester">
          {groups.map((g) => {
            const count = g.kinds.reduce((n, k) => n + k.items.length, 0);
            const active = g.semester === semGroup.semester;
            return (
              <button
                key={g.semester}
                role="tab"
                aria-selected={active}
                onClick={() => setPicked({ semester: g.semester, kind: kindGroup.kind })}
                className={pill(active)}
              >
                {g.semester}
                <span className={`text-[11px] font-mono px-1.5 rounded-md ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Type toggle (Theory / Project Eval) */}
      {semGroup.kinds.length > 1 ? (
        <div className="mt-3 flex p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10" role="tablist" aria-label="Exam type">
          {semGroup.kinds.map((k) => {
            const active = k.kind === kindGroup.kind;
            return (
              <button
                key={k.kind}
                role="tab"
                aria-selected={active}
                onClick={() => setPicked({ semester: semGroup.semester, kind: k.kind })}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2 py-2 rounded-lg text-sm font-semibold min-h-[38px] transition ${active
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'}`}
              >
                {k.kind}
                <span className="text-[11px] font-mono opacity-70">{k.items.length}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{kindGroup.kind}</p>
      )}

      {/* Day-grouped list for the selected tab */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tabKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="mt-3 space-y-3"
        >
          {days.map((day) => {
            const rel = relativeDayLabel(day.dayKey, now);
            return (
              <div key={day.key} className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] px-3.5">
                <div className="flex items-center gap-2 pt-3 pb-1">
                  <Calendar size={13} className={rel === 'Today' ? 'text-amber-500' : 'text-rose-500'} />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {day.dayKey ? formatDayLabel(day.dayKey) : (day.rawDate || 'Date to be announced')}
                  </span>
                  {rel && <span className={`text-[11px] font-semibold ${rel === 'Today' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>{rel}</span>}
                </div>
                <ul className="divide-y divide-slate-200/70 dark:divide-white/5">
                  {day.items.map((item) => (
                    <Row key={item.index} exam={item.exam} kind={kindGroup.kind} />
                  ))}
                </ul>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
};

export default AtktSection;
