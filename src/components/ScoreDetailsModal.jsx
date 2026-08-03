import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const padNumber = (value) => String(value).padStart(2, '0');

const parseDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
};

const formatDateLabel = (dateKey) => {
  const { year, month, day } = parseDateKey(dateKey);
  return `${year}年${month}月${day}日`;
};

const getLatestDate = (dailyScores) => dailyScores.at(-1)?.date || '';
const getInitialMonth = (dailyScores) => {
  const targetDate = getLatestDate(dailyScores) || dailyScores[0]?.date || '2026-07-01';
  const { year, month } = parseDateKey(targetDate);
  return { year, month };
};

const displayScore = (value) => value ?? '—';

const sortableValue = (value) => (
  value === null || value === undefined || value === '' ? Number.NEGATIVE_INFINITY : Number(value)
);

export function ScoreDetailsModal({ dailyScores = [], onClose }) {
  const [visibleMonth, setVisibleMonth] = useState(() => getInitialMonth(dailyScores));
  const [selectedDate, setSelectedDate] = useState(() => getLatestDate(dailyScores) || null);
  const [sortKey, setSortKey] = useState('total');
  const [sortDirection, setSortDirection] = useState('desc');
  const scoreByDate = useMemo(
    () => new Map(dailyScores.map((record) => [record.date, record])),
    [dailyScores],
  );
  const selectedScore = selectedDate ? scoreByDate.get(selectedDate) : null;
  const isSaturday = selectedScore?.weekday === '周六';
  const isWeekend = isSaturday || selectedScore?.weekday === '周日';
  const sortOptions = isWeekend ? ['points', 'score', 'total'] : ['score', 'total'];
  const activeSortKey = sortOptions.includes(sortKey) ? sortKey : 'total';
  const activeSortDirection = sortOptions.includes(sortKey) ? sortDirection : 'desc';
  const sortedRows = useMemo(() => {
    if (!selectedScore) return [];

    const direction = activeSortDirection === 'asc' ? 1 : -1;
    return selectedScore.rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const difference = sortableValue(a.row[activeSortKey]) - sortableValue(b.row[activeSortKey]);
        return difference === 0 ? a.index - b.index : difference * direction;
      })
      .map(({ row }) => row);
  }, [activeSortDirection, activeSortKey, selectedScore]);
  const firstWeekday = new Date(visibleMonth.year, visibleMonth.month - 1, 1).getDay();
  const daysInMonth = new Date(visibleMonth.year, visibleMonth.month, 0).getDate();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    setSortKey('total');
    setSortDirection('desc');
  }, [selectedDate]);

  const changeMonth = (offset) => {
    const nextMonth = new Date(visibleMonth.year, visibleMonth.month - 1 + offset, 1);
    setVisibleMonth({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 });
    setSelectedDate(null);
  };

  const toggleSort = (nextSortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection('desc');
  };

  const renderSortableHeader = (label, key, rowSpan) => {
    const isActive = activeSortKey === key;
    const directionLabel = isActive
      ? (activeSortDirection === 'desc' ? '降序' : '升序')
      : '未排序';
    const SortIcon = isActive
      ? (activeSortDirection === 'desc' ? ChevronDown : ChevronUp)
      : ArrowDownUp;

    return (
      <th
        scope="col"
        rowSpan={rowSpan}
        aria-sort={isActive ? (activeSortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
        aria-label={label}
      >
        <button
          className="daily-score-sort-button"
          type="button"
          onClick={() => toggleSort(key)}
          aria-label={`按${label}排序，当前${directionLabel}，点击切换`}
          title={`按${label}排序`}
        >
          <span>{label}</span>
          <SortIcon aria-hidden="true" size={13} strokeWidth={2.4} />
        </button>
      </th>
    );
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="video-modal score-details-modal"
        data-entrance
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-details-title"
      >
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭日期积分查询">
          <X aria-hidden="true" size={20} />
        </button>
        <p className="eyebrow">DAILY POINTS</p>
        <h2 id="score-details-title">日期积分查询</h2>

        <div className="score-calendar-toolbar">
          <button
            className="calendar-nav-button"
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="上一个月"
            title="上一个月"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <strong>{visibleMonth.year}年{visibleMonth.month}月</strong>
          <button
            className="calendar-nav-button"
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="下一个月"
            title="下一个月"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="score-calendar" aria-label={`${visibleMonth.year}年${visibleMonth.month}月日历`}>
          {WEEKDAYS.map((weekday) => (
            <span className="calendar-weekday" key={weekday}>{weekday}</span>
          ))}
          {Array.from({ length: firstWeekday }, (_, index) => (
            <span className="calendar-spacer" key={`spacer-${index}`} aria-hidden="true" />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const dateKey = `${visibleMonth.year}-${padNumber(visibleMonth.month)}-${padNumber(day)}`;
            const hasScores = scoreByDate.has(dateKey);
            const isSelected = selectedDate === dateKey;

            return (
              <button
                className={`calendar-day${hasScores ? ' has-scores' : ''}${isSelected ? ' is-selected' : ''}`}
                type="button"
                key={dateKey}
                onClick={() => setSelectedDate(dateKey)}
                aria-label={`查看 ${formatDateLabel(dateKey)}积分`}
                aria-pressed={isSelected}
              >
                {day}
              </button>
            );
          })}
        </div>

        {!selectedDate && <p className="score-calendar-hint">选择日期查看当天积分</p>}

        {selectedDate && !selectedScore && (
          <div className="daily-score-empty">
            <strong>{formatDateLabel(selectedDate)}</strong>
            <p>当日暂无积分记录</p>
          </div>
        )}

        {selectedScore && (
          <section className="daily-score-panel" aria-labelledby="daily-score-date">
            <h3 id="daily-score-date">
              {formatDateLabel(selectedScore.date)} · {selectedScore.weekday}
            </h3>
            <div className="daily-score-table-wrap">
              {isWeekend ? (
                <table className="daily-score-table daily-score-table--weekend">
                  <thead>
                    <tr>
                      <th scope="col" rowSpan="2">队员</th>
                      <th scope="colgroup" colSpan={isSaturday ? 4 : 3}>车队赛</th>
                    </tr>
                    <tr>
                      {isSaturday && <th scope="col">上周积分</th>}
                      {renderSortableHeader('积分', 'points')}
                      {renderSortableHeader('得分', 'score')}
                      {renderSortableHeader('总分', 'total')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.id} data-testid="daily-score-row">
                        <th scope="row">{row.name}</th>
                        {isSaturday && <td>{displayScore(row.previousPoints)}</td>}
                        <td>{displayScore(row.points)}</td>
                        <td>{displayScore(row.score)}</td>
                        <td>{displayScore(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
              <table className="daily-score-table">
                <thead>
                  <tr>
                    <th scope="col" rowSpan="2">队员</th>
                    <th scope="colgroup" colSpan="3">队内赛</th>
                    <th scope="colgroup" colSpan="3">开黑赛</th>
                    {renderSortableHeader('得分', 'score', 2)}
                    {renderSortableHeader('总分', 'total', 2)}
                  </tr>
                  <tr>
                    <th scope="col">第一局</th>
                    <th scope="col">第二局</th>
                    <th scope="col">第三局</th>
                    <th scope="col">第一局</th>
                    <th scope="col">第二局</th>
                    <th scope="col">第三局</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr key={row.id} data-testid="daily-score-row">
                      <th scope="row">{row.name}</th>
                      {Array.from({ length: 3 }, (_, index) => (
                        <td key={`team-${index}`}>{row.teamRace[index] ?? '—'}</td>
                      ))}
                      {Array.from({ length: 3 }, (_, index) => (
                        <td key={`open-${index}`}>{row.openRace[index] ?? '—'}</td>
                      ))}
                      <td>{displayScore(row.score)}</td>
                      <td>{displayScore(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
