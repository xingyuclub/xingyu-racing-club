import { useEffect, useState } from 'react';
import { Ban, Check, Image, Plus, ScanSearch, Trash2, UserCheck } from 'lucide-react';

const ISSUE_LABELS = {
  unmatched: '未匹配成员',
  'invalid-rank': '名次无效',
  'duplicate-rank': '名次重复',
  'suspected-duplicate': '疑似重复场次',
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
      <span>{item.mapName ? `地图 ${item.mapName}` : '地图未知'}</span>
      <span>名次 {item.rank}</span>
      <span>{item.score === undefined ? '未计分' : `+${item.score} 分`}</span>
      <span>{item.slot === undefined ? '未录入' : `第 ${item.slot + 1} 局`}</span>
    </div>
  );
}

function IssueEditor({ batchId, issue, evidence, scoreMembers, busy, onReview }) {
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
          <span>地图</span>
          <input value={evidence.mapName || '未知'} readOnly />
        </label>
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
            value={evidence.scoreMemberId || ''}
            disabled={busy}
            aria-label={`未匹配昵称 ${evidence.nickname} 对应成员`}
            onChange={(event) => {
              if (event.target.value) {
                onReview({ evidenceId: evidence.id, scoreMemberId: event.target.value, ignored: false });
              }
            }}
          >
            <option value="">请选择</option>
            {scoreMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      </div>
      <div className="recognition-issue-actions">
        {evidence.scoreMemberId && (
          <span><UserCheck aria-hidden="true" size={15} /> 已匹配 {evidence.memberName}</span>
        )}
        <button
          type="button"
          disabled={busy}
          aria-label={`标记${evidence.nickname}为非积分成员`}
          onClick={() => onReview({ evidenceId: evidence.id, ignored: true })}
        >
          <Ban aria-hidden="true" size={15} />
          标记为非积分成员
        </button>
      </div>
    </div>
  );
}

function DuplicateImageEditor({ batchId, issue, busy, onReview }) {
  return (
    <div className="recognition-issue">
      <div className="recognition-issue-head">
        <strong>两张图片内容高度相似，疑似重复图片</strong>
        <ImageLink batchId={batchId} item={{ imageIndex: issue.imageIndex }} />
        <ImageLink batchId={batchId} item={{ imageIndex: issue.duplicateOfImageIndex }} />
      </div>
      <div className="recognition-issue-actions">
        <button
          type="button"
          disabled={busy}
          aria-label="确认是重复图片"
          onClick={() => onReview({ imageIndex: issue.imageIndex, duplicate: true })}
        >
          <Ban aria-hidden="true" size={15} />
          确认是重复图片
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label="确认是不同图片"
          onClick={() => onReview({ imageIndex: issue.imageIndex, notDuplicate: true })}
        >
          <Check aria-hidden="true" size={15} />
          这是不同图片
        </button>
      </div>
    </div>
  );
}

function raceParticipants(draft, imageIndex, matchIndex) {
  return (draft.evidence || [])
    .filter((item) => item.imageIndex === imageIndex && item.matchIndex === matchIndex)
    .sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0));
}

