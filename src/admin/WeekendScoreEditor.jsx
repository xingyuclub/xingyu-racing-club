import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { hydrateSiteData, SEASON_START_DATE } from '../data/siteConfig.js';

const clone = (value) => structuredClone(value);

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getWeekendDate(monday, offset) {
  const d = new Date(monday);
  d.setDate(d.getDate() + offset);
  return formatDateKey(d);
}

const numericInputValue = (value) => value === '' ? null : Number(value);

function getMondayOfThisWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diff);
  return now;
}

export function WeekendScoreEditor({ config, onChange }) {
  const [selectedDate, setSelectedDate] = useState(() => getWeekendDate(getMondayOfThisWeek(), 5));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = dateFromKey(getWeekendDate(getMondayOfThisWeek(), 5));
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [sortKeys, setSortKeys] = useState({});
  const selectedDay = dateFromKey(selectedDate);
  const selectedWeekend = {
    date: selectedDate,
    label: WEEKDAY_LABELS[selectedDay.getDay()],
    hasPreviousPoints: selectedDay.getDay() === 6,
    hasPreviousDayPoints: selectedDay.getDay() === 0,
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: firstDay.getDay() }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
      cells.push({ date, dateKey: formatDateKey(date), isWeekend: [0, 6].includes(date.getDay()) });
    }
    return cells;
  }, [visibleMonth]);

  // 周末录入由积分榜人员名单独立驱动，与队员阵容互不影响。
  const memberRows = useMemo(() =>
    (config.scoreMembers || []).map((member) => ({ ...member, scoreId: member.id })),
  [config.scoreMembers]);

  const scoresByDate = useMemo(() => {
    const map = new Map();
    for (const round of config.weekendScores || []) {
      map.set(round.date, round);
    }
    return map;
  }, [config.weekendScores]);

  const hydrated = useMemo(() => hydrateSiteData(config), [config]);
  const projectedRowsByKey = useMemo(() => {
    const map = new Map();
    for (const round of hydrated.dailyScores || []) {
      for (const row of round.rows || []) map.set(`${round.date}|${row.id}`, row);
    }
    return map;
  }, [hydrated.dailyScores]);

  const isNewSeasonWeekend = Boolean(SEASON_START_DATE) && selectedDate >= SEASON_START_DATE;

  const inheritedPreviousPointsById = useMemo(() => {
    const map = new Map();
    if (!selectedWeekend.hasPreviousPoints) return map;
    for (const round of hydrated.dailyScores || []) {
      if (round.date >= selectedDate || !['周六', '周日'].includes(round.weekday)) continue;
      if (isNewSeasonWeekend && round.date < SEASON_START_DATE) continue;
      for (const row of round.rows || []) {
        if (row.points != null) map.set(row.id, row.points);
      }
    }
    return map;
  }, [hydrated.dailyScores, selectedDate, selectedWeekend.hasPreviousPoints, isNewSeasonWeekend]);

  // 上一赛季是否存在周末累计积分，用于判断“新赛季第一个周末”应从 0 起算。
  const hasPriorSeasonWeekendPoints = useMemo(() => {
    if (!SEASON_START_DATE) return false;
    for (const round of hydrated.dailyScores || []) {
      if (round.date >= SEASON_START_DATE || !['周六', '周日'].includes(round.weekday)) continue;
      if ((round.rows || []).some((row) => row.points != null)) return true;
    }
    return false;
  }, [hydrated.dailyScores]);

  const getRow = (date, member) => {
    const id = member.scoreId;
    const round = scoresByDate.get(date);
    const source = round?.rows?.find((row) => row.id === id) || { id };
    const projected = projectedRowsByKey.get(`${date}|${id}`);
    const dateValue = dateFromKey(date);
    dateValue.setDate(dateValue.getDate() - 1);
    const previousDayRound = scoresByDate.get(formatDateKey(dateValue));
    const previousDayRow = previousDayRound?.rows?.find((row) => row.id === id);
    const inheritedPreviousPoints = inheritedPreviousPointsById.get(id);
    const firstNewSeasonWeekend = selectedWeekend.hasPreviousPoints
      && Boolean(SEASON_START_DATE)
      && selectedDate >= SEASON_START_DATE
      && hasPriorSeasonWeekendPoints
      && inheritedPreviousPointsById.size === 0;
    return {
      id,
      previousPoints: projected?.previousPoints ?? inheritedPreviousPoints ?? source.previousPoints ?? (firstNewSeasonWeekend ? 0 : null),
      points: source.points ?? projected?.points ?? null,
      score: projected?.score ?? source.score ?? null,
      total: projected?.total ?? source.total ?? null,
      previousPointsInherited: projected?.previousPointsInherited === true || inheritedPreviousPoints != null,
      previousDayPoints: previousDayRow?.points ?? null,
    };
  };

  const positiveScoreCount = memberRows.reduce(
    (count, member) => count + (Number(getRow(selectedWeekend.date, member).score) > 0 ? 1 : 0),
    0,
  );

  const updateField = (date, member, field, value) => {
    const next = clone(config);
    if (!Array.isArray(next.weekendScores)) next.weekendScores = [];

    const id = member.scoreId;
    let round = next.weekendScores.find((entry) => entry.date === date);
    if (!round) {
      round = { date, rows: [] };
      next.weekendScores.push(round);
    }

    let row = round.rows.find((entry) => entry.id === id);
    if (!row) {
      row = { id, previousPoints: null, points: null, score: null, total: null };
      round.rows.push(row);
    }
    row[field] = numericInputValue(value);
    onChange(next);
  };

  const sortMembers = (day) => {
    const field = sortKeys[day.date];
    const members = [...memberRows];
    if (!field) return members;
    return members.sort((left, right) => {
      const leftValue = getRow(day.date, left)[field];
      const rightValue = getRow(day.date, right)[field];
      const leftNumber = leftValue == null || leftValue === '' ? Number.NEGATIVE_INFINITY : Number(leftValue);
      const rightNumber = rightValue == null || rightValue === '' ? Number.NEGATIVE_INFINITY : Number(rightValue);
      return rightNumber - leftNumber || String(left.name || '').localeCompare(String(right.name || ''));
    });
  };

  const sortButton = (day, field, label) => (
    <button
      type="button"
      className="weekend-score-sort"
      aria-label={`按${day.label}${label}从大到小排序`}
      title={`按${day.label}${label}从大到小排序`}
      onClick={() => setSortKeys((current) => ({ ...current, [day.date]: field }))}
    >
      <ArrowDownWideNarrow size={14} aria-hidden="true" />
    </button>
  );

  const changeMonth = (offset) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div className="weekend-score-editor">
      <section className="weekend-score-calendar" aria-label="选择周末录入日期">
        <div className="weekend-score-calendar-title">
          <span><CalendarDays size={16} aria-hidden="true" />选择录入日期</span>
          <small>仅可选择周六、周日</small>
        </div>
        <div className="weekend-score-calendar-header">
          <button type="button" aria-label="上个月" title="上个月" onClick={() => changeMonth(-1)}>
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <strong>{visibleMonth.getFullYear()}年{visibleMonth.getMonth() + 1}月</strong>
          <button type="button" aria-label="下个月" title="下个月" onClick={() => changeMonth(1)}>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="weekend-score-calendar-grid" role="grid" aria-label="周末日期">
          {WEEKDAY_LABELS.map((label) => <span key={label} className="weekend-score-calendar-weekday" role="columnheader">{label}</span>)}
          {calendarDays.map((cell, index) => cell ? (
            <button
              key={cell.dateKey}
              type="button"
              className={cell.dateKey === selectedDate ? 'is-selected' : ''}
              aria-label={`${cell.dateKey} ${WEEKDAY_LABELS[cell.date.getDay()]}`}
              aria-pressed={cell.dateKey === selectedDate}
              disabled={!cell.isWeekend}
              title={cell.isWeekend ? `选择${WEEKDAY_LABELS[cell.date.getDay()]} ${cell.dateKey}` : '工作日不可录入'}
              onClick={() => setSelectedDate(cell.dateKey)}
            >
              {cell.date.getDate()}
            </button>
          ) : <span key={`empty-${index}`} aria-hidden="true" />)}
        </div>
      </section>

      <div className="weekend-score-day">
        <h3>{selectedWeekend.label}（{selectedWeekend.date}）</h3>
        <table className="weekend-score-table">
            <thead>
              <tr>
                <th>队员</th>
                {selectedWeekend.hasPreviousDayPoints && <th><span className="weekend-score-header">周六积分{sortButton(selectedWeekend, 'previousDayPoints', '周六积分')}</span></th>}
                {selectedWeekend.hasPreviousPoints && <th><span className="weekend-score-header">上周积分{sortButton(selectedWeekend, 'previousPoints', '上周积分')}</span></th>}
                <th><span className="weekend-score-header">积分{sortButton(selectedWeekend, 'points', '积分')}</span></th>
                <th><span className="weekend-score-header">得分（{positiveScoreCount}人）{sortButton(selectedWeekend, 'score', '得分')}</span></th>
                <th><span className="weekend-score-header">总分{sortButton(selectedWeekend, 'total', '总分')}</span></th>
              </tr>
            </thead>
            <tbody>
              {sortMembers(selectedWeekend).map((member) => {
                const row = getRow(selectedWeekend.date, member);
                return (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    {selectedWeekend.hasPreviousDayPoints && (
                      <td>
                        <input
                          type="number"
                          aria-label={`周日 ${member.name} 周六积分`}
                          value={row.previousDayPoints ?? ''}
                          readOnly
                        />
                      </td>
                    )}
                    {selectedWeekend.hasPreviousPoints && (
                      <td>
                        <input
                          type="number"
                          aria-label={selectedWeekend.label + ' ' + member.name + ' 上周积分'}
                          value={row.previousPoints ?? ''}
                          readOnly={row.previousPointsInherited}
                          onChange={(event) => updateField(selectedWeekend.date, member, 'previousPoints', event.target.value)}
                        />
                      </td>
                    )}
                    <td>
                      <input
                        type="number"
                        aria-label={selectedWeekend.label + ' ' + member.name + ' 积分'}
                        value={row.points ?? ''}
                        onChange={(event) => updateField(selectedWeekend.date, member, 'points', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        aria-label={selectedWeekend.label + ' ' + member.name + ' 得分'}
                        value={row.score ?? ''}
                        readOnly
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        aria-label={selectedWeekend.label + ' ' + member.name + ' 总分'}
                        value={row.total ?? ''}
                        readOnly
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </table>
      </div>
    </div>
  );
}
