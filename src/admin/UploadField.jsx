import { useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadFile } from './adminApi.js';

export function UploadField({ label, value, onChange, onUploaded }) {
  const [error, setError] = useState('');
  const upload = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    setError('');
    try { const result = await uploadFile(file); onChange(result.path); onUploaded?.(result); }
    catch (next) { setError(next.message); }
  };
  return <div className="upload-field"><label><span><Upload size={15} />{label}</span><input type="file" accept="image/*,video/*,audio/*" onChange={upload} /></label>{value && <code>{value}</code>}{error && <small className="admin-error">{error}</small>}</div>;
}
