import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  BASE_HEADERS,
  BASE_SHEET_NAME,
  SCORE_HEADERS,
  SCORE_SHEET_NAME,
  WEEKEND_HEADERS,
  WEEKEND_SHEET_NAME,
  createScoreWorkbookBuffer,
  mergeScoreImport,
  parseScoreWorkbookBuffer,
} from './scoreWorkbook.js';

const replacementRow = {
  id: 'member-01',
  teamRace: [6, 0, 0],
  openRace: [0, 0, 0],
};

const createConfig = () => ({
  roster: [
    { id: 'backend-01', number: '01', name: '后台成员 01', basePoints: 99 },
  ],
  scoreMembers: [
    { id: 'member-01', name: 'Excel成员 01', basePoints: 10, wins: 0 },
    { id: 'member-02', name: 'Excel成员 02', basePoints: 20, wins: 0 },
  ],
  weekendScores: [
    { date: '2026-08-02', rows: [{ id: 'member-01', points: 100, score: 12, total: 100 }] },
  ],
  dailyScores: [
    {
      date: '2026-07-28',
      rows: [{
        id: 'member-01',
        teamRace: [1, null, 3],
        openRace: [0, 0, 0],
        score: 99,
        total: 199,
      }],
    },
    {
      date: '2026-07-29',
      rows: [{ id: 'member-02', teamRace: [2, 2, 2], openRace: [1, 1, 1] }],
    },
  ],
});

const loadWorkbook = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
};

