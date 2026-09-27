import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BackButton } from './BackButton.jsx';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SORT_OPTIONS = [
  { key: 'total', label: '总分' },
  { key: 'score', label: '得分' },
  { key: 'seasonPoints', label: '赛季总分' },
];

const formatDateLabel = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}年${month}月${day}日`;
};

const formatTileDate = (dateKey) => {
  const [, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(`${dateKey}T00:00:00`).getDay();
  return {
    day: String(day).padStart(2, '0'),
    weekday: WEEKDAYS[weekday],
  };
};

const formatMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return `${year}年${month}月`;
};

const sortableValue = (value) => (
  value === null || value === undefined || value === '' ? Number.NEGATIVE_INFINITY : Number(value)
);

const countParticipants = (record) => (
  (record?.rows || []).filter((row) => Number(row.score) > 0).length
);

const sortRows = (rows, sortKey, sortDirection) => [...rows].sort((left, right) => {
  const leftValue = sortableValue(left[sortKey]);
  const rightValue = sortableValue(right[sortKey]);
  const directionDifference = sortDirection === 'asc'
    ? leftValue - rightValue
    : rightValue - leftValue;
  return directionDifference
    || sortableValue(right.total) - sortableValue(left.total)
    || String(left.name || '').localeCompare(String(right.name || ''));
});

export function ScoreDetailsPage({ dailyScores = [], onBack }) {
  const monthKeys = useMemo(
    () => [...new Set(dailyScores.map((record) => record.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a)),
    [dailyScores],
  );
  const [activeMonth, setActiveMonth] = useState(() => monthKeys[0] || '');
  const [selectedDate, setSelectedDate] = useState(null);
  const [sortKey, setSortKey] = useState('total');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);
  const dateSectionRef = useRef(null);
  const resultSectionRef = useRef(null);

  useEffect(() => {
    if (monthKeys.includes(activeMonth)) return;
    setActiveMonth(monthKeys[0] || '');
    setSelectedDate(null);
  }, [activeMonth, monthKeys]);

  const monthRecords = useMemo(
    () => dailyScores
      .filter((record) => record.date.startsWith(activeMonth))
      .sort((left, right) => right.date.localeCompare(left.date)),
    [activeMonth, dailyScores],
  );
  const selectedRecord = selectedDate
    ? dailyScores.find((record) => record.date === selectedDate) || null
    : null;
  const selectedRecordSummary = selectedRecord
    ? monthRecords.find((record) => record.date === selectedRecord.date)
    : null;
  const sortedRows = useMemo(
    () => sortRows(selectedRecord?.rows || [], sortKey, sortDirection),
    [selectedRecord, sortDirection, sortKey],
  );
  const firstRowId = sortedRows[0]?.id ?? null;

  useEffect(() => {
    setExpandedId(firstRowId);
  }, [firstRowId, selectedDate, sortKey]);

  const scrollToResults = () => {
    window.requestAnimationFrame?.(() => {
      resultSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  };

  const scrollToDates = () => {
    window.requestAnimationFrame?.(() => {
      dateSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  };

  const selectDate = (date) => {
    setSelectedDate(date);
    setSortKey('total');
    setSortDirection('desc');
    scrollToResults();
  };

  const clearDate = () => {
    setSelectedDate(null);
    setExpandedId(null);
    scrollToDates();
  };

  const selectMonth = (monthKey) => {
    setActiveMonth(monthKey);
    setSelectedDate(null);
    setSortDirection('desc');
    setExpandedId(null);
  };

  const toggleSort = (nextSortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => current === 'desc' ? 'asc' : 'desc');
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection('desc');
  };

  const highestTotal = sortedRows.reduce(
    (highest, row) => Math.max(highest, Number(row.total) || 0),
    0,
  );
  const topRow = sortedRows[0];

  return (
    <main className="site-shell score-query-shell">
      <header className="score-query-topbar">
        <BackButton label="返回积分榜" onClick={onBack} />
      </header>

      <div className="score-query-layout">
        <section className="score-query-dates" ref={dateSectionRef} aria-label="选择比赛日期">
          <p className="score-query-kicker">筛选比赛日</p>
          <div className="score-query-months" role="tablist" aria-label="月份">
            {monthKeys.map((monthKey) => (
              <button
                key={monthKey}
                type="button"
                role="tab"
                aria-selected={activeMonth === monthKey}
                className={activeMonth === monthKey ? 'is-active' : ''}
                onClick={() => selectMonth(monthKey)}
              >
                {formatMonthLabel(monthKey)}
              </button>
            ))}
          </div>

          <div className="score-query-date-head">
            <strong>有记录的日期</strong>
            <small>共 {monthRecords.length} 个比赛日</small>
          </div>

          <div className="score-query-date-grid">
            {monthRecords.map((record) => {
              const tile = formatTileDate(record.date);
              return (
                <button
                  className={`score-query-date${selectedDate === record.date ? ' is-active' : ''}`}
                  key={record.date}
                  type="button"
                  onClick={() => selectDate(record.date)}
                  aria-label={`查看 ${formatDateLabel(record.date)}积分`}
                  aria-pressed={selectedDate === record.date}
                >
                  <strong>{tile.day}</strong>
                  <span>{tile.weekday}</span>
                  <small>{countParticipants(record)}人</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="score-query-results" ref={resultSectionRef} aria-label="日期积分结果">
          {!selectedRecord ? (
            <div className="score-query-empty">
              <strong>选择日期后查看成绩</strong>
              <p>结果会直接出现在这里，不再打开新的弹窗。</p>
            </div>
          ) : (
            <>
              <div className="score-query-result-head">
                <div>
                  <p className="score-query-kicker">已选比赛日</p>
                  <h1>{formatDateLabel(selectedRecord.date)} · {selectedRecord.weekday}</h1>
                  <small>{selectedRecordSummary ? `${countParticipants(selectedRecordSummary)} 人参与` : ''}</small>
                </div>
                <button className="score-query-change" type="button" onClick={clearDate}>
                  更换日期
                </button>
              </div>

              <div className="score-query-summary">
                <div><strong>{countParticipants(selectedRecord)}</strong><small>参与人数</small></div>
                <div><strong>{highestTotal}</strong><small>最高总分</small></div>
                <div><strong>{topRow?.name || '—'}</strong><small>总分第一</small></div>
              </div>

              <div className="score-query-sort" role="tablist" aria-label="结果排序">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={sortKey === option.key}
                    className={sortKey === option.key ? 'is-active' : ''}
                    onClick={() => toggleSort(option.key)}
                  >
                    {option.label}
                    {sortKey === option.key && (
                      sortDirection === 'desc'
                        ? <ChevronDown aria-hidden="true" size={12} />
                        : <ChevronUp aria-hidden="true" size={12} />
                    )}
                  </button>
                ))}
              </div>

              <div className="score-query-member-list">
                {sortedRows.map((row, index) => {
                  const expanded = expandedId === row.id;
                  const teamRace = Array.isArray(row.teamRace) ? row.teamRace : [];
                  const openRace = Array.isArray(row.openRace) ? row.openRace : [];
                  return (
                    <article
                      className={`score-query-member${index < 3 ? ' is-top' : ''}`}
                      data-testid="score-query-row"
                      key={row.id}
                    >
                      <button
                        className="score-query-member-main"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedId((current) => current === row.id ? null : row.id)}
                      >
                        <span className="score-query-rank">{String(index + 1).padStart(2, '0')}</span>
                        <span className="score-query-name">{row.name}</span>
                        <span className="score-query-value"><small>今日得分</small><strong>{row.score ?? '—'}</strong></span>
                        <span className="score-query-value"><small>本周总分</small><strong>{row.total ?? '—'}</strong></span>
                        <span className="score-query-value"><small>赛季总分</small><strong>{row.seasonPoints ?? '—'}</strong></span>
                        <span className="score-query-toggle" aria-hidden="true">
                          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </span>
                      </button>

                      {expanded && (
                        <div className="score-query-member-detail">
                          {teamRace.length > 0 && (
                            <div className="score-query-detail-line">
                              <span>队内赛</span>
                              <span className="score-query-detail-values">
                                {teamRace.map((value, raceIndex) => <span key={`team-${raceIndex}`}>{value ?? '—'}</span>)}
                              </span>
                            </div>
                          )}
                          {openRace.length > 0 && (
                            <div className="score-query-detail-line">
                              <span>开黑赛</span>
                              <span className="score-query-detail-values">
                                {openRace.map((value, raceIndex) => <span key={`open-${raceIndex}`}>{value ?? '—'}</span>)}
                              </span>
                            </div>
                          )}
                          {teamRace.length === 0 && openRace.length === 0 && (
                            <div className="score-query-detail-line">
                              <span>周末积分</span>
                              <span className="score-query-detail-values">
                                <span>{row.points ?? '—'}</span>
                                <span>{row.score ?? '—'}</span>
                                <span>{row.total ?? '—'}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
