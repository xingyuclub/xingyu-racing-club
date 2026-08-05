# 星屿积分截图识别去重与身份绑定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让截图识别在同批次内按原图可靠去重，并强制每个识别到的队员对应一个现有积分人物后才能提交。

**Architecture:** 在识别存储层为图片保存内容哈希，在服务层预处理重复图片并把自动/疑似重复状态传入草稿；在配置层给 roster 增加唯一 `scoreMemberId` 绑定并校验。草稿只投影已有绑定，不再自动创建积分人物；前端显示绑定和图片重复异常。

**Tech Stack:** Node.js、Express、Sharp、React、Vitest、Testing Library、现有配置存储与识别批次索引。

---

### Task 1: 建立图片指纹纯函数

**Files:**
- Create: `server/lib/scoreRecognitionFingerprint.js`
- Test: `server/lib/scoreRecognitionFingerprint.test.js`

- [ ] **Step 1: Write the failing tests**

覆盖：相同字节得到相同 SHA-256；规范化方向/尺寸后的像素指纹稳定；完全不同图片不会被判为 exact duplicate；近似图片返回 `suspected` 而不是自动重复。

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node tmp/run-tests.mjs server/lib/scoreRecognitionFingerprint.test.js --run`

Expected: FAIL because the fingerprint module does not exist.

- [ ] **Step 3: Implement the minimal fingerprint helpers**

使用 `crypto.createHash('sha256')` 保存文件哈希，使用 Sharp `rotate().resize(...).greyscale().raw()` 生成固定尺寸像素摘要；导出 `buildImageFingerprint` 和 `compareImageFingerprints`，仅返回 `exact`、`suspected`、`distinct` 三种结果。

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node tmp/run-tests.mjs server/lib/scoreRecognitionFingerprint.test.js --run`

Expected: all fingerprint tests pass.

### Task 2: 在批次存储中记录并前置去重图片

**Files:**
- Modify: `server/lib/scoreRecognitionStore.js`
- Modify: `server/lib/scoreRecognitionService.js`
- Modify: `server/lib/scoreRecognitionRoutes.js`
- Test: `server/lib/scoreRecognitionStore.test.js`
- Test: `server/lib/scoreRecognitionService.test.js`

- [ ] **Step 1: Write failing store/service tests**

断言：创建批次保存每张图片的 `sha256`/规范化指纹；处理重复图片时 AI 只收到第一次图片；草稿包含自动重复和疑似重复元数据；疑似重复未审核前不能提交。

- [ ] **Step 2: Run focused tests and verify the expected failures**

Run: `node tmp/run-tests.mjs server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionService.test.js --run`

Expected: FAIL on missing fingerprint fields and duplicate preprocessing.

- [ ] **Step 3: Implement duplicate preprocessing**

创建批次写入指纹；`previewBatch` 按图片顺序建立去重结果，只对首张 exact 图片调用 AI；保留 `duplicateImages` 与 `suspectedDuplicateImages`，将确认状态传给草稿；review 接口增加图片级 duplicate/notDuplicate 判定并重建草稿。

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `node tmp/run-tests.mjs server/lib/scoreRecognitionStore.test.js server/lib/scoreRecognitionService.test.js --run`

Expected: focused store/service tests pass.

### Task 3: 增加 roster 到 scoreMember 的强绑定校验

**Files:**
- Modify: `server/lib/configStore.js`
- Modify: `src/data/siteConfig.js`
- Modify: `src/data/scoreRules.js`
- Test: `server/lib/configStore.test.js`
- Test: `src/data/siteConfig.test.js`
- Test: `src/data/scoreRules.test.js`

- [ ] **Step 1: Write failing binding tests**

覆盖：唯一标准化姓名可补绑定；无匹配保持空；不存在的 ID、重复绑定被拒绝；同一成员不会因中点/前缀变体自动生成第二个积分人物。

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `node tmp/run-tests.mjs server/lib/configStore.test.js src/data/siteConfig.test.js src/data/scoreRules.test.js --run`

Expected: FAIL because roster binding is not validated and score matcher falls back to generated IDs.

- [ ] **Step 3: Implement strict binding**

加入唯一绑定归一化和配置校验；`buildRecognitionDraft.matchMembers` 只接受有效 `scoreMemberId`，缺失时写入 `unlinked-score-member`；`commitBatch` 删除自动追加 `scoreMembers` 的分支，并在服务端重新构建草稿后阻止任何绑定异常。

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `node tmp/run-tests.mjs server/lib/configStore.test.js src/data/siteConfig.test.js src/data/scoreRules.test.js --run`

Expected: all binding tests pass.

### Task 4: 后台成员管理提供绑定入口，识别审核显示硬阻塞

**Files:**
- Modify: `src/admin/ConfigEditor.jsx`
- Modify: `src/admin/RecognitionEvidence.jsx`
- Modify: `src/admin/admin.css`
- Test: `src/admin/ConfigEditor.test.jsx`
- Test: `src/admin/RecognitionEvidence.test.jsx`

- [ ] **Step 1: Write failing UI tests**

断言成员卡显示积分人物选择；未绑定队员显示警告；识别异常展示图片重复/绑定失效；所有异常解决前提交按钮保持禁用。

- [ ] **Step 2: Run focused UI tests and verify they fail**

Run: `node tmp/run-tests.mjs src/admin/ConfigEditor.test.jsx src/admin/RecognitionEvidence.test.jsx --run`

Expected: FAIL because binding controls and issue labels do not exist.

- [ ] **Step 3: Implement minimal UI**

在成员卡增加现有 `scoreMembers` 下拉框和未绑定状态；识别审核显示绑定目标和图片去重状态；提交按钮沿用 `draft.canCommit`，服务端异常透传。

- [ ] **Step 4: Run focused UI tests and verify they pass**

Run: `node tmp/run-tests.mjs src/admin/ConfigEditor.test.jsx src/admin/RecognitionEvidence.test.jsx --run`

Expected: focused UI tests pass.

### Task 5: 全量回归与文档收口

**Files:**
- Modify: `docs/config-admin-guide.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`

Expected: 0 failed tests.

- [ ] **Step 2: Run the production build**

Run: `node tmp/run-build.mjs`

Expected: build exits 0 and ExcelJS remains a separate dynamic chunk.

- [ ] **Step 3: Run the API/browser acceptance checks**

Verify duplicate upload/preview/commit behavior through the local API and inspect 390px/1280px admin view for binding controls and blocked commit states.

- [ ] **Step 4: Update the admin guide and handover**

Document image duplicate states, strict binding prerequisites, and the manual resolution path for ambiguous historical score members.

- [ ] **Step 5: Commit the implementation**

Run: `git add server src docs/superpowers/specs docs/superpowers/plans AGENTS.md && git commit -m "fix: enforce score recognition dedup and identity binding"`
