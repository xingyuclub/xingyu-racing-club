# Xingyu Pit Wall UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the confirmed Pit Wall public H5 redesign in an isolated branch while preserving every existing business interaction and keeping the original UI available at a separate local URL for comparison.

**Architecture:** Keep `useSiteConfig`, `siteData`, hash-based album routing, score derivation, admin code, and component state ownership unchanged. Implement the redesign only in `.worktrees/pit-wall-ui-redesign`, add one page-anchor navigation component and one reusable dialog-focus hook, and replace the public stylesheet with the confirmed token system; the baseline branch remains the original version.

**Tech Stack:** Vite 6, React 19, Vitest, Testing Library, plain CSS, Lucide React, existing project media, Express configuration API.

---

## Scope And File Map

**Create in the redesign worktree:**
- `src/components/PageNav.jsx`: sticky in-page navigation and active-section state for `members`, `scores`, `gallery`, and `news`.
- `src/components/ResilientImage.jsx`: existing-image renderer with a stable, labeled failure state; it never substitutes generated media.
- `src/hooks/useDialogFocus.js`: focus entry, focus trap, Escape handling, body scroll lock, and trigger-focus restoration shared by public dialogs.

**Modify in the redesign worktree:**
- `src/App.jsx`: import public CSS, reorder public modules, mount `PageNav`, and preserve all existing data and modal state.
- `src/App.test.jsx`: structure, anchors, fallback visibility, dialogs, media, roster, album, score, and music regression coverage.
- `src/components/Hero.jsx`: real image-first Pit Wall hero and stable image-failure state.
- `src/components/StatsBar.jsx`: four-cell telemetry band without animated border wrappers.
- `src/components/FeaturedMembers.jsx`: Driver Bay card structure while retaining timed and swipe navigation.
- `src/components/Roster.jsx`: visual structure and labels only; rotation, pause, drag, easing, and click logic remain intact.
- `src/components/Leaderboard.jsx`: ranking rails and query action without `ElectricBorder`.
- `src/components/GalleryPreview.jsx`: numbered contact-sheet preview and existing album entry.
- `src/components/NewsFeed.jsx`: event-log rows, closing motto band, and shared dialog focus behavior.
- `src/components/AlbumPage.jsx`: archive path, numbered folders, two-level browsing, and contact-sheet photos.
- `src/components/VideoModal.jsx`: Driver Inspection Bay information rail and dialog focus behavior.
- `src/components/PhotoModal.jsx`: media inspection layout, date rail, failure state, and dialog focus behavior.
- `src/components/ScoreDetailsModal.jsx`: split calendar/results layout and explicit calendar states.
- `src/components/MusicPlayer.jsx`: communications-dial presentation while preserving playback, long press, and vertical drag.
- `src/hooks/useRevealOnScroll.js`: progressive enhancement class on the document and default-visible fallback.
- `src/main.jsx`: stop loading public CSS for `/admin`; `App.jsx` owns the public stylesheet import.
- `src/styles/global.css`: complete Pit Wall tokens, public layout, component states, responsive rules, focus, and reduced motion.
- `DESIGN.md`: replace the seed note with the final implemented tokens, dimensions, and component patterns.
- `AGENTS.md`: record implementation, verification, URLs, and remaining risks.

**Must not change:**
- `src/admin/**`, `src/data/**`, `server/**`, `package.json`, `package-lock.json`, configuration JSON, upload assets, or Excel behavior.
- `GradientText`, `StarBorder`, and `ElectricBorder` source files may remain unused; do not delete them in this redesign.

## Fixed Acceptance Contract

- Original baseline branch: `codex/config-admin-excel` in `C:\Users\Admin\Documents\H5`.
- Redesign branch: `codex/pit-wall-ui-redesign` in `C:\Users\Admin\Documents\H5\.worktrees\pit-wall-ui-redesign`.
- Shared API: `http://127.0.0.1:3000/`; original preview: `http://127.0.0.1:3001/`; redesign preview: `http://127.0.0.1:3002/`.
- If one fixed port is occupied by an unrelated process, record the replacement port in `AGENTS.md` and provide that exact URL; never terminate an unrelated process.
- No theme switcher, no generated assets, no new dependencies, no recruitment/contact UI, no data-model change, and no admin styling change.

### Task 1: Create The Isolated Worktree And Prove The Baseline

**Files:**
- Verify only: repository and worktree state

- [ ] **Step 1: Load execution skills and restate the guardrails**

