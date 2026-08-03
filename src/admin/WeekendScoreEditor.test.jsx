import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { WeekendScoreEditor } from './WeekendScoreEditor.jsx';

const baseConfig = {
  roster: [
    { id: 'backend-1', name: '后台青山', number: '01' },
  ],
  scoreMembers: [
    { id: '1', name: '青山', basePoints: 0, wins: 0 },
    { id: '2', name: '喵酱', basePoints: 0, wins: 0 },
  ],
  weekendScores: [],
};

// Wrapper that feeds onChange back into state so controlled inputs re-render.
function StatefulEditor({ initial }) {
  const [config, setConfig] = useState(initial);
  return <WeekendScoreEditor config={config} onChange={setConfig} />;
}

it('renders a fixed Saturday and Sunday table with every score member', () => {
  render(<WeekendScoreEditor config={baseConfig} onChange={vi.fn()} />);

  expect(screen.getByText(/周六（/)).toBeInTheDocument();
  expect(screen.getByText(/周日（/)).toBeInTheDocument();
  expect(screen.getAllByText('青山')).toHaveLength(2);
  expect(screen.getAllByText('喵酱')).toHaveLength(2);
  expect(screen.getByLabelText('周六 青山 积分')).toBeInTheDocument();
  expect(screen.getByLabelText('周六 青山 上周积分')).toBeInTheDocument();
  expect(screen.queryByLabelText('周日 青山 上周积分')).not.toBeInTheDocument();
  expect(screen.getByLabelText('周日 喵酱 总分')).toBeInTheDocument();
  expect(screen.queryByText('后台青山')).not.toBeInTheDocument();
});

it('writes the edited value into the matching weekendScores row', async () => {
  render(<StatefulEditor initial={baseConfig} />);

  await userEvent.type(screen.getByLabelText('周六 青山 积分'), '120');

  const input = screen.getByLabelText('周六 青山 积分');
  expect(input).toHaveValue(120);
});

it('preserves all four Saturday source fields when editing a member row', async () => {
  const onChange = vi.fn();
  function Spy() {
    const [config, setConfig] = useState(baseConfig);
    return <WeekendScoreEditor config={config} onChange={(next) => { setConfig(next); onChange(next); }} />;
  }
  render(<Spy />);

  await userEvent.type(screen.getByLabelText('周六 青山 上周积分'), '90');
  await userEvent.type(screen.getByLabelText('周六 青山 得分'), '7');
  await userEvent.type(screen.getByLabelText('周六 青山 总分'), '9');

  const last = onChange.mock.calls.at(-1)[0];
  const row = last.weekendScores[0].rows[0];
  expect(row).toMatchObject({ id: '1', previousPoints: 90, score: 7, total: 9 });
  expect(['previousPoints', 'points', 'score', 'total'].map((field) => row[field])).toEqual([
    90,
    null,
    7,
    9,
  ]);
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
