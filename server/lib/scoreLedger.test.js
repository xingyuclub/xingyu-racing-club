import { describe, expect, it } from 'vitest';
import { projectScores } from './scoreLedger.js';

const roster = [
  { id: '1', basePoints: 0 },
  { id: '2', basePoints: 10 },
];

describe('projectScores', () => {
  it('accumulates daily scores from base points', () => {
    const { totals, dailyDetail } = projectScores({
      roster,
      dailyScores: [
        { date: '2026-08-01', rows: [{ id: '1', teamRace: [4, 0, 0], openRace: [0, 0, 0] }] },
        { date: '2026-08-03', rows: [{ id: '1', teamRace: [2, 0, 0], openRace: [0, 0, 0] }] },
      ],
      weekendScores: [],
    });

    expect(totals.get('1')).toBe(6);
    expect(totals.get('2')).toBe(10);
    expect(dailyDetail).toHaveLength(2);
    expect(dailyDetail[0].rows[0].total).toBe(4);
    expect(dailyDetail[1].rows[0].total).toBe(6);
  });

  it('adds the weekend score to the running total', () => {
    const { totals, dailyDetail } = projectScores({
      roster,
      dailyScores: [
        { date: '2026-08-01', rows: [{ id: '1', teamRace: [4, 0, 0], openRace: [0, 0, 0] }] },
      ],
      weekendScores: [
        { date: '2026-08-02', rows: [{ id: '1', points: 100, score: 12, total: 100 }] },
      ],
    });

    expect(totals.get('1')).toBe(16);
    expect(dailyDetail).toHaveLength(2);
    expect(dailyDetail[1].date).toBe('2026-08-02');
    expect(dailyDetail[1].rows[0]).toEqual({ id: '1', teamRace: [], openRace: [], score: 12, total: 16 });
  });

  it('keeps weekends in the daily detail and accumulates additively', () => {
    const { totals, dailyDetail } = projectScores({
      roster,
      dailyScores: [
        { date: '2026-08-01', rows: [{ id: '1', teamRace: [4, 0, 0], openRace: [0, 0, 0] }] },
        { date: '2026-08-03', rows: [{ id: '1', teamRace: [3, 0, 0], openRace: [0, 0, 0] }] },
      ],
      weekendScores: [
        { date: '2026-08-02', rows: [{ id: '1', points: 100, score: 12, total: 100 }] },
      ],
    });

    expect(totals.get('1')).toBe(19);
    expect(dailyDetail).toHaveLength(3);
    expect(dailyDetail[0].rows[0].total).toBe(4);
    expect(dailyDetail[1].rows[0].total).toBe(16);
    expect(dailyDetail[2].rows[0].total).toBe(19);
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
