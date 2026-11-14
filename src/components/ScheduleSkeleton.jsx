import React from 'react';

/** Rows shaped like the timetable: date column, then subject / time / room. */
export const SkeletonRows = ({ rows = 3 }) => (
  <ol aria-hidden="true">
    {Array.from({ length: rows }).map((_, i) => (
      <li key={i} className="grid grid-cols-[4.75rem_1fr] sm:grid-cols-[5.5rem_1fr] lg:grid-cols-[6.75rem_1fr] gap-x-3 py-3.5 border-t border-rule first:border-t-0">
        <div className="space-y-1.5 pt-0.5">
          <div className="skeleton h-3 w-8" />
          <div className="skeleton h-4 w-14" />
        </div>
        <div className="border-l-[3px] border-rule pl-3 space-y-2">
          <div className="skeleton h-4 lg:h-5" style={{ width: `${62 - i * 9}%` }} />
          <div className="skeleton h-3.5 w-36" />
        </div>
      </li>
    ))}
  </ol>
);

/** A sheet (Theory / Practical / Re-exams) while its rows load. */
export const SheetSkeleton = ({ rows = 3, className = '' }) => (
  <section className={`bg-paper border border-rule rounded-xl px-4 sm:px-5 lg:px-6 pt-4 pb-2 ${className}`} aria-hidden="true">
    <div className="flex items-center justify-between pb-3 border-b-[3px] border-rule">
      <div className="skeleton h-6 w-28" />
      <div className="skeleton h-4 w-16" />
    </div>
    <SkeletonRows rows={rows} />
  </section>
);

/** Whole schedule (admit card + both sheets) while a student is being opened. */
const ScheduleSkeleton = () => (
  <div className="w-full space-y-4 sm:space-y-5" role="status" aria-label="Loading schedule">
    <section className="bg-paper border border-rule rounded-xl p-4 sm:p-6 lg:p-8" aria-hidden="true">
      <div className="skeleton h-8 sm:h-10 lg:h-12 w-3/5 max-w-md" />
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="skeleton h-12 w-56" />
        <div className="skeleton h-12 w-24" />
      </div>
      <div className="mt-5 pt-4 border-t border-rule">
        <div className="skeleton h-5 w-4/5 max-w-lg" />
      </div>
    </section>
    <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
      <SheetSkeleton />
      <SheetSkeleton className="hidden lg:block" />
    </div>
    <span className="sr-only">Loading schedule…</span>
  </div>
);

export default ScheduleSkeleton;
