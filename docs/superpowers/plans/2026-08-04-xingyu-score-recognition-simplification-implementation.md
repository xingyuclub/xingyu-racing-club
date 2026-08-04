# 星屿截图识别简化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将截图识别收敛为“用户选择比赛类型，AI 只读取昵称和名次，服务端算分并按人物汇总，用户通过原图证据审核后提交”。

**Architecture:** 批次持久化 `raceType` 和逐图原始识别结果；新增纯函数投影层，将原始结果、人工修正和站点配置派生为逐条证据、人物汇总、异常及提交资格。前端只编辑昵称映射、忽略状态和名次，所有积分、槽位与汇总始终由服务端重算。

**Tech Stack:** Vite 6、React 19、Express 5、Vitest、Testing Library、OpenAI-compatible Ollama API、Sharp

---

## 文件边界

- `server/lib/scoreRecognitionStore.js`：持久化批次类型、原始识别结果、人工修正和原图读取。
- `server/lib/scoreRecognitionAi.js`：只负责从单张图片提取 `matches[].participants[].nickname/rank`。
- `server/lib/scoreRecognitionDraft.js`：新增纯函数模块，集中完成匹配、计分、去重、槽位、异常和人物汇总。
- `server/lib/scoreRecognitionService.js`：编排逐图识别、草稿重算、审核修改和最终提交。
- `server/lib/scoreRecognitionRoutes.js`：批次类型校验、审核修改和原图读取 API。
- `src/admin/ScoreRecognition.jsx`：批次上传、汇总审核和提交状态机。
- `src/admin/RecognitionEvidence.jsx`：新增聚焦组件，渲染人物依据、异常修正和原图入口。
- `src/admin/RecognitionHistory.jsx`、`src/admin/ScoreEditor.jsx`：从历史记录恢复 `ready` 批次。
- `src/admin/adminApi.js`：封装新增请求参数和审核 API。
- `src/admin/admin.css`：汇总、证据、异常和响应式样式。

### Task 1: 批次比赛类型契约

**Files:**
- Modify: `server/lib/scoreRecognitionStore.js`
- Modify: `server/lib/scoreRecognitionStore.test.js`
- Modify: `server/lib/scoreRecognitionRoutes.js`
- Modify: `server/lib/scoreRecognitionService.test.js`
- Modify: `server/index.test.js`

- [ ] **Step 1: 为批次存储写失败测试**

在 `scoreRecognitionStore.test.js` 的创建批次用例中传入 `raceType: 'team'`，断言读取和列表结果都包含该字段：

```js
const created = await store.createBatch({
  id: 'batch-team',
  date: '2026-08-03',
  raceType: 'team',
  files: [{ name: 'a.jpg', bytes: Buffer.from([1]), mimeType: 'image/jpeg' }],
});
expect(created.raceType).toBe('team');
expect((await store.readBatch('batch-team')).raceType).toBe('team');
```

- [ ] **Step 2: 运行存储测试确认红灯**

Run: `npm test -- --run server/lib/scoreRecognitionStore.test.js`

Expected: FAIL，因为 `createBatch` 尚未保存 `raceType`。

- [ ] **Step 3: 保存批次类型**

将签名改为 `createBatch({ id, date, raceType, files = [] })`，并在新批次对象中保存：

```js
const batch = {
  id: batchId,
  date,
  raceType,
  status: 'uploaded',
  images,
  createdAt: now,
  updatedAt: now,
};
```

- [ ] **Step 4: 为上传 API 写类型校验失败测试**

在 `server/index.test.js` 覆盖缺少类型、非法类型和合法类型：

```js
await agent.post('/api/admin/score-recognition/batches')
  .field('date', '2026-08-03')
  .attach('files', jpgBytes, { filename: 'a.jpg', contentType: 'image/jpeg' })
  .expect(400);

await agent.post('/api/admin/score-recognition/batches')
  .field('date', '2026-08-03')
  .field('raceType', 'unknown')
  .attach('files', jpgBytes, { filename: 'a.jpg', contentType: 'image/jpeg' })
  .expect(400);

const created = await agent.post('/api/admin/score-recognition/batches')
  .field('date', '2026-08-03')
  .field('raceType', 'ranked')
  .attach('files', jpgBytes, { filename: 'a.jpg', contentType: 'image/jpeg' })
  .expect(201);
expect(created.body.raceType).toBe('ranked');
```

