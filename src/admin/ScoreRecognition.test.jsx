import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ScoreRecognition } from './ScoreRecognition.jsx';
import { reviewRecognitionEvidence } from './adminApi.js';

afterEach(() => vi.unstubAllGlobals());

const validDraft = {
  canCommit: true,
  summary: [{ id: '1', name: '稳稳', score: 4, evidenceIds: ['i0-m0-p0'] }],
  evidence: [{
    id: 'i0-m0-p0', imageIndex: 0, nickname: '稳稳', rank: 1,
    score: 4, slot: 0, memberId: '1', memberName: '稳稳', scoreMemberId: '1',
  }],
  issues: [],
  rosterVersion: 'roster-v1',
  batchDate: '2026-08-01',
};

const config = { roster: [{ id: '1', name: '稳稳' }] };

it('uploads screenshots and processes them into a preview', async () => {
  const onCommitted = vi.fn();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'batch-1', status: 'uploaded', date: '2026-08-01', images: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => validDraft });
  vi.stubGlobal('fetch', fetchMock);

  render(<ScoreRecognition config={config} onCommitted={onCommitted} />);
  expect(screen.getByRole('radio', { name: '队内赛' })).toBeChecked();
  await userEvent.click(screen.getByRole('radio', { name: '排位赛' }));

  const dateInput = screen.getByLabelText('批次日期');
  await userEvent.clear(dateInput);
  await userEvent.type(dateInput, '2026-08-01');

  const file = new File(['img'], 'shot.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('上传截图'), file);

  await waitFor(() => expect(screen.getByText('提交确认')).toBeInTheDocument());
  expect(screen.getByText('稳稳')).toBeInTheDocument();
  const uploadBody = fetchMock.mock.calls[0][1].body;
  expect(uploadBody.get('raceType')).toBe('ranked');
});

it('returns the committed server config to the editor', async () => {
  const onCommitted = vi.fn();
  const nextConfig = { roster: [], scoreMembers: [], dailyScores: [] };
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'batch-1' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => validDraft })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ committed: true, config: nextConfig }) }));
  render(<ScoreRecognition config={config} onCommitted={onCommitted} />);

  await userEvent.upload(
    screen.getByLabelText('上传截图'),
    new File(['img'], 'shot.jpg', { type: 'image/jpeg' }),
  );
  await userEvent.click(await screen.findByRole('button', { name: /提交确认/ }));

  await waitFor(() => expect(onCommitted).toHaveBeenCalledWith(nextConfig));
});

it('sends evidence reviews as JSON', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ canCommit: true }) });
  vi.stubGlobal('fetch', fetchMock);

  await reviewRecognitionEvidence('batch/1', { evidenceId: 'i0-m0-p0', ignored: true });

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/admin/score-recognition/batches/batch%2F1/review',
    expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidenceId: 'i0-m0-p0', ignored: true }),
    }),
  );
});

it('shows an error when upload fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '无效日期' }) }));

  render(<ScoreRecognition config={config} />);
  const file = new File(['img'], 'shot.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('上传截图'), file);

  await waitFor(() => expect(screen.getByText(/无效日期/)).toBeInTheDocument());
});

it('disables submit while processing', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'batch-1', status: 'uploaded', date: '2026-08-01', images: [] }) })
    .mockImplementationOnce(() => new Promise(() => {})));

  render(<ScoreRecognition config={config} />);
  await userEvent.type(screen.getByLabelText('批次日期'), '2026-08-01');
  await userEvent.upload(screen.getByLabelText('上传截图'), new File(['img'], 'shot.jpg', { type: 'image/jpeg' }));

  await waitFor(() => expect(screen.getByText('识别中…')).toBeInTheDocument());
});

it('disables commit while unresolved issues remain', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'batch-1' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      ...validDraft,
      canCommit: false,
      issues: [{ evidenceId: 'i0-m0-p0', code: 'unmatched' }],
      summary: [],
      evidence: [{ id: 'i0-m0-p0', imageIndex: 0, nickname: '路人', rank: 1 }],
    }) }));
  render(<ScoreRecognition config={config} />);
  await userEvent.upload(
    screen.getByLabelText('上传截图'),
    new File(['img'], 'shot.jpg', { type: 'image/jpeg' }),
  );

  expect(await screen.findByRole('button', { name: /提交确认/ })).toBeDisabled();
  expect(screen.getByLabelText('未匹配昵称 路人 对应成员')).toBeVisible();
});
