# 星屿车队 H5 交接说明

当前项目根目录：`C:\Users\Admin\Documents\H5`

最后更新：2026-07-30

## 项目一句话
这是一个基于 Vite + React 的星屿车队移动端 H5，核心是首页展示、成员阵容、积分榜、资讯、相册和音乐浮窗。

## 当前结构
- 入口：`src/App.jsx`
- 默认数据：`src/data/teamData.js`；运行时配置：`server/data/site-config.json`
- 配置后台：`src/admin/ConfigEditor.jsx`、`src/admin/ScoreEditor.jsx`
- 积分派生与 Excel：`src/data/siteConfig.js`、`src/admin/scoreWorkbook.js`
- 主要模块：`Hero`、`StatsBar`、`FeaturedMembers`、`GalleryPreview`、`Roster`、`Leaderboard`、`NewsFeed`、`AlbumPage`、`MusicPlayer`
- 交互弹窗：成员视频、照片预览、资讯详情、积分详情

## 当前进度
- 首屏主标题已改为 `欢迎来到星屿车队`
- slogan 行已移除
- 统计卡片保留 4 项，当前文案是 `车队排名`、`活跃排名`、`队员数量`、`单身贵族`
- `活跃排名` 已从 `3st` 修正为 `3rd`
- 统计卡、积分榜边框已接入动效组件
- 队员阵容标题为 `队员阵容`
- 队员展示是圆柱形持续滚动，不是平面列表
- 队员卡片点击仍可打开详情
- 轮播支持 hover 暂停、拖拽加速、松手后缓慢回到基础速度
- 相册仍保留 `文件夹 -> 照片` 的两级进入方式
- 项目文件已从 `技术标\.worktrees\xingyu-racing-club` 迁移到当前 `H5` 根目录
- 本地配置后台与 API 已实现，设计和实施记录见 `docs/superpowers/specs/2026-07-28-xingyu-config-admin-design.md`、`docs/superpowers/plans/2026-07-28-xingyu-config-admin-implementation.md`
- 星屿积分榜后台已采用“按日期纵向明细 + 队员期初积分”模型，支持 Excel 式在线编辑、模板下载、`.xlsx` 导入预览确认和当前数据导出
- 原始配置只保存期初积分、日期、成员 ID 和六局成绩；星期、当日得分、累计总分及首页排行榜均在运行时派生
- Excel 中出现的日期整体覆盖，未出现的日期保留；旧周表仅作参考，不能直接导入
- 旧配置中的成员 `points` 会自动迁移为 `basePoints`，原运行时文件会保存为 `.bak`
- 公开 H5 的新 UI/UX 方向已确认采用 `Pit Wall / 车队维修区`，完整设计见 `docs/superpowers/specs/2026-07-29-xingyu-pit-wall-ui-redesign-design.md`
- 新视觉仅覆盖首页、相册页、公开弹窗和音乐浮窗；功能、数据和配置后台不变
- 产品事实已记录到 `PRODUCT.md`，持久视觉规则已记录到 `DESIGN.md`；UI 实现尚未开始
- 用户要求原版 UI 完整保留；Pit Wall 新版必须在独立 `codex/pit-wall-ui-redesign` 分支或工作树中实现，完成后提供原版与新版两个 URL 二选一
- Pit Wall 实施计划已写入 `docs/superpowers/plans/2026-07-29-xingyu-pit-wall-ui-redesign-implementation.md`；计划要求测试先行、独立工作树实施、五档视口验收和双地址交付
- 2026-07-30 用户已确认保留原版 UI；Pit Wall 新版不好看，不启用、不合并、不作为当前项目上线方案，但代码保留在独立 `codex/pit-wall-ui-redesign` 分支/工作树中
- 2026-07-30 公开前台已改为在运行时把 `队员数量` 从 `roster.length` 派生，后台原始配置仍保留保存值；API 需重启后才会加载这次代码变更
- 2026-07-30 原版首页已按用户确认的 A 方案把 `欢迎来到星屿车队` 移入顶部独立黑色品牌栏；Pit Wall 分支未改动

## 已知风险 / 待补
- 很多素材还是占位图或待替换视频，真实头像、视频、相册素材还没补齐
- 车队名里有特殊 Unicode 字符，改文案时要注意别误伤配置
- 圆柱滚动属于当前重点交互，后续改样式时要保留：持续丝滑、hover 暂停、拖拽控制、点击详情
- 配置后台只适合本机或受信任局域网，`server/config/admin.local.json` 不可提交或部署到公网
- ExcelJS 约 940 KB，仅在后台使用积分导入导出时动态加载；首页不会主动加载该代码块
- 当前运行时配置只有迁移后的期初积分，尚未录入每日积分；前台日期弹窗会在录入并保存后显示每日明细
- Pit Wall 设计只能使用现有图片素材，实施时不得新增或生成视觉素材
- 新视觉实施需要重点消除当前页面大段空白，同时保留内容默认可见和减少动态模式
- 不得在当前原版分支直接落地 Pit Wall 样式，也不得在产品中加入永久主题切换；Pit Wall 新版已明确不启用，后续除非用户重新指定，否则不合并新版分支

