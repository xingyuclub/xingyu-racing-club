import { describe, expect, it, vi } from 'vitest';
import { createScoreRecognitionAi } from './scoreRecognitionAi.js';

const validPayload = {
  matches: [
    {
      title: '排位赛·组队道具',
      date: '2026-07-27',
      time: '16:50:53',
      participants: [{ nickname: '稳稳', rank: 1 }, { nickname: '闪电', rank: 2 }],
    },
  ],
};

const createFakeClient = (content) => ({
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(content) } }],
      }),
    },
  },
});

describe('score recognition AI adapter', () => {
  it('extracts structured matches from the model response', async () => {
    const client = createFakeClient(validPayload);
    const ai = createScoreRecognitionAi({ client, model: 'gpt-4o' });

    const result = await ai.extractMatches({
      imageBytes: Buffer.from([0xff, 0xd8, 0xff]),
      mimeType: 'image/jpeg',
      rosterHints: ['稳稳', '闪电'],
    });

    expect(result).toEqual(validPayload.matches);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    const call = client.chat.completions.create.mock.calls[0][0];
    expect(call.model).toBe('gpt-4o');
    expect(call.messages).toHaveLength(2);
    expect(call.messages[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'image_url' }),
        expect.objectContaining({ type: 'text' }),
      ]),
    );
  });

  it('rejects a response without a matches array', async () => {
    const client = createFakeClient({ data: [] });
    const ai = createScoreRecognitionAi({ client });
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/matches/);
  });

  it('rejects duplicate ranks within a single match', async () => {
    const client = createFakeClient({
      matches: [{
        title: '队内赛',
        date: '2026-07-27',
        time: '10:00:00',
        participants: [{ nickname: 'A', rank: 1 }, { nickname: 'B', rank: 1 }],
      }],
    });
    const ai = createScoreRecognitionAi({ client });
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/rank/);
  });

  it('rejects negative ranks', async () => {
    const client = createFakeClient({
      matches: [{
        title: '队内赛',
        date: '2026-07-27',
        time: '10:00:00',
        participants: [{ nickname: 'A', rank: -1 }],
      }],
    });
    const ai = createScoreRecognitionAi({ client });
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/rank/);
  });

  it('rejects empty nicknames', async () => {
    const client = createFakeClient({
      matches: [{
        title: '队内赛',
        date: '2026-07-27',
        time: '10:00:00',
        participants: [{ nickname: '  ', rank: 1 }],
      }],
    });
    const ai = createScoreRecognitionAi({ client });
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/nickname/);
  });

  it('rejects invalid dates', async () => {
    const client = createFakeClient({
      matches: [{
        title: '队内赛',
        date: '2026-13-99',
        time: '10:00:00',
        participants: [{ nickname: 'A', rank: 1 }],
      }],
    });
    const ai = createScoreRecognitionAi({ client });
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/date/);
  });

  it('rejects a non-JSON model response', async () => {
    const client = {
      chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'not json' } }] }) } },
    };
    const ai = createScoreRecognitionAi({ client });
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/JSON/);
  });

  it('surfaces a model call failure as a displayable error', async () => {
    const client = {
      chat: { completions: { create: vi.fn().mockRejectedValue(new Error('rate limited')) } },
    };
    const ai = createScoreRecognitionAi({ client });
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow('rate limited');
  });
});
