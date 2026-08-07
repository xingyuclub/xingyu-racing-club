# 星屿车队 COS 媒体与上线前收口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not begin until the parallel worktree is reconciled and the user authorizes implementation. Steps use checkbox syntax for tracking.

**Goal:** 将公开媒体上传迁移到腾讯 COS/CDN，保留积分与识别审计数据，准备可回滚的占位配置重置，并用本机生产 Node + 免费 Cloudflare 隧道完成上线前验收。

**Architecture:** Express 继续在本机 `3000` 提供生产 `dist` 与公开 API，后台上传通过服务端写入 COS；图片同时保存原图和 WebP 缩略图，前台列表使用缩略图、详情使用原图。一次性重置工具只替换非积分配置，积分配置和识别证据先做校验与备份。

**Tech Stack:** Node.js、Express 5、React/Vite、Vitest、`sharp`、腾讯 COS Node SDK、Cloudflare `cloudflared`、PowerShell。

---

## 实施门槛

- [ ] 其他会话停止修改当前工作区，重新核对每个未提交文件的归属。
- [ ] 保存当前 `git status --short --branch`、`git diff --stat` 和运行时配置校验结果；不得使用 reset 或 checkout 覆盖现有改动。
- [ ] 用户确认开始实施，并提供腾讯云账号、COS Bucket、Region、CDN 域名准备状态；真实 Secret 只在本机 `.env` 提供。
- [ ] 先运行当前基线测试和构建，记录失败项；基线失败不能归因给本计划。

## 文件地图

- Create: `server/lib/cosStorage.js` — COS 适配器与公共 URL 生成。
- Create: `server/lib/cosStorage.test.js` — COS 客户端注入、上传失败和 URL 生成测试。
- Create: `server/lib/mediaVariants.js` — 图片原图/缩略图命名和 `sharp` 变体生成。
- Create: `server/lib/mediaVariants.test.js` — 图片变体和非图片媒体测试。
- Create: `server/lib/prelaunchConfig.js` — 占位重置、积分快照和恢复校验纯函数。
- Create: `server/lib/prelaunchConfig.test.js` — 重置前后积分数据一致性测试。
- Create: `scripts/reset-public-config.js` — `dry-run` 与确认后的原子重置入口。
- Modify: `server/index.js` — 上传服务注入 COS、生成图片变体、保留本地开发回退。
- Modify: `server/index.test.js` — COS 注入上传、回退和响应结构测试。
- Modify: `src/admin/adminApi.js`、`src/admin/UploadLibrary.jsx` — 统一读取上传响应，并支持列出和删除 COS 素材。
- Modify: `src/admin/UploadField.jsx` — 显示原始文件名和上传状态，向字段回调两个媒体地址。
- Modify: `src/admin/ConfigEditor.jsx` — 保存可选缩略图字段，不破坏旧字符串字段。
- Modify: `src/admin/RichTextEditor.jsx` — 正文图片保存展示地址和原图地址。
- Modify: `src/components/Hero.jsx`、`src/styles/global.css` — 自动播放和三级回退。
- Modify: `src/components/Roster.jsx`、`src/components/DomeGallery.jsx`、`src/components/FeaturedMembers.jsx`、`src/components/GalleryPreview.jsx`、`src/components/AlbumPage.jsx`、`src/components/PhotoModal.jsx`、`src/components/NewsFeed.jsx`、`src/components/NewsPage.jsx`、`src/components/NewsDetailPage.jsx` — 列表使用缩略图，详情使用原图，空状态使用现有非真人占位图。
- Modify: `server/lib/newsRichText.js`、`server/lib/newsRichText.test.js` — 仅允许配置的 COS/CDN 图片源进入富文本。
- Modify: `src/data/siteConfig.js`、`src/data/teamData.js` — 兼容新增可选缩略图字段和新的 Hero 占位默认值。
- Modify: `src/App.test.jsx`、`src/admin/AdminApp.test.jsx`、相关组件测试 — 回归媒体变体、空状态和 Hero 回退。
- Modify: `scripts/start-public.ps1`、`start-public.bat` — 统一生产 `3000` 启动和 Cloudflare 健康检查。
- Modify: `docs/config-admin-guide.md`、`.env.example`、`AGENTS.md` — COS、重置和公网部署说明。

---

### Task 1: 基线与并行改动收口

**Files:**
- Read only: `git status`, `AGENTS.md`, `docs/superpowers/specs/2026-08-06-xingyu-cos-prelaunch-design.md`
- Test only: existing project test suite

- [ ] **Step 1: 记录当前工作区归属**

运行：

```powershell
git status --short --branch
git diff --stat
git diff --name-only
```

把其他会话的文件列表保存到本地审阅记录，不改写或暂存它们。