- [ ] **Step 5: 运行 API 测试确认红灯**

Run: `npm test -- --run server/index.test.js`

Expected: FAIL，缺少或非法类型仍被接受。

- [ ] **Step 6: 实现严格类型校验**

在路由模块增加：

```js
const SCORE_RACE_TYPES = new Set(['team', 'ranked']);
```

上传时校验并传入存储：

```js
const raceType = request.body?.raceType;
if (!SCORE_RACE_TYPES.has(raceType)) {
  return response.status(400).json({ error: '请选择队内赛或排位赛' });
}
const batch = await recognitionStore.createBatch({
  id: randomUUID(),
  date,
  raceType,
  files,
});
```

同步给 `server/index.test.js` 中所有既有截图上传请求补 `.field('raceType', 'team')`，并给 `scoreRecognitionService.test.js` 后续使用的批次 fixture 补对应类型，避免旧测试绕过新契约。

- [ ] **Step 7: 运行测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionStore.test.js server/index.test.js`

Expected: 两个文件全部通过。

```powershell
git add server/lib/scoreRecognitionStore.js server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionRoutes.js server/lib/scoreRecognitionService.test.js server/index.test.js
git commit -m "feat: require score recognition race type"
```

### Task 2: 最小化 AI 输入输出

**Files:**
- Modify: `server/lib/scoreRecognitionAi.js`
- Modify: `server/lib/scoreRecognitionAi.test.js`

- [ ] **Step 1: 写最小契约失败测试**

将有效响应改为只包含参与者，并断言提示词、Schema 和返回结果不再要求旧字段：

```js
const minimalPayload = {
  matches: [{
    participants: [
      { nickname: '十二', rank: 2 },
      { nickname: '黑岩', rank: 4 },
    ],
  }],
};

const result = await ai.extractMatches({
  imageBytes: Buffer.from([1]),
  mimeType: 'image/jpeg',
});
const request = client.chat.completions.create.mock.calls[0][0];
expect(result).toEqual(minimalPayload.matches);
expect(request.messages[0].content).not.toMatch(/日期|时间|MVP|胜负|地图/);
expect(request.response_format.json_schema.schema.properties.matches.items.properties)
  .toEqual({ participants: expect.any(Object) });
```

- [ ] **Step 2: 运行 AI 测试确认红灯**

Run: `npm test -- --run server/lib/scoreRecognitionAi.test.js`

Expected: FAIL，因为现有校验仍要求 `title/date/time`。

- [ ] **Step 3: 收窄提示词、Schema 和校验**

将提示词改为只描述截图结构和两列事实：

```js
const PROMPT = [
  '你是赛车游戏截图读取助手，只读取截图中可见的玩家昵称和游戏名次。',
  '结算详情截图只有一场；胜利和失败两个区域仍属于同一场。',
  '最近比赛列表按独立比赛卡片拆成多场。',
  '不要读取日期、时间、地图、胜负、MVP、攻击、防御或援助。',
  '只返回 JSON，不计算积分，不根据成员名单猜测昵称。',
].join('\n');
```

Schema 的单场属性只保留：

```js
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
required: ['participants'],
additionalProperties: false,
```

`validateMatch` 只校验对象、非空参与者、昵称、正整数名次和单场名次唯一；`extractMatches` 删除 `rosterHints` 与 `batchDate` 参数，继续保留 `temperature: 0`、Markdown 代码围栏兼容和图片预处理。

- [ ] **Step 4: 运行 AI 测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionAi.test.js`

Expected: 全部通过。

```powershell
git add server/lib/scoreRecognitionAi.js server/lib/scoreRecognitionAi.test.js
git commit -m "refactor: minimize score recognition output"
```

### Task 3: 纯函数草稿投影与人物汇总

