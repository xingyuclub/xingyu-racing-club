# 星屿车队 H5 交接说明

当前项目根目录：`C:\Users\Admin\Documents\H5`

最后更新：2026-08-05

## 项目一句话
这是一个基于 Vite + React 的星屿车队移动端 H5，核心是首页展示、成员阵容、积分榜、资讯、相册和音乐浮窗。

## 当前结构
- 入口：`src/App.jsx`
- 默认数据：`src/data/teamData.js`；运行时配置：`server/data/site-config.json`
- 配置后台：`src/admin/ConfigEditor.jsx`、`src/admin/ScoreEditor.jsx`
- 积分派生与 Excel：`src/data/siteConfig.js`、`src/admin/scoreWorkbook.js`
- 主要模块：`Hero`、`StatsBar`、`FeaturedMembers`、`GalleryPreview`、`Roster`、`Leaderboard`、`NewsFeed`、`AlbumPage`、`MusicPlayer`
- 交互弹窗：成员视频、照片预览、资讯详情、积分详情
- 截图识别管线：`server/lib/scoreRecognitionStore/Ai/Service/Routes.js`、`src/admin/ScoreRecognition.jsx`、`RecognitionHistory.jsx`、`WeekendScoreEditor.jsx`；Ollama 本地模型 `xingyu-score-recognition`（qwen2.5vl:7b）
- 身份与计分纯函数：`src/data/scoreRules.js`（`extractHanCharacters` 汉字提取、`buildMemberMatcher` 汉字兜底、计分/去重/槽位）

- 首屏品牌栏标题使用 `GradientText` 青蓝紫粉循环渐变，不再打字、删除或显示光标
- 首屏支持后台配置 `team.heroLines` 多句文案；后台按“第 N 句”独立编辑，前端每句独立成行
- slogan 行已移除
- 统计卡片保留 4 项，当前文案是 `车队排名`、`活跃排名`、`队员数量`、`单身贵族`
- `活跃排名` 已从 `3st` 修正为 `3rd`
- 首页四个统计格使用蓝、紫、青、玫红独立强调色，并加强数字与标签的显示层次
- 统计区外层紫色波浪框已移除，内部 4 个统计小框保留 `StarBorder`；积分榜使用普通列表容器
- 队员展示是圆柱形持续滚动，不是平面列表
- 队员卡片点击仍可打开详情
- 轮播支持 hover 暂停、拖拽加速、松手后缓慢回到基础速度
- 车队风采轮播每 4 秒自动切换；系统开启“减少动态效果”时仍保持自动切换
- 相册仍保留 `文件夹 -> 照片` 的两级进入方式
- 项目文件已从 `技术标\.worktrees\xingyu-racing-club` 迁移到当前 `H5` 根目录
- 本地配置后台与 API 已实现，设计和实施记录见 `docs/superpowers/specs/2026-07-28-xingyu-config-admin-design.md`、`docs/superpowers/plans/2026-07-28-xingyu-config-admin-implementation.md`
- 星屿积分榜后台已采用独立 `scoreMembers` 的“按日期纵向明细 + 积分人物期初积分”模型，支持 Excel 式在线编辑、模板下载、`.xlsx` 导入预览确认和当前数据导出
- 原始配置保存积分人物、期初积分、日期、积分人物 ID、六局成绩及 Excel/周末原始的得分和总分；星期和首页排行榜在运行时派生，成员阵容继续独立使用 `roster`
- 普通 Excel 中出现的日期整体覆盖、未出现的日期保留；KW27-KW31 旧周表通过 `scripts/import-legacy-score-workbook.js` 专用脚本导入
- 旧配置中的成员 `points` 会自动迁移为 `basePoints`，原运行时文件会保存为 `.bak`
- 公开 H5 的新 UI/UX 方向已确认采用 `Pit Wall / 车队维修区`，完整设计见 `docs/superpowers/specs/2026-07-29-xingyu-pit-wall-ui-redesign-design.md`
- 新视觉仅覆盖首页、相册页、公开弹窗和音乐浮窗；功能、数据和配置后台不变
- 产品事实已记录到 `PRODUCT.md`，持久视觉规则已记录到 `DESIGN.md`；UI 实现尚未开始
- 用户要求原版 UI 完整保留；Pit Wall 新版必须在独立 `codex/pit-wall-ui-redesign` 分支或工作树中实现，完成后提供原版与新版两个 URL 二选一
- Pit Wall 实施计划已写入 `docs/superpowers/plans/2026-07-29-xingyu-pit-wall-ui-redesign-implementation.md`；计划要求测试先行、独立工作树实施、五档视口验收和双地址交付
- 2026-07-30 用户已确认保留原版 UI；Pit Wall 新版不好看，不启用、不合并、不作为当前项目上线方案，但代码保留在独立 `codex/pit-wall-ui-redesign` 分支/工作树中
- 2026-07-30 公开前台已改为在运行时把 `队员数量` 从 `roster.length` 派生，后台原始配置仍保留保存值；API 需重启后才会加载这次代码变更
- 2026-07-30 原版首页已按用户确认的 A 方案把运行时配置的车队名称移入顶部独立黑色品牌栏；Pit Wall 分支未改动
- 2026-07-30 前台运行时配置已改为首次加载和窗口重新获得焦点时都重新请求 `/api/config`，并使用 `cache: 'no-store'`，后台保存图片后回到前台即可刷新
- 2026-07-31 已按个人风采卡片的 3:4 肖像比例，将 28 张成员原图逐张定位人物并批量裁切为 900×1200 JPG，成品位于 `public/images/members`，裁切脚本为 `scripts/crop-member-portraits.ps1`；当前已配置成员“青山”的头像已切换到新成品图
- 2026-08-01 已启动局域网前端访问：Vite 监听 `0.0.0.0:4173`，局域网地址为 `http://192.168.1.24:4173/`；前端 `/api` 继续代理到本机配置 API
- 2026-08-01 已完成积分截图识别、周末手动积分、识别审计和 KW27-KW31 历史迁移的需求访谈与分段设计确认，设计文档为 `docs/superpowers/specs/2026-08-01-xingyu-ai-score-recognition-design.md`；本轮只新增设计与交接文档，未修改业务代码、未运行测试或构建；实施前仍需编写详细计划