- [ ] **Step 2: 验证运行时积分快照**

运行只读脚本，输出 `scoreMembers`、工作日、周末日和积分行数：

```powershell
node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('server/data/site-config.json','utf8'));console.log(JSON.stringify({scoreMembers:c.scoreMembers.length,dailyDates:c.dailyScores.length,dailyRows:c.dailyScores.reduce((n,d)=>n+d.rows.length,0),weekendDates:c.weekendScores.length,weekendRows:c.weekendScores.reduce((n,d)=>n+d.rows.length,0)},null,2))"
Get-ChildItem server\data\score-recognition -File -Recurse | Measure-Object Length -Sum
Get-ChildItem server\storage\score-recognition -File -Recurse | Measure-Object Length -Sum
```

任何读取异常先停止，不执行重置。

- [ ] **Step 3: 运行基线测试与构建**

```powershell
npm test -- --run
npm run build
```

记录基线失败，不把已有失败归入本计划。

- [ ] **Step 4: 保持本任务未提交**

此阶段不 `git add`、不 `git commit`。只有用户确认其他会话已完成后，才进入后续任务。

### Task 2: COS 存储适配与图片变体

**Files:**
- Create: `server/lib/cosStorage.js`
- Create: `server/lib/cosStorage.test.js`
- Create: `server/lib/mediaVariants.js`
- Create: `server/lib/mediaVariants.test.js`
- Modify: `package.json`, `package-lock.json`, `.env.example`

- [ ] **Step 1: 写 COS 客户端注入测试**

测试适配器接受注入的客户端，不在单测中访问网络：

```js
const storage = createCosStorage({
  client: fakeClient,
  bucket: 'test-bucket',
  region: 'ap-guangzhou',
  publicBaseUrl: 'https://cdn.example.test',
});

await storage.putObject({ key: 'uploads/a.jpg', body: Buffer.from('x'), contentType: 'image/jpeg' });
expect(fakeClient.putObject).toHaveBeenCalledWith(expect.objectContaining({ Key: 'uploads/a.jpg' }));
expect(storage.publicUrl('uploads/a.jpg')).toBe('https://cdn.example.test/uploads/a.jpg');
```

覆盖配置缺失、上传失败、URL 拼接和禁止把 Secret 放入返回值。

- [ ] **Step 2: 实现最小 COS 适配器**

实现 `createCosStorage({ client, bucket, region, publicBaseUrl })`，提供：

```js
putObject({ key, body, contentType, cacheControl })
deleteObject(key)
listObjects(prefix)
publicUrl(key)
```

生产环境创建官方 COS 客户端；单测和本地开发使用注入客户端或本地存储回退。

- [ ] **Step 3: 写图片变体测试**

使用最小 PNG fixture 验证：原图字节不变、缩略图为 WebP、最大边不超过配置值、视频和音频不生成图片变体。

- [ ] **Step 4: 实现图片变体命名和生成**

采用同一上传 ID 的可追溯键名：

```text
originals/<upload-id>--<safe-name>.<ext>
variants/<upload-id>--<safe-name>--thumb.webp
```

使用已有 `sharp` 生成缩略图；返回 `{ originalPath, thumbnailPath, originalName, type }`。

- [ ] **Step 5: 安装服务端依赖并验证**

只增加服务端 COS SDK，确认前端构建不会把 SDK 打入 `dist/assets/index-*.js`。运行：

```powershell
npm test -- --run server/lib/cosStorage.test.js server/lib/mediaVariants.test.js
npm run build
```

### Task 3: 后台上传和前台媒体变体接入

**Files:**
- Modify: `server/index.js`, `server/index.test.js`
- Modify: `src/admin/adminApi.js`, `src/admin/UploadField.jsx`, `src/admin/UploadLibrary.jsx`, `src/admin/ConfigEditor.jsx`, `src/admin/RichTextEditor.jsx`
- Modify: `src/data/siteConfig.js`
- Modify: `src/components/Roster.jsx`, `src/components/DomeGallery.jsx`, `src/components/FeaturedMembers.jsx`, `src/components/GalleryPreview.jsx`, `src/components/AlbumPage.jsx`, `src/components/PhotoModal.jsx`, `src/components/NewsFeed.jsx`, `src/components/NewsPage.jsx`, `src/components/NewsDetailPage.jsx`
- Modify: `server/lib/newsRichText.js`, `server/lib/newsRichText.test.js`
- Test: matching component and admin test files

- [ ] **Step 1: 写上传响应回归测试**

保留旧本地模式响应兼容，同时 COS 模式返回：

```json
{
  "path": "https://cdn.example.test/variants/id--thumb.webp",
  "originalPath": "https://cdn.example.test/originals/id--photo.png",
  "type": "image",
  "name": "id--photo.png",
  "originalName": "photo.png"
}
```