Invoke `superpowers:using-git-worktrees`, `superpowers:test-driven-development`, `karpathy-guidelines`, `ui-ux-pro-max`, and `impeccable`. Treat `PRODUCT.md`, `DESIGN.md`, and the confirmed design spec as authority; skill output may calibrate accessibility and implementation details but must not replace the selected Pit Wall direction.

- [ ] **Step 2: Verify the baseline branch and ignored worktree directory**

Run from `C:\Users\Admin\Documents\H5`:

```powershell
git branch --show-current
git status --short
git check-ignore -q .worktrees
git branch --list codex/pit-wall-ui-redesign
```

Expected: branch is `codex/config-admin-excel`; only the previously documented unrelated untracked files are listed; `.worktrees` is ignored; the redesign branch does not exist. Stop and reconcile instead of overwriting an existing redesign branch or worktree.

- [ ] **Step 3: Create the redesign branch and worktree**

```powershell
git worktree add .worktrees/pit-wall-ui-redesign -b codex/pit-wall-ui-redesign
git worktree list
```

Expected: both the baseline root and `.worktrees/pit-wall-ui-redesign` appear, with the latter on `codex/pit-wall-ui-redesign`.

- [ ] **Step 4: Install without changing dependency metadata**

Run from the redesign worktree:

```powershell
npm install
git status --short
```

Expected: installation succeeds and neither `package.json` nor `package-lock.json` changes.

- [ ] **Step 5: Run the baseline suite in both checkouts**

```powershell
npm test
```

Run once in the baseline root and once in the redesign worktree. Expected: 7 test files and 132 tests pass in each checkout before implementation.

- [ ] **Step 6: Record the starting commit without committing generated files**

```powershell
git rev-parse --short HEAD
git status --short
```

Expected: both checkouts begin from the same documentation commit and the redesign worktree is clean.

### Task 2: Add Homepage Order And Semantic Navigation With TDD

**Files:**
- Create: `src/components/PageNav.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Write failing structure and anchor tests**

Add tests that assert the four links and exact public module order:

```jsx
it('orders the Pit Wall modules and exposes section anchors', () => {
  const { container } = render(<App />);
  const ids = [...container.querySelectorAll('main > [id], main > nav + [id]')]
    .map((node) => node.id)
    .filter(Boolean);

  expect(screen.getByRole('navigation', { name: '页面区域' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '成员' })).toHaveAttribute('href', '#members');
  expect(screen.getByRole('link', { name: '积分' })).toHaveAttribute('href', '#scores');
  expect(screen.getByRole('link', { name: '相册' })).toHaveAttribute('href', '#gallery');
  expect(screen.getByRole('link', { name: '动态' })).toHaveAttribute('href', '#news');
  expect(ids).toEqual(['members', 'scores', 'gallery', 'news']);
});

it('marks the first page anchor as current before observation updates', () => {
  render(<App />);
  expect(screen.getByRole('link', { name: '成员' })).toHaveAttribute('aria-current', 'location');
});
```

- [ ] **Step 2: Run the new tests to verify RED**

```powershell
npm test -- src/App.test.jsx
```

Expected: FAIL because the `页面区域` navigation and section IDs do not exist and the old order places gallery before roster and leaderboard.

- [ ] **Step 3: Implement `PageNav` with four fixed anchors**

Use this component shape:

```jsx
import { useEffect, useState } from 'react';

const ITEMS = [
  { id: 'members', label: '成员', index: '01' },
  { id: 'scores', label: '积分', index: '02' },
  { id: 'gallery', label: '相册', index: '03' },
  { id: 'news', label: '动态', index: '04' },
];

