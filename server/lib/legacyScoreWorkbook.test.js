// @vitest-environment node

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { createScoreMemberId } from '../../src/data/scoreRules.js';
import { mergeLegacyScoreImport, parseLegacyScoreWorkbook } from './legacyScoreWorkbook.js';

const roster = [
  { id: '1', name: '青山', number: '01', basePoints: 0, wins: 0 },
  { id: '2', name: '喵酱', number: '02', basePoints: 0, wins: 0 },
];

const baseConfig = {
  team: { name: '星屿', label: '星屿车队', motto: '竞速无界', heroMedia: { src: '', type: 'image' }, heroFallbackImage: '', heroLines: ['星屿'] },
  stats: [{ label: '车队排名', value: '1st' }, { label: '活跃排名', value: '3rd' }, { label: '队员数量', value: '2' }, { label: '单身贵族', value: { male: 1, female: 1 } }],
  roster,
  scoreMembers: roster.map(({ id, name, basePoints, wins }) => ({ id, name, basePoints, wins })),
  albums: [],
  dailyScores: [],
  weekendScores: [],
  memberAliases: [],
  news: [],
  music: { src: '', cover: '' },
};

const setCells = (sheet, row, startColumn, values) => {
  values.forEach((value, index) => {
    sheet.getCell(row, startColumn + index).value = value;
  });
};

function addKw27Sheet(workbook) {
  const sheet = workbook.addWorksheet('S53-kw27');
  sheet.getCell('B3').value = '昵称';
  sheet.mergeCells('B3:B5');

  const days = [
    ['周一', 7, 10],
    ['周二', 11, 14],
    ['周三', 15, 18],
    ['周四', 19, 22],
    ['周五', 23, 26],
    ['周六', 27, 28],
    ['周日', 29, 31],
  ];
  days.forEach(([label, start, end]) => {
    sheet.getCell(4, start).value = label;
    sheet.mergeCells(4, start, 4, end);
  });
  for (const start of [7, 11, 15, 19, 23]) {
    setCells(sheet, 5, start, ['第一局', '第二局', '第三局', '总分']);
  }
  setCells(sheet, 5, 27, ['积分', '总分', '积分', '得分', '总分']);

  sheet.getCell('B6').value = '青山';
  setCells(sheet, 6, 7, [0, 0, 0]);
  setCells(sheet, 6, 11, [1, 2, 3]);
  setCells(sheet, 6, 27, [48, 87, 97, 49, 136]);

  sheet.getCell('B7').value = '旧队员';
  setCells(sheet, 7, 7, [0, 0, 0]);
  setCells(sheet, 7, 27, [0, 0, 0, 0, 0]);
}

function addKw31Sheet(workbook) {
  const sheet = workbook.addWorksheet('S53-KW31');
  // KW28 的真实旧表存在空的昵称合并表头，用数据列匹配作为受限回退。
  sheet.mergeCells('D4:D6');

  const starts = [8, 16, 24, 32, 40, 48, 52];
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const ends = [15, 23, 31, 39, 47, 51, 54];
  days.forEach((label, index) => {
    sheet.getCell(4, starts[index]).value = label;
    sheet.mergeCells(4, starts[index], 4, ends[index]);
  });
  for (const start of starts.slice(0, 5)) {
    sheet.getCell(5, start).value = '队内赛';
    sheet.mergeCells(5, start, 5, start + 2);
    sheet.getCell(5, start + 3).value = '开黑赛';
    sheet.mergeCells(5, start + 3, 5, start + 5);
    setCells(sheet, 6, start, ['第一局', '第二局', '第三局', '第一局', '第二局', '第三局']);
  }
  setCells(sheet, 6, 48, ['上周', '积分', '得分', '总分']);
  setCells(sheet, 6, 52, ['积分', '得分', '总分']);

  sheet.getCell('D7').value = 'ˣʸ༩·青山';
  setCells(sheet, 7, 8, [5, 4, 3, 2, 1, 0]);
  setCells(sheet, 7, 48, [100, 120, 20, 140, 150, 10, 150]);
}

async function createLegacyWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  addKw27Sheet(workbook);
  addKw31Sheet(workbook);
  workbook.addWorksheet('S52');
  workbook.addWorksheet('S53-KW30').getCell('A1').value = '缺少表头';
  return workbook.xlsx.writeBuffer();
}