## 已知风险 / 待补
- 很多素材还是占位图或待替换视频，真实头像、视频、相册素材还没补齐
- 车队名里有特殊 Unicode 字符，改文案时要注意别误伤配置
- 圆柱滚动属于当前重点交互，后续改样式时要保留：持续丝滑、hover 暂停、拖拽控制、点击详情
- 配置后台只适合本机或受信任局域网，`server/config/admin.local.json` 不可提交或部署到公网
- ExcelJS 约 940 KB，仅在后台使用积分导入导出时动态加载；首页不会主动加载该代码块
- 当前运行时配置已导入 KW27-KW31 共 25 个工作日和 10 个周末日；后续截图与手动录入需继续保持积分人物 ID 引用完整
- Pit Wall 设计只能使用现有图片素材，实施时不得新增或生成视觉素材
- 新视觉实施需要重点消除当前页面大段空白，同时保留内容默认可见和减少动态模式
- 不得在当前原版分支直接落地 Pit Wall 样式，也不得在产品中加入永久主题切换；Pit Wall 新版已明确不启用，后续除非用户重新指定，否则不合并新版分支
- 识别运行时索引 `server/data/score-recognition/score-recognition-index.json` 已被 Git 跟踪且持续产生大 diff，建议加入 `.gitignore` 并 `git rm --cached`（需用户确认）
- 已 `ready` 的识别批次草稿由旧匹配逻辑生成（未匹配虚高），需重新打开/重新处理才会按新匹配器重算
- 前端一批功能改动（ShinyText 签名扫光、视频资源释放、成员头像懒加载、后台 signature 归一化、首页资讯上移）已提交 `983356d`

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
- 2026-07-30 已修复首屏图片重复显示：根因为背景图在固定高容器中默认重复；有图片时改用单个 `<img>` 按原图比例完整显示，空配置保留占位区；`npm test` 通过 7 个测试文件、134 项测试，`npm run build` 通过；浏览器 390/768/1280 三档视口均确认仅 1 张图片、比例约 1.6、无横向溢出
- 2026-07-30 已修复品牌栏名称未跟随后台配置：根因为 `Hero` 标题硬编码；现改为渲染 `team.name`，新增后台名称回归断言；全量测试 134 项、构建均通过，浏览器 `3001` 已验证显示 `欢迎来到星⁡⁠屿`（含原始不可见字符）
- 2026-07-30 统计区已修正为外层 1 个紫色波浪 `ElectricBorder`，内部 4 个统计小框保留原 `StarBorder`；减少动态模式停止动画但保留静态波浪；全量测试 134 项、构建均通过；浏览器 390/768/1280 三档确认结构正确且无横向溢出
- 2026-07-30 按页面批注移除统计区外层紫色 `ElectricBorder`，内部 4 个 `StarBorder` 和积分榜 `ElectricBorder` 保持不变；全量测试 7 个测试文件、134 项通过，构建通过；浏览器移动端/桌面端确认无外框且无页面级横向溢出；未留下新的已知风险
- 2026-07-30 品牌栏已接入 `TextType`：后台名称逐字输入、停留、删除并循环，光标为 `|`；GSAP 独立按需加载；全量测试 134 项、构建均通过；浏览器 390/768/1280 三档确认完整名称、光标、标题不溢出且页面无横向滚动
- 2026-07-30 已验证原版顶部品牌栏：`npm test` 7 个测试文件、133 项通过；`npm run build` 通过；390、768、1024、1280 视口标题单行、图片从黑条下方开始且无页面级横向溢出
- 2026-07-30 已验证后台图片同步修复：`npm test` 7 个测试文件、134 项通过；`npm run build` 通过；前台运行时 `background-image` 与 `/api/config` 的上传图片路径一致，390 视口页面级横向溢出为 0
- 2026-07-31 已验证 28 张个人风采成品全部可解码且尺寸均为 900×1200；`npm test` 7 个测试文件、134 项通过，`npm run build` 通过；浏览器桌面端和 390 宽移动端确认“青山”新图正确加载、人物头脚完整、页面级横向溢出为 0；批量总览位于 `output/member-portraits-contact-sheet.jpg`，未留下新的功能风险
- 2026-07-31 已完成首屏多句文案配置：默认数据与运行时配置支持 `team.heroLines`，旧配置无该字段时回退为车队名称；前端每句独立渲染，后台支持新增、删除和上下移动；修正两条过时测试断言后，`npm test` 7 个测试文件、134 项通过，`npm run build` 通过；浏览器 `1280×720` 与 `390×844` 确认两句分行、无页面级横向溢出，后台可见“第 1 句”“第 2 句”；未留下新的功能风险
- 2026-07-31 已移除成员卡片前台的编号展示和 `DRIVER PROFILE` 装饰文案，后台成员管理与积分编辑器不再显示“编号”字段；内部 `number` 仍保留在配置和 Excel 匹配链路中，避免破坏既有积分导入导出；新增成员时后台自动分配内部编号；当前配置成员“青山”的角色已落盘为“队长”，并补充角色保存与字段隐藏回归测试；`npm test` 7 个测试文件、134 项通过，`npm run build` 通过，浏览器 `3001` 验证角色为“队长”、相关 DOM 元素数量为 0；未留下新的功能风险
- 2026-07-31 已移除后台成员管理中的“期初积分”和“胜场”可见/可编辑字段；两者仍作为内部兼容数据保留，分别继续支撑历史积分派生和排行榜并列排序；新增成员默认值仍为 0；补充后台字段隐藏回归断言，定向测试通过；未留下新的功能风险
- 2026-07-31 已修复车队风采轮播不自动切换：根因为“减少动态效果”媒体查询阻止了定时器启动；现保留每 4 秒自动切换，并新增对应回归测试；`npm test` 7 个测试文件、135 项通过，`npm run build` 通过；浏览器在减少动态模式下确认由“青山”自动切换到“喵酱”；未留下新的功能风险
- 2026-08-01 已验证局域网前端地址 `http://192.168.1.24:4173/` 返回 HTTP 200，4173 端口监听于 `0.0.0.0`；未修改业务代码，新增访问入口无新的功能风险
- 2026-08-01 按页面批注移除积分榜外层 `ElectricBorder` 波浪动画框，保留普通列表容器；同时收紧统计区 `1st`、`3rd` 的序号后缀间距；`src/App.test.jsx` 定向测试 42 项通过，`npm run build` 通过，浏览器 `3001` 已确认积分榜无动画画布且移动端统计卡片排版正常；未留下新的功能风险
- 2026-08-01 按页面批注将顶部品牌标题改为 `GradientText` 青蓝紫粉循环渐变，并移除 `TextType` 打字、删除和光标链路；统计四格增加独立强调色、淡色背景及更醒目的数字和标签样式；`npm test` 7 个测试文件、135 项通过，`npm run build` 通过；浏览器 `390x844`、`768x1024`、`1280x800` 三档确认标题与统计区生效、统计格按 2/4/4 列响应且页面级横向溢出为 0；未留下新的功能风险
- 2026-08-01 继续验证当前未提交改动：`npm test -- --run` 通过 7 个测试文件、135 项测试，`npm run build` 通过；浏览器 `3001` 在 `390x844`、`768x1024`、`1280x800` 三档确认页面级横向溢出为 0、标题渐变行数正确、四个统计卡均带独立强调色、积分榜无 `ElectricBorder` 画布；未留下新的功能风险
- 2026-08-01 已修复车队风采轮播在“减少动态效果”模式下跳帧的问题：全局媒体查询原本把轮播过渡压成 `0.01ms`，现为轮播卡片增加局部平滑过渡例外，保留自动切换、拖拽和点击行为；新增轮播过渡回归断言；`npm test` 7 个测试文件、136 项通过，`npm run build` 通过；浏览器确认减少动态模式下实际过渡为 `transform 0.62s`、`opacity/filter 0.42s` 且自动切换正常；未留下新的功能风险
- 2026-08-01 首页主媒体已支持图片或视频：后台分别维护“首页主媒体”和“视频失败备用图”，上传响应自动保存 `image`/`video` 类型；视频静音自动循环、行内播放、无控制条，加载或自动播放失败时切备用图，主媒体为空时也直接显示备用图，备用图失败则回到空占位；旧 `team.heroImage` 自动迁移到 `team.heroMedia`，旧字段中的 `.mp4/.webm` 会识别为视频；`npm test -- --run` 通过 7 个测试文件、147 项测试，`npm run build` 通过，API/前端均返回 HTTP 200，当前 134,694,311 字节 MP4 返回 `video/mp4` 且支持 byte-range，运行时配置已迁移为 `type: video`；应用内浏览器和本机无头浏览器均受当前桌面策略阻止，未完成本轮三档截图验收，响应式无溢出仍由现有 CSS 和组件测试覆盖；新增风险仅为尚未配置备用图片时视频失败会显示空占位
- 2026-08-01 当前 5 位成员 ID 已按后台顺序重排为字符串 `1` 至 `5`，现有积分行同步改用新 ID；后台新增成员改为自动取最小未使用正整数 ID，字段仍可手动编辑但保存时必须非空且唯一；新增回归测试确认非数字旧 ID 后从 `1` 开始编号；`npm test -- --run` 通过 7 个测试文件、149 项测试，`npm run build` 通过；未留下新的功能风险
- 2026-08-01 后台上传字段已显示新上传文件的原始文件名：服务端 Multer 生成 `<uuid>--<原名><扩展名>` 形式，对原文件名做 latin1 转 utf8 解码、Windows 保留字符清理、尾部空格/点裁剪和 96 字符限长，空名回退为 `file`；前端 `UploadField` 提取 `--` 后的原始名展示，旧 UUID 文件回退显示 basename，存储路径不变；服务端测试覆盖 UUID+原名、Unicode 文件名、路径字符清理、同名不覆盖和空名回退，前端测试覆盖新格式显示原名、旧格式显示 UUID 和完整路径不可见；`npm test -- --run` 通过 17 个测试文件、227 项测试，`npm run build` 通过；已知限制为旧 UUID-only 上传无法还原原名、仅显示 UUID basename
- 2026-08-01 AI 积分识别 Task 1 已完成：新增 `src/data/scoreRules.js` 纯计分与身份规则模块及 27 项单测，覆盖队内赛计分（人数封顶 6、名次加分）、排位赛相对计分（成员封顶 3）、昵称标准化（剥离 `ˣʸ༩·` 前缀、去不可见字符、小写、NFC）、成员匹配（含别名）、内容去重签名和每人每日每类型 3 局槽位分配（含已满跳过）；`npm test -- --run` 通过 8 个测试文件、177 项测试，`npm run build` 通过；本任务不依赖外部 API，未留下新的功能风险
- 2026-08-01 AI 积分识别 Task 2 已完成：新增 `server/lib/scoreLedger.js` 及 6 项单测，实现周末总分覆盖、后续工作日累加和当前 roster 投影；改造 `src/data/siteConfig.js` 接入 scoreLedger 并支持 `weekendScores`、`memberAliases`，旧配置迁移补空数组；扩展 `server/lib/configStore.js` 顶层键与校验（周末日期、非负数、别名引用现有成员）并补 4 项校验回归测试；`npm test -- --run` 通过 9 个测试文件、182 项测试，`npm run build` 通过；未留下新的功能风险
- 2026-08-01 AI 积分识别 Task 3-4 已完成：新增 `server/lib/scoreRecognitionStore.js`（批次索引原子写、原图持久化、失败重试，5 项测试）、`server/lib/scoreRecognitionAi.js`（OpenAI 视觉适配器，依赖注入假客户端，结构校验覆盖缺 matches/重复名次/负名次/空昵称/非法日期/非 JSON，8 项测试）、`server/lib/scoreRecognitionService.js`（识别管线：AI 提取→标题分类→昵称/别名匹配→计分→内容签名去重→每人 3 局槽位分配→生成待确认草稿；提交时校验名单版本、合并入 dailyScores 三槽结构、原子写配置，6 项测试）及 `.env.example`；管线串联 Task 1 的 `scoreRules.js` 全部纯函数；`npm test -- --run` 通过 12 个测试文件、201 项测试，`npm run build` 通过；openai SDK 待 Task 5 路由层接入真实客户端时再加，当前不引入未使用依赖；未留下新的功能风险
- 2026-08-01 AI 积分识别 Task 6 已完成：新增 `server/lib/scoreRecognitionRoutes.js` 路由工厂（截图上传/列表/详情/识别处理/草稿编辑/提交/重试），`server/index.js` 加载 dotenv、按需创建 OpenAI 客户端、新增公开 SSE `GET /api/config/events`、PUT 配置和识别提交后广播 `config-updated` 事件，识别路由挂在 `auth.requireSession` 后；安装 `openai@7` 和 `dotenv@17`（仅服务端，前端 bundle 大小不变）；`npm test -- --run` 通过 12 个测试文件、206 项测试（含 5 项新识别 API 测试：鉴权 401 边界、上传→识别→提交全流程、文件类型白名单、日期校验、批次列表），`npm run build` 通过；Task 5 历史 KW27-KW31 迁移因无真实旧周表文件暂缓；剩余 Task 7-10 为后台 UI、实时刷新和端到端验收
- 2026-08-01 AI 积分识别 Task 9 已完成：`src/hooks/useSiteConfig.js` 新增 EventSource 监听 `/api/config/events` 的 `config-updated` 事件，事件触发时以 no-store 重新请求 `/api/config`；加 EventSource 存在性守卫，jsdom 或不支持环境优雅降级到原有窗口 focus 刷新；卸载时关闭连接并移除监听；新增 3 项单测覆盖 SSE 刷新、错误后保留配置仍响应 focus、卸载关闭连接；`npm test -- --run` 通过 13 个测试文件、209 项测试，`npm run build` 通过；未留下新的功能风险
- 2026-08-01 AI 积分识别 Task 7-8 已完成：新增 `src/admin/ScoreRecognition.jsx`（截图上传→AI 识别→预览→提交状态机，3 项测试）和 `src/admin/WeekendScoreEditor.jsx`（本周六/周日表格，每成员积分/得分/总分三字段原样保存、不自动重算，4 项测试），两者均接入 `ScoreEditor.jsx` 的三标签页（积分明细 / 截图识别 / 周末录入）；`adminApi.js` 新增识别批次上传/处理/提交/重试 API 封装；`admin.css` 新增标签页、识别预览和周末表格样式；`npm test -- --run` 通过 15 个测试文件、216 项测试，`npm run build` 通过（CSS +2.6 kB、JS +7.5 kB 为新组件，ExcelJS 仍独立）；剩余 Task 5 历史 KW27-KW31 迁移需真实旧周表文件、Task 10 集成测试与文档收口
- 2026-08-01 AI 积分识别已实现识别管线主体（Tasks 1-4、6、7、8、9）：`src/data/scoreRules.js`、`server/lib/scoreLedger.js`、`server/lib/configStore.js`（新增 `weekendScores`/`memberAliases` 顶层键与校验）、`server/lib/scoreRecognitionStore.js`、`server/lib/scoreRecognitionAi.js`、`server/lib/scoreRecognitionService.js`、`server/lib/scoreRecognitionRoutes.js`（挂载到后台 API）、`src/admin/ScoreRecognition.jsx`、`src/admin/RecognitionHistory.jsx`、`src/admin/WeekendScoreEditor.jsx`、`src/hooks/useSiteConfig.js`（SSE 实时刷新）；`ScoreEditor` 增加 `积分明细`/`截图识别`/`周末录入`/`识别记录` 四个标签页；`.env.example` 提供 `OPENAI_API_KEY`/`OPENAI_VISION_MODEL` 示例
- 2026-08-01 WeekendScoreEditor 为本周固定的周六/周日表格，每位队员一行，保存 `积分/得分/总分` 三字段原值；`scoreWorkbook.js` 导出新增 `周末手动积分` 工作表，保留三字段原值；新增 `src/admin/WeekendScoreEditor.test.jsx`（4 项）与 `scoreWorkbook` 周末表回归断言
- 2026-08-01 RecognitionHistory 列出识别批次、显示状态、对失败批次提供重试入口；新增 `src/admin/RecognitionHistory.test.jsx`（4 项）
- 2026-08-01 AI 积分识别本轮验证：
pm test -- --run 通过 16 个测试文件、221 项测试，
pm run build 通过；识别与历史迁移为纯函数与 ExcelJS 解析，不依赖真实网络；Task 5（历史 KW27-KW31 周表解析 legacyScoreWorkbook.js）尚未实现，需真实的 星屿杯积分明细.xlsx 结构或程序化 ExcelJS fixture 才能可靠验证，列为待办
- 2026-08-01 AI 积分识别 Task 5/10 已完成：`server/lib/legacyScoreWorkbook.js` 实现 `mergeLegacyScoreImport` 纯函数（严格覆盖 KW27-KW31 范围即 2026-06-29 至 2026-08-02、范围外保留、weekendScores 原样使用、日期排序），`parseLegacyScoreWorkbook` Excel 解析因缺少真实旧周表文件留作待实现抛错占位；新增 3 项合并函数测试；`docs/config-admin-guide.md` 补充截图识别、周末录入和实时刷新三节操作指南；全量 `npm test -- --run` 通过 17 个测试文件、224 项测试，`npm run build` 通过；API 端到端验证通过（登录 204、批次列表 200、上传批次 201、SSE text/event-stream），测试残留已清理；唯一待补项为用户提供 KW27-KW31 旧 Excel 后实现 Excel 表头定位解析
- 2026-08-01 后台成员管理卡片已支持逐个手动收起/展开：默认展开，收起后仅保留成员名称、ID、展开、排序和删除操作；折叠状态只存在于当前后台页面，不写入站点配置，刷新后恢复展开；新增回归测试覆盖收起、摘要显示、重新展开及数据保留；`npm test -- --run` 通过 17 个测试文件、228 项测试，`npm run build` 通过；浏览器已验证桌面端与移动端交互，移动端页面级横向溢出为 0；未留下新的功能风险
- 2026-08-02 首页精选照片已改为完整显示：仅 `GalleryPreview` 精选图使用 `object-fit: contain` 和深蓝留白背景，桌面悬停不再放大，卡片比例、文字遮罩、点击预览及相册页 `cover` 缩略图保持不变；`src/App.test.jsx` 定向 48 项测试通过，`npm run build` 通过；浏览器用当前后台配置的 `2190×2828` 竖图验证 390、768、1280 三档均完整显示且页面级横向溢出为 0；全量测试共 231 项中 228 项通过、3 项与本次改动无关的现有失败（`legacyScoreWorkbook` 两项解析占位、`normalizeNickname` 一项前缀断言）；未留下新的精选照片功能风险
- 2026-08-02 已使用真实附件 `星屿杯积分明细NEW.xlsx` 补齐 KW27-KW31 历史周表解析：`server/lib/legacyScoreWorkbook.js` 现使用 ExcelJS 动态定位昵称、星期、队内赛/开黑赛局次及周末字段，支持 KW27/KW28 旧结构缺少开黑赛或周末字段、KW28 空昵称表头回退、公式结果读取、全零成员行保留、当前成员/别名匹配、未匹配昵称生成独立历史 ID、非目标工作表忽略和坏表异常报告；`normalizeNickname` 同步剥离当前名单使用的 `ˣʸ༩·` 前缀。真实附件解析 5 张目标周表、25 个工作日（875 行）和 10 个周末日期（350 行），日期范围为 2026-06-29 至 2026-08-02，结构与同日 ID 唯一性检查通过，4 张非目标表正确忽略且无解析错误；新增回归后 `npm test -- --run` 通过 17 个测试文件、231 项测试，`npm run build` 通过。运行时配置未自动覆盖；预览中 54 个未匹配历史昵称仍需人工确认映射后才能执行正式导入，避免误并入当前 roster
- 2026-08-02 车队风采与车队阵容封面已恢复清晰显示：风采图片不透明度由 `0.9` 改为 `1`，侧卡继续使用 `0.72/0.3` 卡片透明度和 3D 位移保留景深；阵容卡移除降饱和/降亮度滤镜及覆盖整张照片的高光暗角伪元素，头像不透明度改为 `1`，侧卡仍由动态透明度、缩放和圆柱角度形成层次；新增 CSSOM 回归测试；当前头像原图主要为 `900×1200`，浏览器 390、1280 视口确认主卡无滤镜、无蒙版、页面级横向溢出为 0且控制台无新增错误；`npm run build` 通过，全量测试 234 项中 233 项通过，唯一失败为与本次纯 CSS 改动无关的既有触摸滑动暂停态断言；未留下新的封面清晰度功能风险
- 2026-08-02 已确认首次 Excel 导入与后续截图使用两套人员来源，并新增设计文档 `docs/superpowers/specs/2026-08-02-xingyu-score-members-import-design.md` 与实施计划 `docs/superpowers/plans/2026-08-02-xingyu-score-members-import-implementation.md`：`roster` 继续作为后台成员与截图识别候选，新增独立 `scoreMembers` 作为积分榜身份；首次导入完全以 Excel 昵称为准，不匹配或修改后台 roster；`ˣʸ༩·` 前缀后的名字一致即视为同一人；后续截图先匹配后台成员，再按去前缀后的名字累计到同一积分人物。本轮仅完成设计、实施计划与自检，尚未修改业务代码、运行数据导入或重复执行测试构建
- 2026-08-02 已修复队员阵容移动端拖拽与自动播放遮挡：触摸指针不再误触发桌面 hover 暂停，手指左右拖动可直接调整圆柱并在松手后缓慢回到基础速度；离正中最近的成员卡会唯一置顶，并按中心距离平滑前移、放大，人物经过中线时完整展开；成员图片禁用原生拖拽，点击详情和桌面 hover 保持不变。新增 2 条回归断言；`npm test -- --run` 通过 17 个测试文件、234 项测试，`npm run build` 通过；浏览器 `390x844` 验证拖动可切换居中成员、始终只有 1 张居中卡、页面横向溢出为 0、控制台无警告或错误；未留下新的功能风险
- 当前如有改动，先跑测试再看浏览器效果
- 2026-08-02 已修复微信等部分浏览器首页视频不加载时显示黑块：`Hero` 在视频真正触发 `playing` 前持续显示后台备用图，未配置备用图时使用内置 `/images/hero-home.png`，同时把该图片设为视频 `poster`；视频加载错误或自动播放被拒绝时继续回退图片。新增回归测试覆盖“播放前默认图可见、播放后显示视频”；`npm test -- --run` 通过 17 个测试文件、234 项测试，`npm run build` 通过；浏览器在 390/1280 视口确认无横向溢出，并通过阻断当前 MP4 请求确认自动切换默认图。部分旧内核若不支持视频编码仍可能不播放视频，但会稳定显示默认图，不再留下黑色方块。
- 2026-08-02 首页“队员数量”已改为直接使用后台统计数据手填值，不再按已配置成员卡数量覆盖；成员视频弹窗新增独立大尺寸样式，桌面最大宽度由 720px 提升至 960px，移动端收紧内边距并保持 16:9，其他弹窗尺寸不受影响。新增 2 项回归测试并完成红绿验证；`src/data/siteConfig.test.js` 14 项、`src/App.test.jsx` 52 项通过，`npm run build` 通过；浏览器以当前后台 34 人/25 张成员卡验证首页显示 34，1280x800 下视频画面宽 912px、390x844 下宽约 334px，两档页面横向溢出为 0且控制台无警告或错误；本次功能未留下新风险。全量测试当前 245 项中 242 项通过，另有 3 项 `scoreMembers` 并行未完成改动导致的既有失败（识别服务 2 项、API 1 项），与本次修改无关。
- 2026-08-02 已完成独立积分人物与首次真实 Excel 导入：新增 `scoreMembers`，公开排行榜、日期明细、在线积分、周末录入和普通 Excel 工具均改用积分人物，`roster` 继续只负责后台成员、阵容、媒体与截图候选；截图识别会先匹配 roster/别名，再按去除 `ˣʸ༩·` 前缀后的姓名续写既有积分身份，缺失时创建零期初积分人物。`legacyScoreWorkbook` 已完全取消 roster/别名匹配，KW27-KW31 跨周按归一化 Excel 姓名合并并采用最后一周原文；新增一次性原子导入脚本 `scripts/import-legacy-score-workbook.js`。真实附件已写入 `server/data/site-config.json`：78 个积分人物、25 个工作日/875 行、10 个周末日/350 行，共 1225 行，范围 `2026-06-29` 至 `2026-08-02`；导入前后 25 人 roster 深度一致，所有积分 ID 有效且归一化姓名唯一，备份位于 `server/data/site-config.json.bak`。并为同期新增的富文本 `Range` 测试补丁增加 Node 环境守卫，避免服务端测试加载浏览器全局。`npm test -- --run` 通过 19 个文件、261 项，`npm run build` 通过且 ExcelJS 仍为独立动态块；API/前端 3000/4173 返回 200，公开配置为 78 个积分人物与 25 张成员卡；浏览器 390x844、768x1024、1280x800 均无页面级横向溢出，弹窗完整且宽表仅内部滚动，2026-06-29 实际显示 34 行 Excel 姓名。剩余已知风险：移动端滚动到积分榜标题的特定位置时，既有固定音乐浮窗可能暂时覆盖“查找”按钮，继续滚动少许或关闭浮窗即可操作，本次未改其布局。
- 2026-08-02 新闻管理已升级为可折叠富文本编辑：已保存新闻默认收起并显示“标题 · 分类 · 日期”，新建新闻自动展开；首页封面图与正文图片分离，正文支持多图以及撤销/重做、标题层级、字体、字号、颜色、粗体、斜体、下划线、对齐、列表、链接和换行。新增可选 `bodyHtml`，旧 `body` 继续兼容；服务端保存和读取时用白名单净化 HTML、重建纯文本正文，只允许真实位于 `/uploads/` 或 `/images/` 下的图片路径，并拦截外链、Base64、脚本和路径穿越。前台继续使用原资讯弹窗，新增封面、导语、富文本、多图及长文滚动样式；后台通过动态导入独立加载，首页主 JS 由约 693 KB 降至 237 KB，后台代码块约 455 KB，ExcelJS 仍独立。`npm test -- --run` 通过 19 个文件、261 项测试，`npm run build` 通过；浏览器已验证 390x844 后台工具栏换行、新建/折叠、粗体和换行，前台 390x844、768x1024、1280x800 弹窗均无横向溢出且长文可滚动，控制台无警告或错误。新增风险仅为后台首次进入需按需下载约 455 KB 编辑器代码，公开首页不受影响。
- 2026-08-02 已修复后台新闻卡片编辑 ID 时意外折叠：根因为数组项 React `key` 使用了可编辑的 `item.id`，ID 一旦改变就触发组件重挂载并重置折叠状态为收起；现将 `ConfigEditor.jsx` 中 `ArrayItem` 的 key 从 `item?.id` 改为稳定的 `index`，编辑 ID、标题等字段时折叠/展开状态不再丢失。`npm test -- --run` 通过 19 个文件、267 项测试，`npm run build` 通过；未留下新的功能风险。

