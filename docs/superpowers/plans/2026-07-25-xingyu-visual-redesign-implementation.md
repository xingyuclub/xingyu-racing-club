# Xingyu Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing racing-club page into the approved "Midnight Silver Track" visual direction, add restrained motion, and apply the revised team roles, statistics, and leaderboard fields.

**Architecture:** Keep the current React component boundaries and `teamData.js` configuration source. Add one small reveal-on-scroll hook, improve the existing modal behavior, and implement the visual system in the global stylesheet without adding runtime dependencies.

**Tech Stack:** React 19, Vite, CSS, Vitest, React Testing Library, browser-native IntersectionObserver.

---

## File Structure

- Create `public/images/hero-track.webp`: neutral track/garage texture used until the real family photo is available.
- Create `src/hooks/useRevealOnScroll.js`: applies one-time viewport reveal state with a no-motion fallback.
- Modify `src/data/teamData.js`: revised stat labels, core-member role distribution, and hero image path.
- Modify `src/App.jsx`: initialize reveal behavior and keep page composition unchanged.
- Modify `src/components/Hero.jsx`: editorial hero metadata and configured image hook.
- Modify `src/components/FeaturedMembers.jsx`: driver-card structure and stagger metadata.
- Modify `src/components/Roster.jsx`: compact roster structure and stagger metadata.
- Modify `src/components/Leaderboard.jsx`: remove wins and emphasize podium rows.
- Modify `src/components/NewsFeed.jsx`: timeline structure.
- Modify `src/components/VideoModal.jsx`: Escape/backdrop close and body scroll lock.
- Modify `src/styles/global.css`: complete responsive visual system and reduced-motion behavior.
- Modify `src/App.test.jsx`: data-contract, modal, and reveal fallback regression coverage.

## Task 1: Apply The Revised Team Configuration

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/data/teamData.js`

- [ ] **Step 1: Write failing data-contract tests**

Add tests asserting the exact stat labels and featured-role counts:

```jsx
it('uses the revised internal team statistics', () => {
  expect(teamData.stats.map((item) => item.label)).toEqual([
    '车队排名',
    '活跃排名',
    '成员数量',
    '编外成员',
  ]);
});

it('defines one captain, four deputies, and three elite featured members', () => {
  const roles = teamData.featuredMembers.map((member) => member.role);
  expect(roles.filter((role) => role === '队长')).toHaveLength(1);
  expect(roles.filter((role) => role === '副队')).toHaveLength(4);
  expect(roles.filter((role) => role === '精英')).toHaveLength(3);
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npm test -- src/App.test.jsx`

Expected: FAIL because the current labels and roles still use the first-version values.

- [ ] **Step 3: Make the minimal configuration change**

Change the role assignment to:

```js
role:
  index === 0
    ? '队长'
    : index < 5
      ? '副队'
      : index < 8
        ? '精英'
        : '正式成员',
```

Set `team.heroImage` to `/images/hero-track.webp` and set the statistics to:

```js
stats: [
  { label: '车队排名', value: '#01' },
  { label: '活跃排名', value: '#03' },
  { label: '成员数量', value: '30' },
  { label: '编外成员', value: '0' },
],
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `npm test -- src/App.test.jsx`

Expected: all tests pass.

## Task 2: Improve Modal And Reveal Behavior

**Files:**
- Create: `src/hooks/useRevealOnScroll.js`
- Modify: `src/App.jsx`
- Modify: `src/components/VideoModal.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write failing interaction tests**

Add tests that open the modal, press Escape, click the backdrop, and verify the `modal-open` body class is removed. Add a fallback test that verifies `[data-reveal]` elements receive `is-visible` when IntersectionObserver is unavailable.

```jsx
it('closes the member dialog with Escape and restores body scrolling', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: '查看成员 01 高光视频' }));
  expect(document.body).toHaveClass('modal-open');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body).not.toHaveClass('modal-open');
});

