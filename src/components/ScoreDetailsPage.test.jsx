import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ScoreDetailsPage } from './ScoreDetailsPage.jsx';

const dailyScores = [{
  date: '2026-07-24',
  weekday: '周五',
  rows: [
    { id: 'a', name: '甲', teamRace: [1, 2, 3], openRace: [4, 5, 6], score: 12, total: 80, seasonPoints: 120 },
    { id: 'b', name: '乙', teamRace: [3, 2, 1], openRace: [6, 5, 4], score: 20, total: 60, seasonPoints: 100 },
    { id: 'c', name: '丙', teamRace: [2, 3, 1], openRace: [5, 4, 6], score: 16, total: 70, seasonPoints: 90 },
  ],
}];

it('filters a date before showing the member result cards', async () => {
  const user = userEvent.setup();
  render(<ScoreDetailsPage dailyScores={dailyScores} onBack={vi.fn()} />);

  expect(screen.getByRole('button', { name: '返回积分榜' })).toBeInTheDocument();
  expect(screen.getByText('选择日期后查看成绩')).toBeInTheDocument();
  expect(screen.queryByTestId('score-query-row')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '查看 2026年7月24日积分' }));

  const resultRegion = screen.getByRole('region', { name: '日期积分结果' });
  expect(within(resultRegion).getAllByTestId('score-query-row')).toHaveLength(3);
  const firstRow = within(resultRegion).getAllByTestId('score-query-row')[0];
  expect(firstRow).toHaveTextContent('甲');
  expect(within(firstRow).getByText('今日得分')).toBeInTheDocument();
  expect(within(firstRow).getByText('本周总分')).toBeInTheDocument();
  expect(within(firstRow).getByText('赛季总分')).toBeInTheDocument();
  expect(within(resultRegion).getByText('队内赛')).toBeInTheDocument();
  expect(within(resultRegion).getByText('开黑赛')).toBeInTheDocument();
});

it('sorts summary cards and expands one member detail at a time', async () => {
  const user = userEvent.setup();
  render(<ScoreDetailsPage dailyScores={dailyScores} onBack={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: '查看 2026年7月24日积分' }));
  await user.click(screen.getByRole('tab', { name: '得分' }));

  const rows = screen.getAllByTestId('score-query-row');
  expect(rows[0]).toHaveTextContent('乙');
  expect(rows[0]).toHaveTextContent('队内赛');

  await user.click(screen.getByRole('tab', { name: '得分' }));
  expect(screen.getAllByTestId('score-query-row')[0]).toHaveTextContent('甲');

  await user.click(screen.getByRole('tab', { name: '得分' }));
  expect(screen.getAllByTestId('score-query-row')[0]).toHaveTextContent('乙');

  const resortedRows = screen.getAllByTestId('score-query-row');
  await user.click(within(resortedRows[1]).getByRole('button'));
  expect(resortedRows[1]).toHaveTextContent('队内赛');
  expect(resortedRows[0]).not.toHaveTextContent('队内赛');
});

it('returns to the leaderboard from the global back button', async () => {
  const user = userEvent.setup();
  const onBack = vi.fn();
  render(<ScoreDetailsPage dailyScores={dailyScores} onBack={onBack} />);

  await user.click(screen.getByRole('button', { name: '返回积分榜' }));

  expect(onBack).toHaveBeenCalledTimes(1);
});

it('counts only members with a positive daily score as participants', async () => {
  const user = userEvent.setup();
  render(<ScoreDetailsPage
    dailyScores={[{
      date: '2026-07-25',
      weekday: '周六',
      rows: [
        { id: 'a', name: '得分成员', score: 8, total: 20, seasonPoints: 40 },
        { id: 'b', name: '零分成员', score: 0, total: 5, seasonPoints: 10 },
      ],
    }]}
    onBack={vi.fn()}
  />);

  expect(screen.getByRole('button', { name: '查看 2026年7月25日积分' })).toHaveTextContent('1人');
  await user.click(screen.getByRole('button', { name: '查看 2026年7月25日积分' }));

  const resultRegion = screen.getByRole('region', { name: '日期积分结果' });
  expect(resultRegion).toHaveTextContent('1 人参与');
  expect(resultRegion).toHaveTextContent('参与人数');
  expect(within(resultRegion).getAllByTestId('score-query-row')).toHaveLength(2);
});
