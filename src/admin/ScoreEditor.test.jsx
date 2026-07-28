import { render, screen, waitFor } from '@testing-library/react';
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
  config.dailyScores = [{
    date: '2026-07-28',
    rows: [{
      id: config.roster[0].id,
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

  it('edits a race score and exposes calculated daily and cumulative totals', async () => {
    const user = userEvent.setup();
    const config = createConfig();
    const onChange = vi.fn();
    render(<ScoreEditorHarness initialConfig={config} onChange={onChange} />);

    expect(screen.getByTestId('score-editor-row')).toHaveTextContent('6');
    expect(screen.getByTestId('score-editor-row')).toHaveTextContent(
      String(config.roster[0].basePoints + 6),
    );

    const input = screen.getByRole('spinbutton', { name: '第1行队内赛1' });
    await user.clear(input);
    await user.type(input, '6');

    const next = onChange.mock.calls.at(-1)[0];
    expect(next.dailyScores[0].rows[0].teamRace[0]).toBe(6);
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
      basePointsById: new Map([[config.roster[0].id, 20]]),
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
});
