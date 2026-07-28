# Daily Score Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing score-details action with a mobile calendar that reveals configured per-day racing scores.

**Architecture:** Keep `Leaderboard` responsible for the Top 10 and opening the lookup. Keep `ScoreDetailsModal` as the modal boundary, but change its input to `dailyScores` and let it own month/date selection. Store the first sample day and all round values in `teamData.js` so future edits remain configuration-only.

**Tech Stack:** React 19, Vite 6, Vitest, Testing Library, CSS Grid, Pointer-independent button interactions.

---

### Task 1: Lock the new leaderboard contract

**Files:**
- Modify: `src/App.test.jsx`
- Modify: `src/components/Leaderboard.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
expect(screen.getByRole('heading', { name: '星屿积分榜' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '查找' })).toBeInTheDocument();
expect(container.querySelector('.score-search-icon')).toHaveAttribute(
  'src',
  '/images/icons/search.png',
);
expect(container.querySelector('.leader-score')).toHaveTextContent('98分');
expect(screen.queryByText('PTS')).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and confirm it fails on the old title/action/unit**

Run: `npm test -- --run src/App.test.jsx -t "renders the score lookup entry"`

- [ ] **Step 3: Implement the minimal leaderboard markup**

```jsx
<h2 id="leaderboard-title">星屿积分榜</h2>
<button className="text-action" type="button" onClick={onOpenDetails}>
  <img className="score-search-icon" src="/images/icons/search.png" alt="" />
  查找
</button>
<span className="leader-score"><strong>{row.points}</strong><small>分</small></span>
```

- [ ] **Step 4: Re-run the focused test and confirm it passes**

Run: `npm test -- --run src/App.test.jsx -t "renders the score lookup entry"`

### Task 2: Add configuration-first daily scores

**Files:**
- Modify: `src/data/teamData.js`
- Modify: `src/App.jsx`
- Test: `src/App.test.jsx`

- [ ] **Step 1: Write a failing configuration test**

```jsx
expect(teamData.dailyScores[0]).toEqual(
  expect.objectContaining({ date: '2026-07-24', weekday: '周五' }),
);
expect(teamData.dailyScores[0].rows).toHaveLength(30);
expect(teamData.dailyScores[0].rows[0]).toEqual(
  expect.objectContaining({ teamRace: [1, 6, 5], openRace: [1, 3, 2], score: 18 }),
);
```

- [ ] **Step 2: Run the test and confirm `dailyScores` is missing**

Run: `npm test -- --run src/App.test.jsx -t "defines configured daily scores"`

- [ ] **Step 3: Add the daily-score record and pass it to the modal**

```js
dailyScores: [{
  date: '2026-07-24',
  weekday: '周五',
  rows: roster.map((member, index) => ({
    id: member.id,
    name: member.name,
    teamRace: scoreTemplate[index]?.teamRace || [0, 0, 0],
    openRace: scoreTemplate[index]?.openRace || [0, 0, 0],
    score: 0,
    total: member.points,
  })),
}],
```

Update the modal call to `<ScoreDetailsModal dailyScores={teamData.dailyScores} ... />`.

- [ ] **Step 4: Re-run the focused configuration test**

Run: `npm test -- --run src/App.test.jsx -t "defines configured daily scores"`

### Task 3: Replace the detail table with the date calendar

**Files:**
- Modify: `src/components/ScoreDetailsModal.jsx`
- Test: `src/App.test.jsx`

- [ ] **Step 1: Write the failing interaction test**

```jsx
await user.click(screen.getByRole('button', { name: '查找' }));
const dialog = screen.getByRole('dialog');
expect(within(dialog).getByRole('heading', { name: '日期积分查询' })).toBeInTheDocument();
await user.click(within(dialog).getByRole('button', { name: '查看 2026年7月24日积分' }));
expect(dialog).toHaveTextContent('队内赛');
expect(dialog).toHaveTextContent('开黑赛');
expect(dialog).toHaveTextContent('得分');
expect(dialog).toHaveTextContent('总分');
expect(within(dialog).getAllByTestId('daily-score-row')).toHaveLength(30);
```

- [ ] **Step 2: Run the test and confirm the old details table fails the calendar contract**

Run: `npm test -- --run src/App.test.jsx -t "opens the daily score calendar"`

- [ ] **Step 3: Implement month navigation, day selection, empty state, and the grouped score table**

`ScoreDetailsModal` must derive its initial month from `dailyScores[0].date`, render 7 weekday labels, render complete month cells, highlight configured dates, update `selectedDate` on click, and display either the grouped table or `当日暂无积分记录`.

- [ ] **Step 4: Run the focused interaction test**

Run: `npm test -- --run src/App.test.jsx -t "opens the daily score calendar"`

### Task 4: Add mobile calendar/table styling and the supplied icon

**Files:**
- Create: `public/images/icons/search.png`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Copy the supplied icon without altering its pixels**

Copy `C:\Users\Admin\Downloads\搜索-copy.png` to `public/images/icons/search.png`.

- [ ] **Step 2: Add scoped styles**

Add stable 7-column calendar tracks, 36px month controls, square day buttons, selected/has-record states, a horizontally scrollable `.daily-score-table-wrap`, `min-width: 720px` on the detail table, and a sticky first member column.

- [ ] **Step 3: Verify 390px and 477px browser layouts**

The page must have no positive horizontal overflow. The modal must remain within `86vh`; the table may scroll only inside its wrapper.

### Task 5: Full verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run all tests**

Run: `npm test -- --run`
Expected: all tests pass.

- [ ] **Step 2: Build production assets**

Run: `npm run build`
Expected: Vite build exits 0.

- [ ] **Step 3: Check whitespace and preview**

Run: `git diff --check`
Expected: exit 0.

Reload `http://127.0.0.1:4177/`, open “查找”, choose 2026-07-24, and verify the grouped score table at H5 width.
