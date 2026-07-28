# 星屿车队本地配置后台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a password-protected local/LAN admin page that edits all current Xingyu H5 content, imports and exports date-based score workbooks, uploads media, and makes saved changes available to the frontend on refresh.

**Architecture:** An Express service owns runtime JSON configuration, local uploads, authenticated admin APIs, and production static-file delivery. The React H5 derives current points from each member's opening balance plus date-based six-race score rows. The `/admin` React route uses structured forms; a browser-only Excel module creates the template/export and validates imports before they update the unsaved draft.

**Tech Stack:** React 19, Vite 6, Vitest, ExcelJS, Express, Multer, Supertest, Node.js `fs/promises`, HttpOnly cookie sessions.

---

## File Structure

- Create: `src/data/siteConfig.js` - seed creation, normalisation and derived frontend data.
- Create: `src/data/siteConfig.test.js` - configuration derivation unit tests.
- Create: `src/hooks/useSiteConfig.js` - public API fetch with initial-data fallback.
- Create: `src/admin/adminApi.js` - authenticated admin API client.
- Create: `src/admin/AdminApp.jsx` - login state and admin shell.
- Create: `src/admin/ConfigEditor.jsx` - structured configuration editor and save flow.
- Create: `src/admin/ScoreEditor.jsx` - Excel-style daily score grid and import preview.
- Create: `src/admin/ScoreEditor.test.jsx` - direct editing and import confirmation tests.
- Create: `src/admin/scoreWorkbook.js` - workbook generation, parsing, validation and date replacement.
- Create: `src/admin/scoreWorkbook.test.js` - workbook round-trip and invalid-file tests.
- Create: `src/admin/UploadField.jsx` - reusable upload input and preview.
- Create: `src/admin/UploadLibrary.jsx` - uploaded-file list and deletion actions.
- Create: `src/admin/admin.css` - compact responsive administrator UI.
- Create: `src/admin/AdminApp.test.jsx` - login, save and upload interaction tests.
- Create: `server/index.js` - Express application factory and production server entry.
- Create: `server/lib/auth.js` - local credential and in-memory session helpers.
- Create: `server/lib/configStore.js` - initialise, validate, normalise, read and atomically save JSON.
- Create: `server/lib/configStore.test.js` - runtime JSON and backup tests.
- Create: `server/index.test.js` - API authorization, upload and deletion integration tests.
- Create: `server/config/admin.example.json` - non-secret credential file format.
- Create: `docs/config-admin-guide.md` - local setup, login, startup and backup guide.
- Modify: `.gitignore` - ignore real credentials, runtime JSON, backup and uploads.
- Modify: `package.json` - add runtime and test dependencies plus service scripts.
- Modify: `vite.config.js` - proxy API and `/uploads` requests to local service in development.
- Modify: `src/App.jsx` - consume loaded site data and configured music paths.
- Modify: `src/App.test.jsx` - test configuration loading and fallback while retaining existing interaction coverage.
- Modify: `src/main.jsx` - render `AdminApp` for `/admin`, otherwise render H5.
- Modify: `AGENTS.md` - record implementation state, commands and verification result.

### Task 1: Create the Single Runtime Configuration Model

**Files:**
- Create: `src/data/siteConfig.js`
- Create: `src/data/siteConfig.test.js`

- [ ] **Step 1: Write failing tests for seed and derived data.**

```jsx
import { describe, expect, it } from 'vitest';
import { createSeedConfig, hydrateSiteData } from './siteConfig.js';

describe('site configuration', () => {
  it('creates raw configuration without duplicate derived collections', () => {
    const config = createSeedConfig();

    expect(config).toEqual(expect.objectContaining({
      team: expect.any(Object),
      roster: expect.any(Array),
      albums: expect.any(Array),
      dailyScores: expect.any(Array),
      news: expect.any(Array),
      music: { src: '/audio/launch-now.mp3', cover: '/images/music-avatar.png' },
    }));
    expect(config).not.toHaveProperty('gallery');
    expect(config).not.toHaveProperty('leaderboard');
    expect(config).not.toHaveProperty('featuredMembers');
  });

  it('derives scores and current points from opening balances in date order', () => {
    const config = createSeedConfig();
    config.roster = config.roster.slice(0, 2).map((member, index) => ({
      ...member,
      basePoints: index === 0 ? 10 : 30,
    }));
    config.dailyScores = [
      { date: '2026-07-29', rows: [{ id: config.roster[0].id, teamRace: [1, 1, 1], openRace: [0, 0, 0] }] },
      { date: '2026-07-28', rows: [{ id: config.roster[0].id, teamRace: [2, 2, 2], openRace: [1, 1, 1] }] },
    ];
    const data = hydrateSiteData(config);

    expect(data.dailyScores.map((round) => round.date)).toEqual(['2026-07-28', '2026-07-29']);
    expect(data.dailyScores[0].rows[0]).toMatchObject({
      id: config.roster[0].id,
      name: config.roster[0].name,
      score: 9,
      total: 19,
    });
    expect(data.dailyScores[1].rows[0].total).toBe(22);
    expect(data.leaderboard[0]).toMatchObject({ id: config.roster[1].id, points: 30, rank: 1 });
    expect(data.roster.find((member) => member.id === config.roster[0].id).points).toBe(22);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails.**

Run: `npm test -- src/data/siteConfig.test.js`

Expected: FAIL because `siteConfig.js` does not exist.

- [ ] **Step 3: Implement raw seed creation and frontend hydration.**

Create `src/data/siteConfig.js` with these exported functions and invariants:

```js
import { teamData } from './teamData.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);
const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const formatWeekday = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return weekdayLabels[new Date(year, month - 1, day).getDay()];
};

