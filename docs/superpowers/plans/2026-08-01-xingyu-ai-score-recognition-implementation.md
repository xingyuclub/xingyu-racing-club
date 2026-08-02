# 星屿积分截图识别与自动联动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有积分编辑器中加入 OpenAI 截图识别、批量确认、每人独立三局限制、周末手动积分、识别审计、KW27-KW31 历史迁移和公开积分榜实时刷新。

**Architecture:** 保持 `site-config.json` 为当前公开业务配置来源，新增后台专用的识别批次、历史参与者和周末原始数据边界。OpenAI 只输出结构化截图事实；成员是否当前车队、去重、计分、局次分配和原子提交全部由服务端纯函数完成。React 后台继续以 `ScoreEditor` 为入口，Express 服务端负责文件、AI、历史导入和实时事件。

**Tech Stack:** Vite + React 19, Express 5, Vitest, ExcelJS, `multer`, OpenAI Node SDK（服务端）, SSE (`EventSource`), JSON 文件原子存储。

---

## 现有边界

- 当前公开配置读取入口：`server/index.js` 的 `GET /api/config`。
- 当前管理员配置读取/写入入口：`server/index.js` 的 `/api/admin/config`。
- 当前原子保存实现：`server/lib/configStore.js`。
- 当前积分派生实现：`src/data/siteConfig.js` 的 `hydrateSiteData`。
- 当前积分编辑器：`src/admin/ScoreEditor.jsx`，由 `src/admin/ConfigEditor.jsx` 挂载。
- 当前标准化 Excel 逻辑：`src/admin/scoreWorkbook.js`。
- 当前成员唯一来源：运行时配置的 `roster`；Excel 和截图不能创建当前成员。
- 当前工作区有其他未提交改动。执行本计划时使用独立工作树，避免把无关改动混入功能提交。

## 文件地图

### 新建

- `src/data/scoreRules.js`：计分、成员归一化、重复签名、每人局次分配的纯函数。
- `src/data/scoreRules.test.js`：所有边界规则单测。
- `server/lib/scoreLedger.js`：每日/周末积分事件合并、运行累计和历史成员投影。
- `server/lib/scoreLedger.test.js`：周末总分覆盖、后续工作日累加、当前成员过滤测试。
- `server/lib/scoreRecognitionAi.js`：OpenAI 客户端适配器和结构化输出校验。
- `server/lib/scoreRecognitionAi.test.js`：模拟 OpenAI 客户端测试，不访问真实网络。
- `server/lib/scoreRecognitionStore.js`：识别批次、原图、索引和状态的文件存储。
- `server/lib/scoreRecognitionStore.test.js`：批次原子写入、失败重试、原图保留测试。
- `server/lib/legacyScoreWorkbook.js`：KW27-KW31 旧周表解析和预览数据生成。
- `server/lib/legacyScoreWorkbook.test.js`：用最小 ExcelJS fixture 覆盖不同周表表头和周末字段。
- `server/lib/scoreRecognitionRoutes.js`：识别批次和历史导入路由工厂，便于独立测试。
- `src/admin/ScoreRecognition.jsx`：截图上传、状态、批量预览和确认界面。
- `src/admin/ScoreRecognition.test.jsx`：上传、编辑、阻止提交、部分成员跳过测试。
- `src/admin/WeekendScoreEditor.jsx`：周六/周日三字段手动表格。
- `src/admin/WeekendScoreEditor.test.jsx`：全成员、空值、三字段原样保存测试。
- `src/admin/RecognitionHistory.jsx`：识别记录筛选、批次详情和原图查看。
- `src/admin/RecognitionHistory.test.jsx`：记录加载、失败批次、重试入口测试。
- `server/data/historical-score-members.json`：历史但不属于当前 `roster` 的参与者登记。
- `server/data/score-recognition-index.json`：识别批次索引和状态。
- `.env.example`：`OPENAI_API_KEY`、`OPENAI_VISION_MODEL` 示例配置。