**Files:**
- Create: `server/lib/scoreRecognitionDraft.js`
- Create: `server/lib/scoreRecognitionDraft.test.js`

- [ ] **Step 1: 写队内赛汇总失败测试**

使用两场、一个路人和一个人工忽略项，定义期望契约：

```js
const draft = buildRecognitionDraft({
  batch: { id: 'b1', date: '2026-08-03', raceType: 'team' },
  observations: [{
    imageIndex: 0,
    matches: [
      { participants: [{ nickname: '十二', rank: 1 }, { nickname: '路人', rank: 2 }] },
      { participants: [{ nickname: '十二', rank: 2 }, { nickname: '黑岩', rank: 1 }] },
    ],
  }],
  reviews: { 'i0-m0-p1': { ignored: true } },
  config,
});

expect(draft.summary).toEqual([
  expect.objectContaining({ name: '十二', score: 3, evidenceIds: ['i0-m0-p0', 'i0-m1-p0'] }),
  expect.objectContaining({ name: '黑岩', score: 2, evidenceIds: ['i0-m1-p1'] }),
]);
expect(draft.canCommit).toBe(true);
```

- [ ] **Step 2: 写排位赛、异常和槽位失败测试**

覆盖以下断言：

```js
expect(ranked.summary.map((item) => [item.name, item.score]))
  .toEqual([['十二', 2], ['黑岩', 1]]);
expect(unmatched.issues).toContainEqual(expect.objectContaining({
  evidenceId: 'i0-m0-p1',
  code: 'unmatched',
}));
expect(unmatched.canCommit).toBe(false);
expect(limit.evidence.find((item) => item.id === 'i0-m0-p0').warning)
  .toBe('member-limit');
```

同时覆盖：同场重复名次、非法人工名次、重复场次不占槽位、忽略路人仍计入队内赛人数、人工 `memberId` 映射覆盖自动匹配。

- [ ] **Step 3: 运行新测试确认红灯**

Run: `npm test -- --run server/lib/scoreRecognitionDraft.test.js`

Expected: FAIL，模块尚不存在。

- [ ] **Step 4: 实现唯一的派生入口**

导出：

```js
export function buildRecognitionDraft({ batch, observations, reviews = {}, config })
```

实现顺序固定为：

```js
const evidence = flattenObservations(observations, reviews);
const issues = validateEvidence(evidence);
const races = groupEvidenceByRace(evidence);
matchRosterMembers(races, config);
scoreRaces(races, batch.raceType);
markDuplicateRaces(races, batch.date, batch.raceType);
assignSlots(races, config.dailyScores, batch.date, batch.raceType);
const summary = summarizeMembers(races);
return {
  batchId: batch.id,
  batchDate: batch.date,
  raceType: batch.raceType,
  rosterVersion: computeRosterVersion(config),
  evidence: races.flatMap((race) => race.evidence),
  summary,
  issues,
  canCommit: issues.length === 0,
};
```

实现细节：

- 证据 ID 固定为 `i{imageIndex}-m{matchIndex}-p{participantIndex}`。
- `reviews[evidenceId].rank` 覆盖识别名次。
- `reviews[evidenceId].memberId` 指向 `roster` ID，并覆盖自动昵称匹配。
- `reviews[evidenceId].ignored === true` 表示明确的非车队成员。
- 证据中的 `memberId` 始终表示 `roster` ID；匹配成功后另存 `scoreMemberId`，人物汇总和最终写入都使用 `scoreMemberId`。
- 队内赛 `participantCount` 使用整场全部证据数量，包括忽略的路人。
- 排位赛只对已匹配且未忽略成员调用 `scoreRankedRace`。
- 汇总只累计非重复、未跳过且已有槽位的证据。
- `summary` 按分数降序、姓名升序稳定排序。

