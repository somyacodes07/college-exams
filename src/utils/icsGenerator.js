import { parseExamDateTime, cleanDateLabel, EXAM_TIMEZONE } from './dateUtils.js';

/** Escapes text per RFC 5545 (backslash, comma, semicolon, newlines). */
const escapeText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/** Folds lines longer than 75 octets as required by RFC 5545. */
const foldLine = (line) => {
  if (line.length <= 74) return line;
  const chunks = [];
  let rest = line;
  chunks.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 0) {
    chunks.push(' ' + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  return chunks.join('\r\n');
};

const pad = (n) => String(n).padStart(2, '0');

/** UTC timestamp in ICS basic format: 20261010T043000Z */
const formatUtc = (date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

/** Stable hash so re-importing the same schedule updates events instead of duplicating them. */
const hash = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

const hasValue = (v) => v && v !== 'TBD' && v !== 'Unknown' && String(v).trim() !== '';

/**
 * Builds an .ics calendar for a student's theory and practical exams.
 * Includes a reminder 1 hour and 1 day before each exam.
 */
export const generateICS = (student, { includeCompleted = true } = {}) => {
  if (!student) return '';

  const now = formatUtc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Exam Scheduler//Schedule Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`Exams – ${student.name}`)}`,
    `X-WR-TIMEZONE:${EXAM_TIMEZONE}`,
  ];

  const addExam = (exam, kind) => {
    const parsed = parseExamDateTime(exam.date, exam.time);
    if (!parsed) return;
    if (!includeCompleted && parsed.end.getTime() < Date.now()) return;

    const label = kind === 'theory' ? 'Theory' : kind === 'reexam' ? 'Re-exam' : 'Practical';
    const details = [`${label} exam: ${exam.subject}`];
    if (hasValue(exam.examType)) details.push(`Type: ${exam.examType}`);
    if (hasValue(exam.professor || exam.faculty)) details.push(`Examiner: ${exam.professor || exam.faculty}`);
    if (hasValue(exam.panel)) details.push(`Panel: ${exam.panel}`);
    if (exam.time) details.push(`Time: ${exam.time}`);
    details.push(`Roll No: ${student.rollNo}`);

    const room = exam.location || exam.classroom;
    const location = hasValue(room) ? room : kind === 'practical' ? 'Lab' : 'Exam Hall';
    const uid = `${hash(`${student.rollNo}|${kind}|${exam.subject}|${exam.examType || ''}|${cleanDateLabel(exam.date)}|${exam.time}`)}@exam-scheduler`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatUtc(parsed.start)}`,
      `DTEND:${formatUtc(parsed.end)}`,
      `SUMMARY:${escapeText(`${label}: ${exam.subject}`)}`,
      `DESCRIPTION:${escapeText(details.join('\n'))}`,
      `LOCATION:${escapeText(location)}`,
      `CATEGORIES:${label.toUpperCase()}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`${label}: ${exam.subject}`)}`,
      'TRIGGER:-PT1H',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`Tomorrow: ${exam.subject}`)}`,
      'TRIGGER:-P1D',
      'END:VALARM',
      'END:VEVENT'
    );
  };

  (student.theory || []).forEach((exam) => addExam(exam, 'theory'));
  (student.practical || []).forEach((exam) => addExam(exam, 'practical'));
  (student.reexams || []).forEach((exam) => addExam(exam, 'reexam'));

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n');
};

export const downloadICS = (filename, content) => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};