### 修改

- `package.json`、`package-lock.json`：加入服务端 OpenAI SDK 和 `.env` 加载依赖。
- `server/index.js`：挂载识别/历史路由、SSE 配置更新事件、上传目录配置。
- `server/lib/configStore.js`：支持周末数据、历史成员投影和识别提交的版本校验。
- `server/index.test.js`：认证、批次、提交、SSE 和历史导入接口测试。
- `src/data/siteConfig.js`：读取周末总分事件并派生当前成员排行榜。
- `src/data/siteConfig.test.js`：周末覆盖和当前 roster 过滤回归测试。
- `src/admin/ScoreEditor.jsx`：增加标签页、识别提交回调和历史导入入口，保留现有 Excel 编辑。
- `src/admin/ConfigEditor.jsx`：传递后台认证错误和外部提交后的最新配置。
- `src/admin/adminApi.js`：新增识别、周末、历史导入、识别记录和 SSE API 封装。
- `src/admin/admin.css`：上传队列、预览表、错误状态、周末宽表和记录详情布局。
- `src/admin/AdminApp.test.jsx`：登录后可见三类新入口，保存与外部提交后的配置同步。
- `src/admin/scoreWorkbook.js`：标准化导出增加 `周末手动积分` 工作表，保留三字段原值。
- `src/admin/scoreWorkbook.test.js`：周末 sheet、空值和累计总分导出回归测试。
- `src/hooks/useSiteConfig.js`：监听公开配置 SSE 更新，保留窗口 focus 刷新兜底。
- `src/hooks/useSiteConfig.test.js`：Create；测试 EventSource 更新和连接失败回退。
- `AGENTS.md`：每个实施阶段同步记录修改、验证和残留风险。

---

## Task 1: 先固定纯计分和身份规则

**Files:**
- Create: `src/data/scoreRules.js`
- Create: `src/data/scoreRules.test.js`

- [x] **Step 1: 写失败测试，覆盖已确认的业务样例**

测试必须包含以下断言：

```js
expect(scoreTeamRace({ participantCount: 4, rank: 1 })).toBe(4);
expect(scoreTeamRace({ participantCount: 4, rank: 4 })).toBe(1);
expect(scoreTeamRace({ participantCount: 6, rank: 7 })).toBe(0);
expect(scoreRankedRace({ teamRanks: [4, 6] })).toEqual([2, 1]);
expect(scoreRankedRace({ teamRanks: [2, 4, 6] })).toEqual([3, 2, 1]);
expect(buildDuplicateSignature({
  date: '2026-07-27',
  type: 'ranked',
  participants: [{ nickname: 'A', rank: 4 }, { nickname: 'B', rank: 6 }],
})).toBe(buildDuplicateSignature({
  date: '2026-07-27',
  type: 'ranked',
  participants: [{ nickname: ' B ', rank: 6 }, { nickname: 'A', rank: 4 }],
}));
```

另外覆盖 Unicode 前缀、空格、不可见字符、别名映射和同场部分成员已满 3 局的槽位分配。

- [x] **Step 2: 运行单测确认失败**

Run: `npm test -- --run src/data/scoreRules.test.js`

Expected: FAIL，因为纯规则模块尚未存在。

- [x] **Step 3: 实现最小纯函数接口**

实现并导出以下稳定接口：

```js
export function normalizeNickname(value);
export function buildMemberMatcher(roster, aliases);
export function scoreTeamRace({ participantCount, rank });
export function scoreRankedRace({ teamRanks });
export function buildDuplicateSignature({ date, type, participants });
export function assignMemberSlots({ rows, existingRows, date, type });
```

`scoreTeamRace` 使用 `max(min(participantCount, 6) - rank + 1, 0)`；`scoreRankedRace` 按车队成员的游戏名次排序后，以成员数封顶 3 分。`assignMemberSlots` 对每个成员独立计算当天该类型已有局数，已满成员返回 `skipped: 'member-limit'`，其他成员写入第一个空槽。