export function createSeedConfig() {
  const { team, stats, roster, albums, dailyScores, news } = clone(teamData);
  const sortedScores = [...dailyScores].sort((left, right) => left.date.localeCompare(right.date));
  const rawRoster = roster.map(({ points, ...member }) => {
    const firstRow = sortedScores.flatMap((round) => round.rows).find((row) => row.id === member.id);
    return {
      ...member,
      basePoints: Math.max(0, Number(firstRow?.total ?? points) - Number(firstRow?.score ?? 0)),
    };
  });
  return {
    team,
    stats,
    roster: rawRoster,
    albums,
    dailyScores: dailyScores.map((round) => ({
      date: round.date,
      rows: round.rows.map(({ id, teamRace, openRace }) => ({ id, teamRace, openRace })),
    })),
    news,
    music: {
      src: '/audio/launch-now.mp3',
      cover: '/images/music-avatar.png',
    },
  };
}

export function hydrateSiteData(rawConfig) {
  const config = clone(rawConfig);
  const membersById = new Map(config.roster.map((member) => [member.id, member]));
  const totals = new Map(config.roster.map((member) => [member.id, Number(member.basePoints || 0)]));
  const dailyScores = [...config.dailyScores]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((round) => ({
      date: round.date,
      weekday: formatWeekday(round.date),
      rows: round.rows.map((row) => {
        const score = sum([...row.teamRace, ...row.openRace]);
        const total = (totals.get(row.id) || 0) + score;
        totals.set(row.id, total);
        return { ...row, name: membersById.get(row.id)?.name || '', score, total };
      }),
    }));
  const roster = config.roster.map((member) => ({ ...member, points: totals.get(member.id) || 0 }));
  const leaderboard = [...roster]
    .sort((left, right) => right.points - left.points || right.wins - left.wins || left.number.localeCompare(right.number))
    .map((member, index) => ({
      id: member.id,
      rank: index + 1,
      name: member.name,
      points: member.points,
      wins: member.wins,
    }));

  return {
    ...config,
    roster,
    featuredMembers: roster.slice(0, 8),
    gallery: config.albums.flatMap((album) => album.photos),
    leaderboard,
    dailyScores,
  };
}
```

Add a timezone-safe `formatWeekday(dateKey)` that parses `YYYY-MM-DD` components and returns `周日` through `周六`. Keep `teamData.js` unchanged. The seed function migrates the current display total to `basePoints` by subtracting the first stored day's score, and strips `weekday`, `name`, `score`, and `total` from raw daily rows.

- [ ] **Step 4: Run the focused test and complete the project test suite.**

Run: `npm test -- src/data/siteConfig.test.js`

Expected: PASS with 2 tests.

Run: `npm test`

Expected: PASS; existing H5 tests remain green because `teamData` is not yet removed.

- [ ] **Step 5: Commit the data-model change.**

```powershell
git add src/data/siteConfig.js src/data/siteConfig.test.js
git commit -m "feat: add runtime site configuration model"
```

### Task 2: Add JSON Storage, Validation and Atomic Backup

**Files:**
- Create: `server/lib/configStore.js`
- Create: `server/lib/configStore.test.js`
- Reuse: `src/data/siteConfig.js`

- [ ] **Step 1: Write failing storage tests in the Node environment.**

Put `// @vitest-environment node` at the first line of `server/lib/configStore.test.js`. Create a temporary directory with `mkdtemp`, then test:

