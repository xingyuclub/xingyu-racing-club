import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';
import { hydrateSiteData } from '../data/siteConfig.js';
import { buildScoreMemberMatcher, createScoreMemberId } from '../data/scoreRules.js';

const clone = (value) => structuredClone(value);

const WEEKEND_DAYS = [
  { offset: 5, label: '周六', hasPreviousPoints: true },
  { offset: 6, label: '周日' },
];

function getWeekendDate(monday, offset) {
  const d = new Date(monday);
  d.setDate(d.getDate() + offset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const monday = useMemo(() => getMondayOfThisWeek(), []);
  const [sortKeys, setSortKeys] = useState({});
  const weekendDates = WEEKEND_DAYS.map((day) => ({
    ...day,
    date: getWeekendDate(monday, day.offset),
  }));

  // 队员管理名单实时驱动：每个队员按归一化昵称解析到积分人物身份，
  // 缺失时按名字生成确定性 ID，首次填写时再补建积分人物。
  const memberRows = useMemo(() => {
    const matcher = buildScoreMemberMatcher(config.scoreMembers || []);
    return (config.roster || []).map((member) => {
      const matched = matcher(member.name);
      if (matched) return { ...member, scoreId: matched };
      try {
        return { ...member, scoreId: createScoreMemberId(member.name) };
      } catch {
        return { ...member, scoreId: `score:roster-${member.id}` };
      }
    });
  }, [config.roster, config.scoreMembers]);

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

  const getRow = (date, member) => {
    const id = member.scoreId;
    const round = scoresByDate.get(date);
    const source = round?.rows.find((row) => row.id === id) || { id };
    const projected = projectedRowsByKey.get(`${date}|${id}`);
    return {
      id,
      previousPoints: projected?.previousPoints ?? source.previousPoints ?? null,
      points: source.points ?? projected?.points ?? null,
      score: projected?.score ?? source.score ?? null,
      total: projected?.total ?? source.total ?? null,
      previousPointsInherited: projected?.previousPointsInherited === true,
    };
  };

  const updateField = (date, member, field, value) => {
    const next = clone(config);
    if (!Array.isArray(next.weekendScores)) next.weekendScores = [];
    if (!Array.isArray(next.scoreMembers)) next.scoreMembers = [];

    const id = member.scoreId;
    if (!next.scoreMembers.some((entry) => entry.id === id)) {
      next.scoreMembers.push({ id, name: member.name, basePoints: 0, wins: 0 });
    }

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

  return (
    <div className="weekend-score-editor">
      {weekendDates.map((day) => (
        <div key={day.date} className="weekend-score-day">
          <h3>{day.label}（{day.date}）</h3>
          <table className="weekend-score-table">
            <thead>
              <tr>
                <th>队员</th>
                {day.hasPreviousPoints && <th><span className="weekend-score-header">上周积分{sortButton(day, 'previousPoints', '上周积分')}</span></th>}
                <th><span className="weekend-score-header">积分{sortButton(day, 'points', '积分')}</span></th>
                <th><span className="weekend-score-header">得分{sortButton(day, 'score', '得分')}</span></th>
                <th><span className="weekend-score-header">总分{sortButton(day, 'total', '总分')}</span></th>
              </tr>
            </thead>
            <tbody>
              {sortMembers(day).map((member) => {
                const row = getRow(day.date, member);
                return (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    {day.hasPreviousPoints && (
                      <td>
                        <input
                          type="number"
                          aria-label={day.label + ' ' + member.name + ' 上周积分'}
                          value={row.previousPoints ?? ''}
                          readOnly={row.previousPointsInherited}
                          onChange={(event) => updateField(day.date, member, 'previousPoints', event.target.value)}
                        />
                      </td>
                    )}
                    <td>
                      <input
                        type="number"
                        aria-label={day.label + ' ' + member.name + ' 积分'}
                        value={row.points ?? ''}
                        onChange={(event) => updateField(day.date, member, 'points', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        aria-label={day.label + ' ' + member.name + ' 得分'}
                        value={row.score ?? ''}
                        readOnly
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        aria-label={day.label + ' ' + member.name + ' 总分'}
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
      ))}
    </div>
  );
}