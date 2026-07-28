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
