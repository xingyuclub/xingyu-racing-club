import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ScoreDetailsModal } from './ScoreDetailsModal.jsx';

it('shows the exact Saturday team-race fields and weekly total without a cross-week total', () => {
  render(<ScoreDetailsModal
    onClose={vi.fn()}
    dailyScores={[{
      date: '2026-08-01',
      weekday: '周六',
      rows: [{
        id: '1',
        name: '青山',
        teamRace: [],
        openRace: [],
        previousPoints: 90,
        points: 142,
        score: 52,
        weekTotal: 136,
        total: 136,
        seasonPoints: 207,
      }],
    }]}
  />);

  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('车队赛')).toBeInTheDocument();
  expect(within(dialog).getByText('上周积分')).toBeInTheDocument();
  expect(within(dialog).getByText('积分')).toBeInTheDocument();
  expect(within(dialog).getByRole('columnheader', { name: '总分', exact: true })).toBeInTheDocument();
  expect(within(dialog).getByRole('columnheader', { name: '赛季总分', exact: true })).toBeInTheDocument();
  expect(within(dialog).queryByText('累计总分')).not.toBeInTheDocument();
  const row = within(dialog).getByTestId('daily-score-row');
  for (const value of ['90', '142', '52', '136', '207']) {
    expect(within(row).getByText(value)).toBeInTheDocument();
  }
});

it('sorts weekday rows by score and total in both directions', async () => {
  const user = userEvent.setup();
  render(<ScoreDetailsModal
    onClose={vi.fn()}
    dailyScores={[{
      date: '2026-07-31',
      weekday: '周五',
      rows: [
        { id: 'a', name: '甲', teamRace: [1, 0, 0], openRace: [], score: 2, total: 10, seasonPoints: 30 },
        { id: 'b', name: '乙', teamRace: [2, 0, 0], openRace: [], score: 8, total: 5, seasonPoints: 20 },
        { id: 'c', name: '丙', teamRace: [3, 0, 0], openRace: [], score: 4, total: 12, seasonPoints: 10 },
      ],
    }]}
  />);

  const getNames = () => screen.getAllByTestId('daily-score-row')
    .map((row) => within(row).getByRole('rowheader').textContent);

  expect(getNames()).toEqual(['丙', '甲', '乙']);

  const scoreHeader = within(screen.getByRole('dialog')).getByRole('columnheader', { name: '得分', exact: true });
  const scoreButton = within(scoreHeader).getByRole('button', { name: /得分/ });
  await user.click(scoreButton);
  expect(getNames()).toEqual(['乙', '丙', '甲']);
  expect(scoreHeader).toHaveAttribute('aria-sort', 'descending');

  await user.click(scoreButton);
  expect(getNames()).toEqual(['甲', '丙', '乙']);
  expect(scoreHeader).toHaveAttribute('aria-sort', 'ascending');

  const totalHeader = within(screen.getByRole('dialog')).getByRole('columnheader', { name: '总分', exact: true });
  await user.click(within(totalHeader).getByRole('button', { name: /总分/ }));
  expect(getNames()).toEqual(['丙', '甲', '乙']);
  expect(totalHeader).toHaveAttribute('aria-sort', 'descending');

  const seasonHeader = within(screen.getByRole('dialog')).getByRole('columnheader', { name: '赛季总分', exact: true });
  await user.click(within(seasonHeader).getByRole('button', { name: /赛季总分/ }));
  expect(getNames()).toEqual(['甲', '乙', '丙']);
  expect(seasonHeader).toHaveAttribute('aria-sort', 'descending');
});

it('sorts weekend rows by points in both directions', async () => {
  const user = userEvent.setup();
  render(<ScoreDetailsModal
    onClose={vi.fn()}
    dailyScores={[{
      date: '2026-08-01',
      weekday: '周六',
      rows: [
        { id: 'a', name: '甲', teamRace: [], openRace: [], previousPoints: 80, points: 100, score: 20, total: 4 },
        { id: 'b', name: '乙', teamRace: [], openRace: [], previousPoints: 70, points: 80, score: 10, total: 8 },
        { id: 'c', name: '丙', teamRace: [], openRace: [], previousPoints: 90, points: 120, score: 30, total: 2 },
      ],
    }]}
  />);

  const getNames = () => screen.getAllByTestId('daily-score-row')
    .map((row) => within(row).getByRole('rowheader').textContent);

  expect(getNames()).toEqual(['乙', '甲', '丙']);

  const pointsHeader = within(screen.getByRole('dialog')).getByRole('columnheader', { name: '积分', exact: true });
  const pointsButton = within(pointsHeader).getByRole('button', { name: /积分/ });
  await user.click(pointsButton);
  expect(getNames()).toEqual(['丙', '甲', '乙']);
  expect(pointsHeader).toHaveAttribute('aria-sort', 'descending');

  await user.click(pointsButton);
  expect(getNames()).toEqual(['乙', '甲', '丙']);
  expect(pointsHeader).toHaveAttribute('aria-sort', 'ascending');
});