- [x] **Step 4: 运行单测确认规则通过**

Run: `npm test -- --run src/data/scoreRules.test.js`

Expected: 所有计分、归一化、去重和局次测试 PASS。

- [x] **Step 5: 提交纯规则变更**

```bash
git add src/data/scoreRules.js src/data/scoreRules.test.js
git commit -m "feat: add deterministic score recognition rules"
```

## Task 2: 扩展积分事件和当前成员投影

**Files:**
- Create: `server/lib/scoreLedger.js`
- Create: `server/lib/scoreLedger.test.js`
- Modify: `src/data/siteConfig.js`
- Modify: `src/data/siteConfig.test.js`
- Modify: `server/lib/configStore.js`
- Modify: `server/lib/configStore.test.js`

- [x] **Step 1: 写失败测试固定配置形状**

增加以下 fixture 字段：

```js
weekendScores: [{
  date: '2026-08-02',
  rows: [{ id: memberId, points: 100, score: 12, total: 100 }],
}],
memberAliases: [{ memberId, value: '旧昵称' }],
```

测试：周末 `total` 替换之前累计值；之后 `2026-08-03` 的工作日成绩从周末 total 继续累加；删除 roster 成员后其历史行保留但不进入 `leaderboard`；新增 roster 成员默认从 `basePoints` 开始。

- [x] **Step 2: 运行失败测试**

Run: `npm test -- --run src/data/siteConfig.test.js server/lib/scoreLedger.test.js server/lib/configStore.test.js`

Expected: 新增周末和历史成员断言 FAIL。

- [x] **Step 3: 实现 `scoreLedger`**

使用按日期排序的事件流：工作日事件加 `teamRace + openRace`；周末事件把累计值替换为原始 `total`；后续事件继续从该值计算。所有事件保存 `nicknameSnapshot`，当前公开投影只遍历最新 `roster`。

在 `configStore` 校验中加入：

- `weekendScores` 日期和 rows 结构。
- `points`、`score`、`total` 为非负有限数或明确空值。
- `memberAliases` 只引用存在的当前或历史成员 ID。

- [x] **Step 4: 保持旧配置迁移兼容**

`migrateRawConfig` 在旧配置没有新字段时补 `weekendScores: []`、`memberAliases: []`，不改变已有 `dailyScores` 的原始六局结构。

- [x] **Step 5: 运行测试**

Run: `npm test -- --run src/data/siteConfig.test.js server/lib/scoreLedger.test.js server/lib/configStore.test.js`

Expected: 新旧配置迁移、周末覆盖、后续累加和 roster 过滤全部 PASS。

- [x] **Step 6: 提交积分事件模型**

```bash
git add server/lib/scoreLedger.js server/lib/scoreLedger.test.js server/lib/configStore.js server/lib/configStore.test.js src/data/siteConfig.js src/data/siteConfig.test.js
git commit -m "feat: support weekend score events and roster projections"
```

## Task 3: 建立识别批次文件存储和 OpenAI 适配器

**Files:**
- Create: `server/lib/scoreRecognitionStore.js`
- Create: `server/lib/scoreRecognitionStore.test.js`
- Create: `server/lib/scoreRecognitionAi.js`
- Create: `server/lib/scoreRecognitionAi.test.js`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: 写批次存储失败测试**

覆盖：创建批次目录、按上传顺序保存 JPG/PNG、写入索引、状态从 `uploaded` 到 `processing`/`ready`/`failed`/`committed`、失败重试保留原图、索引临时文件原子替换。

- [x] **Step 2: 写 OpenAI 适配器失败测试**

注入假的客户端，不访问网络。测试模型返回：

```json
{
  "matches": [
    {
      "title": "排位赛·组队道具",
      "date": "2026-07-27",
      "time": "16:50:53",
      "participants": [
        { "nickname": "ˣʸ༩·稳稳", "rank": 1 }
      ]
    }
  ]
}
```