- 2026-08-02 积分编辑器新增日期筛选、独立队员管理与公开排行榜最新一天降序：`ScoreEditor.jsx` 积分明细标签页默认选中最新日期（合并工作日与周末取最大），仅显示当天行，可手动切换任意日期；新增「队员管理」标签页独立维护 `roster`（25 人），不展示 Excel 导入的 78 个 `scoreMembers`，支持增删改；`siteConfig.js` 公开排行榜仅取最新已导入日期的行，按分数从高到低（同分比胜场再比姓名）排序。`npm test -- --run` 通过 19 个文件、267 项测试，`npm run build` 通过且 ExcelJS 仍为独立动态块；`GET /api/config` 验证排行榜返回 24 行、分数 137→0 降序、仅含 roster 成员；未留下新的功能风险。

- 2026-08-02 已按用户四项需求修复积分榜与日期查询：①`projectScores` 取消周末"总分绝对覆盖"模型，改为累加式并并入 `dailyDetail`，10 个周末日期（含周六日）不再丢失、可在日历查询；②公开排行榜改为取最新已导入日期全部积分人物的累计总分、按分数从高到低取前 10，并在标题下方显示"截至 X月X日"；③日期积分查询弹窗默认定位到最新配置日期、日历翻页同步跟随，当日表格按总分倒序展示；④周末行无六局明细时以"—"占位保持表格对齐。`npm test -- --run` 通过 19 个文件、270 项测试，`npm run build` 通过且 ExcelJS 仍为独立动态块；API 重启后 `GET /api/config` 验证排行榜返回 10 行（504→174 降序）、`latestScoreDate` 为 `2026-08-02`、周末日期全部出现在 `dailyScores` 中；未留下新的功能风险。

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

