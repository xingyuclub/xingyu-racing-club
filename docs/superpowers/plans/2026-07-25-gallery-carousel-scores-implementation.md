# Gallery Carousel And Score Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable photo gallery, 3D draggable driver carousel, single-member gender counts, and a score-details table to the existing Xingyu racing club site.

**Architecture:** Keep the existing Vite + React single-page app and configuration-first data flow. Use React state for carousel, hash-based album view, photo modal, video modal, and score modal; use CSS 3D transforms and pointer events for the carousel without a library or backend.

**Tech Stack:** React 19, Vite, CSS, Vitest, React Testing Library, lucide-react, browser Pointer Events and URL Hash.

---

## File Structure

- Modify `src/data/teamData.js`: add single-member counts, gallery metadata, and score-detail rows; map featured-member videos and avatars through configuration.
- Modify `src/App.jsx`: compose gallery preview/page and coordinate selected photo, selected member, and score modal state plus `#album` navigation.
- Modify `src/App.test.jsx`: cover the new configuration contract, carousel controls, album view, photo modal, video auto-play, and score modal.
- Modify `src/components/StatsBar.jsx`: render object-valued single-member stat as male/female counts.
- Replace `src/components/FeaturedMembers.jsx`: implement eight-card 3D Coverflow, dots, pointer swipe, auto-advance, reduced-motion behavior, and video selection.
- Create `src/components/GalleryPreview.jsx`: render exactly five configured featured photos and the “查看更多相册” action.
- Create `src/components/AlbumPage.jsx`: render all configured photos with home navigation.
- Create `src/components/PhotoModal.jsx`: display one photo with close button, backdrop close, and Escape handling.
- Create `src/components/ScoreDetailsModal.jsx`: render configured score table, empty state, close behavior, and horizontal mobile table wrapper.
- Modify `src/components/Leaderboard.jsx`: add the score-details trigger.
- Modify `src/components/VideoModal.jsx`: auto-play real video sources and retain fallback behavior.
- Modify `src/styles/global.css`: style Coverflow depth, album grids, photo modal, score modal, buttons, hash view, and reduced motion.
- Create `public/images/album/README.md`: document project-local photo storage and metadata workflow without adding fake photos.

## Task 1: Extend Configuration And Data Rendering

