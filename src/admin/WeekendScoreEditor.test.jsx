import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { WeekendScoreEditor } from './WeekendScoreEditor.jsx';

const baseConfig = {
  roster: [
    { id: 'r1', name: '青山', number: '01' },
    { id: 'r2', name: 'ˣʸ༩·喵酱', number: '02' },
  ],
  scoreMembers: [
    { id: '1', name: '青山', basePoints: 0, wins: 0 },
    { id: '2', name: '喵酱', basePoints: 0, wins: 0 },
    { id: '3', name: 'Excel历史人物', basePoints: 0, wins: 0 },
  ],
  weekendScores: [],
  dailyScores: [],
  albums: [],
};

// Wrapper that feeds onChange back into state so controlled inputs re-render.
function StatefulEditor({ initial }) {
  const [config, setConfig] = useState(initial);
  return <WeekendScoreEditor config={config} onChange={setConfig} />;
}

const getCurrentSaturday = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + diff);
  monday.setDate(monday.getDate() + 5);
  return monday.toISOString().slice(0, 10);
};

it('renders the selected Saturday table with every score member', () => {
  render(<WeekendScoreEditor config={baseConfig} onChange={vi.fn()} />);

  expect(screen.getByText(/周六（/)).toBeInTheDocument();
  expect(screen.getAllByText('青山')).toHaveLength(1);
  expect(screen.getAllByText(/喵酱/)).toHaveLength(1);
  expect(screen.getByLabelText('周六 青山 积分')).toBeInTheDocument();
  expect(screen.getByLabelText('周六 青山 上周积分')).toBeInTheDocument();
  expect(screen.getAllByText('Excel历史人物')).toHaveLength(1);
});

it('disables weekdays and switches the table when a Sunday is selected', async () => {
  render(<WeekendScoreEditor config={baseConfig} onChange={vi.fn()} />);

  const calendar = screen.getByRole('grid', { name: '周末日期' });
  expect(within(calendar).getAllByRole('button', { disabled: true }).length).toBeGreaterThanOrEqual(5);

  const sundayButton = within(calendar).getAllByRole('button').find((button) => button.getAttribute('aria-label')?.includes('周日'));
  expect(sundayButton).toBeEnabled();
  await userEvent.click(sundayButton);

  expect(screen.getByText(/周日（/)).toBeInTheDocument();
  expect(screen.queryByLabelText('周日 青山 上周积分')).not.toBeInTheDocument();
});

it('shows the previous Saturday points on the left when Sunday is selected', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-08T12:00:00'));
  const config = {
    ...baseConfig,
    weekendScores: [{ date: '2026-08-08', rows: [{ id: '1', points: 494 }] }],
  };

  try {
    render(<WeekendScoreEditor config={config} onChange={vi.fn()} />);
    const calendar = screen.getByRole('grid', { name: '周末日期' });
    fireEvent.click(within(calendar).getByRole('button', { name: '2026-08-09 周日' }));

    expect(screen.getByLabelText('周日 青山 周六积分')).toHaveValue(494);
    expect(screen.getByLabelText('周日 青山 周六积分')).toHaveAttribute('readonly');
  } finally {
    vi.useRealTimers();
  }
});

it('writes the edited value into the matching weekendScores row', async () => {
  render(<StatefulEditor initial={baseConfig} />);

  await userEvent.type(screen.getByLabelText('周六 青山 积分'), '120');

  const input = screen.getByLabelText('周六 青山 积分');
  expect(input).toHaveValue(120);
});

it('calculates weekend fields and keeps formula outputs read-only', async () => {
  const onChange = vi.fn();
  function Spy() {
    const [config, setConfig] = useState(baseConfig);
    return <WeekendScoreEditor config={config} onChange={(next) => { setConfig(next); onChange(next); }} />;
  }
  render(<Spy />);

  await userEvent.type(screen.getByLabelText('周六 青山 上周积分'), '90');
  await userEvent.type(screen.getByLabelText('周六 青山 积分'), '100');

  const last = onChange.mock.calls.at(-1)[0];
  const row = last.weekendScores[0].rows[0];
  expect(row).toMatchObject({ id: '1', previousPoints: 90, points: 100 });
  expect(screen.getByLabelText('周六 青山 得分')).toHaveValue(10);
  expect(screen.getByLabelText('周六 青山 得分')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('周六 青山 总分')).toHaveValue(10);
  expect(screen.getByLabelText('周六 青山 总分')).toHaveAttribute('readonly');
});

it('shows only members with a positive score in the score header count', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-15T12:00:00'));
  const config = {
    ...baseConfig,
    weekendScores: [{
      date: '2026-08-15',
      rows: [
        { id: '1', previousPoints: 90, points: 100 },
        { id: '2', previousPoints: 80, points: 80 },
        { id: '3', previousPoints: 60, points: 50 },
      ],
    }],
  };

  try {
    render(<WeekendScoreEditor config={config} onChange={vi.fn()} />);

    expect(screen.getByRole('columnheader', { name: /得分/ })).toHaveTextContent('得分（1人）');
  } finally {
    vi.useRealTimers();
  }
});

it('locks an inherited Saturday baseline and derives the weekly total', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-15T12:00:00'));
  const config = {
    ...baseConfig,
    dailyScores: [{ date: '2026-08-14', rows: [{ id: '1', teamRace: [8, 0, 0], openRace: [0, 0, 0] }] }],
    weekendScores: [
      { date: '2026-08-09', rows: [{ id: '1', points: 112 }] },
      { date: '2026-08-15', rows: [{ id: '1', previousPoints: 999, points: 120 }] },
    ],
  };

  try {
    render(<WeekendScoreEditor config={config} onChange={vi.fn()} />);

    expect(screen.getByLabelText('周六 青山 上周积分')).toHaveValue(112);
    expect(screen.getByLabelText('周六 青山 上周积分')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('周六 青山 得分')).toHaveValue(8);
    expect(screen.getByLabelText('周六 青山 总分')).toHaveValue(16);
  } finally {
    vi.useRealTimers();
  }
});

