const BASE = '/api';

// Maps technical/backend error text into a message a non-technical user can
// understand, without hiding the real problem from developers (it's still
// logged to the browser console).
function toFriendlyMessage(res, rawError) {
  if (res.status === 404) {
    return "This feature couldn't be reached right now. Please refresh the page and try again.";
  }
  if (res.status === 429) {
    return "You're asking questions a bit too quickly. Please wait a moment and try again.";
  }
  if (res.status >= 500) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }
  // For 400/422 we trust the backend's message (it's already written to be
  // user-readable — e.g. "Only SELECT queries are permitted.")
  return rawError;
}

async function handleResponse(res) {
  let data = {};
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  } else {
    try {
      const text = await res.text();
      data = text ? { message: text } : {};
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const rawMessage =
      data.error ||
      data.message ||
      `Request failed with status ${res.status}`;

    console.error('API error:', res.status, rawMessage);
    throw new Error(toFriendlyMessage(res, rawMessage));
  }

  return data;
}

// Wraps fetch so that network failures (server down, no internet, CORS
// issues) also produce a friendly message instead of a raw browser error
// like "Failed to fetch".
async function safeFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    console.error('Network error:', networkErr);
    throw new Error(
      "Couldn't connect to the server. Please check that the backend is running and try again."
    );
  }
  return handleResponse(res);
}

export const api = {
  // Task 1: Courses
  createCourse: (payload) =>
    safeFetch(`${BASE}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  listCourses: () => safeFetch(`${BASE}/courses`),

  // Task 1: Students
  registerStudent: (payload) =>
    safeFetch(`${BASE}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  listStudents: () => safeFetch(`${BASE}/students`),

  // Task 1: Allocation
  processAllocation: () => safeFetch(`${BASE}/allocation/process`, { method: 'POST' }),
  getAllocationResults: () => safeFetch(`${BASE}/allocation/results`),

  getDashboard: () => safeFetch(`${BASE}/allocation/dashboard`),

  askAllocationAssistant: (question) =>
    safeFetch(`${BASE}/allocation/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }),

  // Task 2: Datasets
  uploadDataset: (file, datasetName) => {
    const formData = new FormData();
    formData.append('file', file);
    if (datasetName) formData.append('datasetName', datasetName);

    return safeFetch(`${BASE}/datasets/upload`, {
      method: 'POST',
      body: formData,
    });
  },

  listDatasets: () => safeFetch(`${BASE}/datasets`),

  askDataset: (datasetId, question) =>
    safeFetch(`${BASE}/datasets/${datasetId}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }),

  getDatasetHistory: (datasetId) =>
    safeFetch(`${BASE}/datasets/${datasetId}/history`),
};
