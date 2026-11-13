#!/usr/bin/env node
/**
 * ATKT sheet health check.
 *
 * Reads the private re-exam sheet exactly like the server does and reports,
 * per tab, how many entries parsed and which fields are still empty
 * (date, time, faculty, classroom). The site picks up anything filled in the
 * sheet automatically within ~60s; this script lets you confirm it parses.
 *
 * Usage:
 *   npm run atkt:check                 # summary of every tab
 *   npm run atkt:check -- --missing    # also list the subjects with empty fields
 *   npm run atkt:check -- --roll 1500967251XX   # entries for one roll number
 *   npm run atkt:check -- --watch      # re-check every 60s and report changes
 *
 * Needs ATKT_SHEET_ID in server/.env (never commit it).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const atkt = require('../server/utils/atkt.cjs');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};

const FIELDS = ['date', 'time', 'faculty', 'classroom'];
const pct = (n, d) => (d === 0 ? '  -' : `${String(Math.round((n / d) * 100)).padStart(3)}%`);

async function snapshot(parseExamDateTime) {
  const tabs = await atkt.readAllTabs();
  return tabs.map((tab) => {
    const filled = Object.fromEntries(FIELDS.map((f) => [f, tab.exams.filter((e) => e[f]).length]));
    const badTimes = tab.exams.filter((e) => e.date && e.time && !parseExamDateTime(e.date, e.time)?.hasTime);
    const missing = new Map();
    for (const e of tab.exams) {
      const empty = FIELDS.filter((f) => !e[f]);
      if (empty.length === 0) continue;
      const key = `${e.subject} (${e.subjectCode || 'no code'})`;
      const set = missing.get(key) || new Set();
      empty.forEach((f) => set.add(f));
      missing.set(key, set);
    }
    return {
      name: tab.name || '(unnamed tab)',
      ok: tab.ok,
      entries: tab.exams.length,
      students: new Set(tab.exams.map((e) => e.rollNo)).size,
      filled,
      badTimes,
      missing,
      exams: tab.exams,
    };
  });
}

function printReport(report) {
  console.log(`\nATKT sheet: ${report.length} tabs\n`);
  console.log('Tab                  Entries Students   Date   Time Faculty   Room');
  console.log('-------------------- ------- -------- ------ ------ ------- ------');
  let total = 0;
  for (const t of report) {
    total += t.entries;
    if (!t.ok) {
      console.log(`${t.name.padEnd(20)}  ✗ could not be read`);
      continue;
    }
    console.log(
      `${t.name.padEnd(20).slice(0, 20)} ${String(t.entries).padStart(7)} ${String(t.students).padStart(8)} ` +
      `${pct(t.filled.date, t.entries).padStart(6)} ${pct(t.filled.time, t.entries).padStart(6)} ` +
      `${pct(t.filled.faculty, t.entries).padStart(7)} ${pct(t.filled.classroom, t.entries).padStart(6)}`
    );
  }
  const students = new Set(report.flatMap((t) => t.exams.map((e) => e.rollNo))).size;
  console.log(`\nTotal: ${total} entries for ${students} students.`);

  const bad = report.flatMap((t) => t.badTimes.map((e) => `${t.name}: ${e.subject} | "${e.date}" "${e.time}"`));
  if (bad.length) {
    console.log(`\n⚠️  ${bad.length} entries have a date/time the site cannot read:`);
    bad.slice(0, 20).forEach((b) => console.log(`   ${b}`));
  } else {
    console.log('✅ Every filled date/time is readable by the site.');
  }

  if (flag('missing')) {
    console.log('\nSubjects with empty fields (shown as "To be announced" on the site):');
    for (const t of report) {
      if (t.missing.size === 0) continue;
      console.log(`\n  ${t.name}`);
      for (const [subject, fields] of t.missing) console.log(`    - ${subject}: ${[...fields].join(', ')}`);
    }
  }
}

function printRoll(report, roll) {
  const rows = report.flatMap((t) => t.exams.filter((e) => e.rollNo === roll));
  if (rows.length === 0) {
    console.log(`\nNo ATKT entries for ${roll}.`);
    return;
  }
  console.log(`\n${rows.length} ATKT entries for ${roll}:`);
  for (const e of rows) {
    console.log(`  [${e.group}] ${e.subject} | ${e.date || 'date TBA'} ${e.time || 'time TBA'} | ` +
      `faculty: ${e.faculty || 'TBA'} | room: ${e.classroom || 'TBA'}`);
  }
}

/** Compares two snapshots and prints newly filled / changed fields. */
function printChanges(prev, next) {
  const index = (rep) => new Map(rep.flatMap((t) => t.exams.map((e) => [`${e.rollNo}|${e.group}|${e.subjectCode}|${e.subject}|${e.examType}`, e])));
  const a = index(prev);
  const b = index(next);
  const changes = [];
  for (const [key, e] of b) {
    const old = a.get(key);
    if (!old) { changes.push(`+ new entry: ${e.group} ${e.subject}`); continue; }
    for (const f of FIELDS) {
      if (old[f] !== e[f]) changes.push(`~ ${e.group} ${e.subject}: ${f} "${old[f] || '—'}" → "${e[f] || '—'}"`);
    }
  }
  for (const [key, e] of a) if (!b.has(key)) changes.push(`- removed: ${e.group} ${e.subject}`);
  const unique = [...new Set(changes)];
  const stamp = new Date().toLocaleTimeString('en-IN');
  if (unique.length === 0) console.log(`[${stamp}] no changes`);
  else {
    console.log(`[${stamp}] ${unique.length} change(s):`);
    unique.slice(0, 50).forEach((c) => console.log(`   ${c}`));
  }
}

async function main() {
  if (!atkt.isConfigured()) {
    console.error('ATKT_SHEET_ID is not set. Add it to server/.env (see server/.env.example).');
    process.exit(1);
  }
  const { parseExamDateTime } = await import('../src/utils/dateUtils.js');

  let report = await snapshot(parseExamDateTime);
  const roll = option('roll');
  if (roll) printRoll(report, roll.trim());
  else printReport(report);

  if (flag('watch')) {
    console.log('\nWatching the sheet every 60s (Ctrl+C to stop)...');
    setInterval(async () => {
      try {
        const next = await snapshot(parseExamDateTime);
        printChanges(report, next);
        report = next;
      } catch (err) {
        console.warn(`[${new Date().toLocaleTimeString('en-IN')}] read failed: ${err.message}`);
      }
    }, 60 * 1000);
  }
}

main().catch((err) => {
  console.error('ATKT check failed:', err.message);
  process.exit(1);
});
