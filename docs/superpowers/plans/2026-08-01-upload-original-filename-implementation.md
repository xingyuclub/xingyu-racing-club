# 后台上传字段显示原始文件名 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让后台上传字段显示新上传文件的原始文件名，同时兼容旧 UUID 文件并保持公开 URL 不变。

**Architecture:** 服务端继续生成 UUID，但把经过清理的原始 basename 拼接到 UUID 后面；配置仍保存返回的 `/uploads/...` 路径。前端 `UploadField` 从路径 basename 中提取 `--` 后的原名，旧路径回退显示 basename。

**Tech Stack:** Express, Multer, React, Vitest, Testing Library.

---

### Task 1: Generate safe upload filenames

**Files:**
- Modify: `server/index.js`
- Test: `server/index.test.js`

- [ ] **Step 1: Add failing upload filename assertions**

Extend the successful image/video upload tests to assert the returned `name` matches `<uuid>--<safe-original-name>.<ext>`, preserves the extension, and never includes a path separator; add a filename with reserved characters and path-like input to assert its basename is cleaned.

- [ ] **Step 2: Run focused server tests**

Run: `npm test -- --run server/index.test.js`

Expected: new filename assertions fail because the current name is only a UUID plus extension.

- [ ] **Step 3: Implement safe filename generation**

Add a small helper in `server/index.js` that takes `file.originalname`, uses `basename`, replaces Windows-reserved characters and control characters with `_`, trims trailing spaces/dots, limits the base name length, and falls back to `file` when empty. Update Multer’s `filename` callback to produce `${randomUUID()}--${safeBase}${extname}` while preserving the existing extension and MIME validation.

- [ ] **Step 4: Run focused server tests**

Run: `npm test -- --run server/index.test.js`

Expected: PASS.

### Task 2: Display the original name in upload fields

**Files:**
- Modify: `src/admin/UploadField.jsx`
- Test: `src/admin/AdminApp.test.jsx`

- [ ] **Step 1: Add failing display assertions**

Seed the mocked upload response with `/uploads/<uuid>--青山头像.jpg`, assert the upload field displays `青山头像.jpg` without `/uploads/` or the UUID, and add a legacy-path assertion that `/uploads/<uuid>.jpg` displays `<uuid>.jpg`.

- [ ] **Step 2: Run focused admin tests**

Run: `npm test -- --run src/admin/AdminApp.test.jsx`

Expected: the new display assertions fail because `UploadField` currently renders the full path.

- [ ] **Step 3: Implement a display-name helper**

Extract the last path segment, decode URI components defensively, and when the filename contains `--`, return the suffix after the first delimiter; otherwise return the basename unchanged. Render this display name in the existing `<code>` element while keeping the input upload and stored value unchanged.

- [ ] **Step 4: Run focused admin tests**

Run: `npm test -- --run src/admin/AdminApp.test.jsx`

Expected: PASS.

### Task 3: Full verification and handoff

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Run complete tests and build**

Run: `npm test -- --run` and `npm run build`.

Expected: all tests pass and Vite build succeeds.

- [ ] **Step 2: Verify the upload path and UI**

Use the running API to upload a test file only if needed by the existing test setup; confirm the response path contains the UUID delimiter and original basename, and inspect the admin field at `/admin` to confirm only the original filename is visible.

- [ ] **Step 3: Update handoff documentation**

Append the changed files, test/build results, and any limitation that old UUID-only uploads cannot recover their original names to `AGENTS.md`.

