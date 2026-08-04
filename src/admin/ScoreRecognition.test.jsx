import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ScoreRecognition } from './ScoreRecognition.jsx';
import { reviewRecognitionEvidence } from './adminApi.js';

afterEach(() => vi.unstubAllGlobals());

const validDraft = {
  races: [{
    type: 'team',
    title: '队内赛',
    date: '2026-08-01',
    time: '10:00:00',
    members: [{ id: '1', nickname: '稳稳', rank: 1, score: 4, slot: 0 }],
    unmatched: [],
  }],
  rosterVersion: 'roster-v1',
  batchDate: '2026-08-01',
};

it('uploads screenshots and processes them into a preview', async () => {
  const onCommitted = vi.fn();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'batch-1', status: 'uploaded', date: '2026-08-01', images: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => validDraft });
  vi.stubGlobal('fetch', fetchMock);

  render(<ScoreRecognition onCommitted={onCommitted} />);
  expect(screen.getByRole('radio', { name: '队内赛' })).toBeChecked();
  await userEvent.click(screen.getByRole('radio', { name: '排位赛' }));

  const dateInput = screen.getByLabelText('批次日期');
  await userEvent.clear(dateInput);
  await userEvent.type(dateInput, '2026-08-01');

  const file = new File(['img'], 'shot.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('上传截图'), file);

  await waitFor(() => expect(screen.getByText('提交确认')).toBeInTheDocument());
  expect(screen.getAllByText('队内赛').length).toBeGreaterThan(0);
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
  render(<ScoreRecognition onCommitted={onCommitted} />);

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

  render(<ScoreRecognition />);
  const file = new File(['img'], 'shot.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('上传截图'), file);

  await waitFor(() => expect(screen.getByText(/无效日期/)).toBeInTheDocument());
});

it('disables submit while processing', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'batch-1', status: 'uploaded', date: '2026-08-01', images: [] }) })
    .mockImplementationOnce(() => new Promise(() => {})));

  render(<ScoreRecognition />);
  await userEvent.type(screen.getByLabelText('批次日期'), '2026-08-01');
  await userEvent.upload(screen.getByLabelText('上传截图'), new File(['img'], 'shot.jpg', { type: 'image/jpeg' }));

  await waitFor(() => expect(screen.getByText('识别中…')).toBeInTheDocument());
});