it('reveals content immediately when IntersectionObserver is unavailable', () => {
  const { container } = render(<App />);
  expect(container.querySelector('[data-reveal]')).toHaveClass('is-visible');
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npm test -- src/App.test.jsx`

Expected: FAIL because Escape, scroll locking, and reveal state are not implemented.

- [ ] **Step 3: Implement the reveal hook**

Create `useRevealOnScroll()` using `document.querySelectorAll('[data-reveal]')`. Immediately add `is-visible` when reduced motion is requested or `IntersectionObserver` is unavailable; otherwise observe at threshold `0.12`, add the class once, and unobserve the node. Disconnect on cleanup.

- [ ] **Step 4: Initialize the hook in App**

Call `useRevealOnScroll()` once in `App` and add `data-reveal` to content section roots. Keep all existing configuration flow and component order unchanged.

- [ ] **Step 5: Implement modal keyboard, backdrop, and scroll behavior**

Use a `useEffect` tied to `member` to register Escape, toggle `document.body.classList`, and clean up. Close from the backdrop only when `event.target === event.currentTarget` so clicks inside the dialog do not close it.

- [ ] **Step 6: Run tests and confirm GREEN**

Run: `npm test -- src/App.test.jsx`

Expected: all tests pass with no warnings.

## Task 3: Rebuild The Editorial Component Markup

**Files:**
- Modify: `src/components/Hero.jsx`
- Modify: `src/components/StatsBar.jsx`
- Modify: `src/components/FeaturedMembers.jsx`
- Modify: `src/components/Roster.jsx`
- Modify: `src/components/Leaderboard.jsx`
- Modify: `src/components/NewsFeed.jsx`
- Modify: `src/components/VideoModal.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write failing structural tests**

Assert that the hero uses the configured image CSS variable, leaderboard rows no longer render win text, the top three rows carry `is-podium`, and news items use timeline markers.

```jsx
it('renders the revised editorial hooks', () => {
  const { container } = render(<App />);
  expect(container.querySelector('.hero-frame')).toBeInTheDocument();
  expect(container.querySelectorAll('.leader-row.is-podium')).toHaveLength(3);
  expect(container.querySelector('.news-marker')).toBeInTheDocument();
  expect(screen.queryByText(/\d+ 胜/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npm test -- src/App.test.jsx`

Expected: FAIL because the new editorial hooks do not exist and wins are still rendered.

- [ ] **Step 3: Update the focused markup**

Add hero frame/meta elements, driver number layers, stable play-button containers, roster number columns, podium classes, and news markers. Add `style={{ '--stagger-index': index }}` only to repeated children. Keep all visible content sourced from props.

- [ ] **Step 4: Remove wins from leaderboard presentation**

Render each row as rank, member identity, and a single points block. Keep the existing sort order and twelve-row limit.

- [ ] **Step 5: Run tests and confirm GREEN**

Run: `npm test -- src/App.test.jsx`

Expected: all tests pass.

## Task 4: Build The Midnight Silver Visual System

**Files:**
- Create: `public/images/hero-track.webp`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Create the neutral visual asset**

Generate a wide, monochrome photographic track/garage texture with no people, team marks, readable text, or fabricated vehicle branding. Export it as `public/images/hero-track.webp` at a web-sized resolution.

- [ ] **Step 2: Replace the page-level styling**

Implement color tokens for charcoal, bone white, metal silver, muted text, and signal red. Make the hero full-bleed, convert stats into a continuous band, use 2-column mobile and 4-column desktop driver grids, keep the roster dense, and give leaderboard and news distinct non-card layouts.

- [ ] **Step 3: Add motion without layout shifts**

Add hero reveal keyframes, `[data-reveal]` transitions, stagger delays based on `--stagger-index`, hover media scaling inside clipped bounds, and modal fade/scale animation. Animate only opacity and transforms.

- [ ] **Step 4: Add reduced-motion and responsive rules**

Under `@media (prefers-reduced-motion: reduce)`, remove animations, delays, and smooth transitions while keeping content visible. Verify 320px minimum width, 390px mobile layout, and desktop layout at 1280px without viewport-scaled font sizes.

- [ ] **Step 5: Run automated verification**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass and Vite build succeeds.

## Task 5: Browser Verification And Final Review

**Files:**
- Modify only files implicated by a verified defect.

- [ ] **Step 1: Start or reuse the Vite development server**

Run: `npm run dev`

Expected: Vite prints an available `127.0.0.1` URL.

- [ ] **Step 2: Verify at 390 x 844**

Check title visibility, no horizontal overflow, readable data band, 8 driver cards, 30 roster entries, modal Escape/backdrop close, readable leaderboard/news, and visible scroll-reveal completion.

- [ ] **Step 3: Verify at 1280 x 900**

Check full-bleed hero framing, four-column driver layout, stable hover dimensions, podium emphasis, no text overlap, and no horizontal overflow.

- [ ] **Step 4: Verify reduced motion**

Emulate `prefers-reduced-motion: reduce` and confirm all content is immediately visible and the modal remains usable.

- [ ] **Step 5: Run final commands**

Run:

```powershell
npm test
npm run build
git diff --check
git status --short --branch
```

Expected: tests and build pass, no whitespace errors, and only intentional source/spec changes remain.

## Self-Review

- Spec coverage: revised stats, exact 1/4/3 featured roles, simplified leaderboard, midnight-silver hierarchy, configured hero asset, reveal/hover/modal motion, and reduced-motion behavior all map to explicit tasks.
- Scope: no backend, CMS, routing, motion dependency, generated people, or unrelated refactor is introduced.
- Type consistency: existing `team`, `stats`, `featuredMembers`, `roster`, `leaderboard`, and `news` props remain unchanged; new hooks are CSS classes, data attributes, and one configuration URL.
- Verification: behavior is test-first; visual quality is checked at mobile, desktop, and reduced-motion settings.