it('inherits the previous weekend points when the next Saturday has no saved row yet', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-10T12:00:00'));
  const config = {
    ...baseConfig,
    weekendScores: [
      { date: '2026-08-08', rows: [{ id: '1', previousPoints: 90, points: 112 }] },
    ],
  };

  try {
    render(<WeekendScoreEditor config={config} onChange={vi.fn()} />);

    expect(screen.getByText('周六（2026-08-15）')).toBeInTheDocument();
    expect(screen.getByLabelText('周六 青山 上周积分')).toHaveValue(112);
    expect(screen.getByLabelText('周六 青山 上周积分')).toHaveAttribute('readonly');
  } finally {
    vi.useRealTimers();
  }
});

it('pre-fills zero previous points for the first Saturday of the new season', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-22T12:00:00'));
  const config = {
    ...baseConfig,
    weekendScores: [
      { date: '2026-08-16', rows: [{ id: '1', points: 571 }] },
    ],
  };

  try {
    function StatefulNewSeason() {
      const [current, setCurrent] = useState(config);
      return <WeekendScoreEditor config={current} onChange={setCurrent} />;
    }
    render(<StatefulNewSeason />);

    expect(screen.getByText('周六（2026-08-22）')).toBeInTheDocument();
    const previousPoints = screen.getByLabelText('周六 青山 上周积分');
    expect(previousPoints).toHaveValue(0);
    expect(previousPoints).not.toHaveAttribute('readonly');

    fireEvent.change(screen.getByLabelText('周六 青山 积分'), { target: { value: '30' } });

    expect(screen.getByLabelText('周六 青山 得分')).toHaveValue(30);
    expect(screen.getByLabelText('周六 青山 总分')).toHaveValue(30);
  } finally {
    vi.useRealTimers();
  }
});

it('sorts each weekend numeric column from large to small', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-08T12:00:00'));
  const config = {
    ...baseConfig,
    weekendScores: [
      { date: '2026-08-08', rows: [
        { id: '1', previousPoints: 90, points: 100 },
        { id: '2', previousPoints: 50, points: 80 },
      ] },
      { date: '2026-08-09', rows: [
        { id: '1', points: 112 },
        { id: '2', points: 85 },
      ] },
    ],
  };

  try {
    render(<WeekendScoreEditor config={config} onChange={vi.fn()} />);
    const saturday = screen.getByText('周六（2026-08-08）').closest('.weekend-score-day');
    for (const field of ['上周积分', '积分', '得分', '总分']) {
      expect(within(saturday).getByRole('button', { name: `按周六${field}从大到小排序` })).toBeInTheDocument();
    }

    fireEvent.click(within(saturday).getByRole('button', { name: '按周六得分从大到小排序' }));
    expect(within(saturday).getAllByRole('row')[1]).toHaveTextContent('喵酱');
  } finally {
    vi.useRealTimers();
  }
});

it('uses local calendar dates before 08:00 instead of shifting them to UTC', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 3, 1, 0, 0));

  try {
    render(<WeekendScoreEditor config={baseConfig} onChange={vi.fn()} />);

    expect(screen.getByText('周六（2026-08-08）')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it('loads existing weekendScores values into the inputs', () => {
  const saturday = getCurrentSaturday();

  const config = {
    ...baseConfig,
    weekendScores: [{ date: saturday, rows: [{ id: '1', previousPoints: 90, points: 100, score: 12, total: 100 }] }],
  };

  render(<WeekendScoreEditor config={config} onChange={vi.fn()} />);

  expect(screen.getByLabelText('周六 青山 积分')).toHaveValue(100);
  expect(screen.getByLabelText('周六 青山 上周积分')).toHaveValue(90);
});

it('opens an older weekend date from a previous calendar month with its existing values', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-10T12:00:00'));
  const config = {
    ...baseConfig,
    weekendScores: [{ date: '2026-07-26', rows: [{ id: '1', points: 88 }] }],
  };

  try {
    render(<WeekendScoreEditor config={config} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '上个月' }));
    fireEvent.click(screen.getByRole('button', { name: '2026-07-26 周日' }));

    expect(screen.getByText('周日（2026-07-26）')).toBeInTheDocument();
    expect(screen.getByLabelText('周日 青山 积分')).toHaveValue(88);
  } finally {
    vi.useRealTimers();
  }
});

it('keeps roster-only members out of the weekend score table', () => {
  const config = {
    ...baseConfig,
    roster: [...baseConfig.roster, { id: 'r9', name: '泉舒', number: '03' }],
  };
  render(<WeekendScoreEditor config={config} onChange={vi.fn()} />);

  expect(screen.queryByText('泉舒')).not.toBeInTheDocument();
});

it('reflects score member changes from the score member manager immediately', async () => {
  function ScoreSync() {
    const [config, setConfig] = useState(baseConfig);
    return (
      <>
        <button onClick={() => setConfig((current) => ({ ...current, scoreMembers: [...current.scoreMembers, { id: '9', name: '泉舒', basePoints: 0, wins: 0 }] }))}>
          新增积分队员
        </button>
        <WeekendScoreEditor config={config} onChange={setConfig} />
      </>
    );
  }
  render(<ScoreSync />);

  expect(screen.queryByText('泉舒')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '新增积分队员' }));
  expect(screen.getAllByText('泉舒')).toHaveLength(1);
});
