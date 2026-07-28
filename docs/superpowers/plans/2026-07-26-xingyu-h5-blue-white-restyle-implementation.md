# Xingyu H5 Blue White Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing Xingyu Racing Club H5 from the current dark/red "midnight track" look into a blue-white official mobile game H5 style without changing layout order, module count, or behavior.

**Architecture:** Keep the React component tree and data contracts intact. Implement the restyle almost entirely in `src/styles/global.css`, with optional class-only component edits only if an existing selector cannot express the desired state. Verification stays behavior-focused through the existing Vitest suite plus build and browser checks.

**Tech Stack:** Vite, React 19, CSS, existing IntersectionObserver reveal hook, existing native 3D carousel logic, Vitest.

---

## File Structure

- Modify: `src/styles/global.css`
  - Owns all color tokens, typography, backgrounds, component skinning, transitions, media queries, and reduced-motion overrides.
- Optional modify only if needed: `src/components/*.jsx`
  - Only add non-behavioral class names if a visual selector is otherwise too brittle.
- Test: `src/App.test.jsx`
  - Existing tests should continue passing; do not add behavior tests unless implementation changes a behavior contract, which this plan avoids.
- Reference spec: `docs/superpowers/specs/2026-07-26-xingyu-h5-blue-white-restyle-design.md`

## Constraints

- Do not reorder components in `src/App.jsx`.
- Do not add or remove homepage modules.
- Do not add a top download bar, navigation tabs, shortcut grid, video center, data encyclopedia, or community section.
- Do not introduce Swiper, jQuery, Zepto, animation libraries, or new runtime dependencies.
- Do not alter `teamData.js` business fields.
- Preserve video modal, photo modal, score details modal, album hash view, and carousel behavior.

---

### Task 1: Convert Global Design Tokens

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Replace root color tokens**

Update `:root` so the global palette is blue-white instead of dark/red:

```css
:root {
  color: #2f3d5c;
  background: #f6f9ff;
  font-family:
    Inter, "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --ink: #2f3d5c;
  --muted: #838486;
  --metal: #5c6c9f;
  --line: #d8e0ee;
  --surface: #ffffff;
  --surface-raised: #f7fbff;
  --signal: #4690ff;
  --signal-strong: #296aca;
  --signal-soft: #6798fc;
  --page-bg: #f6f9ff;
  --panel-shadow: 0 12px 32px rgba(41, 106, 202, 0.12);
}
```

- [ ] **Step 2: Replace page background**

Update `html` and `body` to use a white/blue mobile H5 background:

```css
html {
  min-width: 320px;
  background: var(--page-bg);
  scroll-behavior: smooth;
}

body {
  min-width: 320px;
  margin: 0;
  overflow-x: hidden;
  color: var(--ink);
  background:
    linear-gradient(180deg, rgba(103, 152, 252, 0.12), transparent 320px),
    var(--page-bg);
}
```

- [ ] **Step 3: Run a quick CSS syntax check through build**

Run: `npm run build`

Expected: Vite build completes with no CSS syntax warning.

- [ ] **Step 4: Commit token conversion**

```powershell
git add src/styles/global.css
git commit -m "style: 切换蓝白 H5 全局视觉变量"
```

---

### Task 2: Restyle Hero And Stats

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Restyle Hero**

Update the hero-related selectors to keep the same structure but use a brighter official H5 KV treatment:

```css
.hero-section {
  background: #dceaff;
}

.hero-section::before {
  background:
    linear-gradient(180deg, rgba(14, 50, 113, 0.08) 0%, rgba(14, 50, 113, 0.16) 42%, rgba(11, 35, 80, 0.72) 100%),
    linear-gradient(90deg, rgba(20, 66, 145, 0.55), rgba(20, 66, 145, 0.1) 70%);
}

.hero-section::after {
  display: none;
}

.hero-frame {
  color: rgba(255, 255, 255, 0.78);
  border-color: rgba(255, 255, 255, 0.34);
}

.hero-frame::before,
.hero-frame::after {
  background: var(--signal);
}

.hero-topline {
  color: rgba(255, 255, 255, 0.86);
}

h1 {
  color: #ffffff;
  text-shadow: 0 10px 34px rgba(9, 32, 74, 0.48);
}

.hero-signoff {
  border-top-color: rgba(255, 255, 255, 0.46);
}

.hero-signoff p,
.hero-signoff > span {
  color: rgba(255, 255, 255, 0.88);
}
```

