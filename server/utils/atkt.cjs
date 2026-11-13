/**
 * ATKT / re-exam lookup, read live from a private Google Sheet.
 *
 * - The sheet ID comes only from the ATKT_SHEET_ID env var. It is never sent
 *   to the browser, logged, or included in error messages.
 * - Every tab of the sheet is read (new tabs are picked up automatically).
 * - Results are cached in memory for ATKT_CACHE_SECONDS (default 60s), so
 *   edits to the sheet show up on the site within about a minute.
 * - Only the rows for one exact roll number are ever returned.
 */

const SHEET_ID = (process.env.ATKT_SHEET_ID || '').trim();
const CACHE_MS = Math.max(15, parseInt(process.env.ATKT_CACHE_SECONDS || '60', 10) || 60) * 1000;
const TAB_LIST_CACHE_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;

let tabsCache = { tabs: null, at: 0 };
let dataCache = { byRoll: null, at: 0, updatedAt: null };
let inflight = null;

const isConfigured = () => /^[a-zA-Z0-9_-]{20,}$/.test(SHEET_ID);

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`Sheet request failed (${res.status})`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** RFC 4180 CSV parser (handles quotes, escaped quotes and newlines in cells). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * Discovers every tab of the sheet as { gid, name }. Tab names (e.g.
 * "TH(Sem2)2025-29") drive the grouping shown to students. Falls back to
 * ATKT_SHEET_GIDS or the first tab if the sheet's HTML view can't be read.
 */
