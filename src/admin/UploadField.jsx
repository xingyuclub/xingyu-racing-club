import { useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadFile } from './adminApi.js';

function displayUploadName(value) {
  if (!value) return '';
  const filename = String(value).split(/[\\/]/).at(-1);
  let decoded = filename;
  try { decoded = decodeURIComponent(filename); } catch { /* Keep the stored name. */ }
  const delimiter = decoded.indexOf('--');
  return delimiter >= 0 && delimiter < decoded.length - 2
    ? decoded.slice(delimiter + 2)
    : decoded;
}

export function UploadField({ label, value, displayValue, onChange, onUploaded, onUploadingChange, allowedTypes }) {
  const [error, setError] = useState('');
  const upload = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = '';
    setError('');
    onUploadingChange?.(true);
    try {
      const result = await uploadFile(file);
      if (allowedTypes && !allowedTypes.includes(result.type)) {
        throw new Error(`此处不支持${result.type === 'audio' ? '音频' : '该'}文件`);
      }
      onChange(result.path, result);
      onUploaded?.(result);
    }
    catch (next) { setError(next.message); }
    finally { onUploadingChange?.(false); }
  };
  const accept = allowedTypes?.map((type) => `${type}/*`).join(',') || 'image/*,video/*,audio/*';
  return <div className="upload-field"><label><span><Upload size={15} />{label}</span><input type="file" accept={accept} onChange={upload} /></label>{(displayValue || value) && <code>{displayUploadName(displayValue || value)}</code>}{error && <small className="admin-error">{error}</small>}</div>;
}
