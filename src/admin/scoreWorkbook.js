import { normalizeNickname } from '../data/scoreRules.js';

export const SCORE_SHEET_NAME = '积分明细';
export const BASE_SHEET_NAME = '队员期初积分';
export const SCORE_HEADERS = [
  '日期',
  '队员编号',
  '队员昵称',
  '队内赛1',
  '队内赛2',
  '队内赛3',
  '开黑赛1',
  '开黑赛2',
  '开黑赛3',
  '得分',
  '总分',
];
export const BASE_HEADERS = ['队员编号', '队员昵称', '期初积分'];
export const WEEKEND_SHEET_NAME = '周末手动积分';
export const WEEKEND_HEADERS = ['周末日期', '队员编号', '队员昵称', '上周积分', '积分', '得分', '总分'];

const HEADER_ROW = 3;
const DATA_ROW = 4;
const MAX_SCORE_ROW = 2003;
const RAW_SCORE_SHEET_NAME = '_原始积分字段';
const workbookMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const clone = (value) => structuredClone(value);
const loadExcel = async () => {
  const module = await import('exceljs');
  return module.default || module;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateFromKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const isValidDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatDateKey(dateFromKey(value)) === value;
};

const cellValue = (cell) => {
  const value = cell.value;
  if (value && typeof value === 'object' && 'result' in value) return value.result;
  return value;
};

const cellText = (cell) => String(cellValue(cell) ?? '').trim();

const parseDateCell = (cell) => {
  const value = cellValue(cell);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateKey(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const utcDate = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return utcDate.toISOString().slice(0, 10);
  }
  return String(value ?? '').trim();
};

const parseScore = (cell) => {
  const value = cellValue(cell);
  if (value === null || value === undefined || String(value).trim() === '') return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const parseRaceScore = (cell) => {
  const value = cellValue(cell);
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
};

const applySheetHeader = (sheet, title, note, columnCount) => {
  sheet.mergeCells(1, 1, 1, columnCount);
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172554' } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(2, 1, 2, columnCount);
  sheet.getCell('A2').value = note;
  sheet.getCell('A2').font = { color: { argb: 'FF475569' }, size: 10 };
  sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(2).height = 24;
  sheet.views = [{ state: 'frozen', ySplit: 3, xSplit: Math.min(3, columnCount) }];
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columnCount } };
};

const styleHeaderRow = (sheet, headers) => {
  const row = sheet.getRow(HEADER_ROW);
  row.values = headers;
  row.height = 25;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF93C5FD' } },
      left: { style: 'thin', color: { argb: 'FF93C5FD' } },
      bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
      right: { style: 'thin', color: { argb: 'FF93C5FD' } },
    };
  });
};

const styleDataRow = (row, editableColumns) => {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell, column) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD6DEE8' } },
      left: { style: 'thin', color: { argb: 'FFD6DEE8' } },
      bottom: { style: 'thin', color: { argb: 'FFD6DEE8' } },
      right: { style: 'thin', color: { argb: 'FFD6DEE8' } },
    };
    cell.alignment = { vertical: 'middle', horizontal: column === 3 ? 'left' : 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: editableColumns.has(column) ? 'FFEFF6FF' : 'FFF8FAFC' },
    };
  });
};

const setScoreFormulas = (sheet, rowNumber) => {
  sheet.getCell(rowNumber, 10).value = {
    formula: `IF(OR(A${rowNumber}="",C${rowNumber}=""),"",SUM(D${rowNumber}:I${rowNumber}))`,
  };
  sheet.getCell(rowNumber, 11).value = {
    formula: `IF(OR(A${rowNumber}="",C${rowNumber}=""),"",SUMIFS($J$4:$J$${MAX_SCORE_ROW},$C$4:$C$${MAX_SCORE_ROW},C${rowNumber},$A$4:$A$${MAX_SCORE_ROW},">="&A${rowNumber}-WEEKDAY(A${rowNumber},2)+1,$A$4:$A$${MAX_SCORE_ROW},"<="&A${rowNumber}))`,
  };
};

const flattenScores = (config) => {
  const members = new Map(config.scoreMembers.map((member) => [member.id, member]));
  return [...config.dailyScores]
    .sort((left, right) => left.date.localeCompare(right.date))
    .flatMap((round) => round.rows.map((row) => ({ ...row, date: round.date })))
    .sort((left, right) =>
      left.date.localeCompare(right.date) ||
      (members.get(left.id)?.name || '').localeCompare(members.get(right.id)?.name || ''));
};

