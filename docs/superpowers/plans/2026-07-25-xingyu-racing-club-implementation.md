# Xingyu Racing Club Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first internal honor site for the `⁢⁣ˣʸ༩·星⁡⁠屿` racing club.

**Architecture:** Use a Vite + React single-page app. Keep all editable content in one configuration module, render focused presentational components, and use local React state only for the member video modal.

**Tech Stack:** Vite, React, CSS, Vitest, React Testing Library.

---

## File Structure

- Create `package.json`: npm scripts and dependencies.
- Create `index.html`: Vite HTML entry.
- Create `vite.config.js`: Vite React plugin and Vitest jsdom setup.
- Create `src/main.jsx`: React root mount.
- Create `src/App.jsx`: page composition and modal state.
- Create `src/data/teamData.js`: all editable team content.
- Create `src/components/Hero.jsx`: first-screen honor section.
- Create `src/components/StatsBar.jsx`: season stats strip.
- Create `src/components/FeaturedMembers.jsx`: 8 core member cards.
- Create `src/components/Roster.jsx`: 30-person compact roster.
- Create `src/components/Leaderboard.jsx`: mobile-readable rankings.
- Create `src/components/NewsFeed.jsx`: news and updates.
- Create `src/components/VideoModal.jsx`: member video dialog and fallback message.
- Create `src/styles/global.css`: all layout and visual styling.
- Create `src/test/setup.js`: Testing Library matchers.
- Create `src/App.test.jsx`: smoke and interaction tests.
- Modify `.gitignore`: keep generated dependencies and build output out of Git.

## Task 1: Project Scaffold And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.js`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/App.test.jsx`
- Create: `src/test/setup.js`
- Modify: `.gitignore`

- [ ] **Step 1: Write the first failing app test**

Create `src/App.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  it('renders the racing club name', () => {
    render(<App />);
    expect(screen.getByText('⁢⁣ˣʸ༩·星⁡⁠屿')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add test setup**

Create `src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Add project package metadata**

Create `package.json`:

```json
{
  "name": "xingyu-racing-club",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 4: Add Vite config**

Create `vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
});
```

- [ ] **Step 5: Add the HTML entry**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>⁢⁣ˣʸ༩·星⁡⁠屿</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Add the minimal React entry and app**

Create `src/main.jsx`:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `src/App.jsx`:

```jsx
export default function App() {
  return <main>⁢⁣ˣʸ༩·星⁡⁠屿</main>;
}
```

- [ ] **Step 7: Add temporary base stylesheet**

Create `src/styles/global.css`:

```css
:root {
  color: #f4f0e8;
  background: #090909;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background: #090909;
}
```

- [ ] **Step 8: Update ignored generated files**

Modify `.gitignore` so it contains:

```gitignore
.superpowers/
.worktrees/
node_modules/
dist/
coverage/
```

- [ ] **Step 9: Install dependencies and verify the test passes**

Run:

```powershell
npm install
npm test
```

Expected: `1 passed`.

- [ ] **Step 10: Commit scaffold**

Run:

```powershell
git add package.json package-lock.json index.html vite.config.js src .gitignore
git commit -m "feat: scaffold racing club site"
```

## Task 2: Team Configuration Data

**Files:**
- Create: `src/data/teamData.js`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add tests for configured data counts**

Replace `src/App.test.jsx` with:

```jsx
import { render, screen } from '@testing-library/react';
import App from './App.jsx';
import { teamData } from './data/teamData.js';

describe('teamData', () => {
  it('defines 8 featured members and 30 roster members', () => {
    expect(teamData.featuredMembers).toHaveLength(8);
    expect(teamData.roster).toHaveLength(30);
  });

  it('keeps featured members inside the full roster', () => {
    const rosterIds = new Set(teamData.roster.map((member) => member.id));
    expect(teamData.featuredMembers.every((member) => rosterIds.has(member.id))).toBe(true);
  });
});

