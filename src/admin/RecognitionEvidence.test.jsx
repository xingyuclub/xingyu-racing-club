import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecognitionEvidence } from './RecognitionEvidence.jsx';

const config = {
  roster: [
    { id: 'roster-1', name: '十二', scoreMemberId: 'score-1' },
    { id: 'roster-2', name: '黑岩', scoreMemberId: 'score-2' },
  ],
  scoreMembers: [
    { id: 'score-1', name: '十二' },
    { id: 'score-2', name: '黑岩' },
    { id: 'score-3', name: '赴约·太困' },
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

    expect(screen.getByRole('option', { name: '赴约·太困' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('未匹配昵称 路人 对应成员'), 'score-3');
    expect(onReview).toHaveBeenCalledWith({
      evidenceId: 'i0-m0-p1', scoreMemberId: 'score-3', ignored: false,
    });

    const rankInput = screen.getByLabelText('路人名次');
    await userEvent.clear(rankInput);
    expect(onReview).toHaveBeenCalledTimes(1);
    await userEvent.type(rankInput, '3');
    expect(onReview).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    expect(onReview).toHaveBeenCalledWith({ evidenceId: 'i0-m0-p1', rank: 3 });

    await userEvent.click(screen.getByRole('button', { name: '标记路人为非积分成员' }));
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

  it('shows an unmatched nickname with the score identity selector', () => {
    render(
      <RecognitionEvidence
        batchId="b1"
        config={{
          ...config,
          roster: [{ id: 'roster-1', name: '十二', scoreMemberId: '' }],
        }}
        draft={{
          ...draft,
          summary: [],
          evidence: [{
            id: 'i0-m0-p0', imageIndex: 0, matchIndex: 0,
            nickname: '十二', rank: 1, memberId: 'roster-1', memberName: '十二',
          }],
          issues: [{ evidenceId: 'i0-m0-p0', code: 'unmatched' }],
        }}
        busy={false}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText('未匹配成员')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '赴约·太困' })).toBeInTheDocument();
  });

  it('asks the reviewer to resolve a suspected duplicate image', async () => {
    const onReview = vi.fn();
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={{
          ...draft,
          issues: [{
            code: 'suspected-duplicate-image', imageIndex: 2, duplicateOfImageIndex: 0,
          }],
          suspectedDuplicateImageCount: 1,
          duplicateImageCount: 0,
        }}
        busy={false}
        onReview={onReview}
      />,
    );

    expect(screen.getByText(/发现 1 张疑似重复图片/)).toBeInTheDocument();
    const issues = within(screen.getByRole('region', { name: '待处理识别项' }));
    expect(issues.getByRole('link', { name: '查看截图 3' })).toBeInTheDocument();
    expect(issues.getByRole('link', { name: '查看截图 1' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '确认是重复图片' }));
    expect(onReview).toHaveBeenCalledWith({ imageIndex: 2, duplicate: true });
  });

  it('reprocesses only the warning image and allows a manual participant', async () => {
    const onReprocessImage = vi.fn();
    const onAddManual = vi.fn();
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
        onReprocessImage={onReprocessImage}
        onAddManual={onAddManual}
      />,
    );

    const warningRegion = screen.getByRole('region', { name: '疑似漏行提示' });
    expect(within(warningRegion).getByText(/名次不连续，疑似漏行/)).toBeInTheDocument();
    expect(within(warningRegion).getByText(/缺少第 4 名/)).toBeInTheDocument();
    expect(within(warningRegion).getByText(/可以只重识别这张截图.*人工补录/)).toBeInTheDocument();
    expect(within(warningRegion).getByRole('link', { name: '查看截图 1' }))
      .toHaveAttribute('href', '/api/admin/score-recognition/batches/b1/images/0');
    await userEvent.click(within(warningRegion).getByRole('button', { name: '重新识别截图 1' }));
    expect(onReprocessImage).toHaveBeenCalledWith(0);

    await userEvent.type(within(warningRegion).getByLabelText('截图 1 补录昵称'), '赴约·太困');
    await userEvent.clear(within(warningRegion).getByLabelText('截图 1 补录名次'));
    await userEvent.type(within(warningRegion).getByLabelText('截图 1 补录名次'), '4');
    await userEvent.selectOptions(
      within(warningRegion).getByLabelText('截图 1 补录积分人物'),
      'score-3',
    );
    await userEvent.click(within(warningRegion).getByRole('button', { name: '添加人工记录' }));
    expect(onAddManual).toHaveBeenCalledWith({
      imageIndex: 0,
      matchIndex: 0,
      nickname: '赴约·太困',
      rank: 4,
      scoreMemberId: 'score-3',
    });
  });

  it('shows manual entries with a delete action', async () => {
    const onRemoveManual = vi.fn();
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={{
          ...draft,
          issues: [],
          raceWarnings: [],
          evidence: [{
            id: 'manual-manual-1', manual: true, manualEntryId: 'manual-1',
            imageIndex: 0, matchIndex: 0, nickname: '路人', rank: 2, ignored: true,
          }],
          summary: [],
        }}
        busy={false}
        onReview={vi.fn()}
        onRemoveManual={onRemoveManual}
      />,
    );

    const manualRegion = screen.getByRole('region', { name: '人工补录记录' });
    expect(within(manualRegion).getByText(/第 2 名 路人/)).toBeInTheDocument();
    await userEvent.click(within(manualRegion).getByRole('button', { name: '删除人工记录 路人' }));
    expect(onRemoveManual).toHaveBeenCalledWith('manual-1');
  });

  it('asks the reviewer to resolve a suspected duplicate and sends the verdict', async () => {
    const onReview = vi.fn();
    const dupDraft = {
      canCommit: false,
      summary: [{ id: 'score-1', name: '十二', score: 8, evidenceIds: ['i0-m0-p0', 'i1-m0-p0'] }],
      evidence: [
        { id: 'i0-m0-p0', imageIndex: 0, matchIndex: 0, nickname: '十二', rank: 1, score: 4, slot: 0, memberId: 'roster-1', memberName: '十二' },
        { id: 'i0-m0-p1', imageIndex: 0, matchIndex: 0, nickname: '黑岩', rank: 2, score: 1, slot: 0, memberId: 'roster-2', memberName: '黑岩' },
        { id: 'i1-m0-p0', imageIndex: 1, matchIndex: 0, nickname: '十二', rank: 1, score: 4, slot: 1, memberId: 'roster-1', memberName: '十二' },
        { id: 'i1-m0-p1', imageIndex: 1, matchIndex: 0, nickname: '黑岩', rank: 2, score: 1, slot: 1, memberId: 'roster-2', memberName: '黑岩' },
      ],
      issues: [{
        evidenceId: 'i1-m0-p0', code: 'suspected-duplicate',
        imageIndex: 1, matchIndex: 0, duplicateOf: { imageIndex: 0, matchIndex: 0 },
      }],
      suspectedDuplicateCount: 1,
      duplicateCount: 0,
    };
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={dupDraft}
        busy={false}
        onReview={onReview}
      />,
    );

    expect(screen.getByText(/发现 1 场与同批其他截图人员、名次完全一致且缺少数值列的比赛/))
      .toBeInTheDocument();
    expect(screen.getByText('人员和名次完全一致，疑似重复场次')).toBeInTheDocument();
    expect(screen.getAllByText('第 1 名 十二')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: '确认是重复场次（跳过本场）' }));
    expect(onReview).toHaveBeenCalledWith({ evidenceId: 'i1-m0-p0', duplicate: true });

    await userEvent.click(screen.getByRole('button', { name: '这是不同场次（两场都保留）' }));
    expect(onReview).toHaveBeenCalledWith({ evidenceId: 'i1-m0-p0', notDuplicate: true });
  });

  it('shows the confirmed-duplicate skip note separately', () => {
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={{ ...draft, duplicateCount: 2, suspectedDuplicateCount: 0 }}
        busy={false}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText('已跳过 2 场重复比赛（内容完全一致）。')).toBeInTheDocument();
  });

  it('notes same-roster races with different numbers that were kept automatically', () => {
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={{ ...draft, autoDistinctCount: 2 }}
        busy={false}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText('有 2 场人员与名次相同但数值不同的比赛，已按不同场次自动保留。'))
      .toBeInTheDocument();
  });

  it('shows the map name on evidence rows and in the issue editor', () => {
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={{
          ...draft,
          evidence: [
            {
              id: 'i0-m0-p0', imageIndex: 0, matchIndex: 0, mapName: '香波岛',
              nickname: '十二', rank: 1, score: 8, slot: 0,
              memberId: 'roster-1', memberName: '十二',
            },
            {
              id: 'i0-m0-p1', imageIndex: 0, matchIndex: 0, mapName: '香波岛',
              nickname: '路人', rank: 2,
            },
          ],
          issues: [{ evidenceId: 'i0-m0-p1', code: 'unmatched' }],
        }}
        busy={false}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText('地图 香波岛')).toBeInTheDocument();
    const editor = screen.getByRole('region', { name: '待处理识别项' });
    expect(within(editor).getByDisplayValue('香波岛')).toBeInTheDocument();
  });

  it('notes suspected images released automatically when their maps differ', () => {
    render(
      <RecognitionEvidence
        batchId="b1"
        config={config}
        draft={{ ...draft, autoDistinctImageCount: 1 }}
        busy={false}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText('有 1 张疑似重复图片的地图不同，已按不同比赛自动放行。'))
      .toBeInTheDocument();
  });

});
