#!/usr/bin/env node
/**
 * Read-only data audit of the students in MongoDB. Writes nothing.
 *
 * Checks:
 *  - roll numbers: format, entry year vs batch, provisional / placeholder IDs
 *  - names: duplicates within and across batches, stray spaces, all-lowercase
 *  - exams: missing subject/date/time, unreadable date/time, duplicates,
 *    students with no exams
 *
 * Usage:
 *   node scripts/audit_data.cjs              # summary + details
 *   node scripts/audit_data.cjs --fix-names  # ALSO tidy name spacing/casing in the DB
 *                                            # (the only thing this script ever writes)
 *   node scripts/audit_data.cjs --summary  # counts only
 *
 * Output contains student names: keep it local, don't paste it into the repo.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const mongoose = require('mongoose');
const Student = require('../server/models/Student.cjs');

const summaryOnly = process.argv.includes('--summary');
const fixNames = process.argv.includes('--fix-names');
const { tidyName } = require('../server/utils/parser.cjs');
const norm = (n) => String(n || '').toLowerCase().replace(/[^a-z]/g, '');

async function main() {
  const { parseExamDateTime } = await import('../src/utils/dateUtils.js');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  let students = await Student.find({}).lean();

  if (fixNames) {
    const changes = students.filter((s) => s.name && tidyName(s.name) !== s.name);
    for (const s of changes) {
      console.log(`  fix name: "${s.name}" -> "${tidyName(s.name)}"`);
      await Student.updateOne({ _id: s._id }, { $set: { name: tidyName(s.name) } });
    }
    console.log(`Fixed ${changes.length} name(s).`);
    students = await Student.find({}).lean();
  }
  await mongoose.disconnect();

  const issues = {}; // category -> [lines]
  const add = (cat, line) => (issues[cat] = issues[cat] || []).push(line);
  const label = (s) => `${s.officialRollNo || s.rollNo} ${s.name} (${s.batch})`;

  const byBatch = {};
  const byName = new Map();
  const official = new Map();

  for (const s of students) {
    byBatch[s.batch] = (byBatch[s.batch] || 0) + 1;
    const roll = String(s.officialRollNo || s.rollNo);

    // --- roll numbers
    if (s.rollPending) add('Provisional roll number (awaiting official list)', `${label(s)} — shares roll with another student`);
    else if (/^EXT-/.test(s.rollNo)) add('Placeholder (name not in roll list)', label(s));
    else if (!/^\d{12}$/.test(roll)) add('Unusual roll number format', label(s));
    if (/^\d{12}$/.test(roll)) {
      const entryYear = roll.slice(7, 9);
      const batchYear = String(s.batch || '').slice(2, 4);
      if (batchYear && entryYear !== batchYear) {
        const lateral = Number(entryYear) === Number(batchYear) + 1;
        add(lateral ? 'Roll year = batch + 1 (direct second-year entry?)' : 'Roll year does not match batch', label(s));
      }
    }
    official.set(roll, [...(official.get(roll) || []), s]);

    // --- names
    if (!s.name || !s.name.trim()) add('Missing name', label(s));
    else {
      if (s.name !== s.name.trim() || /\s{2,}/.test(s.name)) add('Name has extra spaces', label(s));
      if (s.name === s.name.toLowerCase()) add('Name is all lowercase', label(s));
      if (s.name.trim().split(/\s+/).length === 1) add('Single-word name (surname missing?)', label(s));
      const key = norm(s.name);
      byName.set(key, [...(byName.get(key) || []), s]);
    }

    // --- exams
    const exams = [
      ...(s.theory || []).map((e) => ({ ...e, kind: 'theory' })),
      ...(s.practical || []).map((e) => ({ ...e, kind: 'practical' })),
    ];
    if (exams.length === 0) add('No exams at all', label(s));
    else if ((s.theory || []).length === 0) add('No theory exams (only practicals)', label(s));
    const seen = new Set();
    for (const e of exams) {
      if (!e.subject || !e.date || !e.time) add('Exam missing subject/date/time', `${label(s)}: ${e.kind} "${e.subject || '?'}" ${e.date || '?'} ${e.time || '?'}`);
      else if (!parseExamDateTime(e.date, e.time)?.hasTime) add('Unreadable exam date/time', `${label(s)}: "${e.date}" "${e.time}"`);
      const k = `${e.kind}|${e.subject}|${e.date}|${e.time}`;
      if (seen.has(k)) add('Duplicate exam for a student', `${label(s)}: ${e.subject} ${e.date} ${e.time}`);
      seen.add(k);
    }
  }

  for (const [roll, list] of official) {
    if (list.length > 1) add('Roll number used by more than one person', `${roll}: ${list.map((s) => `${s.name} (${s.batch})`).join(' / ')}`);
  }
  for (const list of byName.values()) {
    if (list.length > 1) add('Same name appears more than once', list.map(label).join('  |  '));
  }

  console.log(`\nData audit — ${students.length} students`);
  console.log('By batch:', Object.entries(byBatch).sort().map(([b, n]) => `${b}: ${n}`).join(', '));
  const cats = Object.keys(issues).sort((a, b) => issues[b].length - issues[a].length);
  if (cats.length === 0) {
    console.log('\n✅ No issues found.');
    return;
  }
  console.log('\nIssues:');
  for (const c of cats) console.log(`  ${String(issues[c].length).padStart(4)}  ${c}`);
  if (summaryOnly) return;
  for (const c of cats) {
    console.log(`\n== ${c} (${issues[c].length})`);
    issues[c].slice(0, 40).forEach((l) => console.log(`   ${l}`));
    if (issues[c].length > 40) console.log(`   ... and ${issues[c].length - 40} more`);
  }
}

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
