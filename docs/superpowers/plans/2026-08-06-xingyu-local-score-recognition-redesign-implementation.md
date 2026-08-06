# 星屿积分截图纯本地识别重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用纯本地 Ollama 重建单场比赛截图识别，使页面分类、地图、排名和完赛时间可追溯，成员错配为 0，相同比赛可跨批次去重，不同比赛不再错误合并。

**Architecture:** AI 只提取截图事实；新增纯函数负责事实校验、积分成员匹配和比赛身份，服务层负责 SHA-256 文件去重、异常行局部复核、跨批历史查询、计分与原子提交。正式流程切换前先用真实截图基准集只读评估，旧批次与已提交积分保持不变。

**Tech Stack:** Node.js ESM、Express、Vitest、Sharp、React 19、Testing Library、本机 Ollama HTTP API、现有 JSON 原子存储。

---

## 文件结构与职责

- Create: `server/fixtures/score-recognition-benchmark.json`：真实截图的人工基准清单，只记录批次/图片引用和期望事实，不复制生产图片。
- Create: `scripts/evaluate-score-recognition.js`：只读运行新版管线并输出逐图差异和验收指标，不写批次或积分。
- Create: `server/lib/ollamaVisionClient.js`：最小 Ollama `/api/chat` JSON 客户端，不使用 OpenAI SDK 或 Key。
- Create: `server/lib/scoreRecognitionFacts.js`：页面类型、地图、名次、完赛时间标准化、事实校验、比赛身份生成。
- Create: `server/lib/scoreRecognitionMatcher.js`：保守分层匹配，输出唯一自动命中或待确认候选，不直接修改配置。
- Modify: `server/lib/scoreRecognitionAi.js`：从多场和数值 schema 改为单场事实 schema，并增加昵称行局部识别入口。
- Modify: `server/lib/scoreRecognitionImage.js`：保留整图预处理，增加按模型返回行框裁剪放大。
- Modify: `server/lib/scoreRecognitionStore.js`：保存 `recognitionVersion: 2`、文件 SHA-256、比赛身份和历史来源查询数据。
- Modify: `server/lib/scoreRecognitionDraft.js`：消费单场事实和最终 `scoreMemberId`，删除旧数值签名与 `multiMatch` 分支。
- Modify: `server/lib/scoreRecognitionService.js`：编排文件去重、事实识别、局部复核、匹配、跨批去重、提交前复验和别名原子写入。
- Modify: `server/lib/scoreRecognitionRoutes.js`：固定单图单场输入，接入 Ollama 客户端和新版审核 payload。
- Modify: `server/index.js`、`.env.example`：默认连接本机 Ollama，识别流程不再要求 `OPENAI_API_KEY`。
- Modify: `server/lib/configStore.js`、`src/data/siteConfig.js`：新增独立 `scoreMemberAliases`，只允许引用现有积分成员。
- Modify: `src/admin/ScoreRecognition.jsx`、`src/admin/RecognitionEvidence.jsx`、`src/admin/adminApi.js`、`src/admin/admin.css`：移除一图多场和旧数值列，正常项收起、异常项展开，支持显式记住昵称。
- Create: `scripts/backfill-score-recognition-identities.js`：历史身份 dry-run/backfill，只写识别审计索引，不改 `dailyScores` 或 `weekendScores`。
- Modify: `docs/config-admin-guide.md`：记录输入限制、去重规则、人工别名和 Ollama 部署要求。

## 成功标准

- 真实基准集完整结算页识别成功率 100%，非结算页拦截率 100%。
- 完全相同文件和相同比赛去重率 100%，不同比赛错误合并数为 0。
- 自动积分成员匹配错误数为 0；不确定项必须阻止提交并进入人工审核。
- 新流程不读取截图底部时间，不使用昵称或 MVP/攻击/防御/援助数值生成硬去重键。
- 部署不需要 OpenAI Key；Ollama 不可用时返回明确错误且不产生草稿积分。
- 已提交积分不自动修改；旧 `multiMatch: true` 批次不能直接按新版提交。

### Task 1: 建立真实截图基准与只读评估入口

**Files:**
- Create: `server/fixtures/score-recognition-benchmark.json`
- Create: `scripts/evaluate-score-recognition.js`
- Create: `scripts/evaluate-score-recognition.test.js`
- Modify: `package.json`

- [ ] **Step 1: 写失败测试，固定基准清单校验和指标计算**

```js
import { describe, expect, it } from 'vitest';
import { calculateMetrics, validateBenchmark } from './evaluate-score-recognition.js';

describe('score recognition benchmark', () => {
  it('requires one expected match per result screenshot', () => {
    expect(() => validateBenchmark([{ id: 'x', expected: { screenType: 'result' } }]))
      .toThrow('expected.match is required');
  });

  it('counts a wrong merge as a hard failure', () => {
    const metrics = calculateMetrics([{
      expected: { screenType: 'result', identity: '洛杉矶::3::1=01:36:62|2=01:37:85|3=01:42:06' },
      actual: { screenType: 'result', identity: '彩虹风车岛::3::1=01:36:62|2=01:37:85|3=01:42:06' },
    }]);
    expect(metrics.wrongMergeCount).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run scripts/evaluate-score-recognition.test.js`

Expected: FAIL，提示 `evaluate-score-recognition.js` 或导出函数不存在。

- [ ] **Step 3: 实现纯校验、指标计算和只读 CLI**

```js
export function validateBenchmark(entries) {
  for (const entry of entries) {
    if (!entry.id || !entry.batchId || !Number.isInteger(entry.imageIndex)) {
      throw new Error('benchmark entry requires id, batchId and imageIndex');
    }
    if (entry.expected?.screenType === 'result' && !entry.expected.match) {
      throw new Error('expected.match is required');
    }
  }
  return entries;
}

export function calculateMetrics(rows) {
  const resultRows = rows.filter((row) => row.expected.screenType === 'result');
  const rejectedRows = rows.filter((row) => row.expected.screenType !== 'result');
  const exactRows = rows.filter((row) => row.expected.fileSha256);
  const raceRows = rows.filter((row) => row.expected.identity);
  return {
    resultSuccessRate: resultRows.length
      ? resultRows.filter((row) => row.actual?.identity === row.expected.identity).length / resultRows.length
      : 1,
    rejectionRate: rejectedRows.length
      ? rejectedRows.filter((row) => row.actual?.screenType !== 'result').length / rejectedRows.length
      : 1,
    wrongMergeCount: rows.filter((row) => row.expected.identity
      && row.actual?.identity
      && row.expected.identity !== row.actual.identity).length,
    exactFileDedupRate: exactRows.length
      ? exactRows.filter((row) => row.actual?.duplicateReason === 'exact-file').length / exactRows.length
      : 1,
    sameRaceDedupRate: raceRows.length
      ? raceRows.filter((row) => row.expected.shouldDuplicate === row.actual?.duplicate).length / raceRows.length
      : 1,
    automaticMemberMismatchCount: rows.reduce((count, row) => (
      count + (row.memberResults || []).filter((item) => item.actual && item.actual !== item.expected).length
    ), 0),
  };
}
```

CLI 只允许读取 `server/data/score-recognition/score-recognition-index.json` 和原图，输出 JSON/控制台报告；不得调用 `configStore.write()` 或 `scoreRecognitionStore.updateBatch()`。

- [ ] **Step 4: 写入真实基准 manifest**