- 2026-08-02 已完成公网部署（方案 C：cloudflared 内网穿透）：Node 以生产模式（node server/index.js）在 3000 端口同时提供前端页面、公开 API 与上传；cloudflared quick tunnel 把 127.0.0.1:3000 映射为公网 HTTPS 地址（形如 https://<随机>.trycloudflare.com），免备案、免域名、免服务器。cloudflared exe 位于 tools/（不入 Git），运维脚本为 scripts/start-tunnel.ps1（一键启动 Node + 隧道并打印公网地址）和 scripts/stop-tunnel.ps1（停止两者）。quick tunnel 随机子域名仅在 cloudflared 进程持续运行期间固定，重启笔记本或 cloudflared 后地址会变，需重新运行 start 脚本并通知访问者；该隧道无 SLA，宕机无影响符合本项目可接受范围。后台 /api/admin/* 会随站点一起暴露到公网，已由 auth.requireSession 保护，需确保 server/config/admin.local.json 的账号口令足够强

- 2026-08-02 已在应用层屏蔽公网对后台的访问：server/index.js 新增 isFromTunnel/blockTunnelAccess 中间件，识别 cf-ray/cf-connecting-ip/cf-visitor 等 Cloudflare 特征头，对 /api/login 与 /api/admin 一律返回 404；本机直连（无 cf 头）照常可用。公网经 cloudflared 隧道访问 /api/admin/config 与 /api/login 实测返回 404，而 /、/api/config 仍为 200；本机直连后台仍为 401 正常鉴权。新增 3 项回归测试覆盖「带 cf 头后台 404、无 cf 头后台 401、带 cf 头公开 API 200」，server/index.test.js 共 26 项通过。此改动仅重启 Node，cloudflared 未动，公网网址不变；管理员如需后台操作请在笔记本本机访问

