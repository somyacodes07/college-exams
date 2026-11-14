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