覆盖缺少 `matches`、重复名次、负名次、空昵称、日期非法和模型返回非 JSON 时的明确错误。

- [x] **Step 3: 实现存储接口**

```js
export function createScoreRecognitionStore({ dataDir, storageDir, fileSystem });
// createBatch, saveOriginal, updateBatch, readBatch, listBatches, retryBatch
```

批次元数据只保存文件名、哈希、状态、原始 AI 输出、人工草稿和提交摘要；原图保存到 `server/storage/score-recognition/<batchId>/`。任何写入都采用 `.next` 临时文件后 rename。

- [x] **Step 4: 实现 AI 适配器**

```js
export function createScoreRecognitionAi({ client, model, clock });
// extractMatches({ imageBytes, mimeType, rosterHints })
```

提示词要求模型只提取截图事实，不计算积分，不猜测未知成员。调用失败原样转为可展示错误，调用层不自动写入配置。

- [x] **Step 5: 运行测试并提交**

Run: `npm test -- --run server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionAi.test.js`

Expected: 所有文件存储、失败重试和 JSON 校验测试 PASS。

```bash
git add server/lib/scoreRecognitionStore.js server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionAi.js server/lib/scoreRecognitionAi.test.js package.json package-lock.json .env.example
git commit -m "feat: add score recognition storage and AI adapter"
```

## Task 4: 实现识别领域服务和批次提交

**Files:**
- Create: `server/lib/scoreRecognitionService.js`
- Create: `server/lib/scoreRecognitionService.test.js`
- Modify: `server/lib/scoreRecognitionStore.js`

- [x] **Step 1: 写领域服务测试**

测试输入包含：混合比赛类型、列表截图拆出多场、重复比赛、每人已有 2/3 局、非车队成员、别名、日期冲突和名单版本变化。断言服务输出包含：类型、去重原因、成员匹配、得分、目标槽位和批次级阻止原因。

- [x] **Step 2: 实现统一识别管线**

```js
export function createScoreRecognitionService({ ai, store, configStore, clock });
// previewBatch(batchId)
// editDraft(batchId, draft)
// commitBatch(batchId, expectedRosterVersion)
```

管线顺序固定为：读取最新 roster -> 调 AI -> 展平 matches -> 从标题归类 -> 标准化昵称/别名匹配 -> 计算显示日期冲突 -> 构造内容签名去重 -> 按上传顺序分配每人槽位 -> 生成待确认草稿。提交前再次运行同一管线，防止浏览器草稿绕过校验。

- [x] **Step 3: 实现原子提交**

提交前写 `site-config.json.bak`，把已确认的工作日六局数据合并到指定日期；单个成员已满 3 局时只不写该成员；未满成员写入第一个空槽。提交成功后更新批次索引和配置版本，失败则配置和批次状态都保持可重试状态。

- [x] **Step 4: 运行领域测试**

Run: `npm test -- --run server/lib/scoreRecognitionService.test.js`

Expected: 计分、混合类型、部分成员跳过、重复图、超过 3 局、整批阻止和版本冲突全部 PASS。

- [x] **Step 5: 提交领域服务**

```bash
git add server/lib/scoreRecognitionService.js server/lib/scoreRecognitionService.test.js server/lib/scoreRecognitionStore.js
git commit -m "feat: validate and commit score recognition batches"
```

## Task 5: 增加历史 KW27-KW31 解析和覆盖提交

**Files:**
- Create: `server/lib/legacyScoreWorkbook.js`
- Create: `server/lib/legacyScoreWorkbook.test.js`
- Modify: `server/lib/configStore.js`

- [x] **Step 1: 构造最小 ExcelJS fixture 并写失败测试**

fixture 至少包含一张 KW27 和一张 KW31，覆盖：周一至周五六局、全零成员行、周六/周日 `积分/得分/总分`、不可匹配历史昵称、不同表头位置。测试断言日期为 `2026-06-29` 和 `2026-07-27` 起算，工作日零行保留，周末三个字段不变。