- 2026-08-02 已从 cloudflared（海外节点）切换到 cpolar（国内节点）以降低公网延迟：cpolar exe 位于 tools/cpolar.exe（不入 Git），authtoken 存于 ~/.cpolar/cpolar.yml，以 -region=cn 连接国内节点；运维脚本 scripts/start-tunnel.ps1 和 stop-tunnel.ps1 已更新为启动/停止 cpolar+Node。当前公网地址 https://4512da3d.r6.cpolar.cn（HTTP），首页延迟从 cloudflared 的 ~1000ms 降到 ~85ms（10 倍提升）；cpolar 免费版对大数据有带宽限速（~1Mbps），153KB API 约 1.2s，128MB 首页视频仍是大文件瓶颈。后台屏蔽中间件同步改为 Host 白名单方式（server/index.js 的 isLocalHost/isFromTunnel）：非本地/局域网 Host 一律 404，兼容 cloudflared/cpolar/ngrok 等任意穿透服务；server/index.test.js 回归测试已更新为 Host 方式（26 项通过）。cloudflared 进程已停；临时补丁脚本已清理

- 2026-08-03 已继续完成公网访问性能收口：首页 128MB 视频保留原片、不压缩，改为显示备用封面并点击后才加载播放，视频使用 `preload="none"`；浏览器未点击时确认 `readyState=0`，移动端 375 宽无横向溢出。修复上轮误删的两个 Hero 视频测试体后，`npm test -- --run` 通过 19 个文件、270 项测试，`npm run build` 通过。`scripts/start-tunnel.ps1` 与 `scripts/stop-tunnel.ps1` 已补 UTF-8 BOM，Windows PowerShell 5 可直接执行；当前 cpolar 公网地址为 https://212c7c7a.r6.cpolar.cn，实测首页与 `/api/config` 为 200，公网 `/api/admin/config` 与 `/api/login` 为 404

