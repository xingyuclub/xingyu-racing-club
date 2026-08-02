import { useMemo, useState } from 'react';
import { Download, FileDown, Plus, Trash2, Upload, X } from 'lucide-react';
import { hydrateSiteData } from '../data/siteConfig.js';
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
  rows.forEach(({ date, id, teamRace, openRace }) => {
    if (!rounds.has(date)) rounds.set(date, []);
    rounds.get(date).push({ id, teamRace, openRace });
  });
  next.dailyScores = [...rounds]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, scoreRows]) => ({ date, rows: scoreRows }));
  return next;
};

const totalKey = (date, id) => `${date}|${id}`;
const nextNumericValue = (values, format = String) => {
  const used = new Set(values.map((value) => String(value || '').trim()));
  let value = 1;
  while (used.has(format(value))) value += 1;
  return format(value);
};

export function ScoreEditor({ config, onChange }) {
  const [errors, setErrors] = useState([]);
  const [tab, setTab] = useState('scores');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => flattenScores(config.dailyScores), [config.dailyScores]);
  const [selectedDate, setSelectedDate] = useState(() =>
    config.dailyScores.map((round) => round.date).sort().at(-1) || '');
  const visibleRows = useMemo(() => rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.date === selectedDate), [rows, selectedDate]);
  const totals = useMemo(() => {
    const hydrated = hydrateSiteData(config);
    return new Map(hydrated.dailyScores.flatMap((round) => round.rows.map((row) => [
      totalKey(round.date, row.id),
      { score: row.score, total: row.total },
    ])));
  }, [config]);

  const updateRows = (nextRows) => onChange(replaceDailyScores(config, nextRows));
  const updateRow = (index, updater) => {
    const nextRows = clone(rows);
    updater(nextRows[index]);
    updateRows(nextRows);
  };

  const addRow = () => {
    if (!config.scoreMembers.length) return;
    const date = selectedDate || rows.at(-1)?.date || new Date().toISOString().slice(0, 10);
    const used = new Set(rows.filter((row) => row.date === date).map((row) => row.id));
    const member = config.scoreMembers.find((item) => !used.has(item.id)) || config.scoreMembers[0];
    updateRows([...rows, {
      date,
      id: member.id,
      teamRace: [0, 0, 0],
      openRace: [0, 0, 0],
    }]);
    setSelectedDate(date);
  };

  const updateRosterName = (index, name) => {
    const next = clone(config);
    next.roster[index].name = name;
    onChange(next);
  };
  const addRosterMember = () => {
    const next = clone(config);
    next.roster.push({
      id: nextNumericValue(next.roster.map((member) => member.id)),
      number: nextNumericValue(
        next.roster.map((member) => member.number),
        (value) => String(value).padStart(2, '0'),
      ),
      name: '新队员',
      role: '队员',
      basePoints: 0,
      wins: 0,
      avatar: '',
      videoUrl: '',
    });
    onChange(next);
  };
  const removeRosterMember = (index) => {
    const next = clone(config);
    next.roster.splice(index, 1);
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
        <button role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'is-active' : ''} onClick={() => setTab('members')}>队员管理</button>
      </div>
      {tab === 'recognition' && <ScoreRecognition onCommitted={onChange} />}
      {tab === 'weekend' && <WeekendScoreEditor config={config} onChange={onChange} />}
      {tab === 'history' && <RecognitionHistory />}
      {tab === 'members' && (
        <div className="score-roster-manager">
          <div className="score-roster-toolbar">
            <button type="button" onClick={addRosterMember}>
              <Plus aria-hidden="true" size={16} />
              新增队员
            </button>
          </div>
          <div className="score-roster-table-wrap">
          <table className="score-roster-table">
            <thead>
              <tr><th>姓名</th><th>ID</th><th>角色</th><th><span className="sr-only">操作</span></th></tr>
            </thead>
            <tbody>
              {config.roster.map((member, index) => (
                <tr key={member.id}>
                  <td>
                    <input
                      type="text"
                      aria-label={`队员 ${index + 1} 名称`}
                      value={member.name}
                      onChange={(event) => updateRosterName(index, event.target.value)}
                    />
                  </td>
                  <td>{member.id}</td>
                  <td>{member.role}</td>
                  <td>
                    <button
                      className="score-delete"
                      type="button"
                      title={`删除队员 ${index + 1}`}
                      aria-label={`删除队员 ${index + 1}`}
                      onClick={() => removeRosterMember(index)}
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
            onChange={(event) => setSelectedDate(event.target.value)}
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
              <th>队员</th>
              <th>队内赛1</th>
              <th>队内赛2</th>
              <th>队内赛3</th>
              <th>开黑赛1</th>
              <th>开黑赛2</th>
              <th>开黑赛3</th>
              <th>当日得分</th>
              <th>累计总分</th>
              <th><span className="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ row, index: rowIndex }) => {
              const calculated = totals.get(totalKey(row.date, row.id)) || { score: 0, total: 0 };
              const raceGroups = [
                ['队内赛', 'teamRace'],
                ['开黑赛', 'openRace'],
              ];
              return (
                <tr key={`${row.date}-${row.id}-${rowIndex}`} data-testid="score-editor-row">
                  <td>
                    <input
                      type="date"
                      aria-label={`第${rowIndex + 1}行日期`}
                      value={row.date}
                      onChange={(event) => updateRow(rowIndex, (item) => { item.date = event.target.value; })}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`第${rowIndex + 1}行队员`}
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
                        aria-label={`第${rowIndex + 1}行${label}${raceIndex + 1}`}
                        value={value}
                        onChange={(event) => updateRow(rowIndex, (item) => {
                          item[field][raceIndex] = Math.max(0, Number(event.target.value || 0));
                        })}
                      />
                    </td>
                  )))}
                  <td className="score-derived">{calculated.score}</td>
                  <td className="score-derived">{calculated.total}</td>
                  <td>
                    <button
                      className="score-delete"
                      type="button"
                      title="删除明细"
                      aria-label={`删除第${rowIndex + 1}行`}
                      onClick={() => updateRows(rows.filter((_, index) => index !== rowIndex))}
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