## 验证状态
- 2026-07-28 本轮最终验证：`npm test` 共 7 个测试文件、132 项测试通过
- 2026-07-28 本轮最终验证：`npm run build` 通过，ExcelJS 保持为独立动态代码块
- 2026-07-28 本轮已验证：390、477、1280 视口无页面级横向溢出，积分查询弹窗可打开并显示 30 行数据
- 2026-07-28 本轮已生成浏览器验证截图：`output/verification-2026-07-28-*.png`，该目录按规则不进入 Git
- 2026-07-28 已完成配置后台设计文档自检；本轮仅修改文档，未重新运行前端测试
- 2026-07-28 已读取并核对 `星屿杯积分明细.xlsx` 的周表结构，完成按日期 Excel 维护补充设计；本轮仅修改文档，未重新运行前端测试
- 2026-07-28 已验证后台 1280、390 视口：期初积分、Excel 工具栏、在线新增明细均可用，宽表只在自身区域横向滚动，页面无横向溢出
- 2026-07-28 已验证前台 1280、390 视口：日期积分弹窗可打开且完整显示，页面无横向溢出
- 2026-07-28 已生成并独立检查 `output/星屿积分填写模板.xlsx`：两张工作表、表头、公式、样式和公式错误扫描均通过
- 2026-07-28 本轮浏览器与 Excel 验证截图位于 `output/verification-2026-07-28-*.png`，该目录不进入 Git
- 2026-07-29 已完成公开 H5 UI/UX 需求访谈、三方向可视化比较和 Pit Wall 方案分段确认
- 2026-07-29 已完成 `PRODUCT.md`、`DESIGN.md` 和 UI/UX 设计文档自检；本轮仅修改文档，未运行前端测试或构建
- 2026-07-29 用户确认采用独立分支双地址对比方式，原版必须保持可运行且不受新版实现影响
- 2026-07-29 已完成 Pit Wall 详细实施计划和自检；本轮仅修改计划与交接文档，未修改前端代码，未重复运行测试或构建
- 2026-07-30 已确认 Pit Wall 新版工作树存在且干净，分支为 `codex/pit-wall-ui-redesign`；3000/3001/3002 当前均无监听进程；本轮仅更新交接文档，未运行前端测试或构建
- 2026-07-30 已验证 `GET /api/config` 返回的公开配置中 `队员数量` 为实际 roster 数量；`src/data/siteConfig.test.js` 通过；API 已按新代码重启到 `127.0.0.1:3000`
- 2026-07-30 已验证原版顶部品牌栏：`npm test` 7 个测试文件、133 项通过；`npm run build` 通过；390、768、1024、1280 视口标题单行、图片从黑条下方开始且无页面级横向溢出
- 当前如有改动，先跑测试再看浏览器效果

## 维护规则
- 以后每次改动代码、文案、样式、数据、测试或素材后，都要同步更新这个文件
- 每次更新至少补这几项：修改了什么、影响了什么、是否验证、是否留下新风险
- 如果这份文件和代码状态不一致，以代码和最新验证结果为准，先更新这里再交接
- 后续只认 `H5` 这个目录作为项目工作区，不再回到 `技术标` 里的旧 worktree

## 快速回到工作点
优先看这些文件：
- `PRODUCT.md`
- `DESIGN.md`
- `docs/superpowers/specs/2026-07-29-xingyu-pit-wall-ui-redesign-design.md`
- `docs/superpowers/plans/2026-07-29-xingyu-pit-wall-ui-redesign-implementation.md`
- `src/App.jsx`
- `src/data/teamData.js`
- `src/components/Hero.jsx`
- `src/components/StatsBar.jsx`
- `src/components/Roster.jsx`
- `src/components/Leaderboard.jsx`
- `src/components/ScoreDetailsModal.jsx`
- `src/admin/ConfigEditor.jsx`
- `src/admin/ScoreEditor.jsx`
- `src/admin/scoreWorkbook.js`
- `src/data/siteConfig.js`
- `server/lib/configStore.js`
- `docs/config-admin-guide.md`
- `src/App.test.jsx`

## 项目 Skill 调用规则
- 写代码、改代码、重构、修 bug、做 code review 时，默认遵守 `karpathy-guidelines`：先想再写、简洁优先、精准改动、目标驱动，并在交付前说明验证结果。
- 新做页面、重做视觉风格、搭建设计系统、调整配色/字体/布局时，优先调用 `ui-ux-pro-max` 生成或校准设计系统，再进入实现。
- 对已有前端页面做高端化、视觉打磨、交互细节、响应式、可访问性、动效和 UI polish 时，优先调用 `impeccable`，必要时使用它的 `polish`、`adapt`、`animate`、`layout`、`critique`、`audit` 等流程。
- 遇到大体量上下文时调用 `headroom`：例如长构建/测试日志、大 JSON、200 条以上搜索结果、超长源码片段、上下文快满、用户要求“精简/压缩/省 token/太长了”。短输出、小改动和普通说明不需要调用。
- 需要 React 动效组件时，可以参考 `react-bits` 这类组件库，但不要把它当成项目 Skill；只有在明确需要具体动效组件时才引入依赖或复制组件代码。
- Skill 只在任务相关时使用；普通文案、小数据、窄范围修复不需要为了调用 Skill 而扩大改动范围。
