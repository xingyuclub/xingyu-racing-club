# 已废弃：历史交接文档

> 本文件停留在 2026-07-28，仅供追溯历史，不再作为当前开发依据。当前项目状态、工作目录和交接要求统一以根目录 `AGENTS.md` 为准。

# 星屿车队 H5 项目交接

最后更新：2026-07-28

## 1. 项目目标

这是一个基于 React 19 + Vite 6 的星屿车队移动端 H5，展示车队首页、统计数据、核心成员、完整阵容、积分榜、资讯、相册、每日成绩和背景音乐。

项目正在增加一个仅供本机或受信任局域网使用的最小配置后台。后台使用 Express + 本地 JSON，不使用数据库，支持账号密码登录、配置编辑、图片/视频/音频上传，以及前台刷新后读取最新配置。

## 2. 最重要的仓库状态

- 项目根目录：`C:\Users\Admin\Documents\H5`
- 主分支：`master`
- 配置后台实现分支：`codex/config-admin`
- 配置后台工作树：`C:\Users\Admin\Documents\H5\.worktrees\config-admin`
- **配置后台尚未合并到 `master`。** `master` 当前只有原 H5、后台设计文档和实施计划。
- 后台相关开发、测试和启动命令目前应在 `.worktrees/config-admin` 中执行。
- 根工作树存在用户自己的未提交文件和 `AGENTS.md` 改动，不要擅自清理、回滚或覆盖。

配置后台分支最近提交：

```text
79120d6 fix-admin-media-fields-and-stable-test
d213e29 feat-config-admin-ui-and-guide
016f454 feat-live-h5-config
82b13a3 feat-config-admin-api
```

## 3. 已完成内容

### 原 H5

- 首屏标题为 `欢迎来到星屿车队`，不显示 slogan。
- 统计卡片为 `车队排名`、`活跃排名`、`队员数量`、`单身贵族`，活跃排名为 `3rd`。
- 核心成员轮播、完整阵容圆柱滚动、积分榜、资讯、相册、每日成绩查询和音乐浮窗已实现。
- 阵容圆柱保留持续滚动、hover 暂停、拖拽加速、松手回落和点击详情。
- 相册保留 `文件夹 -> 照片/视频` 两级交互。

### 配置后台分支

- `src/data/siteConfig.js`：从内置数据生成原始配置，并派生相册、核心成员、排行榜和每日成绩显示数据。
- `server/lib/configStore.js`：严格校验七个顶层配置键，串行写入，临时文件替换，单版本 `.bak` 备份和失败回滚。
- `server/lib/auth.js`：单管理员、本地明文凭据、HttpOnly Cookie 和内存会话。
- `server/index.js`：登录/退出、公开配置、管理员配置、素材上传/列表/删除、`/uploads` 静态文件和生产 `dist` 托管。
- `src/hooks/useSiteConfig.js`：前台读取 `/api/config`，失败时继续使用内置配置，不出现空白页。
- `src/admin/`：`/admin` 登录页、七个配置模块、数组增删/排序、媒体上传回填、素材列表和保存状态。
- `docs/config-admin-guide.md`：本地配置、启动、文件位置和安全说明。

后台七个原始配置键固定为：

```text
team, stats, roster, albums, dailyScores, news, music
```

`gallery`、`leaderboard`、`featuredMembers` 是派生字段，不能写回 JSON。

## 4. 运行方式

在 `C:\Users\Admin\Documents\H5\.worktrees\config-admin` 中执行：

```powershell
Copy-Item server/config/admin.example.json server/config/admin.local.json
# 修改 admin.local.json，不能继续使用示例密码
npm install
npm run dev:api
npm run dev
```

- 开发前台：`http://127.0.0.1:5173/`
- 开发后台：`http://127.0.0.1:5173/admin`
- API：`http://127.0.0.1:3000/`
- 生产：`npm run serve`，前台为 `http://127.0.0.1:3000/`，后台为 `/admin`

开发模式必须同时运行 API 和 Vite。新会话不能假设上一次启动的进程仍然存在，应先检查端口再启动。

## 5. 配置和素材位置

