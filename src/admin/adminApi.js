async function call(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || `请求失败 (${response.status})`);
    error.status = response.status;
    error.details = body.details || [];
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const login = (body) => call('/api/login', json('POST', body));
export const logout = () => call('/api/logout', { method: 'POST' });
export const getConfig = () => call('/api/admin/config');
export const saveConfig = (body) => call('/api/admin/config', json('PUT', body));
export const listUploads = () => call('/api/admin/uploads');
export const deleteUpload = (name) => call(`/api/admin/uploads/${encodeURIComponent(name)}`, { method: 'DELETE' });
export function uploadFile(file) {
  const body = new FormData();
  body.append('file', file);
  return call('/api/admin/upload', { method: 'POST', body });
}

export function listRecognitionBatches() {
  return call('/api/admin/score-recognition/batches');
}
export function getRecognitionBatch(id) {
  return call('/api/admin/score-recognition/batches/' + encodeURIComponent(id));
}
export function uploadRecognitionBatch(date, raceType, files, multiMatch = false) {
  const body = new FormData();
  body.append('date', date);
  body.append('raceType', raceType);
  if (multiMatch) body.append('multiMatch', 'true');
  files.forEach((file) => body.append('files', file));
  return call('/api/admin/score-recognition/batches', { method: 'POST', body });
}
export function processRecognitionBatch(id) {
  return call('/api/admin/score-recognition/batches/' + encodeURIComponent(id) + '/process', { method: 'POST' });
}
export function commitRecognitionBatch(id, rosterVersion) {
  return call('/api/admin/score-recognition/batches/' + encodeURIComponent(id) + '/commit', json('POST', { rosterVersion }));
}
export function reviewRecognitionEvidence(id, change) {
  return call(
    '/api/admin/score-recognition/batches/' + encodeURIComponent(id) + '/review',
    json('PUT', change),
  );
}
export function retryRecognitionBatch(id) {
  return call('/api/admin/score-recognition/batches/' + encodeURIComponent(id) + '/retry', { method: 'POST' });
}
export function rematchRecognitionBatch(id) {
  return call('/api/admin/score-recognition/batches/' + encodeURIComponent(id) + '/rematch', { method: 'POST' });
}
