/** Students opened on this device, newest first (kept in localStorage). */
const RECENT_KEY = 'recentStudents';
export const MAX_RECENT = 4;

export function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function saveRecent(student) {
  try {
    const entry = {
      name: student.name,
      rollNo: String(student.rollNo),
      batch: student.batch,
      cohort: student.cohort || '',
      ...(student.rollPending ? { rollPending: true, officialRollNo: student.officialRollNo } : {}),
    };
    const next = [entry, ...readRecent().filter((s) => s.rollNo !== entry.rollNo)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('recent-change'));
    return next;
  } catch {
    return [];
  }
}

export function removeRecent(rollNo) {
  try {
    const next = readRecent().filter((s) => s.rollNo !== String(rollNo));
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('recent-change'));
    return next;
  } catch {
    return [];
  }
}

/** The roll number to show and copy (official one for provisional records). */
export const displayRoll = (s) => String(s?.officialRollNo || s?.rollNo || '');
