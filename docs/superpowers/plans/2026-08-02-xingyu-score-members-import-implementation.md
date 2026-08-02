# 星屿积分身份与首次 Excel 导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将积分榜人物从后台成员 roster 中独立出来，按 Excel 名称完成 KW27-KW31 首次导入，并让后续截图按后台成员名称继续累计到同一积分身份。

**Architecture:** 在 `site-config.json` 增加 `scoreMembers`，所有积分行引用 `scoreMembers.id`，成员展示仍引用 `roster`。首次 Excel 解析只用表内名称生成确定性积分 ID；截图识别先匹配 roster，再按归一化名称解析到积分 ID。一次性脚本通过现有 `configStore` 原子写入并生成备份。

**Tech Stack:** Vite、React 19、Express 5、Vitest、ExcelJS、Node.js ESM、Server-Sent Events。

---

## 文件地图

### 新建

- `scripts/import-legacy-score-workbook.js`：一次性读取真实 Excel、校验、写入配置并输出摘要。

### 修改

- `src/data/scoreRules.js`：确定性积分 ID 和积分人物名称匹配。
- `src/data/scoreRules.test.js`：前缀合并和确定性 ID 测试。
- `server/lib/legacyScoreWorkbook.js`：Excel 人员独立解析、跨周合并和首次覆盖。
- `server/lib/legacyScoreWorkbook.test.js`：Excel 不依赖 roster、最后周显示名、范围外保留。
- `src/data/siteConfig.js`：旧配置迁移 `scoreMembers`，排行榜改用积分人物。
- `src/data/siteConfig.test.js`：迁移、排行榜、日期姓名和 roster 隔离。
- `server/lib/configStore.js`：保存并校验 `scoreMembers` 和积分行引用。
- `server/lib/configStore.test.js`：归一化重名和悬空积分 ID 校验。
- `server/lib/scoreRecognitionService.js`：后台成员解析到积分身份，必要时新增积分人物。
- `server/lib/scoreRecognitionService.test.js`：前缀同人续写和新积分人物创建。
- `src/admin/ScoreEditor.jsx`：积分明细人员选项改用 `scoreMembers`。
- `src/admin/WeekendScoreEditor.jsx`：周末人员行改用 `scoreMembers`。
- `src/admin/scoreWorkbook.js`：积分导入导出使用积分人物。
- `src/admin/ScoreEditor.test.jsx`、`src/admin/WeekendScoreEditor.test.jsx`、`src/admin/scoreWorkbook.test.js`：锁定积分人员来源不再使用 roster。
- `docs/config-admin-guide.md`：记录首次导入与两套人员来源。
- `AGENTS.md`：记录导入统计、验证结果和风险。

---

### Task 1: 建立独立积分身份规则

**Files:**
- Modify: `src/data/scoreRules.js`
- Modify: `src/data/scoreRules.test.js`

- [ ] **Step 1: 写失败测试**

新增断言：

```js
describe('score member identity', () => {
  it('creates the same score id with or without the team prefix', () => {
    expect(createScoreMemberId('青山')).toBe(createScoreMemberId('ˣʸ༩·青山'));
  });

  it('finds a score member by its normalized name', () => {
    const findScoreMember = buildScoreMemberMatcher([
      { id: 'score:qingshan', name: '青山' },
    ]);
    expect(findScoreMember('ˣʸ༩·青山')).toBe('score:qingshan');
  });
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- --run src/data/scoreRules.test.js`

Expected: FAIL，提示 `createScoreMemberId` 或 `buildScoreMemberMatcher` 未导出。

- [ ] **Step 3: 最小实现**

在 `scoreRules.js` 增加：