- 2026-08-03 已修复真实 Excel 历史积分导入字段和总分口径：`legacyScoreWorkbook` 完整保留工作日的“得分/总分”、周六车队赛的“上周/积分/得分/总分”及周日车队赛的“积分/得分/总分”；`scoreLedger` 改为按周使用 Excel 当周最终“总分”，成员累计总分仅累加各周最终总分。后台周末录入、在线积分编辑与前台日期明细同步保留并展示这些字段。已从 `星屿杯积分明细NEW.xlsx` 原子重导运行时配置，共 79 个积分人物、25 个工作日、10 个周末日，最新有效日期为 2026-08-02；25 人 roster 哈希导入前后完全一致，旧配置保存在 `server/data/site-config.json.bak`。真实工作簿审计确认原始字段、周末字段、页面当周总分和成员累计总分均为 0 差异；`npm test -- --run` 通过 20 个文件、275 项测试，`npm run build` 通过；浏览器在 1280x800 与 390x844 验证排行榜、周六/周日车队赛表格及内部横向滚动，页面级横向溢出为 0。

- 2026-08-03 更正上一条积分口径：总分不是跨周累计，而是本周周一至当天的得分滚动和；每周一重置。周六得分为“积分-上周积分”、总分为周五总分加周六得分；周日得分为“积分-周六积分”、总分为周六总分加周日得分。Excel 原字段和值原样入库，前台排行榜和日期明细按最新日期的“总分”排序/展示，不再显示“累计总分”。截图识别补局会清除被修改工作日的旧导入得分/总分并重新派生，周末手动录入仍保留原始字段。重新导入 `星屿杯积分明细NEW.xlsx` 后仍为 79 个积分人物、25 个工作日、10 个周末日，最新日期 2026-08-02，roster 未变化；逐字段、周内总分审计均为 0 差异。`npm test -- --run` 通过 20 个文件、277 项测试，`npm run build` 通过；1280x800 与 390x844 浏览器验收通过，页面级横向溢出为 0。

