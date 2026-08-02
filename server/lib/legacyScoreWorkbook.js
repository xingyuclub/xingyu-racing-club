import ExcelJS from 'exceljs';
import { createScoreMemberId } from '../../src/data/scoreRules.js';

const clone = (value) => structuredClone(value);

const LEGACY_RANGE_START = '2026-06-29';
const LEGACY_RANGE_END = '2026-08-02';
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const TARGET_SHEETS = new Map([
  ['S53-kw27', 0],
  ['S53-kw28', 1],
  ['S53-KW29', 2],
  ['S53-KW30', 3],
  ['S53-KW31', 4],
]);
const GAME_HEADERS = new Set(['第一局', '第二局', '第三局']);
const DETAIL_HEADERS = new Set(['队内赛', '开黑赛', '排位赛', '积分', '得分', '总分', ...GAME_HEADERS]);

function cellValue(cell) {
  const value = cell.result ?? cell.value;
  if (value && typeof value === 'object') {
    if ('result' in value) return value.result;
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
  }
  return value;
}

const cellText = (cell) => String(cellValue(cell) ?? '').trim();

function numericValue(cell, fallback) {
  const value = cellValue(cell);
  if (value === '' || value == null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function findDayLayout(sheet) {
  const matches = DAYS.map((day) => {
    for (let row = 1; row <= Math.min(sheet.rowCount, 12); row += 1) {
      for (let column = 1; column <= sheet.columnCount; column += 1) {
        if (cellText(sheet.getCell(row, column)) === day) return { row, column };
      }
    }
    return null;
  });
  if (matches.some((match) => match == null)) {
    const missing = DAYS.filter((_, index) => matches[index] == null).join('、');
    throw new Error(`未找到完整的周一至周日表头：缺少${missing}`);
  }
  const starts = matches.map((match) => match.column);
  return {
    row: Math.min(...matches.map((match) => match.row)),
    ranges: starts.map((start, index) => ({
      start,
      end: index < starts.length - 1 ? starts[index + 1] - 1 : sheet.columnCount,
    })),
  };
}

function findHeaderEnd(sheet, dayLayout) {
  let headerEnd = dayLayout.row;
  for (let row = dayLayout.row + 1; row <= Math.min(dayLayout.row + 3, sheet.rowCount); row += 1) {
    for (let column = dayLayout.ranges[0].start; column <= sheet.columnCount; column += 1) {
      if (DETAIL_HEADERS.has(cellText(sheet.getCell(row, column)))) {
        headerEnd = row;
        break;
      }
    }
  }
  return headerEnd;
}

function findNicknameColumn(sheet, dayLayout, dataStart) {
  for (let row = 1; row < dataStart; row += 1) {
    for (let column = 1; column < dayLayout.ranges[0].start; column += 1) {
      if (cellText(sheet.getCell(row, column)) === '昵称') return column;
    }
  }

  let best = null;
  for (let column = 1; column < dayLayout.ranges[0].start; column += 1) {
    const values = [];
    for (let row = dataStart; row <= sheet.rowCount; row += 1) {
      const value = cellText(sheet.getCell(row, column));
      if (value) values.push(value);
    }
    const textValues = values.filter((value) => !Number.isFinite(Number(value)));
    const score = new Set(textValues).size * 10 + textValues.length;
    if (!best || score > best.score) best = { column, score };
  }
  if (!best || best.score === 0) throw new Error('未找到昵称列');
  return best.column;
}

function findGameColumns(sheet, range, dayRow, headerEnd) {
  const columns = { teamRace: [], openRace: [] };
  let hasRaceTypes = false;

  for (let column = range.start; column <= range.end; column += 1) {
    const labels = [];
    for (let row = dayRow + 1; row <= headerEnd; row += 1) {
      labels.push(cellText(sheet.getCell(row, column)));
    }
    if (!labels.some((label) => GAME_HEADERS.has(label))) continue;
    if (labels.includes('队内赛')) {
      columns.teamRace.push(column);
      hasRaceTypes = true;
    } else if (labels.includes('开黑赛') || labels.includes('排位赛')) {
      columns.openRace.push(column);
      hasRaceTypes = true;
    } else {
      columns.teamRace.push(column);
    }
  }

  if (hasRaceTypes) {
    columns.teamRace = columns.teamRace.slice(0, 3);
    columns.openRace = columns.openRace.slice(0, 3);
  } else {
    columns.teamRace = columns.teamRace.slice(0, 3);
    columns.openRace = [];
  }
  return columns;
}

function findWeekendColumns(sheet, range, dayRow, headerEnd) {
  const fields = { points: null, score: null, total: null };
  for (let column = range.start; column <= range.end; column += 1) {
    for (let row = dayRow + 1; row <= headerEnd; row += 1) {
      const label = cellText(sheet.getCell(row, column));
      if (label === '积分') fields.points = column;
      if (label === '得分') fields.score = column;
      if (label === '总分') fields.total = column;
    }
  }
  return fields;
}

function readRace(row, columns) {
  const scores = columns.map((column) => numericValue(row.getCell(column), 0));
  while (scores.length < 3) scores.push(0);
  return scores.slice(0, 3);
}

function parseSheet(sheet, { scoreMembers, monday }) {
  const dayLayout = findDayLayout(sheet);
  const headerEnd = findHeaderEnd(sheet, dayLayout);
  const dataStart = headerEnd + 1;
  const nicknameColumn = findNicknameColumn(sheet, dayLayout, dataStart);
  const participants = [];

  for (let rowNumber = dataStart; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const nickname = cellText(sheet.getCell(rowNumber, nicknameColumn));
    if (!nickname) continue;
    const id = createScoreMemberId(nickname);
    scoreMembers.set(id, {
      id,
      name: nickname,
      basePoints: 0,
      wins: 0,
    });
    participants.push({ id, row: sheet.getRow(rowNumber) });
  }

  const dailyScores = dayLayout.ranges.slice(0, 5).map((range, dayIndex) => {
    const columns = findGameColumns(sheet, range, dayLayout.row, headerEnd);
    return {
      date: addDays(monday, dayIndex),
      rows: participants.map(({ id, row }) => ({
        id,
        teamRace: readRace(row, columns.teamRace),
        openRace: readRace(row, columns.openRace),
      })),
    };
  });

  const weekendScores = dayLayout.ranges.slice(5).map((range, index) => {
    const columns = findWeekendColumns(sheet, range, dayLayout.row, headerEnd);
    return {
      date: addDays(monday, index + 5),
      rows: participants.map(({ id, row }) => ({
        id,
        points: columns.points ? numericValue(row.getCell(columns.points), null) : null,
        score: columns.score ? numericValue(row.getCell(columns.score), null) : null,
        total: columns.total ? numericValue(row.getCell(columns.total), null) : null,
      })),
    };
  });

  return { dailyScores, weekendScores };
}

// 把历史预览数据合并入当前配置。
// 严格覆盖 2026-06-29 至 2026-08-02 范围内的 dailyScores，范围外保留。
// weekendScores 使用相同范围覆盖规则，范围外记录保留。
export function mergeLegacyScoreImport(config, preview) {
  const next = clone(config);

  const kept = next.dailyScores.filter(
    (round) => round.date < LEGACY_RANGE_START || round.date > LEGACY_RANGE_END,
  );
  const imported = preview.dailyScores.filter(
    (round) => round.date >= LEGACY_RANGE_START && round.date <= LEGACY_RANGE_END,
  );

  next.dailyScores = [...kept, ...imported].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  const keptWeekend = (next.weekendScores || []).filter(
    (round) => round.date < LEGACY_RANGE_START || round.date > LEGACY_RANGE_END,
  );
  const importedWeekend = (preview.weekendScores || []).filter(
    (round) => round.date >= LEGACY_RANGE_START && round.date <= LEGACY_RANGE_END,
  );
  next.weekendScores = [...keptWeekend, ...clone(importedWeekend)].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  const referencedIds = new Set(
    [...next.dailyScores, ...next.weekendScores].flatMap((round) =>
      round.rows.map((row) => row.id)),
  );
  const previewMembers = clone(preview.scoreMembers || []);
  const previewIds = new Set(previewMembers.map((member) => member.id));
  const keptMembers = (next.scoreMembers || []).filter(
    (member) => referencedIds.has(member.id) && !previewIds.has(member.id),
  );
  next.scoreMembers = [...previewMembers, ...keptMembers];

  return next;
}

export async function parseLegacyScoreWorkbook(buffer, {
  kw27Monday = LEGACY_RANGE_START,
} = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const scoreMembers = new Map();
  const preview = {
    dailyScores: [],
    weekendScores: [],
    scoreMembers: [],
    parsedSheets: [],
    ignoredSheets: [],
    errors: [],
  };

  const targetSheets = workbook.worksheets
    .filter((sheet) => TARGET_SHEETS.has(sheet.name))
    .sort((left, right) => TARGET_SHEETS.get(left.name) - TARGET_SHEETS.get(right.name));
  preview.ignoredSheets = workbook.worksheets
    .filter((sheet) => !TARGET_SHEETS.has(sheet.name))
    .map((sheet) => sheet.name);

  for (const sheet of targetSheets) {
    const weekOffset = TARGET_SHEETS.get(sheet.name);
    try {
      const parsed = parseSheet(sheet, {
        scoreMembers,
        monday: addDays(kw27Monday, weekOffset * 7),
      });
      preview.dailyScores.push(...parsed.dailyScores);
      preview.weekendScores.push(...parsed.weekendScores);
      preview.parsedSheets.push(sheet.name);
    } catch (error) {
      preview.errors.push({ sheet: sheet.name, message: error.message });
    }
  }

  preview.dailyScores.sort((left, right) => left.date.localeCompare(right.date));
  preview.weekendScores.sort((left, right) => left.date.localeCompare(right.date));
  preview.scoreMembers = [...scoreMembers.values()];
  return preview;
}