export function PageNav() {
  const [activeId, setActiveId] = useState(ITEMS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-25% 0px -60%', threshold: [0, 0.2, 0.6] },
    );
    ITEMS.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="page-nav" aria-label="页面区域">
      <div className="page-nav-track">
        {ITEMS.map((item) => (
          <a
            className={item.id === activeId ? 'is-active' : undefined}
            href={`#${item.id}`}
            key={item.id}
            aria-current={item.id === activeId ? 'location' : undefined}
          >
            <span aria-hidden="true">{item.index}</span>{item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Reorder `App` without changing data flow**

Import `./styles/global.css` and `PageNav`. Keep the hero and stats first, then render:

```jsx
<PageNav />
<div id="members" className="driver-bay" tabIndex="-1">
  <FeaturedMembers members={siteData.featuredMembers} onSelect={setSelectedMember} />
  <Roster members={siteData.roster} onSelect={setSelectedMember} />
</div>
<div id="scores" className="home-module-anchor" tabIndex="-1">
  <Leaderboard rows={siteData.leaderboard} onOpenDetails={() => setShowScoreDetails(true)} />
</div>
<div id="gallery" className="home-module-anchor" tabIndex="-1">
  <GalleryPreview photos={siteData.gallery} onOpenPhoto={setSelectedPhoto} onOpenAlbum={openAlbum} />
</div>
<div id="news" className="home-module-anchor" tabIndex="-1">
  <NewsFeed items={siteData.news} motto={siteData.team.motto} />
</div>
```

Do not add a second copy of `siteData`, navigation state in `App`, or a routing dependency.

- [ ] **Step 5: Isolate public CSS from the admin route**

Remove `import './styles/global.css';` from `src/main.jsx`; `src/App.jsx` now owns that import. Keep `AdminApp` and its existing `admin.css` import unchanged.

- [ ] **Step 6: Run tests and commit**

```powershell
npm test -- src/App.test.jsx
git add src/App.jsx src/App.test.jsx src/main.jsx src/components/PageNav.jsx
git commit -m "feat: add pit wall page navigation"
```

Expected: the targeted suite passes, including all pre-existing roster, album, score, and music interaction tests.

### Task 3: Replace The Public Visual Foundation, Hero, And Telemetry Band

**Files:**
- Modify: `src/components/Hero.jsx`
- Modify: `src/components/StatsBar.jsx`
- Modify: `src/styles/global.css`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Replace obsolete visual-wrapper assertions with Pit Wall assertions**

Update the old animated-border and gradient test to assert:

```jsx
it('renders the image-first Pit Wall hero and telemetry band', () => {
  const { container } = render(<App />);
  expect(container.querySelector('.hero-brand')).not.toHaveClass('animated-gradient-text');
  expect(container.querySelector('.hero-kicker')).toHaveTextContent('RACING CLUB');
  expect(container.querySelector('.hero-season')).toHaveTextContent('2026');
  expect(container.querySelectorAll('.telemetry-cell')).toHaveLength(4);
  expect(container.querySelector('.star-border-container')).not.toBeInTheDocument();
  expect(container.querySelector('.electric-border-canvas')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify RED**

```powershell
npm test -- src/App.test.jsx -t "Pit Wall hero"
```

Expected: FAIL because the hero metadata and telemetry cells are absent and old wrappers still render.

- [ ] **Step 3: Implement the image-first hero**

Remove `GradientText`. Render a real `<img>` with `team.heroImage`, a stable fallback, and these content elements: `hero-kicker` containing `team.label`, H1 `欢迎来到星屿车队`, `hero-season` containing `2026 SEASON`, and a decorative `hero-progress` rail. Keep the H1 text unchanged and do not surface the motto in the hero.

- [ ] **Step 4: Implement the telemetry cells**

Remove `StarBorder`. Keep `StatValue`, gender icons, values, labels, and all accessible labels unchanged. Each item becomes:

```jsx
<div className={`telemetry-cell${index === 0 ? ' telemetry-cell--primary' : ''}`} key={item.label}>
  <span className="telemetry-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
  <div className="telemetry-value">{/* existing value branch */}</div>
  <span className="telemetry-label">{item.label}</span>
</div>
```

- [ ] **Step 5: Replace `global.css` with the public Pit Wall foundation**

Start with these exact tokens and behaviors, then define the named component classes used in this plan:

```css
:root {
  color-scheme: light;
  --pit-silver: #e8edf2;
  --pit-white: #f8fafc;
  --pit-black: #101820;
  --pit-blue: #1769ff;
  --pit-graphite: #17202a;
  --pit-metal: #647180;
  --pit-yellow: #f4b400;
  --pit-line: #b9c3cd;
  --pit-display: Bahnschrift, "Arial Narrow", "Microsoft YaHei", sans-serif;
  --pit-body: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
  --page-max: 1180px;
  font-family: var(--pit-body);
  color: var(--pit-graphite);
  background: var(--pit-silver);
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; background: var(--pit-silver); }
body { margin: 0; min-width: 320px; overflow-x: clip; background: var(--pit-silver); }
button, a { -webkit-tap-highlight-color: transparent; }
button:focus-visible, a:focus-visible { outline: 3px solid var(--pit-yellow); outline-offset: 3px; }
.site-shell { width: 100%; min-height: 100svh; overflow: clip; background: var(--pit-silver); }
.hero-section { min-height: 74svh; max-height: 840px; position: relative; display: grid; align-items: end; overflow: hidden; background: var(--pit-black); }
.hero-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 38%; }
.stats-bar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); background: var(--pit-white); border-bottom: 1px solid var(--pit-line); }
.telemetry-cell { min-height: 108px; position: relative; display: grid; align-content: center; padding: 18px; border-right: 1px solid var(--pit-line); border-bottom: 1px solid var(--pit-line); }
```

At `min-width: 768px`, make `.stats-bar` four columns and cap its inner visual rhythm with the same `--page-max`; keep hero height within `72-78svh` and ensure the stats band is visible at the bottom edge of the first viewport. All corners are `0-4px`; no glow, glass, purple gradient, or generic floating cards.

- [ ] **Step 6: Run targeted and full tests, then commit**

```powershell
npm test -- src/App.test.jsx
npm test
git add src/components/Hero.jsx src/components/StatsBar.jsx src/styles/global.css src/App.test.jsx
git commit -m "feat: establish pit wall visual foundation"
```

Expected: all tests pass; the old animated wrapper assertions have been intentionally replaced, while business assertions remain.

### Task 4: Redesign Driver Bay While Freezing Roster Physics

**Files:**
- Modify: `src/components/FeaturedMembers.jsx`
- Modify: `src/components/Roster.jsx`
- Modify: `src/styles/global.css`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add structural regression assertions before markup changes**

Extend the existing member test:

```jsx
expect(screen.getByTestId('driver-bay')).toContainElement(screen.getByTestId('roster-grid'));
expect(screen.getAllByTestId('driver-profile')).toHaveLength(8);
expect(within(screen.getByTestId('roster-grid')).getAllByTestId('roster-card')).toHaveLength(30);
expect(within(screen.getByTestId('roster-grid')).getByText('01')).toBeInTheDocument();
```

Place `data-testid="driver-bay"` on the `App` wrapper and `data-testid="driver-profile"` on featured buttons.

- [ ] **Step 2: Run the targeted test to verify RED**

```powershell
npm test -- src/App.test.jsx -t "renders 8 featured"
```

Expected: FAIL on the new test IDs.

- [ ] **Step 3: Restructure featured cards without changing carousel state**

Keep `getPosition`, timer cadence, reduced-motion behavior, swipe threshold, `onSelect`, button labels, and dots. Change only presentation: add a `driver-card-index`, keep number/role/name, use existing avatar if present, and show `DRIVER FILE` fallback when absent. The active card remains the largest; side cards must not occlude its text or controls at 375px.

- [ ] **Step 4: Preserve every line of roster motion logic**

Do not change constants, refs, `requestAnimationFrame`, pointer handlers, visibility thresholds, CSS custom properties, `aria-hidden`, or `tabIndex`. Markup changes are limited to adding a `roster-file-label` and role text inside `roster-identity`; retain all existing classes and test IDs.

- [ ] **Step 5: Add the Driver Bay visual rules**

Use a continuous performance-black band. The featured viewport uses fixed `aspect-ratio` and stable tracks; roster height is bounded with `clamp()` and its existing 3D transform variables remain authoritative. Missing portraits show member number and `DRIVER FILE`, never a fabricated avatar. Hover pause, card enlargement, drag cursor, and focus ring must be visually clear without layout shift.

- [ ] **Step 6: Run all preserved interaction tests and commit**

```powershell
npm test -- src/App.test.jsx -t "roster|driver|member"
npm test
git add src/App.jsx src/components/FeaturedMembers.jsx src/components/Roster.jsx src/styles/global.css src/App.test.jsx
git commit -m "feat: redesign the pit wall driver bay"
```

Expected: carousel swipe, roster rotation, drag acceleration, easing, hover pause, and member modal tests all pass.

### Task 5: Redesign Leaderboard, Gallery, And Event Log

**Files:**
- Modify: `src/components/Leaderboard.jsx`
- Modify: `src/components/GalleryPreview.jsx`
- Modify: `src/components/NewsFeed.jsx`
- Modify: `src/styles/global.css`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write failing semantic presentation tests**

```jsx
it('renders ranking rails, a numbered contact sheet, and an event log', () => {
  const { container } = render(<App />);
  expect(container.querySelectorAll('.leader-progress')).toHaveLength(10);
  expect(container.querySelectorAll('.photo-index')).toHaveLength(5);
  expect(container.querySelectorAll('.event-log-index')).toHaveLength(teamData.news.length);
  expect(container.querySelector('.closing-band')).toHaveTextContent(teamData.team.motto);
});
```

- [ ] **Step 2: Run to verify RED**

```powershell
npm test -- src/App.test.jsx -t "ranking rails"
```

Expected: FAIL because these structural elements do not exist.

- [ ] **Step 3: Implement leaderboard rails**

Remove `ElectricBorder` and keep the first ten rows, rank, name, points, query button, image icon, and `分` suffix. Add a decorative `.leader-progress` with `style={{ '--leader-progress': `${Math.max(8, row.points / Math.max(rows[0]?.points || 1, 1) * 100)}%` }}`. Top three use position number and thicker blue rail, not medals or metal colors. Preserve row height with long names and large point values.

- [ ] **Step 4: Implement the gallery contact sheet**

Keep exactly five featured items, media detection, click behavior, video badge, date, empty state, and album button. Add `.photo-index` with `01-05`; first image is the main image on desktop and spans two columns only where the grid has enough width. Use fixed aspect ratios so failed or loading images do not resize the section.

- [ ] **Step 5: Implement the event log and closing band**

Keep title, category, date, image, summary, open behavior, and dialog. Add `event-log-index` with zero-padded position. Render `<footer className="closing-band"><span>END OF LOG</span><strong>{motto}</strong></footer>` after the list; it is a conclusion, not a button.

- [ ] **Step 6: Style the three continuous bands and commit**

Leaderboard is structural white, gallery is performance black, news is silver/white. Use full-width backgrounds and constrained inner content rather than floating section cards. At 375px use one readable stream; at 1024px use comparison grids only for leaderboard/gallery where useful.

```powershell
npm test -- src/App.test.jsx
git add src/components/Leaderboard.jsx src/components/GalleryPreview.jsx src/components/NewsFeed.jsx src/styles/global.css src/App.test.jsx
git commit -m "feat: redesign public proof sections"
```

### Task 6: Add Reusable Dialog Focus Management With TDD

**Files:**
- Create: `src/hooks/useDialogFocus.js`
- Modify: `src/components/VideoModal.jsx`
- Modify: `src/components/PhotoModal.jsx`
- Modify: `src/components/ScoreDetailsModal.jsx`
- Modify: `src/components/NewsFeed.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write failing focus-entry and restoration tests**

```jsx
it('moves focus into a dialog and restores it to the trigger', async () => {
  const user = userEvent.setup();
  render(<App />);
  const trigger = screen.getByRole('button', { name: '查看成员 01 高光视频' });
  trigger.focus();
  await user.click(trigger);
  expect(screen.getByRole('button', { name: '关闭视频弹窗' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
});

it('keeps tab focus inside the active dialog', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: '查找' }));
  const dialog = screen.getByRole('dialog');
  await user.tab({ shift: true });
  expect(dialog).toContainElement(document.activeElement);
});
```

- [ ] **Step 2: Run to verify RED**

```powershell
npm test -- src/App.test.jsx -t "focus"
```

Expected: FAIL because opening a dialog does not focus its close button and closing does not restore the trigger.

- [ ] **Step 3: Implement `useDialogFocus`**

Create a hook with signature `useDialogFocus(active, onClose)`. It returns `dialogRef` and `initialFocusRef`, stores `document.activeElement` on activation, adds/removes `modal-open`, focuses `initialFocusRef.current`, closes on Escape, wraps Tab between enabled focusable descendants, and restores the stored element on cleanup. Use only browser DOM APIs; do not add a focus-trap dependency. Use this exact focusable selector and return shape:

```jsx
import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogFocus(active, onClose) {
  const dialogRef = useRef(null);
  const initialFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!active) return undefined;
    const returnFocus = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])];
      if (!focusable.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleKeyDown);
    initialFocusRef.current?.focus();
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleKeyDown);
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, [active]);

  return { dialogRef, initialFocusRef };
}
```

- [ ] **Step 4: Adopt the hook in all four dialog owners**

Remove duplicated body-class and Escape effects from `VideoModal`, `PhotoModal`, `ScoreDetailsModal`, and `NewsFeed`. Attach `dialogRef` to the dialog section and `initialFocusRef` to its close button. Preserve backdrop-click behavior and accessible dialog names.

- [ ] **Step 5: Verify all close paths and commit**

```powershell
npm test -- src/App.test.jsx -t "dialog|modal|focus|Escape|backdrop"
npm test
git add src/hooks/useDialogFocus.js src/components/VideoModal.jsx src/components/PhotoModal.jsx src/components/ScoreDetailsModal.jsx src/components/NewsFeed.jsx src/App.test.jsx
git commit -m "feat: harden public dialog focus behavior"
```

Expected: keyboard, Escape, backdrop, and existing open/close tests pass with body scrolling restored.

### Task 7: Redesign Album And Media Inspection Surfaces

**Files:**
- Create: `src/components/ResilientImage.jsx`
- Modify: `src/components/AlbumPage.jsx`
- Modify: `src/components/VideoModal.jsx`
- Modify: `src/components/PhotoModal.jsx`
- Modify: `src/components/NewsFeed.jsx`
- Modify: `src/styles/global.css`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add archive-path and information-rail tests**

```jsx
it('keeps the two-level album path and media information rails', async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);
  await user.click(screen.getByRole('button', { name: '查看更多相册' }));
  expect(container.querySelector('.album-path')).toHaveTextContent('HOME / ALBUMS');
  await user.click(screen.getAllByTestId('album-folder')[0]);
  expect(container.querySelector('.album-path')).toHaveTextContent(teamData.albums[0].name);
  await user.click(screen.getAllByTestId('album-photo')[0]);
  expect(screen.getByRole('dialog').querySelector('.inspection-rail')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify RED**

```powershell
npm test -- src/App.test.jsx -t "album path"
```

Expected: FAIL because `.album-path` and `.inspection-rail` are absent.

- [ ] **Step 3: Restructure the album archive**

Keep `activeAlbumId`, `handleBack`, hash behavior, folder/photo test IDs, button labels, media badges, and empty states. Add a visible `.album-path`, zero-padded `.album-record-number`, cover/date/count metadata, two-column mobile photo grid, selected desktop emphasis via `:nth-child(5n + 1)`, and explicit Play icon for videos.

- [ ] **Step 4: Restructure media and news dialogs**

Video and photo dialogs use a dark `.inspection-bay`; media is the largest element and metadata sits in `.inspection-rail`. Member video rail shows member number/name/role from the existing object. Photo rail shows title/date from the existing object. News remains a light `.news-record` with constrained readable text width. Do not add copy that claims unconfigured facts.

- [ ] **Step 5: Add stable media failure states**

Create and use this single image renderer in `Hero`, `GalleryPreview`, `NewsFeed`, and `AlbumPage`:

```jsx
import { useEffect, useState } from 'react';

export function ResilientImage({ src, alt = '', className = '', ...props }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span
        className={`media-fallback${className ? ` ${className}` : ''}`}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        图片暂不可用
      </span>
    );
  }

  return <img className={className || undefined} src={src} alt={alt} onError={() => setFailed(true)} {...props} />;
}
```

A failed image container retains the same aspect ratio as its successful image. Keep `PhotoModal`'s existing dedicated failure branch and keep video-without-source text as `视频素材待替换`. Do not create or download substitute imagery.

- [ ] **Step 6: Run tests and commit**

```powershell
npm test -- src/App.test.jsx -t "album|photo|video|news"
npm test
git add src/components/ResilientImage.jsx src/components/AlbumPage.jsx src/components/VideoModal.jsx src/components/PhotoModal.jsx src/components/NewsFeed.jsx src/components/Hero.jsx src/components/GalleryPreview.jsx src/styles/global.css src/App.test.jsx
git commit -m "feat: redesign album and inspection surfaces"
```

### Task 8: Redesign The Daily Score Workspace Without Touching Score Math

**Files:**
- Modify: `src/components/ScoreDetailsModal.jsx`
- Modify: `src/styles/global.css`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add split-layout and calendar-state tests**

```jsx
it('renders the score query as calendar and results workspaces', async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);
  await user.click(screen.getByRole('button', { name: '查找' }));
  expect(container.querySelector('.score-query-layout')).toBeInTheDocument();
  expect(container.querySelector('.score-calendar-pane')).toBeInTheDocument();
  expect(container.querySelector('.score-results-pane')).toHaveTextContent('选择日期查看当天积分');
  const available = screen.getByRole('button', { name: '查看 2026年7月24日积分' });
  expect(available).toHaveClass('has-scores');
  await user.click(available);
  expect(available).toHaveClass('is-selected');
});
```

- [ ] **Step 2: Run to verify RED**

```powershell
npm test -- src/App.test.jsx -t "calendar and results"
```

Expected: FAIL because split-pane wrappers do not exist.

- [ ] **Step 3: Wrap existing calendar and result branches**

Create `.score-query-layout` containing `.score-calendar-pane` and `.score-results-pane`. Move the existing toolbar/calendar into the first pane and all hint/empty/table branches into the second. Do not alter `scoreByDate`, date parsing, month navigation, selection behavior, score rows, six race values, daily score, total, or table semantics.

- [ ] **Step 4: Add explicit date states**

`calendar-day` is outlined by default; `has-scores` adds a bottom blue bar and bold text; `is-selected` uses solid blue plus a visible check/notch pseudo-element; current date, when present in the visible month, receives `.is-today` from a local `todayKey` comparison and a yellow corner mark. State meaning must not rely on opacity alone.

- [ ] **Step 5: Make desktop split and mobile stack predictable**

At `min-width: 900px`, use `grid-template-columns: minmax(300px, 0.8fr) minmax(0, 1.6fr)` and cap dialog height with internal scrolling. Below that, calendar precedes results. Only `.daily-score-table-wrap` may scroll horizontally; the page and dialog shell must not.

- [ ] **Step 6: Run score regressions and commit**

```powershell
npm test -- src/App.test.jsx -t "score|积分|calendar"
npm test
git add src/components/ScoreDetailsModal.jsx src/styles/global.css src/App.test.jsx
git commit -m "feat: redesign daily score workspace"
```

### Task 9: Redesign The Music Control While Preserving Its Gesture Contract

**Files:**
- Modify: `src/components/MusicPlayer.jsx`
- Modify: `src/styles/global.css`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add presentation assertions to existing behavior tests**

```jsx
expect(player).toHaveClass('music-dial');
expect(player.querySelector('.music-progress-ring')).toBeInTheDocument();
expect(player).toHaveStyle({ '--music-progress': '0deg' });
```

Add the assertions to the paused initial state test; retain every existing play/pause/autoplay retry/long-press/drag assertion.

- [ ] **Step 2: Run to verify RED**

```powershell
npm test -- src/App.test.jsx -t "music"
```

Expected: FAIL only on the new dial/ring assertions.

- [ ] **Step 3: Add real audio progress state**

Add `progress` state initialized to `0`; on `<audio onTimeUpdate>`, set `currentTime / duration` when duration is finite. Render `.music-progress-ring` and set `--music-progress` to `${progress * 360}deg`. Keep all gesture constants, vertical-only position state, event handlers, labels, audio attributes, and dismissal logic unchanged.

- [ ] **Step 4: Style a lower-right communications dial**

The dial remains at least `56px` and receives a restrained conic progress ring, static cover, and existing play/pause glyph. Do not continuously spin the cover or use glow. During modal display, ensure its z-index is below the backdrop; on album pages it must not cover the back action at any tested width.

- [ ] **Step 5: Run gesture regressions and commit**

```powershell
npm test -- src/App.test.jsx -t "music|drag|long press|autoplay"
npm test
git add src/components/MusicPlayer.jsx src/styles/global.css src/App.test.jsx
git commit -m "feat: redesign the floating music dial"
```

### Task 10: Make Reveal Motion Progressive And Reduced-Motion Safe

**Files:**
- Modify: `src/hooks/useRevealOnScroll.js`
- Modify: `src/styles/global.css`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Strengthen the fallback test**

```jsx
it('keeps reveal content visible unless motion enhancement is active', () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const { container } = render(<App />);
  expect(document.documentElement).not.toHaveClass('motion-enhanced');
  expect([...container.querySelectorAll('[data-reveal]')].every((node) => node.classList.contains('is-visible'))).toBe(true);
});
```

- [ ] **Step 2: Run to verify the strengthened expectation**

```powershell
npm test -- src/App.test.jsx -t "reveal content"
```

Expected: FAIL on the complete fallback contract until the hook manages enhancement state explicitly.

- [ ] **Step 3: Gate hidden transforms behind `motion-enhanced`**

In the hook, add `motion-enhanced` to `document.documentElement` only after confirming motion is allowed and `IntersectionObserver` exists; remove it on cleanup. Without that class, `[data-reveal]` has `opacity: 1; transform: none`. Only `.motion-enhanced [data-reveal]:not(.is-visible)` receives short translate/opacity setup.

- [ ] **Step 4: Define the motion budget**

Hero image advances once by at most `scale(1.035)`; title/data enter in two beats within `900ms`; content bands use at most `18px` translation; no scroll hijacking or parallax. Under `prefers-reduced-motion: reduce`, set smooth scrolling to auto and cancel transforms, continuous decorative animation, and timed carousel transitions while leaving roster functionality readable and controllable.

- [ ] **Step 5: Run tests and commit**

```powershell
npm test
git add src/hooks/useRevealOnScroll.js src/styles/global.css src/App.test.jsx
git commit -m "fix: make pit wall motion progressive"
```

### Task 11: Browser-Verify Every Public Workflow And Responsive Width

**Files:**
- Modify only if verification reveals a reproducible issue: public files listed above
- Create ignored artifacts: `output/pit-wall-*.png`

- [ ] **Step 1: Start the shared API and redesign dev server**

From the baseline root, start `npm run dev:api` on port 3000. From the redesign worktree, start:

```powershell
npm run dev -- --port 3002 --strictPort
```

Expected: API prints `http://127.0.0.1:3000`; Vite prints `http://127.0.0.1:3002/`. Keep both sessions running during browser verification.

