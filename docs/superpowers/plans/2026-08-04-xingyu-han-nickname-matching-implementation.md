# 星屿截图昵称汉字匹配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在完整昵称和人工别名精确匹配失败后，用“至少两个汉字、序列完全一致且候选唯一”的规则匹配当前成员。

**Architecture:** 继续以 `src/data/scoreRules.js` 作为唯一身份规则模块，新增一个无状态汉字提取纯函数，并在 `buildMemberMatcher` 内构建唯一汉字索引。识别草稿、AI、计分和前端均不感知新规则，只消费现有匹配器结果。

**Tech Stack:** JavaScript Unicode property escapes、Vitest、现有 Vite/React/Node 测试链路

---

## 文件边界

- `src/data/scoreRules.js`：提取 Unicode 汉字，构建带冲突保护的成员汉字索引。
- `src/data/scoreRules.test.js`：覆盖精确优先、汉字兜底、一字/无汉字、错字和冲突边界。
- `server/lib/scoreRecognitionDraft.test.js`：确认真实识别草稿通过新规则生成成员汇总，不产生 `unmatched`。

### Task 1: 汉字提取与安全匹配

**Files:**
- Modify: `src/data/scoreRules.js`
- Modify: `src/data/scoreRules.test.js`
- Modify: `server/lib/scoreRecognitionDraft.test.js`

- [ ] **Step 1: 为汉字提取和匹配边界写失败测试**

在 `src/data/scoreRules.test.js` 导入 `extractHanCharacters`，增加：

```js
describe('extractHanCharacters', () => {
  it('keeps only Unicode Han characters in their original order', () => {
    expect(extractHanCharacters('xγ·黑岩_99')).toBe('黑岩');
    expect(extractHanCharacters('এ᭄云嗔')).toBe('云嗔');
    expect(extractHanCharacters('我懷念的')).toBe('我懷念的');
    expect(extractHanCharacters('Q3-Rose')).toBe('');
  });
});
```

扩展 `buildMemberMatcher` 测试名单并覆盖全部边界：

```js
const roster = [
  { id: '1', name: 'ˣʸ༩·黑岩' },
  { id: '2', name: '巫溪ya' },
  { id: '3', name: 'ˣʸ༩·米' },
  { id: '4', name: 'ˣʸ༩·Rose' },
];

it('falls back to an exact unique Han sequence', () => {
  const match = buildMemberMatcher(roster);
  expect(match('xγ_黑岩99')).toBe('1');
  expect(match('x?巫溪99')).toBe('2');
});

it('does not use partial, reordered, one-character, or non-Han fallbacks', () => {
  const match = buildMemberMatcher(roster);
  expect(match('x?黑')).toBeNull();
  expect(match('x?黑岩岩')).toBeNull();
  expect(match('x?岩黑')).toBeNull();
  expect(match('x?米99')).toBeNull();
  expect(match('x?Rose99')).toBeNull();
  expect(match('米')).toBe('3');
  expect(match('rose')).toBe('4');
});

it('refuses a Han fallback shared by multiple members', () => {
  const match = buildMemberMatcher([
    { id: 'a', name: '黑岩A' },
    { id: 'b', name: '黑岩B' },
  ]);
  expect(match('x?黑岩99')).toBeNull();
  expect(match('黑岩A')).toBe('a');
});
```

保留并继续运行现有人工别名断言，确保完整别名优先行为不变。

- [ ] **Step 2: 写识别草稿集成失败测试**

在 `server/lib/scoreRecognitionDraft.test.js` 增加一个最小队内赛草稿：

```js
it('matches a roster member when OCR symbols differ but all Han characters match', () => {
  const draft = buildRecognitionDraft({
    batch: { id: 'han-match', date: '2026-08-04', raceType: 'team' },
    observations: [{
      imageIndex: 0,
      matches: [{ participants: [{ nickname: 'xγ_黑岩99', rank: 1 }] }],
    }],
    config: {
      roster: [{ id: 'r1', name: 'ˣʸ༩·黑岩' }],
      scoreMembers: [{ id: 's1', name: 'ˣʸ༩·黑岩', basePoints: 0, wins: 0 }],
      memberAliases: [],
      dailyScores: [],
    },
  });

  expect(draft.issues).toEqual([]);
  expect(draft.canCommit).toBe(true);
  expect(draft.summary).toEqual([
    expect.objectContaining({ id: 's1', name: 'ˣʸ༩·黑岩', score: 1 }),
  ]);
});
```