```js
export function createScoreMemberId(name) {
  const normalized = normalizeNickname(name);
  if (!normalized) throw new Error('积分人物名称不能为空');
  return `score:${encodeURIComponent(normalized)}`;
}

export function buildScoreMemberMatcher(scoreMembers = []) {
  const lookup = new Map(
    scoreMembers.map((member) => [normalizeNickname(member.name), member.id]),
  );
  return (name) => lookup.get(normalizeNickname(name)) ?? null;
}
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `npm test -- --run src/data/scoreRules.test.js`

Expected: PASS。

---

### Task 2: 配置模型增加 scoreMembers

**Files:**
- Modify: `src/data/siteConfig.js`
- Modify: `src/data/siteConfig.test.js`
- Modify: `server/lib/configStore.js`
- Modify: `server/lib/configStore.test.js`

- [ ] **Step 1: 写迁移与校验失败测试**

`siteConfig.test.js` 增加：

```js
it('migrates roster-backed score identities without changing existing score ids', () => {
  const legacy = createSeedConfig();
  delete legacy.scoreMembers;
  const migrated = migrateRawConfig(legacy);
  expect(migrated.scoreMembers.map(({ id, name }) => ({ id, name }))).toEqual(
    migrated.roster.map(({ id, name }) => ({ id, name })),
  );
});
```

`configStore.test.js` 增加两个测试：

```js
it('rejects score member names that normalize to the same identity', async () => {
  const config = createSeedConfig();
  config.scoreMembers = [
    { id: 'a', name: '青山', basePoints: 0, wins: 0 },
    { id: 'b', name: 'ˣʸ༩·青山', basePoints: 0, wins: 0 },
  ];
  await expect(store.write(config)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
});

it('rejects score rows that reference no score member', async () => {
  const config = createSeedConfig();
  config.scoreMembers = [];
  await expect(store.write(config)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- --run src/data/siteConfig.test.js server/lib/configStore.test.js`

Expected: 新增断言 FAIL，因为配置尚无 `scoreMembers`。

- [ ] **Step 3: 实现旧配置迁移**

`migrateRawConfig` 读取可选 `scoreMembers`。缺失时从 roster 生成兼容项并保留原 ID：

```js
const normalizedScoreMembers = Array.isArray(scoreMembers)
  ? scoreMembers
  : roster.map(({ id, name, basePoints = 0, wins = 0 }) => ({
      id,
      name,
      basePoints,
      wins,
    }));
```

返回对象必须包含 `scoreMembers: normalizedScoreMembers`。

- [ ] **Step 4: 实现配置校验**

将 `scoreMembers` 加入 `rawTopLevelKeys`。建立 `scoreMemberIds` 和 `normalizedScoreMemberNames`，校验：

```js
requireUniqueString(member.id, `${path}.id`, seenScoreMemberIds, details);
requireStrings(member, ['name'], path, details);
const normalizedName = normalizeNickname(member.name);
if (seenScoreMemberNames.has(normalizedName)) {
  details.push(`${path}.name must be unique after normalization`);
}
for (const field of ['basePoints', 'wins']) {
  if (!isNonNegativeFinite(member[field])) {
    details.push(`${path}.${field} must be a non-negative finite number`);
  }
}
```

工作日和周末的 `row.id` 都必须存在于 `scoreMemberIds`，不再用 `roster` 的 `memberIds` 校验。

- [ ] **Step 5: 运行测试并确认 GREEN**

Run: `npm test -- --run src/data/siteConfig.test.js server/lib/configStore.test.js`

Expected: PASS。

---

### Task 3: 排行榜、日期明细和积分编辑器改用 scoreMembers

**Files:**
- Modify: `src/data/siteConfig.js`
- Modify: `src/data/siteConfig.test.js`
- Modify: `src/admin/ScoreEditor.jsx`
- Modify: `src/admin/ScoreEditor.test.jsx`
- Modify: `src/admin/WeekendScoreEditor.jsx`
- Modify: `src/admin/WeekendScoreEditor.test.jsx`
- Modify: `src/admin/scoreWorkbook.js`
- Modify: `src/admin/scoreWorkbook.test.js`

- [ ] **Step 1: 写失败测试**

`siteConfig.test.js` 构造 `roster` 与 `scoreMembers` 名称不同的配置并断言：

```js
it('builds leaderboard and daily names from score members while preserving roster', () => {
  const config = createSeedConfig();
  config.roster = [{ ...config.roster[0], id: 'roster-1', name: '后台名称' }];
  config.scoreMembers = [{ id: 'score-1', name: 'Excel名称', basePoints: 10, wins: 0 }];
  config.dailyScores = [{
    date: '2026-07-01',
    rows: [{ id: 'score-1', teamRace: [1, 0, 0], openRace: [0, 0, 0] }],
  }];
  const hydrated = hydrateSiteData(config);
  expect(hydrated.roster[0].name).toBe('后台名称');
  expect(hydrated.leaderboard[0]).toMatchObject({ id: 'score-1', name: 'Excel名称', points: 11 });
  expect(hydrated.dailyScores[0].rows[0].name).toBe('Excel名称');
});
```

前端后台测试分别断言人员下拉框和周末行显示 `scoreMembers` 名称，而不是 roster 名称。工作簿测试断言导出的昵称来自 `scoreMembers`。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- --run src/data/siteConfig.test.js src/admin/ScoreEditor.test.jsx src/admin/WeekendScoreEditor.test.jsx src/admin/scoreWorkbook.test.js`

Expected: 新断言 FAIL，当前实现仍使用 roster。

- [ ] **Step 3: 修改公开投影**

`hydrateSiteData`：

```js
const scoreMembersById = new Map(config.scoreMembers.map((member) => [member.id, member]));
const { totals, dailyDetail } = projectScores({
  dailyScores: config.dailyScores,
  weekendScores: config.weekendScores,
  roster: config.scoreMembers,
});
const leaderboard = config.scoreMembers
  .map((member) => ({ ...member, points: totals.get(member.id) || 0 }))
  .sort((left, right) => right.points - left.points || right.wins - left.wins || left.name.localeCompare(right.name))
  .map((member, index) => ({ ...member, rank: index + 1 }));
```

日期行姓名从 `scoreMembersById` 读取。`roster` 仅保留成员展示数据，不再写入派生积分。

- [ ] **Step 4: 修改积分后台和工作簿**

`ScoreEditor` 的新增行、人员下拉框和 Excel 导入参数改用 `config.scoreMembers`。`WeekendScoreEditor` 的表格行改用 `config.scoreMembers`。`scoreWorkbook` 的成员名称与编号查找使用积分人物；积分人物没有编号时导出空编号，不伪造 roster 编号。

- [ ] **Step 5: 运行测试并确认 GREEN**

Run: `npm test -- --run src/data/siteConfig.test.js src/admin/ScoreEditor.test.jsx src/admin/WeekendScoreEditor.test.jsx src/admin/scoreWorkbook.test.js src/App.test.jsx`

Expected: PASS，成员阵容断言保持不变。

---

### Task 4: 后续截图续写同一积分身份

**Files:**
- Modify: `server/lib/scoreRecognitionService.js`
- Modify: `server/lib/scoreRecognitionService.test.js`

- [ ] **Step 1: 写失败测试**

新增两个服务测试：

```js
it('writes a prefixed roster member into the existing unprefixed score identity', async () => {
  config.roster = [{ id: 'r1', name: 'ˣʸ༩·青山' }];
  config.scoreMembers = [{ id: 'score:existing', name: '青山', basePoints: 0, wins: 0 }];
  // AI 返回青山，提交后 dailyScores 行必须使用 score:existing。
});

it('creates a score member for a newly recognized roster name', async () => {
  config.roster = [{ id: 'r2', name: 'ˣʸ༩·新成员' }];
  config.scoreMembers = [];
  // 提交后新增确定性 scoreMembers 项，积分行引用该 ID。
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- --run server/lib/scoreRecognitionService.test.js`

Expected: FAIL，当前草稿和提交仍使用 roster ID。

- [ ] **Step 3: 预览时解析积分 ID**

构建两个查找表：后台 ID 到后台成员、归一化名称到积分人物。`buildRace` 在后台昵称匹配成功后返回：

```js
{
  id: existingScoreId || createScoreMemberId(rosterMember.name),
  name: rosterMember.name,
  nickname: participant.nickname,
  rank: participant.rank,
}
```

局次分配继续使用积分 ID，因此能正确读取已有历史行。

- [ ] **Step 4: 提交时补齐新积分人物**

写入比赛行前，若 `next.scoreMembers` 不含 draft member ID，则增加：

```js
next.scoreMembers.push({
  id: member.id,
  name: member.name,
  basePoints: 0,
  wins: 0,
});
```

保留现有 roster 版本校验、重复截图和每人三局逻辑。

- [ ] **Step 5: 运行测试并确认 GREEN**

Run: `npm test -- --run server/lib/scoreRecognitionService.test.js server/index.test.js`

Expected: PASS。

---

### Task 5: Excel 独立身份解析与一次性导入脚本

**Files:**
- Modify: `server/lib/legacyScoreWorkbook.js`
- Modify: `server/lib/legacyScoreWorkbook.test.js`
- Create: `scripts/import-legacy-score-workbook.js`

- [ ] **Step 1: 改写失败测试锁定 Excel 身份**

fixture 中 KW27 使用 `青山`，KW31 使用 `ˣʸ༩·青山`，同时传入一个名称冲突的后台 roster。断言：

```js
const preview = await parseLegacyScoreWorkbook(buffer, {
  roster: [{ id: 'backend-id', name: '青山' }],
});
expect(preview.scoreMembers).toHaveLength(1);
expect(preview.scoreMembers[0]).toMatchObject({
  id: createScoreMemberId('青山'),
  name: 'ˣʸ༩·青山',
});
expect(preview.dailyScores.flatMap((round) => round.rows).every(
  (row) => row.id !== 'backend-id',
)).toBe(true);
```

合并测试断言 `roster` 深度相等、范围外记录及其积分人物保留、范围内 Excel 记录覆盖。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- --run server/lib/legacyScoreWorkbook.test.js`

Expected: FAIL，当前解析器仍优先匹配 roster 且返回 `historicalMembers`。

- [ ] **Step 3: 修改解析器**

删除 Excel 解析中的 roster matcher。每个昵称使用 `createScoreMemberId(nickname)`；用 Map 按 ID 聚合：

```js
scoreMembers.set(id, {
  id,
  name: nickname,
  basePoints: 0,
  wins: 0,
});
```

按 KW27 到 KW31 顺序解析，使后出现的 Excel 原文覆盖同 ID 的显示名。预览字段改为 `scoreMembers`，不再输出“matched/historical”分类。

- [ ] **Step 4: 修改覆盖合并**

`mergeLegacyScoreImport`：

1. 保留范围外 daily/weekend 记录。
2. 用预览覆盖范围内记录。
3. 收集合并后所有行引用的 ID。
4. `scoreMembers` 以预览人物为主，并补入范围外记录仍引用的旧积分人物。
5. 不修改 `roster`、`memberAliases` 或媒体内容。

- [ ] **Step 5: 创建一次性脚本**

`scripts/import-legacy-score-workbook.js`：

```js
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { createConfigStore } from '../server/lib/configStore.js';
import { mergeLegacyScoreImport, parseLegacyScoreWorkbook } from '../server/lib/legacyScoreWorkbook.js';

const filePath = process.argv[2];
if (!filePath) throw new Error('用法: node scripts/import-legacy-score-workbook.js <xlsx路径>');

const configStore = await createConfigStore({ dataDir: resolve('server/data') });
const before = await configStore.read();
const rosterSnapshot = structuredClone(before.roster);
const preview = await parseLegacyScoreWorkbook(await fs.readFile(resolve(filePath)), {
  kw27Monday: '2026-06-29',
});
if (preview.errors.length) throw new Error(JSON.stringify(preview.errors));
const next = mergeLegacyScoreImport(before, preview);
if (JSON.stringify(next.roster) !== JSON.stringify(rosterSnapshot)) {
  throw new Error('首次导入不得修改 roster');
}
await configStore.write(next);
console.log(JSON.stringify({
  scoreMembers: next.scoreMembers.length,
  dailyDates: next.dailyScores.length,
  weekendDates: next.weekendScores.length,
}, null, 2));
```

- [ ] **Step 6: 运行定向测试并确认 GREEN**

Run: `npm test -- --run server/lib/legacyScoreWorkbook.test.js server/lib/configStore.test.js`

Expected: PASS。

---

### Task 6: 执行真实导入、验证前端同步并收口

**Files:**
- Modify: `server/data/site-config.json`（通过导入脚本生成）
- Modify: `server/data/site-config.json.bak`（通过 configStore 自动生成，不提交）
- Modify: `docs/config-admin-guide.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 导入前记录 roster 和配置摘要**

Run:

```powershell
$cfg = Get-Content -Raw server/data/site-config.json | ConvertFrom-Json
$cfg.roster | ConvertTo-Json -Depth 20 | Set-Content output/roster-before-legacy-import.json
```

Expected: 输出当前 roster 快照，仅用于本地验收。

- [ ] **Step 2: 执行真实 Excel 导入**

Run:

```powershell
node scripts/import-legacy-score-workbook.js "C:/Users/Admin/Desktop/车队网站图片/星屿杯积分明细NEW.xlsx"
```

Expected: exit 0，输出积分人物数、工作日数和周末数，`server/data/site-config.json.bak` 存在。

- [ ] **Step 3: 验证 roster 未变化和积分引用完整**

Run:

```powershell
node -e "import('node:fs/promises').then(async fs=>{const {normalizeNickname}=await import('./src/data/scoreRules.js');const before=JSON.parse(await fs.readFile('output/roster-before-legacy-import.json','utf8'));const after=JSON.parse(await fs.readFile('server/data/site-config.json','utf8'));const ids=new Set(after.scoreMembers.map(x=>x.id));const rows=[...after.dailyScores,...after.weekendScores].flatMap(x=>x.rows);const names=after.scoreMembers.map(x=>normalizeNickname(x.name));if(JSON.stringify(after.roster)!==JSON.stringify(before))throw new Error('roster changed');if(!rows.every(x=>ids.has(x.id)))throw new Error('dangling score id');if(new Set(names).size!==names.length)throw new Error('duplicate normalized score name');console.log(JSON.stringify({rosterUnchanged:true,scoreMembers:ids.size,scoreRows:rows.length},null,2))})"
```

Expected: 所有断言为 true；日期范围覆盖 2026-06-29 至 2026-08-02。

- [ ] **Step 4: 运行完整测试和构建**

Run:

```bash
npm test -- --run
npm run build
```

Expected: 所有测试文件和测试项通过，Vite 构建 exit 0，ExcelJS 仍为独立动态代码块。

- [ ] **Step 5: 重启 API 并验证公开配置**

重启 `npm run dev:api` 后请求 `/api/config`，断言公开配置包含 `scoreMembers`，排行榜可由这些人物派生，配置中 roster 与导入前一致。

- [ ] **Step 6: 浏览器三档验收**

使用 390×844、768×1024、1280×800 验证：

- 首页阵容仍显示后台 roster。
- 首页积分榜显示 Excel 人员和累计分数。
- 日期查询覆盖 2026-06-29 至 2026-08-02，姓名来自 Excel。
- 页面无横向溢出，积分弹窗宽表只在自身区域滚动。

- [ ] **Step 7: 更新文档与交接**

`docs/config-admin-guide.md` 增加两套人员来源、首次导入命令和后续截图规则。`AGENTS.md` 记录实际积分人物数、日期数、测试数量、构建、浏览器结果、备份位置及剩余风险。

---

## 最终成功标准

1. Excel 首次导入完全不使用或修改后台 roster。
2. `青山` 与 `ˣʸ༩·青山` 在积分榜中只有一个身份。
3. 前端阵容来自 roster，积分榜与日期明细来自 scoreMembers。
4. 后续截图按后台名称继续累计到同一积分身份。
5. 真实配置写入前生成备份，所有积分行 ID 有效。
6. 全量测试、构建和三档浏览器验收通过。