测试上传失败时配置不发生写入，旧 `/uploads/...` 数据仍能读取。

- [ ] **Step 2: 把上传路由接入存储抽象**

`POST /api/admin/upload` 先保存临时文件，完成 COS 原图和变体上传后再返回；COS 失败删除临时文件并返回错误。未配置 COS 时继续使用本地开发存储。

- [ ] **Step 3: 扩展可选缩略图字段**

保持现有字符串字段向后兼容，只增加可选字段：

```text
team.heroFallbackThumbnail
roster[].avatarThumbnail
albums[].photos[].thumbnailSrc
albums[].coverThumbnailSrc
news[].imageThumbnailSrc
music.coverThumbnail
```

前台优先使用缩略图字段，缺失时回退原字段；详情和弹窗使用原字段。

- [ ] **Step 4: 更新后台字段回调**

上传完成后同时保存展示地址和原图地址。旧配置只含字符串时不强制回填缩略图，不改动用户已有文本和积分字段。

- [ ] **Step 5: 接通 COS 素材库和富文本白名单**

`GET /api/admin/uploads` 在 COS 模式列出 `originals/` 对象并返回对应缩略图；删除操作同时删除同一上传 ID 的原图和缩略图。富文本图片只接受本地项目路径或 `COS_PUBLIC_BASE_URL`/`COS_CDN_BASE_URL` 同源地址，继续拒绝其他外链、Base64 和路径穿越。

- [ ] **Step 6: 验证列表与详情资源选择**

补测试确认成员、风采、相册、新闻列表使用缩略图，照片/视频详情使用原图；无缩略图的旧配置继续渲染原地址。

- [ ] **Step 7: 运行定向验证**

```powershell
npm test -- --run server/index.test.js server/lib/newsRichText.test.js src/admin/AdminApp.test.jsx src/App.test.jsx
npm run build
```

### Task 4: 占位配置重置与数据保护

**Files:**
- Create: `server/lib/prelaunchConfig.js`
- Create: `server/lib/prelaunchConfig.test.js`
- Create: `scripts/reset-public-config.js`
- Modify: `src/data/teamData.js`, `src/data/siteConfig.js`
- Modify: `src/components/Hero.jsx`, `src/components/AlbumPage.jsx`, `src/components/GalleryPreview.jsx`, `src/components/NewsPage.jsx`, `src/components/NewsFeed.jsx`, `src/components/Roster.jsx`, `src/components/MusicPlayer.jsx`
- Test: `src/App.test.jsx`, component tests

- [ ] **Step 1: 写重置纯函数的保护测试**

给定配置和识别目录快照，测试 `buildPlaceholderConfig` 只替换非积分字段，并断言以下字段深度相等：

```js
expect(next.scoreMembers).toEqual(before.scoreMembers);
expect(next.dailyScores).toEqual(before.dailyScores);
expect(next.weekendScores).toEqual(before.weekendScores);
expect(next.memberAliases).toEqual([]);
```

同时断言识别文件快照不变、旧媒体文件不删除、旧 Hero 全家福不再被新配置引用。

- [ ] **Step 2: 实现通用占位配置**

占位值使用通用文案；`roster`、业务 `albums`、`news` 和音乐地址为空；保留最小新闻分类；使用现有非真人相册占位资源，不使用旧全家福。

- [ ] **Step 3: 实现 `dry-run` 报告**

报告至少包含：配置差异、积分字段哈希、成员别名备份路径、识别批次数、截图数量、证据总字节数、被解除引用的旧媒体 URL。默认只输出，不写配置。

- [ ] **Step 4: 实现明确确认后的原子写入**

仅当命令同时收到 `--apply --confirm-reset` 且所有保护校验通过时：

1. 写完整 `site-config.json` 备份。
2. 写 `memberAliases` 独立备份。
3. 写临时配置。
4. 重新读取并校验临时配置。
5. 原子替换运行时配置。

任何失败都保留原文件并返回非零退出码。

- [ ] **Step 5: 实现空状态和占位媒体**

使用 `public/images/album/placeholder-01.jpg` 至 `placeholder-08.jpg` 中的非真人资源或新增同类内置资源；空成员不伪造成员卡，空相册和资讯显示已有空状态组件。

- [ ] **Step 6: 仅在用户再次明确确认后执行**

本计划不自动执行 `--apply`。执行前必须重新展示 dry-run 报告，并由用户单独确认“执行清空”。

### Task 5: Hero 自动播放与三级回退

**Files:**
- Modify: `src/components/Hero.jsx`, `src/styles/global.css`, `src/data/siteConfig.js`
- Test: `src/App.test.jsx`

- [ ] **Step 1: 写失败测试**

