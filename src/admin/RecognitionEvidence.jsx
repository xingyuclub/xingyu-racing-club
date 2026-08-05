import { useEffect, useState } from 'react';
import { Ban, Image, UserCheck } from 'lucide-react';

const ISSUE_LABELS = {
  unmatched: '未匹配成员',
  'invalid-rank': '名次无效',
  'duplicate-rank': '名次重复',
};

function ImageLink({ batchId, item }) {
  return (
    <a
      href={`/api/admin/score-recognition/batches/${encodeURIComponent(batchId)}/images/${item.imageIndex}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`查看截图 ${item.imageIndex + 1}`}
    >
      <Image aria-hidden="true" size={15} />
      截图 {item.imageIndex + 1}
    </a>
  );
}

function EvidenceRow({ batchId, item }) {
  if (!item) return null;
  return (
    <div className="recognition-evidence-row">
      <ImageLink batchId={batchId} item={item} />
      <span>名次 {item.rank}</span>
      <span>{item.score === undefined ? '未计分' : `+${item.score} 分`}</span>
      <span>{item.slot === undefined ? '未录入' : `第 ${item.slot + 1} 局`}</span>
    </div>
  );
}

function IssueEditor({ batchId, issue, evidence, roster, busy, onReview }) {
  const [rank, setRank] = useState(String(evidence?.rank ?? ''));
  useEffect(() => { setRank(String(evidence?.rank ?? '')); }, [evidence?.rank]);
  if (!evidence) return null;

  const submitRank = () => {
    const value = Number(rank);
    if (Number.isInteger(value) && value > 0 && value !== evidence.rank) {
      onReview({ evidenceId: evidence.id, rank: value });
    }
  };

  return (
    <div className="recognition-issue">
      <div className="recognition-issue-head">
        <strong>{ISSUE_LABELS[issue.code] || '待处理'}</strong>
        <ImageLink batchId={batchId} item={evidence} />
      </div>
      <div className="recognition-issue-fields">
        <label>
          <span>识别昵称</span>
          <input value={evidence.nickname} readOnly />
        </label>
        <label>
          <span>名次</span>
          <input
            type="number"
            min="1"
            step="1"
            value={rank}
            disabled={busy}
            aria-label={`${evidence.nickname}名次`}
            onChange={(event) => setRank(event.target.value)}
            onBlur={submitRank}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitRank();
              }
            }}
          />
        </label>
        <label>
          <span>对应成员</span>
          <select
            value={evidence.memberId || ''}
            disabled={busy}
            aria-label={`未匹配昵称 ${evidence.nickname} 对应成员`}
            onChange={(event) => {
              if (event.target.value) {
                onReview({ evidenceId: evidence.id, memberId: event.target.value, ignored: false });
              }
            }}
          >
            <option value="">请选择</option>
            {roster.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      </div>
      <div className="recognition-issue-actions">
        {evidence.memberId && (
          <span><UserCheck aria-hidden="true" size={15} /> 已匹配 {evidence.memberName}</span>
        )}
        <button
          type="button"
          disabled={busy}
          aria-label={`标记${evidence.nickname}为非车队成员`}
          onClick={() => onReview({ evidenceId: evidence.id, ignored: true })}
        >
          <Ban aria-hidden="true" size={15} />
          标记为非车队成员
        </button>
      </div>
    </div>
  );
}

export function RecognitionEvidence({ batchId, config, draft, busy, onReview }) {
  const evidenceById = new Map(draft.evidence.map((item) => [item.id, item]));
  const warnings = draft.evidence.filter((item) => item.warning === 'member-limit');

  return (
    <div className="recognition-review">
      {draft.duplicateCount > 0 && (
        <p className="recognition-duplicate-note" role="status">
          已自动跳过 {draft.duplicateCount} 场与其他截图重复的比赛。
        </p>
      )}
      <section className="recognition-summary" aria-label="人物积分汇总">
        {draft.summary.map((member) => (
          <details key={member.id} className="recognition-member">
            <summary role="button" aria-label={`查看${member.name}的依据`}>
              <span>{member.name}</span>
              <strong>+{member.score} 分</strong>
              <span className="recognition-evidence-label">查看依据</span>
            </summary>
            <div className="recognition-member-evidence">
              {member.evidenceIds.map((evidenceId) => (
                <EvidenceRow key={evidenceId} batchId={batchId} item={evidenceById.get(evidenceId)} />
              ))}
            </div>
          </details>
        ))}
        {draft.summary.length === 0 && <p className="recognition-empty">暂无可录入积分</p>}
      </section>

      {draft.raceWarnings?.length > 0 && (
        <section className="recognition-issues" aria-label="疑似漏行提示">
          {draft.raceWarnings.map((warning, index) => (
            <div key={`warning-${index}`} className="recognition-warning">
              <strong>截图 {warning.imageIndex + 1} 名次不连续，疑似漏行</strong>
              <ImageLink batchId={batchId} item={{ imageIndex: warning.imageIndex }} />
              <span>
                缺少第 {warning.missingRanks.join('、')} 名（最高名次 {warning.maxRank}）。
                漏掉的成员不会被录入，其余成员按最高名次计分；请核对截图后处理。
              </span>
            </div>
          ))}
        </section>
      )}

      {(draft.issues.length > 0 || warnings.length > 0) && (
        <section className="recognition-issues" aria-label="待处理识别项">
          {draft.issues.map((issue) => (
            <IssueEditor
              key={`${issue.evidenceId}-${issue.code}`}
              batchId={batchId}
              issue={issue}
              evidence={evidenceById.get(issue.evidenceId)}
              roster={config.roster || []}
              busy={busy}
              onReview={onReview}
            />
          ))}
          {warnings.map((item) => (
            <div key={item.id} className="recognition-warning">
              <strong>{item.memberName || item.nickname} 已达当天三局上限</strong>
              <ImageLink batchId={batchId} item={item} />
              <span>本条不会录入，也不影响其他成员提交。</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
