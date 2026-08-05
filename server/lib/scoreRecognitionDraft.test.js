// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildRecognitionDraft } from './scoreRecognitionDraft.js';

const config = {
  roster: [
    { id: 'roster-1', name: '十二' },
    { id: 'roster-2', name: '黑岩' },
  ],
  memberAliases: [{ memberId: 'roster-2', value: '旧名' }],
  scoreMembers: [{ id: 'score-twelve', name: 'ˣʸ༩·十二' }],
  dailyScores: [],
};

function buildDraft({ raceType = 'team', matches, reviews, config: nextConfig = config }) {
  return buildRecognitionDraft({
    batch: { id: 'b1', date: '2026-08-03', raceType },
    observations: [{ imageIndex: 0, matches }],
    reviews,
    config: nextConfig,
  });
}

describe('buildRecognitionDraft', () => {
  it('scores team races, counts ignored road users, and summarizes assigned evidence', () => {
    const draft = buildDraft({
      matches: [
        { participants: [{ nickname: '十二', rank: 1 }, { nickname: '路人', rank: 2 }] },
        { participants: [{ nickname: '十二', rank: 2 }, { nickname: '黑岩', rank: 1 }] },
      ],
      reviews: { 'i0-m0-p1': { ignored: true } },
    });

    expect(draft).toMatchObject({
      batchId: 'b1',
      batchDate: '2026-08-03',
      raceType: 'team',
      canCommit: true,
    });
    expect(draft.summary).toEqual([
      expect.objectContaining({
        id: 'score-twelve',
        name: '十二',
        score: 3,
        evidenceIds: ['i0-m0-p0', 'i0-m1-p0'],
      }),
      expect.objectContaining({
        id: 'score:%E9%BB%91%E5%B2%A9',
        name: '黑岩',
        score: 2,
        evidenceIds: ['i0-m1-p1'],
      }),
    ]);
    expect(draft.evidence.find((item) => item.id === 'i0-m0-p0')).toMatchObject({
      imageIndex: 0,
      matchIndex: 0,
      participantIndex: 0,
      memberId: 'roster-1',
      scoreMemberId: 'score-twelve',
      rank: 1,
      score: 2,
      slot: 0,
    });
    expect(draft.evidence.find((item) => item.id === 'i0-m0-p1')).toMatchObject({
      ignored: true,
      rank: 2,
    });
    expect(draft.issues).toEqual([]);
  });

  it('scores ranked races by matched member order only', () => {
    const draft = buildDraft({
      raceType: 'ranked',
      matches: [{ participants: [
        { nickname: '十二', rank: 4 },
        { nickname: '路人', rank: 5 },
        { nickname: '黑岩', rank: 7 },
      ] }],
      reviews: { 'i0-m0-p1': { ignored: true } },
    });

    expect(draft.summary.map((item) => [item.name, item.score]))
      .toEqual([['十二', 2], ['黑岩', 1]]);
  });

  it('uses manual member mapping and rank overrides', () => {
    const draft = buildDraft({
      matches: [{ participants: [
        { nickname: '十二', rank: 2 },
        { nickname: '陌生名', rank: 1 },
      ] }],
      reviews: {
        'i0-m0-p0': { rank: 1 },
        'i0-m0-p1': { rank: 2, memberId: 'roster-2' },
      },
    });

    expect(draft.canCommit).toBe(true);
    expect(draft.summary.map((item) => [item.name, item.score]))
      .toEqual([['十二', 2], ['黑岩', 1]]);
    expect(draft.evidence.find((item) => item.id === 'i0-m0-p1')).toMatchObject({
      nickname: '陌生名',
      memberId: 'roster-2',
      scoreMemberId: 'score:%E9%BB%91%E5%B2%A9',
      rank: 2,
    });
  });

  it('reports unmatched evidence until it is ignored', () => {
    const matches = [{ participants: [
      { nickname: '十二', rank: 1 },
      { nickname: '路人', rank: 2 },
    ] }];
    const unmatched = buildDraft({ matches });

    expect(unmatched.issues).toContainEqual({
      evidenceId: 'i0-m0-p1',
      code: 'unmatched',
    });
    expect(unmatched.canCommit).toBe(false);

    const ignored = buildDraft({
      matches,
      reviews: { 'i0-m0-p1': { ignored: true } },
    });
    expect(ignored.issues).toEqual([]);
    expect(ignored.canCommit).toBe(true);
  });

  it('reports every participant sharing a duplicate rank', () => {
    const draft = buildDraft({
      matches: [{ participants: [
        { nickname: '十二', rank: 1 },
        { nickname: '黑岩', rank: 1 },
      ] }],
    });

    expect(draft.issues).toEqual([
      { evidenceId: 'i0-m0-p0', code: 'duplicate-rank' },
      { evidenceId: 'i0-m0-p1', code: 'duplicate-rank' },
    ]);
    expect(draft.canCommit).toBe(false);
  });

  it('reports an invalid manual rank', () => {
    const draft = buildDraft({
      matches: [{ participants: [{ nickname: '十二', rank: 1 }] }],
      reviews: { 'i0-m0-p0': { rank: 0 } },
    });

    expect(draft.issues).toEqual([
      { evidenceId: 'i0-m0-p0', code: 'invalid-rank' },
    ]);
    expect(draft.canCommit).toBe(false);
  });

  it('allows invalid evidence to be explicitly ignored', () => {
    const draft = buildDraft({
      matches: [{ participants: [{ nickname: '路人', rank: 0 }] }],
      reviews: { 'i0-m0-p0': { ignored: true } },
    });

    expect(draft.issues).toEqual([]);
    expect(draft.canCommit).toBe(true);
  });

  it('marks duplicate races without consuming slots', () => {
    const draft = buildDraft({
      matches: [
        { participants: [{ nickname: '十二', rank: 1 }] },
        { participants: [{ nickname: '十二', rank: 1 }] },
        { participants: [{ nickname: '十二', rank: 2 }, { nickname: '黑岩', rank: 1 }] },
      ],
    });
    const twelve = draft.evidence.filter((item) => item.memberId === 'roster-1');

    expect(twelve.map((item) => [item.duplicate, item.slot]))
      .toEqual([[false, 0], [true, undefined], [false, 1]]);
    expect(draft.summary.find((item) => item.name === '十二')).toMatchObject({
      score: 2,
      evidenceIds: ['i0-m0-p0', 'i0-m2-p0'],
    });
    expect(draft.summary.map((item) => item.name)).toEqual(['黑岩', '十二']);
  });

  it('warns and skips a member already at the daily three-race limit', () => {
    const draft = buildDraft({
      matches: [{ participants: [{ nickname: '十二', rank: 1 }] }],
      config: {
        ...config,
        dailyScores: [{
          date: '2026-08-03',
          rows: [{ id: 'score-twelve', teamRace: [1, 2, 3], openRace: [] }],
        }],
      },
    });

    expect(draft.evidence[0]).toMatchObject({ warning: 'member-limit' });
    expect(draft.evidence[0]).not.toHaveProperty('slot');
    expect(draft.summary).toEqual([]);
    expect(draft.issues).toEqual([]);
    expect(draft.canCommit).toBe(true);
  });

  it('matches aliases automatically while keeping roster and score identities separate', () => {
    const draft = buildDraft({
      matches: [{ participants: [{ nickname: '旧名', rank: 1 }] }],
    });

    expect(draft.evidence[0]).toMatchObject({
      memberId: 'roster-2',
      scoreMemberId: 'score:%E9%BB%91%E5%B2%A9',
    });
  });

  it('skips duplicate races across images without blocking commit', () => {
    const draft = buildRecognitionDraft({
      batch: { id: 'b1', date: '2026-08-03', raceType: 'team' },
      observations: [
        { imageIndex: 0, matches: [{ participants: [
          { nickname: '十二', rank: 1 },
          { nickname: '黑岩', rank: 2 },
        ] }] },
        { imageIndex: 1, matches: [{ participants: [
          { nickname: '十二', rank: 1 },
          { nickname: '黑岩', rank: 2 },
        ] }] },
      ],
      reviews: {},
      config,
    });

    expect(draft.duplicateCount).toBe(1);
    expect(draft.issues).toEqual([]);
    expect(draft.canCommit).toBe(true);
    expect(draft.summary.map((member) => member.name).sort()).toEqual(['十二', '黑岩']);
    expect(draft.evidence.find((item) => item.id === 'i1-m0-p0')).toMatchObject({ duplicate: true });
  });

  it('does not surface extra issues from a duplicate race', () => {
    const draft = buildRecognitionDraft({
      batch: { id: 'b1', date: '2026-08-03', raceType: 'team' },
      observations: [
        { imageIndex: 0, matches: [{ participants: [
          { nickname: '十二', rank: 1 },
          { nickname: '路人', rank: 2 },
        ] }] },
        { imageIndex: 1, matches: [{ participants: [
          { nickname: '十二', rank: 1 },
          { nickname: '路人', rank: 2 },
        ] }] },
      ],
      reviews: {},
      config,
    });

    expect(draft.duplicateCount).toBe(1);
    expect(draft.issues).toEqual([{ evidenceId: 'i0-m0-p1', code: 'unmatched' }]);
    expect(draft.evidence.find((item) => item.id === 'i1-m0-p1')).toMatchObject({ duplicate: true });
    expect(draft.evidence.filter((item) => item.id.startsWith('i1-') && item.duplicate)).toHaveLength(2);
  });

  it('matches OCR symbol noise by a unique Han nickname and scores one point', () => {
    const draft = buildDraft({
      matches: [{ participants: [{ nickname: 'xγ_黑岩99', rank: 1 }] }],
      config: {
        roster: [{ id: 'roster-black', name: 'ˣʸ༩·黑岩' }],
        memberAliases: [],
        scoreMembers: [{ id: 's1', name: '黑岩' }],
        dailyScores: [],
      },
    });

    expect(draft).toMatchObject({ issues: [], canCommit: true });
    expect(draft.summary).toEqual([
      expect.objectContaining({ id: 's1', name: 'ˣʸ༩·黑岩', score: 1 }),
    ]);
  });

  it('counts a dropped middle row via the highest visible rank in team races', () => {
    const draft = buildDraft({
      matches: [{ participants: [
        { nickname: '十二', rank: 1 },
        { nickname: '路人甲', rank: 2 },
        { nickname: '黑岩', rank: 3 },
      ] }],
      reviews: { 'i0-m0-p1': { ignored: true } },
    });

    // 最高名次为 3，即使第 2 名被标记为非车队成员也计入参赛人数
    expect(draft.evidence.find((item) => item.id === 'i0-m0-p0')).toMatchObject({
      memberId: 'roster-1',
      score: 3,
    });
    expect(draft.evidence.find((item) => item.id === 'i0-m0-p2')).toMatchObject({
      memberId: 'roster-2',
      score: 1,
    });
    expect(draft.summary.find((item) => item.name === '十二').score).toBe(3);
    expect(draft.summary.find((item) => item.name === '黑岩').score).toBe(1);
  });

  it('scores by the highest rank when the model drops an unreadable row', () => {
    const draft = buildDraft({
      matches: [{ participants: [
        { nickname: '十二', rank: 1 },
        { nickname: '黑岩', rank: 3 },
        { nickname: '路人', rank: 5 },
        { nickname: '初心', rank: 6 },
      ] }],
      reviews: { 'i0-m0-p2': { ignored: true } },
    });

    const twelve = draft.evidence.find((item) => item.id === 'i0-m0-p0');
    const rock = draft.evidence.find((item) => item.id === 'i0-m0-p1');
    expect(twelve.score).toBe(6);
    expect(rock.score).toBe(4);
    expect(draft.canCommit).toBe(false);
    expect(draft.raceWarnings).toContainEqual({
      imageIndex: 0,
      matchIndex: 0,
      missingRanks: [2, 4],
      maxRank: 6,
    });
  });

  it('does not warn about races with contiguous ranks', () => {
    const draft = buildDraft({
      matches: [{ participants: [
        { nickname: '十二', rank: 1 },
        { nickname: '黑岩', rank: 2 },
      ] }],
    });

    expect(draft.raceWarnings).toEqual([]);
  });

});