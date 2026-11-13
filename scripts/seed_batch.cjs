#!/usr/bin/env node
/**
 * Safely adds/updates one batch in MongoDB from the local (gitignored)
 * src/data/exam_data.json. Never deletes anything.
 *
 * Student data is no longer bundled into the site, so every student must
 * exist in the database to be searchable.
 *
 * - Upserts by roll number (insert new, update existing of the same batch)
 * - Skips roll numbers that already belong to a DIFFERENT batch, and lists
 *   them so you can decide manually
 *
 * Usage:
 *   node scripts/seed_batch.cjs --batch 2026-30 --dry-run   # report only, writes nothing
 *   node scripts/seed_batch.cjs --batch 2026-30             # apply
 *
 * Uses MONGODB_URI from server/.env.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const mongoose = require('mongoose');
const Student = require('../server/models/Student.cjs');

const args = process.argv.slice(2);
const batchIdx = args.indexOf('--batch');
const batch = batchIdx !== -1 ? args[batchIdx + 1] : null;
const dryRun = args.includes('--dry-run');

async function main() {
  if (!batch || !/^20\d{2}-\d{2}$/.test(batch)) {
    console.error('Usage: node scripts/seed_batch.cjs --batch 2026-30 [--dry-run]');
    process.exit(1);
  }
  const dataPath = path.join(__dirname, '../src/data/exam_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('No local src/data/exam_data.json found.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in server/.env');
    process.exit(1);
  }

  const records = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
    .filter((s) => s.batch === batch && s.rollNo && s.name)
    .map(({ _id, __v, createdAt, updatedAt, ...rest }) => ({ ...rest, rollNo: String(rest.rollNo) }));

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const rolls = records.map((r) => r.rollNo);
    const existing = await Student.find({ rollNo: { $in: rolls } }, 'rollNo batch').lean();
    const existingBatch = new Map(existing.map((s) => [String(s.rollNo), s.batch]));

    const conflicts = records.filter((r) => existingBatch.has(r.rollNo) && existingBatch.get(r.rollNo) !== batch);
    const toInsert = records.filter((r) => !existingBatch.has(r.rollNo));
    const toUpdate = records.filter((r) => existingBatch.get(r.rollNo) === batch);

    console.log(`Batch ${batch}: ${records.length} records in local data`);
    console.log(`  in DB already (same batch, will update): ${toUpdate.length}`);
    console.log(`  new (will insert):                      ${toInsert.length}`);
    console.log(`  skipped, roll no. used by another batch: ${conflicts.length}`);
    conflicts.forEach((r) => console.log(`    - ${r.rollNo} is in ${existingBatch.get(r.rollNo)} in the DB`));
    console.log(`  DB total before: ${await Student.countDocuments()}`);

    if (dryRun) {
      console.log('\nDry run: nothing was written.');
      return;
    }

    const ops = [...toInsert, ...toUpdate].map((doc) => ({
      replaceOne: { filter: { rollNo: doc.rollNo }, replacement: doc, upsert: true },
    }));
    if (ops.length) await Student.bulkWrite(ops, { ordered: false });
    console.log(`\nWrote ${ops.length} records. DB total now: ${await Student.countDocuments()}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