```js
it('seeds a missing JSON file and writes a backup before replacing it', async () => {
  const store = await createConfigStore({ dataDir: tempDir });
  const initial = await store.read();
  const next = { ...initial, team: { ...initial.team, motto: '新口号' } };

  await store.write(next);

  await expect(readFile(join(tempDir, 'site-config.json'), 'utf8')).resolves.toContain('新口号');
  await expect(readFile(join(tempDir, 'site-config.json.bak'), 'utf8')).resolves.toContain(initial.team.motto);
});

it('rejects invalid roster and score references without overwriting JSON', async () => {
  const store = await createConfigStore({ dataDir: tempDir });
  const original = await store.read();
  const invalid = { ...original, roster: [{ ...original.roster[0], id: '' }] };

  await expect(store.write(invalid)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  await expect(store.read()).resolves.toEqual(original);
});
```

- [ ] **Step 2: Run the storage test to verify it fails.**

Run: `npm test -- server/lib/configStore.test.js`

Expected: FAIL because `configStore.js` does not exist.

- [ ] **Step 3: Implement the store and validation boundary.**

`createConfigStore({ dataDir })` must create `dataDir`, then expose `read()` and `write(config)`. Use:

```js
const configPath = join(dataDir, 'site-config.json');
const backupPath = join(dataDir, 'site-config.json.bak');
const temporaryPath = join(dataDir, 'site-config.json.next');
```

Implement validation with an `errors` array and throw an `Error` carrying `error.code = 'INVALID_CONFIG'` and `error.details = errors` when non-empty. Validate all of the following before writing:

- `team.name`, `team.label`, `team.motto`, `team.heroImage` are non-empty strings.
- `stats` has exactly four items; the `单身贵族` value is an object with non-negative numeric `male` and `female`, all other values are non-empty strings or finite numbers.
- every `roster` entry has a unique non-empty `id`, unique non-empty `number`, non-empty `name` and `role`, plus non-negative finite `basePoints` and `wins`; raw `points` is rejected so current points have one source.
- every album has non-empty `id`, `name`, `date`, `coverSrc`; every photo has non-empty `id`, `src`, `title`, `date`, `alt`, and media type is absent, `image`, or `video`.
- every news item has non-empty `id`, `title`, `category`, `date`, `imageSrc`, `imageAlt`, `summary`, and `body`.
- every daily record has a unique strict `YYYY-MM-DD` date; every row references an existing roster ID once per date and has exactly three non-negative finite values in each of `teamRace` and `openRace`.
- `music.src` and `music.cover` are non-empty strings.

Before the first read, seed missing JSON with `createSeedConfig()`. When writing, copy existing JSON to the backup path if it exists, write formatted JSON to `temporaryPath`, then rename the temporary file to `configPath`. Never keep client-provided `gallery`, `leaderboard`, or `featuredMembers` in the stored configuration.

- [ ] **Step 4: Run focused tests and inspect the resulting files.**

Run: `npm test -- server/lib/configStore.test.js`

Expected: PASS, including seed, backup and rejection tests.

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit the storage boundary.**

```powershell
git add server/lib/configStore.js server/lib/configStore.test.js
git commit -m "feat: add validated local config storage"
```

### Task 3: Build Authenticated Express APIs and Media Storage

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `server/config/admin.example.json`
- Create: `server/lib/auth.js`
- Create: `server/index.js`
- Create: `server/index.test.js`

- [ ] **Step 1: Install minimal dependencies and define executable scripts.**

Install the production dependencies `express`, `multer`, and `exceljs`, plus the development dependency `supertest`:

```powershell
npm install express multer exceljs
npm install --save-dev supertest
```

Add these `package.json` scripts without replacing existing Vite commands:

```json
"dev:api": "node server/index.js --dev",
"start": "node server/index.js",
"serve": "npm run build && npm run start"
```

Add these exact ignored paths:

```gitignore
server/config/admin.local.json
server/data/site-config.json
server/data/site-config.json.bak
server/storage/uploads/
```

Create `server/config/admin.example.json`:

```json
{
  "username": "admin",
  "password": "change-this-password"
}
```

- [ ] **Step 2: Write failing API integration tests.**

Use `supertest` against `createApp({ rootDir: tempRoot, distDir: tempDist })`, where the app factory exposes `app` and its isolated directories. Cover these cases:

