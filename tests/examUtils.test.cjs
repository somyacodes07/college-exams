const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Running Exam Scheduler Automated CI/CD Tests...\n');

// Test 1: Data Integrity Check for exam_data.json
const examDataPath = path.join(__dirname, '../src/data/exam_data.json');
assert.strictEqual(fs.existsSync(examDataPath), true, 'src/data/exam_data.json file should exist');

const rawData = fs.readFileSync(examDataPath, 'utf8');
const examData = JSON.parse(rawData);

assert.strictEqual(Array.isArray(examData), true, 'exam_data.json should contain an array of student records');
assert.ok(examData.length > 500, 'Should contain over 500 student records');

const batches = new Set(examData.map(s => s.batch));
assert.strictEqual(batches.has('2023-27'), true, 'Should contain batch 2023-27');
assert.strictEqual(batches.has('2024-28'), true, 'Should contain batch 2024-28');
assert.strictEqual(batches.has('2025-29'), true, 'Should contain batch 2025-29');
assert.strictEqual(batches.has('2026-30'), true, 'Should contain batch 2026-30');

let invalidRecords = 0;
let duplicatePracticals = 0;
for (const student of examData) {
  if (!student.rollNo || !student.name) {
    invalidRecords++;
  }
  const seenPrac = new Set();
  for (const p of (student.practical || [])) {
    const key = `${p.subject}::${p.date}`;
    if (seenPrac.has(key)) {
      duplicatePracticals++;
    }
    seenPrac.add(key);
  }
}
assert.strictEqual(invalidRecords, 0, 'All student records must have valid rollNo and name');
assert.strictEqual(duplicatePracticals, 0, 'Zero duplicate practical exams allowed per student');
console.log(`✅ PASS: Data integrity test passed (${examData.length} valid student records across 4 batches, 0 duplicates)`);

// Test 2: Secret Scanning Check on server.cjs
const serverPath = path.join(__dirname, '../server/server.cjs');
const serverContent = fs.readFileSync(serverPath, 'utf8');

const forbiddenPatterns = [
  /mongodb\+srv:\/\//i,
  /somyajeetsingh15_db_user/i,
  /c3hwH34ITP803VfN/i,
  /ExSch3dul3r@2026!/i
];

for (const pattern of forbiddenPatterns) {
  assert.strictEqual(pattern.test(serverContent), false, `Forbidden secret/credential pattern detected in server.cjs: ${pattern}`);
}
console.log('✅ PASS: Secret scanning test passed (Zero hardcoded secrets found in server.cjs)');

