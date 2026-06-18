const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getCsvUrl, fetchCsvText, parseCsvData } = require('../server/utils/parser.cjs');
const Student = require('../server/models/Student.cjs');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exam_scheduler';

async function syncAll() {
  const configPath = path.join(__dirname, '../server/config.json');
  if (!fs.existsSync(configPath)) {
    console.error('No saved sync configuration found.');
    process.exit(1);
  }

  const rawConfig = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(rawConfig);

  if (!config.batches) {
    console.error('Sync configuration is missing batch data.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully.');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }

  let totalCount = 0;

  for (const [batch, urls] of Object.entries(config.batches)) {
    if (!urls.theoryUrl || !urls.practicalUrl) {
      console.log(`Missing Theory or Practical URL for batch ${batch} — skipped.`);
      continue;
    }

    try {
      const mappingExport = urls.mappingUrl ? getCsvUrl(urls.mappingUrl) : '';
      const theoryExport = getCsvUrl(urls.theoryUrl);
      const practicalExport = getCsvUrl(urls.practicalUrl);

      console.log(`[Sync All] Fetching data for batch ${batch}...`);
      const [mappingCsv, theoryCsv, practicalCsv] = await Promise.all([
        mappingExport ? fetchCsvText(mappingExport) : Promise.resolve(''),
        fetchCsvText(theoryExport),
        fetchCsvText(practicalExport)
      ]);

      const finalApiKey = process.env.GROQ_API_KEY;
      const studentsData = await parseCsvData(mappingCsv, theoryCsv, practicalCsv, {
        batch,
        useAi: !!config.useAi,
        groqApiKey: finalApiKey
      });

      if (!studentsData || studentsData.length === 0) {
        console.log(`[Sync All] Batch ${batch}: Parsed 0 student records.`);
        continue;
      }

      await Student.deleteMany({ batch });
      const inserted = await Student.insertMany(studentsData);
      totalCount += inserted.length;
      console.log(`[Sync All] Batch ${batch}: ${inserted.length} students synced.`);
    } catch (err) {
      console.error(`[Sync All] Error syncing batch ${batch}:`, err.message);
    }
  }

  console.log(`\n🎉 Synced ${totalCount} total students.`);
  await mongoose.connection.close();
}

syncAll();