```js
it('returns public config but blocks admin configuration without a session', async () => {
  await request(app).get('/api/config').expect(200).expect('Content-Type', /json/);
  await request(app).get('/api/admin/config').expect(401);
});

it('sets a session after valid login and permits a saved configuration', async () => {
  const agent = request.agent(app);
  await agent.post('/api/login').send({ username: 'admin', password: 'test-password' }).expect(204);
  const response = await agent.get('/api/admin/config').expect(200);
  await agent.put('/api/admin/config').send({ ...response.body, team: { ...response.body.team, motto: '已保存' } }).expect(204);
  await request(app).get('/api/config').expect(200).expect((result) => {
    expect(result.body.team.motto).toBe('已保存');
  });
});

it('uploads an allowed image, rejects a text file, and deletes only stored files', async () => {
  const agent = await loginAsAdmin(app);
  const upload = await agent.post('/api/admin/upload')
    .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'avatar.png', contentType: 'image/png' })
    .expect(201);
  expect(upload.body.path).toMatch(/^\/uploads\//);
  await agent.post('/api/admin/upload')
    .attach('file', Buffer.from('not media'), { filename: 'bad.txt', contentType: 'text/plain' })
    .expect(400);
  await agent.delete(`/api/admin/uploads/${encodeURIComponent(upload.body.name)}`).expect(204);
});
```

- [ ] **Step 3: Implement credentials, sessions, upload filtering and routes.**

`server/lib/auth.js` must export `createAuth({ credentialsPath })`. It reads `{ username, password }` from `admin.local.json`; on a missing file it throws an actionable startup error naming `admin.example.json`. It stores session tokens in a `Map`, compares username and password with `timingSafeEqual` only after matching buffer lengths, and exposes `login`, `logout`, and `requireSession` middleware.

In `server/index.js`, export `createApp(options)` for tests and start listening only when the file is executed directly. Use port `3000` by default and `process.env.PORT` when set. Set cookie options to:

```js
{ httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 8 * 60 * 60 }
```

Configure Multer disk storage to write to `server/storage/uploads`, generate each filename with `randomUUID() + extname(file.originalname).toLowerCase()`, and accept only `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `audio/mpeg`, `audio/mp4`, `audio/ogg`, and `audio/wav`. Set Multer's hard limit to 200 MB. After an upload, reject images larger than 10 MB, delete that just-written file, and return 400; video and audio files up to 200 MB succeed.

Implement routes exactly as specified in the design. `GET /api/config` returns `hydrateSiteData(await store.read())`. Admin `GET` returns raw JSON. `PUT` writes raw JSON. `GET /api/admin/uploads` returns only files directly under the upload directory with `name`, `path`, `size`, and `type`. `DELETE` resolves the requested basename, rejects path changes, and only unlinks an existing file inside the upload directory.

Serve `/uploads` from the upload directory. In production, serve `dist`, and for non-API paths with no matching file return `dist/index.html` so `/admin` reloads correctly. In `--dev` mode, omit the static `dist` fallback because Vite owns port 5173.

- [ ] **Step 4: Run API tests and manual smoke checks.**

Run: `npm test -- server/index.test.js`

Expected: PASS for unauthorized requests, login, save, upload rejection, listing and deletion.

Run: `Copy-Item server/config/admin.example.json server/config/admin.local.json`

Replace `change-this-password` in the local copy with a non-default password, then run: `npm run dev:api`

Expected: service logs `http://127.0.0.1:3000` and creates `server/data/site-config.json` on the first `GET /api/config` request.

- [ ] **Step 5: Commit the server API.**

```powershell
git add package.json package-lock.json .gitignore server
git commit -m "feat: add local config admin API"
```

### Task 4: Make the H5 Read Live Configuration

**Files:**
- Create: `src/hooks/useSiteConfig.js`
- Modify: `src/App.jsx`
- Modify: `src/App.test.jsx`
- Modify: `vite.config.js`

- [ ] **Step 1: Write failing hook and application-loading tests.**

Add a test that mocks `fetch` with a changed config and verifies the public page uses that config. Add one that rejects `fetch` and verifies the current `teamData` fallback still renders:

```jsx
it('renders the server configuration after it loads', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      ...teamData,
      stats: teamData.stats.map((item, index) => index === 0 ? { ...item, label: '实时排名' } : item),
      music: { src: '/uploads/song.mp3', cover: '/uploads/cover.png' },
    }),
  }));
  render(<App />);
  expect(await screen.findByText('实时排名')).toBeInTheDocument();
});

it('uses initial data when the configuration endpoint fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  render(<App />);
  expect(await screen.findByRole('heading', { name: '欢迎来到星屿车队' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npm test -- src/App.test.jsx`

Expected: FAIL because `App` still reads imported `teamData` directly.

- [ ] **Step 3: Implement public configuration loading without a blank screen.**