- [ ] **Step 5: 运行草稿测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionDraft.test.js src/data/scoreRules.test.js`

Expected: 全部通过。

```powershell
git add server/lib/scoreRecognitionDraft.js server/lib/scoreRecognitionDraft.test.js
git commit -m "feat: derive reviewable score summaries"
```

### Task 4: 服务编排、审核修改与原图 API

**Files:**
- Modify: `server/lib/scoreRecognitionStore.js`
- Modify: `server/lib/scoreRecognitionStore.test.js`
- Modify: `server/lib/scoreRecognitionService.js`
- Modify: `server/lib/scoreRecognitionService.test.js`
- Modify: `server/lib/scoreRecognitionRoutes.js`
- Modify: `server/index.test.js`

- [ ] **Step 1: 写服务重算失败测试**

测试识别后保存原始观察值，并通过审核修改重算：

```js
const first = await service.previewBatch('b1');
expect(first.canCommit).toBe(false);
expect(first.issues[0].code).toBe('unmatched');

const reviewed = await service.reviewBatch('b1', {
  evidenceId: first.issues[0].evidenceId,
  ignored: true,
});
expect(reviewed.canCommit).toBe(true);
expect((await store.readBatch('b1')).reviews[first.issues[0].evidenceId])
  .toEqual({ ignored: true });
```

再测试修改 `rank`、映射 `memberId` 后分数与 `summary` 变化，以及 `canCommit: false` 时 `commitBatch` 抛出“仍有未处理异常”。

- [ ] **Step 2: 写逐图错误失败测试**

让第二次 `ai.extractMatches` 抛错，断言 API 返回：

```js
expect(response.body.error).toMatch(/第 2 张截图/);
expect(detail.body.status).toBe('failed');
```

- [ ] **Step 3: 写原图读取失败测试**

存储测试调用：

```js
const image = await store.readImage('b1', 0);
expect(image.mimeType).toBe('image/jpeg');
expect(image.bytes).toEqual(Buffer.from([1]));
await expect(store.readImage('b1', 9)).rejects.toThrow(/image not found/);
```

API 测试登录后请求 `/api/admin/score-recognition/batches/:id/images/0`，断言状态 200 和 `content-type: image/jpeg`。

- [ ] **Step 4: 运行相关测试确认红灯**

Run: `npm test -- --run server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionService.test.js server/index.test.js`

Expected: FAIL，因为审核重算和原图 API 尚不存在。

- [ ] **Step 5: 改造服务使用原始观察值**

`previewBatch` 逐图建立：

```js
const observations = [];
for (let imageIndex = 0; imageIndex < batch.images.length; imageIndex += 1) {
  const image = batch.images[imageIndex];
  try {
    observations.push({
      imageIndex,
      matches: await ai.extractMatches({
        imageBytes: await fs.readFile(image.path),
        mimeType: image.mimeType,
      }),
    });
  } catch (error) {
    throw new Error(`第 ${imageIndex + 1} 张截图识别失败：${error.message}`);
  }
}
const draft = buildRecognitionDraft({ batch, observations, reviews: {}, config });
await store.updateBatch(batchId, { status: 'ready', observations, reviews: {}, draft });
return draft;
```

新增：

```js
async function reviewBatch(batchId, change) {
  const batch = await store.readBatch(batchId);
  const reviews = { ...(batch.reviews || {}) };
  reviews[change.evidenceId] = {
    ...(reviews[change.evidenceId] || {}),
    ...(change.rank === undefined ? {} : { rank: change.rank }),
    ...(change.memberId === undefined ? {} : { memberId: change.memberId }),
    ...(change.ignored === undefined ? {} : { ignored: change.ignored }),
  };
  const config = await configStore.read();
  const draft = buildRecognitionDraft({ batch, observations: batch.observations, reviews, config });
  await store.updateBatch(batchId, { reviews, draft });
  return draft;
}
```

`commitBatch` 在名单版本校验前增加：

```js
if (!batch.draft?.canCommit) {
  throw Object.assign(new Error('仍有未处理的识别异常，无法提交'), { statusCode: 422 });
}
```

提交遍历有效 `draft.evidence`，继续按 `raceType` 写入对应三槽。

- [ ] **Step 6: 增加审核与原图路由**

新增：

```js
router.put('/batches/:id/review', async (request, response, next) => {
  try {
    const { evidenceId, rank, memberId, ignored } = request.body || {};
    if (typeof evidenceId !== 'string' || !evidenceId) {
      return response.status(400).json({ error: '缺少证据 ID' });
    }
    if (rank !== undefined && (!Number.isInteger(rank) || rank < 1)) {
      return response.status(400).json({ error: '名次必须是正整数' });
    }
    response.json(await getService().reviewBatch(request.params.id, {
      evidenceId,
      rank,
      memberId,
      ignored,
    }));
  }
  catch (error) { next(error); }
});