- [x] **Step 2: 实现表头定位和周表解析**

不要按单一绝对列号读取。先定位昵称列和星期合并标题，再从子表头定位队内赛/开黑赛局列、周末三字段列。只接受 `S53-kw27`、`S53-kw28`、`S53-KW29`、`S53-KW30`、`S53-KW31`，其他工作表列入忽略报告。

- [x] **Step 3: 实现历史预览和覆盖合并**

```js
export async function parseLegacyScoreWorkbook(buffer, { roster, aliases, kw27Monday });
export function mergeLegacyScoreImport(config, preview, { startDate, endDate });
```

覆盖范围严格为 `2026-06-29` 至 `2026-08-02`；先完整备份，确认后替换范围内旧记录，范围外记录不动。无法匹配当前 roster 的行登记历史参与者 ID，不加入公开 roster。

- [x] **Step 4: 运行历史迁移测试**

Run: `npm test -- --run server/lib/legacyScoreWorkbook.test.js`

Expected: 工作表筛选、日期、全零行、周末原值、历史成员、范围覆盖和异常报告全部 PASS。

- [ ] **Step 5: 提交历史迁移**

```bash
git add server/lib/legacyScoreWorkbook.js server/lib/legacyScoreWorkbook.test.js server/lib/scoreRecognitionRoutes.js server/lib/configStore.js
git commit -m "feat: import historical KW27-KW31 score sheets"
```

## Task 6: 挂载后台 API、SSE 和认证边界

**Files:**
- Create: `server/lib/scoreRecognitionRoutes.js`
- Modify: `server/index.js`
- Modify: `server/index.test.js`
- Modify: `src/admin/adminApi.js`

- [x] **Step 1: 写接口失败测试**

未登录访问所有新接口均返回 401；登录后测试：

```text
POST /api/admin/score-recognition/batches       # multipart files + date
POST /api/admin/score-recognition/batches/:id/process
GET  /api/admin/score-recognition/batches
GET  /api/admin/score-recognition/batches/:id
PUT  /api/admin/score-recognition/batches/:id/draft
POST /api/admin/score-recognition/batches/:id/commit
POST /api/admin/score-recognition/batches/:id/retry
POST /api/admin/score-history/preview
POST /api/admin/score-history/commit
GET  /api/config/events                         # public SSE
```

测试文件格式白名单、单图 10MB、批次总传输大小、日期必填和成功提交返回最新公开配置。

- [x] **Step 2: 实现批量上传和路由工厂**

在 `createApp` 中传入 `dataDir`、`scoreRecognitionDir` 和可注入 AI 客户端。产品层不限制截图数量，传输层只设置足以保护服务的请求大小上限；前台提示建议不超过 20 张。后台管理路由继续挂在 `auth.requireSession` 后面，公开 SSE 在认证中间件之前单独挂载。

- [x] **Step 3: 实现 SSE 配置事件**

服务端维护连接集合；每次配置、截图提交或历史覆盖成功后发送：

```text
event: config-updated
data: {"version":"<configVersion>"}
```

连接断开时清理集合，不影响配置保存。

- [x] **Step 4: 运行服务端接口测试**

Run: `npm test -- --run server/index.test.js`

Expected: 认证、上传、预览、提交、历史覆盖、失败重试和 SSE 测试 PASS。

- [x] **Step 5: 提交 API 层**

```bash
git add server/index.js server/index.test.js server/lib/scoreRecognitionRoutes.js src/admin/adminApi.js
git commit -m "feat: expose score recognition and live update APIs"
```

## Task 7: 实现后台截图识别界面

**Files:**
- Create: `src/admin/ScoreRecognition.jsx`
- Create: `src/admin/ScoreRecognition.test.jsx`
- Create: `src/admin/RecognitionHistory.jsx`
- Create: `src/admin/RecognitionHistory.test.jsx`
- Modify: `src/admin/ScoreEditor.jsx`
- Modify: `src/admin/ConfigEditor.jsx`
- Modify: `src/admin/admin.css`