每个条目使用以下完整结构，并从现有存档中选择人工已核对图片覆盖：同场多图、洛杉矶/彩虹风车岛不同场、同地图不同时间、完全相同文件、录像挑战页、模糊昵称、非积分成员、缺行或时间不可读。

```json
{
  "version": 1,
  "entries": [
    {
      "id": "result-los-angeles-a",
      "batchId": "4976c7ee-a84d-4a80-b9a3-d1d3a9d5b2ca",
      "imageIndex": 0,
      "expected": {
        "screenType": "result",
        "match": {
          "mapName": "洛杉矶",
          "participants": [
            { "nickname": "赴约·太困", "rank": 1, "finishTime": "01:36:62", "scoreMemberId": "29" },
            { "nickname": "安忆", "rank": 2, "finishTime": "01:37:85", "scoreMemberId": "35" },
            { "nickname": "xy♂·妄念", "rank": 3, "finishTime": "01:42:06", "scoreMemberId": "13" }
          ]
        },
        "identity": "洛杉矶::3::1=01:36:62|2=01:37:85|3=01:42:06"
      }
    }
  ]
}
```

该条目对应现有批次 `4976c7ee-a84d-4a80-b9a3-d1d3a9d5b2ca/01.png`，三行姓名、积分成员 ID、地图和完赛时间均已按原图人工核对。随后从现有存档追加其余覆盖样本，所有新增条目必须使用真实批次 ID、图片序号和人工确认事实，不能使用模型当前输出充当期望值。

- [ ] **Step 5: 添加脚本并运行测试**

```json
{
  "scripts": {
    "evaluate:score-recognition": "node scripts/evaluate-score-recognition.js"
  }
}
```

Run: `npm test -- --run scripts/evaluate-score-recognition.test.js`

Expected: PASS，2 项测试通过。

- [ ] **Step 6: 提交基准工具**

```bash
git add package.json server/fixtures/score-recognition-benchmark.json scripts/evaluate-score-recognition.js scripts/evaluate-score-recognition.test.js
git commit -m "test: add score recognition benchmark"
```

### Task 2: 新增无 Key 的 Ollama 视觉客户端

**Files:**
- Create: `server/lib/ollamaVisionClient.js`
- Create: `server/lib/ollamaVisionClient.test.js`
- Modify: `.env.example`
- Modify: `server/index.js`
- Test: `server/index.test.js`

- [ ] **Step 1: 写失败测试，固定请求和错误语义**

```js
import { describe, expect, it, vi } from 'vitest';
import { createOllamaVisionClient } from './ollamaVisionClient.js';

it('posts one image to the local Ollama chat endpoint and parses JSON content', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ message: { content: '{"screenType":"replay"}' } }),
  });
  const client = createOllamaVisionClient({ baseUrl: 'http://127.0.0.1:11434', fetchImpl });
  await expect(client.generate({ model: 'xingyu-score-recognition', prompt: 'p', imageBytes: Buffer.from('x') }))
    .resolves.toEqual({ screenType: 'replay' });
  expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:11434/api/chat', expect.objectContaining({ method: 'POST' }));
});

it('reports that the local model is unavailable', async () => {
  const client = createOllamaVisionClient({ fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) });
  await expect(client.generate({ model: 'm', prompt: 'p', imageBytes: Buffer.from('x') }))
    .rejects.toThrow('无法连接本地 Ollama');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run server/lib/ollamaVisionClient.test.js`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现最小 Ollama 客户端**

```js
export function createOllamaVisionClient({
  baseUrl = 'http://127.0.0.1:11434',
  fetchImpl = fetch,
} = {}) {
  return {
    async generate({ model, prompt, imageBytes }) {
      let response;
      try {
        response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            stream: false,
            format: 'json',
            options: { temperature: 0 },
            messages: [{ role: 'user', content: prompt, images: [Buffer.from(imageBytes).toString('base64')] }],
          }),
        });
      } catch (error) {
        throw Object.assign(new Error('无法连接本地 Ollama，请确认服务已启动'), { cause: error, statusCode: 503 });
      }
      if (!response.ok) throw Object.assign(new Error(`本地 Ollama 返回错误 (${response.status})`), { statusCode: 503 });
      const payload = await response.json();
      const content = payload?.message?.content;
      if (typeof content !== 'string') throw new Error('本地 Ollama 未返回识别内容');
      try { return JSON.parse(content); } catch { throw new Error('本地 Ollama 返回的内容不是合法 JSON'); }
    },
  };
}
```

- [ ] **Step 4: 将服务启动改为默认本地客户端**

`server/index.js` 注入：

```js
const visionClient = options.visionClient ?? createOllamaVisionClient({
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
});

const scoreRecognitionRouter = createScoreRecognitionRouter({
  configStore: store,
  dataDir: scoreRecognitionDataDir,
  storageDir: scoreRecognitionStorageDir,
  visionClient,
  model: process.env.OLLAMA_VISION_MODEL || 'xingyu-score-recognition',
  onConfigUpdate: notifyConfigUpdate,
});
```

`.env.example` 改为：

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_VISION_MODEL=xingyu-score-recognition
```

更新 `server/index.test.js`，使用 `visionClient` 假客户端并断言没有 Key 时也可启动和处理识别。

- [ ] **Step 5: 运行测试**

Run: `npm test -- --run server/lib/ollamaVisionClient.test.js server/index.test.js`

Expected: PASS；识别 API 不再出现“未配置 OPENAI_API_KEY”。

- [ ] **Step 6: 提交本地客户端**

```bash
git add .env.example server/index.js server/index.test.js server/lib/ollamaVisionClient.js server/lib/ollamaVisionClient.test.js
git commit -m "feat: use local Ollama for score recognition"
```

### Task 3: 定义单场比赛事实、校验和身份键

**Files:**
- Create: `server/lib/scoreRecognitionFacts.js`
- Create: `server/lib/scoreRecognitionFacts.test.js`

- [ ] **Step 1: 写失败测试，固定标准化和硬去重规则**

```js
import { describe, expect, it } from 'vitest';
import { buildRaceIdentity, normalizeFinishTime, validateRaceFacts } from './scoreRecognitionFacts.js';

it('builds identity from map, participant count and rank-time sequence only', () => {
  expect(buildRaceIdentity({ mapName: ' 洛杉矶 ', participants: [
    { nickname: 'A', rank: 2, finishTime: '1:37:85' },
    { nickname: 'B', rank: 1, finishTime: '01：36：62' },
  ] })).toBe('洛杉矶::2::1=01:36:62|2=01:37:85');
});

it('keeps different maps and different finish times distinct', () => {
  const base = [{ nickname: 'A', rank: 1, finishTime: '01:36:62' }];
  expect(buildRaceIdentity({ mapName: '洛杉矶', participants: base }))
    .not.toBe(buildRaceIdentity({ mapName: '彩虹风车岛', participants: base }));
  expect(buildRaceIdentity({ mapName: '洛杉矶', participants: base }))
    .not.toBe(buildRaceIdentity({ mapName: '洛杉矶', participants: [{ ...base[0], finishTime: '01:36:63' }] }));
});

