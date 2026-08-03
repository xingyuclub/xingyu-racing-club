# Xingyu Admin Collapse, Signature, and Weekend Formulas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make admin sections collapsed by default, add member signatures to the video dialog, and give the admin score tables descending numeric sorting plus formula-driven Saturday and Sunday rows.

**Architecture:** Keep raw member and weekend inputs in the existing config shape, and make `server/lib/scoreLedger.js` the single source of truth for weekend inheritance, score, and weekly total calculations. Admin components consume hydrated rows for formula output and keep sorting as view-only React state so stored member and score order never changes.

**Tech Stack:** Vite, React 19, Vitest, Testing Library, Express config validation, ExcelJS, existing Lucide icons and CSS.

---

## File Map

- Modify `src/data/teamData.js`: add the default raw member `signature` value.
- Modify `src/data/siteConfig.js`: migrate missing signatures and expose weekend projection metadata.
- Modify `server/lib/configStore.js`: validate member signatures as strings.
- Modify `src/admin/ConfigEditor.jsx`: add the signature label/template and collapsed top-level sections.
- Modify `src/admin/admin.css`: style top-level section toggles and sortable table headers.
- Modify `src/admin/ScoreEditor.jsx`: include weekend dates/rows and descending numeric sorting.
- Modify `src/admin/WeekendScoreEditor.jsx`: formula-only outputs, inherited Saturday baseline, and per-table descending sorting.
- Modify `src/components/VideoModal.jsx`: show signature above video and remove name/close controls.
- Modify `src/styles/global.css`: style the signature and preserve the video frame layout.
- Modify `server/lib/scoreLedger.js`: implement the shared Saturday/Sunday formulas and inheritance.
- Modify `src/admin/scoreWorkbook.js`: export formula-derived weekend values.
- Modify focused tests beside each affected module.

Because the worktree already contains user-owned modifications in several target files, inspect `git diff -- <file>` before every edit. Do not revert or reformat unrelated lines. Do not create implementation commits unless the staged diff contains only this task's changes.

### Task 1: Add the raw member signature contract

**Files:**
- Modify: `src/data/teamData.js`
- Modify: `src/data/siteConfig.js`
- Modify: `src/data/siteConfig.test.js`
- Modify: `server/lib/configStore.js`
- Modify: `server/lib/configStore.test.js`

- [ ] **Step 1: Write failing migration and validation tests**

Add tests proving old members receive an empty signature, explicit signatures survive migration, and non-string signatures are rejected:

```js
it('adds an empty signature to legacy roster members and preserves configured signatures', () => {
  const input = structuredClone(teamData);
  delete input.roster[0].signature;
  input.roster[1].signature = '保持热爱，奔赴山海';

  const migrated = migrateRawConfig(input);

  expect(migrated.roster[0].signature).toBe('');
  expect(migrated.roster[1].signature).toBe('保持热爱，奔赴山海');
});
```

```js
it('rejects a non-string member signature', async () => {
  const config = createSeedConfig();
  config.roster[0].signature = 42;

  await expect(store.save(config)).rejects.toMatchObject({
    details: expect.arrayContaining(['roster[0].signature must be a string']),
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- --run src/data/siteConfig.test.js server/lib/configStore.test.js
```

Expected: failures because legacy members do not receive `signature` and validation does not reject a number.

- [ ] **Step 3: Implement the minimal data changes**

Add `signature: ''` to the raw member fixture. Normalize every roster member in `migrateRawConfig` without changing other properties:

```js
const normalizedRoster = roster.map((member) => ({
  ...createRawMember(member, sortedScores),
  signature: typeof member.signature === 'string' ? member.signature : '',
}));
```

Extend the config validator:

