import { useMemo, useState } from 'react';
import { ArrowDown, ArrowDownWideNarrow, ArrowUp, Download, FileDown, Plus, Trash2, Upload, X } from 'lucide-react';
import {
  hydrateSiteData,
  nextScoreMemberId,
  removeScoreMember as removeScoreMemberFromConfig,
} from '../data/siteConfig.js';
import { invalidateFollowingWeekTotals } from '../data/scoreRules.js';
import {
  downloadScoreWorkbook,
  mergeScoreImport,
  parseScoreWorkbookBuffer,
} from './scoreWorkbook.js';
import { ScoreRecognition } from './ScoreRecognition.jsx';
import { WeekendScoreEditor } from './WeekendScoreEditor.jsx';
import { RecognitionHistory } from './RecognitionHistory.jsx';

const clone = (value) => structuredClone(value);

const flattenScores = (dailyScores) => dailyScores.flatMap((round) =>
  round.rows.map((row) => ({ ...clone(row), date: round.date })));

const replaceDailyScores = (config, rows) => {
  const next = clone(config);
  const rounds = new Map();
  rows.forEach(({ date, ...scoreRow }) => {
    if (!rounds.has(date)) rounds.set(date, []);
    rounds.get(date).push(scoreRow);
  });
  next.dailyScores = [...rounds]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, scoreRows]) => ({ date, rows: scoreRows }));
  return next;
};

const totalKey = (date, id) => `${date}|${id}`;
const dateWeekday = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
};
const weekendLabel = (dateKey) => dateWeekday(dateKey) === 6 ? '周六' : '周日';