Create `useSiteConfig` with the following behavior:

```js
export function useSiteConfig(fallback) {
  const [config, setConfig] = useState(fallback);

  useEffect(() => {
    let active = true;
    fetch('/api/config')
      .then((response) => {
        if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
        return response.json();
      })
      .then((nextConfig) => active && setConfig(nextConfig))
      .catch(() => active && setConfig(fallback));
    return () => { active = false; };
  }, [fallback]);

  return config;
}
```

In `App.jsx`, import `hydrateSiteData` and `createSeedConfig`, derive fallback once outside the component, then use the hook result for every existing child component. Replace both hard-coded `MusicPlayer` props with `siteData.music.src` and `siteData.music.cover`. Preserve all album hash navigation and modal behavior.

Add Vite proxy configuration:

```js
server: {
  proxy: {
    '/api': 'http://127.0.0.1:3000',
    '/uploads': 'http://127.0.0.1:3000',
  },
},
```

- [ ] **Step 4: Run frontend tests and build.**

Run: `npm test -- src/App.test.jsx`

Expected: PASS, including all existing interactions and the two live-config cases.

Run: `npm run build`

Expected: Vite build succeeds.

- [ ] **Step 5: Commit live H5 loading.**

```powershell
git add src/App.jsx src/App.test.jsx src/hooks/useSiteConfig.js vite.config.js
git commit -m "feat: load h5 content from config API"
```

### Task 5: Build the Date-Based Excel Score Boundary

**Files:**
- Create: `src/admin/scoreWorkbook.js`
- Create: `src/admin/scoreWorkbook.test.js`

- [ ] **Step 1: Write failing workbook round-trip and validation tests.**

Create a two-member raw configuration with `basePoints` and two dates. Test the public API directly with ArrayBuffers:

```js
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createScoreWorkbookBuffer, mergeScoreImport, parseScoreWorkbookBuffer } from './scoreWorkbook.js';

const replacementRow = { id: 'member-01', teamRace: [6, 0, 0], openRace: [0, 0, 0] };
const config = {
  roster: [
    { id: 'member-01', number: '01', name: '成员 01', basePoints: 10 },
    { id: 'member-02', number: '02', name: '成员 02', basePoints: 20 },
  ],
  dailyScores: [
    { date: '2026-07-28', rows: [{ id: 'member-01', teamRace: [1, 2, 3], openRace: [0, 0, 0] }] },
    { date: '2026-07-29', rows: [{ id: 'member-02', teamRace: [2, 2, 2], openRace: [1, 1, 1] }] },
  ],
};

const duplicateWorkbook = async () => {
  const buffer = await createScoreWorkbookBuffer(config, { template: false });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('积分明细');
  sheet.insertRow(5, sheet.getRow(4).values);
  return workbook.xlsx.writeBuffer();
};

it('exports and imports daily scores and opening balances without derived fields', async () => {
  const buffer = await createScoreWorkbookBuffer(config, { template: false });
  const imported = await parseScoreWorkbookBuffer(buffer, config.roster);

  expect(imported.dailyScores).toEqual(config.dailyScores);
  expect(imported.basePointsById).toEqual(new Map([
    [config.roster[0].id, config.roster[0].basePoints],
    [config.roster[1].id, config.roster[1].basePoints],
  ]));
});

it('replaces only dates present in the imported workbook', () => {
  const next = mergeScoreImport(config, {
    dailyScores: [{ date: '2026-07-29', rows: [replacementRow] }],
    basePointsById: new Map([[config.roster[0].id, 20]]),
  });

  expect(next.dailyScores.find((round) => round.date === '2026-07-28')).toEqual(config.dailyScores[0]);
  expect(next.dailyScores.find((round) => round.date === '2026-07-29').rows).toEqual([replacementRow]);
  expect(next.roster[0].basePoints).toBe(20);
});

it('reports the sheet, row and field for duplicate or unknown members', async () => {
  const buffer = await duplicateWorkbook();
  await expect(parseScoreWorkbookBuffer(buffer, config.roster)).rejects.toMatchObject({
    code: 'INVALID_SCORE_WORKBOOK',
    details: expect.arrayContaining([
      expect.objectContaining({ sheet: '积分明细', row: 5, field: '队员编号' }),
    ]),
  });
});
```

- [ ] **Step 2: Run the workbook test to verify it fails.**

Run: `npm test -- src/admin/scoreWorkbook.test.js`

Expected: FAIL because `scoreWorkbook.js` does not exist.

- [ ] **Step 3: Implement workbook generation, parsing and merge rules.**