- [ ] **Step 2: Verify 375, 390, 768, 1024, and 1440 widths**

Use `browser:control-in-app-browser`. At each width, check the first viewport, all homepage bands, the album folder page, an album detail, member video, photo preview, news detail, score calendar before/after selecting a populated and empty day, and the music dial. Save screenshots with width and surface in the filename.

- [ ] **Step 3: Run measurable layout checks at every width**

Evaluate:

```js
({
  viewport: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  overflow: document.documentElement.scrollWidth > window.innerWidth,
  tinyTargets: [...document.querySelectorAll('button, a')]
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    })
    .map((node) => node.getAttribute('aria-label') || node.textContent.trim()).slice(0, 20),
})
```

Expected: `overflow` is `false`; interactive targets are at least approximately `44x44`, except semantically larger links whose clickable padding makes the measured rect compliant.

- [ ] **Step 4: Verify interaction and accessibility paths**

Confirm anchor scrolling and active state, featured swipe, roster auto-motion/hover pause/drag/easing/click, album back/hash, Escape/backdrop/close, focus entry/restoration/trap, score month navigation and table, music play/pause/long-press/vertical drag, visible focus rings, and no console errors. Emulate reduced motion and confirm content remains visible and major movement stops.

- [ ] **Step 5: Fix issues one at a time with regression tests**

