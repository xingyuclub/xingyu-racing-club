import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { RecognitionHistory } from './RecognitionHistory.jsx';

afterEach(() => vi.unstubAllGlobals());

it('loads and lists recognition batches with status labels', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ([
      { id: 'batch-1', status: 'committed', date: '2026-08-01', images: [{}, {}], createdAt: '2026-08-01T10:00:00Z', committedAt: '2026-08-01T10:05:00Z' },
      { id: 'batch-2', status: 'failed', date: '2026-08-02', images: [{}], createdAt: '2026-08-02T10:00:00Z' },
    ]),
  }));

  render(<RecognitionHistory />);

  const items = await screen.findAllByTestId('recognition-history-item');
  expect(items).toHaveLength(2);
  expect(within(items[0]).getByText('已提交')).toBeInTheDocument();
  expect(within(items[1]).getByText('失败')).toBeInTheDocument();
  // Retry button only on the failed batch
  expect(within(items[1]).getByRole('button', { name: /重试批次/ })).toBeInTheDocument();
  expect(within(items[0]).queryByRole('button', { name: /重试批次/ })).not.toBeInTheDocument();
});

it('retries a failed batch and reloads the list', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'batch-x', status: 'failed', date: '2026-08-02', images: [], createdAt: '2026-08-02T10:00:00Z' }]) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'batch-x', status: 'uploaded' }) }) // retry response
    .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'batch-x', status: 'uploaded', date: '2026-08-02', images: [], createdAt: '2026-08-02T10:00:00Z' }]) });
  vi.stubGlobal('fetch', fetchMock);

  render(<RecognitionHistory />);

  const retryButton = await screen.findByRole('button', { name: /重试批次/ });
  await userEvent.click(retryButton);

  await waitFor(() => expect(screen.getByText('待处理')).toBeInTheDocument());
  // Three fetches: initial list, retry POST, reload list
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[1][0]).toContain('/retry');
});

it('shows an empty state when there are no batches', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

  render(<RecognitionHistory />);

  expect(await screen.findByText('暂无识别记录。')).toBeInTheDocument();
});

it('shows an error message when the list fails to load', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '未登录' }) }));

  render(<RecognitionHistory />);

  expect(await screen.findByText('未登录')).toBeInTheDocument();
});