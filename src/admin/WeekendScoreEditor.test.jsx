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

it('renders a fixed Saturday and Sunday table with every roster member', () => {
  render(<WeekendScoreEditor config={baseConfig} onChange={vi.fn()} />);

  expect(screen.getByText(/周六（/)).toBeInTheDocument();
  expect(screen.getByText(/周日（/)).toBeInTheDocument();
  expect(screen.getAllByText('青山')).toHaveLength(2);
  expect(screen.getAllByText(/喵酱/)).toHaveLength(2);
  expect(screen.getByLabelText('周六 青山 积分')).toBeInTheDocument();
  expect(screen.getByLabelText('周六 青山 上周积分')).toBeInTheDocument();
  expect(screen.queryByLabelText('周日 青山 上周积分')).not.toBeInTheDocument();
  expect(screen.getByLabelText('周日 ˣʸ༩·喵酱 总分')).toBeInTheDocument();
  expect(screen.queryByText('Excel历史人物')).not.toBeInTheDocument();
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
    const sunday = screen.getByText('周日（2026-08-09）').closest('.weekend-score-day');
    for (const field of ['上周积分', '积分', '得分', '总分']) {
      expect(within(saturday).getByRole('button', { name: `按周六${field}从大到小排序` })).toBeInTheDocument();
    }
    for (const field of ['积分', '得分', '总分']) {
      expect(within(sunday).getByRole('button', { name: `按周日${field}从大到小排序` })).toBeInTheDocument();
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
    expect(screen.getByText('周日（2026-08-09）')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it('loads existing weekendScores values into the inputs', () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + diff);
  const sat = new Date(monday);
  sat.setDate(sat.getDate() + 5);
  const saturday = sat.toISOString().slice(0, 10);

  const config = {
    ...baseConfig,
    weekendScores: [{ date: saturday, rows: [{ id: '1', previousPoints: 90, points: 100, score: 12, total: 100 }] }],
  };

  render(<WeekendScoreEditor config={config} onChange={vi.fn()} />);

  expect(screen.getByLabelText('周六 青山 积分')).toHaveValue(100);
  expect(screen.getByLabelText('周六 青山 上周积分')).toHaveValue(90);
});

it('creates a score member identity when a roster member has none yet', async () => {
  const onChange = vi.fn();
  function Spy() {
    const [config, setConfig] = useState({
      ...baseConfig,
      roster: [...baseConfig.roster, { id: 'r9', name: '泉舒', number: '03' }],
    });
    return <WeekendScoreEditor config={config} onChange={(next) => { setConfig(next); onChange(next); }} />;
  }
  render(<Spy />);

  expect(screen.getAllByText('泉舒')).toHaveLength(2);
  await userEvent.type(screen.getByLabelText('周六 泉舒 积分'), '60');

  const last = onChange.mock.calls.at(-1)[0];
  const id = 'score:' + encodeURIComponent('泉舒');
  expect(last.scoreMembers.some((member) => member.id === id && member.name === '泉舒')).toBe(true);
  expect(last.weekendScores[0].rows.find((row) => row.id === id).points).toBe(60);
});

it('reflects roster changes from member management immediately', async () => {
  function RosterSync() {
    const [config, setConfig] = useState(baseConfig);
    return (
      <>
        <button onClick={() => setConfig((current) => ({ ...current, roster: [...current.roster, { id: 'r9', name: '泉舒', number: '03' }] }))}>
          新增队员
        </button>
        <WeekendScoreEditor config={config} onChange={setConfig} />
      </>
    );
  }
  render(<RosterSync />);

  expect(screen.queryByText('泉舒')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '新增队员' }));
  expect(screen.getAllByText('泉舒')).toHaveLength(2);
});