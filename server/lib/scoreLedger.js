const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const formatWeekday = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
};

const numericValue = (value) => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const weekKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
};

const hasWeekendValues = (row) =>
  ['previousPoints', 'points', 'score', 'total'].some((field) => numericValue(row[field]) != null);

export function projectScores({ dailyScores = [], weekendScores = [], roster = [] }) {
  const totals = new Map();
  for (const member of roster) {
    totals.set(String(member.id), 0);
  }

  const events = [
    ...(Array.isArray(dailyScores) ? dailyScores : []).map((round) => ({ ...round, kind: 'daily' })),
    ...(Array.isArray(weekendScores) ? weekendScores : []).map((round) => ({ ...round, kind: 'weekend' })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  const dailyDetail = [];
  let activeWeek = null;
  let weekTotals = new Map();
  let saturdayPoints = new Map();
  const previousSundayPoints = new Map();

  for (const event of events) {
    const isWeekend = event.kind === 'weekend';
    const eventWeek = weekKey(event.date);
    if (activeWeek !== null && eventWeek !== activeWeek) {
      weekTotals = new Map();
      saturdayPoints = new Map();
      for (const memberId of totals.keys()) totals.set(memberId, 0);
    }
    activeWeek = eventWeek;

    const rows = event.rows.flatMap((row) => {
      if (isWeekend && !hasWeekendValues(row)) return [];
      const memberId = String(row.id);
      if (!totals.has(memberId)) totals.set(memberId, 0);
      const teamRace = isWeekend ? [] : [...(row.teamRace || [])];
      const openRace = isWeekend ? [] : [...(row.openRace || [])];
      const importedScore = numericValue(row.score);
      const points = numericValue(row.points);
      const weekendDay = isWeekend ? formatWeekday(event.date) : null;
      const isSaturday = weekendDay === '周六';
      const isSunday = weekendDay === '周日';
      const inheritedBaseline = isSaturday && previousSundayPoints.has(memberId);
      const previousPoints = isSaturday
        ? (inheritedBaseline ? previousSundayPoints.get(memberId) : numericValue(row.previousPoints))
        : numericValue(row.previousPoints);
      const weekendBaseline = isSaturday
        ? previousPoints
        : (isSunday ? saturdayPoints.get(memberId) ?? null : null);
      const hasWeekendFormula = isWeekend && points != null && weekendBaseline != null;
      const score = hasWeekendFormula
        ? points - weekendBaseline
        : (importedScore ?? (isWeekend ? null : sum([...teamRace, ...openRace])));
      const importedWeekTotal = numericValue(row.total);
      const calculatedWeekTotal = (weekTotals.get(memberId) || 0) + (score || 0);
      const weekTotal = hasWeekendFormula ? calculatedWeekTotal : (importedWeekTotal ?? calculatedWeekTotal);
      const total = weekTotal;
      weekTotals.set(memberId, weekTotal);
      totals.set(memberId, total);
      if (isSaturday && points != null) saturdayPoints.set(memberId, points);
      if (isSunday && points != null) previousSundayPoints.set(memberId, points);
      return [{
        id: row.id,
        teamRace,
        openRace,
        ...(isWeekend ? {
          previousPoints,
          points,
          ...(isSaturday ? { previousPointsInherited: inheritedBaseline } : {}),
        } : {}),
        score,
        weekTotal,
        total,
      }];
    });

    if (rows.length) {
      dailyDetail.push({ date: event.date, weekday: formatWeekday(event.date), rows });
    }
  }

  return { totals, dailyDetail };
}
