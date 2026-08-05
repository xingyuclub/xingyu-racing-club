import { describe, expect, it, vi } from 'vitest';
import { createScoreRecognitionAi } from './scoreRecognitionAi.js';

const validPayload = {
  matches: [
    {
      participants: [{ nickname: '十二', rank: 2 }, { nickname: '黑岩', rank: 4 }],
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

const createAi = (client, options = {}) => createScoreRecognitionAi({
  client,
  imageProcessor: async ({ imageBytes, mimeType }) => ({ imageBytes, mimeType }),
  ...options,
});

describe('score recognition AI adapter', () => {
  it('extracts structured matches from the model response', async () => {
    const client = createFakeClient(validPayload);
    const ai = createAi(client, { model: 'gpt-4o' });

    const result = await ai.extractMatches({
      imageBytes: Buffer.from([0xff, 0xd8, 0xff]),
      mimeType: 'image/jpeg',
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

  it('accepts JSON wrapped in a markdown code fence', async () => {
    const client = {
      chat: { completions: { create: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '```json\n' + JSON.stringify(validPayload) + '\n```' } }],
      }) } },
    };
    const ai = createAi(client);

    await expect(ai.extractMatches({
      imageBytes: Buffer.from([]),
      mimeType: 'image/jpeg',
    })).resolves.toEqual(validPayload.matches);
  });

  it('constrains local vision models to the supported screenshot structures', async () => {
    const client = createFakeClient(validPayload);
    const ai = createAi(client);

    await ai.extractMatches({
      imageBytes: Buffer.from([]),
      mimeType: 'image/jpeg',
      rosterHints: ['十二', '黑岩'],
      batchDate: '2026-08-03',
    });

    const request = client.chat.completions.create.mock.calls[0][0];
    expect(request.messages[0].content).toContain('结算详情截图只有一场比赛');
    expect(request.messages[0].content).toContain('按“胜利”和“失败”分成两个队伍区域');
    expect(request.messages[0].content).toContain('最近比赛列表截图才按比赛卡片拆成多场');
    expect(request.messages[0].content).toContain('必须列出截图中每一个排名行，一行都不能漏');
    expect(request.messages[0].content).toContain('连续递增，绝不能跳过名次');
    expect(request.messages[0].content).toContain('绝不能把其他列的数字当作名次');
    expect(request.messages[0].content).toContain('原样抄写整行，不要删减');
    expect(request.messages[0].content).toContain('score 是 MVP分列');
    expect(request.messages[0].content).not.toMatch(/日期|胜负|地图/);
    expect(request.messages[0].content).not.toContain('十二、黑岩');
    expect(request.temperature).toBe(0);
    const schema = request.response_format.json_schema.schema;
    const matchSchema = schema.properties.matches.items;
    expect(request.response_format.type).toBe('json_schema');
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(schema.required).toEqual(['matches']);
    expect(schema.additionalProperties).toBe(false);
    expect(matchSchema.required).toEqual(['participants']);
    expect(matchSchema.additionalProperties).toBe(false);
    expect(Object.keys(matchSchema.properties)).toEqual(['participants']);
    expect(Object.keys(matchSchema.properties.participants.items.properties)).toEqual([
      'nickname', 'rank', 'score', 'attack', 'defense', 'assist',
    ]);
    expect(matchSchema.properties.participants.items.required).toEqual(['nickname', 'rank']);
  });

  it('asks for every match in the image when multiMatch is enabled', async () => {
    const client = createFakeClient(validPayload);
    const ai = createAi(client);

    await ai.extractMatches({
      imageBytes: Buffer.from([]),
      mimeType: 'image/jpeg',
      multiMatch: true,
    });

    const request = client.chat.completions.create.mock.calls[0][0];
    expect(request.messages[0].content).toContain('这张截图可能包含多场比赛');
    expect(request.messages[0].content).toContain('逐场提取为一个 match');
    expect(request.messages[0].content).toContain('若确认截图里只有一场比赛，则只输出一个 match');
    expect(request.messages[0].content).not.toContain('结算详情截图只有一场比赛');
  });

  it('sends the prepared image to the model', async () => {
    const client = createFakeClient(validPayload);
    const imageProcessor = vi.fn().mockResolvedValue({
      imageBytes: Buffer.from('prepared'),
      mimeType: 'image/webp',
    });
    const ai = createScoreRecognitionAi({ client, imageProcessor });

    await ai.extractMatches({
      imageBytes: Buffer.from('source'),
      mimeType: 'image/png',
    });

    expect(imageProcessor).toHaveBeenCalledWith({
      imageBytes: Buffer.from('source'),
      mimeType: 'image/png',
    });
    const request = client.chat.completions.create.mock.calls[0][0];
    expect(request.messages[1].content[0].image_url.url)
      .toBe(`data:image/webp;base64,${Buffer.from('prepared').toString('base64')}`);
  });

  it('rejects a response without a matches array', async () => {
    const client = createFakeClient({ data: [] });
    const ai = createAi(client);
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/matches/);
  });

  it('rejects duplicate ranks within a single match', async () => {
    const client = createFakeClient({
      matches: [{
        participants: [{ nickname: 'A', rank: 1 }, { nickname: 'B', rank: 1 }],
      }],
    });
    const ai = createAi(client);
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/rank/);
  });

  it('rejects a non-integer numeric column value', async () => {
    const client = createFakeClient({
      matches: [{
        participants: [{ nickname: 'A', rank: 1, score: 1.5 }],
      }],
    });
    const ai = createAi(client);
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/score/);
  });

  it('accepts optional numeric columns when present', async () => {
    const client = createFakeClient({
      matches: [{
        participants: [{ nickname: 'A', rank: 1, score: 15, attack: 12, defense: 0, assist: 3 }],
      }],
    });
    const ai = createAi(client);
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .resolves.toEqual([{
        participants: [{ nickname: 'A', rank: 1, score: 15, attack: 12, defense: 0, assist: 3 }],
      }]);
  });

  it('rejects negative ranks', async () => {
    const client = createFakeClient({
      matches: [{
        participants: [{ nickname: 'A', rank: -1 }],
      }],
    });
    const ai = createAi(client);
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/rank/);
  });

  it('rejects empty nicknames', async () => {
    const client = createFakeClient({
      matches: [{
        participants: [{ nickname: '  ', rank: 1 }],
      }],
    });
    const ai = createAi(client);
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/nickname/);
  });

  it('rejects a non-JSON model response', async () => {
    const client = {
      chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'not json' } }] }) } },
    };
    const ai = createAi(client);
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow(/JSON/);
  });

  it('surfaces a model call failure as a displayable error', async () => {
    const client = {
      chat: { completions: { create: vi.fn().mockRejectedValue(new Error('rate limited')) } },
    };
    const ai = createAi(client);
    await expect(ai.extractMatches({ imageBytes: Buffer.from([]), mimeType: 'image/jpeg' }))
      .rejects.toThrow('rate limited');
  });
});