For each behavioral issue, add a failing test, run it, make the smallest fix, and rerun. For pure viewport CSS issues, capture the failing width and selector in the commit message and re-check all five widths. Do not change data/admin files while fixing visuals.

- [ ] **Step 6: Commit verified responsive fixes**

```powershell
npm test
git diff --check
git add src/App.jsx src/App.test.jsx src/components src/hooks src/styles/global.css
git commit -m "fix: complete pit wall responsive verification"
```

If no source changes were required, do not create an empty commit.

### Task 12: Final Audit, Documentation, And Dual-Version Handoff

**Files:**
- Modify: `DESIGN.md`
- Modify: `AGENTS.md`
- Verify: all redesign source and tests

- [ ] **Step 1: Run Impeccable polish, adapt, and audit passes**

Load the `impeccable` `polish`, `adapt`, and `audit` references against `src/App.jsx`, using the running browser. Resolve only findings that violate the confirmed spec: hierarchy, responsive fit, accessibility, media states, performance, or visual consistency. Do not broaden scope into admin or new features.

- [ ] **Step 2: Run final automated verification**

From the redesign worktree:

```powershell
npm test
npm run build
git diff --check
git status --short
```

Expected: all tests pass; production build succeeds with ExcelJS still isolated to the admin dynamic chunk; no whitespace errors; only intended tracked files are modified and `output/` remains ignored.

