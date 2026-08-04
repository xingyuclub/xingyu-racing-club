import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeedConfig } from '../data/siteConfig.js';
import { ScoreEditor } from './ScoreEditor.jsx';
import {
  downloadScoreWorkbook,
  mergeScoreImport,
  parseScoreWorkbookBuffer,
} from './scoreWorkbook.js';

vi.mock('./scoreWorkbook.js', () => ({
  downloadScoreWorkbook: vi.fn(),
  mergeScoreImport: vi.fn((config) => ({ ...config, imported: true })),
  parseScoreWorkbookBuffer: vi.fn(),
}));

const createConfig = () => {
  const config = createSeedConfig();
  config.roster = config.roster.slice(0, 2);
  config.scoreMembers = config.scoreMembers.slice(0, 2);
  config.dailyScores = [{
    date: '2026-07-28',
    rows: [{
      id: config.scoreMembers[0].id,
      teamRace: [1, 2, 3],
      openRace: [0, 0, 0],
    }],
  }];
  return config;
};

function ScoreEditorHarness({ initialConfig, onChange }) {
  const [config, setConfig] = useState(initialConfig);
  return <ScoreEditor config={config} onChange={(next) => {
    setConfig(next);
    onChange(next);
  }} />;
}

describe('ScoreEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('edits a race score and exposes calculated daily and weekly totals', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    const onChange = vi.fn();
    render(<ScoreEditorHarness initialConfig={config} onChange={onChange} />);

    expect(screen.getByTestId('score-editor-row')).toHaveTextContent('6');
    expect(screen.getByTestId('score-editor-row')).toHaveTextContent(
      '6',
    );

    const input = screen.getByRole('spinbutton', { name: '第1行队内赛1' });
    await user.clear(input);
    await user.type(input, '6');

    const next = onChange.mock.calls.at(-1)[0];
    expect(next.dailyScores[0].rows[0].teamRace[0]).toBe(6);
  });

  it('stores cleared race inputs and new row slots as null', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    const onChange = vi.fn();
    render(<ScoreEditorHarness initialConfig={config} onChange={onChange} />);

    const input = screen.getByRole('spinbutton', { name: '第1行队内赛1' });
    await user.clear(input);
    expect(onChange.mock.calls.at(-1)[0].dailyScores[0].rows[0].teamRace[0]).toBeNull();

    await user.click(screen.getByRole('button', { name: '新增明细' }));
    const added = onChange.mock.calls.at(-1)[0].dailyScores[0].rows[1];
    expect(added.teamRace).toEqual([null, null, null]);
    expect(added.openRace).toEqual([null, null, null]);
  });

  it('allows the date input to be cleared without throwing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ScoreEditorHarness initialConfig={createConfig()} onChange={onChange} />);

    await user.clear(screen.getByLabelText('第1行日期'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps imported totals on untouched rows and clears them on the edited row', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    config.dailyScores[0].rows[0].score = 6;
    config.dailyScores[0].rows[0].total = 18;
    config.dailyScores[0].rows.push({
      id: config.scoreMembers[1].id,
      teamRace: [2, 0, 0],
      openRace: [0, 0, 0],
      score: 2,
      total: 20,
    });
    config.dailyScores.push({
      date: '2026-07-29',
      rows: [{
        id: config.scoreMembers[0].id,
        teamRace: [2, 0, 0],
        openRace: [0, 0, 0],
        score: 2,
        total: 20,
      }],
    });
    const onChange = vi.fn();
    render(<ScoreEditorHarness initialConfig={config} onChange={onChange} />);

    await user.clear(screen.getByLabelText('筛选日期'));
    await user.type(screen.getByLabelText('筛选日期'), '2026-07-28');
    const input = screen.getByRole('spinbutton', { name: '第1行队内赛1' });
    await user.clear(input);
    await user.type(input, '5');

    const rounds = onChange.mock.calls.at(-1)[0].dailyScores;
    expect(rounds[0].rows[0]).not.toHaveProperty('score');
    expect(rounds[0].rows[0]).not.toHaveProperty('total');
    expect(rounds[0].rows[1]).toMatchObject({ score: 2, total: 20 });
    expect(rounds[1].rows[0]).toMatchObject({ score: 2 });
    expect(rounds[1].rows[0]).not.toHaveProperty('total');
  });

  it('uses score members instead of roster members in the score table', () => {
    const config = createConfig();
    config.roster[0].name = '后台名称';
    config.scoreMembers[0].name = 'Excel名称';

    render(<ScoreEditor config={config} onChange={() => {}} />);

    expect(screen.getByRole('option', { name: 'Excel名称' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '后台名称' })).not.toBeInTheDocument();
  });

  it('defaults to the latest score date and only shows the selected date', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    config.dailyScores.push({
      date: '2026-07-29',
      rows: [{
        id: config.scoreMembers[1].id,
        teamRace: [4, 0, 0],
        openRace: [0, 0, 0],
      }],
    });

    render(<ScoreEditorHarness initialConfig={config} onChange={() => {}} />);

    expect(screen.getByLabelText('筛选日期')).toHaveValue('2026-07-29');
    expect(screen.getAllByTestId('score-editor-row')).toHaveLength(1);
    expect(within(screen.getByTestId('score-editor-row')).getByRole('option', {
      name: config.scoreMembers[1].name,
      selected: true,
    })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('筛选日期'));
    await user.type(screen.getByLabelText('筛选日期'), '2026-07-28');

    expect(screen.getAllByTestId('score-editor-row')).toHaveLength(1);
    expect(within(screen.getByTestId('score-editor-row')).getByRole('option', {
      name: config.scoreMembers[0].name,
      selected: true,
    })).toBeInTheDocument();
  });

  it('includes weekend dates in the date union and renders projected weekend fields read-only', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    config.weekendScores = [
      { date: '2026-08-08', rows: [{ id: config.scoreMembers[0].id, previousPoints: 90, points: 100 }] },
      { date: '2026-08-09', rows: [{ id: config.scoreMembers[0].id, points: 112 }] },
    ];

    render(<ScoreEditor config={config} onChange={() => {}} />);
    const memberName = config.scoreMembers[0].name;

    expect(screen.getByLabelText('筛选日期')).toHaveValue('2026-08-09');
    expect(screen.getByTestId('score-editor-weekend-row')).toBeInTheDocument();
    expect(screen.getByLabelText(`周日 ${memberName} 得分`)).toHaveValue(12);
    expect(screen.getByLabelText(`周日 ${memberName} 得分`)).toHaveAttribute('readonly');

    await user.clear(screen.getByLabelText('筛选日期'));
    await user.type(screen.getByLabelText('筛选日期'), '2026-08-08');
    expect(screen.getByLabelText(`周六 ${memberName} 上周积分`)).toHaveValue(90);
    expect(screen.getByLabelText(`周六 ${memberName} 总分`)).toHaveValue(10);
  });

  it('sorts weekday rows without changing the raw row used by edits', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    config.dailyScores[0].rows.push({
      id: config.scoreMembers[1].id,
      teamRace: [9, 0, 0],
      openRace: [0, 0, 0],
    });
    const onChange = vi.fn();

    render(<ScoreEditorHarness initialConfig={config} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '按队内赛1从大到小排序' }));

    const sortedRows = screen.getAllByTestId('score-editor-row');
    expect(within(sortedRows[0]).getByRole('option', { name: config.scoreMembers[1].name, selected: true })).toBeInTheDocument();
    const firstRace = within(sortedRows[0]).getByRole('spinbutton', { name: '第2行队内赛1' });
    await user.clear(firstRace);
    await user.type(firstRace, '10');

    const latest = onChange.mock.calls.at(-1)[0];
    expect(latest.dailyScores[0].rows[1].teamRace[0]).toBe(10);
    expect(latest.dailyScores[0].rows[0].teamRace[0]).toBe(1);
  });

  it('manages roster names without showing Excel-only score members', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    config.roster[0].name = '后台队员';
    config.scoreMembers[0].name = 'Excel历史人物';
    const onChange = vi.fn();

    render(<ScoreEditorHarness initialConfig={config} onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: '队员管理' }));

    expect(screen.getByDisplayValue('后台队员')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Excel历史人物')).not.toBeInTheDocument();

    const input = screen.getByRole('textbox', { name: '队员 1 名称' });
    await user.clear(input);
    await user.type(input, '新后台名称');

    expect(onChange.mock.calls.at(-1)[0].roster[0].name).toBe('新后台名称');
  });

  it('adds and removes roster members from the score member manager', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    const onChange = vi.fn();

    render(<ScoreEditorHarness initialConfig={config} onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: '队员管理' }));
    await user.click(screen.getByRole('button', { name: '新增队员' }));

    expect(onChange.mock.calls.at(-1)[0].roster).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: '队员 3 名称' })).toHaveValue('新队员');

    await user.click(screen.getByRole('button', { name: '删除队员 3' }));
    expect(onChange.mock.calls.at(-1)[0].roster).toHaveLength(2);
  });

  it('downloads a blank template and the current score data', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    render(<ScoreEditor config={config} onChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: '下载模板' }));
    await user.click(screen.getByRole('button', { name: '导出当前数据' }));

    expect(downloadScoreWorkbook).toHaveBeenNthCalledWith(1, config, { template: true });
    expect(downloadScoreWorkbook).toHaveBeenNthCalledWith(2, config, { template: false });
  });

  it('previews a valid import and changes the draft only after confirmation', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    const onChange = vi.fn();
    const imported = {
      dailyScores: [{ date: '2026-07-29', rows: [config.dailyScores[0].rows[0]] }],
      basePointsById: new Map([[config.scoreMembers[0].id, 20]]),
      summary: { dates: 1, rows: 1, basePoints: 1 },
    };
    parseScoreWorkbookBuffer.mockResolvedValue(imported);
    const file = new File(['workbook'], 'scores.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    render(<ScoreEditor config={config} onChange={onChange} />);
    await user.upload(screen.getByLabelText('导入积分 Excel'), file);

    expect(await screen.findByText('影响日期 1 天')).toBeInTheDocument();
    expect(screen.getByText('积分明细 1 行')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '确认导入' }));

    expect(mergeScoreImport).toHaveBeenCalledWith(config, imported);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ imported: true }));
  });

  it('shows workbook row errors without changing the draft', async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error('积分 Excel 校验失败'), {
      details: [{ sheet: '积分明细', row: 8, field: '日期', message: '日期无效' }],
    });
    parseScoreWorkbookBuffer.mockRejectedValue(error);
    const file = new File(['bad'], 'bad.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    const onChange = vi.fn();

    render(<ScoreEditor config={createConfig()} onChange={onChange} />);
    await user.upload(screen.getByLabelText('导入积分 Excel'), file);

    await waitFor(() => expect(screen.getByText('积分明细 第8行 日期：日期无效')).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens a ready recognition batch from history', async () => {
    const config = createConfig();
    const draft = {
      canCommit: true,
      rosterVersion: 'v1',
      summary: [{ id: 's1', name: '稳稳', score: 8, evidenceIds: ['i0-m0-p0'] }],
      evidence: [{
        id: 'i0-m0-p0', imageIndex: 0, nickname: '稳稳', rank: 1,
        score: 8, slot: 0, memberId: config.roster[0].id, memberName: '稳稳', scoreMemberId: 's1',
      }],
      issues: [],
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ([{
        id: 'batch-ready', status: 'ready', raceType: 'team', date: '2026-08-03', images: [{}],
      }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        id: 'batch-ready', status: 'ready', raceType: 'team', date: '2026-08-03', draft,
      }) }));
    render(<ScoreEditor config={config} onChange={() => {}} />);

    await userEvent.click(screen.getByRole('tab', { name: '识别记录' }));
    await userEvent.click(await screen.findByRole('button', { name: /继续审核/ }));

    expect(await screen.findByRole('button', { name: '查看稳稳的依据' })).toHaveTextContent('+8 分');
    expect(screen.getByRole('tab', { name: '截图识别' })).toHaveAttribute('aria-selected', 'true');
  });
});
