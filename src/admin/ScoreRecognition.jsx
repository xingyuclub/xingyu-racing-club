import { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Loader2, RefreshCw, ScanSearch, Upload, XCircle } from 'lucide-react';
import {
  commitRecognitionBatch,
  getRecognitionBatch,
  processRecognitionBatch,
  rematchRecognitionBatch,
  reviewRecognitionEvidence,
  uploadRecognitionBatch,
} from './adminApi.js';
import { RecognitionEvidence } from './RecognitionEvidence.jsx';

const today = () => new Date().toISOString().slice(0, 10);

export function ScoreRecognition({ config, initialBatchId, onCommitted }) {
  const [date, setDate] = useState(today());
  const [raceType, setRaceType] = useState('team');
  const [multiMatch, setMultiMatch] = useState(false);
  const [status, setStatus] = useState('idle');
  const [draft, setDraft] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [error, setError] = useState('');
  const controlsDisabled = ['loading', 'uploading', 'processing', 'rematching', 'reviewing', 'committing'].includes(status);

  useEffect(() => {
    if (!initialBatchId) return undefined;
    let active = true;
    setStatus('loading');
    setError('');
    getRecognitionBatch(initialBatchId).then((batch) => {
      if (!active) return;
      if (!batch.raceType || !batch.draft) throw new Error('旧版批次需重新上传');
      setBatchId(batch.id);
      setDate(batch.date);
      setRaceType(batch.raceType);
      setMultiMatch(batch.multiMatch === true);
      setDraft(batch.draft);
      setStatus('ready');
    }).catch((next) => {
      if (!active) return;
      setError(next.message);
      setStatus('failed');
    });
    return () => { active = false; };
  }, [initialBatchId]);

  const upload = async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    event.target.value = '';
    setStatus('uploading');
    setError('');
    setDraft(null);
    try {
      const batch = await uploadRecognitionBatch(date, raceType, files, multiMatch);
      setBatchId(batch.id);
      setStatus('processing');
      const result = await processRecognitionBatch(batch.id);
      setDraft(result);
      setStatus('ready');
    } catch (next) {
      setError(next.message);
      setStatus('failed');
    }
  };

  const commit = async () => {
    if (!batchId || !draft) return;
    setStatus('committing');
    setError('');
    try {
      const result = await commitRecognitionBatch(batchId, draft.rosterVersion);
      setStatus('committed');
      onCommitted?.(result.config);
    } catch (next) {
      setError(next.message);
      setStatus('ready');
    }
  };

  const review = async (change) => {
    if (!batchId) return;
    setStatus('reviewing');
    setError('');
    try {
      setDraft(await reviewRecognitionEvidence(batchId, change));
      setStatus('ready');
    } catch (next) {
      setError(next.message);
      setStatus('ready');
    }
  };

  const reprocess = async () => {
    if (!batchId) return;
    setStatus('processing');
    setError('');
    try {
      setDraft(await processRecognitionBatch(batchId));
      setStatus('ready');
    } catch (next) {
      setError(next.message);
      setStatus('ready');
    }
  };
  const rematch = async () => {
    if (!batchId) return;
    setStatus('rematching');
    setError('');
    try {
      setDraft(await rematchRecognitionBatch(batchId));
      setStatus('ready');
    } catch (next) {
      setError(next.message);
      setStatus('ready');
    }
  };

  const reset = () => {
    setStatus('idle');
    setDraft(null);
    setBatchId(null);
    setError('');
  };

  const hasError = status === 'failed' && error;

  return (
    <div className="score-recognition">
      <div className="score-recognition-upload">
        <label>
          <span><Camera aria-hidden="true" size={16} /> 批次日期</span>
          <input
            type="date"
            aria-label="批次日期"
            value={date}
            disabled={controlsDisabled}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <fieldset className="score-recognition-types" disabled={controlsDisabled}>
          <legend>比赛类型</legend>
          <label>
            <input
              type="radio"
              name="recognition-race-type"
              value="team"
              checked={raceType === 'team'}
              onChange={() => setRaceType('team')}
            />
            队内赛
          </label>
          <label>
            <input
              type="radio"
              name="recognition-race-type"
              value="ranked"
              checked={raceType === 'ranked'}
              onChange={() => setRaceType('ranked')}
            />
            排位赛
          </label>
        </fieldset>
        <label className="score-recognition-multi">
          <input
            type="checkbox"
            checked={multiMatch}
            disabled={controlsDisabled}
            onChange={(event) => setMultiMatch(event.target.checked)}
          />
          一张截图含多场比赛
        </label>
        <label className={'score-recognition-file' + (controlsDisabled ? ' is-disabled' : '')}>
          <Upload aria-hidden="true" size={16} />
          上传截图
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            aria-label="上传截图"
            disabled={controlsDisabled}
            onChange={upload}
          />
        </label>
      </div>

      {hasError && (
        <div className="admin-error" role="alert">
          <XCircle aria-hidden="true" size={16} /> {error}
        </div>
      )}

      {status === 'committed' && (
        <div className="score-recognition-success" role="status">
          <CheckCircle2 aria-hidden="true" size={16} /> 提交成功，公开积分榜已更新。
          <button type="button" onClick={reset}>开始新批次</button>
        </div>
      )}

      {(status === 'loading' || status === 'uploading' || status === 'processing' || status === 'rematching' || status === 'committing') && (
        <div className="score-recognition-loading">
          <Loader2 aria-hidden="true" size={16} className="spin" />
          {status === 'loading' ? '读取批次中…' : status === 'processing' ? '识别中…' : status === 'rematching' ? '重新匹配中…' : status === 'committing' ? '提交中…' : '上传中…'}
        </div>
      )}

      {draft && (status === 'ready' || status === 'reviewing') && (
        <div className="score-recognition-preview">
          <RecognitionEvidence
            batchId={batchId}
            config={config}
            draft={draft}
            busy={status === 'reviewing'}
            onReview={review}
          />
          {error && <div className="admin-error" role="alert"><XCircle aria-hidden="true" size={16} /> {error}</div>}
          <div className="score-recognition-actions">
            <button
              type="button"
              className="score-recognition-rematch"
              disabled={status !== 'ready'}
              onClick={rematch}
            >
              <RefreshCw aria-hidden="true" size={16} /> 重新匹配
            </button>
            <button
              type="button"
              className="score-recognition-reprocess"
              disabled={status !== 'ready'}
              onClick={reprocess}
            >
              <ScanSearch aria-hidden="true" size={16} /> 重新识别
            </button>
            <button
              type="button"
              className="score-recognition-commit"
              disabled={!draft.canCommit || status !== 'ready'}
              onClick={commit}
            >
              <CheckCircle2 aria-hidden="true" size={16} /> 提交确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