覆盖：COS 视频带 `muted loop playsInline autoplay`；播放前备用图可见；`playing` 后视频显示；视频 `error`、`play()` 拒绝和 8 秒未开始播放都切到配置图片；配置图片 `error` 后切到 `/images/album/placeholder-01.jpg`；旧 `/images/hero-home.png` 不再作为默认值。

- [ ] **Step 2: 实现最小状态机**

状态只保留 `pending`、`playing`、`video-failed`、`fallback-failed` 四种结果；视频加载失败和超时清理计时器，组件卸载时清理事件和计时器。

- [ ] **Step 3: 恢复自动播放并保持视觉稳定**

使用 `autoPlay muted loop playsInline preload="auto"`。视频触发 `playing` 前不隐藏图片，避免黑屏；视频失败后不再尝试无限重载。

- [ ] **Step 4: 运行 Hero 回归测试**

```powershell
npm test -- --run src/App.test.jsx
```

### Task 6: 生产启动脚本和部署文档

**Files:**
- Modify: `scripts/start-public.ps1`, `start-public.bat`, `scripts/stop-tunnel.ps1`
- Modify: `docs/config-admin-guide.md`, `.env.example`, `AGENTS.md`
- Test: `server/index.test.js`, PowerShell parser smoke check

- [ ] **Step 1: 统一生产入口**

启动脚本只负责：检查 `3000`、执行或提示 `npm run build`、启动 `node server/index.js`、启动 `cloudflared tunnel --url http://127.0.0.1:3000`、提取公网 URL、请求 `/` 和 `/api/config` 做健康检查。

- [ ] **Step 2: 保留开发入口边界**

明确 `4173` 仅用于 Vite 开发/局域网预览；公网脚本不得把未构建的 Vite 开发服务作为生产入口。

- [ ] **Step 3: 增加密钥和 COS 配置说明**

`.env.example` 只增加变量名和说明；部署文档明确 COS Bucket、Region、CDN 基础地址、CORS、密钥权限最小化和密钥轮换位置。

- [ ] **Step 4: 做 PowerShell 和公网健康检查**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-public.ps1
$logDir = Join-Path $env:TEMP 'xingyu-public-logs'
$publicUrl = (Select-String -Path (Join-Path $logDir 'cloudflared.out.log'),(Join-Path $logDir 'cloudflared.err.log') -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1).Matches[0].Value
curl.exe -I "$publicUrl/"
curl.exe -I "$publicUrl/api/config"
curl.exe -I "$publicUrl/api/login"
```

期望根路径和公开配置为 200，公网登录接口为 404。

- [ ] **Step 5: 完善故障排查文档**

记录 COS 上传失败、CORS、视频分段请求、Cloudflare 502、Node 未重启、临时域名变化和本机断网的排查步骤。

### Task 7: 最终集成验收与分批提交

**Files:**
- Read: all changed files from other sessions
- Modify: only files explicitly assigned to this plan
- Docs: `AGENTS.md`, `docs/config-admin-guide.md`

- [ ] **Step 1: 重新核对并行会话改动**

逐文件确认其他会话的改动已经完成或明确排除；不使用覆盖式 Git 操作。

- [ ] **Step 2: 运行全量测试和构建**

```powershell
npm test -- --run
npm run build
```

期望所有测试文件通过，构建产物包含独立后台和 ExcelJS chunk。

- [ ] **Step 3: 做数据保护演练**

只运行 `dry-run`，保存报告；使用临时 fixture 执行 `apply`，验证积分深度一致、识别目录字节数一致、备份可恢复。真实运行时配置仍不清空。

- [ ] **Step 4: 做浏览器验收**

验证 390、768、1280 三档：Hero 自动播放、视频失败回退、占位空状态、积分榜日期和查询、后台上传预览、无页面级横向溢出、无新增控制台错误。

- [ ] **Step 5: 分批提交**

只有用户明确允许提交且其他会话归属已确认后，按 COS、前台、重置工具、部署脚本和文档分批提交。运行时配置、COS Secret、本地媒体和识别截图不提交。

## 计划自检

- 数据保留：Task 4 Step 1-4 覆盖积分、识别索引、截图和别名备份。
- 占位策略：Task 4 Step 2、5 覆盖通用文案、空成员、空内容和非真人占位图。
- COS：Task 2、3 覆盖客户端、变体、后台上传、旧配置兼容和前台选择。
- Hero：Task 5 覆盖自动播放、配置图片回退、占位图回退和超时。
- 公网：Task 6 覆盖生产 `3000`、Cloudflare、健康检查和后台屏蔽。
- 并行保护：Task 1、Task 7 覆盖不覆盖、不暂存、不提交和归属复核。
- 本计划没有执行步骤会在用户再次确认前清空真实运行时配置。