Export these constants and functions from `scoreWorkbook.js`:

```js
export const SCORE_SHEET_NAME = '积分明细';
export const BASE_SHEET_NAME = '队员期初积分';
export const SCORE_HEADERS = ['日期', '队员编号', '队员昵称', '队内赛1', '队内赛2', '队内赛3', '开黑赛1', '开黑赛2', '开黑赛3', '当日得分', '累计总分'];
export const BASE_HEADERS = ['队员编号', '队员昵称', '期初积分'];

export async function createScoreWorkbookBuffer(config, { template = false } = {}) {}
export async function parseScoreWorkbookBuffer(buffer, roster) {}
export function mergeScoreImport(config, imported) {}
export async function downloadScoreWorkbook(config, { template = false } = {}) {}
```

Use ExcelJS. Both sheets use row 1 as a merged title, row 2 as a short instruction, row 3 as the exact header row, and data from row 4. Freeze the first three rows, enable filters on row 3, use a dark navy title/header with white text, pale blue editable cells, thin borders, `yyyy-mm-dd` date formatting, and practical fixed widths so text is not clipped.

For a template, write one blank-date score row per roster member with six zeroes. For an export, flatten all `dailyScores` in ascending date/member-number order. Column J formula is:

```text
=IF(OR(A4="",B4=""),"",SUM(D4:I4))
```

Column K adds the member's opening balance to all scores through the row's date:

```text
=IF(OR(A4="",B4=""),"",VLOOKUP(B4,'队员期初积分'!$A$4:$C$203,3,FALSE)+SUMIFS($J$4:$J$2003,$B$4:$B$2003,B4,$A$4:$A$2003,"<="&A4))
```

The parser ignores columns J and K. It accepts only the two fixed sheet names and exact row-3 headers. Convert Excel `Date`, serial date, or trimmed `YYYY-MM-DD` cell values to a strict date key. Empty race cells become zero; non-finite or negative values are errors. Resolve members by `roster.number`, use `date + member.id` as the detail unique key, and collect every error as `{ sheet, row, field, message }`. Throw one error with `code = 'INVALID_SCORE_WORKBOOK'` and `details` when any error exists.

`mergeScoreImport` deep-clones the config, replaces complete dates that appear in `imported.dailyScores`, preserves all other dates, updates only members present in `basePointsById`, and returns dates sorted ascending. `downloadScoreWorkbook` creates an object URL from the buffer, clicks a temporary `<a download>`, then revokes the URL.

- [ ] **Step 4: Run workbook tests and verify a rendered sample manually.**

Run: `npm test -- src/admin/scoreWorkbook.test.js`

Expected: PASS for round-trip, date replacement, duplicate rows, unknown members, invalid dates and negative scores.

Generate one workbook from `createSeedConfig()`, open it in Excel, and confirm both sheets, formulas, date formatting, frozen rows, filters and editable-cell styling are visible.

- [ ] **Step 5: Commit the workbook boundary.**

```powershell
git add src/admin/scoreWorkbook.js src/admin/scoreWorkbook.test.js
git commit -m "feat: add daily score workbook import export"
```

### Task 6: Build the `/admin` Structured Form and Upload Library