- [x] **Step 1: 写 React 失败测试**

覆盖：日期默认当天、一次多文件上传、混合类型结果、列表拆出的多场、原始/修改字段可编辑、非车队标记、别名保存、日期冲突阻止、重复图跳过、部分成员局数满仍保留其他成员、确认前不调用配置保存、提交成功更新父级 draft。

- [x] **Step 2: 实现上传与状态机**

`ScoreRecognition` 只通过 `adminApi.js` 调用服务端；状态严格对应 `uploaded / processing / ready / failed / committed`。失败批次显示原图和重试按钮；提交按钮只在没有阻止原因时启用。

- [x] **Step 3: 实现批量预览编辑器**

每张原图对应一个来源区块；每场比赛对应一张可编辑表格。字段变更只更新批次草稿，点击提交时把完整草稿发送服务端重新校验。局次显示为“成员独立槽位”，不把不同成员强行对齐到同一个全局局号。

- [x] **Step 4: 接入识别记录**

`RecognitionHistory` 通过筛选参数加载批次列表，点击后显示原图、原始 AI 结果、最终草稿、跳过原因和提交摘要；不提供覆盖已保存积分的操作。

- [x] **Step 5: 运行前端定向测试**

Run: `npm test -- --run src/admin/ScoreRecognition.test.jsx src/admin/RecognitionHistory.test.jsx src/admin/ScoreEditor.test.jsx`

Expected: 新界面和现有 Excel 编辑器测试全部 PASS。

- [x] **Step 6: 提交后台识别界面**

```bash
git add src/admin/ScoreRecognition.jsx src/admin/ScoreRecognition.test.jsx src/admin/RecognitionHistory.jsx src/admin/RecognitionHistory.test.jsx src/admin/ScoreEditor.jsx src/admin/ConfigEditor.jsx src/admin/admin.css
git commit -m "feat: add score screenshot review workflow"
```

## Task 8: 实现周末录入与标准化导出

**Files:**
- Create: `src/admin/WeekendScoreEditor.jsx`
- Create: `src/admin/WeekendScoreEditor.test.jsx`
- Modify: `src/admin/ScoreEditor.jsx`
- Modify: `src/admin/scoreWorkbook.js`
- Modify: `src/admin/scoreWorkbook.test.js`
- Modify: `src/admin/admin.css`

- [x] **Step 1: 写失败测试**

测试默认显示当前全部 roster 成员；未参赛行可留空；`积分 / 得分 / 总分` 三列可分别编辑并原样传入 draft；确认保存不自动重算总分。

- [x] **Step 2: 实现周末表格**

按日期选择器显示周六/周日两张表，成员行来自最新 `config.roster`。周末字段存入 `config.weekendScores`，不进入截图识别上传队列。

- [x] **Step 3: 扩展标准化 Excel 导出**

保留现有 `积分明细` 和 `队员期初积分`，新增 `周末手动积分`，列为：`日期、队员编号、队员昵称、积分、得分、总分`。所有三个周末字段按原值写入，空值保持空，不替换成计算结果。

- [x] **Step 4: 运行测试并提交**

Run: `npm test -- --run src/admin/WeekendScoreEditor.test.jsx src/admin/scoreWorkbook.test.js`

Expected: 周末编辑和导出验证 PASS。

```bash
git add src/admin/WeekendScoreEditor.jsx src/admin/WeekendScoreEditor.test.jsx src/admin/ScoreEditor.jsx src/admin/scoreWorkbook.js src/admin/scoreWorkbook.test.js src/admin/admin.css
git commit -m "feat: add weekend score editing and export"
```

## Task 9: 接入公开 H5 实时刷新

**Files:**
- Modify: `src/hooks/useSiteConfig.js`
- Create or Modify: `src/hooks/useSiteConfig.test.js`
- Modify: `src/App.test.jsx`

- [x] **Step 1: 写失败测试**