export function ScoreEditor({ config, onChange }) {
  const [errors, setErrors] = useState([]);
  const [tab, setTab] = useState('scores');
  const [recognitionBatchId, setRecognitionBatchId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sortKeys, setSortKeys] = useState({});
  const rows = useMemo(() => flattenScores(config.dailyScores), [config.dailyScores]);
  const weekendRows = useMemo(
    () => (config.weekendScores || []).flatMap((round, roundIndex) =>
      round.rows.map((row, rowIndex) => ({ ...clone(row), date: round.date, roundIndex, rowIndex }))),
    [config.weekendScores],
  );
  const availableDates = useMemo(() => [...new Set([
    ...rows.map((row) => row.date),
    ...weekendRows.map((row) => row.date),
  ])].sort(), [rows, weekendRows]);
  const memberOrder = useMemo(() => {
    const order = new Map();
    (config.scoreMembers || []).forEach((member, index) => order.set(String(member.id), index));
    return order;
  }, [config.scoreMembers]);
  const [selectedDate, setSelectedDate] = useState(() => availableDates.at(-1) || '');
  const selectedIsWeekend = selectedDate && [0, 6].includes(dateWeekday(selectedDate));
  const hydrated = useMemo(() => hydrateSiteData(config), [config]);
  const totals = useMemo(() => new Map(hydrated.dailyScores.flatMap((round) => round.rows.map((row) => [
      totalKey(round.date, row.id),
      {
        previousPoints: row.previousPoints,
        points: row.points,
        score: row.score,
        total: row.total,
        seasonPoints: row.seasonPoints,
        previousPointsInherited: row.previousPointsInherited,
      },
    ]))), [hydrated]);
  const visibleRows = useMemo(() => {
    const source = selectedIsWeekend
      ? weekendRows
        .filter((row) => row.date === selectedDate)
        .map((row) => ({ row, index: null, weekend: true }))
      : rows
        .map((row, index) => ({ row, index, weekend: false }))
        .filter(({ row }) => row.date === selectedDate);
    const sourceById = new Map(source.map((entry) => [String(entry.row.id), entry]));
    const memberIds = (config.scoreMembers || []).map((member) => String(member.id));
    const allIds = [...new Set([...memberIds, ...source.map(({ row }) => String(row.id))])];
    const withMissingMembers = allIds.map((id) => sourceById.get(id) || ({
      row: {
        date: selectedDate,
        id,
        teamRace: selectedIsWeekend ? [] : [null, null, null],
        openRace: selectedIsWeekend ? [] : [null, null, null],
      },
      index: null,
      weekend: selectedIsWeekend,
      synthetic: true,
    }));
    const field = sortKeys[selectedDate];
    const byAdminOrder = (left, right) => {
      const leftIndex = memberOrder.get(String(left.row.id)) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = memberOrder.get(String(right.row.id)) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex
        || String(left.row.name || '').localeCompare(String(right.row.name || ''));
    };
    if (!field) return withMissingMembers.slice().sort(byAdminOrder);
    return withMissingMembers.slice().sort((left, right) => {
      const leftValue = left.weekend
        ? totals.get(totalKey(selectedDate, left.row.id))?.[field]
        : field === 'score' || field === 'total' || field === 'seasonPoints'
          ? totals.get(totalKey(selectedDate, left.row.id))?.[field]
          : left.row[field.split(':')[0]]?.[Number(field.split(':')[1])] ?? null;
      const rightValue = right.weekend
        ? totals.get(totalKey(selectedDate, right.row.id))?.[field]
        : field === 'score' || field === 'total' || field === 'seasonPoints'
          ? totals.get(totalKey(selectedDate, right.row.id))?.[field]
          : right.row[field.split(':')[0]]?.[Number(field.split(':')[1])] ?? null;
      const leftNumber = leftValue == null || leftValue === '' ? Number.NEGATIVE_INFINITY : Number(leftValue);
      const rightNumber = rightValue == null || rightValue === '' ? Number.NEGATIVE_INFINITY : Number(rightValue);
      const leftName = config.scoreMembers.find((member) => member.id === left.row.id)?.name || left.row.name || '';
      const rightName = config.scoreMembers.find((member) => member.id === right.row.id)?.name || right.row.name || '';
      return rightNumber - leftNumber || String(leftName).localeCompare(String(rightName));
    });
  }, [rows, weekendRows, selectedDate, selectedIsWeekend, sortKeys, totals, memberOrder, config.scoreMembers]);
  const activeMemberCount = visibleRows.reduce(
    (count, { row }) => count + (Number(totals.get(totalKey(selectedDate, row.id))?.score) > 0 ? 1 : 0),
    0,
  );

  const setDate = (date) => {
    setSelectedDate(date);
    setSortKeys({});
  };
  const sortButton = (label, field) => (
    <button
      type="button"
      className="score-sort-button"
      aria-label={`按${label}从大到小排序`}
      title={`按${label}从大到小排序`}
      onClick={() => setSortKeys((current) => ({ ...current, [selectedDate]: field }))}
    >
      <ArrowDownWideNarrow aria-hidden="true" size={14} />
    </button>
  );

  const updateRows = (nextRows, invalidations = []) => {
    const next = replaceDailyScores(config, nextRows);
    invalidations.forEach((target) => invalidateFollowingWeekTotals(next, target));
    onChange(next);
  };
  const updateRow = (index, updater) => {
    const previous = rows[index];
    const nextRows = clone(rows);
    delete nextRows[index].score;
    delete nextRows[index].total;
    updater(nextRows[index]);
    updateRows(nextRows, [
      { date: previous.date, id: previous.id },
      { date: nextRows[index].date, id: nextRows[index].id },
    ]);
  };
  const addRow = () => {
    if (!config.scoreMembers.length) return;
    const date = selectedDate || availableDates.at(-1) || new Date().toISOString().slice(0, 10);
    const used = new Set(rows.filter((row) => row.date === date).map((row) => row.id));
    const member = config.scoreMembers.find((item) => !used.has(item.id)) || config.scoreMembers[0];
    updateRows([...rows, {
      date,
      id: member.id,
      teamRace: [null, null, null],
      openRace: [null, null, null],
    }]);
    setDate(date);
  };

  const updateScoreMemberName = (index, name) => {
    const next = clone(config);
    next.scoreMembers[index].name = name;
    onChange(next);
  };
  const addScoreMember = () => {
    const next = clone(config);
    if (!Array.isArray(next.scoreMembers)) next.scoreMembers = [];
    const baseName = '新积分队员';
    const usedNames = new Set(next.scoreMembers.map((member) => member.name));
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${baseName}${suffix}`;
      suffix += 1;
    }
    next.scoreMembers.push({
      id: nextScoreMemberId(next.scoreMembers),
      name,
      basePoints: 0,
      wins: 0,
    });
    onChange(next);
  };
  const removeScoreMember = (index) => {
    onChange(removeScoreMemberFromConfig(config, config.scoreMembers[index].id));
  };
  const moveScoreMember = (index, direction) => {
    const next = clone(config);
    const target = index + direction;
    if (target < 0 || target >= next.scoreMembers.length) return;
    const [member] = next.scoreMembers.splice(index, 1);
    next.scoreMembers.splice(target, 0, member);
    onChange(next);
  };

  const download = async (template) => {
    setErrors([]);
    setBusy(true);
    try {
      await downloadScoreWorkbook(config, { template });
    } catch (error) {
      setErrors([{ message: error.message }]);
    } finally {
      setBusy(false);
    }
  };

  const importWorkbook = async (file) => {
    setErrors([]);
    setPreview(null);
    setBusy(true);
    try {
      const imported = await parseScoreWorkbookBuffer(await file.arrayBuffer(), config.scoreMembers);
      const existing = new Set(rows.map((row) => totalKey(row.date, row.id)));
      const importedRows = imported.dailyScores.flatMap((round) =>
        round.rows.map((row) => ({ ...row, date: round.date })));
      const updates = importedRows.filter((row) => existing.has(totalKey(row.date, row.id))).length;
      setPreview({ imported, additions: importedRows.length - updates, updates });
    } catch (error) {
      setErrors(error.details?.length ? error.details : [{ message: error.message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="score-editor">
      <div className="score-editor-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'scores'} className={tab === 'scores' ? 'is-active' : ''} onClick={() => setTab('scores')}>积分明细</button>
        <button role="tab" aria-selected={tab === 'recognition'} className={tab === 'recognition' ? 'is-active' : ''} onClick={() => setTab('recognition')}>截图识别</button>
        <button role="tab" aria-selected={tab === 'weekend'} className={tab === 'weekend' ? 'is-active' : ''} onClick={() => setTab('weekend')}>周末录入</button>
        <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}>识别记录</button>
        <button role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'is-active' : ''} onClick={() => setTab('members')}>积分队员</button>
      </div>
      <div
        className={'score-recognition-panel' + (tab === 'recognition' ? '' : ' is-hidden')}
        data-testid="score-recognition-panel"
      >
        <ScoreRecognition
          config={config}
          initialBatchId={recognitionBatchId}
          onCommitted={onChange}
        />
      </div>
      {tab === 'weekend' && <WeekendScoreEditor config={config} onChange={onChange} />}
      {tab === 'history' && <RecognitionHistory onOpen={(id) => {
        setRecognitionBatchId(id);
        setTab('recognition');
      }} />}
      {tab === 'members' && (
        <div className="score-roster-manager">
          <div className="score-roster-toolbar">
            <button type="button" onClick={addScoreMember}>
              <Plus aria-hidden="true" size={16} />
              新增积分队员
            </button>
          </div>
          <div className="score-roster-table-wrap">
          <table className="score-roster-table">
            <thead>
              <tr><th>序号</th><th>姓名</th><th>ID</th><th><span className="sr-only">操作</span></th></tr>
            </thead>
            <tbody>
              {(config.scoreMembers || []).map((member, index) => (
                <tr key={member.id}>
                  <td><span className="score-roster-seq">{index + 1}</span></td>
                  <td>
                    <input
                      type="text"
                      aria-label={`积分队员 ${index + 1} 名称`}
                      value={member.name}
                      onChange={(event) => updateScoreMemberName(index, event.target.value)}
                    />
                  </td>
                  <td>{member.id}</td>
                  <td className="score-roster-actions">
                    <button
                      className="score-roster-move"
                      type="button"
                      title={`上移积分队员 ${index + 1}`}
                      aria-label={`上移积分队员 ${index + 1}`}
                      disabled={index === 0}
                      onClick={() => moveScoreMember(index, -1)}
                    >
                      <ArrowUp aria-hidden="true" size={16} />
                    </button>
                    <button
                      className="score-roster-move"
                      type="button"
                      title={`下移积分队员 ${index + 1}`}
                      aria-label={`下移积分队员 ${index + 1}`}
                      disabled={index === config.scoreMembers.length - 1}
                      onClick={() => moveScoreMember(index, 1)}
                    >
                      <ArrowDown aria-hidden="true" size={16} />
                    </button>
                    <button
                      className="score-delete"
                      type="button"
                      title={`删除积分队员 ${index + 1}`}
                      aria-label={`删除积分队员 ${index + 1}`}
                      onClick={() => removeScoreMember(index)}
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      {tab === 'scores' && <>
      <div className="score-editor-toolbar">
        <label className="score-date-filter">
          <span>筛选日期</span>
          <input
            type="date"
            aria-label="筛选日期"
            value={selectedDate}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button type="button" disabled={busy} onClick={() => download(true)}>
          <Download aria-hidden="true" size={16} />
          下载模板
        </button>
        <label className={`score-import${busy ? ' is-disabled' : ''}`}>
          <Upload aria-hidden="true" size={16} />
          导入 Excel
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="导入积分 Excel"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importWorkbook(file);
              event.target.value = '';
            }}
          />
        </label>
        <button type="button" disabled={busy} onClick={() => download(false)}>
          <FileDown aria-hidden="true" size={16} />
          导出当前数据
        </button>
        <button type="button" onClick={addRow}>
          <Plus aria-hidden="true" size={16} />
          新增明细
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="score-import-errors" aria-label="积分 Excel 错误">
          {errors.map((error, index) => (
            <li key={`${error.sheet || 'error'}-${error.row || 0}-${error.field || index}`}>
              {error.sheet ? `${error.sheet} 第${error.row}行 ${error.field}：` : ''}{error.message}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="score-import-preview" role="status">
          <div>
            <strong>导入预览</strong>
            <span>影响日期 {preview.imported.summary.dates} 天</span>
            <span>积分明细 {preview.imported.summary.rows} 行</span>
            <span>新增 {preview.additions} 行</span>
            <span>更新 {preview.updates} 行</span>
            <span>期初积分 {preview.imported.summary.basePoints} 人</span>
          </div>
          <div className="score-preview-actions">
            <button type="button" onClick={() => setPreview(null)}>
              <X aria-hidden="true" size={16} />
              取消导入
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(mergeScoreImport(config, preview.imported));
                setPreview(null);
              }}
            >
              <Upload aria-hidden="true" size={16} />
              确认导入
            </button>
          </div>
        </div>
      )}

      <div className="score-editor-table-wrap">
        <table className="score-editor-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>队员（{activeMemberCount}人）</th>
              {selectedIsWeekend ? <>
                {dateWeekday(selectedDate) === 6 && <th><span className="score-table-header">上周积分{sortButton(`${weekendLabel(selectedDate)}上周积分`, 'previousPoints')}</span></th>}
                <th><span className="score-table-header">积分{sortButton(`${weekendLabel(selectedDate)}积分`, 'points')}</span></th>
                <th><span className="score-table-header">得分{sortButton(`${weekendLabel(selectedDate)}得分`, 'score')}</span></th>
                <th><span className="score-table-header">总分{sortButton(`${weekendLabel(selectedDate)}总分`, 'total')}</span></th>
                <th><span className="score-table-header">赛季积分{sortButton(`${weekendLabel(selectedDate)}赛季积分`, 'seasonPoints')}</span></th>
              </> : <>
                {['队内赛1', '队内赛2', '队内赛3', '开黑赛1', '开黑赛2', '开黑赛3'].map((label, index) => (
                  <th key={label}><span className="score-table-header">{label}{sortButton(label, `${index < 3 ? 'teamRace' : 'openRace'}:${index % 3}`)}</span></th>
                ))}
                <th><span className="score-table-header">当日得分{sortButton('当日得分', 'score')}</span></th>
                <th><span className="score-table-header">总分{sortButton('总分', 'total')}</span></th>
                <th><span className="score-table-header">赛季积分{sortButton('赛季积分', 'seasonPoints')}</span></th>
              </>}
              <th><span className="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ row, index: rowIndex, synthetic }, displayIndex) => {
              const calculated = totals.get(totalKey(row.date, row.id)) || { score: 0, total: 0 };
              if (selectedIsWeekend) {
                const member = config.scoreMembers.find((item) => item.id === row.id);
                const dayLabel = weekendLabel(row.date);
                const name = member?.name || row.id;
                return (
                  <tr key={`${row.date}-${row.id}-${row.rowIndex ?? 'zero'}`} data-testid={synthetic ? 'score-editor-zero-row' : 'score-editor-weekend-row'}>
                    <td><input type="date" value={row.date} readOnly aria-label={`${dayLabel} ${name} 日期`} /></td>
                    <td>{name}</td>
                    {dayLabel === '周六' && <td><input type="number" readOnly aria-label={`${dayLabel} ${name} 上周积分`} value={calculated.previousPoints ?? row.previousPoints ?? ''} /></td>}
                    <td><input type="number" readOnly aria-label={`${dayLabel} ${name} 积分`} value={calculated.points ?? row.points ?? ''} /></td>
                    <td><input type="number" readOnly aria-label={`${dayLabel} ${name} 得分`} value={calculated.score ?? row.score ?? ''} /></td>
                    <td><input type="number" readOnly aria-label={`${dayLabel} ${name} 总分`} value={calculated.total ?? row.total ?? ''} /></td>
                    <td className="score-derived">{calculated.seasonPoints ?? 0}</td>
                    <td />
                  </tr>
                );
              }
              if (synthetic) {
                const member = config.scoreMembers.find((item) => item.id === row.id);
                const name = member?.name || row.id;
                return (
                  <tr key={`${row.date}-${row.id}-zero`} data-testid="score-editor-zero-row">
                    <td>{row.date}</td>
                    <td>{name}</td>
                    {row.teamRace.map((value, raceIndex) => <td key={`team-${raceIndex}`}>{value ?? '—'}</td>)}
                    {row.openRace.map((value, raceIndex) => <td key={`open-${raceIndex}`}>{value ?? '—'}</td>)}
                    <td className="score-derived">{calculated.score}</td>
                    <td className="score-derived">{calculated.total}</td>
                    <td className="score-derived">{calculated.seasonPoints ?? 0}</td>
                    <td />
                  </tr>
                );
              }
              const raceGroups = [
                ['队内赛', 'teamRace'],
                ['开黑赛', 'openRace'],
              ];
              return (
                <tr key={`${row.date}-${row.id}-${rowIndex}`} data-testid="score-editor-row">
                  <td>
                    <input
                      type="date"
                      aria-label={`第${(rowIndex ?? displayIndex) + 1}行日期`}
                      value={row.date}
                      onChange={(event) => {
                        if (event.target.value) {
                          updateRow(rowIndex, (item) => { item.date = event.target.value; });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`第${(rowIndex ?? displayIndex) + 1}行队员`}
                      value={row.id}
                      onChange={(event) => updateRow(rowIndex, (item) => { item.id = event.target.value; })}
                    >
                      {config.scoreMembers.map((member) => (
                        <option value={member.id} key={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </td>
                  {raceGroups.flatMap(([label, field]) => row[field].map((value, raceIndex) => (
                    <td key={`${field}-${raceIndex}`}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label={`第${(rowIndex ?? displayIndex) + 1}行${label}${raceIndex + 1}`}
                        value={value ?? ''}
                        onChange={(event) => updateRow(rowIndex, (item) => {
                          item[field][raceIndex] = event.target.value === ''
                            ? null
                            : Math.max(0, Number(event.target.value));
                        })}
                      />
                    </td>
                  )))}
                  <td className="score-derived">{calculated.score}</td>
                  <td className="score-derived">{calculated.total}</td>
                  <td className="score-derived">{calculated.seasonPoints ?? 0}</td>
                  <td>
                    <button
                      className="score-delete"
                      type="button"
                      title="删除明细"
                      aria-label={`删除第${(rowIndex ?? displayIndex) + 1}行`}
                      disabled={synthetic}
                      onClick={() => updateRows(
                        rows.filter((_, index) => index !== rowIndex),
                        [{ date: row.date, id: row.id }],
                      )}
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      }
    </div>
  );
}
