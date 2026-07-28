import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

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

const getInitialMonth = (dailyScores) => {
  const firstDate = dailyScores[0]?.date || '2026-07-01';
  const { year, month } = parseDateKey(firstDate);
  return { year, month };
};

export function ScoreDetailsModal({ dailyScores = [], onClose }) {
  const [visibleMonth, setVisibleMonth] = useState(() => getInitialMonth(dailyScores));
  const [selectedDate, setSelectedDate] = useState(null);
  const scoreByDate = useMemo(
    () => new Map(dailyScores.map((record) => [record.date, record])),
    [dailyScores],
  );
  const selectedScore = selectedDate ? scoreByDate.get(selectedDate) : null;
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

  const changeMonth = (offset) => {
    const nextMonth = new Date(visibleMonth.year, visibleMonth.month - 1 + offset, 1);
    setVisibleMonth({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 });
    setSelectedDate(null);
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
              <table className="daily-score-table">
                <thead>
                  <tr>
                    <th scope="col" rowSpan="2">队员</th>
                    <th scope="colgroup" colSpan="3">队内赛</th>
                    <th scope="colgroup" colSpan="3">开黑赛</th>
                    <th scope="col" rowSpan="2">得分</th>
                    <th scope="col" rowSpan="2">总分</th>
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
                  {selectedScore.rows.map((row) => (
                    <tr key={row.id} data-testid="daily-score-row">
                      <th scope="row">{row.name}</th>
                      {row.teamRace.map((value, index) => <td key={`team-${index}`}>{value}</td>)}
                      {row.openRace.map((value, index) => <td key={`open-${index}`}>{value}</td>)}
                      <td>{row.score}</td>
                      <td>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