- [ ] **Step 3: Verify the original checkout is unchanged and passing**

From `C:\Users\Admin\Documents\H5`:

```powershell
git branch --show-current
git status --short
npm test
git diff 3d354f6 -- src package.json package-lock.json
```

Expected: branch remains `codex/config-admin-excel`; unrelated untracked files remain untouched; tests pass; no Pit Wall source changes exist in the baseline checkout.

- [ ] **Step 4: Finalize design and project documentation**

Update `DESIGN.md` to remove the seed comment and record actual implemented color variables, type stacks, widths, corner rules, section bands, dialog patterns, motion timings, responsive breakpoints, and reduced-motion behavior. Update `AGENTS.md` with branch/worktree, commits, files changed, tests/build counts, browser widths, screenshot paths, exact URLs, and any real remaining risk.

- [ ] **Step 5: Commit the final redesign state**

```powershell
git add DESIGN.md AGENTS.md src
git commit -m "docs: finalize pit wall redesign handoff"
git status --short
```

Expected: redesign worktree is clean after the commit.

- [ ] **Step 6: Start both versions for user comparison**

Keep the shared API on port 3000. Start the original root with:

```powershell
npm run dev -- --port 3001 --strictPort
```

Keep the redesign worktree on port 3002. Open and verify both:

- Original: `http://127.0.0.1:3001/`
- Pit Wall: `http://127.0.0.1:3002/`

Both must load the same `/api/config` and `/uploads` through their Vite proxy, so the comparison differs only in public UI code.

- [ ] **Step 7: Stop before merge and ask for the selection**

Provide both URLs, branch names, verification summary, and screenshot locations. Do not merge, delete the worktree, stop the previews, add a theme switcher, or overwrite the original until the user explicitly chooses a version and separately confirms the integration action.