用假的 `EventSource` 触发 `config-updated`，断言 hook 再次以 `{ cache: 'no-store' }` 请求 `/api/config`；EventSource 出错时页面仍保留现有配置并继续响应 `focus`。

- [x] **Step 2: 实现事件监听**

在现有 `useEffect` 中创建 `new EventSource('/api/config/events')`，只监听 `config-updated`；事件触发时调用既有 `loadConfig`。清理函数关闭连接并移除 focus 监听。公开 SSE 只发送版本号，不暴露后台数据。

- [x] **Step 3: 运行定向回归**

Run: `npm test -- --run src/hooks/useSiteConfig.test.js src/App.test.jsx src/data/siteConfig.test.js`

Expected: 实时刷新和现有前台派生测试 PASS。

- [x] **Step 4: 提交前台联动**

```bash
git add src/hooks/useSiteConfig.js src/hooks/useSiteConfig.test.js src/App.test.jsx
git commit -m "feat: refresh public scores on admin commits"
```

## Task 10: 集成测试、浏览器验收和文档收口

**Files:**
- Modify: `src/admin/AdminApp.test.jsx`
- Modify: `server/index.test.js`
- Modify: `AGENTS.md`
- Modify: `docs/config-admin-guide.md`

- [ ] **Step 1: 增加后台端到端测试**

在现有登录测试中挂载 `ScoreEditor`，模拟 `/api/admin/score-recognition/batches` 返回待确认草稿，再确认提交，断言父级配置和公开配置均更新，且 API Key 从未出现在 DOM 或请求体中。

- [ ] **Step 2: 增加历史导入端到端测试**

上传最小旧周表 fixture，预览 `KW27-KW31`，确认覆盖重叠日期，断言 `.bak` 生成、范围外记录保留、周末三字段原样保留、历史成员不进入公开 roster。

- [ ] **Step 3: 运行完整测试和构建**

Run: `npm test`

Expected: 现有测试与新增测试全部 PASS，且无测试文件失败。

Run: `npm run build`

Expected: Vite 构建成功；OpenAI SDK 只在服务端入口使用，不被首页前端 bundle 引入。

- [ ] **Step 4: 启动 API 和前端进行浏览器验收**

Run: `npm run dev:api` and `npm run dev` (use unused ports if 3000/3001 are occupied).

验证：

- `390x844`：上传、预览表、周末编辑、错误提示无页面横向溢出。
- `768x1024`：多场截图预览和识别记录区可滚动。
- `1280x800`：后台宽表仅自身横向滚动，公开 H5 自动刷新积分榜。
- 识别提交后检查 `/api/config` 和页面积分榜一致。
- 检查原图、批次 JSON、历史参与者文件和配置 `.bak` 均存在。

- [ ] **Step 5: 更新交接说明**

在 `AGENTS.md` 记录：新增文件、API、`.env` 前置条件、测试数量、构建结果、浏览器视口结果和任何剩余风险。同步更新 `docs/config-admin-guide.md` 的后台操作步骤和“不覆盖已录入局次”规则。

- [ ] **Step 6: 完成分支审查**

Run: `git diff --check` and `git status --short`

确认没有临时截图、真实 API Key、`server/config/admin.local.json` 或识别原图被加入 Git。

---

## 执行顺序与检查点

1. Task 1-2：先锁定规则和积分事件派生；完成后 `npm test -- --run src/data server/lib/scoreLedger`。
2. Task 3-4：实现 AI 适配器、存储和领域服务；完成后只用假客户端验证，不产生 API 费用。
3. Task 5-6：接入历史迁移和服务端接口；完成后验证认证、备份和原子提交。
4. Task 7-8：实现后台识别、周末和导出；完成后运行前端定向测试。
5. Task 9-10：实时刷新、端到端、构建和浏览器验收；所有结果写回 `AGENTS.md`。

每个 Task 通过对应测试后再提交。OpenAI 真实调用只在本地 `.env` 已配置且使用者明确开始识别时发生；单元测试统一使用注入的假客户端。