**Files:**
- Create: `src/admin/adminApi.js`
- Create: `src/admin/AdminApp.jsx`
- Create: `src/admin/ConfigEditor.jsx`
- Create: `src/admin/ScoreEditor.jsx`
- Create: `src/admin/ScoreEditor.test.jsx`
- Create: `src/admin/UploadField.jsx`
- Create: `src/admin/UploadLibrary.jsx`
- Create: `src/admin/admin.css`
- Create: `src/admin/AdminApp.test.jsx`
- Modify: `src/main.jsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write failing admin interaction tests.**

Mock `fetch` in `src/admin/AdminApp.test.jsx` and cover the whole minimum workflow:

```jsx
it('logs in, edits the team motto, uploads a cover, and saves the full draft', async () => {
  const user = userEvent.setup();
  const config = createSeedConfig();
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 204 })
    .mockResolvedValueOnce({ ok: true, json: async () => config })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ name: 'cover.png', path: '/uploads/cover.png' }) })
    .mockResolvedValueOnce({ ok: true, status: 204 }));

  render(<AdminApp />);
  await user.type(screen.getByLabelText('账号'), 'admin');
  await user.type(screen.getByLabelText('密码'), 'test-password');
  await user.click(screen.getByRole('button', { name: '登录' }));
  const motto = await screen.findByLabelText('车队口号');
  await user.clear(motto);
  await user.type(motto, '新的口号');
  await user.upload(screen.getByLabelText('首屏图片上传'), new File(['image'], 'cover.png', { type: 'image/png' }));
  await user.click(screen.getByRole('button', { name: '保存全部配置' }));

  expect(fetch).toHaveBeenLastCalledWith('/api/admin/config', expect.objectContaining({ method: 'PUT' }));
});
```

Add a test that receives a 401 from the configuration request and returns to the login form, plus a test that an upload error is visible and does not replace the existing field value. In `ScoreEditor.test.jsx`, test direct numeric editing, template/export button calls, an invalid import error list, import preview counts, cancel, and confirmation calling `onChange` with the merged draft.

- [ ] **Step 2: Run the admin test to verify it fails.**

Run: `npm test -- src/admin/AdminApp.test.jsx src/admin/ScoreEditor.test.jsx`

Expected: FAIL because the admin and score editor components do not exist.

- [ ] **Step 3: Implement the API client and authentication shell.**

`adminApi.js` must export `login`, `logout`, `getConfig`, `saveConfig`, `uploadFile`, `listUploads`, and `deleteUpload`. Every request must set `credentials: 'include'`; JSON requests must set `Content-Type: application/json`; upload requests must use `FormData` without manually setting a content type. For a non-OK response, parse `{ error, details }` when available and throw an `Error` with the server message.

`AdminApp.jsx` must show a labelled account/password login form before authentication. After successful login, load config and render `ConfigEditor`. When an authenticated request returns 401, clear local admin state and show the login form with `登录状态已失效，请重新登录`.

- [ ] **Step 4: Implement the configuration editor in explicit sections.**

`ConfigEditor` owns a deep-cloned `draft` and never mutates React state in place. It renders these sections in this exact order:

1. `基础信息` - `team.name`, `team.label`, `team.motto`, `team.heroImage`, `music.src`, `music.cover`.
2. `统计数据` - four labels/values, with numeric `male` and `female` inputs for the `单身贵族` object.
3. `成员管理` - add, delete, move up/down and edit `id`, `number`, `name`, `role`, `basePoints`, `wins`, `avatar`, `videoUrl`. Label `basePoints` as `期初积分` and explain only in the field description that it is the accumulated score before the first maintained date.
4. `新闻管理` - add, delete, move up/down and edit all documented news fields.
5. `相册管理` - add/delete/move albums and nested photos; each photo edits `id`, `src`, `title`, `date`, `alt`, `featured`, `mediaType`, and `videoUrl`.
6. `星屿积分榜` - render `ScoreEditor` with the current `roster` and `dailyScores` and replace the draft only through its `onChange` callback.
7. `素材管理` - render `UploadLibrary` and refresh it after an upload or deletion.

Generate client-only IDs with `crypto.randomUUID()` when adding items. Do not let an editor delete the final four stats entries; render four fixed stat editors. Show a save bar with `保存全部配置`, disabled while saving. On success show `已保存，前台刷新后可见最新内容`; on server validation failure show every returned detail as a list.

`UploadField` must have a labelled file input such as `首屏图片上传`, call `uploadFile(file)`, set the field to returned `path` only after success, and show image preview, video element, or audio element based on the selected field type. It must retain the prior value on failure.

`UploadLibrary` must render each file's name, type, byte size and copyable `/uploads/...` path. Its delete action must prompt with `window.confirm`, call `deleteUpload(name)`, remove the item only after a 204 response, and never delete a configuration reference automatically.

`ScoreEditor` flattens `dailyScores` into an editable table with date, member select, six numeric race inputs, read-only calculated daily score and read-only calculated cumulative total. It supports add row, delete row, template download, current-data export and a hidden `.xlsx` file input labelled `导入积分 Excel`. Import errors render as a list. A valid import renders a preview with added rows, updated rows, affected dates and updated opening balances; `取消导入` leaves the draft unchanged and `确认导入` applies `mergeScoreImport` to the draft. Keep the wide score grid inside its own horizontal scroll region so the admin page itself never overflows.

- [ ] **Step 5: Route `/admin` and add compact responsive styles.**

In `src/main.jsx`, choose the root component without introducing a router dependency:

```jsx
const Root = window.location.pathname === '/admin' ? AdminApp : App;