export async function createScoreWorkbookBuffer(config, { template = false } = {}) {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '星屿车队配置后台';
  workbook.created = new Date();

  const scoreSheet = workbook.addWorksheet(SCORE_SHEET_NAME);
  applySheetHeader(
    scoreSheet,
    template ? '星屿积分填写模板' : '星屿积分明细',
    '按日期逐行填写蓝色单元格；得分和本周总分由公式生成。',
    SCORE_HEADERS.length,
  );
  styleHeaderRow(scoreSheet, SCORE_HEADERS);
  scoreSheet.columns = [14, 12, 20, 11, 11, 11, 11, 11, 11, 12, 12].map((width) => ({ width }));

  const membersById = new Map(config.scoreMembers.map((member) => [member.id, member]));
  const rows = template
    ? [...config.scoreMembers]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((member) => ({
        date: null,
        id: member.id,
        teamRace: [0, 0, 0],
        openRace: [0, 0, 0],
      }))
    : flattenScores(config);

  rows.forEach((score, index) => {
    const member = membersById.get(score.id);
    const rowNumber = DATA_ROW + index;
    const row = scoreSheet.getRow(rowNumber);
    row.values = [
      score.date ? dateFromKey(score.date) : null,
      member?.number || null,
      member?.name || '',
      ...score.teamRace,
      ...score.openRace,
      null,
      null,
    ];
    row.getCell(1).numFmt = 'yyyy-mm-dd';
    setScoreFormulas(scoreSheet, rowNumber);
    styleDataRow(row, new Set([1, 2, 4, 5, 6, 7, 8, 9]));
  });

  if (!template) {
    const rawSheet = workbook.addWorksheet(RAW_SCORE_SHEET_NAME);
    rawSheet.state = 'veryHidden';
    rawSheet.addRow(['日期', '积分人物ID', '赛局签名', '得分', '总分']);
    rows.forEach((score) => {
      if (score.score == null && score.total == null) return;
      rawSheet.addRow([
        score.date,
        score.id,
        JSON.stringify([...score.teamRace, ...score.openRace]),
        score.score ?? null,
        score.total ?? null,
      ]);
    });
  }

  const baseSheet = workbook.addWorksheet(BASE_SHEET_NAME);
  applySheetHeader(
    baseSheet,
    '队员期初积分',
    '期初积分是开始录入每日明细前已有的累计积分。',
    BASE_HEADERS.length,
  );
  styleHeaderRow(baseSheet, BASE_HEADERS);
  baseSheet.columns = [14, 22, 14].map((width) => ({ width }));
  [...config.scoreMembers]
    .sort((left, right) => left.name.localeCompare(right.name))
    .forEach((member, index) => {
      const row = baseSheet.getRow(DATA_ROW + index);
      row.values = [member.number || null, member.name, Number(member.basePoints || 0)];
      styleDataRow(row, new Set([3]));
    });

  const weekendSheet = workbook.addWorksheet(WEEKEND_SHEET_NAME);
  applySheetHeader(
    weekendSheet,
    '周末手动积分',
    '周末总分覆盖该日累计值；保留原始积分、得分和总分三个字段。',
    WEEKEND_HEADERS.length,
  );
  styleHeaderRow(weekendSheet, WEEKEND_HEADERS);
  weekendSheet.columns = [14, 12, 20, 12, 12, 12, 14].map((width) => ({ width }));
  const weekendRows = (config.weekendScores || [])
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date))
    .flatMap((round) =>
      round.rows.map((row) => {
        const member = membersById.get(row.id);
        return {
          date: round.date,
          number: member?.number || null,
          name: member?.name || '',
          previousPoints: row.previousPoints == null ? null : Number(row.previousPoints),
          points: row.points == null ? null : Number(row.points),
          score: row.score == null ? null : Number(row.score),
          total: row.total == null ? null : Number(row.total),
        };
      }),
    );
  weekendRows.forEach((score, index) => {
    const rowNumber = DATA_ROW + index;
    const row = weekendSheet.getRow(rowNumber);
    row.values = [dateFromKey(score.date), score.number, score.name, score.previousPoints, score.points, score.score, score.total];
    row.getCell(1).numFmt = 'yyyy-mm-dd';
    styleDataRow(row, new Set([1, 2, 4, 5, 6]));
  });

  return workbook.xlsx.writeBuffer();
}