- [ ] **Step 2: Restyle stats bar**

Update `stats-bar` and `stat-card` selectors:

```css
.stats-bar {
  border-top: 3px solid var(--signal);
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--panel-shadow);
}

.stat-card {
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.stat-card small {
  color: #b6c3d8;
}

.stat-card strong {
  color: var(--signal-strong);
}

.stat-card > span {
  color: var(--muted);
}

.stat-breakdown span {
  color: var(--signal-strong);
}
```

- [ ] **Step 3: Verify mobile dimensions**

Run: `npm run build`

Expected: build succeeds; no change to JS chunks from this task is required.

- [ ] **Step 4: Commit hero and stats restyle**

```powershell
git add src/styles/global.css
git commit -m "style: 调整首屏和数据条为蓝白 H5 风格"
```

---

### Task 3: Restyle Sections, Carousel, Gallery, And Lists

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Restyle section headers**

Update shared section selectors:

```css
.eyebrow {
  color: var(--signal);
}

.section-block {
  background: transparent;
}

.section-heading {
  border-bottom: 1px solid var(--line);
}

.section-heading::after {
  background: var(--signal);
}

h2 {
  color: #4b4b69;
}
```

- [ ] **Step 2: Restyle featured carousel cards and dots**

Update `.driver-card`, `.driver-portrait`, `.driver-footer`, `.driver-number`, `.carousel-dot`, and related hover selectors:

```css
.driver-card {
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-top: 3px solid transparent;
  box-shadow: 0 14px 30px rgba(41, 106, 202, 0.08);
}

.driver-card.is-active {
  border-top-color: var(--signal);
  box-shadow: 0 20px 42px rgba(41, 106, 202, 0.18);
}

.driver-portrait {
  background:
    linear-gradient(150deg, rgba(103, 152, 252, 0.28), rgba(255, 255, 255, 0.12) 62%),
    linear-gradient(160deg, #dceaff, #f7fbff);
}

.driver-number {
  color: #ffffff;
  text-shadow: 0 10px 28px rgba(41, 106, 202, 0.42);
}

.portrait-label {
  color: var(--signal-strong);
}

.driver-footer {
  border-top: 1px solid var(--line);
  background: #ffffff;
}

.member-meta span {
  color: var(--signal);
}

.member-meta strong {
  color: var(--ink);
}

.play-button {
  color: var(--signal-strong);
  border-color: rgba(41, 106, 202, 0.3);
  background: #ffffff;
}

.carousel-dot {
  border-color: #bfc7da;
  background: #bfc7da;
}

.carousel-dot.is-active {
  background: var(--signal);
  border-color: var(--signal);
}
```

- [ ] **Step 3: Restyle gallery and album cards**

Update photo and album selectors:

```css
.photo-card,
.album-folder,
.album-photo {
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: 0 10px 26px rgba(41, 106, 202, 0.08);
}

.photo-card-copy,
.album-folder-copy,
.album-photo span {
  color: #ffffff;
  background: linear-gradient(0deg, rgba(10, 37, 85, 0.82), rgba(10, 37, 85, 0.08));
}

.photo-card-copy small,
.album-folder-copy small,
.album-photo span small {
  color: rgba(255, 255, 255, 0.78);
}

.album-folder:hover {
  border-color: var(--signal);
}
```

- [ ] **Step 4: Restyle roster, leaderboard, and news**

Update compact data/list selectors:

