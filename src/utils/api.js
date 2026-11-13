/**
 * API utility to query the Node.js/Express backend.
 * Uses JWT tokens for admin authentication — password is never stored client-side.
 */

// No hardcoded BASE_URL is needed!
// In development, Vite dev server proxies /api requests to localhost:5001.
// In production, the Express backend serves the static assets directly, meaning they share the same origin.
const API_BASE = '';

// --- JWT Token Management ---

const TOKEN_KEY = 'adminToken';

/**
 * Stores the JWT session token in sessionStorage.
 */
export function setAuthToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

/**
 * Retrieves the stored JWT session token.
 */
export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Clears the stored JWT session token (logout).
 */
export function clearAuthToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Checks if the user has a stored (potentially valid) token.
 */
export function hasAuthToken() {
  return !!getAuthToken();
}

/**
 * Returns the Authorization header object for authenticated requests.
 */
function getAuthHeaders() {
  const token = getAuthToken();
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

/**
 * In-memory cache filled from the API. Student data is no longer bundled into
 * the site (it used to ship ~1 MB of names to every visitor and live in the
 * public repo); the search index is a small, HTTP-cached API response.
 */
const studentCacheMap = new Map();
let searchIndexCache = [];
let serverCount = null;
const listeners = new Set();

const notify = () => listeners.forEach((fn) => {
  try { fn(searchIndexCache); } catch { /* ignore listener errors */ }
});

/** Subscribe to search-index refreshes. Returns an unsubscribe function. */
export function subscribeToIndex(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function toIndexEntry(s) {
  const name = s.name || '';
  const rollNo = String(s.rollNo);
  const cohort = s.cohort || '';
  return {
    name,
    rollNo,
    batch: s.batch,
    cohort,
    // Pre-normalised fields keep per-keystroke search cheap
    _name: name.toLowerCase(),
    _roll: rollNo.toLowerCase(),
    _cohort: cohort.toLowerCase(),
  };
}

function initCache(data) {
  if (!Array.isArray(data)) return;
  const newIndex = [];

  for (const s of data) {
    if (!s || !s.rollNo) continue;
    const rollStr = String(s.rollNo);
    const existing = studentCacheMap.get(rollStr);

    if (s.theory || s.practical || !existing) {
      studentCacheMap.set(rollStr, s);
    } else {
      // Metadata-only update: keep existing exam arrays
      studentCacheMap.set(rollStr, {
        ...existing,
        ...(s.cohort !== undefined && { cohort: s.cohort }),
        ...(s.batch !== undefined && { batch: s.batch }),
        ...(s.name !== undefined && { name: s.name }),
      });
    }
    newIndex.push(toIndexEntry(s));
  }

  newIndex.sort((a, b) => a.name.localeCompare(b.name));
  searchIndexCache = newIndex;
}



const hasExams = (s) => s && (Array.isArray(s.theory) || Array.isArray(s.practical));

/**
 * Ranks index entries against a query. Exact roll / name-prefix matches come
 * first, then word-prefix matches, then substring matches. Every word in the
 * query must match somewhere, so "rahul kum" finds "Rahul Kumar Singh".
 */
export function rankStudents(query, index = searchIndexCache, limit = 15) {
  const q = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (q.length < 2) return [];
  const words = q.split(' ');
  const scored = [];

  for (const s of index) {
    const name = s._name ?? (s.name || '').toLowerCase();
    const roll = s._roll ?? String(s.rollNo).toLowerCase();
    const cohort = s._cohort ?? (s.cohort || '').toLowerCase();
    let score = 0;

    if (roll === q) score = 1000;
    else if (roll.endsWith(q) && /^\d+$/.test(q)) score = 800; // last digits of roll no.
    else if (roll.startsWith(q)) score = 700;
    else if (name === q) score = 900;
    else if (name.startsWith(q)) score = 600;
    else if (roll.includes(q)) score = 300;
    else {
      const nameWords = name.split(/\s+/);
      let allMatch = true;
      let wordScore = 0;
      for (const w of words) {
        if (nameWords.some((nw) => nw.startsWith(w))) wordScore += 2;
        else if (name.includes(w)) wordScore += 1;
        else if (cohort.includes(w)) wordScore += 0.5;
        else { allMatch = false; break; }
      }
      if (allMatch) score = 100 + wordScore * 50;
    }

    if (score > 0) scored.push({ s, score });
  }

  scored.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
  return scored.slice(0, limit).map((x) => x.s);
}

// --- Public API Calls (No Auth Required) ---

/** Searches students by name, roll number, or cohort from the in-memory index. */
export async function searchStudents(query) {
  return rankStudents(query, searchIndexCache, 10).map((s) => studentCacheMap.get(s.rollNo) || s);
}

let indexRefresh = null;

function loadIndex() {
  if (!indexRefresh) {
    indexRefresh = fetch(`${API_BASE}/api/students/search-index`)
      .then((res) => {
        if (!res.ok) throw new Error(`Search index failed (${res.status})`);
        return res.json();
      })
      .then((serverIndex) => {
        if (Array.isArray(serverIndex) && serverIndex.length > 0) {
          initCache(serverIndex);
          serverCount = serverIndex.length;
          notify();
        }
        return searchIndexCache;
      })
      .catch((err) => {
        indexRefresh = null; // allow a retry on the next call
        throw err;
      });
  }
  return indexRefresh;
}

// Start downloading the index as soon as the app loads
if (typeof window !== 'undefined') loadIndex().catch(() => {});

/** True once the search index has been loaded from the server. */
export const isIndexReady = () => searchIndexCache.length > 0;

/**
 * Resolves with the search index (loading it on first use). Use
 * subscribeToIndex() to hear about later refreshes.
 */
export async function getSearchIndex() {
  if (searchIndexCache.length > 0) return searchIndexCache;
  try {
    return await loadIndex();
  } catch {
    return searchIndexCache;
  }
}

/** Gets a student's full schedule by roll number (cache first, server fallback). */
export async function getStudentByRoll(rollNo) {
  if (!rollNo) return null;
  const rollStr = String(rollNo).trim();
  const cached = studentCacheMap.get(rollStr);

  const fetchFresh = () =>
    fetch(`${API_BASE}/api/students/roll/${encodeURIComponent(rollStr)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((fresh) => {
        if (fresh && fresh.rollNo && hasExams(fresh)) {
          studentCacheMap.set(String(fresh.rollNo), fresh);
          return fresh;
        }
        return null;
      })
      .catch(() => null);

  if (!hasExams(cached)) {
    return (await fetchFresh()) || cached || null;
  }

  // Refresh in the background so the next view reflects server updates
  fetchFresh();
  return cached;
}

/** Total number of students (server count when available, cached otherwise). */
export async function getStudentCount() {
  if (serverCount !== null) return serverCount;
  try {
    const res = await fetch(`${API_BASE}/api/students/count`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.count === 'number' && data.count > 0) {
        serverCount = data.count;
        return serverCount;
      }
    }
  } catch {
    /* fall back to cache */
  }
  return studentCacheMap.size;
}

/** Health check for the header status pill. */
export async function checkServerHealth() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return data.db === 'connected';
  } catch {
    return false;
  }
}

/**
 * ATKT / re-exam entries for one roll number. Read live on the server from a
 * private sheet; nothing about ATKT is bundled into the site or cached here.
 * @returns {Promise<{exams: Array, updatedAt: string|null}>}
 */
export async function getAtkt(rollNo, { signal } = {}) {
  const roll = String(rollNo || '').trim();
  if (!/^\d{6,20}$/.test(roll)) return { exams: [], updatedAt: null };
  const res = await fetch(`${API_BASE}/api/atkt/${encodeURIComponent(roll)}`, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`ATKT lookup failed (${res.status})`);
  const data = await res.json();
  return { exams: Array.isArray(data.exams) ? data.exams : [], updatedAt: data.updatedAt || null };
}

/** Lists batches present in the data, newest first. */
export function getBatches() {
  const batches = new Set(searchIndexCache.map((s) => s.batch).filter(Boolean));
  return [...batches].sort().reverse();
}

// --- Admin API Calls (JWT Auth Required) ---

/**
 * Verifies the admin authorization password and stores the returned JWT token.
 * @param {string} password - Admin authorization password
 * @returns {Promise<Object>} - Success result with token
 */
export async function verifyPassword(password) {
  const response = await fetch(`${API_BASE}/api/students/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.details || data.error || 'Password verification failed');
  }
  // Store the JWT token — never the password
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

/**
 * Gets the current Google Sheets sync configuration from the server.
 * Requires JWT authentication.
 * @returns {Promise<Object>} - Config object with batches, useAi, hasApiKey
 */
export async function getSyncConfig() {
  const response = await fetch(`${API_BASE}/api/students/sync-config`, {
    headers: { ...getAuthHeaders() }
  });
  if (response.status === 401 || response.status === 403) {
    clearAuthToken();
    throw new Error('Session expired. Please log in again.');
  }
  if (!response.ok) {
    throw new Error('Failed to load sync configuration');
  }
  return await response.json();
}

/**
 * Uploads the 3 CSV file contents to process and sync the database.
 * Requires JWT authentication.
 */
export async function uploadAndSyncCsv(batch, mappingCsv, theoryCsv, practicalCsv) {
  try {
    const response = await fetch(`${API_BASE}/api/students/upload-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ batch, mappingCsv, theoryCsv, practicalCsv })
    });
    if (response.status === 401 || response.status === 403) {
      clearAuthToken();
      const data = await response.json().catch(() => ({}));
      throw new Error(data.details || 'Session expired. Please log in again.');
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload and sync CSV files');
    }
    return data;
  } catch (error) {
    console.error('Error in uploadAndSyncCsv API utility:', error);
    throw error;
  }
}

/**
 * Syncs the database with student schedules from Google Sheets.
 * Requires JWT authentication.
 */
export async function syncGoogleSheets(batch, mappingUrl, theoryUrl, practicalUrl, useAi, groqApiKey) {
  const response = await fetch(`${API_BASE}/api/students/sync-sheets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ batch, mappingUrl, theoryUrl, practicalUrl, useAi, groqApiKey })
  });
  if (response.status === 401 || response.status === 403) {
    clearAuthToken();
    const data = await response.json().catch(() => ({}));
    throw new Error(data.details || 'Session expired. Please log in again.');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to sync Google Sheets');
  }
  return data;
}

/**
 * Syncs ALL batches from saved Google Sheets links in one operation.
 * Requires JWT authentication.
 * @returns {Promise<Object>} - Results with total count, per-batch results, and any errors
 */
export async function syncAllSheets() {
  const response = await fetch(`${API_BASE}/api/students/sync-all-sheets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  });
  if (response.status === 401 || response.status === 403) {
    clearAuthToken();
    const data = await response.json().catch(() => ({}));
    throw new Error(data.details || 'Session expired. Please log in again.');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to sync all sheets');
  }
  return data;
}