router.get('/batches/:id/images/:index', async (request, response, next) => {
  try {
    const image = await recognitionStore.readImage(request.params.id, Number(request.params.index));
    response.type(image.mimeType).send(image.bytes);
  } catch (error) { next(error); }
});
```

`readImage` 必须先从批次 `images[index]` 取服务端保存路径，再读取文件；不得接受请求直接传文件路径。

`reviewBatch` 必须确认 `evidenceId` 存在于当前 `observations`；传入 `memberId` 时必须确认它存在于当前 `roster`。无效引用返回带 `statusCode: 400` 的错误，不写入 `reviews`。

- [ ] **Step 7: 运行相关测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionService.test.js server/index.test.js`

Expected: 全部通过。

```powershell
git add server/lib/scoreRecognitionStore.js server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionService.js server/lib/scoreRecognitionService.test.js server/lib/scoreRecognitionRoutes.js server/index.test.js
git commit -m "feat: add recognition evidence review flow"
```

### Task 5: 后台 API 与比赛类型选择

**Files:**
- Modify: `src/admin/adminApi.js`
- Modify: `src/admin/ScoreRecognition.jsx`
- Modify: `src/admin/ScoreRecognition.test.jsx`
- Modify: `src/admin/ScoreEditor.jsx`

- [ ] **Step 1: 写上传类型和 API 失败测试**

在 `ScoreRecognition.test.jsx` 检查默认队内赛、切换排位赛和 FormData：

```js
expect(screen.getByRole('radio', { name: '队内赛' })).toBeChecked();
await userEvent.click(screen.getByRole('radio', { name: '排位赛' }));
await userEvent.upload(screen.getByLabelText('上传截图'), file);
const uploadBody = fetchMock.mock.calls[0][1].body;
expect(uploadBody.get('raceType')).toBe('ranked');
```

并为 `reviewRecognitionEvidence(id, change)` 断言 `PUT /review` JSON 请求。

- [ ] **Step 2: 运行组件测试确认红灯**

Run: `npm test -- --run src/admin/ScoreRecognition.test.jsx`

Expected: FAIL，因为没有类型控件和 `raceType` 表单字段。

- [ ] **Step 3: 实现 API 封装和分段类型控件**

修改上传签名：

```js
export function uploadRecognitionBatch(date, raceType, files) {
  const body = new FormData();
  body.append('date', date);
  body.append('raceType', raceType);
  files.forEach((file) => body.append('files', file));
  return call('/api/admin/score-recognition/batches', { method: 'POST', body });
}

export function reviewRecognitionEvidence(id, change) {
  return call(
    '/api/admin/score-recognition/batches/' + encodeURIComponent(id) + '/review',
    json('PUT', change),
  );
}
```

`ScoreRecognition` 增加 `raceType` 状态和两个 radio；上传或处理期间禁用。调用改为 `uploadRecognitionBatch(date, raceType, files)`。

提交后使用服务器返回的配置：

```js
const result = await commitRecognitionBatch(batchId, draft.rosterVersion);
setStatus('committed');
onCommitted?.(result.config);
```

`ScoreEditor` 改为：

```jsx
<ScoreRecognition config={config} onCommitted={onChange} />
```

- [ ] **Step 4: 运行组件测试并提交**

Run: `npm test -- --run src/admin/ScoreRecognition.test.jsx src/admin/ScoreEditor.test.jsx`

Expected: 全部通过。

```powershell
git add src/admin/adminApi.js src/admin/ScoreRecognition.jsx src/admin/ScoreRecognition.test.jsx src/admin/ScoreEditor.jsx
git commit -m "feat: select recognition race type"
```