**Files:**
- Modify: `src/data/teamData.js`
- Modify: `src/components/StatsBar.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write failing configuration tests**

Add tests for the new data contracts:

```jsx
it('configures single-member counts, five featured photos, and score details', () => {
  const single = teamData.stats.find((item) => item.label === '单身成员');
  expect(single.value).toEqual({ male: 12, female: 8 });
  expect(teamData.gallery.filter((photo) => photo.featured)).toHaveLength(5);
  expect(teamData.scoreDetails[0]).toEqual(
    expect.objectContaining({ id: 'member-01', total: 98 }),
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/App.test.jsx`

Expected: FAIL because the current fourth stat is a scalar “编外成员” value and gallery/scoreDetails do not exist.

- [ ] **Step 3: Add the minimal configuration**

Change the fourth stat to:

```js
{ label: '单身成员', value: { male: 12, female: 8 } },
```

Add eight placeholder gallery records under `gallery`; mark exactly five with `featured: true` and keep all image paths under `/images/album/`. Add one `scoreDetails` object per roster member with `id`, `active`, `event`, `attendance`, and `total`, using the existing member total points for `total`. Set the first eight `videoUrl` values to empty strings until real clips are provided.

- [ ] **Step 4: Update StatsBar for object values**

Render scalar values as before; for `item.value.male` and `item.value.female`, render a stable two-line value block containing `男：12` and `女：8`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/App.test.jsx`

Expected: data and existing app tests pass.

- [ ] **Step 6: Commit data contract**

Run: `git add src/data/teamData.js src/components/StatsBar.jsx src/App.test.jsx; git commit -m "feat: add gallery and score configuration"`

## Task 2: Implement The 3D Driver Carousel

**Files:**
- Replace: `src/components/FeaturedMembers.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write failing carousel tests**

Add tests for title, eight dots, manual dot selection, and pointer swipe:

```jsx
it('renders an eight-card synced driver carousel', async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);
  expect(screen.getByRole('heading', { name: '队员风采' })).toBeInTheDocument();
  expect(container.querySelectorAll('.carousel-dot')).toHaveLength(8);
  expect(container.querySelector('.driver-card.is-active')).toHaveTextContent('成员 01');
  await user.click(screen.getByRole('button', { name: '切换至成员 03' }));
  expect(container.querySelector('.driver-card.is-active')).toHaveTextContent('成员 03');
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/App.test.jsx`

Expected: FAIL because the section still uses the old grid and has no carousel dots.

- [ ] **Step 3: Implement the carousel state and controls**

Use `useState(0)`, a `setInterval` effect at 4000ms, and `prefers-reduced-motion` to disable the interval when reduced motion is active. Use `onPointerDown`, `onPointerUp`, and `onPointerCancel`; a delta less than `-45` advances and greater than `45` goes back. Reset the interval after a manual change. Render all eight cards, assign active/prev/next/far classes by modular distance, and render one button dot per member.

- [ ] **Step 4: Connect card click to the existing member selection**

Keep `onSelect(member)` as the card action. The resulting `VideoModal` will auto-play when `videoUrl` is available.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/App.test.jsx`

Expected: carousel tests and all prior tests pass.

- [ ] **Step 6: Commit carousel**

Run: `git add src/components/FeaturedMembers.jsx src/App.jsx src/App.test.jsx; git commit -m "feat: add draggable 3d driver carousel"`

## Task 3: Add Gallery Preview, Album View, And Photo Modal

**Files:**
- Create: `src/components/GalleryPreview.jsx`
- Create: `src/components/AlbumPage.jsx`
- Create: `src/components/PhotoModal.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write failing gallery tests**

Add tests for five featured cards, hash navigation, full gallery, and photo modal close:

```jsx
it('shows five featured photos and opens the full album view', async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getAllByTestId('featured-photo')).toHaveLength(5);
  await user.click(screen.getByRole('button', { name: '查看更多相册' }));
  expect(window.location.hash).toBe('#album');
  expect(screen.getByRole('heading', { name: '车队相册' })).toBeInTheDocument();
  expect(screen.getAllByTestId('album-photo')).toHaveLength(teamData.gallery.length);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/App.test.jsx`

Expected: FAIL because no gallery components or `#album` state exist.

- [ ] **Step 3: Implement GalleryPreview and AlbumPage**

Filter `teamData.gallery` by `featured` for the five-card preview. In `App`, initialize `showAlbum` from `window.location.hash === '#album'`, update it on `hashchange`, and expose `openAlbum()` that sets `window.location.hash = 'album'`. Album page renders all records and a button that calls `window.location.hash = ''`.

- [ ] **Step 4: Implement PhotoModal**

Use the same modal lifecycle as `VideoModal`: `modal-open` body class, Escape listener, backdrop target guard, close button, and an image with configured `alt`. The image should have a fallback class if its load event errors.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/App.test.jsx`

Expected: all gallery tests pass.

- [ ] **Step 6: Commit gallery**

Run: `git add src/components/GalleryPreview.jsx src/components/AlbumPage.jsx src/components/PhotoModal.jsx src/App.jsx src/App.test.jsx; git commit -m "feat: add configurable team album"`

## Task 4: Add Score Details Modal And Video Autoplay

**Files:**
- Create: `src/components/ScoreDetailsModal.jsx`
- Modify: `src/components/Leaderboard.jsx`
- Modify: `src/components/VideoModal.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Write failing score and video tests**

Add tests:

```jsx
it('opens the configured score details table', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: '查看具体分数' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('活跃分');
  expect(screen.getByRole('dialog')).toHaveTextContent('赛事分');
  expect(screen.getByRole('dialog')).toHaveTextContent('总分');
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/App.test.jsx`

Expected: FAIL because the leaderboard has no details trigger and no score modal.

- [ ] **Step 3: Add details trigger and modal**

Add a text-plus-table-icon button to the leaderboard heading. Render a dialog with a horizontally scrollable table on narrow screens. Use the existing modal close pattern and show “积分明细待更新” when rows are empty.

- [ ] **Step 4: Add video auto-play**

When `member.videoUrl` exists, render `<video autoPlay muted controls playsInline ... />`; keep fallback when it is empty. The existing member state and close behavior remain unchanged.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/App.test.jsx`

Expected: all score, video, and prior tests pass.

- [ ] **Step 6: Commit score and video behavior**

Run: `git add src/components/ScoreDetailsModal.jsx src/components/Leaderboard.jsx src/components/VideoModal.jsx src/App.jsx src/App.test.jsx; git commit -m "feat: add score details and video autoplay"`

## Task 5: Style The New Visual Surfaces

**Files:**
- Modify: `src/styles/global.css`
- Create: `public/images/album/README.md`

- [ ] **Step 1: Add local storage documentation**

Document that actual images belong in `public/images/album/`, should be referenced by `/images/album/<filename>`, and each asset needs matching `src`, `title`, `date`, and `alt` configuration.

- [ ] **Step 2: Add 3D Coverflow CSS**

Style `.carousel-viewport` with `perspective`, `.driver-card` transforms for active/prev/next/far states, stable card dimensions, `touch-action: pan-y`, and overflow clipping. Dots use `.carousel-dot.is-active` and remain directly below the viewport.

- [ ] **Step 3: Add gallery, album, and modal CSS**

Style the five-photo home grid as one large plus four small items, the responsive all-photo grid, `photo-modal`, `score-modal`, table wrapper, close buttons, loading/error state, and mobile horizontal table scroll.

- [ ] **Step 4: Add reduced-motion rules**

Under `prefers-reduced-motion: reduce`, remove transform transitions and hide non-active carousel cards without automatic interval behavior. Keep all dots, buttons, photo tiles, and modal content accessible.

- [ ] **Step 5: Run tests and build**

Run: `npm test; npm run build; git diff --check`

Expected: tests pass, build succeeds, and no whitespace errors appear.

- [ ] **Step 6: Commit visual layer**

Run: `git add src/styles/global.css public/images/album/README.md; git commit -m "feat: style gallery and 3d carousel surfaces"`

## Task 6: Browser Verification

**Files:**
- Modify only files implicated by verified defects.

- [ ] **Step 1: Run the development server**

Run: `npm run dev -- --host 127.0.0.1 --port 4177`

- [ ] **Step 2: Verify at 390 x 844**

Check 3D depth, 8 dots, pointer swipe, member card click, exactly five featured photos, album hash navigation, photo modal, single-member male/female values, score details modal, no horizontal page overflow, and no text overlap.

- [ ] **Step 3: Verify at 1280 x 900**

Check visible side cards, 3D transforms, five-photo desktop grid, score table width, full album layout, and stable hover/click dimensions.

- [ ] **Step 4: Verify reduced motion**

Emulate reduced motion; confirm auto-advance stops, active content remains visible, dots and drag controls still work, and dialogs remain usable.

- [ ] **Step 5: Run final commands**

Run: `npm test; npm run build; git diff --check; git status --short --branch`

Expected: all tests and build pass; only intentional untracked verification artifacts may remain.

## Self-Review

- Spec coverage: 3D depth, eight synced dots, drag input, autoplay, video autoplay, five featured photos, all-photo hash page, photo modal, configurable gender counts, score details table, empty states, and responsive/reduced-motion behavior are each assigned to a task.
- Scope: no backend, database, upload flow, external carousel library, or route package is introduced.
- Type consistency: gallery records use `featured`; stats use an object value only for `单身成员`; score rows use `active`, `event`, `attendance`, and `total`; components receive explicit props.
- Verification: tests cover behavior first; browser checks cover visual and responsive requirements.
