/**
 * Shared date/time logic for exam schedules.
 *
 * Exam sheets use many loose formats, e.g.
 *   dates: "10/10/2026", "9/10/2026", "17-10-2026", "Day 1 : 03rd Oct (Saturday)",
 *          "22nd June (Monday)", "23rd December 2025"
 *   times: "10:00 AM - 10:30 AM", "1:00 PM –01:30 PM", "11:30 - 1:00 PM"
 *
 * All exams take place on campus in India, so every parsed time is interpreted
 * in IST (UTC+05:30) regardless of the viewer's device timezone. This keeps the
 * "completed" state, countdowns and calendar exports correct everywhere.
 */

export const EXAM_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MINUTES = 330;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const getMonthIndex = (monthStr) => {
  if (!monthStr) return -1;
  const cleaned = monthStr.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length < 3) return -1;
  return MONTHS.findIndex((m) => cleaned.startsWith(m));
};

/** Builds a real Date for a wall-clock time in IST. */
const istDate = (year, month, day, hours = 0, minutes = 0) =>
  new Date(Date.UTC(year, month, day, hours, minutes) - IST_OFFSET_MINUTES * 60 * 1000);

/** Returns the current year in IST. */
const currentIstYear = () => new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000).getUTCFullYear();

/** Strips the "Day N :" prefix and "(Weekday)" suffix from a sheet date label. */
export const cleanDateLabel = (dateStr) =>
  String(dateStr || '')
    .replace(/^\s*Day\s*\d+\s*:\s*/i, '')
    .replace(/\(\s*[a-zA-Z]+\s*\)/g, '')
    .trim();

/**
 * Parses a sheet date label into { year, month (0-based), day }.
 * @returns {{year:number, month:number, day:number} | null}
 */
export const parseExamDate = (dateStr) => {
  if (!dateStr) return null;
  const raw = cleanDateLabel(dateStr);
  if (!raw) return null;

  let year;
  let month;
  let day;

  const numeric = raw.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (numeric) {
    // Indian sheets are always DD/MM/YYYY
    day = parseInt(numeric[1], 10);
    month = parseInt(numeric[2], 10) - 1;
    if (numeric[3]) {
      year = parseInt(numeric[3], 10);
      if (year < 100) year += 2000;
    }
  } else {
    const yearMatch = raw.match(/\b(20\d{2})\b/);
    if (yearMatch) year = parseInt(yearMatch[1], 10);

    const parts = raw.split(/[\s,:]+/).filter(Boolean);
    for (const part of parts) {
      const numMatch = part.match(/^(\d{1,2})(?:st|nd|rd|th)?$/i);
      if (numMatch) {
        day = parseInt(numMatch[1], 10);
        break;
      }
    }
    for (const part of parts) {
      const idx = getMonthIndex(part);
      if (idx !== -1) {
        month = idx;
        break;
      }
    }
  }

  if (month === undefined || month < 0 || month > 11 || !day || day < 1 || day > 31) {
    return null;
  }

  return { year: year || currentIstYear(), month, day };
};

/** Parses a single "10:00 AM" style clock value. */
const parseClock = (str) => {
  const match = String(str || '').match(/(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM|A\.M\.|P\.M\.)?/i);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  if (hours > 23 || minutes > 59) return null;
  const period = match[3] ? match[3].replace(/\./g, '').toUpperCase() : null;
  return { hours, minutes, period };
};

const to24h = ({ hours, minutes, period }) => {
  let h = hours;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return { hours: h, minutes };
};

/**
 * Parses a time range like "10:00 AM - 10:30 AM" into 24h start/end values.
 * Missing AM/PM markers are inferred from the other side of the range or from
 * college hours (1–7 without a marker means PM).
 */
export const parseTimeRange = (timeStr) => {
  if (!timeStr) return null;
  const [startRaw, endRaw] = String(timeStr).replace(/[–—]/g, '-').replace(/\bto\b/i, '-').split('-');
  const start = parseClock(startRaw);
  if (!start) return null;
  const end = parseClock(endRaw);

  if (end && !end.period && start.period) end.period = start.period;
  if (end && end.period && !start.period) {
    start.period = end.period;
    // "11:30 - 1:00 PM" → the start must be 11:30 AM
    if (end.period === 'PM' && start.hours !== 12 && start.hours > end.hours && end.hours !== 12) {
      start.period = 'AM';
    }
  }
  if (!start.period && start.hours <= 23) {
    if (start.hours >= 1 && start.hours <= 7) start.period = 'PM';
  }
  if (end && !end.period && end.hours >= 1 && end.hours <= 7) end.period = 'PM';

  const s = start.period ? to24h(start) : { hours: start.hours, minutes: start.minutes };
  let e = end ? (end.period ? to24h(end) : { hours: end.hours, minutes: end.minutes }) : null;

  // Fallback: no end time → assume a 30 minute slot
  if (!e || e.hours * 60 + e.minutes <= s.hours * 60 + s.minutes) {
    const total = s.hours * 60 + s.minutes + 30;
    e = { hours: Math.floor(total / 60) % 24, minutes: total % 60 };
  }

  return { start: s, end: e };
};

const parseCache = new Map();

/**
 * Parses an exam's date + time into absolute start/end Dates (IST).
 * @returns {{start: Date, end: Date, hasTime: boolean, dayKey: string} | null}
 */
