import { Copy, Trash2 } from 'lucide-react';
import { deleteUpload } from './adminApi.js';

export function UploadLibrary({ files, setFiles, onError }) {
  const remove = async (file) => {
    if (!window.confirm(`删除素材 ${file.name}？`)) return;
    try { await deleteUpload(file.name); setFiles(files.filter((item) => item.name !== file.name)); }
    catch (error) { onError(error); }
  };
  return <div className="upload-library">{files.length === 0 && <p>暂无已上传素材</p>}{files.map((file) => <div key={file.name}><span><strong>{file.name}</strong><small>{file.type} · {file.size} B</small><code>{file.path}</code></span><button title="复制路径" onClick={() => navigator.clipboard?.writeText(file.path)}><Copy size={16} /></button><button title="删除素材" onClick={() => remove(file)}><Trash2 size={16} /></button></div>)}</div>;
}
