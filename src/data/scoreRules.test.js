import { describe, expect, it } from 'vitest';
import {
  assignMemberSlots,
  buildScoreMemberMatcher,
  buildDuplicateSignature,
  buildMemberMatcher,
  createScoreMemberId,
  invalidateFollowingWeekTotals,
  normalizeNickname,
  scoreRankedRace,
  scoreTeamRace,
} from './scoreRules.js';

describe('invalidateFollowingWeekTotals', () => {
  it('clears totals from the edited date through the end of the same week', () => {
    const config = {
      dailyScores: [
        { date: '2026-07-27', rows: [{ id: '1', total: 10 }] },
        { date: '2026-07-28', rows: [{ id: '1', total: 12 }, { id: '2', total: 20 }] },
        { date: '2026-07-31', rows: [{ id: '1', total: 18 }] },
        { date: '2026-08-03', rows: [{ id: '1', total: 30 }] },
      ],
      weekendScores: [
        { date: '2026-08-01', rows: [{ id: '1', total: 21 }] },
        { date: '2026-08-02', rows: [{ id: '1', total: 24 }] },
      ],
    };

    invalidateFollowingWeekTotals(config, { date: '2026-07-28', id: '1' });

    expect(config.dailyScores[0].rows[0].total).toBe(10);
    expect(config.dailyScores[1].rows[0]).not.toHaveProperty('total');
    expect(config.dailyScores[1].rows[1].total).toBe(20);
    expect(config.dailyScores[2].rows[0]).not.toHaveProperty('total');
    expect(config.weekendScores[0].rows[0]).not.toHaveProperty('total');
    expect(config.weekendScores[1].rows[0]).not.toHaveProperty('total');
    expect(config.dailyScores[3].rows[0].total).toBe(30);
  });

  it('ignores an incomplete date while the editor input is being cleared', () => {
    const config = {
      dailyScores: [{ date: '2026-07-28', rows: [{ id: '1', total: 12 }] }],
      weekendScores: [],
    };

    expect(() => invalidateFollowingWeekTotals(config, { date: '', id: '1' })).not.toThrow();
    expect(config.dailyScores[0].rows[0].total).toBe(12);
  });
});

describe('score member identity', () => {
  it('creates the same score id with or without the team prefix', () => {
    expect(createScoreMemberId('青山')).toBe(createScoreMemberId('ˣʸ༩·青山'));
  });

  it('finds a score member by its normalized name', () => {
    const findScoreMember = buildScoreMemberMatcher([
      { id: 'score:qingshan', name: '青山' },
    ]);
    expect(findScoreMember('ˣʸ༩·青山')).toBe('score:qingshan');
  });
});

describe('scoreTeamRace', () => {
  it('scores a 4-person race as 4,3,2,1', () => {
    expect(scoreTeamRace({ participantCount: 4, rank: 1 })).toBe(4);
    expect(scoreTeamRace({ participantCount: 4, rank: 2 })).toBe(3);
    expect(scoreTeamRace({ participantCount: 4, rank: 3 })).toBe(2);
    expect(scoreTeamRace({ participantCount: 4, rank: 4 })).toBe(1);
  });

  it('caps participant count at 6', () => {
    expect(scoreTeamRace({ participantCount: 8, rank: 1 })).toBe(6);
    expect(scoreTeamRace({ participantCount: 8, rank: 6 })).toBe(1);
    expect(scoreTeamRace({ participantCount: 6, rank: 1 })).toBe(6);
  });

  it('returns 0 for ranks beyond the capped field', () => {
    expect(scoreTeamRace({ participantCount: 6, rank: 7 })).toBe(0);
    expect(scoreTeamRace({ participantCount: 4, rank: 5 })).toBe(0);
  });
});

describe('scoreRankedRace', () => {
  it('scores two team members as 2,1', () => {
    expect(scoreRankedRace({ teamRanks: [4, 6] })).toEqual([2, 1]);
  });

  it('scores three team members as 3,2,1', () => {
    expect(scoreRankedRace({ teamRanks: [2, 4, 6] })).toEqual([3, 2, 1]);
  });

  it('scores a single team member as 1', () => {
    expect(scoreRankedRace({ teamRanks: [3] })).toEqual([1]);
  });

  it('keeps relative team rank for non-continuous game ranks', () => {
    expect(scoreRankedRace({ teamRanks: [5, 11] })).toEqual([2, 1]);
  });

  it('caps scoring at three team members', () => {
    expect(scoreRankedRace({ teamRanks: [1, 2, 3, 4] })).toEqual([3, 2, 1, 0]);
  });
});

describe('normalizeNickname', () => {
  it('trims surrounding spaces and lowercases', () => {
    expect(normalizeNickname(' 青山 ')).toBe('青山');
    expect(normalizeNickname('Hero')).toBe('hero');
  });

  it('strips zero-width and invisible characters', () => {
    expect(normalizeNickname('A​B')).toBe('ab');
    expect(normalizeNickname('﻿喵⁠酱')).toBe('喵酱');
  });

  it('strips the team prefix used by current roster names', () => {
    expect(normalizeNickname('ˣʸ༩·青山')).toBe('青山');
  });
});

