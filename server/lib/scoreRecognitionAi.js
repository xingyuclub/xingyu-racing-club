import { prepareRecognitionImage } from './scoreRecognitionImage.js';

function validateMatch(match, index) {
  const path = `matches[${index}]`;
  if (!match || typeof match !== 'object') throw new Error(`${path} must be an object`);
  if (!Array.isArray(match.participants) || match.participants.length === 0) {
    throw new Error(`${path}.participants must be a non-empty array`);
  }
  const seenRanks = new Set();
  match.participants.forEach((participant, pIndex) => {
    const pPath = `${path}.participants[${pIndex}]`;
    if (!participant || typeof participant !== 'object') throw new Error(`${pPath} must be an object`);
    if (typeof participant.nickname !== 'string' || participant.nickname.trim() === '') {
      throw new Error(`${pPath}.nickname must be a non-empty string`);
    }
    if (!Number.isInteger(participant.rank) || participant.rank < 1) {
      throw new Error(`${pPath}.rank must be a positive integer`);
    }
    if (seenRanks.has(participant.rank)) {
      throw new Error(`${pPath}.rank ${participant.rank} is duplicated within ${path}`);
    }
    seenRanks.add(participant.rank);
  });
}

const PROMPT = [
  '你是一个赛车游戏截图解析助手。只读取截图中可见的玩家昵称和游戏名次。',
  '返回严格的 JSON：{ "matches": [ { "participants": [ { "nickname": string, "rank": number } ] } ] }。',
  '结算详情截图只有一场比赛，每个排名行都是该场比赛的一名参与者，绝不能把排名行拆成比赛。',
  '结算详情即使按“胜利”和“失败”分成两个队伍区域，也仍是同一场比赛，必须把两区参与者合并到一个 match。',
  '最近比赛列表截图才按比赛卡片拆成多场，每张卡片是一场比赛。',
  '名次是从 1 开始的整数。除玩家昵称和游戏名次之外的其他信息一律忽略；无法确认昵称的行直接忽略，不要输出空参与者或空比赛。',
  '不计算积分，不要根据成员名单猜测昵称。',
  '只输出 JSON，不要解释文字。',
].join('\n');

const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'score_matches',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['matches'],
      properties: {
        matches: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['participants'],
            properties: {
              participants: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['nickname', 'rank'],
                  properties: {
                    nickname: { type: 'string', minLength: 1 },
                    rank: { type: 'integer', minimum: 1 },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export function createScoreRecognitionAi({
  client,
  model = 'gpt-4o',
  imageProcessor = prepareRecognitionImage,
}) {
  async function extractMatches({ imageBytes, mimeType }) {
    const prepared = await imageProcessor({ imageBytes, mimeType });
    const dataUrl = `data:${prepared.mimeType};base64,${Buffer.from(prepared.imageBytes).toString('base64')}`;

    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: RESPONSE_FORMAT,
      messages: [
        { role: 'system', content: PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: '解析这张比赛截图。' },
          ],
        },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('AI 未返回文本内容');

    const jsonContent = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      throw new Error('AI 返回的内容不是合法 JSON');
    }

    if (!parsed || !Array.isArray(parsed.matches)) {
      throw new Error('AI 返回缺少 matches 数组');
    }

    parsed.matches.forEach((match, index) => validateMatch(match, index));
    return parsed.matches;
  }

  return { extractMatches };
}
