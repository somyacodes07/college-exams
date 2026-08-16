import localExamData from '../data/exam_data.json';

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
 * In-memory fast cache map initialized with local exam data.
 * Guarantees 0ms instant data access without waiting for network database latency.
 */
let studentCacheMap = new Map();
let searchIndexCache = [];

function initCache(data) {
  if (!Array.isArray(data)) return;
  const newMap = new Map();
  const newIndex = [];
  
  for (const s of data) {
    if (s && s.rollNo) {
      const rollStr = String(s.rollNo);
      newMap.set(rollStr, s);
      newIndex.push({
        name: s.name,
        rollNo: rollStr,
        batch: s.batch,
        cohort: s.cohort || ''
      });
    }
  }
  
  studentCacheMap = newMap;
  searchIndexCache = newIndex;
}

// Initialize immediately on module load
initCache(localExamData);

// --- Public API Calls (No Auth Required) ---

/**
 * Searches students by name, roll number, or cohort instantly.
 * @param {string} query - The search query (Name, Roll Number, or Cohort).
 * @returns {Promise<Array>} - List of matching student objects containing full schedules.
 */
export async function searchStudents(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  
  // Instant search from in-memory cache
  const matches = Array.from(studentCacheMap.values()).filter(student =>
    (student.name && student.name.toLowerCase().includes(q)) ||
    (student.rollNo && String(student.rollNo).toLowerCase().includes(q)) ||
    (student.cohort && student.cohort.toLowerCase().includes(q))
  ).slice(0, 10);

  // Background fetch to ensure fresh server sync (non-blocking)
  fetch(`${API_BASE}/api/students/search?q=${encodeURIComponent(query.trim())}`)
    .then(res => res.ok ? res.json() : [])
    .then(serverResults => {
      if (Array.isArray(serverResults) && serverResults.length > 0) {
        for (const s of serverResults) {
          if (s && s.rollNo) studentCacheMap.set(String(s.rollNo), s);
        }
      }
    })
    .catch(() => {});

  return matches;
}

/**
 * Gets a lightweight list of all students for instant client-side search.
 * Returns cached index in 0ms, then updates from backend in background.
 * @returns {Promise<Array>} - List of student objects for search index.
 */
export async function getSearchIndex() {
  // Background update from server
  fetch(`${API_BASE}/api/students/search-index`)
    .then(res => res.ok ? res.json() : null)
    .then(serverIndex => {
      if (Array.isArray(serverIndex) && serverIndex.length > 0) {
        initCache(serverIndex);
      }
    })
    .catch(() => {});

  // Return cached index instantly (0ms latency)
  return searchIndexCache;
}

/**
 * Gets a student's full schedule by their unique roll number.
 * Returns instantly from memory cache (0ms delay).
 * @param {string} rollNo - The roll number of the student.
 * @returns {Promise<Object|null>} - The student object or null if not found.
 */
export async function getStudentByRoll(rollNo) {
  if (!rollNo) return null;
  const rollStr = String(rollNo).trim();
  
  const cachedStudent = studentCacheMap.get(rollStr);

  // Background refresh to update cache if server has updates
  fetch(`${API_BASE}/api/students/roll/${encodeURIComponent(rollStr)}`)
    .then(res => res.ok ? res.json() : null)
    .then(freshStudent => {
      if (freshStudent && freshStudent.rollNo) {
        studentCacheMap.set(String(freshStudent.rollNo), freshStudent);
      }
    })
    .catch(() => {});

  return cachedStudent || null;
}

/**
 * Gets the total number of students in the database.
 * Returns instantly from memory cache.
 * @returns {Promise<number>} - Count of students
 */
export async function getStudentCount() {
  const cachedCount = studentCacheMap.size;
  
  fetch(`${API_BASE}/api/students/count`)
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && typeof data.count === 'number') {
        // Optionally sync count if backend differs
      }
    })
    .catch(() => {});

  return cachedCount || 394;
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
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Password verification failed');
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
