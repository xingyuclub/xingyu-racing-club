import { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { listRecognitionBatches, rematchRecognitionBatch, retryRecognitionBatch } from './adminApi.js';

const STATUS_LABEL = {
  uploaded: '待处理',
  processing: '识别中',
  ready: '待确认',
  failed: '失败',
  committed: '已提交',
  discarded: '已忽略',
};

const STATUS_CLASS = {
  uploaded: 'recog-status--idle',
  processing: 'recog-status--busy',
  ready: 'recog-status--ready',
  failed: 'recog-status--failed',
  committed: 'recog-status--done',
  discarded: 'recog-status--done',
};

const formatTime = (value) => (value ? new Date(value).toLocaleString('zh-CN') : '—');

export function RecognitionHistory({ onOpen }) {
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError('');
    try {
      setBatches(await listRecognitionBatches());
    } catch (next) {
      setError(next.message);
    }
  };

  useEffect(() => { load(); }, []);

  const retry = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await retryRecognitionBatch(id);
      await load();
    } catch (next) {
      setError(next.message);
    } finally {
      setBusyId(null);
    }
  };

  const rematch = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await rematchRecognitionBatch(id);
      await load();
    } catch (next) {
      setError(next.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="recognition-history" data-testid="recognition-history">
      <div className="recognition-history-toolbar">
        <h3>识别记录</h3>
        <button type="button" onClick={load}>刷新</button>
      </div>

      {error && (
        <p className="admin-error" role="alert">
          <AlertCircle aria-hidden="true" size={14} />
          {error}
        </p>
      )}

      {batches.length === 0 && !error && (
        <p className="recognition-history-empty">暂无识别记录。</p>
      )}

      <ul className="recognition-history-list">
        {batches.map((batch) => (
          <li key={batch.id} className="recognition-history-item" data-testid="recognition-history-item">
            <div className="recognition-history-meta">
              <span className={`recog-status ${STATUS_CLASS[batch.status] || ''}`}>
                {STATUS_LABEL[batch.status] || batch.status}
              </span>
              <span>日期 {batch.date || '—'}</span>
              <span>{batch.images?.length || 0} 张截图</span>
              <span>创建 {formatTime(batch.createdAt)}</span>
              {batch.committedAt && <span>提交 {formatTime(batch.committedAt)}</span>}
              {batch.discardReason && <span>原因 {batch.discardReason}</span>}
            </div>
            <div className="recognition-history-actions">
              {batch.status === 'ready' && batch.raceType && (
                <button
                  type="button"
                  disabled={busyId === batch.id}
                  onClick={() => rematch(batch.id)}
                  aria-label={`重新匹配批次 ${batch.id.slice(0, 8)}`}
                >
                  <RefreshCw aria-hidden="true" size={14} />
                  重新匹配
                </button>
              )}
              {batch.status === 'ready' && batch.raceType && (
                <button
                  type="button"
                  onClick={() => onOpen?.(batch.id)}
                  aria-label={`继续审核批次 ${batch.id.slice(0, 8)}`}
                >
                  继续审核
                </button>
              )}
              {batch.status === 'ready' && !batch.raceType && (
                <span className="recognition-history-legacy">旧版批次需重新上传</span>
              )}
              {batch.status === 'failed' && (
                <button
                  type="button"
                  disabled={busyId === batch.id}
                  onClick={() => retry(batch.id)}
                  aria-label={`重试批次 ${batch.id.slice(0, 8)}`}
                >
                  <RefreshCw aria-hidden="true" size={14} />
                  重试
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