export const parseExamDateTime = (dateStr, timeStr) => {
  const cacheKey = `${dateStr}|${timeStr}`;
  if (parseCache.has(cacheKey)) return parseCache.get(cacheKey);

  let result = null;
  const date = parseExamDate(dateStr);
  if (date) {
    const range = parseTimeRange(timeStr);
    const { year, month, day } = date;
    const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (range) {
      result = {
        start: istDate(year, month, day, range.start.hours, range.start.minutes),
        end: istDate(year, month, day, range.end.hours, range.end.minutes),
        hasTime: true,
        dayKey,
      };
    } else {
      result = {
        start: istDate(year, month, day, 0, 0),
        end: istDate(year, month, day, 23, 59),
        hasTime: false,
        dayKey,
      };
    }
  }

  if (parseCache.size > 5000) parseCache.clear();
  parseCache.set(cacheKey, result);
  return result;
};

/** Backwards-compatible helper: end Date of an exam, or null. */
export const parseExamEndDateTime = (dateStr, timeStr) => {
  const parsed = parseExamDateTime(dateStr, timeStr);
  return parsed ? parsed.end : null;
};

const istDayKey = (ts) => {
  const d = new Date(ts + IST_OFFSET_MINUTES * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/**
 * @returns {'completed'|'ongoing'|'today'|'upcoming'|'unknown'}
 */
export const getExamStatus = (exam, now = Date.now()) => {
  const parsed = exam ? parseExamDateTime(exam.date, exam.time) : null;
  if (!parsed) return 'unknown';
  if (parsed.end.getTime() < now) return 'completed';
  if (parsed.start.getTime() <= now) return 'ongoing';
  if (parsed.dayKey === istDayKey(now)) return 'today';
  return 'upcoming';
};

export const isExamCompleted = (exam, now = Date.now()) => getExamStatus(exam, now) === 'completed';

/** Returns a new array sorted chronologically; unparseable exams go last. */
export const sortExams = (exams = []) =>
  exams
    .map((exam, index) => ({ exam, index, parsed: parseExamDateTime(exam.date, exam.time) }))
    .sort((a, b) => {
      if (a.parsed && b.parsed) {
        return a.parsed.start - b.parsed.start || a.index - b.index;
      }
      if (a.parsed) return -1;
      if (b.parsed) return 1;
      return a.index - b.index;
    })
    .map((item) => item.exam);

/**
 * Merges theory + practical exams into one chronological list grouped by day.
 * @returns {Array<{dayKey: string|null, exams: Array<{exam, kind, parsed}>}>}
 */
export const buildTimeline = (student) => {
  if (!student) return [];
  const items = [
    ...(student.theory || []).map((exam) => ({ exam, kind: 'theory' })),
    ...(student.practical || []).map((exam) => ({ exam, kind: 'practical' })),
  ].map((item, index) => ({ ...item, index, parsed: parseExamDateTime(item.exam.date, item.exam.time) }));

  items.sort((a, b) => {
    if (a.parsed && b.parsed) return a.parsed.start - b.parsed.start || a.index - b.index;
    if (a.parsed) return -1;
    if (b.parsed) return 1;
    return a.index - b.index;
  });

  const groups = [];
  const byKey = new Map();
  for (const item of items) {
    const key = item.parsed ? item.parsed.dayKey : null;
    if (!byKey.has(key)) {
      const group = { dayKey: key, exams: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).exams.push(item);
  }
  return groups;
};

/** Finds the next exam that hasn't finished yet. */
export const getNextExam = (student, now = Date.now()) => {
  for (const group of buildTimeline(student)) {
    for (const item of group.exams) {
      if (item.parsed && item.parsed.end.getTime() >= now) return item;
    }
  }
  return null;
};

/** "Sat, 10 Oct" style label for a YYYY-MM-DD key. */
export const formatDayLabel = (dayKey, { withYear = false } = {}) => {
  if (!dayKey) return 'Date to be announced';
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
};

/** Relative label for a day: "Today", "Tomorrow", "In 3 days", "2 days ago". */
export const relativeDayLabel = (dayKey, now = Date.now()) => {
  if (!dayKey) return '';
  const today = istDayKey(now);
  const toUtc = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const diff = Math.round((toUtc(dayKey) - toUtc(today)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1) return `In ${diff} days`;
  return `${-diff} days ago`;
};

/** Short countdown like "2d 4h", "3h 20m", "12m". */
export const formatCountdown = (ms) => {
  if (ms <= 0) return 'now';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
};

/** "10:00 AM - 10:30 AM" -> "10:00 AM – 10:30 AM" for display (en dash, no stray spaces). */
export const displayTime = (time) =>
  String(time || '').replace(/\s+/g, ' ').trim().replace(/\s*(?:[-–—]|\bto\b)\s*/i, ' – ');

/** Weekday ("Sat") and day ("3 Oct") for a timetable's date column. */
export const examDateParts = (exam) => {
  const parsed = parseExamDateTime(exam?.date, exam?.time);
  if (!parsed) return { weekday: '', day: cleanDateLabel(exam?.date) || 'Date TBA', parsed: null };
  const [y, m, d] = parsed.dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    weekday: date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
    day: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    parsed,
  };
};

/** The soonest exam in a list that hasn't finished yet: { exam, parsed } or null. */
export const findNextExam = (exams = [], now = Date.now()) => {
  let best = null;
  for (const exam of exams) {
    const parsed = parseExamDateTime(exam?.date, exam?.time);
    if (parsed && parsed.end.getTime() >= now && (!best || parsed.start < best.parsed.start)) best = { exam, parsed };
  }
  return best;
};
