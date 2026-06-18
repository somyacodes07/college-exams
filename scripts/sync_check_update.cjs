const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const Student = require('../server/models/Student.cjs');
const { getCsvUrl, fetchCsvText, parseCsvData } = require('../server/utils/parser.cjs');

const MONGODB_URI = process.env.MONGODB_URI;
const CONFIG_PATH = path.join(__dirname, '../server/config.json');

function normalizeStudent(student) {
  const cleanExam = (exam) => ({
    date: exam.date || '',
    subject: exam.subject || '',
    time: exam.time || '',
    location: exam.location || 'TBD',
    type: exam.type || '',
    panel: exam.panel || '',
    professor: exam.professor || '',
  });

  return {
    rollNo: String(student.rollNo).trim(),
    name: String(student.name).trim(),
    batch: String(student.batch).trim(),
    theory: Array.isArray(student.theory) ? student.theory.map(cleanExam).sort((a, b) => a.subject.localeCompare(b.subject) || a.date.localeCompare(b.date)) : [],
    practical: Array.isArray(student.practical) ? student.practical.map(cleanExam).sort((a, b) => a.subject.localeCompare(b.subject) || a.date.localeCompare(b.date)) : [],
  };
}

async function syncAndCheck() {
  if (!MONGODB_URI) {
    console.error('🔴 Error: MONGODB_URI is not set in server/.env');
    process.exit(1);
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('🔴 Error: Config file not found at:', CONFIG_PATH);
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    console.error('🔴 Error parsing config.json:', err.message);
    process.exit(1);
  }

  if (!config.batches) {
    console.error('🔴 Error: No batches found in config.json');
    process.exit(1);
  }

  // Connect to MongoDB
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully to MongoDB.');
  } catch (err) {
    console.error('🔴 Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  let totalUpdates = 0;

  for (const [batch, urls] of Object.entries(config.batches)) {
    console.log(`\n--- Checking Batch ${batch} ---`);
    if (!urls.theoryUrl || !urls.practicalUrl) {
      console.log(`⚠️ Missing Theory or Practical URL for batch ${batch}. Skipping.`);
      continue;
    }

    try {
      // 1. Fetch from URLs
      const mappingExport = urls.mappingUrl ? getCsvUrl(urls.mappingUrl) : '';
      const theoryExport = getCsvUrl(urls.theoryUrl);
      const practicalExport = getCsvUrl(urls.practicalUrl);

      console.log(`Fetching Google Sheets data for batch ${batch}...`);
      const [mappingCsv, theoryCsv, practicalCsv] = await Promise.all([
        mappingExport ? fetchCsvText(mappingExport) : Promise.resolve(''),
        fetchCsvText(theoryExport),
        fetchCsvText(practicalExport)
      ]);

      const groqApiKey = process.env.GROQ_API_KEY;
      const parsedStudents = await parseCsvData(mappingCsv, theoryCsv, practicalCsv, {
        batch,
        useAi: !!config.useAi,
        groqApiKey
      });

      console.log(`Parsed ${parsedStudents.length} students from Google Sheets.`);

      // 2. Fetch current database records for this batch
      const dbStudents = await Student.find({ batch }).lean();
      console.log(`Found ${dbStudents.length} students in the database for batch ${batch}.`);

      // 3. Compare data
      const normalizedParsed = parsedStudents.map(normalizeStudent).sort((a, b) => a.rollNo.localeCompare(b.rollNo));
      const normalizedDb = dbStudents.map(normalizeStudent).sort((a, b) => a.rollNo.localeCompare(b.rollNo));

      const parsedStr = JSON.stringify(normalizedParsed);
      const dbStr = JSON.stringify(normalizedDb);

      if (parsedStr === dbStr) {
        console.log(`✅ No changes detected for batch ${batch}. Database is up-to-date.`);
      } else {
        console.log(`🔄 Changes detected for batch ${batch}!`);
        
        // Let's print some details on the changes
        if (parsedStudents.length !== dbStudents.length) {
          console.log(`   Difference: Student count changed from ${dbStudents.length} to ${parsedStudents.length}`);
        } else {
          // Identify which students changed
          const dbMap = new Map(normalizedDb.map(s => [s.rollNo, s]));
          let diffCount = 0;
          for (const s of normalizedParsed) {
            const dbMatch = dbMap.get(s.rollNo);
            if (!dbMatch) {
              console.log(`   New student: Roll ${s.rollNo} (${s.name})`);
              diffCount++;
            } else if (JSON.stringify(s) !== JSON.stringify(dbMatch)) {
              console.log(`   Schedule updated: Roll ${s.rollNo} (${s.name})`);
              diffCount++;
              if (diffCount < 5) {
                // Show brief diff of exams if small count
                console.log(`     DB Theory:`, dbMatch.theory.length, `vs Sheets:`, s.theory.length);
                console.log(`     DB Practical:`, dbMatch.practical.length, `vs Sheets:`, s.practical.length);
              }
            }
          }
        }

        // 4. Update the database
        console.log(`Updating database for batch ${batch}...`);
        await Student.deleteMany({ batch });
        const inserted = await Student.insertMany(parsedStudents);
        console.log(`✅ Successfully updated database with ${inserted.length} students for batch ${batch}.`);
        totalUpdates++;
      }
    } catch (err) {
      console.error(`🔴 Error processing batch ${batch}:`, err.message);
    }
  }

  console.log(`\n--- Sync Summary ---`);
  if (totalUpdates > 0) {
    console.log(`🎉 Database update completed. ${totalUpdates} batch(es) updated.`);
  } else {
    console.log(`✅ All batches are already up-to-date. No database write operations were performed.`);
  }

  await mongoose.disconnect();
  console.log('MongoDB connection closed.');
}

syncAndCheck();
