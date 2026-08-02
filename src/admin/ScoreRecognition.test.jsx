import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ScoreRecognition } from './ScoreRecognition.jsx';

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
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'batch-1', status: 'uploaded', date: '2026-08-01', images: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => validDraft }));

  render(<ScoreRecognition onCommitted={onCommitted} />);

  const dateInput = screen.getByLabelText('批次日期');
  await userEvent.clear(dateInput);
  await userEvent.type(dateInput, '2026-08-01');

  const file = new File(['img'], 'shot.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('上传截图'), file);

  await waitFor(() => expect(screen.getByText('提交确认')).toBeInTheDocument());
  expect(screen.getAllByText('队内赛').length).toBeGreaterThan(0);
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