```js
requireString(member, ['avatar', 'videoUrl', 'signature'], path, details);
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the command from Step 2. Expected: both test files pass.

### Task 2: Collapse every top-level admin section and expose signature editing

**Files:**
- Modify: `src/admin/ConfigEditor.jsx`
- Modify: `src/admin/AdminApp.test.jsx`
- Modify: `src/admin/admin.css`

- [ ] **Step 1: Write failing interaction tests**

Test that all seven sections start closed, expand independently, and reveal the signature field only after opening member management:

```jsx
it('starts every top-level admin section collapsed and expands them independently', async () => {
  const user = userEvent.setup();
  render(<ConfigEditor initialConfig={createSeedConfig()} onAuthError={() => false} />);

  const toggles = screen.getAllByRole('button', { name: /^展开/ });
  expect(toggles).toHaveLength(7);
  expect(screen.queryByLabelText('名称')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('个性签名')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '展开 成员管理' }));
  expect(screen.getAllByLabelText('个性签名')[0]).toHaveValue('');
  expect(screen.getByRole('button', { name: '收起 成员管理' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: '展开 新闻管理' })).toHaveAttribute('aria-expanded', 'false');
});
```

Update existing admin tests to click `展开 基础信息`, `展开 成员管理`, `展开 新闻管理`, or `展开 星屿积分榜` before querying controls inside those sections. Add a save assertion:

```js
await user.type(screen.getAllByLabelText('个性签名')[0], '一路向星光');
// after saving
expect(savedConfig.roster[0].signature).toBe('一路向星光');
```

- [ ] **Step 2: Run the admin test and verify RED**

Run:

```powershell
npm test -- --run src/admin/AdminApp.test.jsx
```

Expected: no top-level expand buttons exist and no signature input is rendered.

- [ ] **Step 3: Implement one small section wrapper**

Add `signature: '个性签名'` to `labels`, `signature: ''` to `empty.roster`, and create a local wrapper with `collapsed` initially true:

```jsx
function AdminSection({ title, children }) {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <section className={`admin-section${collapsed ? ' is-collapsed' : ''}`}>
      <button
        type="button"
        className="admin-section-toggle"
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? '展开' : '收起'} ${title}`}
        onClick={() => setCollapsed((value) => !value)}
      >
        <h2>{title}</h2>
        {collapsed ? <ChevronDown aria-hidden="true" size={18} /> : <ChevronUp aria-hidden="true" size={18} />}
      </button>
      {!collapsed && children}
    </section>
  );
}
```

Use this wrapper for the five configuration sections, score section, and upload section. Keep the save bar outside all wrappers. In `admin.css`, make the toggle full width, align title/icon, and retain the existing flat section border.

- [ ] **Step 4: Run the admin test and verify GREEN**

Run the command from Step 2. Expected: all tests pass without accessibility warnings.

### Task 3: Replace the member video header with a signature

**Files:**
- Modify: `src/components/VideoModal.jsx`
- Modify: `src/App.test.jsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Replace outdated video tests with failing required behavior**

Add tests for signature placement, removed controls, blank-signature omission, backdrop-only clicking, and Escape:

```jsx
it('shows a non-empty signature above the member video without name or close button', () => {
  const { container } = render(
    <VideoModal member={{ name: '青山', signature: '一路向星光', videoUrl: '/member.mp4' }} onClose={vi.fn()} />,
  );
  const dialog = screen.getByRole('dialog');
  const signature = within(dialog).getByText('一路向星光');
  const video = container.querySelector('video');

  expect(signature.compareDocumentPosition(video) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(dialog).queryByText('青山')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '关闭视频弹窗' })).not.toBeInTheDocument();
});

