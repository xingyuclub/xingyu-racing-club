import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSiteConfig } from './useSiteConfig.js';

const initialConfig = { version: 1, team: { name: 'v1' } };
const updatedConfig = { version: 2, team: { name: 'v2' } };

function createEventSourceMock() {
  const instances = [];
  class MockEventSource {
    constructor(url) {
      this.url = url;
      this.listeners = {};
      this.readyState = 0;
      instances.push(this);
    }
    addEventListener(event, handler) {
      (this.listeners[event] = this.listeners[event] || []).push(handler);
    }
    removeEventListener(event, handler) {
      this.listeners[event] = (this.listeners[event] || []).filter((h) => h !== handler);
    }
    emit(event, data) {
      (this.listeners[event] || []).forEach((handler) =>
        handler({ data: typeof data === 'string' ? data : JSON.stringify(data) }),
      );
    }
    close() { this.readyState = 2; this.closed = true; }
  }
  return { MockEventSource, instances };
}

let fetchMock;
let esMock;

beforeEach(() => {
  esMock = createEventSourceMock();
  vi.stubGlobal('EventSource', esMock.MockEventSource);
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => initialConfig });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('reloads the config when a config-updated SSE event fires', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialConfig });

  const { result } = renderHook(() => useSiteConfig(initialConfig));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(result.current).toEqual(initialConfig);

  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => updatedConfig });
  esMock.instances[0].emit('config-updated', { version: '2' });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current).toEqual(updatedConfig));
});

it('keeps the existing config and still responds to focus if EventSource errors', async () => {
  const { result } = renderHook(() => useSiteConfig(initialConfig));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

  // Simulate an EventSource error callback
  esMock.instances[0].emit('error');

  // Config is unchanged after the error
  expect(result.current).toEqual(initialConfig);

  // focus still triggers a reload
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => updatedConfig });
  window.dispatchEvent(new Event('focus'));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current).toEqual(updatedConfig));
});

it('closes the EventSource connection on unmount', async () => {
  const { unmount } = renderHook(() => useSiteConfig(initialConfig));
  await waitFor(() => expect(esMock.instances).toHaveLength(1));

  unmount();
  expect(esMock.instances[0].closed).toBe(true);
});