### Task 6: 人物汇总、证据与异常修正界面

**Files:**
- Create: `src/admin/RecognitionEvidence.jsx`
- Create: `src/admin/RecognitionEvidence.test.jsx`
- Modify: `src/admin/ScoreRecognition.jsx`
- Modify: `src/admin/ScoreRecognition.test.jsx`
- Modify: `src/admin/admin.css`

- [ ] **Step 1: 写汇总与依据失败测试**

构造包含一个正常人物、一个未匹配项和一个三局上限提醒的草稿：

```js
render(<RecognitionEvidence
  batchId="b1"
  config={config}
  draft={draft}
  busy={false}
  onReview={vi.fn()}
/>);

expect(screen.getByText('十二')).toBeInTheDocument();
expect(screen.getByText('+8 分')).toBeInTheDocument();
expect(screen.queryByText('截图 1')).not.toBeInTheDocument();
await userEvent.click(screen.getByRole('button', { name: /查看十二的依据/ }));
expect(screen.getByText(/截图 1/)).toBeInTheDocument();
expect(screen.getByRole('link', { name: /查看截图 1/ }))
  .toHaveAttribute('href', '/api/admin/score-recognition/batches/b1/images/0');
```

- [ ] **Step 2: 写异常修正失败测试**

断言未匹配项默认展开，支持成员映射、名次编辑和忽略：

```js
await userEvent.selectOptions(screen.getByLabelText('未匹配昵称 路人 对应成员'), 'roster-1');
expect(onReview).toHaveBeenCalledWith({ evidenceId: 'i0-m0-p1', memberId: 'roster-1', ignored: false });

await userEvent.clear(screen.getByLabelText('路人名次'));
await userEvent.type(screen.getByLabelText('路人名次'), '3');
await userEvent.tab();
expect(onReview).toHaveBeenCalledWith({ evidenceId: 'i0-m0-p1', rank: 3 });

await userEvent.click(screen.getByRole('button', { name: '标记路人为非车队成员' }));
expect(onReview).toHaveBeenCalledWith({ evidenceId: 'i0-m0-p1', ignored: true });
```

断言 `member-limit` 使用提醒样式而非错误样式，且 `draft.canCommit === false` 时提交按钮禁用。

- [ ] **Step 3: 运行新组件测试确认红灯**

Run: `npm test -- --run src/admin/RecognitionEvidence.test.jsx src/admin/ScoreRecognition.test.jsx`

Expected: FAIL，新组件尚不存在。

- [ ] **Step 4: 实现聚焦审核组件**

`RecognitionEvidence` 只负责渲染，不自行计算分数：

```jsx
export function RecognitionEvidence({ batchId, config, draft, busy, onReview }) {
  return (
    <div className="recognition-review">
      <section className="recognition-summary" aria-label="人物积分汇总">
        {draft.summary.map((member) => (
          <details key={member.id} className="recognition-member">
            <summary>
              <span>{member.name}</span>
              <strong>+{member.score} 分</strong>
              <span className="recognition-evidence-label">查看依据</span>
            </summary>
            {member.evidenceIds.map((evidenceId) => {
              const item = draft.evidence.find((entry) => entry.id === evidenceId);
              return <EvidenceRow key={evidenceId} batchId={batchId} item={item} />;
            })}
          </details>
        ))}
      </section>
      <section className="recognition-issues" aria-label="待处理识别项">
        {draft.issues.map((issue) => (
          <IssueEditor
            key={issue.evidenceId}
            issue={issue}
            evidence={draft.evidence.find((item) => item.id === issue.evidenceId)}
            roster={config.roster}
            busy={busy}
            onReview={onReview}
          />
        ))}
      </section>
    </div>
  );
}
```

正常人物使用原生 `<details>` 默认收起；异常项不使用 `<details>`，始终可见。图片链接新窗口打开，按钮使用 Lucide `Image`、`UserCheck`、`Ban` 图标并保留文字命令。

名次输入在组件内保留临时字符串，只有失焦或按 Enter 且值为正整数时才调用 `onReview`；清空输入的中间状态不得发请求，避免每次键入都触发整批重算。