- 2026-08-03 提交前审计已收口：周末输入改为本地日期和数值/null 存储；编辑或截图补录工作日时清除同成员本周后续旧总分；截图新数据用 null 区分空槽和真实 0 分，旧数字数组按全部槽位已占用处理以避免覆盖；普通 Excel 通过隐藏元数据无损往返工作日原始得分、总分和 null 空槽，修改赛局后会丢弃对应旧原始值；成员视频弹窗同时受视口宽高约束。`npm test -- --run` 通过 20 个文件、295 项测试，`npm run build` 通过；844x390 横屏实测弹窗完整位于视口内、视频保持 16:9、横向溢出为 0。

- 2026-08-03 已完成后台签名与周末积分需求：七个后台顶层区块默认收起并可独立手动展开；成员管理新增个性签名，成员视频弹窗仅在签名非空时于视频上方显示，移除名称/关闭按钮并保留空白处、Escape 关闭；周末录入和积分明细的周六/周日数值列均支持从大到小排序；积分明细日期并集包含周末，周末公式字段按“周六上周积分/积分/得分/总分、周日积分/得分/总分”派生且只读；Excel 周末工作表导出派生后的公式值。已将完成提交合并到 `codex/config-admin-excel`，移除已干净的临时工作树；保留带用户改动的旧 `config-admin` 工作树不动。`npm test -- --run` 通过 20 个文件、295 项测试，`npm run build` 通过，主工作树干净。

- 2026-08-04 已实现积分截图识别简化与本地识别：批次明确 `team`/`ranked`，AI 只输出 `{nickname, rank}`，后端确定性算分/去重/槽位/人物汇总，审核 UI 按人物折叠、异常默认展开、可修正或明确忽略后提交，可从识别历史恢复 ready 批次；API 为 127.0.0.1:3000。相关提交 `e782f6f`…`db4ff4a`、`02df5af`、`3000a17`
- 2026-08-04 已实现截图昵称汉字兜底匹配：`scoreRules.js` 的 `extractHanCharacters`（NFC + `\p{Script=Han}`）与 `buildMemberMatcher` 唯一汉字索引（至少 2 个 Unicode 码点、冲突置空、别名不入索引）；提交 `612c1b1`、`ed28e92`
- 2026-08-04 已扩展 `TEAM_PREFIX` 前缀正则（`xy` + 0-2 个乱码字符 + 分隔符），覆盖 `xyf`/`xy2`/`xy½`/`xy/`/`xy/2` 等 OCR 变体，纯英文成员 Q3/Rose/fafa 可自动匹配；真实数据未匹配从 29 次降到 11 次（其余为名单外路人）；全量 24 个测试文件 0 失败、构建通过；提交 `ef3bdbe`
- 2026-08-04 项目整理审计：存在一批未提交前端功能改动（来自并行会话，全量测试与构建均通过）——`ShinyText.jsx/css` 成员视频弹窗签名扫光、`VideoModal/PhotoModal` 关闭时释放视频资源（pause+清 src+load、preload=metadata）、`Roster`/`FeaturedMembers` 成员头像懒加载、`ConfigEditor` 保存前 signature 字符串归一化（防旧数据崩溃）、`App.jsx` 资讯上移至车队风采后；提交 `983356d`

- 2026-08-04 已验证重启后的 API 加载新匹配器：未识别率居高不下的根因是 3000 端口 node 进程自 17:58 启动、未加载 21:29-22:25 落盘的三个匹配修复（`612c1b1`/`ed28e92`/`ef3bdbe`）；重启 API（`npm run dev:api` 或 `npm run start`）后重新识图，最新批次 52 条证据 0 未识别、18 人全部匹配并已提交到 2026-08-03 积分；服务端代码改动后必须重启 node 进程才生效
- 2026-08-04 已完成后台三项功能与识别批次清理：① 识别批次索引与存储已清空（9 个旧批次、8 个存储目录移除；已提交积分保留在 `site-config.json`，识别历史从空开始）；② 识别页与识别历史新增“重新匹配”按钮，不重新调 AI，从已存 observations 用当前匹配/别名规则重算草稿；③ 后台登录页新增“记住密码”勾选（存 `localStorage['xingyu-admin-remember']`，下次访问自动填充并尝试自动登录，取消勾选即清除）；④ 截图识别新增“一张截图含多场比赛”开关（AI 提示词按多场逐场提取，跨截图重复场次按内容签名自动跳过、不计分、提示“已自动跳过 N 场重复比赛”，不影响提交）。全量 24 个测试文件 371 项通过，构建通过；API 3000 与前端 4173 正常，rematch 路由未登录返回 401。测试环境注意：本机 `vite.config.js` 因 esbuild 目录权限无法直接加载，需用 `node tmp/run-tests.mjs`（inline config + `node_modules/.tmp-react-setup.js` 提供全局 React）跑测试、`node tmp/run-build.mjs` 跑构建。②③④ 已提交 `8ea67c2`（①为运行时数据清理，不进入 Git）
- 2026-08-04 后台周末录入已改为实时跟随“队员管理”名单：`WeekendScoreEditor` 的成员列表改由 `config.roster` 驱动（登录获取新配置即刷新；队员管理增删改后同页切换即同步），每个队员按归一化昵称（`buildScoreMemberMatcher`，含 `ˣʸ༩·` 前缀剥离）解析到既有积分人物身份，缺失时按 `createScoreMemberId` 生成确定性 ID，首次填写时自动补建 `scoreMembers` 条目（满足 `weekendScores` 行必须引用已有积分人物的校验）；Excel 导入的历史非名单积分人物不再出现在周末录入表中，其数据仍保留在 `weekendScores` 并正常参与积分派生。前端排行榜已移除 Top-10 限制：`hydrateSiteData` 与 `Leaderboard` 不再 `slice(0, 10)`，首页积分榜显示最新积分日当天所有有分数的队员（seed 下 30 行）。`npm test` 24 个测试文件 373 项通过（触摸拖拽 `is-settling` 为既有偶发时序失败，重跑通过），`npm run build` 通过，前端 4173（preview 服务 dist）与 API 3000 正常。已提交 `edefe9c`（API 重启说明见提交 `b024e2e`）
- 2026-08-04 排行榜“仍只显示前 10”根因：服务端 `server/index.js` 的 `GET /api/config` 用同一 `src/data/siteConfig.js` 的 `hydrateSiteData` 预计算 `leaderboard`，代码已去 slice 但运行中的 node 进程（旧 PID 32868）内存仍是旧模块，重启后返回 21 项（最新积分日 2026-08-03 全部有分队员）。教训：改 `siteConfig.js` 后除前端刷新外，**必须重启 3000 的 API 进程**才会生效（前端 4173 页面数据来自 `/api/config`）。当前 API PID 47228（`node server/index.js`，非 dev，同时服务 dist）。改动已在提交 `edefe9c` 中，工作区干净