describe('parseLegacyScoreWorkbook', () => {
  it('parses Excel identities independently from roster and keeps the latest display name', async () => {
    const preview = await parseLegacyScoreWorkbook(await createLegacyWorkbookBuffer(), {
      roster: [{ id: 'backend-id', name: '青山' }],
      kw27Monday: '2026-06-29',
    });
    const scoreId = createScoreMemberId('青山');

    expect(preview.errors.filter((error) => error.sheet !== 'S53-KW30')).toEqual([]);
    expect(preview.dailyScores).toHaveLength(10);
    expect(preview.weekendScores).toHaveLength(4);
    expect(preview.scoreMembers).toContainEqual({
      id: scoreId,
      name: 'ˣʸ༩·青山',
      basePoints: 0,
      wins: 0,
    });
    expect(preview.scoreMembers.filter((member) => member.id === scoreId)).toHaveLength(1);
    expect(preview.dailyScores.flatMap((round) => round.rows)
      .every((row) => row.id !== 'backend-id')).toBe(true);
    expect(preview.dailyScores.find((round) => round.date === '2026-06-30').rows[0]).toEqual({
      id: scoreId,
      teamRace: [1, 2, 3],
      openRace: [0, 0, 0],
    });
    expect(preview.dailyScores.find((round) => round.date === '2026-07-27').rows[0]).toEqual({
      id: scoreId,
      teamRace: [5, 4, 3],
      openRace: [2, 1, 0],
    });
    expect(preview.weekendScores.find((round) => round.date === '2026-07-04').rows[0]).toEqual({
      id: scoreId,
      points: 48,
      score: null,
      total: 87,
    });
  });

  it('keeps zero-score Excel members and reports ignored or malformed sheets', async () => {
    const preview = await parseLegacyScoreWorkbook(await createLegacyWorkbookBuffer(), {
      roster: [{ id: '1', name: 'ˣʸ༩·青山' }],
      aliases: [],
      kw27Monday: '2026-06-29',
    });

    const historical = preview.scoreMembers.find((member) => member.name === '旧队员');
    expect(historical.id).toBe(createScoreMemberId('旧队员'));
    expect(preview.dailyScores.find((round) => round.date === '2026-06-29').rows[1]).toEqual({
      id: historical.id,
      teamRace: [0, 0, 0],
      openRace: [0, 0, 0],
    });
    expect(preview.ignoredSheets).toContain('S52');
    expect(preview.errors).toEqual([
      expect.objectContaining({ sheet: 'S53-KW30' }),
    ]);
  });
});

describe('mergeLegacyScoreImport', () => {
  it('replaces records within the KW27-KW31 range and preserves records outside', () => {
    const rosterSnapshot = structuredClone(baseConfig.roster);
    const config = {
      ...baseConfig,
      scoreMembers: [
        { id: 'outside', name: '范围外人物', basePoints: 5, wins: 0 },
        { id: 'old-range', name: '旧范围人物', basePoints: 0, wins: 0 },
      ],
      dailyScores: [
        { date: '2026-06-28', rows: [{ id: 'outside', teamRace: [5, 0, 0], openRace: [0, 0, 0] }] },
        { date: '2026-07-01', rows: [{ id: 'old-range', teamRace: [1, 0, 0], openRace: [0, 0, 0] }] },
        { date: '2026-08-05', rows: [{ id: 'outside', teamRace: [2, 0, 0], openRace: [0, 0, 0] }] },
      ],
      weekendScores: [
        { date: '2026-08-08', rows: [{ id: 'outside', points: 7, score: 2, total: 7 }] },
      ],
    };

    const preview = {
      scoreMembers: [
        { id: 'excel', name: 'Excel人物', basePoints: 0, wins: 0 },
      ],
      dailyScores: [
        { date: '2026-06-29', rows: [{ id: 'excel', teamRace: [3, 0, 0], openRace: [0, 0, 0] }] },
        { date: '2026-07-01', rows: [{ id: 'excel', teamRace: [6, 0, 0], openRace: [0, 0, 0] }] },
      ],
      weekendScores: [],
    };

    const merged = mergeLegacyScoreImport(config, preview);

    // 2026-06-28 kept (outside range), 2026-08-05 kept (outside range)
    expect(merged.dailyScores.find((r) => r.date === '2026-06-28')).toBeTruthy();
    expect(merged.dailyScores.find((r) => r.date === '2026-08-05')).toBeTruthy();
    // 2026-07-01 overwritten by preview
    const jul1 = merged.dailyScores.find((r) => r.date === '2026-07-01');
    expect(jul1.rows[0].teamRace[0]).toBe(6);
    // 2026-06-29 added from preview
    expect(merged.dailyScores.find((r) => r.date === '2026-06-29')).toBeTruthy();
    expect(merged.weekendScores).toEqual(config.weekendScores);
    expect(merged.scoreMembers).toEqual([
      preview.scoreMembers[0],
      config.scoreMembers[0],
    ]);
    expect(merged.roster).toEqual(rosterSnapshot);
  });

  it('preserves weekend scores from the preview verbatim', () => {
    const preview = {
      scoreMembers: [{ id: '1', name: '青山', basePoints: 0, wins: 0 }],
      dailyScores: [],
      weekendScores: [
        { date: '2026-07-05', rows: [{ id: '1', points: 100, score: 12, total: 100 }] },
      ],
    };

    const merged = mergeLegacyScoreImport(baseConfig, preview);

    expect(merged.weekendScores).toEqual(preview.weekendScores);
  });

  it('sorts all dates chronologically after merging', () => {
    const preview = {
      scoreMembers: [],
      dailyScores: [
        { date: '2026-07-15', rows: [] },
        { date: '2026-07-01', rows: [] },
      ],
      weekendScores: [],
    };

    const merged = mergeLegacyScoreImport(baseConfig, preview);
    const dates = merged.dailyScores.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
  });
});