- 管理员凭据：`server/config/admin.local.json`，已被 Git 忽略，不要把密码写入本文档或提交仓库。
- 示例凭据：`server/config/admin.example.json`
- 当前配置：`server/data/site-config.json`
- 上一版备份：`server/data/site-config.json.bak`
- 上传素材：`server/storage/uploads/`
- 前台内置回退数据：`src/data/teamData.js` 和 `src/data/siteConfig.js`

真实头像、视频、资讯图和相册素材仍不完整，很多位置还是占位内容。建议通过后台上传；不要直接提交运行时上传目录。

## 6. 验证状态

配置后台分支在 2026-07-28 已验证：

- `npm test`：5 个测试文件、116 项测试全部通过。
- `npm run build`：Vite 生产构建成功。
- HTTP 冒烟：开发前台、`/admin` 和 `/api/config` 返回成功响应。
- 原 H5 曾在 390、477、1280 宽度检查过页面横向溢出和积分弹窗。

尚未完成的验证：

- 没有对新增后台在 390 和 1280 宽度做完整浏览器截图审查。
- 没有在真实浏览器中完整走一遍“登录 -> 修改 -> 上传 -> 保存 -> 前台刷新 -> 删除素材”。
- 后台组件测试目前只有一个主流程；401 会话失效、上传失败保留旧值、素材删除确认和数组排序仍缺组件级测试。

## 7. 已知问题和风险

1. **未合并风险**：配置后台不在 `master`。在根目录直接运行会看到旧项目状态。
2. **素材缺失**：真实成员头像、视频、资讯图和相册素材仍需补齐。
3. **后台可用性待检查**：配置量大，递归表单在手机端会很长；需要真实浏览器检查输入、按钮、粘性保存栏和横向溢出。
4. **安全边界有限**：密码明文保存在本地文件，会话仅在内存中；没有公网部署、多人权限、持久会话、CSRF 或登录限流能力。
5. **重启会掉登录**：API 重启后所有会话失效，这是当前设计，不是数据丢失。
6. **单机 JSON 限制**：只适合单管理员、单服务进程；不要启动多个 API 实例同时写同一个配置文件。
7. **备份只有一版**：每次保存只保留上一个 `.bak`，不是历史版本系统。
8. **特殊字符**：车队名称含特殊 Unicode 字符，修改文案或编码时不要误伤。

## 8. 推荐下一步

1. 在 `.worktrees/config-admin` 做新增后台的桌面和手机浏览器验收。
2. 补 401、上传失败、素材删除和排序的后台组件测试。
3. 审查 `master..codex/config-admin` 差异，通过后把分支合并到 `master`。
4. 合并后重新运行 `npm test`、`npm run build` 和生产模式冒烟。
5. 通过后台逐步替换真实头像、视频、相册、资讯和音乐素材。

## 9. 快速定位文件

- 前台入口：`src/main.jsx`、`src/App.jsx`
- 原始数据和派生逻辑：`src/data/teamData.js`、`src/data/siteConfig.js`
- 后台入口：`src/admin/AdminApp.jsx`
- 配置编辑器：`src/admin/ConfigEditor.jsx`
- 后台 API 客户端：`src/admin/adminApi.js`
- 服务端入口：`server/index.js`
- 配置存储：`server/lib/configStore.js`
- 登录会话：`server/lib/auth.js`
- 操作指南：`docs/config-admin-guide.md`
- 设计和计划：`docs/superpowers/specs/2026-07-28-xingyu-config-admin-design.md`、`docs/superpowers/plans/2026-07-28-xingyu-config-admin-implementation.md`

## 10. 每次改动后的交接规则

每次修改代码、配置结构、文案、样式、测试、运行方式或素材后，都必须同步更新本文件。至少记录：

- 改了什么以及影响范围；
- 当前所在分支和是否已合并；
- 执行了哪些测试/构建/浏览器验证及结果；
- 新增或解决了哪些问题；
- 下一步最直接的工作入口。

如果本文档和代码不一致，以代码、Git 状态和最新验证输出为准，然后第一时间修正文档。不要用“已完成”描述尚未合并或尚未验证的工作。