- 2026-08-05 截图识别准确率排查与修复（识图不准 >50% 的根因已定位）：识别走本地 Ollama（模型 xingyu-score-recognition，qwen2.5vl:7b，127.0.0.1:11434）。旧提示词要求“无法确认昵称的行直接忽略”，模型对模糊行直接丢行——实测 9 图批次中 06.jpg 漏掉第 4 名“美人书”，导致该场参赛人数按 5 人计、其余 5 人分数全部偏低 1 分且漏行者 0 分。本轮修复：① 提示词改为“必须列出每一行、名次连续、昵称原样抄写不删减、忽略时间/分数/攻击/防御/援助等其他列”（server/lib/scoreRecognitionAi.js）；② 队内赛参赛人数改为取该场最高可见名次，漏中间行时其余成员仍按正确人数计分（server/lib/scoreRecognitionDraft.js）；③ 名次不连续时预览新增非阻塞“疑似漏行”警告（src/admin/RecognitionEvidence.jsx）；④ 后台新增“重新识别”按钮，复用已上传截图重新调 AI 提取（src/admin/ScoreRecognition.jsx，调用既有 POST /batches/:id/process）。改进提示词实测 9 图全部完整提取、名次 1-6 连续；全量 24 个测试文件 378 项通过，node tmp/run-build.mjs 构建通过。已提交 `c3a100d`。注意：改 server/lib/*.js 后必须重启 3000 API 进程生效；Ollama 需保持运行否则识别失败；已提交的 2026-08-03 数据中受旧漏行影响的成员（干就完了/十二/纤云/初心/浪漫/美人书）建议人工核对；本轮已把 API 以 HOST=0.0.0.0 重启在 3000（同时服务 dist 页面与 API，后台 http://127.0.0.1:3000/admin），4173 的 vite preview 因 esbuild 目录权限无法在本会话启动，需用户终端执行 npm run preview 恢复

- 2026-08-05 截图去重改为“疑似重复 + 人工确认”，不再静默跳过：原逻辑按 日期::类型::归一化昵称:名次 整场签名自动丢弃重复场次，固定车队连打时“人员和名次完全一致但确为不同场次”会被误杀；用户确认加入时间位置/格式不固定、AI 提取判别字段不可靠，故改为批内签名碰撞时保留两场并打 suspectedDuplicateCount + suspected-duplicate 阻塞提交问题，预览中展示两场参与者对比，审核人点“确认是重复场次（跳过本场）”或“这是不同场次（两场都保留）”后重建草稿（server/lib/scoreRecognitionDraft.js、scoreRecognitionService.js、scoreRecognitionRoutes.js 的 review 接口新增 duplicate/notDuplicate 字段，src/admin/RecognitionEvidence.jsx 新增确认卡片与提示）。原则：可漏删、不可误删。全量 24 个测试文件 400 项通过，node tmp/run-build.mjs 构建通过；用真实 08-04 批次重算无新误报。API 已重启在 127.0.0.1:3000（PID 15836，node server/index.js --dev），前端 4173 vite dev 正常

- 2026-08-05 截图去重升级为自动化“数值签名”，人工确认仅作兜底：结算表实测列为 排名/玩家昵称/时间/MVP分/攻击/防御/援助，无地图名，加入时间格式不固定；MVP分/攻击/防御/援助为每场必变的整数列，qwen2.5vl 两次提取同图数值完全一致（如 01.jpg 赴约·太困 15/12）。实现：AI 提示词与 schema 新增可选 score/attack/defense/assist（看不清省略，score= MVP分列），scoreRecognitionDraft.js 的 `buildRaces` 透传数值，scoreRules.js 的 `buildDuplicateSignature` 纳入数值列并新增 hasRaceDiscriminator；去重规则改为——人员+名次+数值全部一致才自动跳过（autoDuplicate），人员名次相同但数值不同自动按不同场次保留（autoDistinct，预览显示“已按不同场次自动保留”提示），任一侧缺数值列才回落上一轮的“疑似重复 + 人工确认”。用真实 01.jpg 端到端验证：新提示词 5 行无回归，同内容同数值 duplicateCount=1、同内容异数值 autoDistinct=1。全量 24 个测试文件 409 项通过，构建通过。已提交 `20e73e6`（前一轮“疑似重复人工确认”提交 `95bcb16`）。

- 2026-08-05 新闻模块已实现二级页 + 分享 + 置顶 + 分类 Tab（设计 `docs/superpowers/specs/2026-08-05-xingyu-news-pages-share-design.md`，已实施）：新增 `src/components/NewsPage.jsx`（#news 列表页，按分类 Tab 切换，分类后台可增删）、`src/components/NewsDetailPage.jsx`（#news/<id> 独立详情页，分享按钮复制 `origin + pathname + #news/<id>` 链接）；首页 `NewsFeed` 只显示置顶新闻（不超过 5 条，无置顶时兜底最新 3 条）；`siteConfig.js` 新增 `newsCategories` 迁移与 `pinned` 归一化、`parseNewsDate/sortNewsByDateDesc/getHomeNews` 纯函数；`configStore.js` 校验 `newsCategories`（非空字符串、唯一）与 `news.pinned`；后台 `ConfigEditor` 支持新闻置顶开关与分类增删；`vite.config.js` 开启 `allowedHosts` 以支持局域网地址访问。全量 24 个测试文件 409 项通过，构建通过。提交 `9e3ff5a`
