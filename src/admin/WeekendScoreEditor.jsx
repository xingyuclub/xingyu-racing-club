import { useMemo } from 'react';

const clone = (value) => structuredClone(value);

const WEEKEND_DAYS = [
  { offset: 5, label: '周六' },
  { offset: 6, label: '周日' },
];

function getWeekendDate(monday, offset) {
  const d = new Date(monday);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function getMondayOfThisWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diff);
  return now;
}

export function WeekendScoreEditor({ config, onChange }) {
  const monday = useMemo(() => getMondayOfThisWeek(), []);
  const weekendDates = WEEKEND_DAYS.map((day) => ({
    ...day,
    date: getWeekendDate(monday, day.offset),
  }));

  const scoresByDate = useMemo(() => {
    const map = new Map();
    for (const round of config.weekendScores || []) {
      map.set(round.date, round);
    }
    return map;
  }, [config.weekendScores]);

  const getRow = (date, memberId) => {
    const round = scoresByDate.get(date);
    return round?.rows.find((row) => row.id === memberId)
      || { id: memberId, points: '', score: '', total: '' };
  };

  const updateField = (date, memberId, field, value) => {
    const next = clone(config);
    if (!Array.isArray(next.weekendScores)) next.weekendScores = [];

    let round = next.weekendScores.find((entry) => entry.date === date);
    if (!round) {
      round = { date, rows: [] };
      next.weekendScores.push(round);
    }

    let row = round.rows.find((entry) => entry.id === memberId);
    if (!row) {
      row = { id: memberId, points: '', score: '', total: '' };
      round.rows.push(row);
    }
    row[field] = value;
    onChange(next);
  };

  return (
    <div className="weekend-score-editor">
      {weekendDates.map((day) => (
        <div key={day.date} className="weekend-score-day">
          <h3>{day.label}（{day.date}）</h3>
          <table className="weekend-score-table">
            <thead>
              <tr>
                <th>队员</th>
                <th>积分</th>
                <th>得分</th>
                <th>总分</th>
              </tr>
            </thead>
            <tbody>
              {config.scoreMembers.map((member) => {
                const row = getRow(day.date, member.id);
                return (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>
                      <input
                        type="number"
                        aria-label={day.label + ' ' + member.name + ' 积分'}
                        value={row.points}
                        onChange={(event) => updateField(day.date, member.id, 'points', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        aria-label={day.label + ' ' + member.name + ' 得分'}
                        value={row.score}
                        onChange={(event) => updateField(day.date, member.id, 'score', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        aria-label={day.label + ' ' + member.name + ' 总分'}
                        value={row.total}
                        onChange={(event) => updateField(day.date, member.id, 'total', event.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
