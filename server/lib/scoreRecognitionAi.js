const isValidDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

function validateMatch(match, index) {
  const path = `matches[${index}]`;
  if (!match || typeof match !== 'object') throw new Error(`${path} must be an object`);
  if (typeof match.title !== 'string') throw new Error(`${path}.title must be a string`);
  if (!isValidDateKey(match.date)) throw new Error(`${path}.date must be a valid YYYY-MM-DD date`);
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
      throw new Error(`${pPath}.rank ${participant.rank} is duplicated within ${match.title || path}`);
    }
    seenRanks.add(participant.rank);
  });
}

const PROMPT = [
  '你是一个赛车游戏截图解析助手。只提取截图中可见的事实，不计算积分，不猜测未知成员。',
  '返回严格的 JSON：{ "matches": [ { "title": string, "date": "YYYY-MM-DD", "time": "HH:MM:SS", "participants": [ { "nickname": string, "rank": number } ] } ] }。',
  '列表截图按从上到下拆成多场。名次是游戏结算显示的整数名次，从 1 开始。',
  '只输出 JSON，不要解释文字。',
].join('\n');

export function createScoreRecognitionAi({ client, model = 'gpt-4o', clock = Date }) {
  async function extractMatches({ imageBytes, mimeType, rosterHints = [] }) {
    const dataUrl = `data:${mimeType};base64,${Buffer.from(imageBytes).toString('base64')}`;
    const hintText = rosterHints.length
      ? `\n当前车队成员昵称参考（仅供识别，不代表截图中一定出现）：${rosterHints.join('、')}`
      : '';

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: PROMPT + hintText },
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

    let parsed;
    try {
      parsed = JSON.parse(content);
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
