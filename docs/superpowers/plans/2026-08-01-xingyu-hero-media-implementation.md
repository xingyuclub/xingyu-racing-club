# 星屿首页主媒体支持图片与视频 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页主媒体支持自动识别的图片或视频，并在视频失败时显示独立备用图片，同时迁移旧 `team.heroImage` 配置。

**Architecture:** 原始配置在 `team.heroMedia` 保存 `{ src, type }`，在 `team.heroFallbackImage` 保存备用图片路径；读取旧配置时由 `migrateRawConfig` 转换并去掉 `heroImage`。`Hero` 只负责按已保存类型渲染图片/视频和处理媒体错误，后台 `UploadField` 通过上传响应的 `type` 更新对应配置字段。

**Tech Stack:** React, Vite, Vitest, Testing Library, Express, JSON config store.

---

### Task 1: Extend seed data, migration, and validation

**Files:**
- Modify: `src/data/teamData.js`
- Modify: `src/data/siteConfig.js`
- Modify: `server/lib/configStore.js`
- Test: `src/data/siteConfig.test.js`
- Test: `server/lib/configStore.test.js`

- [x] **Step 1: Add a failing migration test**

Add assertions that a legacy team with `heroImage: '/images/legacy.png'` migrates to `heroMedia: { src: '/images/legacy.png', type: 'image' }`, has `heroFallbackImage: ''`, and no longer has `heroImage`; add a current-schema test that preserves an explicit video `heroMedia`.

- [x] **Step 2: Run the focused migration tests**

Run: `npm test -- --run src/data/siteConfig.test.js`

Expected: the new migration assertions fail because the new fields are not implemented.

- [x] **Step 3: Implement migration and seed shape**

Update default `teamData.team` to use `heroMedia` and `heroFallbackImage`. In `migrateRawConfig`, normalize `team` by preferring an existing `heroMedia`, otherwise converting `heroImage`, defaulting the fallback to `''`, and omitting `heroImage` from the returned team object.

- [x] **Step 4: Add and run config validation tests**

Add cases for invalid `heroMedia.type`, non-string `heroMedia.src`, and non-string `heroFallbackImage`; update legacy fixtures to exercise migration before validation. Run: `npm test -- --run server/lib/configStore.test.js src/data/siteConfig.test.js`

Expected: PASS.

- [x] **Step 5: Implement new validation**

Change `validateConfig` to require `team.name`, `team.label`, and `team.motto` as before, then validate `team.heroMedia` as an object with string `src` and type `image` or `video`, and validate `team.heroFallbackImage` as a string. Do not require a non-empty source so fallback-only configuration remains valid.

### Task 2: Render image/video hero media with fallback

**Files:**
- Modify: `src/components/Hero.jsx`
- Modify: `src/styles/global.css`
- Test: `src/App.test.jsx`

- [x] **Step 1: Add failing component assertions**

Extend the existing hero tests to assert: image media renders an `img` with the configured source; video media renders a `video` with `autoPlay`, `muted`, `loop`, and `playsInline`; dispatching `error` replaces it with the fallback image; fallback-only renders the fallback image; empty media keeps `.hero-section--empty`.

- [x] **Step 2: Run the focused app tests**

Run: `npm test -- --run src/App.test.jsx`

Expected: new assertions fail against the image-only implementation.

- [x] **Step 3: Implement minimal Hero media selection**

In `Hero`, derive the effective media from `team.heroMedia` and `team.heroFallbackImage`, keep a local `videoFailed` state reset when the media source changes, render `<img>` for image/fallback and `<video autoPlay muted loop playsInline>` for video, and handle `onError` by setting `videoFailed`. Preserve the existing brand bar, labels, empty placeholder, and `hero-media` class.

- [x] **Step 4: Update media sizing styles**

Replace image-specific hero assumptions with shared `.hero-media` rules using `display: block`, `width: 100%`, `height: auto`, and `object-fit: contain`; retain the existing empty placeholder background and responsive layout. Add no cropping or background repetition for configured media.

- [x] **Step 5: Run focused app tests**

Run: `npm test -- --run src/App.test.jsx`

Expected: PASS.

### Task 3: Bind admin uploads to the new fields

**Files:**
- Modify: `src/admin/ConfigEditor.jsx`
- Modify: `src/admin/UploadField.jsx` only if a callback contract needs a small explicit change
- Test: `src/admin/AdminApp.test.jsx`

- [x] **Step 1: Add failing admin upload tests**

Update the mocked upload response to include `type: 'video'` and assert that uploading through `首页主媒体上传` writes `{ src: '/uploads/hero.mp4', type: 'video' }` to `team.heroMedia`; add a separate upload test asserting `视频失败备用图上传` writes `team.heroFallbackImage` and that the old `首屏图片上传` label is absent.

- [x] **Step 2: Run the focused admin tests**

Run: `npm test -- --run src/admin/AdminApp.test.jsx`

Expected: the new field labels and nested updates fail.

- [x] **Step 3: Implement upload field mapping**

Update `Field` to recognize `heroMedia` and `heroFallbackImage` as upload fields. For `heroMedia`, pass an upload callback that stores both the returned path and returned type; for the fallback, store only the returned path. Keep the generic upload component’s automatic type response and existing file accept list.

- [x] **Step 4: Hide legacy field and run admin tests**

Ensure the generic tree does not render `heroImage` when loading a migrated/current config. Run: `npm test -- --run src/admin/AdminApp.test.jsx`

Expected: PASS.

### Task 4: Full verification and project handoff

**Files:**
- Modify: `AGENTS.md`

- [x] **Step 1: Run the complete test suite**

Run: `npm test -- --run`

Expected: all existing and new tests pass.

- [x] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: Vite build completes successfully.

- [ ] **Step 3: Verify browser behavior at three viewports**

Start the existing dev/API setup on an available port, then inspect 390, 768, and 1280 pixel widths. Confirm image mode, video attributes, fallback-on-error, fallback-only, no page-level horizontal overflow, and no visible controls.

- [x] **Step 4: Update handoff documentation**

Append the implementation summary, test/build/browser results, and any remaining media compatibility risk to `AGENTS.md` without changing unrelated historical entries.
