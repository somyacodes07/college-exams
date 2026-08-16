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
assert.strictEqual(examData.length, 394, 'Should contain 394 student records');

let invalidRecords = 0;
for (const student of examData) {
  if (!student.rollNo || !student.name) {
    invalidRecords++;
  }
}
assert.strictEqual(invalidRecords, 0, 'All student records must have valid rollNo and name');
console.log('✅ PASS: Data integrity test passed (394 valid student records)');

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
