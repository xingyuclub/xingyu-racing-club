# 星屿车队本地配置后台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a password-protected local/LAN admin page that edits all current Xingyu H5 content, uploads media, and makes saved changes available to the frontend on refresh.

**Architecture:** An Express service owns runtime JSON configuration, local uploads, authenticated admin APIs, and production static-file delivery. The React H5 fetches the public configuration and derives gallery, featured members, leaderboard, and daily-score display fields from a single raw configuration. The `/admin` React route uses structured forms and the same service APIs.

**Tech Stack:** React 19, Vite 6, Vitest, Express, Multer, Supertest, Node.js `fs/promises`, HttpOnly cookie sessions.

---

## File Structure

- Create: `src/data/siteConfig.js` - seed creation, normalisation and derived frontend data.
- Create: `src/data/siteConfig.test.js` - configuration derivation unit tests.
- Create: `src/hooks/useSiteConfig.js` - public API fetch with initial-data fallback.
- Create: `src/admin/adminApi.js` - authenticated admin API client.
- Create: `src/admin/AdminApp.jsx` - login state and admin shell.
- Create: `src/admin/ConfigEditor.jsx` - structured configuration editor and save flow.
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
- Modify: `agent.md` - record implementation state, commands and verification result.

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

  it('derives gallery, featured members, ranks and daily score display values', () => {
    const config = createSeedConfig();
    config.roster[0] = { ...config.roster[0], points: 7, wins: 1 };
    config.roster[1] = { ...config.roster[1], points: 99, wins: 2 };
    const data = hydrateSiteData(config);

    expect(data.gallery).toHaveLength(config.albums.flatMap((album) => album.photos).length);
    expect(data.featuredMembers).toEqual(config.roster.slice(0, 8));
    expect(data.leaderboard[0]).toMatchObject({ id: config.roster[1].id, rank: 1 });
    expect(data.dailyScores[0].rows[0]).toMatchObject({
      id: config.roster[0].id,
      name: config.roster[0].name,
      total: 7,
      score: 18,
    });
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

export function createSeedConfig() {
  const { team, stats, roster, albums, dailyScores, news } = clone(teamData);
  return {
    team,
    stats,
    roster,
    albums,
    dailyScores,
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
  const leaderboard = [...config.roster]
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
    featuredMembers: config.roster.slice(0, 8),
    gallery: config.albums.flatMap((album) => album.photos),
    leaderboard,
    dailyScores: config.dailyScores.map((round) => ({
      ...round,
      rows: round.rows.map((row) => {
        const member = membersById.get(row.id);
        const teamRace = [...row.teamRace];
        const openRace = [...row.openRace];
        return {
          ...row,
          name: member?.name || row.name,
          teamRace,
          openRace,
          score: sum([...teamRace, ...openRace]),
          total: member?.points ?? row.total,
        };
      }),
    })),
  };
}
```

Keep `teamData.js` unchanged. The seed function strips only `gallery`, `leaderboard`, and `featuredMembers` by destructuring the copied object.

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
- every `roster` entry has a unique non-empty `id`, unique non-empty `number`, non-empty `name` and `role`, plus non-negative finite `points` and `wins`.
- every album has non-empty `id`, `name`, `date`, `coverSrc`; every photo has non-empty `id`, `src`, `title`, `date`, `alt`, and media type is absent, `image`, or `video`.
- every news item has non-empty `id`, `title`, `category`, `date`, `imageSrc`, `imageAlt`, `summary`, and `body`.
- every daily row references an existing roster ID and has exactly three non-negative finite values in each of `teamRace` and `openRace`.
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

Install the production dependencies `express` and `multer`, plus the development dependency `supertest`:

```powershell
npm install express multer
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
    json: async () => ({ ...teamData, team: { ...teamData.team, motto: '实时配置' }, music: { src: '/uploads/song.mp3', cover: '/uploads/cover.png' } }),
  }));
  render(<App />);
  expect(await screen.findByText('实时配置')).toBeInTheDocument();
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

### Task 5: Build the `/admin` Structured Form and Upload Library

**Files:**
- Create: `src/admin/adminApi.js`
- Create: `src/admin/AdminApp.jsx`
- Create: `src/admin/ConfigEditor.jsx`
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

Add a test that receives a 401 from the configuration request and returns to the login form, plus a test that an upload error is visible and does not replace the existing field value.

- [ ] **Step 2: Run the admin test to verify it fails.**

Run: `npm test -- src/admin/AdminApp.test.jsx`