describe('score workbook', () => {
  it('exports fixed sheets, headers, formulas and round-trippable raw scores', async () => {
    const config = createConfig();
    const buffer = await createScoreWorkbookBuffer(config);
    const workbook = await loadWorkbook(buffer);
    const scoreSheet = workbook.getWorksheet(SCORE_SHEET_NAME);
    const baseSheet = workbook.getWorksheet(BASE_SHEET_NAME);

    expect(scoreSheet.getRow(3).values.slice(1)).toEqual(SCORE_HEADERS);
    expect(baseSheet.getRow(3).values.slice(1)).toEqual(BASE_HEADERS);
    expect(scoreSheet.getCell('A4').value).toBeInstanceOf(Date);
    expect(scoreSheet.getCell('J4').value.formula).toContain('SUM(D4:I4)');
    expect(scoreSheet.getCell('K4').value.formula).toContain('WEEKDAY(A4,2)');
    expect(scoreSheet.getCell('J5').value.formula).toContain('SUM(D5:I5)');
    expect(scoreSheet.getCell('K5').value.formula).toContain('WEEKDAY(A5,2)');
    expect(scoreSheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 3 });

    expect(scoreSheet.getCell('B4').value).toBeNull();
    expect(scoreSheet.getCell('C4').value).toBe('Excel成员 01');
    expect(baseSheet.getCell('A4').value).toBeNull();
    expect(baseSheet.getCell('B4').value).toBe('Excel成员 01');

    const imported = await parseScoreWorkbookBuffer(buffer, config.scoreMembers);

    expect(imported.dailyScores).toEqual(config.dailyScores);
    expect(imported.basePointsById).toEqual(new Map([
      ['member-01', 10],
      ['member-02', 20],
    ]));
  });

  it('drops exported raw fields when a race score is edited', async () => {
    const config = createConfig();
    const workbook = await loadWorkbook(await createScoreWorkbookBuffer(config));
    workbook.getWorksheet(SCORE_SHEET_NAME).getCell('D4').value = 6;

    const imported = await parseScoreWorkbookBuffer(
      await workbook.xlsx.writeBuffer(),
      config.scoreMembers,
    );

    expect(imported.dailyScores[0].rows[0].teamRace[0]).toBe(6);
    expect(imported.dailyScores[0].rows[0]).not.toHaveProperty('score');
    expect(imported.dailyScores[0].rows[0]).not.toHaveProperty('total');
  });

  it('creates one blank-date editable row per member in a template', async () => {
    const config = createConfig();
    const buffer = await createScoreWorkbookBuffer(config, { template: true });
    const workbook = await loadWorkbook(buffer);
    const scoreSheet = workbook.getWorksheet(SCORE_SHEET_NAME);

    expect(scoreSheet.rowCount).toBe(5);
    expect(scoreSheet.getCell('A4').value).toBeNull();
    expect(scoreSheet.getCell('B4').value).toBeNull();
    expect(scoreSheet.getCell('C4').value).toBe('Excel成员 01');
    expect(scoreSheet.getCell('D4').value).toBe(0);
  });

  it('replaces only dates and opening balances present in the import', () => {
    const config = createConfig();
    const next = mergeScoreImport(config, {
      weekendScores: [
    { date: '2026-08-02', rows: [{ id: 'member-01', points: 100, score: 12, total: 100 }] },
  ],
  dailyScores: [{ date: '2026-07-29', rows: [replacementRow] }],
      basePointsById: new Map([['member-01', 25]]),
    });

    expect(next).not.toBe(config);
    expect(next.dailyScores[0]).toEqual(config.dailyScores[0]);
    expect(next.dailyScores[1]).toEqual({ date: '2026-07-29', rows: [replacementRow] });
    expect(next.scoreMembers[0].basePoints).toBe(25);
    expect(next.scoreMembers[1].basePoints).toBe(20);
    expect(next.roster[0].basePoints).toBe(99);
  });

  it('reports duplicate detail rows with sheet, row and field', async () => {
    const config = createConfig();
    const workbook = await loadWorkbook(await createScoreWorkbookBuffer(config));
    const scoreSheet = workbook.getWorksheet(SCORE_SHEET_NAME);
    scoreSheet.insertRow(5, scoreSheet.getRow(4).values.slice(1));
    const buffer = await workbook.xlsx.writeBuffer();

    await expect(parseScoreWorkbookBuffer(buffer, config.scoreMembers)).rejects.toMatchObject({
      code: 'INVALID_SCORE_WORKBOOK',
      details: expect.arrayContaining([
        expect.objectContaining({ sheet: SCORE_SHEET_NAME, row: 5, field: '队员编号' }),
      ]),
    });
  });

  it('rejects unknown members, invalid dates and negative race scores together', async () => {
    const config = createConfig();
    const workbook = await loadWorkbook(await createScoreWorkbookBuffer(config));
    const scoreSheet = workbook.getWorksheet(SCORE_SHEET_NAME);
    scoreSheet.getCell('A4').value = '2026-02-30';
    scoreSheet.getCell('B4').value = '99';
    scoreSheet.getCell('D4').value = -1;
    const buffer = await workbook.xlsx.writeBuffer();

    await expect(parseScoreWorkbookBuffer(buffer, config.scoreMembers)).rejects.toMatchObject({
      code: 'INVALID_SCORE_WORKBOOK',
      details: expect.arrayContaining([
        expect.objectContaining({ row: 4, field: '日期' }),
        expect.objectContaining({ row: 4, field: '队员编号' }),
        expect.objectContaining({ row: 4, field: '队内赛1' }),
      ]),
    });
  });
  it('exports the weekend manual score sheet with the raw team-race fields', async () => {
    const config = createConfig();
    const buffer = await createScoreWorkbookBuffer(config);
    const workbook = await loadWorkbook(buffer);
    const weekendSheet = workbook.getWorksheet(WEEKEND_SHEET_NAME);

    expect(weekendSheet).toBeDefined();
    expect(weekendSheet.getRow(3).values.slice(1)).toEqual(WEEKEND_HEADERS);
    expect(weekendSheet.getCell('A4').value).toBeInstanceOf(Date);
    expect(weekendSheet.getCell('D4').value).toBeNull();
    expect(weekendSheet.getCell('E4').value).toBe(100);
    expect(weekendSheet.getCell('F4').value).toBe(12);
    expect(weekendSheet.getCell('G4').value).toBe(100);
    expect(weekendSheet.getCell('B4').value).toBeNull();
    expect(weekendSheet.getCell('C4').value).toBe('Excel成员 01');
  });

  it('exports projected weekend formulas instead of stale stored score and total', async () => {
    const config = createConfig();
    config.dailyScores = [{
      date: '2026-07-31',
      rows: [{ id: 'member-01', teamRace: [5, 0, 0], openRace: [0, 0, 0] }],
    }];
    config.weekendScores = [
      { date: '2026-08-01', rows: [{ id: 'member-01', previousPoints: 0, points: 10, score: 999, total: 999 }] },
      { date: '2026-08-02', rows: [{ id: 'member-01', points: 15, score: 999, total: 999 }] },
    ];

    const workbook = await loadWorkbook(await createScoreWorkbookBuffer(config));
    const weekendSheet = workbook.getWorksheet(WEEKEND_SHEET_NAME);

    expect(weekendSheet.getCell('F4').value).toBe(10);
    expect(weekendSheet.getCell('G4').value).toBe(15);
    expect(weekendSheet.getCell('D5').value).toBeNull();
    expect(weekendSheet.getCell('F5').value).toBe(5);
    expect(weekendSheet.getCell('G5').value).toBe(20);
  });
});
