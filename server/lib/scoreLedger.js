const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const formatWeekday = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
};

export function projectScores({ dailyScores = [], weekendScores = [], roster = [] }) {
  const totals = new Map();
  for (const member of roster) {
    totals.set(String(member.id), Number(member.basePoints ?? member.points ?? 0));
  }

  const events = [
    ...(Array.isArray(dailyScores) ? dailyScores : []).map((round) => ({ ...round, kind: 'daily' })),
    ...(Array.isArray(weekendScores) ? weekendScores : []).map((round) => ({ ...round, kind: 'weekend' })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  const dailyDetail = [];
  for (const event of events) {
    const isWeekend = event.kind === 'weekend';
    const rows = event.rows.map((row) => {
      const memberId = String(row.id);
      if (!totals.has(memberId)) totals.set(memberId, 0);
      const teamRace = isWeekend ? [] : [...row.teamRace];
      const openRace = isWeekend ? [] : [...row.openRace];
      const score = isWeekend
        ? Number(row.score) || 0
        : sum([...teamRace, ...openRace]);
      const total = totals.get(memberId) + score;
      totals.set(memberId, total);
      return { id: row.id, teamRace, openRace, score, total };
    });

    dailyDetail.push({ date: event.date, weekday: formatWeekday(event.date), rows });
  }

  return { totals, dailyDetail };
}
