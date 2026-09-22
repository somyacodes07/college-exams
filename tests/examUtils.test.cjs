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
assert.strictEqual(examData.length, 593, 'Should contain 593 student records');

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

console.log('\n🎉 ALL CI/CD TESTS PASSED SUCCESSFULLY!');
