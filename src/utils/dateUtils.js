/**
 * Utility to determine if an exam has already been completed based on date & time strings.
 */

const getMonthIndex = (monthStr) => {
  if (!monthStr) return -1;
  const cleaned = monthStr.toLowerCase().replace(/[^a-z]/g, '');
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return months.findIndex(m => cleaned.startsWith(m));
};

export const parseExamEndDateTime = (dateStr, timeStr) => {
  if (!dateStr) return null;

  let year = 2026;
  const yearMatch = dateStr.match(/\b(202\d)\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  let day, month;

  // Handle DD/MM/YYYY or DD/MM
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    if (parts[2]) {
      const yr = parseInt(parts[2], 10);
      if (yr > 2000) year = yr;
    }
  } else if (dateStr.includes('-') && /^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr.trim())) {
    const parts = dateStr.trim().split('-');
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  } else {
    // Handle e.g. "Day 1 : 18th June", "19th June (Friday)", "23rd December 2025"
    const cleaned = dateStr.replace(/^Day\s*\d+\s*:\s*/i, '').replace(/\([a-zA-Z]+\)/, '').trim();
    const parts = cleaned.split(/[\s,:]+/);
    
    // Find numeric day
    for (const part of parts) {
      const numMatch = part.match(/^(\d{1,2})/);
      if (numMatch && !isNaN(parseInt(numMatch[1], 10))) {
        day = parseInt(numMatch[1], 10);
        break;
      }
    }

    // Find month
    for (const part of parts) {
      const mIdx = getMonthIndex(part);
      if (mIdx !== -1) {
        month = mIdx;
        break;
      }
    }
  }

  if (month === undefined || month < 0 || isNaN(day)) {
    return null;
  }

  // Parse time end string (e.g. "1:00 PM –01:30 PM", "10:00 AM - 10:15 AM", "02:00 PM – 03:00 PM")
  let hours = 23;
  let minutes = 59;

  if (timeStr) {
    const normalized = timeStr.replace(/[–—]/g, '-');
    const parts = normalized.split('-');
    const endStr = parts.length > 1 ? parts[1].trim() : parts[0].trim();

    const timeMatch = endStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3] ? timeMatch[3].toUpperCase() : null;

      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;

      hours = h;
      minutes = m;
    }
  }

  return new Date(year, month, day, hours, minutes, 59);
};

export const isExamCompleted = (exam) => {
  if (!exam) return false;
  const endDateTime = parseExamEndDateTime(exam.date, exam.time);
  if (!endDateTime) return false;
  return endDateTime.getTime() < Date.now();
};