- [ ] **Step 5: 接入服务端重算**

`ScoreRecognition` 的审核处理：

```js
const review = async (change) => {
  setStatus('reviewing');
  setError('');
  try {
    setDraft(await reviewRecognitionEvidence(batchId, change));
    setStatus('ready');
  } catch (next) {
    setError(next.message);
    setStatus('ready');
  }
};
```

提交按钮使用：

```jsx
<button disabled={!draft.canCommit || status !== 'ready'} onClick={commit}>
  <CheckCircle2 aria-hidden="true" size={16} />
  提交确认
</button>
```

- [ ] **Step 6: 添加响应式样式并验证**

样式要求：

- 汇总为紧凑全宽列表，不新增嵌套卡片。
- 人物名、总分和展开命令在 390px 下允许换行，不横向溢出。
- 错误使用红色左边框和浅红背景；三局上限提醒使用琥珀色，不与错误混用。
- 证据行用稳定网格展示截图、名次、分数和槽位；390px 下切为两列。
- 所有数字输入和下拉框有稳定最小宽度，触摸目标高度不低于 36px。

Run: `npm test -- --run src/admin/RecognitionEvidence.test.jsx src/admin/ScoreRecognition.test.jsx`

Expected: 全部通过。

- [ ] **Step 7: 提交**

```powershell
git add src/admin/RecognitionEvidence.jsx src/admin/RecognitionEvidence.test.jsx src/admin/ScoreRecognition.jsx src/admin/ScoreRecognition.test.jsx src/admin/admin.css
git commit -m "feat: review recognition scores by member"
```

### Task 7: 从识别记录恢复待确认批次

**Files:**
- Modify: `src/admin/RecognitionHistory.jsx`
- Modify: `src/admin/RecognitionHistory.test.jsx`
- Modify: `src/admin/ScoreEditor.jsx`
- Modify: `src/admin/ScoreEditor.test.jsx`
- Modify: `src/admin/ScoreRecognition.jsx`
- Modify: `src/admin/adminApi.js`

- [ ] **Step 1: 写继续审核失败测试**

历史列表中 `ready` 批次显示“继续审核”，旧版无 `raceType` 的批次显示“旧版批次需重新上传”：

```js
expect(within(readyItem).getByRole('button', { name: /继续审核/ })).toBeInTheDocument();
await userEvent.click(within(readyItem).getByRole('button', { name: /继续审核/ }));
expect(onOpen).toHaveBeenCalledWith('batch-ready');
expect(within(legacyItem).getByText('旧版批次需重新上传')).toBeInTheDocument();
```

- [ ] **Step 2: 写恢复草稿失败测试**

`ScoreRecognition` 接收 `initialBatchId="batch-ready"` 时请求详情并显示汇总：

```js
render(<ScoreRecognition config={config} initialBatchId="batch-ready" />);
await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
  '/api/admin/score-recognition/batches/batch-ready',
  expect.any(Object),
));
expect(await screen.findByText('+8 分')).toBeInTheDocument();
```

- [ ] **Step 3: 运行相关测试确认红灯**

Run: `npm test -- --run src/admin/RecognitionHistory.test.jsx src/admin/ScoreRecognition.test.jsx src/admin/ScoreEditor.test.jsx`

Expected: FAIL，历史记录没有打开回调，识别页不会恢复批次。

- [ ] **Step 4: 实现标签页协调**

`ScoreEditor` 增加 `recognitionBatchId` 状态：

```jsx
{tab === 'recognition' && (
  <ScoreRecognition
    config={config}
    initialBatchId={recognitionBatchId}
    onCommitted={onChange}
  />
)}
{tab === 'history' && (
  <RecognitionHistory onOpen={(id) => {
    setRecognitionBatchId(id);
    setTab('recognition');
  }} />
)}
```

`RecognitionHistory` 仅对 `status === 'ready' && batch.raceType` 显示继续审核。`ScoreRecognition` 使用现有 `getRecognitionBatch` 读取详情，将 `batch.draft`、`batch.id`、`batch.date` 和 `batch.raceType` 恢复到状态中。