describe('App', () => {
  it('renders the racing club name', () => {
    render(<App />);
    expect(screen.getByText('⁢⁣ˣʸ༩·星⁡⁠屿')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because `src/data/teamData.js` does not exist.

- [ ] **Step 3: Create the team configuration**

Create `src/data/teamData.js`:

```js
const roster = Array.from({ length: 30 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `member-${number}`,
    name: `成员 ${number}`,
    number,
    role: index === 0 ? '队长' : index < 8 ? '核心成员' : '车队成员',
    points: Math.max(8, 98 - index * 3),
    wins: Math.max(0, 6 - Math.floor(index / 5)),
    avatar: '',
    videoUrl: '',
  };
});

export const teamData = {
  team: {
    name: '⁢⁣ˣʸ༩·星⁡⁠屿',
    label: 'RACING CLUB / 2026 SEASON',
    motto: '以星为序，向屿而行',
    heroImage: '',
  },
  stats: [
    { label: '当前排名', value: '#01' },
    { label: '赛季积分', value: '128' },
    { label: '成员数量', value: '30' },
    { label: '高光视频', value: '8' },
  ],
  featuredMembers: roster.slice(0, 8),
  roster,
  leaderboard: roster
    .map((member) => ({
      id: member.id,
      rank: Number(member.number),
      name: member.name,
      points: member.points,
      wins: member.wins,
    }))
    .sort((a, b) => b.points - a.points),
  news: [
    {
      id: 'news-01',
      title: '赛季积分榜更新',
      category: '公告',
      date: '2026-07-25',
      summary: '新赛季内部积分榜已整理完成，核心成员和完整阵容数据进入第一版展示。',
    },
    {
      id: 'news-02',
      title: '核心成员高光位预留',
      category: '动态',
      date: '2026-07-25',
      summary: '8 位核心成员高光视频入口已预留，后续替换真实视频地址即可展示。',
    },
    {
      id: 'news-03',
      title: '车队全家福素材征集中',
      category: '战报',
      date: '2026-07-25',
      summary: '首屏暂用高级深色视觉，真实全家福确认后直接替换配置。',
    },
  ],
};
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit data layer**

Run:

```powershell
git add src/App.test.jsx src/data/teamData.js
git commit -m "feat: add team configuration data"
```

## Task 3: Page Components And Modal Interaction

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/Hero.jsx`
- Create: `src/components/StatsBar.jsx`
- Create: `src/components/FeaturedMembers.jsx`
- Create: `src/components/Roster.jsx`
- Create: `src/components/Leaderboard.jsx`
- Create: `src/components/NewsFeed.jsx`
- Create: `src/components/VideoModal.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add rendering and interaction tests**

Replace `src/App.test.jsx` with:

```jsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { teamData } from './data/teamData.js';

describe('teamData', () => {
  it('defines 8 featured members and 30 roster members', () => {
    expect(teamData.featuredMembers).toHaveLength(8);
    expect(teamData.roster).toHaveLength(30);
  });

  it('keeps featured members inside the full roster', () => {
    const rosterIds = new Set(teamData.roster.map((member) => member.id));
    expect(teamData.featuredMembers.every((member) => rosterIds.has(member.id))).toBe(true);
  });
});

describe('App', () => {
  it('renders all main sections from configuration', () => {
    render(<App />);

    expect(screen.getByText('⁢⁣ˣʸ༩·星⁡⁠屿')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '核心阵容' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '完整阵容' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '积分榜' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '资讯动态' })).toBeInTheDocument();
  });

  it('renders 8 featured member buttons and 30 roster cards', () => {
    render(<App />);

    expect(screen.getAllByRole('button', { name: /查看成员 \d+ 高光视频/ })).toHaveLength(8);
    const roster = screen.getByTestId('roster-grid');
    expect(within(roster).getAllByTestId('roster-card')).toHaveLength(30);
  });

  it('opens and closes the member video dialog', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '查看成员 01 高光视频' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: '成员 01' })).toBeInTheDocument();
    expect(screen.getByText('高光视频素材待替换')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '关闭视频弹窗' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test
```

Expected: FAIL because `@testing-library/user-event`, components, and section headings are not implemented.

- [ ] **Step 3: Install the interaction test dependency**

Run:

```powershell
npm install --save-dev @testing-library/user-event
```

Expected: `package.json` and `package-lock.json` include `@testing-library/user-event`.

- [ ] **Step 4: Implement page composition**

Replace `src/App.jsx` with:

```jsx
import { useState } from 'react';
import { teamData } from './data/teamData.js';
import { Hero } from './components/Hero.jsx';
import { StatsBar } from './components/StatsBar.jsx';
import { FeaturedMembers } from './components/FeaturedMembers.jsx';
import { Roster } from './components/Roster.jsx';
import { Leaderboard } from './components/Leaderboard.jsx';
import { NewsFeed } from './components/NewsFeed.jsx';
import { VideoModal } from './components/VideoModal.jsx';

export default function App() {
  const [selectedMember, setSelectedMember] = useState(null);

  return (
    <main className="site-shell">
      <Hero team={teamData.team} />
      <StatsBar stats={teamData.stats} />
      <FeaturedMembers members={teamData.featuredMembers} onSelect={setSelectedMember} />
      <Roster members={teamData.roster} />
      <Leaderboard rows={teamData.leaderboard} />
      <NewsFeed items={teamData.news} />
      <VideoModal member={selectedMember} onClose={() => setSelectedMember(null)} />
    </main>
  );
}
```

- [ ] **Step 5: Add the hero component**

Create `src/components/Hero.jsx`:

```jsx
export function Hero({ team }) {
  return (
    <section className="hero-section" aria-labelledby="team-title">
      <div className="hero-media" aria-hidden="true" />
      <div className="hero-content">
        <p className="eyebrow">{team.label}</p>
        <h1 id="team-title">{team.name}</h1>
        <p>{team.motto}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Add the stats component**

Create `src/components/StatsBar.jsx`:

```jsx
export function StatsBar({ stats }) {
  return (
    <section className="stats-bar" aria-label="赛季核心数据">
      {stats.map((item) => (
        <div className="stat-card" key={item.label}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 7: Add the featured members component**

Create `src/components/FeaturedMembers.jsx`:

```jsx
import { Play } from 'lucide-react';

export function FeaturedMembers({ members, onSelect }) {
  return (
    <section className="section-block" aria-labelledby="featured-title">
      <div className="section-heading">
        <p className="eyebrow">FEATURED DRIVERS</p>
        <h2 id="featured-title">核心阵容</h2>
      </div>
      <div className="featured-grid">
        {members.map((member) => (
          <button
            className="member-card"
            key={member.id}
            type="button"
            onClick={() => onSelect(member)}
            aria-label={`查看${member.name} 高光视频`}
          >
            <span className="member-portrait" aria-hidden="true">{member.number}</span>
            <span className="member-meta">
              <span>{member.role}</span>
              <strong>{member.name}</strong>
            </span>
            <Play className="play-icon" aria-hidden="true" size={18} />
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Add the roster component**

Create `src/components/Roster.jsx`:

```jsx
export function Roster({ members }) {
  return (
    <section className="section-block" aria-labelledby="roster-title">
      <div className="section-heading">
        <p className="eyebrow">FULL ROSTER</p>
        <h2 id="roster-title">完整阵容</h2>
      </div>
      <div className="roster-grid" data-testid="roster-grid">
        {members.map((member) => (
          <article className="roster-card" data-testid="roster-card" key={member.id}>
            <span>{member.number}</span>
            <strong>{member.name}</strong>
            <small>{member.role}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 9: Add the leaderboard component**

Create `src/components/Leaderboard.jsx`:

```jsx
export function Leaderboard({ rows }) {
  return (
    <section className="section-block" aria-labelledby="leaderboard-title">
      <div className="section-heading">
        <p className="eyebrow">SEASON POINTS</p>
        <h2 id="leaderboard-title">积分榜</h2>
      </div>
      <div className="leaderboard">
        {rows.slice(0, 12).map((row, index) => (
          <article className="leader-row" key={row.id}>
            <span className="rank">#{index + 1}</span>
            <strong>{row.name}</strong>
            <span>{row.points} 分</span>
            <span>{row.wins} 胜</span>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 10: Add the news component**

Create `src/components/NewsFeed.jsx`:

```jsx
export function NewsFeed({ items }) {
  return (
    <section className="section-block news-section" aria-labelledby="news-title">
      <div className="section-heading">
        <p className="eyebrow">TEAM UPDATES</p>
        <h2 id="news-title">资讯动态</h2>
      </div>
      <div className="news-list">
        {items.map((item) => (
          <article className="news-item" key={item.id}>
            <div>
              <span>{item.category}</span>
              <time dateTime={item.date}>{item.date}</time>
            </div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 11: Add the video modal**

Create `src/components/VideoModal.jsx`:

```jsx
import { X } from 'lucide-react';

export function VideoModal({ member, onClose }) {
  if (!member) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="video-modal" role="dialog" aria-modal="true" aria-labelledby="video-title">
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭视频弹窗">
          <X aria-hidden="true" size={20} />
        </button>
        <p className="eyebrow">HIGHLIGHT VIDEO</p>
        <h2 id="video-title">{member.name}</h2>
        {member.videoUrl ? (
          <video src={member.videoUrl} controls playsInline />
        ) : (
          <div className="video-fallback">高光视频素材待替换</div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 12: Run tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 13: Commit components**

Run:

```powershell
git add package.json package-lock.json src docs/superpowers/plans/2026-07-25-xingyu-racing-club-implementation.md
git commit -m "feat: render racing club sections"
```

## Task 4: Mobile-First Premium Club Styling

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/App.test.jsx`

- [ ] **Step 1: Add a regression test for mobile shell semantics**

Append this test inside the `describe('App', ...)` block in `src/App.test.jsx`:

```jsx
  it('uses the mobile-first site shell', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.site-shell')).toBeInTheDocument();
    expect(container.querySelector('.hero-section')).toBeInTheDocument();
    expect(container.querySelector('.stats-bar')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test**

Run:

```powershell
npm test
```

Expected: PASS. This test guards the CSS hooks used by the visual layer.

- [ ] **Step 3: Replace global styles**

Replace `src/styles/global.css` with:

```css
:root {
  color: #f4f0e8;
  background: #090909;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

html {
  background: #090909;
}

body {
  margin: 0;
  min-width: 320px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 240px),
    #090909;
}

button {
  font: inherit;
}

.site-shell {
  width: min(100%, 520px);
  margin: 0 auto;
  padding: 0 14px 32px;
}

.hero-section {
  position: relative;
  min-height: 78vh;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  margin: 0 -14px;
  padding: 24px 18px 28px;
  border-bottom: 1px solid rgba(185, 163, 107, 0.35);
}

.hero-media {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.1), rgba(9, 9, 9, 0.9)),
    linear-gradient(135deg, #242424, #111 45%, #3a3425);
}

.hero-media::after {
  content: "";
  position: absolute;
  inset: 16px;
  border: 1px solid rgba(244, 240, 232, 0.18);
}

.hero-content {
  position: relative;
  z-index: 1;
}

.eyebrow {
  margin: 0 0 8px;
  color: #b9a36b;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 10px;
  font-size: clamp(2.35rem, 16vw, 4.6rem);
  line-height: 0.95;
  letter-spacing: 0;
}

h2 {
  margin-bottom: 0;
  font-size: 1.45rem;
  letter-spacing: 0;
}

.hero-content p:last-child {
  max-width: 18rem;
  margin-bottom: 0;
  color: #c8c0b2;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0 28px;
}

.stat-card,
.roster-card,
.leader-row,
.news-item {
  border: 1px solid rgba(244, 240, 232, 0.12);
  background: rgba(255, 255, 255, 0.035);
}

.stat-card {
  min-height: 78px;
  padding: 12px;
}

.stat-card strong {
  display: block;
  font-size: 1.35rem;
}

.stat-card span,
.roster-card small,
.leader-row span,
.news-item p,
.news-item time {
  color: #aaa296;
}

.section-block {
  margin-top: 34px;
}

.section-heading {
  margin-bottom: 14px;
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.member-card {
  position: relative;
  min-height: 172px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
  color: #f4f0e8;
  text-align: left;
  border: 1px solid rgba(185, 163, 107, 0.25);
  background: linear-gradient(160deg, #1d1d1d, #111);
}

.member-portrait {
  display: grid;
  width: 100%;
  min-height: 88px;
  place-items: center;
  color: rgba(244, 240, 232, 0.45);
  font-size: 2.5rem;
  border: 1px solid rgba(244, 240, 232, 0.1);
  background: #151515;
}

.member-meta {
  display: grid;
  gap: 4px;
}

.member-meta span {
  color: #b9a36b;
  font-size: 0.75rem;
}

.play-icon {
  position: absolute;
  right: 12px;
  bottom: 12px;
  color: #b9a36b;
}

.roster-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.roster-card {
  min-height: 84px;
  display: grid;
  gap: 3px;
  padding: 9px;
}

.roster-card span {
  color: #b9a36b;
  font-size: 0.74rem;
}

.leaderboard,
.news-list {
  display: grid;
  gap: 8px;
}

.leader-row {
  display: grid;
  grid-template-columns: 46px 1fr auto auto;
  gap: 8px;
  align-items: center;
  min-height: 48px;
  padding: 10px;
  font-size: 0.92rem;
}

.rank {
  color: #b9a36b;
  font-weight: 700;
}

.news-item {
  padding: 14px;
}

.news-item div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.news-item span {
  color: #b9a36b;
  font-size: 0.78rem;
}

.news-item h3 {
  margin-bottom: 8px;
  font-size: 1rem;
}

.news-item p {
  margin-bottom: 0;
  line-height: 1.6;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(0, 0, 0, 0.72);
}

.video-modal {
  position: relative;
  width: min(100%, 460px);
  padding: 20px;
  border: 1px solid rgba(185, 163, 107, 0.35);
  background: #111;
}

.icon-button {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: #f4f0e8;
  border: 1px solid rgba(244, 240, 232, 0.18);
  background: transparent;
}

.video-modal video,
.video-fallback {
  width: 100%;
  aspect-ratio: 16 / 9;
  margin-top: 14px;
}

.video-fallback {
  display: grid;
  place-items: center;
  color: #aaa296;
  border: 1px solid rgba(244, 240, 232, 0.12);
  background: #181818;
}

@media (min-width: 700px) {
  .site-shell {
    width: min(100%, 960px);
    padding-inline: 24px;
  }

  .hero-section {
    margin-inline: -24px;
    padding-inline: 32px;
  }

  .stats-bar {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .featured-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .roster-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
```

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm test
npm run build
```

Expected: tests PASS and build completes with a `dist` directory.

- [ ] **Step 5: Commit styles**

Run:

```powershell
git add src/App.test.jsx src/styles/global.css
git commit -m "feat: style mobile racing club site"
```

## Task 5: Browser Verification

**Files:**
- No source changes expected unless verification finds a defect.

- [ ] **Step 1: Start the dev server**

Run:

```powershell
npm run dev
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 2: Verify with a mobile viewport**

Use Playwright or the in-app browser against the local URL at 390 x 844.

Checks:

- The title `⁢⁣ˣʸ༩·星⁡⁠屿` is visible in the first screen.
- There is no horizontal overflow.
- The stats grid has two columns on mobile.
- The featured member cards show 8 members.
- Tapping `成员 01` opens the video dialog.
- The close button removes the video dialog.
- The roster grid shows 30 cards.
- The leaderboard and news sections are readable without sideways scrolling.

- [ ] **Step 3: Verify with a desktop viewport**

Use a 1280 x 900 viewport.

Checks:

- The page remains centered.
- The stats grid has four columns.
- Featured members use four columns.
- Roster uses six columns.
- Text does not overlap inside member cards or leaderboard rows.

- [ ] **Step 4: Run final commands**

Run:

```powershell
npm test
npm run build
git status --short --branch
```

Expected:

- Tests PASS.
- Build succeeds.
- Git status only shows intentional source changes if fixes were needed.

- [ ] **Step 5: Commit verification fixes if any**

If verification required source changes, run:

```powershell
git add src
git commit -m "fix: polish racing club mobile layout"
```

If no changes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: The plan covers the mobile-first internal honor site, complete team name, premium club styling, config-file content, 8 featured members, 30-person roster, leaderboard, news feed, and member video modal.
- Scope check: The plan excludes login, backend, database, CMS, payment, comments, and automatic score scraping as required by the spec.
- Test coverage: The plan adds data count tests, section rendering tests, modal interaction tests, CSS hook tests, build verification, and browser viewport checks.
