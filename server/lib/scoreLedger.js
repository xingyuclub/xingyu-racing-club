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

export function projectScores({
  dailyScores = [],
  weekendScores = [],
  roster = [],
  seasonStartDate = '',
  seasonEndDate = '',
  previousSeasonStartDate = '',
  previousSeasonEndDate = '',
}) {
  const totals = new Map();
  const seasonTotals = new Map();
  const previousSeasonTotals = new Map();
  for (const member of roster) {
    totals.set(String(member.id), 0);
    seasonTotals.set(String(member.id), 0);
    previousSeasonTotals.set(String(member.id), 0);
  }

  const events = [
    ...(Array.isArray(dailyScores) ? dailyScores : []).map((round) => ({ ...round, kind: 'daily' })),
    ...(Array.isArray(weekendScores) ? weekendScores : []).map((round) => ({ ...round, kind: 'weekend' })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  const dailyDetail = [];
  let activeWeek = null;
  let weekTotals = new Map();
  let saturdayPoints = new Map();
  let previousWeekendPoints = new Map();
  let weekMembers = new Set();
  let seasonStarted = false;
  let firstSeasonWeekend = false;

  for (const event of events) {
    const isWeekend = event.kind === 'weekend';
    const isInSeason = (!seasonStartDate || event.date >= seasonStartDate)
      && (!seasonEndDate || event.date <= seasonEndDate);
    const isInPreviousSeason = Boolean(previousSeasonStartDate || previousSeasonEndDate)
      && (!previousSeasonStartDate || event.date >= previousSeasonStartDate)
      && (!previousSeasonEndDate || event.date <= previousSeasonEndDate);
    if (isInSeason && !seasonStarted) {
      seasonStarted = true;
      // 新赛季重新起算周末积分基线，不再继承上一赛季的周末累计积分。
      if (previousWeekendPoints.size > 0) {
        firstSeasonWeekend = true;
        previousWeekendPoints = new Map();
      }
    }
    const isFirstSeasonWeekend = isWeekend && isInSeason && firstSeasonWeekend;
    if (isFirstSeasonWeekend) firstSeasonWeekend = false;
    const eventWeek = weekKey(event.date);
    if (activeWeek !== null && eventWeek !== activeWeek) {
      weekTotals = new Map();
      saturdayPoints = new Map();
      weekMembers = new Set();
      for (const memberId of totals.keys()) totals.set(memberId, 0);
    }
    activeWeek = eventWeek;

    const rows = event.rows.flatMap((row) => {
      if (isWeekend && !hasWeekendValues(row)) return [];
      const memberId = String(row.id);
      if (!totals.has(memberId)) totals.set(memberId, 0);
      weekMembers.add(memberId);
      const teamRace = isWeekend ? [] : [...(row.teamRace || [])];
      const openRace = isWeekend ? [] : [...(row.openRace || [])];
      const importedScore = numericValue(row.score);
      const points = numericValue(row.points);
      const weekendDay = isWeekend ? formatWeekday(event.date) : null;
      const isSaturday = weekendDay === '周六';
      const isSunday = weekendDay === '周日';
      const inheritedBaseline = isSaturday && previousWeekendPoints.has(memberId);
      const storedPreviousPoints = numericValue(row.previousPoints);
      const previousPoints = isSaturday
        ? (inheritedBaseline
          ? previousWeekendPoints.get(memberId)
          : (isFirstSeasonWeekend && storedPreviousPoints == null ? 0 : storedPreviousPoints))
        : storedPreviousPoints;
      const weekendBaseline = isSaturday
        ? previousPoints
        : (isSunday ? saturdayPoints.get(memberId) ?? null : null);
      const hasWeekendFormula = isWeekend && points != null && weekendBaseline != null;
      const score = hasWeekendFormula
        ? points - weekendBaseline
        : (importedScore ?? (isWeekend ? null : sum([...teamRace, ...openRace])));
      const importedWeekTotal = numericValue(row.total);
      const previousWeekTotal = weekTotals.get(memberId) || 0;
      const calculatedWeekTotal = previousWeekTotal + (score || 0);
      const weekTotal = hasWeekendFormula ? calculatedWeekTotal : (importedWeekTotal ?? calculatedWeekTotal);
      const total = weekTotal;
      const earnedScore = score != null
        ? score
        : (importedWeekTotal != null ? Math.max(0, importedWeekTotal - previousWeekTotal) : 0);
      weekTotals.set(memberId, weekTotal);
      totals.set(memberId, total);
      if ((!seasonStartDate || event.date >= seasonStartDate) && (!seasonEndDate || event.date <= seasonEndDate)) {
        seasonTotals.set(memberId, (seasonTotals.get(memberId) || 0) + earnedScore);
      }
      if (isInPreviousSeason) {
        previousSeasonTotals.set(memberId, (previousSeasonTotals.get(memberId) || 0) + earnedScore);
      }
      if (isSaturday && points != null) saturdayPoints.set(memberId, points);
      if (isWeekend && points != null) previousWeekendPoints.set(memberId, points);
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
        seasonPoints: isInSeason
          ? (seasonTotals.get(memberId) || 0)
          : (isInPreviousSeason ? (previousSeasonTotals.get(memberId) || 0) : 0),
      }];
    });

    // 日期查询需要保留当天没有录入、但仍属于积分名单的人，才能查看他们
    // 当天的 0 分和截至当天的赛季累计积分。周末完全没有有效数据的日期仍跳过。
    if (rows.length || !isWeekend) {
      const displayedIds = new Set(rows.map((row) => String(row.id)));
      for (const memberId of totals.keys()) {
        if (displayedIds.has(memberId)) continue;
        const weekTotal = weekTotals.get(memberId) || 0;
        rows.push({
          id: memberId,
          teamRace: isWeekend ? [] : [null, null, null],
          openRace: isWeekend ? [] : [null, null, null],
          ...(isWeekend ? { previousPoints: null, points: null } : {}),
          score: 0,
          weekTotal,
          total: weekTotal,
          seasonPoints: isInSeason
            ? (seasonTotals.get(memberId) || 0)
            : (isInPreviousSeason ? (previousSeasonTotals.get(memberId) || 0) : 0),
        });
      }
      dailyDetail.push({ date: event.date, weekday: formatWeekday(event.date), rows });
    }
  }

  return { totals, seasonTotals, previousSeasonTotals, dailyDetail, weekMembers };
}
