import { describe, expect, it } from 'vitest';
import { projectScores } from './scoreLedger.js';

const roster = [
  { id: '1', basePoints: 0 },
  { id: '2', basePoints: 10 },
];

describe('projectScores', () => {
  it('calculates a running total within each week and resets on Monday', () => {
    const { totals, dailyDetail } = projectScores({
      roster,
      dailyScores: [
        { date: '2026-08-03', rows: [{ id: '1', teamRace: [4, 0, 0], openRace: [0, 0, 0] }] },
        { date: '2026-08-04', rows: [{ id: '1', teamRace: [2, 0, 0], openRace: [0, 0, 0] }] },
        { date: '2026-08-10', rows: [{ id: '1', teamRace: [3, 0, 0], openRace: [0, 0, 0] }] },
      ],
      weekendScores: [],
    });

    expect(totals.get('1')).toBe(3);
    expect(totals.get('2')).toBe(0);
    expect(dailyDetail).toHaveLength(3);
    expect(dailyDetail[0].rows[0].total).toBe(4);
    expect(dailyDetail[1].rows[0].total).toBe(6);
    expect(dailyDetail[2].rows[0].total).toBe(3);
  });

  it('uses the exact weekend week total instead of rebuilding it from the score field', () => {
    const { totals, dailyDetail } = projectScores({
      roster,
      dailyScores: [
        { date: '2026-08-01', rows: [{ id: '1', teamRace: [4, 0, 0], openRace: [0, 0, 0] }] },
      ],
      weekendScores: [
        { date: '2026-08-02', rows: [{ id: '1', points: 100, score: 12, total: 100 }] },
      ],
    });

    expect(totals.get('1')).toBe(100);
    expect(dailyDetail).toHaveLength(2);
    expect(dailyDetail[1].date).toBe('2026-08-02');
    expect(dailyDetail[1].rows[0]).toEqual({
      id: '1',
      teamRace: [],
      openRace: [],
      previousPoints: null,
      points: 100,
      score: 12,
      weekTotal: 100,
      total: 100,
    });
  });

  it('keeps each week independent across weekday and weekend events', () => {
    const { totals, dailyDetail } = projectScores({
      roster,
      dailyScores: [
        { date: '2026-06-29', rows: [{ id: '1', teamRace: [3, 0, 0], openRace: [0, 0, 0], score: null, total: 3 }] },
        { date: '2026-07-03', rows: [{ id: '1', teamRace: [4, 0, 0], openRace: [0, 0, 0], score: 4, total: 7 }] },
        { date: '2026-07-06', rows: [{ id: '1', teamRace: [2, 0, 0], openRace: [0, 0, 0], score: null, total: 2 }] },
      ],
      weekendScores: [
        { date: '2026-07-04', rows: [{ id: '1', previousPoints: null, points: 10, score: null, total: 17 }] },
        { date: '2026-07-05', rows: [{ id: '1', points: 15, score: 5, total: 22 }] },
        { date: '2026-07-11', rows: [{ id: '1', previousPoints: 15, points: 19, score: 4, total: 6 }] },
        { date: '2026-07-12', rows: [{ id: '1', points: null, score: null, total: null }] },
      ],
    });

    expect(totals.get('1')).toBe(6);
    expect(dailyDetail.map((round) => round.date)).toEqual([
      '2026-06-29', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-11',
    ]);
    expect(dailyDetail.map((round) => round.rows[0].total)).toEqual([3, 7, 17, 22, 2, 6]);
    expect(dailyDetail[2].rows[0]).toMatchObject({
      previousPoints: null,
      points: 10,
      score: null,
      weekTotal: 17,
      total: 17,
    });
  });

  it('derives weekend scores from team-race point differences when the source leaves them blank', () => {
    const { dailyDetail } = projectScores({
      roster: [{ id: '1', basePoints: 0 }],
      dailyScores: [
        { date: '2026-08-07', rows: [{ id: '1', teamRace: [0, 0, 0], openRace: [0, 0, 0], score: 20, total: 20 }] },
      ],
      weekendScores: [
        { date: '2026-08-08', rows: [{ id: '1', previousPoints: 90, points: 100, score: null, total: null }] },
        { date: '2026-08-09', rows: [{ id: '1', points: 110, score: null, total: null }] },
      ],
    });

    expect(dailyDetail.slice(1).map((round) => round.rows[0])).toEqual([
      expect.objectContaining({ points: 100, score: 10, total: 30, weekTotal: 30 }),
      expect.objectContaining({ points: 110, score: 10, total: 40, weekTotal: 40 }),
    ]);
  });

  it('derives weekend formulas and carries Sunday points into next Saturday', () => {
    const { dailyDetail } = projectScores({
      roster: [{ id: '1' }],
      dailyScores: [
        { date: '2026-08-07', rows: [{ id: '1', teamRace: [20, 0, 0], openRace: [0, 0, 0] }] },
        { date: '2026-08-14', rows: [{ id: '1', teamRace: [8, 0, 0], openRace: [0, 0, 0] }] },
      ],
      weekendScores: [
        { date: '2026-08-08', rows: [{ id: '1', previousPoints: 90, points: 100, score: 999, total: 999 }] },
        { date: '2026-08-09', rows: [{ id: '1', points: 112, score: 999, total: 999 }] },
        { date: '2026-08-15', rows: [{ id: '1', previousPoints: 999, points: 120, score: 999, total: 999 }] },
      ],
    });

    expect(dailyDetail.find(({ date }) => date === '2026-08-08').rows[0]).toMatchObject({
      previousPoints: 90,
      previousPointsInherited: false,
      score: 10,
      total: 30,
    });
    expect(dailyDetail.find(({ date }) => date === '2026-08-09').rows[0]).toMatchObject({ score: 12, total: 42 });
    expect(dailyDetail.find(({ date }) => date === '2026-08-15').rows[0]).toMatchObject({
      previousPoints: 112,
      previousPointsInherited: true,
      score: 8,
      total: 16,
    });
  });

  it('falls back to imported weekend score and total when formula inputs are incomplete', () => {
    const { dailyDetail } = projectScores({
      roster: [{ id: '1' }],
      weekendScores: [
        { date: '2026-08-08', rows: [{ id: '1', previousPoints: null, points: 100, score: 7, total: 17 }] },
      ],
    });

    expect(dailyDetail[0].rows[0]).toMatchObject({
      previousPoints: null,
      previousPointsInherited: false,
      score: 7,
      total: 17,
    });
  });

  it('tracks totals for historical members not in the roster', () => {
    const { totals } = projectScores({
      roster,
      dailyScores: [
        { date: '2026-08-01', rows: [{ id: '99', teamRace: [5, 0, 0], openRace: [0, 0, 0] }] },
      ],
      weekendScores: [],
    });

    expect(totals.get('99')).toBe(5);
  });

  it('includes the weekday label for daily detail rows', () => {
    const { dailyDetail } = projectScores({
      roster,
      dailyScores: [{ date: '2026-08-01', rows: [{ id: '1', teamRace: [0, 0, 0], openRace: [0, 0, 0] }] }],
      weekendScores: [],
    });

    expect(dailyDetail[0].weekday).toBe('周六');
  });

  it('handles empty inputs gracefully', () => {
    const { totals, dailyDetail } = projectScores({});

    expect(totals.size).toBe(0);
    expect(dailyDetail).toEqual([]);
  });
});