describe('buildMemberMatcher', () => {
  const roster = [
    { id: '1', name: '青山' },
    { id: '2', name: '喵酱' },
  ];

  it('matches by current roster name', () => {
    const match = buildMemberMatcher(roster);
    expect(match('青山')).toBe('1');
    expect(match('  喵酱 ')).toBe('2');
  });

  it('matches by registered alias', () => {
    const match = buildMemberMatcher(roster, [{ memberId: '1', value: '旧昵称' }]);
    expect(match('旧昵称')).toBe('1');
  });

  it('returns null for unknown nicknames', () => {
    const match = buildMemberMatcher(roster);
    expect(match('陌生人')).toBeNull();
  });
});

describe('buildDuplicateSignature', () => {
  it('is order-independent for the same participants and ranks', () => {
    const left = buildDuplicateSignature({
      date: '2026-07-27',
      type: 'ranked',
      participants: [{ nickname: 'A', rank: 4 }, { nickname: 'B', rank: 6 }],
    });
    const right = buildDuplicateSignature({
      date: '2026-07-27',
      type: 'ranked',
      participants: [{ nickname: ' B ', rank: 6 }, { nickname: 'A', rank: 4 }],
    });
    expect(left).toBe(right);
  });

  it('differs when ranks differ', () => {
    const left = buildDuplicateSignature({
      date: '2026-07-27',
      type: 'ranked',
      participants: [{ nickname: 'A', rank: 4 }],
    });
    const right = buildDuplicateSignature({
      date: '2026-07-27',
      type: 'ranked',
      participants: [{ nickname: 'A', rank: 5 }],
    });
    expect(left).not.toBe(right);
  });
});

describe('assignMemberSlots', () => {
  it('writes each member to the first empty slot', () => {
    const result = assignMemberSlots({
      date: '2026-08-01',
      type: 'team',
      existingRows: [],
      rows: [{ members: [{ id: '1', score: 4 }] }],
    });
    expect(result[0].members[0].slot).toBe(0);
  });

  it('counts existing slots so the next game appends after them', () => {
    const result = assignMemberSlots({
      date: '2026-08-01',
      type: 'team',
      existingRows: [{ id: '1', teamRace: [4, 3], openRace: [] }],
      rows: [{ members: [{ id: '1', score: 2 }] }],
    });
    expect(result[0].members[0].slot).toBe(2);
  });

  it('never overwrites ambiguous zero slots in legacy rows', () => {
    const result = assignMemberSlots({
      type: 'team',
      existingRows: [{ id: '1', teamRace: [1, 0, 2], openRace: [] }],
      rows: [{ members: [{ id: '1', score: 3 }] }],
    });

    expect(result[0].members[0]).toMatchObject({ id: '1', skipped: 'member-limit' });
  });

  it('treats zero as an occupied slot when null marks empty slots', () => {
    const result = assignMemberSlots({
      type: 'team',
      existingRows: [{ id: '1', teamRace: [0, null, null], openRace: [] }],
      rows: [{ members: [{ id: '1', score: 2 }] }],
    });

    expect(result[0].members[0].slot).toBe(1);
  });

  it('skips members already at the 3-game limit but keeps others in the same race', () => {
    const result = assignMemberSlots({
      date: '2026-08-01',
      type: 'ranked',
      existingRows: [
        { id: '1', teamRace: [], openRace: [2, 1, 3] },
        { id: '2', teamRace: [], openRace: [1] },
      ],
      rows: [{ members: [{ id: '1', score: 2 }, { id: '2', score: 1 }] }],
    });
    expect(result[0].members[0]).toMatchObject({ id: '1', skipped: 'member-limit' });
    expect(result[0].members[1]).toMatchObject({ id: '2', slot: 1 });
  });

  it('independently tracks each member across multiple races in the batch', () => {
    const result = assignMemberSlots({
      date: '2026-08-01',
      type: 'team',
      existingRows: [],
      rows: [
        { members: [{ id: '1', score: 4 }, { id: '2', score: 3 }] },
        { members: [{ id: '1', score: 3 }, { id: '2', score: 2 }] },
        { members: [{ id: '1', score: 2 }, { id: '2', score: 1 }] },
        { members: [{ id: '1', score: 1 }] },
      ],
    });
    expect(result[0].members.map((m) => m.slot)).toEqual([0, 0]);
    expect(result[1].members.map((m) => m.slot)).toEqual([1, 1]);
    expect(result[2].members.map((m) => m.slot)).toEqual([2, 2]);
    expect(result[3].members[0]).toMatchObject({ id: '1', skipped: 'member-limit' });
  });
});
