import { useState } from 'react';
import { Camera, CheckCircle2, Loader2, Upload, XCircle } from 'lucide-react';
import {
  commitRecognitionBatch,
  processRecognitionBatch,
  uploadRecognitionBatch,
} from './adminApi.js';

const today = () => new Date().toISOString().slice(0, 10);

const RACE_TYPE_LABEL = { team: '队内赛', ranked: '排位赛' };

export function ScoreRecognition({ config, onCommitted }) {
  const [date, setDate] = useState(today());
  const [raceType, setRaceType] = useState('team');
  const [status, setStatus] = useState('idle');
  const [draft, setDraft] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [error, setError] = useState('');

  const upload = async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    event.target.value = '';
    setStatus('uploading');
    setError('');
    setDraft(null);
    try {
      const batch = await uploadRecognitionBatch(date, raceType, files);
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
            disabled={status === 'processing' || status === 'uploading' || status === 'committing'}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <fieldset className="score-recognition-types" disabled={status === 'processing' || status === 'uploading' || status === 'committing'}>
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
        <label className={'score-recognition-file' + (status === 'processing' || status === 'uploading' ? ' is-disabled' : '')}>
          <Upload aria-hidden="true" size={16} />
          上传截图
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            aria-label="上传截图"
            disabled={status === 'processing' || status === 'uploading' || status === 'committing'}
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

      {(status === 'uploading' || status === 'processing' || status === 'committing') && (
        <div className="score-recognition-loading">
          <Loader2 aria-hidden="true" size={16} className="spin" />
          {status === 'processing' ? '识别中…' : status === 'committing' ? '提交中…' : '上传中…'}
        </div>
      )}

      {draft && status === 'ready' && (
        <div className="score-recognition-preview">
          {(draft.races || []).map((race, index) => (
            <div key={index} className={'score-recognition-race' + (race.duplicate ? ' is-duplicate' : '')}>
              <div className="score-recognition-race-head">
                <strong>{RACE_TYPE_LABEL[race.type] || race.type}</strong>
                <span>{race.title}</span>
                {race.duplicate && <em>重复，不录入</em>}
              </div>
              <table className="score-recognition-table">
                <thead>
                  <tr>
                    <th>昵称</th>
                    <th>名次</th>
                    <th>得分</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {race.members.map((member, mIndex) => (
                    <tr key={mIndex}>
                      <td>{member.nickname}</td>
                      <td>{member.rank}</td>
                      <td>{member.score}</td>
                      <td>{member.skipped ? '已达3局上限' : '第' + (member.slot + 1) + '槽'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {race.unmatched?.length > 0 && (
                <small className="score-recognition-unmatched">未匹配：{race.unmatched.join('、')}</small>
              )}
            </div>
          ))}
          <button type="button" className="score-recognition-commit" onClick={commit}>
            <CheckCircle2 aria-hidden="true" size={16} /> 提交确认
          </button>
        </div>
      )}
    </div>
  );
}
