import { describe, expect, it, vi } from 'vitest';

const OpenAI = vi.fn(function FakeOpenAI(options) {
  this.options = options;
});

vi.mock('openai', () => ({ default: OpenAI }));

const { createOpenAiClient } = await import('./openaiClient.js');

describe('createOpenAiClient', () => {
  it('passes a configured base URL to the OpenAI-compatible client', () => {
    createOpenAiClient({ apiKey: 'ollama', baseURL: 'http://127.0.0.1:11434/v1' });

    expect(OpenAI).toHaveBeenLastCalledWith({
      apiKey: 'ollama',
      baseURL: 'http://127.0.0.1:11434/v1',
    });
  });

  it('omits base URL when it is not configured', () => {
    createOpenAiClient({ apiKey: 'test-key' });

    expect(OpenAI).toHaveBeenLastCalledWith({ apiKey: 'test-key' });
  });
});