- [ ] **Step 3: 运行测试确认红灯**

Run:

```powershell
npm test -- --run src/data/scoreRules.test.js server/lib/scoreRecognitionDraft.test.js
```

Expected: FAIL，因为 `extractHanCharacters` 尚未导出，符号错误的昵称仍产生 `unmatched`。

- [ ] **Step 4: 实现最小汉字提取函数**

在 `src/data/scoreRules.js` 的常量区增加：

```js
const HAN_CHARACTERS = /\p{Script=Han}/gu;
```

在 `normalizeNickname` 前导出纯函数：

```js
export function extractHanCharacters(value) {
  return (String(value ?? '').normalize('NFC').match(HAN_CHARACTERS) || []).join('');
}
```

使用 `[...han].length` 计算 Unicode 字符数量，不能使用 UTF-16 `han.length` 作为两字门槛。

- [ ] **Step 5: 为 `buildMemberMatcher` 增加唯一汉字索引**

用以下实现替换现有函数，保持完整昵称和别名索引行为：

```js
export function buildMemberMatcher(roster, aliases = []) {
  const lookup = new Map();
  const hanLookup = new Map();

  for (const member of roster) {
    lookup.set(normalizeNickname(member.name), member.id);
    const han = extractHanCharacters(member.name);
    if ([...han].length < 2) continue;
    if (!hanLookup.has(han)) hanLookup.set(han, member.id);
    else if (hanLookup.get(han) !== member.id) hanLookup.set(han, null);
  }
  for (const alias of aliases) {
    lookup.set(normalizeNickname(alias.value), alias.memberId);
  }

  return (nickname) => {
    const exact = lookup.get(normalizeNickname(nickname));
    if (exact) return exact;
    const han = extractHanCharacters(nickname);
    if ([...han].length < 2) return null;
    return hanLookup.get(han) ?? null;
  };
}
```

不得把人工别名加入汉字索引，不得加入子串或编辑距离分支。

- [ ] **Step 6: 运行定向测试确认绿灯**

Run:

```powershell
npm test -- --run src/data/scoreRules.test.js server/lib/scoreRecognitionDraft.test.js server/lib/scoreRecognitionService.test.js
```

Expected: 三个测试文件全部通过；现有完整昵称、别名、草稿重算和提交服务行为不变。

- [ ] **Step 7: 提交纯函数改动**

```powershell
git add src/data/scoreRules.js src/data/scoreRules.test.js server/lib/scoreRecognitionDraft.test.js
git commit -m "feat: match OCR nicknames by unique Han characters"
```

### Task 2: 全链路验证

**Files:**
- No source changes expected.

- [ ] **Step 1: 运行识别链路测试**

Run:

```powershell
npm test -- --run server/lib/scoreRecognitionAi.test.js server/lib/scoreRecognitionDraft.test.js server/lib/scoreRecognitionService.test.js server/index.test.js src/data/scoreRules.test.js src/admin/RecognitionEvidence.test.jsx src/admin/ScoreRecognition.test.jsx
```

Expected: 所有定向测试通过，未匹配异常和提交门槛测试保持有效。

- [ ] **Step 2: 运行全量测试和构建**

Run:

```powershell
npm test -- --run
npm run build
```

Expected: 全量测试 0 失败；Vite 构建退出码 0；ExcelJS 仍为独立动态代码块。

- [ ] **Step 3: 用当前名单验证索引安全性**

读取 `server/data/site-config.json` 的当前 `roster`，对每个成员运行 `extractHanCharacters` 并统计：

```text
- 至少两个汉字且唯一：允许汉字兜底。
- 少于两个汉字：只允许完整昵称或人工别名。
- 汉字键冲突：必须保持未匹配。
```

Expected: 当前名单没有重复汉字键；任何未来冲突也由单元测试保证返回 `null`。

- [ ] **Step 4: 用真实 OCR 样本做只读验收**

从已有识别记录或真实截图结果选取队标符号识别错误但汉字正确的昵称，直接调用 `buildMemberMatcher`，至少验证：

```text
xy²·黑岩 / xy♂·黑岩 / xγ_黑岩99 -> 黑岩成员
xy²·十二 / xy♀·十二              -> 十二成员
x?米99                             -> null
x?Rose99                           -> null
```

不得提交识别批次或修改正式积分数据。

- [ ] **Step 5: 记录最终验证结果**

最终报告必须说明：汉字兜底只解决符号误识别；汉字本身识别错误时仍会进入人工审核，不能表述为“完全准确”。