// Test 3: Date/time parsing, scheduling and calendar export
(async () => {
  const d = await import('../src/utils/dateUtils.js');
  const { generateICS } = await import('../src/utils/icsGenerator.js');

  const istParts = (date) => {
    const t = new Date(date.getTime() + 330 * 60000);
    return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes()];
  };

  const cases = [
    ['10/10/2026', '10:00 AM - 10:30 AM', [2026, 10, 10, 10, 0], [2026, 10, 10, 10, 30]],
    ['9/10/2026', '2:30 PM - 3:00 PM', [2026, 10, 9, 14, 30], [2026, 10, 9, 15, 0]],
    ['Day 1 : 03rd Oct (Saturday) 2026', '01:00 PM - 01:30 PM', [2026, 10, 3, 13, 0], [2026, 10, 3, 13, 30]],
    ['Day 2: 05th Oct (Monday) 2026', '11:30 - 1:00 PM', [2026, 10, 5, 11, 30], [2026, 10, 5, 13, 0]],
    ['23rd December 2025', '1:00 PM –01:30 PM', [2025, 12, 23, 13, 0], [2025, 12, 23, 13, 30]],
    ['17-10-2026', '12:00 PM - 12:30 PM', [2026, 10, 17, 12, 0], [2026, 10, 17, 12, 30]],
  ];
  for (const [date, time, start, end] of cases) {
    const parsed = d.parseExamDateTime(date, time);
    assert.ok(parsed, `Should parse ${date} ${time}`);
    assert.deepStrictEqual(istParts(parsed.start), start, `Start of ${date} ${time}`);
    assert.deepStrictEqual(istParts(parsed.end), end, `End of ${date} ${time}`);
  }
  assert.strictEqual(d.parseExamDateTime('TBD', '10:00 AM'), null, 'Unparseable dates return null');

  // Every exam in the bundled data must have a parseable date and time
  let unparsed = 0;
  for (const s of examData) {
    for (const e of [...(s.theory || []), ...(s.practical || [])]) {
      const p = d.parseExamDateTime(e.date, e.time);
      if (!p || !p.hasTime) unparsed++;
    }
  }
  assert.strictEqual(unparsed, 0, `All exams should have parseable date/time (found ${unparsed} unparsed)`);

  // Status + ordering
  const exam = { date: '10/10/2026', time: '10:00 AM - 10:30 AM' };
  const startMs = d.parseExamDateTime(exam.date, exam.time).start.getTime();
  assert.strictEqual(d.getExamStatus(exam, startMs - 3600000), 'today');
  assert.strictEqual(d.getExamStatus(exam, startMs + 60000), 'ongoing');
  assert.strictEqual(d.getExamStatus(exam, startMs + 3600000), 'completed');
  assert.strictEqual(d.getExamStatus(exam, startMs - 3 * 86400000), 'upcoming');

  const sorted = d.sortExams([
    { date: '10/10/2026', time: '01:00 PM - 01:30 PM', subject: 'C' },
    { date: 'TBD', time: '', subject: 'Z' },
    { date: '9/10/2026', time: '10:00 AM - 10:30 AM', subject: 'A' },
    { date: '10/10/2026', time: '10:00 AM - 10:30 AM', subject: 'B' },
  ]);
  assert.deepStrictEqual(sorted.map((e) => e.subject), ['A', 'B', 'C', 'Z'], 'Exams sort chronologically, unknown last');

  const timeline = d.buildTimeline(examData[0]);
  const flat = timeline.flatMap((g) => g.exams);
  assert.strictEqual(flat.length, (examData[0].theory || []).length + (examData[0].practical || []).length);
  for (let i = 1; i < flat.length; i++) {
    assert.ok(flat[i - 1].parsed.start <= flat[i].parsed.start, 'Timeline is chronological');
  }

  // ICS export
  const ics = generateICS(examData[0]);
  const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
  assert.strictEqual(events, flat.length, 'ICS has one event per exam');
  assert.strictEqual((ics.match(/^UID:/gm) || []).length, events, 'Every event has a UID');
  assert.ok(!/DTSTART:.*NaN/.test(ics), 'No invalid dates in ICS');
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75), 'ICS lines are folded to 75 chars');
  console.log(`✅ PASS: Date parsing, scheduling and ICS export tests passed (${cases.length} formats, ${flat.length} events)`);

  // Test 4: ATKT sheet parsing (synthetic data only, never real students)
  const { parseTab } = require('../server/utils/atkt.cjs');
  const sample = [
    'Re-exam Sem- 3 (2024-28),,,,,,,,,',
    'Subject Code,Subject,Name,Roll No.,No. of students for Re-exam,Exam Type,Date ,Time,Classroom no.,Faculty',
    '111,"Data Structures, II",Test Student A,100000000001,2,Theory ,17/11/26,10:00 AM - 10:30 AM,CR-1,Prof. X',
    ',,Test Student B,100000000002,,,,10:30 AM -11:00 AM,,',
    '222,Networking,Test Student A,100000000001,1,Practical,18/11/26,1:00 pm to 1:15 pm,,',
    ',,,,,,,,,',
    '333,German,Test Student C,100000000003,1,,,11:00 AM - 11: 30 AM,,',
  ].join('\n');
  const rows = parseTab(sample);
  assert.strictEqual(rows.length, 4, 'One entry per student per subject');
  const b = rows.find((r) => r.rollNo === '100000000002');
  assert.deepStrictEqual(
    [b.subject, b.date, b.time, b.examType, b.semester, b.batch, b.faculty],
    ['Data Structures, II', '17/11/26', '10:30 AM - 11:00 AM', 'Theory', 'Sem 3', '2024-28', 'Prof. X'],
    'Merged cells are carried down within a subject block'
  );
  const net = rows.find((r) => r.subject === 'Networking');
  assert.strictEqual(net.faculty, '', 'Carried values reset at a new subject block');
  assert.strictEqual(net.time, '1:00 PM - 1:15 PM', '"to" ranges are normalised');
  assert.strictEqual(rows.find((r) => r.subject === 'German').time, '11:00 AM - 11:30 AM', 'Stray spaces in times are fixed');
  assert.ok(rows.every((r) => !('name' in r) && !('noOfStudents' in r)), 'Names and class counts are never exposed');
  for (const r of rows.filter((x) => x.date)) {
    assert.ok(d.parseExamDateTime(r.date, r.time), `ATKT date/time parses: ${r.date} ${r.time}`);
  }
  // Tab names drive the semester / type tabs (they override copied title rows)
  const { parseTabName } = require('../server/utils/atkt.cjs');
  assert.deepStrictEqual(parseTabName('TH(Sem2)2025-29 '), { kind: 'Theory', semester: 'Sem 2', batch: '2025-29' });
  assert.deepStrictEqual(parseTabName('PE(SEM4)2024-28'), { kind: 'Project Eval', semester: 'Sem 4', batch: '2024-28' });
  assert.deepStrictEqual(parseTabName('Sheet1'), { kind: '', semester: '', batch: '' });
  const named = parseTab(sample, 'PE(Sem5)2024-28');
  assert.ok(named.every((r) => r.semester === 'Sem 5' && r.kind === 'Project Eval' && r.group === 'Sem 5 · Project Eval'), 'Tab name overrides the title row');
  assert.ok(parseTab(sample, 'Sheet1').every((r) => r.group === 'Sheet1'), 'Unknown tab names are used as-is');
  console.log(`✅ PASS: ATKT sheet parsing tests passed (${rows.length} entries, tab grouping)`);

  console.log('\n🎉 ALL CI/CD TESTS PASSED SUCCESSFULLY!');
})().catch((err) => {
  console.error('❌ FAIL:', err.message);
  process.exit(1);
});