async function getTabs() {
  if (tabsCache.tabs && Date.now() - tabsCache.at < TAB_LIST_CACHE_MS) return tabsCache.tabs;
  let tabs = [];
  try {
    const html = await fetchText(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`);
    for (const m of html.matchAll(/name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"/g)) {
      const name = m[1].replace(/\\(.)/g, '$1').trim();
      if (!tabs.some((t) => t.gid === m[2])) tabs.push({ gid: m[2], name });
    }
    if (tabs.length === 0) {
      tabs = [...new Set([...html.matchAll(/[?&#]gid=(\d+)/g)].map((m) => m[1]))].map((gid) => ({ gid, name: '' }));
    }
  } catch {
    tabs = [];
  }
  if (tabs.length === 0) {
    const envGids = (process.env.ATKT_SHEET_GIDS || '').split(',').map((g) => g.trim()).filter((g) => /^\d+$/.test(g));
    tabs = envGids.length ? envGids.map((gid) => ({ gid, name: '' })) : tabsCache.tabs || [{ gid: '0', name: '' }];
  }
  tabsCache = { tabs, at: Date.now() };
  return tabs;
}

const KIND_LABELS = { TH: 'Theory', PE: 'Project Eval', PR: 'Practical', PRAC: 'Practical', VIVA: 'Viva' };

/**
 * Reads tab names like "TH(Sem2)2025-29" / "PE(SEM4)2024-28".
 * @returns {{kind: string, semester: string, batch: string}}
 */
function parseTabName(name) {
  const n = String(name || '');
  const kindCode = (n.match(/^\s*([A-Za-z]+)/) || [])[1]?.toUpperCase() || '';
  const sem = n.match(/sem(?:ester)?\s*[-:.]?\s*(\d+)/i);
  const batch = n.match(/(20\d{2})\s*[-–]\s*(\d{2,4})/);
  return {
    kind: KIND_LABELS[kindCode] || '',
    semester: sem ? `Sem ${sem[1]}` : '',
    batch: batch ? `${batch[1]}-${batch[2].slice(-2)}` : '',
  };
}

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** Maps a header label to a field name. */
function fieldFor(header) {
  const h = header.toLowerCase().replace(/[^a-z]/g, '');
  if (!h) return null;
  if (h.includes('roll')) return 'rollNo';
  if (h === 'name' || h.includes('studentname')) return 'name';
  if (h.includes('subjectcode') || h === 'code') return 'subjectCode';
  if (h.includes('subject')) return 'subject';
  if (h.includes('noofstudent') || h.includes('numberofstudent')) return null; // never exposed
  if (h.includes('examtype') || h === 'type') return 'examType';
  if (h.includes('date')) return 'date';
  if (h.includes('time') || h.includes('slot')) return 'time';
  if (h.includes('classroom') || h.includes('room') || h.includes('venue') || h.includes('location')) return 'classroom';
  if (h.includes('faculty') || h.includes('invigilator') || h.includes('professor') || h.includes('examiner')) return 'faculty';
  return null;
}

/** Reads "Re-exam Sem- 3 (2024-28)" style titles. */
function parseTitle(rows, headerIndex) {
  const title = rows.slice(0, headerIndex).flat().map(clean).find(Boolean) || '';
  const sem = title.match(/sem(?:ester)?\s*[-:.]?\s*(\d+)/i);
  const batch = title.match(/(20\d{2})\s*[-–]\s*(\d{2,4})/);
  return {
    title,
    semester: sem ? `Sem ${sem[1]}` : '',
    batch: batch ? `${batch[1]}-${batch[2].slice(-2)}` : '',
  };
}

/**
 * Parses one tab. Merged cells arrive as blanks, so shared values (subject,
 * date, time, ...) are carried down until the next subject block starts.
 */
function parseTab(csvText, tabName = '') {
  const rows = parseCsv(csvText);
  const headerIndex = rows.findIndex((r) => r.some((c) => /roll/i.test(c)));
  if (headerIndex === -1) return [];

  const fields = rows[headerIndex].map((h) => fieldFor(clean(h)));
  if (!fields.includes('rollNo')) return [];
  // The tab name is more reliable than the title row (titles are sometimes copied between tabs)
  const fromTitle = parseTitle(rows, headerIndex);
  const fromName = parseTabName(tabName);
  const semester = fromName.semester || fromTitle.semester;
  const batch = fromName.batch || fromTitle.batch;
  const kind = fromName.kind;
  const group = (kind && semester ? `${semester} · ${kind}` : '') || clean(tabName) || fromTitle.title || 'Re-exams';

  const carried = ['subjectCode', 'subject', 'examType', 'date', 'time', 'classroom', 'faculty'];
  let current = {};
  const out = [];

  for (const r of rows.slice(headerIndex + 1)) {
    const rec = {};
    fields.forEach((f, i) => {
      if (f && rec[f] === undefined) rec[f] = clean(r[i]);
    });

    // A new subject block resets the carried-down values
    if (rec.subjectCode || rec.subject) current = {};
    for (const key of carried) {
      if (rec[key]) current[key] = rec[key];
      else if (current[key]) rec[key] = current[key];
    }

    const rollNo = (rec.rollNo || '').replace(/\s+/g, '');
    if (!/^\d{6,20}$/.test(rollNo) || !rec.subject) continue;

    out.push({
      rollNo,
      group,
      kind,
      semester,
      batch,
      subject: rec.subject,
      subjectCode: rec.subjectCode || '',
      examType: rec.examType || '',
      date: rec.date || '',
      time: (rec.time || '').replace(/\s+to\s+/i, ' - ').replace(/(\d)\s*:\s*(\d)/g, '$1:$2').toUpperCase().replace(/\s*[-–—]\s*/, ' - '),
      classroom: rec.classroom || '',
      faculty: rec.faculty || '',
    });
  }
  return out;
}

async function loadAll() {
  const tabs = await getTabs();
  const results = await Promise.allSettled(
    tabs.map((t) => fetchText(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${t.gid}`))
  );

  if (!results.some((r) => r.status === 'fulfilled')) throw new Error('Could not read the ATKT sheet');

  const byRoll = new Map();
  results.forEach((res, i) => {
    if (res.status !== 'fulfilled') return;
    for (const exam of parseTab(res.value, tabs[i].name)) {
      const { rollNo, ...rest } = exam;
      const list = byRoll.get(rollNo) || [];
      const key = `${rest.group}|${rest.subjectCode}|${rest.subject}|${rest.examType}|${rest.date}|${rest.time}`;
      if (!list.some((e) => e._key === key)) list.push({ ...rest, _key: key });
      byRoll.set(rollNo, list);
    }
  });
  for (const list of byRoll.values()) list.forEach((e) => delete e._key);
  return byRoll;
}

/** Returns the cached map, refreshing it when stale (stale data is served if a refresh fails). */
async function getData() {
  const fresh = dataCache.byRoll && Date.now() - dataCache.at < CACHE_MS;
  if (fresh) return dataCache;

  if (!inflight) {
    inflight = loadAll()
      .then((byRoll) => {
        dataCache = { byRoll, at: Date.now(), updatedAt: new Date().toISOString() };
      })
      .catch((err) => {
        console.warn('ATKT sheet refresh failed:', err.message);
        if (dataCache.byRoll) dataCache.at = Date.now() - CACHE_MS + 15000; // retry in 15s
        else throw err;
      })
      .finally(() => { inflight = null; });
  }
  if (dataCache.byRoll) return dataCache; // serve stale while refreshing
  await inflight;
  return dataCache;
}

/** ATKT exams for one roll number (empty array when the student has none). */
async function getAtktForRoll(rollNo) {
  const { byRoll, updatedAt } = await getData();
  return { exams: byRoll.get(String(rollNo)) || [], updatedAt };
}

module.exports = { isConfigured, getAtktForRoll, parseTab, parseCsv, parseTabName };