Expected: FAIL because the admin components do not exist.

- [ ] **Step 3: Implement the API client and authentication shell.**

`adminApi.js` must export `login`, `logout`, `getConfig`, `saveConfig`, `uploadFile`, `listUploads`, and `deleteUpload`. Every request must set `credentials: 'include'`; JSON requests must set `Content-Type: application/json`; upload requests must use `FormData` without manually setting a content type. For a non-OK response, parse `{ error, details }` when available and throw an `Error` with the server message.

`AdminApp.jsx` must show a labelled account/password login form before authentication. After successful login, load config and render `ConfigEditor`. When an authenticated request returns 401, clear local admin state and show the login form with `登录状态已失效，请重新登录`.

- [ ] **Step 4: Implement the configuration editor in explicit sections.**

`ConfigEditor` owns a deep-cloned `draft` and never mutates React state in place. It renders these sections in this exact order:

1. `基础信息` - `team.name`, `team.label`, `team.motto`, `team.heroImage`, `music.src`, `music.cover`.
2. `统计数据` - four labels/values, with numeric `male` and `female` inputs for the `单身贵族` object.
3. `成员管理` - add, delete, move up/down and edit `id`, `number`, `name`, `role`, `points`, `wins`, `avatar`, `videoUrl`.
4. `新闻管理` - add, delete, move up/down and edit all documented news fields.
5. `相册管理` - add/delete/move albums and nested photos; each photo edits `id`, `src`, `title`, `date`, `alt`, `featured`, `mediaType`, and `videoUrl`.
6. `每日成绩` - add/delete dates and rows; use a member `<select>` for `row.id`, show the selected member name as read-only, edit exactly three numeric inputs each for `teamRace` and `openRace`.
7. `素材管理` - render `UploadLibrary` and refresh it after an upload or deletion.

Generate client-only IDs with `crypto.randomUUID()` when adding items. Do not let an editor delete the final four stats entries; render four fixed stat editors. Show a save bar with `保存全部配置`, disabled while saving. On success show `已保存，前台刷新后可见最新内容`; on server validation failure show every returned detail as a list.

`UploadField` must have a labelled file input such as `首屏图片上传`, call `uploadFile(file)`, set the field to returned `path` only after success, and show image preview, video element, or audio element based on the selected field type. It must retain the prior value on failure.

`UploadLibrary` must render each file's name, type, byte size and copyable `/uploads/...` path. Its delete action must prompt with `window.confirm`, call `deleteUpload(name)`, remove the item only after a 204 response, and never delete a configuration reference automatically.

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

Run: `npm test -- src/admin/AdminApp.test.jsx src/App.test.jsx`

Expected: PASS for login, expired session, upload failure, save, and existing H5 interaction coverage.

Run: `npm test`

Expected: entire Vitest suite passes.

- [ ] **Step 7: Commit the administrator UI.**

```powershell
git add src/admin src/main.jsx
git commit -m "feat: add structured config admin"
```

### Task 6: Document Setup, Verify Production Serving and Record Handoff

**Files:**
- Create: `docs/config-admin-guide.md`
- Modify: `agent.md`
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

Update `agent.md` with:

- implementation completion and affected directories;
- the dev and production URLs;
- credential/config/upload locations;
- test/build/browser verification date and result;
- remaining risks: plaintext LAN credential, in-memory sessions, no public deployment support.

Then commit:

```powershell
git add docs/config-admin-guide.md agent.md
git commit -m "docs: add config admin setup guide"
```

## Plan Self-Review

### Spec coverage

- Local/LAN single-password access: Tasks 3 and 6.
- JSON configuration and immediate frontend refresh: Tasks 1, 2 and 4.
- Images, videos and audio uploads: Task 3 API plus Task 5 form fields.
- All requested content modules: Task 5 structured editor.
- Derived data without duplicate maintenance: Task 1 hydration boundary.
- Atomic backup, validation and safe deletion: Tasks 2 and 3.
- Tests, build and browser checks: Tasks 1 through 6.

### Placeholder scan

The plan contains no unresolved placeholders, deferred implementation, or unspecified validation requirements. Values and route names are fixed by the approved design.

### Type consistency

Raw JSON is always `team`, `stats`, `roster`, `albums`, `dailyScores`, `news`, and `music`. The frontend-only derived keys are always `gallery`, `leaderboard`, and `featuredMembers`. The public API returns hydrated data; authenticated reads and writes use raw data.
