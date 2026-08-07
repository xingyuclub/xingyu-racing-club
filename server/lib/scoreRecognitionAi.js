import { prepareRecognitionImage } from './scoreRecognitionImage.js';

function validateMatch(match, index) {
  const path = `matches[${index}]`;
  if (!match || typeof match !== 'object') throw new Error(`${path} must be an object`);
  if (match.mapName !== undefined && typeof match.mapName !== 'string') {
    throw new Error(`${path}.mapName must be a string`);
  }
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
    for (const key of ['score', 'attack', 'defense', 'assist']) {
      if (participant[key] !== undefined
        && (!Number.isInteger(participant[key]) || participant[key] < 0)) {
        throw new Error(`${pPath}.${key} must be a non-negative integer`);
      }
    }
  });
}

function buildPrompt({ multiMatch, teamLabels }) {
  const rules = [
    '你是一个赛车游戏结算截图解析助手。只读取截图中可见的玩家昵称、游戏名次和地图名称。',
    '返回严格的 JSON：{ "matches": [ { "participants": [ { "nickname": string, "rank": number } ] } ] }。',
    multiMatch
      ? '这张截图可能包含多场比赛：例如一张图里上下或左右并列两套结算卡片，每套是一场比赛，请逐场提取为一个 match，一场都不能漏；同一场比赛的排名行绝不能拆成多个 match。'
      : '结算详情截图只有一场比赛，每个排名行都是该场比赛的一名参与者，绝不能把排名行拆成比赛。',
    '结算详情即使按“胜利”和“失败”分成两个队伍区域，也仍是同一场比赛，必须把两区参与者合并到一个 match。',
    multiMatch
      ? '若确认截图里只有一场比赛，则只输出一个 match。'
      : '最近比赛列表截图才按比赛卡片拆成多场，每张卡片是一场比赛。',
    '名次是从 1 开始的整数，从上到下必须连续递增，绝不能跳过名次。',
    '必须列出截图中每一个排名行，一行都不能漏：即使某行昵称被遮挡或看不清，也要输出该行，并把昵称写成你确实看到的部分。',
    '每个玩家区域可能有上下两行文字：上方较大的文字是玩家昵称，下方较小且多人重复的文字是车队/俱乐部归属标签。nickname 只能读取上方昵称，绝不能把下方归属标签当作昵称。',
    teamLabels.length > 0
      ? `本车队归属标签包括“${teamLabels.join('”“')}”。它会重复显示在多名玩家昵称下方，绝不能输出为任何 participant 的 nickname；请读取它正上方的真实昵称。`
      : '多人下方重复出现的相同文字不是玩家昵称，必须忽略并读取其正上方的真实昵称。',
    '昵称里的车队前缀（如 xy、xy/、xy2、xyr、xyf、xy♂ 等）和其他符号请原样抄写整行，不要删减。',
    '每场比赛必须抄写结算表标题区显示的地图名称到 mapName（如 香波岛、广寒仙境、洛杉矶）：标题区一定有地图名，严禁输出空字符串，也不能把房间号、模式名或截图底部时间当作地图名。',
    '每行还要按结算表抄写该玩家的数值列：score 是 MVP分列、attack 是攻击列、defense 是防御列、assist 是援助列，都必须是整数；看不清或该列不存在时省略该字段，绝不能把其他列的数字当作名次。',
    '截图底部日期、显示时间和除上述数值列以外的其他列一律忽略。',
    '不计算积分，不要根据成员名单猜测昵称。',
    '只输出 JSON，不要解释文字。',
  ];
  return rules.join('\n');
}

function normalizeTeamLabel(value) {
  return String(value ?? '')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/gi, '')
    .trim()
    .toLowerCase();
}

const TEAM_TAG_PREFIX = /^(?:ˣʸ༩|xy[^·._\-\s]{0,3})\s*[·._-]\s*/i;

function isTeamLabel(value, normalizedTeamLabels) {
  const normalized = normalizeTeamLabel(value).replace(TEAM_TAG_PREFIX, '');
  return normalizedTeamLabels.has(normalized);
}

function stripTrailingTeamLabel(nickname, normalizedTeamLabels) {
  const value = nickname.trim();
  const match = value.match(/^(.*\S)\s+(\S+)$/);
  if (!match || !isTeamLabel(match[2], normalizedTeamLabels)) return value;
  return match[1].trim();
}

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
            required: ['mapName', 'participants'],
            properties: {
              mapName: { type: 'string', minLength: 1 },
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
                    score: { type: 'integer', minimum: 0 },
                    attack: { type: 'integer', minimum: 0 },
                    defense: { type: 'integer', minimum: 0 },
                    assist: { type: 'integer', minimum: 0 },
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
  async function extractMatches({ imageBytes, mimeType, multiMatch = false, teamLabels = [] }) {
    const prepared = await imageProcessor({ imageBytes, mimeType });
    const dataUrl = `data:${prepared.mimeType};base64,${Buffer.from(prepared.imageBytes).toString('base64')}`;

    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: RESPONSE_FORMAT,
      messages: [
        { role: 'system', content: buildPrompt({ multiMatch, teamLabels }) },
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

    const normalizedTeamLabels = new Set(teamLabels.map(normalizeTeamLabel));
    parsed.matches.forEach((match) => {
      match.participants.forEach((participant) => {
        participant.nickname = stripTrailingTeamLabel(
          participant.nickname,
          normalizedTeamLabels,
        );
      });
    });
    parsed.matches.forEach((match, index) => validateMatch(match, index));
    return parsed.matches;
  }

  return { extractMatches };
}