createRoot(document.getElementById('root')).render(
  <StrictMode><Root /></StrictMode>,
);
```

Import `./admin/admin.css` once from `AdminApp.jsx`. Style the admin page as a dense desktop-first utility screen with a 960px max-width, 8px radius or less, responsive single-column controls below 720px, visible required labels, field errors, and sticky save actions. Use Lucide icons for add, delete, move, upload, copy and logout actions. Do not add decorative cards inside cards or a separate marketing landing page.

- [ ] **Step 6: Run all admin and existing frontend tests.**

Run: `npm test -- src/admin/AdminApp.test.jsx src/admin/ScoreEditor.test.jsx src/admin/scoreWorkbook.test.js src/App.test.jsx`

Expected: PASS for login, expired session, upload failure, save, and existing H5 interaction coverage.

Run: `npm test`

Expected: entire Vitest suite passes.

- [ ] **Step 7: Commit the administrator UI.**

```powershell
git add src/admin src/main.jsx
git commit -m "feat: add structured config admin"
```

### Task 7: Document Setup, Verify Production Serving and Record Handoff

**Files:**
- Create: `docs/config-admin-guide.md`
- Modify: `AGENTS.md`
- Verify: `package.json`, `server/index.js`, `vite.config.js`

- [ ] **Step 1: Write the local operator guide.**

Document these exact steps in `docs/config-admin-guide.md`:

```powershell
Copy-Item server/config/admin.example.json server/config/admin.local.json
# Edit server/config/admin.local.json and replace change-this-password.
npm install
npm run dev:api
npm run dev
```

State that the H5 opens at `http://127.0.0.1:5173/`, the admin opens at `http://127.0.0.1:5173/admin`, and production uses `npm run serve` at `http://127.0.0.1:3000/` with admin at `/admin`. Explain the locations of `server/data/site-config.json`, its `.bak` backup, and `server/storage/uploads/`. State clearly that credentials are plaintext local configuration and must not be exposed publicly.

Document the score workflow: maintain `期初积分` once per member, use `下载模板` for date-based entry, upload through `导入积分 Excel`, review the import preview, confirm it, then click `保存全部配置`. Explain that imported dates replace those complete dates, other dates remain, and the old horizontal weekly workbook is reference-only and cannot be imported directly.

- [ ] **Step 2: Run automated verification.**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: build completes with a `dist` directory.

- [ ] **Step 3: Run production smoke verification.**

Start: `npm start`

Verify with `Invoke-WebRequest` that these endpoints return 200:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/
Invoke-WebRequest http://127.0.0.1:3000/admin
Invoke-WebRequest http://127.0.0.1:3000/api/config
```

Log in through `/admin`, change one non-visual draft value, save it, reload `/`, confirm the changed value is rendered, then restore the original value. Upload one small test image, confirm its `/uploads/...` URL returns 200, delete it, and confirm its URL returns 404.

- [ ] **Step 4: Verify browser layouts.**

Use the local browser to capture `/` at widths 390 and 1280, then `/admin` at widths 390 and 1280. Confirm no horizontal page overflow, the H5 still has its existing carousel and modal controls, and the admin's labels, inputs, section actions and save button remain accessible.

- [ ] **Step 5: Update the project handoff and commit.**

Update `AGENTS.md` with:

- implementation completion and affected directories;
- the dev and production URLs;
- credential/config/upload locations;
- test/build/browser verification date and result;
- remaining risks: plaintext LAN credential, in-memory sessions, no public deployment support.

Then commit:

```powershell
git add docs/config-admin-guide.md AGENTS.md
git commit -m "docs: add config admin setup guide"
```

## Plan Self-Review

### Spec coverage

- Local/LAN single-password access: Tasks 3 and 7.
- JSON configuration and immediate frontend refresh: Tasks 1, 2 and 4.
- Images, videos and audio uploads: Task 3 API plus Task 6 form fields.
- All requested content modules: Task 6 structured editor.
- Date-based Excel template, import preview, export and partial-date replacement: Tasks 5 and 6.
- Opening balances, derived daily/cumulative totals and leaderboard ordering: Tasks 1, 2 and 5.
- Derived data without duplicate maintenance: Task 1 hydration boundary.
- Atomic backup, validation and safe deletion: Tasks 2 and 3.
- Tests, build and browser checks: Tasks 1 through 7.

### Placeholder scan

The plan contains no unresolved placeholders, deferred implementation, or unspecified validation requirements. Values and route names are fixed by the approved design.

### Type consistency

Raw JSON is always `team`, `stats`, `roster`, `albums`, `dailyScores`, `news`, and `music`. Raw roster entries use `basePoints`, raw daily rows use only `id`, `teamRace`, and `openRace`; `points`, `weekday`, `name`, `score`, and `total` are hydrated fields. The frontend-only derived collections are `gallery`, `leaderboard`, and `featuredMembers`. The public API returns hydrated data; authenticated reads and writes use raw data.