it('closes only from blank backdrop clicks', async () => {
  const onClose = vi.fn();
  const { container } = render(
    <VideoModal member={{ signature: '一路向星光', videoUrl: '/member.mp4' }} onClose={onClose} />,
  );
  await userEvent.click(container.querySelector('video'));
  await userEvent.click(screen.getByText('一路向星光'));
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.click(container.querySelector('.video-modal-backdrop'));
  expect(onClose).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the video tests and verify RED**

Run:

```powershell
npm test -- --run src/App.test.jsx
```

Expected: the existing name and close button violate the new assertions.

- [ ] **Step 3: Implement the minimal dialog markup and CSS**

Remove the `X` import, close button, member header, and `aria-labelledby`. Keep `role="dialog"`, `aria-modal="true"`, current Escape listener, and the existing target/currentTarget backdrop guard. Render before the video:

```jsx
{member.signature?.trim() && (
  <p className="member-video-signature">{member.signature.trim()}</p>
)}
```

Style `.member-video-signature` as a compact, centered line above the 16:9 video. Remove member-header rules made unused by this change, but do not change shared photo/news modal styles.

- [ ] **Step 4: Run the video tests and verify GREEN**

Run the command from Step 2. Expected: all `App` tests pass.

### Task 4: Make the ledger authoritative for weekend formulas

**Files:**
- Modify: `server/lib/scoreLedger.js`
- Modify: `server/lib/scoreLedger.test.js`
- Modify: `src/data/siteConfig.js`
- Modify: `src/data/siteConfig.test.js`

- [ ] **Step 1: Write failing formula tests**

Cover Friday-to-Saturday accumulation, Saturday-to-Sunday point deltas, prior-Sunday inheritance, first-week manual baseline, and raw-field fallback:

```js
it('derives weekend scores and totals and carries Sunday points into next Saturday', () => {
  const { dailyDetail } = projectScores({
    roster: [{ id: '1' }],
    dailyScores: [
      { date: '2026-08-07', rows: [{ id: '1', teamRace: [20, 0, 0], openRace: [0, 0, 0] }] },
      { date: '2026-08-14', rows: [{ id: '1', teamRace: [8, 0, 0], openRace: [0, 0, 0] }] },
    ],
    weekendScores: [
      { date: '2026-08-08', rows: [{ id: '1', previousPoints: 90, points: 100 }] },
      { date: '2026-08-09', rows: [{ id: '1', points: 112 }] },
      { date: '2026-08-15', rows: [{ id: '1', previousPoints: 999, points: 120 }] },
    ],
  });

  expect(dailyDetail.find(({ date }) => date === '2026-08-08').rows[0]).toMatchObject({
    previousPoints: 90, previousPointsInherited: false, score: 10, total: 30,
  });
  expect(dailyDetail.find(({ date }) => date === '2026-08-09').rows[0]).toMatchObject({ score: 12, total: 42 });
  expect(dailyDetail.find(({ date }) => date === '2026-08-15').rows[0]).toMatchObject({
    previousPoints: 112, previousPointsInherited: true, score: 8, total: 16,
  });
});
```

Also assert that a first Saturday with incomplete point inputs still preserves an imported `score`/`total` fallback instead of erasing historical results.

- [ ] **Step 2: Run ledger/config tests and verify RED**

Run:

```powershell
npm test -- --run server/lib/scoreLedger.test.js src/data/siteConfig.test.js
```

Expected: the second Saturday uses raw `previousPoints: 999` and imported values still override formulas.

- [ ] **Step 3: Implement date-aware weekend state**

Keep weekly totals resetting on Monday, but keep a separate map of prior Sunday points across resets:

```js
let saturdayPoints = new Map();
const previousSundayPoints = new Map();
```

For Saturday, use `previousSundayPoints.get(memberId) ?? numericValue(row.previousPoints)`. For Sunday, use the current week's Saturday points. Prefer formula results whenever both operands exist; use imported `score` only when a required operand is missing. Prefer `currentWeekTotal + derivedScore` whenever the score is derived; use imported `total` only for incomplete legacy rows.

After processing a Sunday row with a numeric `points`, store it in `previousSundayPoints`. Expose `previousPointsInherited` only on Saturday projected rows. Preserve the existing all-blank-row filter.

Map `previousPointsInherited` through `hydrateSiteData` beside `previousPoints` and `points`.

- [ ] **Step 4: Run ledger/config tests and verify GREEN**

Run the command from Step 2. Expected: all focused tests pass.

### Task 5: Make weekend entry formula-driven and sortable

**Files:**
- Modify: `src/admin/WeekendScoreEditor.jsx`
- Modify: `src/admin/WeekendScoreEditor.test.jsx`
- Modify: `src/admin/admin.css`

- [ ] **Step 1: Write failing editor tests**

Use fake system time to create two adjacent weekends. Test manual first-week baseline, inherited read-only baseline, read-only score/total, live recalculation, and descending sorting:

```jsx
it('calculates weekend fields and locks an inherited Saturday baseline', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-15T12:00:00'));
  const config = {
    ...baseConfig,
    dailyScores: [{ date: '2026-08-14', rows: [{ id: '1', teamRace: [8, 0, 0], openRace: [0, 0, 0] }] }],
    weekendScores: [
      { date: '2026-08-09', rows: [{ id: '1', points: 112 }] },
      { date: '2026-08-15', rows: [{ id: '1', previousPoints: 999, points: 120 }] },
    ],
  };
  render(<StatefulEditor initial={config} />);

  expect(screen.getByLabelText('周六 青山 上周积分')).toHaveValue(112);
  expect(screen.getByLabelText('周六 青山 上周积分')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('周六 青山 得分')).toHaveValue(8);
  expect(screen.getByLabelText('周六 青山 总分')).toHaveValue(16);
});
```

For sorting, click `按周六积分从大到小排序` and assert the displayed member names are ordered by effective points. Repeat for Saturday previous points/score/total and Sunday points/score/total.

- [ ] **Step 2: Run the weekend editor test and verify RED**

Run:

```powershell
npm test -- --run src/admin/WeekendScoreEditor.test.jsx
```

Expected: score and total remain editable/raw, inheritance metadata is absent, and sort controls do not exist.

- [ ] **Step 3: Implement projected rows and descending view sorting**

Call `hydrateSiteData(config)` once in `useMemo`, index projected weekend rows by date/member ID, and merge each projected row with its raw counterpart. Keep only `previousPoints` and `points` writable. Render `score` and `total` as read-only number inputs.

Maintain independent sort keys per weekend date:

```js
const [sortKeys, setSortKeys] = useState({});
const sortedMembers = [...config.scoreMembers].sort((left, right) =>
  numericSortValue(projected(right.id)?.[sortKey])
    - numericSortValue(projected(left.id)?.[sortKey])
  || left.name.localeCompare(right.name));
```

Use `Number.NEGATIVE_INFINITY` for blank cells so they remain last. Add icon buttons inside numeric `<th>` elements with clear `aria-label` and `title`; sorting is always descending and never mutates config.

- [ ] **Step 4: Run the weekend editor test and verify GREEN**

Run the command from Step 2. Expected: all weekend editor tests pass.

### Task 6: Show weekend rows in score details and sort every numeric column

**Files:**
- Modify: `src/admin/ScoreEditor.jsx`
- Modify: `src/admin/ScoreEditor.test.jsx`
- Modify: `src/admin/admin.css`

- [ ] **Step 1: Write failing union-date and sort tests**

Add one config fixture with Friday, Saturday, and Sunday data. Assert the latest union date is selected, Saturday and Sunday use their required columns, formula fields are read-only, and each numeric header sorts descending:

```jsx
it('includes weekend dates and renders their formula fields read-only', async () => {
  const config = createConfigWithWeekend();
  render(<ScoreEditorHarness initialConfig={config} onChange={() => {}} />);

  expect(screen.getByLabelText('筛选日期')).toHaveValue('2026-08-09');
  expect(screen.getByRole('columnheader', { name: '积分' })).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: '上周积分' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('周日 青山 得分')).toHaveAttribute('readonly');

  await userEvent.clear(screen.getByLabelText('筛选日期'));
  await userEvent.type(screen.getByLabelText('筛选日期'), '2026-08-08');
  expect(screen.getByRole('columnheader', { name: '上周积分' })).toBeInTheDocument();
});
```

For weekdays, click each of the six race headers, score, and total and assert descending row order. For Saturday, cover previous points, points, score, and total. For Sunday, cover points, score, and total. Assert that editing a sorted weekday row updates the original member ID, not the visual array position.

- [ ] **Step 2: Run the score editor test and verify RED**

Run:

```powershell
npm test -- --run src/admin/ScoreEditor.test.jsx
```

Expected: the date list excludes weekends and numeric header buttons do not exist.

- [ ] **Step 3: Implement separate weekday/weekend render paths**

Build `availableDates` from both raw arrays and default to its latest entry. Keep weekday raw rows with their original flat indices. Read weekend rows from `hydrateSiteData(config).dailyScores` and render them read-only with Saturday/Sunday-specific headers.

Use a single `sortKey` for the currently displayed table. Reset it when `selectedDate` changes. Define explicit value readers rather than a generic deep accessor:

```js
const weekdaySortValue = (entry, key) => {
  if (key.startsWith('teamRace-')) return entry.row.teamRace[Number(key.at(-1))];
  if (key.startsWith('openRace-')) return entry.row.openRace[Number(key.at(-1))];
  return totals.get(totalKey(entry.row.date, entry.row.id))?.[key];
};
```

Create a small local `SortableHeader` component used only by this editor. Sort a copied visible array descending with name as a stable tie-breaker. Keep the raw `index` on weekday entries for update/delete operations.

- [ ] **Step 4: Run the score editor test and verify GREEN**

Run the command from Step 2. Expected: all score editor tests pass.

### Task 7: Export formula-derived weekend results

**Files:**
- Modify: `src/admin/scoreWorkbook.js`
- Modify: `src/admin/scoreWorkbook.test.js`

- [ ] **Step 1: Write a failing workbook assertion**

Use weekend raw rows with intentionally stale `score`/`total` values and assert the exported “周末手动积分” sheet contains the shared formula results:

```js
config.dailyScores = [
  { date: '2026-08-07', rows: [{ id: member.id, teamRace: [20, 0, 0], openRace: [0, 0, 0] }] },
];
config.weekendScores = [
  { date: '2026-08-08', rows: [{ id: member.id, previousPoints: 90, points: 100, score: 999, total: 999 }] },
  { date: '2026-08-09', rows: [{ id: member.id, points: 112, score: 999, total: 999 }] },
];

expect(weekendSheet.getCell('F4').value).toBe(10);
expect(weekendSheet.getCell('G4').value).toBe(30);
expect(weekendSheet.getCell('F5').value).toBe(12);
expect(weekendSheet.getCell('G5').value).toBe(42);
```

- [ ] **Step 2: Run the workbook test and verify RED**

Run:

```powershell
npm test -- --run src/admin/scoreWorkbook.test.js
```

Expected: exported cells still contain stale raw values.

- [ ] **Step 3: Build weekend export rows from shared projection**

Import or reuse `hydrateSiteData(config)`, index hydrated weekend rows by date/member ID, and populate the existing weekend sheet headers from projected `previousPoints`, raw/projected `points`, projected `score`, and projected `total`. Keep the current workbook schema, date formatting, import parsing, and template behavior unchanged.

- [ ] **Step 4: Run the workbook test and verify GREEN**

Run the command from Step 2. Expected: workbook tests pass and ExcelJS remains dynamically loaded.

### Task 8: Full regression and browser verification

**Files:**
- Verify only; update implementation files only for defects directly caused by Tasks 1-7.

- [ ] **Step 1: Run all automated tests**

Run:

```powershell
npm test -- --run
```

Expected: every test file and test case passes with no unhandled errors.

- [ ] **Step 2: Run the production build**

Run:

```powershell
npm run build
```

Expected: exit code `0`; ExcelJS remains a separate lazy chunk and the public entry bundle does not absorb admin-only editor code.

- [ ] **Step 3: Start or reuse local servers**

Check listeners first. Start the API and Vite server only if needed, using unused ports and the project's existing scripts. Record the actual local URL.

- [ ] **Step 4: Verify desktop admin workflows**

At `1280x800`, verify all seven top-level sections start closed; expand member management, edit a signature, and confirm the draft remains intact after collapsing/reopening. Open score details and weekend entry, verify Saturday/Sunday formulas and every numeric sort control.

- [ ] **Step 5: Verify member video behavior**

Open a member with a non-empty signature. Confirm the signature is above the video, the name and close button are absent, content clicks do nothing, blank backdrop click closes, and Escape closes.

- [ ] **Step 6: Verify mobile layout**

At `390x844`, repeat top-level section expansion, one weekend sort, and video modal closing. Confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth`; wide score tables may scroll only inside their table wrappers.

- [ ] **Step 7: Review the final diff**

Run:

```powershell
git diff --check
git status --short
git diff -- src/data/teamData.js src/data/siteConfig.js server/lib/configStore.js src/admin/ConfigEditor.jsx src/admin/ScoreEditor.jsx src/admin/WeekendScoreEditor.jsx src/admin/scoreWorkbook.js src/components/VideoModal.jsx src/admin/admin.css src/styles/global.css
```

Expected: no whitespace errors, no unrelated formatting churn, no user-owned files reverted, and every changed production line maps to the approved specification.