const validateHeaders = (sheet, expected, details) => {
  expected.forEach((header, index) => {
    if (cellText(sheet.getCell(HEADER_ROW, index + 1)) !== header) {
      details.push({
        sheet: sheet.name,
        row: HEADER_ROW,
        field: header,
        message: `第 ${index + 1} 列表头必须为“${header}”`,
      });
    }
  });
};

const invalidWorkbookError = (details) => {
  const error = new Error('积分 Excel 校验失败');
  error.code = 'INVALID_SCORE_WORKBOOK';
  error.details = details;
  return error;
};

const parseStoredScore = (cell) => {
  if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) return undefined;
  const value = cellValue(cell);
  if (value === null || value === undefined || String(value).trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export async function parseScoreWorkbookBuffer(buffer, scoreMembers) {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const details = [];
  const scoreSheet = workbook.getWorksheet(SCORE_SHEET_NAME);
  const baseSheet = workbook.getWorksheet(BASE_SHEET_NAME);
  if (!scoreSheet) details.push({ sheet: SCORE_SHEET_NAME, row: 0, field: '工作表', message: '缺少积分明细工作表' });
  if (!baseSheet) details.push({ sheet: BASE_SHEET_NAME, row: 0, field: '工作表', message: '缺少队员期初积分工作表' });
  if (details.length) throw invalidWorkbookError(details);

  validateHeaders(scoreSheet, SCORE_HEADERS, details);
  validateHeaders(baseSheet, BASE_HEADERS, details);
  if (details.length) throw invalidWorkbookError(details);

  const membersByNumber = new Map(scoreMembers
    .filter((member) => String(member.number || '').trim())
    .map((member) => [String(member.number).trim(), member]));
  const membersByName = new Map(scoreMembers.map((member) => [normalizeNickname(member.name), member]));
  const findMember = (number, name) => number
    ? membersByNumber.get(number)
    : membersByName.get(normalizeNickname(name));
  const basePointsById = new Map();

  const rawScoresByKey = new Map();
  const rawSheet = workbook.getWorksheet(RAW_SCORE_SHEET_NAME);
  if (rawSheet) {
    for (let rowNumber = 2; rowNumber <= rawSheet.rowCount; rowNumber += 1) {
      const row = rawSheet.getRow(rowNumber);
      const date = cellText(row.getCell(1));
      const id = cellText(row.getCell(2));
      if (!date || !id) continue;
      rawScoresByKey.set(`${date}|${id}`, {
        raceSignature: cellText(row.getCell(3)),
        score: parseStoredScore(row.getCell(4)),
        total: parseStoredScore(row.getCell(5)),
      });
    }
  }

  for (let rowNumber = DATA_ROW; rowNumber <= baseSheet.rowCount; rowNumber += 1) {
    const row = baseSheet.getRow(rowNumber);
    const number = cellText(row.getCell(1));
    const name = cellText(row.getCell(2));
    const points = parseScore(row.getCell(3));
    if (!number && !name && cellText(row.getCell(3)) === '') continue;
    const member = findMember(number, name);
    if (!member) {
      details.push({ sheet: BASE_SHEET_NAME, row: rowNumber, field: '队员编号', message: `未找到${number ? `编号 ${number}` : `昵称 ${name || '空白'}`}的积分人物` });
    } else if (basePointsById.has(member.id)) {
      details.push({ sheet: BASE_SHEET_NAME, row: rowNumber, field: '队员编号', message: `编号 ${number} 重复` });
    } else if (points === null) {
      details.push({ sheet: BASE_SHEET_NAME, row: rowNumber, field: '期初积分', message: '期初积分必须是大于或等于 0 的数字' });
    } else {
      basePointsById.set(member.id, points);
    }
  }

  const rounds = new Map();
  const seenRows = new Set();
  for (let rowNumber = DATA_ROW; rowNumber <= scoreSheet.rowCount; rowNumber += 1) {
    const row = scoreSheet.getRow(rowNumber);
    const date = parseDateCell(row.getCell(1));
    const number = cellText(row.getCell(2));
    const name = cellText(row.getCell(3));
    const raceValues = Array.from({ length: 6 }, (_, index) => parseRaceScore(row.getCell(index + 4)));
    const storedScore = parseStoredScore(row.getCell(10));
    const storedTotal = parseStoredScore(row.getCell(11));
    const hasEnteredScores = raceValues.some((value) => value !== 0 && value !== null);
    if (!date && !hasEnteredScores) continue;

    if (!isValidDateKey(date)) {
      details.push({ sheet: SCORE_SHEET_NAME, row: rowNumber, field: '日期', message: '日期必须是有效的 YYYY-MM-DD' });
    }
    const member = findMember(number, name);
    if (!member) {
      details.push({ sheet: SCORE_SHEET_NAME, row: rowNumber, field: '队员编号', message: `未找到${number ? `编号 ${number}` : `昵称 ${name || '空白'}`}的积分人物` });
    }
    raceValues.forEach((value, index) => {
      if (value === undefined) {
        details.push({ sheet: SCORE_SHEET_NAME, row: rowNumber, field: SCORE_HEADERS[index + 3], message: '分数必须是大于或等于 0 的数字' });
      }
    });
    if (storedScore === null) {
      details.push({ sheet: SCORE_SHEET_NAME, row: rowNumber, field: '得分', message: '得分必须是大于或等于 0 的数字' });
    }
    if (storedTotal === null) {
      details.push({ sheet: SCORE_SHEET_NAME, row: rowNumber, field: '总分', message: '总分必须是大于或等于 0 的数字' });
    }
    if (!isValidDateKey(date) || !member || raceValues.includes(undefined) || storedScore === null || storedTotal === null) continue;

    const uniqueKey = `${date}|${member.id}`;
    if (seenRows.has(uniqueKey)) {
      details.push({ sheet: SCORE_SHEET_NAME, row: rowNumber, field: '队员编号', message: `${date} 已包含积分人物 ${name || number}` });
      continue;
    }
    seenRows.add(uniqueKey);
    const raw = rawScoresByKey.get(uniqueKey);
    const racesUnchanged = raw?.raceSignature === JSON.stringify(raceValues);
    const importedScore = racesUnchanged ? raw.score : storedScore;
    const importedTotal = racesUnchanged ? raw.total : storedTotal;
    if (!rounds.has(date)) rounds.set(date, []);
    rounds.get(date).push({
      id: member.id,
      teamRace: raceValues.slice(0, 3),
      openRace: raceValues.slice(3),
      ...(importedScore === undefined ? {} : { score: importedScore }),
      ...(importedTotal === undefined ? {} : { total: importedTotal }),
    });
  }

  if (!rounds.size && !details.length) {
    details.push({ sheet: SCORE_SHEET_NAME, row: 0, field: '积分明细', message: '没有可导入的日期积分记录' });
  }
  if (details.length) throw invalidWorkbookError(details);

  const nameById = new Map(scoreMembers.map((member) => [member.id, member.name]));
  const dailyScores = [...rounds]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, scoreRows]) => ({
      date,
      rows: scoreRows.sort((left, right) =>
        nameById.get(left.id).localeCompare(nameById.get(right.id))),
    }));

  return {
    dailyScores,
    basePointsById,
    summary: {
      dates: dailyScores.length,
      rows: dailyScores.reduce((total, round) => total + round.rows.length, 0),
      basePoints: basePointsById.size,
    },
  };
}

export function mergeScoreImport(config, imported) {
  const next = clone(config);
  const importedDates = new Set(imported.dailyScores.map((round) => round.date));
  next.dailyScores = [
    ...next.dailyScores.filter((round) => !importedDates.has(round.date)),
    ...clone(imported.dailyScores),
  ].sort((left, right) => left.date.localeCompare(right.date));
  next.scoreMembers = next.scoreMembers.map((member) => ({
    ...member,
    basePoints: imported.basePointsById.has(member.id)
      ? imported.basePointsById.get(member.id)
      : member.basePoints,
  }));
  return next;
}

export async function downloadScoreWorkbook(config, { template = false } = {}) {
  const buffer = await createScoreWorkbookBuffer(config, { template });
  const url = URL.createObjectURL(new Blob([buffer], { type: workbookMime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = template ? '星屿积分填写模板.xlsx' : '星屿积分明细.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