it('blocks non-result pages and missing continuous ranks', () => {
  expect(validateRaceFacts({ screenType: 'replay' }).issues).toContainEqual({ code: 'unsupported-screen', screenType: 'replay' });
  expect(validateRaceFacts({ screenType: 'result', mapName: '洛杉矶', participants: [
    { nickname: 'A', rank: 1, finishTime: '01:00:00' },
    { nickname: 'B', rank: 3, finishTime: '01:02:00' },
  ] }).issues).toContainEqual({ code: 'non-contiguous-ranks', missingRanks: [2] });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run server/lib/scoreRecognitionFacts.test.js`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现纯函数**

```js
export function normalizeMapName(value) {
  return String(value || '').normalize('NFC').replace(/[\s\u200b-\u200d\ufeff]+/g, ' ').trim();
}

export function normalizeFinishTime(value) {
  const parts = String(value || '').trim().replaceAll('：', ':').split(':');
  if (parts.length !== 3 || parts.some((part) => !/^\d{1,2}$/.test(part))) return '';
  return parts.map((part) => part.padStart(2, '0')).join(':');
}

export function validateRaceFacts(facts) {
  const issues = [];
  if (facts?.screenType !== 'result') return { issues: [{ code: 'unsupported-screen', screenType: facts?.screenType || 'unknown' }] };
  if (!normalizeMapName(facts.mapName)) issues.push({ code: 'missing-map' });
  const participants = Array.isArray(facts.participants) ? facts.participants : [];
  if (!participants.length) issues.push({ code: 'missing-participants' });
  const ranks = participants.map((item) => item.rank);
  const maxRank = ranks.length ? Math.max(...ranks.filter(Number.isInteger)) : 0;
  const missingRanks = Array.from({ length: maxRank }, (_, index) => index + 1).filter((rank) => !ranks.includes(rank));
  if (missingRanks.length) issues.push({ code: 'non-contiguous-ranks', missingRanks });
  if (new Set(ranks).size !== ranks.length) issues.push({ code: 'duplicate-ranks' });
  participants.forEach((item, index) => {
    if (!String(item.nickname || '').trim()) issues.push({ code: 'missing-nickname', participantIndex: index });
    if (!normalizeFinishTime(item.finishTime)) issues.push({ code: 'invalid-finish-time', participantIndex: index });
  });
  return { issues };
}

export function buildRaceIdentity(facts) {
  if (validateRaceFacts(facts).issues.length) return null;
  const participants = [...facts.participants].sort((left, right) => left.rank - right.rank);
  return `${normalizeMapName(facts.mapName)}::${participants.length}::${participants
    .map((item) => `${item.rank}=${normalizeFinishTime(item.finishTime)}`).join('|')}`;
}
```

- [ ] **Step 4: 运行测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionFacts.test.js`

Expected: PASS，覆盖非结算页、地图、连续名次、时间和不同场不合并。

```bash
git add server/lib/scoreRecognitionFacts.js server/lib/scoreRecognitionFacts.test.js
git commit -m "feat: define score recognition race facts"
```

### Task 4: 将 AI 适配器收紧为单场事实 schema

**Files:**
- Modify: `server/lib/scoreRecognitionAi.js`
- Modify: `server/lib/scoreRecognitionAi.test.js`

- [ ] **Step 1: 替换旧测试为单场事实测试**

```js
it('extracts one result screen with map, finish times and row boxes', async () => {
  client.generate.mockResolvedValue({
    screenType: 'result',
    mapName: '洛杉矶',
    participants: [{ nickname: '赴约·太困', rank: 1, finishTime: '01:36:62', rowBox: [80, 220, 920, 120] }],
  });
  await expect(ai.extractRaceFacts({ imageBytes, mimeType: 'image/png' })).resolves.toMatchObject({
    screenType: 'result', mapName: '洛杉矶',
  });
});

it('does not ask for screenshot time or numeric performance columns', async () => {
  await ai.extractRaceFacts({ imageBytes, mimeType: 'image/png' });
  const prompt = client.generate.mock.calls[0][0].prompt;
  expect(prompt).toContain('不要读取截图底部时间');
  expect(prompt).not.toMatch(/MVP|攻击|防御|援助/);
});

it('rejects more than one match object', async () => {
  client.generate.mockResolvedValue({ matches: [{}, {}] });
  await expect(ai.extractRaceFacts({ imageBytes, mimeType: 'image/png' })).rejects.toThrow('只允许一场比赛');
});
```

- [ ] **Step 2: 运行测试确认旧实现失败**

Run: `npm test -- --run server/lib/scoreRecognitionAi.test.js`

Expected: FAIL，旧接口仍返回 `matches` 并包含数值列提示。

- [ ] **Step 3: 实现 `extractRaceFacts` 和 `extractNickname` 两个入口**

整图返回结构固定为：

```js
{
  screenType: 'result' | 'replay' | 'recent-list' | 'loading' | 'other',
  mapName: string,
  participants: [{ nickname: string, rank: number, finishTime: string, rowBox: [number, number, number, number] }]
}
```

核心工厂接口：

```js
export function createScoreRecognitionAi({ client, model, imageProcessor = prepareRecognitionImage }) {
  async function extractRaceFacts({ imageBytes, mimeType }) {
    const prepared = await imageProcessor({ imageBytes, mimeType });
    const parsed = await client.generate({ model, prompt: FULL_IMAGE_PROMPT, imageBytes: prepared.imageBytes });
    validateSingleRaceResponse(parsed);
    return parsed;
  }

  async function extractNickname({ imageBytes, mimeType }) {
    const prepared = await imageProcessor({ imageBytes, mimeType });
    const parsed = await client.generate({ model, prompt: NICKNAME_ROW_PROMPT, imageBytes: prepared.imageBytes });
    if (typeof parsed?.nickname !== 'string' || !parsed.nickname.trim()) throw new Error('局部复核未返回昵称');
    return parsed.nickname.trim();
  }

  return { extractRaceFacts, extractNickname };
}
```

`FULL_IMAGE_PROMPT` 必须明确：只分类页面并读取地图、每行昵称、名次、完赛时间和行框；只输出一个对象；不得拆场；不得读取截图底部时间；不得推测积分或身份。

- [ ] **Step 4: 运行测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionAi.test.js`

Expected: PASS；旧 `multiMatch`、`score`、`attack`、`defense`、`assist` 测试已删除或改写。

```bash
git add server/lib/scoreRecognitionAi.js server/lib/scoreRecognitionAi.test.js
git commit -m "feat: extract single-race result facts"
```

### Task 5: 增加排名行裁剪与异常昵称局部复核

**Files:**
- Modify: `server/lib/scoreRecognitionImage.js`
- Modify: `server/lib/scoreRecognitionImage.test.js`
- Test: `server/lib/scoreRecognitionAi.test.js`

- [ ] **Step 1: 写失败测试，固定边界框裁剪行为**

```js
import sharp from 'sharp';
import { cropRecognitionRow } from './scoreRecognitionImage.js';

it('clamps, crops and enlarges a normalized ranking row box', async () => {
  const source = await sharp({ create: { width: 1000, height: 500, channels: 3, background: 'white' } }).png().toBuffer();
  const result = await cropRecognitionRow({
    imageBytes: source,
    mimeType: 'image/png',
    rowBox: [0.1, 0.2, 0.8, 0.2],
  });
  const metadata = await sharp(result.imageBytes).metadata();
  expect(metadata.width).toBe(1600);
  expect(metadata.height).toBe(200);
});

it('rejects an invalid row box instead of cropping an arbitrary area', async () => {
  await expect(cropRecognitionRow({ imageBytes: Buffer.from('x'), mimeType: 'image/png', rowBox: [0, 0, 0, 0] }))
    .rejects.toThrow('排名行位置无效');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run server/lib/scoreRecognitionImage.test.js`

Expected: FAIL，`cropRecognitionRow` 不存在。

- [ ] **Step 3: 实现局部裁剪**

```js
export async function cropRecognitionRow({ imageBytes, mimeType, rowBox }) {
  if (!Array.isArray(rowBox) || rowBox.length !== 4 || rowBox.some((value) => !Number.isFinite(value))) {
    throw new Error('排名行位置无效');
  }
  const metadata = await sharp(imageBytes).metadata();
  const [x, y, width, height] = rowBox;
  const left = Math.max(0, Math.floor(x * metadata.width));
  const top = Math.max(0, Math.floor(y * metadata.height));
  const cropWidth = Math.min(metadata.width - left, Math.ceil(width * metadata.width));
  const cropHeight = Math.min(metadata.height - top, Math.ceil(height * metadata.height));
  if (cropWidth < 20 || cropHeight < 10) throw new Error('排名行位置无效');
  const imageBytesOut = await sharp(imageBytes)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: 1600, withoutEnlargement: false })
    .sharpen()
    .png()
    .toBuffer();
  return { imageBytes: imageBytesOut, mimeType: 'image/png' };
}
```

- [ ] **Step 4: 增加服务可调用的复核约定**

局部识别只接收对应 `rowBox` 的裁剪图，并保存：

```js
{
  originalNickname: participant.nickname,
  reviewedNickname: localNickname,
  reviewReason: 'unmatched' | 'ambiguous' | 'truncated' | 'alias-conflict'
}
```

不得用局部结果覆盖 `originalNickname`；两次结果不一致时只生成待确认项。

- [ ] **Step 5: 运行测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionImage.test.js server/lib/scoreRecognitionAi.test.js`

Expected: PASS。

```bash
git add server/lib/scoreRecognitionImage.js server/lib/scoreRecognitionImage.test.js server/lib/scoreRecognitionAi.test.js
git commit -m "feat: recheck uncertain score nicknames"
```

### Task 6: 新增保守积分成员匹配器

**Files:**
- Create: `server/lib/scoreRecognitionMatcher.js`
- Create: `server/lib/scoreRecognitionMatcher.test.js`
- Read: `src/data/scoreRules.js`

- [ ] **Step 1: 写失败测试，固定自动匹配和阻塞边界**

```js
import { describe, expect, it } from 'vitest';
import { createScoreRecognitionMatcher } from './scoreRecognitionMatcher.js';

const config = {
  roster: [{ id: 'r1', name: '安忆', scoreMemberId: '35' }],
  scoreMembers: [{ id: '13', name: 'ˣʸ༩·妄念' }, { id: '35', name: 'ˣʸ༩·安忆' }],
  memberAliases: [],
  scoreMemberAliases: [{ scoreMemberId: '13', value: 'xy♂·妄念' }],
};

it('returns the permanent score identity for a unique roster or confirmed alias match', () => {
  const match = createScoreRecognitionMatcher(config);
  expect(match('安忆')).toMatchObject({ status: 'matched', scoreMemberId: '35', source: 'roster' });
  expect(match('xy♂·妄念')).toMatchObject({ status: 'matched', scoreMemberId: '13', source: 'score-alias' });
});

it('never auto-matches a one-Han-character or ambiguous nickname', () => {
  const match = createScoreRecognitionMatcher({
    roster: [],
    scoreMembers: [{ id: '1', name: '小安' }, { id: '2', name: '安安' }],
    scoreMemberAliases: [], memberAliases: [],
  });
  expect(match('安')).toMatchObject({ status: 'review', reason: 'too-short' });
  expect(match('小')).toMatchObject({ status: 'review' });
});

it('returns all score members as review candidates without guessing', () => {
  const match = createScoreRecognitionMatcher(config);
  const result = match('看不清');
  expect(result.status).toBe('review');
  expect(result.candidates.map((item) => item.scoreMemberId)).toEqual(['13', '35']);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run server/lib/scoreRecognitionMatcher.test.js`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现四层匹配并保持结果可解释**

```js
export function createScoreRecognitionMatcher(config) {
  const scoreMembers = config.scoreMembers || [];
  const byId = new Map(scoreMembers.map((member) => [member.id, member]));
  const exactIndexes = buildExactIndexes(config, byId);
  const allCandidates = scoreMembers.map((member) => ({ scoreMemberId: member.id, name: member.name }));

  return (nickname) => {
    const normalized = normalizeNickname(nickname);
    const exact = exactIndexes.get(normalized) || [];
    if (exact.length === 1) return { status: 'matched', ...exact[0] };
    if (extractHanCharacters(normalized).length < 2) {
      return { status: 'review', reason: 'too-short', candidates: allCandidates };
    }
    const conservative = findUniqueConservativeCandidate(normalized, scoreMembers);
    if (conservative) return { status: 'matched', ...conservative, source: 'unique-conservative' };
    return {
      status: 'review',
      reason: exact.length > 1 ? 'ambiguous' : 'unmatched',
      candidates: allCandidates,
    };
  };
}
```

`findUniqueConservativeCandidate` 只允许：唯一汉字全名相等、已知车队前缀剥离后全名相等、长度至少 2 的唯一受限字符结果。编辑距离近似只能生成候选，不能自动命中。

- [ ] **Step 4: 运行测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionMatcher.test.js src/data/scoreRules.test.js`

Expected: PASS；现有昵称标准化测试继续通过。

```bash
git add server/lib/scoreRecognitionMatcher.js server/lib/scoreRecognitionMatcher.test.js
git commit -m "feat: add conservative score member matcher"
```

### Task 7: 增加积分成员识别别名并支持显式记忆

**Files:**
- Modify: `server/lib/configStore.js`
- Modify: `server/lib/configStore.test.js`
- Modify: `src/data/siteConfig.js`
- Modify: `src/data/siteConfig.test.js`

- [ ] **Step 1: 写失败测试，固定配置校验和迁移默认值**

```js
it('accepts score member aliases that reference an existing score identity', async () => {
  const config = validConfig();
  config.scoreMemberAliases = [{ scoreMemberId: config.scoreMembers[0].id, value: 'xy♂·妄念' }];
  await expect(store.write(config)).resolves.toBeUndefined();
});

it('rejects aliases for a missing score identity and duplicate normalized values', async () => {
  const config = validConfig();
  config.scoreMemberAliases = [
    { scoreMemberId: 'missing', value: '安忆' },
    { scoreMemberId: config.scoreMembers[0].id, value: ' xy·安忆 ' },
    { scoreMemberId: config.scoreMembers[1].id, value: 'xy·安忆' },
  ];
  await expect(store.write(config)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
});

it('adds an empty scoreMemberAliases array to legacy config', () => {
  expect(migrateConfig({ ...teamData, scoreMemberAliases: undefined }).scoreMemberAliases).toEqual([]);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run server/lib/configStore.test.js src/data/siteConfig.test.js`

Expected: FAIL，顶层键不允许或迁移结果缺字段。

- [ ] **Step 3: 实现配置结构和严格校验**

将 `scoreMemberAliases` 加入允许顶层键，并验证：

```js
if (config.scoreMemberAliases != null) {
  if (!Array.isArray(config.scoreMemberAliases)) details.push('scoreMemberAliases must be an array');
  else {
    const ownersByValue = new Map();
    config.scoreMemberAliases.forEach((alias, index) => {
      const path = `scoreMemberAliases[${index}]`;
      if (!isObject(alias) || !isNonEmptyString(alias.scoreMemberId) || !isNonEmptyString(alias.value)) {
        details.push(`${path} must contain scoreMemberId and value`);
        return;
      }
      if (!scoreMemberIds.has(alias.scoreMemberId)) details.push(`${path}.scoreMemberId must reference scoreMembers`);
      const normalized = normalizeNickname(alias.value);
      const owner = ownersByValue.get(normalized);
      if (owner && owner !== alias.scoreMemberId) details.push(`${path}.value is already assigned to another score member`);
      ownersByValue.set(normalized, alias.scoreMemberId);
    });
  }
}
```

迁移和公开 hydration 保留该数组供后台使用，但公开 H5 不渲染别名。

- [ ] **Step 4: 运行测试并提交**

Run: `npm test -- --run server/lib/configStore.test.js src/data/siteConfig.test.js`

Expected: PASS。

```bash
git add server/lib/configStore.js server/lib/configStore.test.js src/data/siteConfig.js src/data/siteConfig.test.js
git commit -m "feat: persist confirmed score member aliases"
```

### Task 8: 持久化文件哈希、比赛身份和历史来源查询

**Files:**
- Modify: `server/lib/scoreRecognitionStore.js`
- Modify: `server/lib/scoreRecognitionStore.test.js`

- [ ] **Step 1: 写失败测试，覆盖本批和跨批查询**

```js
it('stores SHA-256 at upload and finds exact files across batches', async () => {
  const first = await store.createBatch({ id: 'a', date: '2026-08-05', raceType: 'team', files: [png('same')] });
  const second = await store.createBatch({ id: 'b', date: '2026-08-05', raceType: 'team', files: [png('same')] });
  expect(first.images[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  await expect(store.findImageBySha256(second.images[0].sha256, { excludeBatchId: 'b' }))
    .resolves.toMatchObject({ batchId: 'a', imageIndex: 0 });
});

it('finds a committed race identity with its source image', async () => {
  await store.updateBatch('a', {
    status: 'committed',
    raceIdentities: [{ identity: '洛杉矶::1::1=01:36:62', imageIndex: 0, committedAt: '2026-08-06T00:00:00.000Z' }],
  });
  await expect(store.findCommittedRaceIdentity('洛杉矶::1::1=01:36:62'))
    .resolves.toMatchObject({ batchId: 'a', imageIndex: 0 });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run server/lib/scoreRecognitionStore.test.js`

Expected: FAIL，SHA-256 和查询方法不存在。

- [ ] **Step 3: 实现索引字段和只读查询**

批次新增：

```js
{
  recognitionVersion: 2,
  images: [{ path, mimeType, originalName, size, sha256 }],
  raceIdentities: [{ identity, imageIndex, committedAt }]
}
```

创建图片时用 `createHash('sha256').update(file.buffer).digest('hex')`；查询方法扫描现有索引快照并返回 `{ batchId, imageIndex, status, committedAt }`。不另建数据库或缓存层。

- [ ] **Step 4: 运行测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionStore.test.js`

Expected: PASS，包括现有并发原子写测试。

```bash
git add server/lib/scoreRecognitionStore.js server/lib/scoreRecognitionStore.test.js
git commit -m "feat: index score recognition identities"
```

### Task 9: 重写识别草稿为事实驱动计分

**Files:**
- Modify: `server/lib/scoreRecognitionDraft.js`
- Modify: `server/lib/scoreRecognitionDraft.test.js`
- Read: `src/data/scoreRules.js`

- [ ] **Step 1: 写失败测试，删除昵称/数值去重并固定单场输入**

```js
it('auto-skips identical race identities even when OCR nicknames differ', () => {
  const draft = buildRecognitionDraft({
    batch: batch(), config: config(), reviews: {},
    observations: [
      resultObservation(0, '洛杉矶', ['xy♂·妄念', '安忆'], ['01:36:62', '01:37:85']),
      resultObservation(1, '洛杉矶', ['♀·妄念', 'xy·安忆'], ['01:36:62', '01:37:85']),
    ],
  });
  expect(draft.duplicateCount).toBe(1);
});

it('keeps same participants and ranks when map or finish time differs', () => {
  const draft = buildRecognitionDraft({
    batch: batch(), config: config(), reviews: {},
    observations: [
      resultObservation(0, '洛杉矶', ['妄念'], ['01:36:62']),
      resultObservation(1, '彩虹风车岛', ['妄念'], ['01:36:62']),
      resultObservation(2, '洛杉矶', ['妄念'], ['01:36:63']),
    ],
  });
  expect(draft.duplicateCount).toBe(0);
  expect(draft.races).toHaveLength(3);
});

it('blocks unsupported screens, incomplete facts and unresolved identities', () => {
  const draft = buildRecognitionDraft({
    batch: batch(), config: config(), reviews: {},
    observations: [{ imageIndex: 0, facts: { screenType: 'replay' } }],
  });
  expect(draft.canCommit).toBe(false);
  expect(draft.issues[0].code).toBe('unsupported-screen');
});
```

- [ ] **Step 2: 运行测试确认旧逻辑失败**

Run: `npm test -- --run server/lib/scoreRecognitionDraft.test.js`

Expected: FAIL，旧代码仍读取 `matches` 和数值签名。

- [ ] **Step 3: 以 `facts + matches` 结果重建草稿**

草稿每张图只生成一个 race，并在顶层返回 `races` 供审核层使用：

```js
{
  imageIndex,
  screenType,
  mapName,
  identity,
  duplicate: false,
  duplicateOf: null,
  participants: [{
    id: `i${imageIndex}-p${participantIndex}`,
    originalNickname,
    reviewedNickname,
    rank,
    finishTime,
    scoreMemberId,
    nonScoreMember,
    score,
    slot,
  }]
}
```

处理顺序固定为：`validateRaceFacts` → 应用人工选择 → 匹配器结果 → `buildRaceIdentity` → 当前批 identity 去重 → 确定性计分 → `assignMemberSlots` → 汇总。返回值必须包含 `{ races, evidence, summary, issues, canCommit }`，其中 `evidence` 由 `races` 展平生成。队内赛 `participantCount` 使用完整排名行数量，包括明确标记的非积分成员；排位赛只计算有效积分成员的相对名次。

- [ ] **Step 4: 删除旧歧义逻辑**

移除 `buildDuplicateSignature`、`hasRaceDiscriminator`、`score/attack/defense/assist` 去重、`matchIndex` 和 `reviewedNotDuplicate`。identity 完整一致直接去重，identity 不一致直接保留；identity 生成失败只能阻塞，不能人工强行声明“不是重复”绕过缺字段。

- [ ] **Step 5: 运行测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionDraft.test.js src/data/scoreRules.test.js`

Expected: PASS；相同比赛 100% 去重，不同地图/时间均保留。

```bash
git add server/lib/scoreRecognitionDraft.js server/lib/scoreRecognitionDraft.test.js
git commit -m "refactor: build score drafts from race facts"
```

### Task 10: 重写服务编排并在提交前二次复验

**Files:**
- Modify: `server/lib/scoreRecognitionService.js`
- Modify: `server/lib/scoreRecognitionService.test.js`

- [ ] **Step 1: 写失败测试，覆盖文件去重、局部复核和非结算拦截**

```js
it('skips an exact historical file before calling the model', async () => {
  store.findImageBySha256.mockResolvedValue({ batchId: 'old', imageIndex: 2, status: 'committed' });
  const draft = await service.previewBatch('new');
  expect(ai.extractRaceFacts).not.toHaveBeenCalled();
  expect(draft.races[0]).toMatchObject({ duplicate: true, duplicateReason: 'exact-file' });
});

it('rechecks only an uncertain nickname row and preserves both readings', async () => {
  ai.extractRaceFacts.mockResolvedValue(resultFacts({ nickname: '安' }));
  ai.extractNickname.mockResolvedValue('安忆');
  const draft = await service.previewBatch('batch');
  expect(cropRow).toHaveBeenCalledTimes(1);
  expect(draft.races[0].participants[0]).toMatchObject({ originalNickname: '安', reviewedNickname: '安忆' });
});

it('does not score a replay page and continues processing later images', async () => {
  ai.extractRaceFacts
    .mockResolvedValueOnce({ screenType: 'replay', mapName: '', participants: [] })
    .mockResolvedValueOnce(resultFacts({ nickname: '安忆' }));
  const draft = await service.previewBatch('batch');
  expect(draft.races[0].issues[0].code).toBe('unsupported-screen');
  expect(draft.races[1].participants[0].score).toBeTypeOf('number');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run server/lib/scoreRecognitionService.test.js`

Expected: FAIL，旧服务调用 `extractMatches` 且没有跨批文件查询或局部复核。

- [ ] **Step 3: 实现逐图识别编排**

`createScoreRecognitionService` 增加可选的 `cropRow = cropRecognitionRow` 注入参数，便于服务测试隔离图像处理。`previewBatch` 对每张图按以下固定顺序执行，单图失败保存为该图问题并继续下一张：

```js
async function recognizeImage({ batch, image, imageIndex, config }) {
  const exactSource = await store.findImageBySha256(image.sha256, { excludeBatchId: batch.id });
  if (exactSource) return exactDuplicateObservation(imageIndex, exactSource);

  const { bytes, mimeType } = await store.readImage(batch.id, imageIndex);
  const facts = await ai.extractRaceFacts({ imageBytes: bytes, mimeType });
  const factValidation = validateRaceFacts(facts);
  if (facts.screenType !== 'result') return blockedObservation(imageIndex, facts, factValidation.issues);

  const matcher = createScoreRecognitionMatcher(config);
  const participants = await Promise.all(facts.participants.map(async (participant) => {
    const firstMatch = matcher(participant.nickname);
    if (firstMatch.status === 'matched') return participantResult(participant, firstMatch);
    const crop = await cropRow({ imageBytes: bytes, mimeType, rowBox: participant.rowBox });
    const reviewedNickname = await ai.extractNickname(crop);
    return participantResult(participant, decideReviewedMatch(firstMatch, matcher(reviewedNickname), reviewedNickname));
  }));

  return { imageIndex, facts, participants, identity: buildRaceIdentity({ ...facts, participants }) };
}
```

如果 `rowBox` 缺失或无效，追加 `nickname-recheck-unavailable` 阻塞项，不得裁剪整张图冒充局部复核。

- [ ] **Step 4: 写失败测试，覆盖跨批 identity 和提交竞态**

```js
it('marks a committed historical identity as duplicate with its source', async () => {
  store.findCommittedRaceIdentity.mockResolvedValue({ batchId: 'old', imageIndex: 1, committedAt: '2026-08-05T12:00:00.000Z' });
  const draft = await service.previewBatch('new');
  expect(draft.races[0]).toMatchObject({ duplicate: true, duplicateReason: 'race-identity', duplicateOf: { batchId: 'old', imageIndex: 1 } });
});

it('rechecks config and historical identities immediately before commit', async () => {
  await service.previewBatch('batch');
  store.findCommittedRaceIdentity.mockResolvedValue({ batchId: 'other', imageIndex: 0 });
  await expect(service.commitBatch('batch', currentRosterVersion)).rejects.toThrow('比赛已在其他批次提交');
  expect(configStore.write).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: 实现提交前完整复验和原子别名写入**

`commitBatch` 必须重新读取：当前批次、最新 config、所有历史已提交 identity。对每个非重复 result race 重新运行事实校验、成员身份校验、identity 查询、三局槽位分配。

人工审核 payload：

```js
{
  evidenceId: 'i0-p1',
  scoreMemberId: '35',
  nonScoreMember: false,
  rememberNickname: true
}
```

仅当 `rememberNickname === true` 且存在明确 `scoreMemberId` 时，将标准化后的 `originalNickname`/`reviewedNickname` 合并为：

```js
scoreMemberAliases: [
  ...existingAliases,
  { scoreMemberId: '35', value: '安忆' }
]
```

别名和 `dailyScores` 使用同一个 `configStore.write(nextConfig)` 原子提交；别名冲突导致整个提交失败，不能出现积分已写但别名未写或反向情况。成功后批次写入 `status: 'committed'`、`raceIdentities`、`committedAt`。

- [ ] **Step 6: 运行服务测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionService.test.js server/lib/scoreRecognitionDraft.test.js`

Expected: PASS；覆盖文件重复、跨批重复、非结算页、局部复核、别名原子提交和提交竞态。

```bash
git add server/lib/scoreRecognitionService.js server/lib/scoreRecognitionService.test.js
git commit -m "feat: orchestrate conservative local score recognition"
```

### Task 11: 收紧识别 API 并删除 OpenAI/multiMatch 链路

**Files:**
- Modify: `server/lib/scoreRecognitionRoutes.js`
- Modify: `server/index.test.js`
- Modify: `src/admin/adminApi.js`
- Delete: `server/lib/openaiClient.js`
- Delete: `server/lib/openaiClient.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: 写失败 API 测试，固定新版创建、旧批次和错误响应**

```js
it('creates only recognitionVersion 2 single-race batches', async () => {
  const response = await authenticated(request(app).post('/api/admin/score-recognition/batches'))
    .field('date', '2026-08-05')
    .field('raceType', 'team')
    .attach('files', pngBuffer, 'result.png');
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({ recognitionVersion: 2 });
  expect(response.body).not.toHaveProperty('multiMatch');
});

it('requires legacy multi-match batches to be re-uploaded', async () => {
  seedBatch({ id: 'legacy', multiMatch: true, recognitionVersion: 1, status: 'ready' });
  const response = await authenticated(request(app).post('/api/admin/score-recognition/batches/legacy/commit'))
    .send({ rosterVersion: 'v' });
  expect(response.status).toBe(409);
  expect(response.body.error).toContain('旧版一图多场批次，请重新上传');
});

it('returns 503 when local Ollama is unavailable without mentioning an API key', async () => {
  visionClient.generate.mockRejectedValue(Object.assign(new Error('无法连接本地 Ollama'), { statusCode: 503 }));
  const response = await processUploadedBatch();
  expect(response.status).toBe(503);
  expect(response.body.error).toContain('Ollama');
  expect(response.body.error).not.toContain('KEY');
});
```

- [ ] **Step 2: 运行测试确认旧路由失败**

Run: `npm test -- --run server/index.test.js`

Expected: FAIL，旧路由仍接受/保存 `multiMatch` 并检查 OpenAI Key。

- [ ] **Step 3: 修改路由和前端 API**

路由工厂改为：

```js
export function createScoreRecognitionRouter({
  configStore,
  dataDir,
  storageDir,
  visionClient,
  model,
  onConfigUpdate = () => {},
}) {
  const ai = createScoreRecognitionAi({ client: visionClient, model });
  const service = createScoreRecognitionService({ ai, store: recognitionStore, configStore });
  // existing endpoints, without multiMatch parsing
}
```

创建批次固定传 `recognitionVersion: 2`。`process`/`review`/`rematch`/`commit` 遇到 `recognitionVersion !== 2` 或 `multiMatch === true` 返回 409 和重新上传提示。图片查看与批次列表仍可读旧记录。

`src/admin/adminApi.js` 改为：

```js
export function uploadRecognitionBatch(date, raceType, files) {
  const body = new FormData();
  body.append('date', date);
  body.append('raceType', raceType);
  files.forEach((file) => body.append('files', file));
  return call('/api/admin/score-recognition/batches', { method: 'POST', body });
}
```

- [ ] **Step 4: 删除未使用 OpenAI 依赖**

Run: `npm uninstall openai`

Expected: `package.json`/`package-lock.json` 不再包含 `openai`；删除 `server/lib/openaiClient.js` 和测试。运行 `rg -n "OPENAI_|openaiClient|from 'openai'" server src .env.example package.json` 应无输出。

- [ ] **Step 5: 运行 API 测试并提交**

Run: `npm test -- --run server/index.test.js server/lib/scoreRecognitionStore.test.js`

Expected: PASS；新版批次单场、旧批次只读、无 Key 可启动。

```bash
git add package.json package-lock.json server/index.js server/index.test.js server/lib/scoreRecognitionRoutes.js src/admin/adminApi.js .env.example
git rm server/lib/openaiClient.js server/lib/openaiClient.test.js
git commit -m "refactor: enforce local single-race recognition"
```

### Task 12: 重做后台审核为异常优先

**Files:**
- Modify: `src/admin/ScoreRecognition.jsx`
- Modify: `src/admin/ScoreRecognition.test.jsx`
- Modify: `src/admin/RecognitionEvidence.jsx`
- Modify: `src/admin/RecognitionEvidence.test.jsx`
- Modify: `src/admin/admin.css`

- [ ] **Step 1: 写失败 UI 测试，移除一图多场和旧数值列**

```jsx
it('uploads single-race screenshots without a multi-match control', async () => {
  render(<ScoreRecognition config={config} />);
  expect(screen.queryByRole('checkbox', { name: /一张图包含多场/ })).not.toBeInTheDocument();
  await user.upload(screen.getByLabelText('比赛截图'), file);
  await user.click(screen.getByRole('button', { name: '开始识别' }));
  expect(uploadRecognitionBatch).toHaveBeenCalledWith('2026-08-05', 'team', [file]);
});

it('does not render MVP or attack defense assist columns', () => {
  render(<RecognitionEvidence batchId="b" draft={draft} config={config} onReview={vi.fn()} />);
  expect(screen.queryByText(/MVP|攻击|防御|援助/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 写失败 UI 测试，固定正常收起和异常展开**

```jsx
it('collapses accepted races to map, participant count and score summary', () => {
  render(<RecognitionEvidence batchId="b" draft={acceptedDraft} config={config} onReview={vi.fn()} />);
  expect(screen.getByText('洛杉矶')).toBeInTheDocument();
  expect(screen.getByText('3 人')).toBeInTheDocument();
  expect(screen.queryByText('01:36:62')).not.toBeVisible();
});

it('expands a nickname issue and can explicitly remember the selected alias', async () => {
  render(<RecognitionEvidence batchId="b" draft={unmatchedDraft} config={config} onReview={onReview} />);
  expect(screen.getByText('昵称待确认')).toBeVisible();
  await user.selectOptions(screen.getByLabelText('积分成员'), '35');
  await user.click(screen.getByRole('checkbox', { name: '记住这个昵称' }));
  await user.click(screen.getByRole('button', { name: '确认成员' }));
  expect(onReview).toHaveBeenCalledWith({
    evidenceId: 'i0-p1', scoreMemberId: '35', nonScoreMember: false, rememberNickname: true,
  });
});

it('shows historical duplicate source and disables commit on blocked facts', () => {
  render(<RecognitionEvidence batchId="b" draft={duplicateDraft} config={config} onReview={vi.fn()} />);
  expect(screen.getByText(/已在批次 old-batch 提交/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '查看原图' })).toHaveAttribute('href', '/api/admin/score-recognition/batches/old-batch/images/1');
});
```

- [ ] **Step 3: 运行测试确认旧 UI 失败**

Run: `npm test -- --run src/admin/ScoreRecognition.test.jsx src/admin/RecognitionEvidence.test.jsx`

Expected: FAIL，旧 UI 仍有 `multiMatch` 和旧数值/人工重复选择。

- [ ] **Step 4: 实现状态映射和审核组件**

统一状态文案：

```js
const STATUS_LABELS = {
  accepted: '已识别',
  duplicate: '已自动去重',
  'unsupported-screen': '非结算页面',
  'member-review': '昵称待确认',
  'fact-review': '地图或完赛时间待确认',
  'slot-limit': '已超过个人局次限制',
  'legacy-reupload-required': '旧批次需重新上传',
};
```

每场用一个 `<details open={race.blocking}>`。摘要只显示地图、人数、状态和积分；展开后显示原图、`rank`、`originalNickname`、`reviewedNickname`、`finishTime`、最终积分成员、问题原因和跨批来源。人工选择下拉必须使用 `config.scoreMembers` 全量列表，并提供“非积分成员”显式操作。

删除“确认重复/不是重复”控制；硬 identity 完整时系统确定处理，identity 不完整时只允许修正事实或重新识别，不能人工绕过。

- [ ] **Step 5: 收紧样式并运行测试**

样式只新增/调整 `.recognition-race`、`.recognition-race-summary`、`.recognition-race--blocking`、`.recognition-participant-table`、`.recognition-duplicate-source`，复用现有后台按钮、表格、错误色和移动端断点，不重做其他后台页面。

Run: `npm test -- --run src/admin/ScoreRecognition.test.jsx src/admin/RecognitionEvidence.test.jsx src/admin/ScoreEditor.test.jsx`

Expected: PASS；390px 下表格只在自身容器横向滚动。

- [ ] **Step 6: 提交后台审核 UI**

```bash
git add src/admin/ScoreRecognition.jsx src/admin/ScoreRecognition.test.jsx src/admin/RecognitionEvidence.jsx src/admin/RecognitionEvidence.test.jsx src/admin/admin.css src/admin/adminApi.js
git commit -m "feat: review only uncertain score recognition results"
```

### Task 13: 增加历史比赛身份 dry-run/backfill

**Files:**
- Create: `scripts/backfill-score-recognition-identities.js`
- Create: `scripts/backfill-score-recognition-identities.test.js`

- [ ] **Step 1: 写失败测试，保证默认只读且不改积分**

```js
it('defaults to dry-run and never writes site config', async () => {
  const result = await backfillIdentities({ store, ai, write: false });
  expect(store.updateBatch).not.toHaveBeenCalled();
  expect(configStore.write).not.toHaveBeenCalled();
  expect(result).toMatchObject({ mode: 'dry-run' });
});

it('writes only reliable identities into recognition history when explicitly enabled', async () => {
  const before = structuredClone(config);
  const result = await backfillIdentities({ store, ai, write: true });
  expect(store.updateBatch).toHaveBeenCalledWith('committed-batch', expect.objectContaining({
    historyIdentityStatus: 'complete', raceIdentities: expect.any(Array),
  }));
  expect(config).toEqual(before);
  expect(result.incomplete).toContainEqual(expect.objectContaining({ reason: 'missing-finish-time' }));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run scripts/backfill-score-recognition-identities.test.js`

Expected: FAIL，脚本不存在。

- [ ] **Step 3: 实现显式写入开关和审计报告**

```js
export async function backfillIdentities({ store, ai, write = false }) {
  const batches = (await store.listBatches()).filter((batch) => batch.status === 'committed');
  const report = { mode: write ? 'write-index' : 'dry-run', complete: [], incomplete: [] };
  for (const batch of batches) {
    const identities = await recognizeReliableIdentities(batch, store, ai);
    if (identities.issues.length) {
      report.incomplete.push({ batchId: batch.id, reason: identities.issues[0].code });
      if (write) await store.updateBatch(batch.id, { historyIdentityStatus: 'incomplete' });
      continue;
    }
    report.complete.push({ batchId: batch.id, raceIdentities: identities.values });
    if (write) await store.updateBatch(batch.id, {
      recognitionVersion: batch.recognitionVersion || 1,
      historyIdentityStatus: 'complete',
      raceIdentities: identities.values,
    });
  }
  return report;
}
```

CLI 默认 dry-run；只有 `--write-index` 才允许调用 `updateBatch`。脚本不得 import `configStore`，不得写 `site-config.json`，不得改变批次 `status`，不得为缺地图/时间的历史记录猜测 identity。

- [ ] **Step 4: 运行 dry-run 和测试**

Run: `npm test -- --run scripts/backfill-score-recognition-identities.test.js`

Expected: PASS。

Run: `node scripts/backfill-score-recognition-identities.js --report output/score-recognition-history-dry-run.json`

Expected: 生成报告，`git status --short server/data/site-config.json server/data/score-recognition/score-recognition-index.json` 在 dry-run 前后完全一致。

- [ ] **Step 5: 提交迁移工具**

```bash
git add scripts/backfill-score-recognition-identities.js scripts/backfill-score-recognition-identities.test.js
git commit -m "feat: backfill score race identities safely"
```

### Task 14: 文档、真实基准闸门与端到端验收

**Files:**
- Modify: `docs/config-admin-guide.md`
- Modify: `AGENTS.md`
- Modify: `server/fixtures/score-recognition-benchmark.json`
- Modify: `scripts/evaluate-score-recognition.js`

- [ ] **Step 1: 更新操作文档**

`docs/config-admin-guide.md` 必须写明：

```text
1. 只上传完整比赛结算排名表；一张图只能是一场比赛。
2. 系统不读取截图底部时间，比赛身份只由地图、参赛人数和名次-完赛时间序列组成。
3. 非结算页、地图/时间缺失、昵称不确定会阻止提交。
4. 人工选择成员后，只有勾选“记住这个昵称”才会保存积分成员别名。
5. 启动识别前需运行本机 Ollama，并安装 xingyu-score-recognition 模型；不需要 OpenAI Key。
6. 历史身份 backfill 默认只读，只有 --write-index 写识别审计索引，永不修改已提交积分。
```

- [ ] **Step 2: 运行定向测试**

Run: `npm test -- --run server/lib/ollamaVisionClient.test.js server/lib/scoreRecognitionFacts.test.js server/lib/scoreRecognitionMatcher.test.js server/lib/scoreRecognitionAi.test.js server/lib/scoreRecognitionImage.test.js server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionDraft.test.js server/lib/scoreRecognitionService.test.js scripts/evaluate-score-recognition.test.js scripts/backfill-score-recognition-identities.test.js src/admin/ScoreRecognition.test.jsx src/admin/RecognitionEvidence.test.jsx server/index.test.js`

Expected: 全部 PASS，无快照或未处理 Promise 警告。

- [ ] **Step 3: 运行真实截图只读基准**

Run: `npm run evaluate:score-recognition -- --report output/score-recognition-benchmark.json`

Expected report:

```json
{
  "resultSuccessRate": 1,
  "rejectionRate": 1,
  "exactFileDedupRate": 1,
  "sameRaceDedupRate": 1,
  "wrongMergeCount": 0,
  "automaticMemberMismatchCount": 0
}
```

任何指标未达标都停止后续正式流程验收，修正对应事实提取/匹配规则后重新运行；不得降低阈值或删除失败样本。

- [ ] **Step 4: 运行全量测试和构建**

Run: `npm test -- --run`

Expected: 全部测试 PASS。

Run: `npm run build`

Expected: Vite build 成功；前端产物不包含 `openai` SDK。

- [ ] **Step 5: 运行真实 API 验收**

启动本机 Ollama 和项目 API，使用独立测试批次执行：登录 → 上传完整结算图 → 处理 → 查看正常收起/异常展开 → 人工匹配并选择是否记住 → 提交。另上传录像页、同场重复图、洛杉矶和彩虹风车岛两场图。

Expected:

```text
- 录像页显示“非结算页面”，不产生积分。
- 相同文件在模型调用前去重。
- 同场不同截图按相同 identity 去重，并显示历史/本批来源。
- 洛杉矶和彩虹风车岛均保留为不同比赛。
- 阻塞项存在时提交按钮禁用，服务端直接调用 commit 也返回错误。
- 提交后只新增本批有效积分和显式确认的别名。
```

- [ ] **Step 6: 浏览器三档验收**

使用项目现有浏览器控制流程检查后台 `390x844`、`768x1024`、`1280x800`：正常比赛摘要、异常明细、全量积分成员下拉、跨批原图链接和提交禁用状态均可用；页面级横向溢出为 0，宽表仅自身滚动，控制台无新增错误。

- [ ] **Step 7: 检查未修改已提交积分**

在基准、dry-run 和浏览器验收前后分别计算：

Run: `git diff -- server/data/site-config.json`

Expected: 基准和 dry-run 阶段无 diff；仅真实 API 的专用测试配置目录发生预期变化，生产 `server/data/site-config.json` 不被验收脚本修改。

- [ ] **Step 8: 更新交接记录并提交收口**

在 `AGENTS.md` 追加实际完成日期、实现文件、基准指标、全量测试数量、构建结果、API/浏览器验收结果和剩余风险。只写实际输出，不预填测试数量。

```bash
git add docs/config-admin-guide.md AGENTS.md server/fixtures/score-recognition-benchmark.json scripts/evaluate-score-recognition.js
git commit -m "docs: document local score recognition workflow"
```

## 执行纪律

- 每个 Task 独立红绿验证并单独提交；不得一次性改完再补测试。
- 执行开始前使用 `superpowers:using-git-worktrees` 创建独立工作树，避免当前大量未提交改动互相污染。
- 不修改公开积分榜、普通积分编辑、周末录入、现有 `dailyScores` 或 `weekendScores` 历史值。
- 不把昵称、积分成员 ID、截图底部时间、等级或数值列重新加入硬去重键。
- 不对旧 `multiMatch: true` 批次做静默迁移或直接提交；只能只读查看、历史 identity 回填或重新上传。
- 真实基准未达到全部指标前，不把新版识别流程用于正式积分写入。