```css
.roster-grid,
.leaderboard {
  border-top: 1px solid var(--line);
}

.roster-card,
.leader-row {
  border-color: var(--line);
}

.roster-number,
.rank,
.leader-score strong,
.news-meta > span {
  color: var(--signal-strong);
}

.leader-row.is-podium {
  background: linear-gradient(90deg, rgba(103, 152, 252, 0.14), transparent 72%);
}

.leader-row.is-podium::before {
  background: var(--signal);
}

.news-list::before {
  background: var(--line);
}

.news-marker {
  border-color: var(--page-bg);
  background: var(--signal);
  box-shadow: 0 0 0 1px var(--signal);
}

.news-copy {
  border-color: var(--line);
}

.news-copy h3 {
  color: var(--ink);
}
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm test -- --run
npm run build
```

Expected:

- `src/App.test.jsx`: 19 tests pass.
- Vite build succeeds.

- [ ] **Step 6: Commit content section restyle**

```powershell
git add src/styles/global.css
git commit -m "style: 调整轮播相册榜单资讯为官方 H5 风格"
```

---

### Task 4: Restyle Modals, Buttons, Motion, And Final Verification

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Restyle modals and text actions**

Update modal/button selectors:

```css
.modal-backdrop {
  background: rgba(4, 24, 58, 0.72);
  backdrop-filter: blur(8px);
}

.video-modal,
.photo-modal,
.score-details-modal {
  border-top: 3px solid var(--signal);
  background: #ffffff;
  color: var(--ink);
  box-shadow: 0 28px 80px rgba(4, 24, 58, 0.28);
}

.video-fallback,
.photo-fallback {
  color: var(--muted);
  border: 1px dashed var(--line);
  background: #f7fbff;
}

.icon-button {
  color: var(--signal-strong);
  border-color: rgba(41, 106, 202, 0.26);
  background: #ffffff;
}

.text-action {
  color: var(--signal-strong);
}

.text-action:hover {
  color: var(--signal);
}

.score-details-modal thead th {
  color: var(--signal-strong);
  border-bottom: 1px solid var(--line);
}

.score-details-modal tbody th,
.score-details-modal tbody td {
  border-bottom: 1px solid var(--line);
}
```

- [ ] **Step 2: Tune motion timing**

Keep existing selectors but shorten reveal timing:

```css
[data-reveal] {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 520ms ease,
    transform 520ms cubic-bezier(0.2, 0.75, 0.25, 1);
}

[data-reveal].is-visible .member-card,
[data-reveal].is-visible .roster-card,
[data-reveal].is-visible .leader-row,
[data-reveal].is-visible .news-item {
  transition-delay: calc(var(--stagger-index, 0) * 28ms);
}
```

- [ ] **Step 3: Verify reduced motion remains intact**

Confirm the existing `@media (prefers-reduced-motion: reduce)` block still forces content visible:

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }

  [data-reveal],
  [data-reveal] .member-card,
  [data-reveal] .roster-card,
  [data-reveal] .leader-row,
  [data-reveal] .news-item {
    opacity: 1;
    transform: none;
  }
}
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm test -- --run
npm run build
```

Expected:

- 19 tests pass.
- Build succeeds with no CSS syntax warnings.

- [ ] **Step 5: Browser verification**

Start or reuse preview server:

```powershell
npm run build
npm run preview -- --port 4177
```

Check:

- `390x844`: no horizontal overflow, text not clipped, buttons fit.
- `1280x900`: content centered, cards and hero framing look intentional.
- Open a member video modal and close it.
- Open photo preview and close it.
- Enter `#album`, open a folder, open a photo, return to folders, return home.
- Open score details modal and close it.

- [ ] **Step 6: Commit final restyle**

```powershell
git add src/styles/global.css
git commit -m "style: 完成 H5 蓝白官方风格和动效改造"
```

---

## Self-Review

- Spec coverage: Tasks cover global palette, Hero, stats, section headings, carousel, gallery, album, roster, leaderboard, news, modals, buttons, motion, reduced motion, test/build/browser verification.
- Placeholder scan: No incomplete placeholder items are used.
- Scope check: The plan changes visual styling only and preserves all existing behavior and layout ordering.
