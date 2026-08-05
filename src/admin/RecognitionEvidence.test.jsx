import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecognitionEvidence } from './RecognitionEvidence.jsx';

const config = {
  roster: [
    { id: 'roster-1', name: '十二' },
    { id: 'roster-2', name: '黑岩' },
  ],
};

const draft = {
  canCommit: false,
  summary: [{ id: 'score-1', name: '十二', score: 8, evidenceIds: ['i0-m0-p0'] }],
  evidence: [
    {
      id: 'i0-m0-p0', imageIndex: 0, nickname: '十二', rank: 1,
      score: 8, slot: 0, memberId: 'roster-1', memberName: '十二', scoreMemberId: 'score-1',
    },
    { id: 'i0-m0-p1', imageIndex: 0, nickname: '路人', rank: 2 },
    {
      id: 'i1-m0-p0', imageIndex: 1, nickname: '黑岩', rank: 1,
      memberId: 'roster-2', memberName: '黑岩', warning: 'member-limit',
    },
  ],
  issues: [{ evidenceId: 'i0-m0-p1', code: 'unmatched' }],
};

describe('RecognitionEvidence', () => {
  it('shows member totals first and keeps normal evidence collapsed', async () => {
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={draft}
        busy={false}
        onReview={vi.fn()}
      />,
    );

    const summary = within(screen.getByRole('region', { name: '人物积分汇总' }));
    expect(summary.getByText('十二'))
      .toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: '查看十二的依据' });
    expect(toggle).toHaveTextContent('+8 分');
    expect(screen.queryByText('名次 1')).not.toBeVisible();

    await userEvent.click(toggle);

    expect(screen.getByText('名次 1')).toBeVisible();
    expect(summary.getByRole('link', { name: '查看截图 1' }))
      .toHaveAttribute('href', '/api/admin/score-recognition/batches/b1/images/0');
  });

  it('keeps exceptions visible and sends deliberate corrections', async () => {
    const onReview = vi.fn();
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={draft}
        busy={false}
        onReview={onReview}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('未匹配昵称 路人 对应成员'), 'roster-1');
    expect(onReview).toHaveBeenCalledWith({
      evidenceId: 'i0-m0-p1', memberId: 'roster-1', ignored: false,
    });

    const rankInput = screen.getByLabelText('路人名次');
    await userEvent.clear(rankInput);
    expect(onReview).toHaveBeenCalledTimes(1);
    await userEvent.type(rankInput, '3');
    expect(onReview).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    expect(onReview).toHaveBeenCalledWith({ evidenceId: 'i0-m0-p1', rank: 3 });

    await userEvent.click(screen.getByRole('button', { name: '标记路人为非车队成员' }));
    expect(onReview).toHaveBeenCalledWith({ evidenceId: 'i0-m0-p1', ignored: true });
  });

  it('renders the three-game limit as a warning, not an error', () => {
    const { container } = render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={draft}
        busy={false}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText(/黑岩 已达当天三局上限/)).toBeInTheDocument();
    expect(container.querySelector('.recognition-warning')).toBeInTheDocument();
    expect(container.querySelector('.recognition-warning')).not.toHaveClass('recognition-issue');
  });

  it('shows a non-blocking warning when ranks are not contiguous', () => {
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={{
          ...draft,
          issues: [],
          raceWarnings: [{ imageIndex: 0, matchIndex: 0, missingRanks: [4], maxRank: 6 }],
        }}
        busy={false}
        onReview={vi.fn()}
      />,
    );

    const warningRegion = screen.getByRole('region', { name: '疑似漏行提示' });
    expect(within(warningRegion).getByText(/名次不连续，疑似漏行/)).toBeInTheDocument();
    expect(within(warningRegion).getByText(/缺少第 4 名/)).toBeInTheDocument();
    expect(within(warningRegion).getByRole('link', { name: '查看截图 1' }))
      .toHaveAttribute('href', '/api/admin/score-recognition/batches/b1/images/0');
  });

});