- [ ] **Step 5: 运行测试并提交**

Run: `npm test -- --run src/admin/RecognitionHistory.test.jsx src/admin/ScoreRecognition.test.jsx src/admin/ScoreEditor.test.jsx`

Expected: 全部通过。

```powershell
git add src/admin/RecognitionHistory.jsx src/admin/RecognitionHistory.test.jsx src/admin/ScoreEditor.jsx src/admin/ScoreEditor.test.jsx src/admin/ScoreRecognition.jsx src/admin/adminApi.js
git commit -m "feat: resume score recognition reviews"
```

### Task 8: 文档、全量验证与真实截图验收

**Files:**
- Modify: `docs/config-admin-guide.md`
- Modify: `AGENTS.md`（仅在该文件存在且交接规则要求同步时）

- [ ] **Step 1: 更新使用说明**

在截图识别章节明确：

```text
1. 选择批次日期。
2. 选择“队内赛”或“排位赛”；一批截图只能使用一种类型。
3. 上传截图后先核对人物汇总。
4. 正常人物可按需展开查看截图、名次和单局分数。
5. 未匹配昵称必须映射到当前成员，或明确标记为非车队成员。
6. 修正名次后分数由服务端自动重算；不要手工填写汇总分。
7. 没有未处理异常后才能提交。
```

删除任何仍描述 AI 会读取标题、日期、时间或直接计算积分的旧说明。

- [ ] **Step 2: 运行定向测试**

Run:

```powershell
npm test -- --run server/lib/scoreRecognitionAi.test.js server/lib/scoreRecognitionDraft.test.js server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionService.test.js server/index.test.js src/admin/RecognitionEvidence.test.jsx src/admin/ScoreRecognition.test.jsx src/admin/RecognitionHistory.test.jsx src/admin/ScoreEditor.test.jsx
```

Expected: 所有定向测试通过，无警告或未处理 Promise rejection。

- [ ] **Step 3: 运行全量测试和构建**

Run:

```powershell
ollama stop xingyu-score-recognition
npm test -- --run
npm run build
```

Expected: 全量测试 0 失败；Vite 构建退出码 0；ExcelJS 仍为独立动态代码块。

- [ ] **Step 4: 使用 15 张真实截图做 API 验收**

使用一次性 Node 验证脚本创建临时目录、临时配置副本和临时 `createApp` 实例，通过 Supertest 调用真实路由，并让 AI 客户端指向当前 Ollama。将 15 张截图按队内赛和排位赛拆成两个临时批次，确认：

- 每批 API 从 `uploaded` 到 `ready`，不会永久停在 `processing`。
- AI 响应只包含昵称和名次。
- 人物汇总中的每条分数都能定位到原图证据。
- 故意将一个未匹配昵称映射到成员后，服务端返回的新汇总正确。
- 故意修改一个名次后，单局分数和人物总分同步变化。
- 将路人标记忽略后，队内赛参赛人数不变。
- 存在未处理异常时提交返回 422；全部处理后提交成功。

临时实例的 `dataDir`、`storageDir`、管理员凭据和配置文件全部位于系统临时目录。脚本在 `finally` 中递归删除该临时目录；不得连接正式 `server/data`，也不得修改用户已有识别记录或正式积分配置。

- [ ] **Step 5: 浏览器验收**

在 `390x844`、`768x1024`、`1280x800` 三档验证：

- 类型选择、上传、人物汇总、异常修正、原图查看和提交完整可用。
- 正常证据默认收起，异常默认展开。
- 移动端无页面级横向溢出，证据表单不遮挡提交按钮。
- 识别记录可以重新打开 `ready` 批次。
- 控制台无新增错误或 React 警告。

- [ ] **Step 6: 提交文档并记录验证结果**

```powershell
git add docs/config-admin-guide.md
if (Test-Path AGENTS.md) { git add AGENTS.md }
git commit -m "docs: document simplified score recognition"
```

若 `AGENTS.md` 不存在或不属于仓库，只提交 `docs/config-admin-guide.md`。最终报告必须明确本地模型仍需人工核对，不使用“完全准确”表述。
