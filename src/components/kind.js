/**
 * Highlighter colour per exam type, like students colour-coding a printed
 * timetable: blue for theory, green for practical, pink for re-exams.
 * Yellow is reserved for the student's next exam (see .highlight in index.css).
 * Full class names are spelled out so Tailwind can find them.
 */
export const KIND = {
  theory: { bar: 'border-theory', rule: 'border-theory', dot: 'bg-theory', tint: 'bg-theory-tint' },
  practical: { bar: 'border-practical', rule: 'border-practical', dot: 'bg-practical', tint: 'bg-practical-tint' },
  reexam: { bar: 'border-reexam', rule: 'border-reexam', dot: 'bg-reexam', tint: 'bg-reexam-tint' },
};

/** Shared timetable row layout: date column, then the exam. */
export const ROW_GRID = 'grid grid-cols-[4.75rem_1fr] sm:grid-cols-[5.5rem_1fr] lg:grid-cols-[6.75rem_1fr] gap-x-3 lg:gap-x-4';

/**
 * One type scale for every timetable row (regular and re-exam), so both
 * read the same in light and dark. Subject is the strongest line; the time
 * sits below it; details are the quietest.
 */
export const ROW_TYPE = {
  weekday: 'text-xs lg:text-sm text-ink-soft',
  day: 'text-sm lg:text-base font-semibold',
  subject: 'text-[15px] lg:text-[17px] font-semibold tracking-tight leading-snug break-words',
  time: 'tnum mt-0.5 text-sm lg:text-[15px] whitespace-nowrap',
  meta: 'text-[13px] lg:text-sm',
  done: 'flex-shrink-0 inline-flex items-center gap-1 text-xs lg:text-sm',
};

/** Section title for Theory / Practical / Re-exams. */
export const SECTION_TITLE = 'text-base lg:text-lg font-semibold tracking-tight';

/** Underlined tab (semester, exam type on phones). */
export const tabClass = (active) =>
  `relative h-10 lg:h-11 px-3 sm:px-4 text-sm lg:text-[15px] whitespace-nowrap transition-colors ${active
    ? 'font-semibold text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-ink'
    : 'text-ink-soft hover:text-ink'}`;

/** Count badge inside a tab. */
export const countBadge = 'ml-1.5 inline-block min-w-[1.5rem] rounded px-1.5 py-0.5 text-[11px] lg:text-xs font-medium tnum text-center';

/** Segmented control (Theory / Project Eval): raised, clearly selected item. */
export const segmentClass = (active) =>
  `h-9 lg:h-10 px-3 lg:px-4 rounded-md text-sm lg:text-[15px] whitespace-nowrap transition-colors ${active
    ? 'bg-raised font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-rule'
    : 'text-ink-soft hover:text-ink'}`;