function DuplicateEditor({ batchId, draft, issue, busy, onReview }) {
  const first = draft.evidence.find((item) => item.id === issue.evidenceId);
  if (!first) return null;
  const participants = raceParticipants(draft, first.imageIndex, first.matchIndex);
  const compared = issue.duplicateOf
    ? raceParticipants(draft, issue.duplicateOf.imageIndex, issue.duplicateOf.matchIndex)
    : [];

  return (
    <div className="recognition-issue">
      <div className="recognition-issue-head">
        <strong>人员和名次完全一致，疑似重复场次</strong>
        <ImageLink batchId={batchId} item={first} />
        {compared.length > 0 && (
          <ImageLink batchId={batchId} item={{ imageIndex: issue.duplicateOf.imageIndex }} />
        )}
      </div>
      <div className="recognition-race-grid">
        <div>
          <span className="recognition-race-label">
            本场（截图 {first.imageIndex + 1} · {first.mapName || '地图未知'}）
          </span>
          {participants.map((item) => (
            <span key={item.id} className="recognition-race-member">
              第 {item.rank} 名 {item.nickname}
            </span>
          ))}
        </div>
        {compared.length > 0 && (
          <div>
            <span className="recognition-race-label">
              对比场次（截图 {issue.duplicateOf.imageIndex + 1} · {compared[0]?.mapName || '地图未知'}）
            </span>
            {compared.map((item) => (
              <span key={item.id} className="recognition-race-member">
                第 {item.rank} 名 {item.nickname}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="recognition-issue-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => onReview({ evidenceId: issue.evidenceId, duplicate: true })}
        >
          <Ban aria-hidden="true" size={15} />
          确认是重复场次（跳过本场）
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onReview({ evidenceId: issue.evidenceId, notDuplicate: true })}
        >
          <Check aria-hidden="true" size={15} />
          这是不同场次（两场都保留）
        </button>
      </div>
    </div>
  );
}

function RaceWarningEditor({ batchId, warning, scoreMembers, busy, onReprocessImage, onAddManual }) {
  const [nickname, setNickname] = useState('');
  const [rank, setRank] = useState(String(warning.missingRanks?.[0] ?? ''));
  const [scoreMemberId, setScoreMemberId] = useState('');
  const imageNumber = warning.imageIndex + 1;

  useEffect(() => {
    setNickname('');
    setRank(String(warning.missingRanks?.[0] ?? ''));
    setScoreMemberId('');
  }, [warning.imageIndex, warning.matchIndex, warning.missingRanks?.join(',')]);

  const submitManual = () => {
    const nextRank = Number(rank);
    if (!nickname.trim() || !Number.isInteger(nextRank) || nextRank < 1 || !onAddManual) return;
    onAddManual({
      imageIndex: warning.imageIndex,
      matchIndex: warning.matchIndex,
      nickname: nickname.trim(),
      rank: nextRank,
      ...(scoreMemberId ? { scoreMemberId } : {}),
    });
  };

  return (
    <div className="recognition-warning recognition-race-warning">
      <div className="recognition-warning-head">
        <strong>截图 {imageNumber} 名次不连续，疑似漏行</strong>
        <ImageLink batchId={batchId} item={{ imageIndex: warning.imageIndex }} />
      </div>
      <span>
        缺少第 {warning.missingRanks.join('、')} 名（最高名次 {warning.maxRank}）。
        漏掉的成员不会被录入，其余成员按最高名次计分。可以只重识别这张截图，或直接人工补录。
      </span>
      <button
        type="button"
        className="recognition-warning-action"
        disabled={busy || !onReprocessImage}
        onClick={() => onReprocessImage?.(warning.imageIndex)}
      >
        <ScanSearch aria-hidden="true" size={15} />
        重新识别截图 {imageNumber}
      </button>
      <div className="recognition-manual-form">
        <label>
          <span>补录昵称</span>
          <input
            aria-label={`截图 ${imageNumber} 补录昵称`}
            value={nickname}
            disabled={busy}
            placeholder="例如：队员昵称"
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        <label>
          <span>补录名次</span>
          <input
            type="number"
            min="1"
            step="1"
            aria-label={`截图 ${imageNumber} 补录名次`}
            value={rank}
            disabled={busy}
            onChange={(event) => setRank(event.target.value)}
          />
        </label>
        <label>
          <span>补录积分人物</span>
          <select
            aria-label={`截图 ${imageNumber} 补录积分人物`}
            value={scoreMemberId}
            disabled={busy}
            onChange={(event) => setScoreMemberId(event.target.value)}
          >
            <option value="">非积分成员（只补名次）</option>
            {scoreMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="recognition-manual-submit"
          disabled={busy || !nickname.trim() || !Number.isInteger(Number(rank)) || Number(rank) < 1 || !onAddManual}
          onClick={submitManual}
        >
          <Plus aria-hidden="true" size={15} />
          添加人工记录
        </button>
      </div>
    </div>
  );
}

function ManualEntries({ batchId, evidence, busy, onRemoveManual }) {
  const entries = evidence.filter((item) => item.manual);
  if (entries.length === 0) return null;
  return (
    <section className="recognition-manual-entries" aria-label="人工补录记录">
      <h3>人工补录记录</h3>
      {entries.map((item) => (
        <div key={item.id} className="recognition-manual-entry">
          <span>截图 {item.imageIndex + 1} · 第 {item.rank} 名 {item.nickname}</span>
          <span>{item.ignored ? '非积分成员' : (item.memberName || item.scoreMemberId)}</span>
          <a
            href={`/api/admin/score-recognition/batches/${encodeURIComponent(batchId)}/images/${item.imageIndex}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`查看人工补录截图 ${item.imageIndex + 1}`}
          >
            查看截图
          </a>
          <button
            type="button"
            disabled={busy || !onRemoveManual}
            aria-label={`删除人工记录 ${item.nickname}`}
            onClick={() => onRemoveManual?.(item.manualEntryId)}
          >
            <Trash2 aria-hidden="true" size={15} />
            删除
          </button>
        </div>
      ))}
    </section>
  );
}

export function RecognitionEvidence({ batchId, config, draft, busy, onReview, onReprocessImage, onAddManual, onRemoveManual }) {
  const evidenceById = new Map(draft.evidence.map((item) => [item.id, item]));
  const warnings = draft.evidence.filter((item) => item.warning === 'member-limit');

  return (
    <div className="recognition-review">
      {draft.autoDistinctCount > 0 && (
        <p className="recognition-duplicate-note" role="status">
          有 {draft.autoDistinctCount} 场人员与名次相同但数值不同的比赛，已按不同场次自动保留。
        </p>
      )}
      {draft.autoDistinctImageCount > 0 && (
        <p className="recognition-duplicate-note" role="status">
          有 {draft.autoDistinctImageCount} 张疑似重复图片的地图不同，已按不同比赛自动放行。
        </p>
      )}
      {draft.suspectedDuplicateImageCount > 0 && (
        <p className="recognition-duplicate-note" role="status">
          发现 {draft.suspectedDuplicateImageCount} 张疑似重复图片，请确认后再提交。
        </p>
      )}
      {draft.duplicateImageCount > 0 && (
        <p className="recognition-duplicate-note" role="status">
          已跳过 {draft.duplicateImageCount} 张内容完全相同的重复图片。
        </p>
      )}
      {draft.suspectedDuplicateCount > 0 && (
        <p className="recognition-duplicate-note" role="status">
          发现 {draft.suspectedDuplicateCount} 场与同批其他截图人员、名次完全一致且缺少数值列的比赛，请确认是同一场还是不同场次后再提交。
        </p>
      )}
      {draft.duplicateCount > 0 && (
        <p className="recognition-duplicate-note" role="status">
          已跳过 {draft.duplicateCount} 场重复比赛（内容完全一致）。
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

      <ManualEntries
        batchId={batchId}
        evidence={draft.evidence}
        busy={busy}
        onRemoveManual={onRemoveManual}
      />

      {draft.raceWarnings?.length > 0 && (
        <section className="recognition-issues" aria-label="疑似漏行提示">
          {draft.raceWarnings.map((warning, index) => (
            <RaceWarningEditor
              key={`warning-${index}`}
              batchId={batchId}
              warning={warning}
              scoreMembers={config.scoreMembers || []}
              busy={busy}
              onReprocessImage={onReprocessImage}
              onAddManual={onAddManual}
            />
          ))}
        </section>
      )}

      {(draft.issues.length > 0 || warnings.length > 0) && (
        <section className="recognition-issues" aria-label="待处理识别项">
          {draft.issues.map((issue) => (
            issue.code === 'suspected-duplicate-image' ? (
              <DuplicateImageEditor
                key={`${issue.imageIndex}-${issue.code}`}
                batchId={batchId}
                issue={issue}
                busy={busy}
                onReview={onReview}
              />
            ) : issue.code === 'suspected-duplicate' ? (
              <DuplicateEditor
                key={`${issue.evidenceId}-${issue.code}`}
                batchId={batchId}
                draft={draft}
                issue={issue}
                busy={busy}
                onReview={onReview}
              />
            ) : (
              <IssueEditor
                key={`${issue.evidenceId}-${issue.code}`}
                batchId={batchId}
                issue={issue}
                evidence={evidenceById.get(issue.evidenceId)}
                scoreMembers={config.scoreMembers || []}
                busy={busy}
                onReview={onReview}
              />
            )
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
