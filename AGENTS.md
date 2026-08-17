# 星屿车队 H5 交接说明

当前项目根目录：`C:\Users\Admin\Documents\H5`

最后更新：2026-08-17

## 项目一句话
这是一个基于 Vite + React 的星屿车队移动端 H5，核心是首页展示、成员阵容、积分榜、资讯、相册和音乐浮窗。

## 当前结构
- 入口：`src/App.jsx`
- 默认数据：`src/data/teamData.js`；运行时配置：`server/data/site-config.json`
- 配置后台：`src/admin/ConfigEditor.jsx`、`src/admin/ScoreEditor.jsx`
- 积分派生与 Excel：`src/data/siteConfig.js`、`src/admin/scoreWorkbook.js`
- 主要模块：`Hero`、`StatsBar`、`FeaturedMembers`、`GalleryPreview`、`Roster`、`Leaderboard`、`NewsFeed`、`AlbumPage`、`MusicPlayer`
- 交互弹窗：成员视频、照片预览、资讯详情、积分详情
- 截图识别管线：`server/lib/scoreRecognitionStore.js`、`scoreRecognitionAi.js`、`scoreRecognitionService.js`、`scoreRecognitionRoutes.js`，后台入口为 `src/admin/ScoreRecognition.jsx`、`RecognitionHistory.jsx`、`WeekendScoreEditor.jsx`；Ollama 本地模型 `xingyu-score-recognition`（qwen2.5vl:7b）
- 身份与计分纯函数：`src/data/scoreRules.js`（`extractHanCharacters` 汉字提取、`buildMemberMatcher` 汉字兜底、计分/去重/槽位）

- 首屏品牌栏标题使用 `GradientText` 青蓝紫粉循环渐变，不再打字、删除或显示光标
- 首屏支持后台配置 `team.heroLines` 多句文案；后台按“第 N 句”独立编辑，前端每句独立成行
- slogan 行已移除
- 统计卡片保留 4 项，当前文案是 `车队排名`、`活跃排名`、`队员数量`、`单身贵族`
- `活跃排名` 已从 `3st` 修正为 `3rd`
- 首页四个统计格使用蓝、紫、青、玫红独立强调色，并加强数字与标签的显示层次
- 统计区外层紫色波浪框已移除，内部 4 个统计小框保留 `StarBorder`；积分榜使用普通列表容器
- 队员展示当前使用 `DomeGallery` 球形画廊：默认静止，仅支持鼠标/触摸拖拽旋转；成员卡片点击仍可打开详情
- 队员卡片点击仍可打开详情
- 轮播支持 hover 暂停、拖拽加速、松手后缓慢回到基础速度
- 车队风采轮播每 4 秒自动切换；系统开启“减少动态效果”时仍保持自动切换
- 相册仍保留 `文件夹 -> 照片` 的两级进入方式
- 项目文件已从 `技术标\.worktrees\xingyu-racing-club` 迁移到当前 `H5` 根目录
- 本地配置后台与 API 已实现，设计和实施记录见 `docs/superpowers/specs/2026-07-28-xingyu-config-admin-design.md`、`docs/superpowers/plans/2026-07-28-xingyu-config-admin-implementation.md`
- 星屿积分榜后台已采用独立 `scoreMembers` 的“按日期纵向明细 + 积分人物期初积分”模型，支持 Excel 式在线编辑、模板下载、`.xlsx` 导入预览确认和当前数据导出
- 原始配置保存积分人物、期初积分、日期、积分人物 ID、六局成绩及 Excel/周末原始的得分和总分；星期和首页排行榜在运行时派生，成员阵容继续独立使用 `roster`
- 公网部署架构已落地：GitHub Pages 只提供公开静态 H5，腾讯 COS/CDN 提供媒体和公开配置脚本，本机 Node `3000` 继续提供后台、上传与积分截图识别，本机 Ollama 继续提供 `xingyu-score-recognition`
- 公网构建通过 `VITE_PUBLIC_ONLY=true` 隐藏后台入口，并在应用启动前加载 `VITE_PUBLIC_CONFIG_SCRIPT_URL` 指向的 COS 配置脚本；公网前台不请求本机 `/api/config` 或 SSE，本地前台仍使用 API + SSE/focus 刷新
- 普通 Excel 中出现的日期整体覆盖、未出现的日期保留；KW27-KW31 旧周表通过 `scripts/import-legacy-score-workbook.js` 专用脚本导入
- 旧配置中的成员 `points` 会自动迁移为 `basePoints`，原运行时文件会保存为 `.bak`
- `Pit Wall / 车队维修区` 设计与实施记录保留在 `docs/superpowers/`，代码保留在独立 `codex/pit-wall-ui-redesign` 分支/工作树中；用户已于 2026-07-30 否决该新版，当前 `main` 继续使用原版 UI，不启用、不合并，也不加入永久主题切换
- 产品事实记录在 `PRODUCT.md`，当前原版视觉规则记录在 `DESIGN.md`
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
- 识别运行时目录 `server/data/score-recognition/` 已被 `.gitignore` 忽略，索引和原图均不得提交
- 截至 2026-08-17，识别队列为 `29 committed`、`10 discarded`、`4 ready`、`4 failed`、`1 processing`；其中 `processing` 批次自 2026-08-07 起未更新。不要直接删除批次或原图，应在后台逐条继续审核、重试或明确废弃
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

- 2026-08-05 新增一键公网启动脚本：start-public.bat（双击入口）与 scripts/start-public.ps1（自动启动配置 API 3000 + Vite 前台 4173 + cloudflared 快速隧道并打印可发微信群公网链接，未装 cloudflared 时回退纯局域网提示）；公网仍受 Host 白名单保护，后台仅限本机/局域网访问

- 2026-08-05 公网开放已落地（Cloudflare 快速隧道，无需公网 IP）：Tailscale Funnel 不可用（该账号 `tailscale cert` 返回 500、不支持签发 TLS 证书），改用本机已装的 cloudflared 官方快速隧道指向 Vite 4173；关键坑——Vite 默认 Host 校验会拦截隧道域名（403），`vite.config.js` 的 `server.allowedHosts: true` 已放行（随新闻提交 `9e3ff5a` 落地）。实测公网 `https://banner-heated-planners-reason.trycloudflare.com`（临时地址，重启会变）打开首页、`#news` 列表、`#news/1` 详情、分享按钮、`/api/config` 均正常，本地 `http://192.168.1.24:4173/` 保留；后台 `/api/login`、`/api/admin` 已有 Host 白名单拦截公网穿透域名，公网无法进后台。`scripts/start-public.ps1` 已升级 v2：未安装 cloudflared 时降级为“仅局域网可访问”提示并照常启动本地服务，脚本幂等（服务已在运行则跳过）、日志落 `%TEMP%\xingyu-public-logs`；重启后重新运行根目录 `start-public.bat` 即可获取新公网链接。全量 24 个测试文件 409 项通过，构建通过。提交 `679a6dd`（脚本 v2）、`d93c6c5`（脚本初版）
- 2026-08-05 已确认 OCR 昵称别名并提交 08-04 待确认批次：memberAliases 新增 {"value":"xy♂·书","memberId":"17"}（OCR 把“美人书”识别成去前缀后的“书”，配置别名后 rematch 即匹配到成员“美人书”）；批次 46f44934（2026-08-04 队内赛，53 条证据）重新匹配后 0 未匹配、已提交落盘到 2026-08-04 dailyScores（新增 3 个积分人物，行数 25→28）；该批中“美人书”第 4 局因当天 3 局已满被 member-limit 规则跳过（原 [6,5,5] 不变）。剩余待办批次：c0cec2ae/d226a8b7 为两份完全相同的 08-03 队内赛批次（53 条证据，别名已可解决其唯一未匹配项，是否提交需用户确认，避免与已提交 08-03 数据重复）；32758bb9（08-04 排位赛）含疑似重复+3 个未匹配昵称（萌宝/星书、/茶花）需人工审核；1c5ab504（08-05 队内赛）仅上传未识别。
- 2026-08-05 所有二级页面（相册 `#album`、资讯列表 `#news`、资讯详情 `#news/<id>`）顶部已复用首页 Hero 品牌栏模块：`欢迎来到星屿车队` 青蓝紫粉渐变动效随行，但按用户要求媒体区/视频不带入（`Hero` 新增 `showMedia` 开关，二级页传 `showMedia={false}`）；`App.jsx` 在二级路由 `<main>` 内先渲染 `<Hero team={siteData.team} showMedia={false} />`；`.album-shell` 顶部留白由 56px 改为 0 使品牌栏贴顶（顶部无留白），`.album-page` 增加 `padding-top: 10px` 小间隙避免品牌栏压到返回按钮/文字；无头 Chrome 实测 390/1280 下品牌栏 top=0、按钮距品牌栏底 10px、无横向溢出。新增回归测试覆盖相册/资讯/资讯详情三页 Hero 品牌栏均位于页面标题之前且无 `.hero-section` 媒体区；`src/App.test.jsx` 76 项通过。注意：另一并行会话正在将队员阵容改为 DomeGallery 布局并重置过 global.css，本条目相关两行 CSS 已重新落盘；未留下新的功能风险
- 2026-08-05 队员阵容已从圆柱滚动切换为 React Bits《DomeGallery》球形画廊（前端展示层，roster/数据/后台不变）：新增 `src/components/DomeGallery.jsx`（球体几何 24 段共 120 槽、`autoRotate` 持续自转、`pauseOnHover` 悬停暂停、`onTileSelect` 点击回调；拖拽由原生 pointerdown/move/up 实现，替换 useGesture 以兼容 jsdom 测试与真实 PointerEvent；自动旋转用 `performance.now()` 差值推进）和 `src/components/DomeGallery.css`（`touch-action: pan-y` 保留纵向滚动；`.item__image img` 补回 `width/height:100% + object-fit: cover`，修复照片以原图 1536×2048 显示只露左上角的旧问题；无头像成员占位卡重设计为深蓝“成员名牌”，显示去 `ˣʸ༩·` 前缀后的姓名并带首字水印）；`src/components/Roster.jsx` 改为渲染 `roster-dome` 容器并严格按提示词传入 `fit=0.7`、`minRadius=500`、`maxRadius=900`、`maxVerticalRotationDeg=8`、`segments=24`、`dragDampening=2.6`、`imageBorderRadius=14px`、`grayscale=false`、`autoRotate=6deg/s`、`pauseOnHover`；`global.css` 的 `.roster-section .roster-dome` 改为 `height: clamp(480px,72vw,640px)`、`border-radius: 24px`、深蓝背景 `#0d1428`（与 `overlayBlurColor` 同色，形成参考效果的“暗场球体”）；`App.jsx` 向 Roster 传入 `paused={selectedMember !== null}`（弹窗打开时暂停自转）；已卸载不再使用的 `@use-gesture/react`。保留既有交互：持续自转、桌面悬停暂停（React 19 的 onPointerEnter 走原生 pointerover/pointerout，真实鼠标实测生效）、鼠标/触屏拖拽带惯性、点击卡片打开成员详情弹窗。全量 `npm test -- --run` 通过 24 个测试文件 417 项，`npm run build` 通过且 ExcelJS 仍为独立动态块；无头 Chrome 实测：390 视口 radius=500、可见卡 62 张、中位 78px（首版仅 44px），1280 视口 radius=784、可见卡 120 张、中位 112px，三档视口（390/768/1280）页面级横向溢出均为 0，自转约 6°/s、悬停停转/离开恢复、拖拽生效、点击卡片弹出成员详情弹窗；截图见 `output/roster-dome-v4-390.png` 与 `output/roster-dome-v4-1280.png`。注意：成员素材尚未补齐（当前运行时 43 名成员中 25 人有头像），无头像成员在球面显示深蓝名牌占位卡；球体为暗色块，若用户希望保持浅色页面风格可把 `overlayBlurColor` 与 `.roster-dome` 背景改回浅色；该改动仅涉及前台展示层，未提交未建分支

- 2026-08-05 队员阵容 DomeGallery 已按用户第四轮反馈改为完全遵循提示词动效（球体静止、仅拖拽驱动）：移除 `autoRotate` 自动旋转与 `pauseOnHover` 悬停暂停（含相关 effect/hoveredRef 与 Roster/App 的 paused 传参）；`main.sphere-main` 的 `touch-action` 由 `pan-y` 改为 `none`，移动端手指在框内上滑不再滚动页面而是旋转球；卡片槽位 `sizeX/sizeY` 由 2×2 改为 3×3、`.item__image` 内边距由 10px 收紧到 6px 使卡片更大（390 视口可见卡最大 203px/中位 122px，上轮中位 78px）；`.item__image img` 的 `object-fit` 由 `cover` 改为 `contain`，整张照片按比例缩小不裁切人物，深蓝卡片底色承接留白；`.overlay` 改为显式 `circle` 圆形暗角（55% 透明→68% 半透明→92% 全暗）使四角暗化、球形轮廓更明显；拖拽阻尼按提示词 `dragDampening=2.6`（内部 clamp 到 1=最小阻尼、惯性滑行最长），并新增 `setPointerCapture` 防止拖出容器丢指针。Roster 继续传入 `fit=0.7`、`minRadius=500`、`maxRadius=900`、`overlayBlurColor=#0d1428`、`maxVerticalRotationDeg=8`、`segments=24`、`dragDampening=2.6`、`imageBorderRadius=30px`、`grayscale=false`。`src/App.test.jsx` 中 dome 相关 5 个用例改写为“静止/拖拽”断言，定向 76 项全过；全量 `npm test -- --run` 通过 24 个文件 417 项，`npm run build` 通过且 ExcelJS 仍独立动态块；无头 Chrome 实测 390/1280：radius 500/784、touch-action none、object-fit contain、静止 1.2s 旋转 delta=0、拖拽后旋转 +8.45° 且松手 900ms 后惯性继续至 +12.02°、页面横向溢出 0；像素分析确认四角暗角亮度 20-31（中部卡片 51-108）；截图见 `output/roster-dome-v5-390.png` 与 `output/roster-dome-v5-1280.png`。注意：无头像成员仍显示深蓝名牌占位卡（不新增视觉素材），球体为暗场风格；该改动仅前台展示层，未提交未建分支


- 2026-08-05 队员阵容 DomeGallery 第五轮反馈修复（白色蒙版突兀 + 卡片断头断脚/拼接）：① 蒙版根因是 `.overlay` 在前一轮被压成 0×0 静态元素，暗角实际未渲染；现恢复 `position:absolute; inset:0; z-index:3; pointer-events:none`，径向渐变改为深蓝 `rgba(13,20,40,…)`（62% 透明→82% 淡 0.22→四角 0.6）只压暗四角，移除白色大范围渐变、`.overlay--blur` 边缘模糊层与两个 `.edge-fade` 元素；② 断头断脚根因是 3×3 交错网格在球面产生大量重叠（旧 250 组）；`buildItems` 改为 2×2 段、15° 均匀网格（24 列×5 行=120 槽），`.item` 变换去掉 `(size-1)/2` 偏移项，列中心对称落在 ±7.5°/±22.5°、行中心落在 0/±15°/±30°，球心与首排卡片垂直完全居中（此前整体偏左下约 33px）；③ 移除 `.stage` 的 `contain: layout paint size`（下半球卡片不渲染的根因）并将 `.stage` 改为 `position:absolute; inset:0`。验证：无头 Chrome 390/1280 页面级横向溢出均为 0；`elementFromPoint` 逐点命中测试确认前端绘制卡片互不遮挡（390 全 0，1280 仅 ±37° 以远边缘列存在球面曲率导致的正常前后遮挡）；`object-fit: contain` 保证整张 900×1200 人像按比例完整显示不裁切；touch-action none、拖拽旋转（0→+8.29°）、静止不自转不变；全量 `npm test -- --run` 通过 24 个测试文件 417 项，`npm run build` 通过且 ExcelJS 仍独立动态块；截图见 `output/roster-dome-v10-390.jpg` 与 `output/roster-dome-v10-1280.jpg`。注意：`.item__image img,.item__placeholder` 组合规则的内部换行必须保持 LF（jsdom CSSOM 断言依赖），文件其余部分为 CRLF；该改动仅前台展示层，未提交未建分支

- 2026-08-05 已按用户确认的严格规则修复截图去重与积分身份：上传时为每张原图保存 SHA-256，并用 32×32 灰度采样比较画面；字节或画面完全相同的图片在 AI 前自动跳过，近似图片生成 `suspected-duplicate-image` 阻塞项并要求审核人查看两张原图后确认。`roster` 新增永久 `scoreMemberId`，后台“成员管理”可选择已有积分人物且已占用选项对其他成员禁用；识别草稿只接受有效绑定，未绑定生成 `unlinked-score-member` 并阻止提交，服务端不再自动创建积分人物。真实配置 25 位成员已全部唯一绑定到现有 87 位积分人物。公开 H5 同时关闭浏览器滚动恢复，并在首页、相册、资讯列表、资讯详情初次加载和路由切换时回到顶部。`npm test -- --run` 通过 25 个文件、431 项测试，`npm run build` 通过；API 已重启在 `127.0.0.1:3000`，浏览器验证 390/1280 无横向溢出、25 个绑定均有效唯一、已占用选项禁用、首页刷新及进入 `#album`/`#news` 后 `scrollY=0`，控制台无警告或错误。
- 2026-08-06 已修复“香波岛/广寒仙境两张不同地图被识别为同一场”：根因是 AI 提示词忽略地图、去重签名无地图维度。现在 `server/lib/scoreRecognitionAi.js` 的 schema 与提示词强制提取结算表标题区地图名 `mapName`（required、minLength 1，`validateMatch` 拒绝非字符串），本地模型实测稳定返回；`server/lib/scoreRecognitionDraft.js` 按地图分组判重——地图不同直接视为不同场次，同地图才按数值列自动去重/自动保留，任一场缺地图则保守转人工确认；`server/lib/scoreRecognitionService.js` 对指纹疑似重复的两张图，若可靠地图不同则自动放行（`autoDistinctImageCount`）不再阻塞；后台 `src/admin/RecognitionEvidence.jsx` 在依据行、异常编辑器和疑似场次对比中展示地图名，并提示“地图不同已自动放行”。真实批次 `077b5d6e` 的 10.jpg/11.jpg 用新管线端到端验证：识别为香波岛/广寒仙境，`suspected-duplicate-image` 阻塞消除。`npm test -- --run` 通过 25 个文件、447 项测试，`npm run build` 通过；API 已重启在 `127.0.0.1:3000`。注意：旧批次 observations 仍是无地图的旧识别结果，需在后台对该批次重新执行“截图识别”处理，才会按新逻辑重算。
- 2026-08-06 已修复“星星火车站 Rose 名次识别成 3（实际第 2）”：根因是 `server/lib/scoreRecognitionImage.js` 的 `MAX_IMAGE_EDGE=2048` 会把 2781×1280 结算截图压到约 942 高，本地 qwen2.5vl 对小字昵称识别错误（实测把 Rose 读成星屿并幻觉出多个“星屿”变体）；放宽到 4096 后该尺寸截图不再压缩，绕过压缩直发原图与放大图均稳定识别为 猫猫1/Rose2/姜姜姜酱3/白榆4，原管线结果复现 rank2=星屿。同步修复 `scoreRecognitionService.js` previewBatch 重新识别时用空对象覆盖 `reviews`/`imageReviews` 的问题（改为保留已有记录），新增 2 项回归测试（2781 不压缩、重识别保留 reviews）。批次 `e29c4913`（2026-08-05，14 图）已用新代码重新识别：img11 星星火车站 Rose=第 2 名并自动匹配积分人物 18（ˣʸ༩·Rose，+3 分第 1 局）；img12 广寒仙境 Rose=1；img13 地图由旧识别的“星屿”变为“聆风镇”（模型波动，需留意）；img9/10 的 `.fafa` 两行人工匹配（积分人物 17）已恢复；img3 的 `xyp♂·星屿` 行仍 unmatched 待后台人工确认；`npm test -- --run` 通过 25 个文件、449 项，`npm run build` 通过；API 已重启在 `127.0.0.1:3000`。注意：提高上限后单张识别耗时略有增加（14 张约 34-56 秒），识别更准。

- 2026-08-06 已修复“后台-相册管理无法新增相册和照片”：根因是前端新增相册/照片/资讯用 crypto.randomUUID() 生成 ID，而该 API 仅在安全上下文可用；后台通过局域网 http://192.168.1.24:4173/admin（HTTP 非安全上下文）访问时 crypto.randomUUID 为 undefined，点击“新增”直接抛错。src/admin/ConfigEditor.jsx 新增 newId() 兜底：crypto.randomUUID 可用时优先使用，不可用时回退 Date.now().toString(36)-Math.random().toString(36).slice(2,10)（相册/照片/资讯共用一个入口，一次修复全部生效；成员 ID 走 nextMemberId 不受影响）。新增回归测试模拟局域网环境（vi.stubGlobal 移除 crypto.randomUUID）验证新增相册与相册内新增照片均正常；npm test -- --run 通过 25 个测试文件、450 项测试，npm run build 通过；无头 Chrome 经 CDP 在真实局域网源 http://192.168.1.24:4173/admin 端到端验证：登录后台、展开相册管理、新增相册成功（新相册 ID 为兜底格式非 UUID）、相册内新增照片成功，线上配置未改动；期间发现 Vite 4173 服务已退出，已按 scripts/start-public.ps1 同参数重启（node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 4173，日志落 %TEMP%\xingyu-public-logs），当前 API 3000 与前台 4173 均返回 200

- 2026-08-06 已修复“配置校验失败 albums[0].photos[2].alt must be a non-empty string”（添加相册/照片保存报错）：根因是后台新增照片模板默认 alt 为空字符串，而服务端 configStore 校验要求照片的 src/title/date/alt 全部非空，用户不填“替代文本”即保存失败。alt 在前端公开页无实际消费（AlbumPage/GalleryPreview 的 img alt 均硬编码空串，PhotoModal 空 alt 也合法），属纯可选元数据。server/lib/configStore.js 已将照片 alt 改为可选：允许空串与缺省，仅拒绝非字符串（src/title/date 仍要求非空）；server/lib/configStore.test.js 同步更新非法用例为非字符串 alt 并新增“空 alt 照片可正常保存”正向回归测试。npm test -- --run 通过 25 个测试文件、451 项测试，npm run build 通过；用真实 configStore 模块以临时数据目录端到端验证：向相册 0 追加空 alt 照片后 write 成功；API 已重启在 127.0.0.1:3000（新校验生效），前台 4173 正常，后台刷新后重新保存即可
- 2026-08-06 已按用户要求调整首页个人视频播放弹窗：点击“车队风采/队员阵容”成员卡片弹出的个人高光视频弹窗改为从屏幕顶部显示（.video-modal-backdrop 增加 place-items: start center，不再垂直居中）；随后按“视频完全置顶、白色框连带个性签名移到视频下方”的要求，VideoModal.jsx 渲染顺序改为视频/备用图在前、个性签名框在后，签名条位于视频下方的白色区域。同步更新 src/App.test.jsx 中签名与视频的文档位置断言（签名改为在视频之后）；npm test -- --run 通过 25 个测试文件、451 项测试，npm run build 通过；前台 4173 已热更新，刷新页面点击成员卡片即可预览。

- 2026-08-06 已按用户选定方案 B 修复相册封面裁切人物头部：相册页文件夹封面卡片为 4:3 横版 + object-fit: cover，而 4 个封面均为 3:4 竖图，cover 只显示图片中间带、头部被切。src/styles/global.css 已给 .album-folder img 与 .album-photo img（相册内照片缩略图同规律）增加 object-position: top，可见区域锚定图片上部、头部完整保留（底部被裁为预期取舍）。新增 CSSOM 回归断言（globalStyles 正则匹配两处 object-position: top）；npm test -- --run 通过 25 个测试文件、452 项测试，npm run build 通过；无头 Chrome 桌面 1280 与移动 390 实测：4 个文件夹封面均生效 object-position 50% 0%、相册内竖图缩略图同规则、页面级横向溢出为 0；本次仅前台 CSS，API 无需重启

- 2026-08-07 已收口并准备提交上一轮未提交改动：截图识别新增原图 SHA-256/32×32 灰度指纹、疑似重复图片人工审核和地图维度自动放行；成员阵容新增永久 `scoreMemberId` 绑定、积分人物删除/引用保护与顺序重编号脚本；重新识别保留人工审核记录，结算图识别上限放宽到 4096；后台局域网新增 ID 兜底、空 alt 相册照片可保存、积分人物绑定选择器；公开前台新增滚动回顶、DomeGallery 触摸拖拽兼容、成员视频弹窗置顶和相册封面顶部锚定。新增 COS/CDN 媒体与上线前配置重置设计及实施计划，但尚未开始实施，仍需用户明确授权并提供云端准备信息。补充了运行日志与临时识别目录的 Git 忽略规则，并修正两处重复图片判定边界；最终验证 `npm test -- --run` 通过 25 个测试文件、455 项测试，`npm run build` 通过。

- 2026-08-07 已完成“部署收口包”：截图识别明确保持依赖运行项目的 Windows 电脑与本机 Ollama `xingyu-score-recognition`，不迁移云端；生产启动统一为 `npm run build` 后由 `node server/index.js` 绑定 `0.0.0.0:3000` 同时提供前台、静态资源和 API，Cloudflare quick tunnel 只转发到 `127.0.0.1:3000`，Vite `4173` 仅供开发；`start-public.ps1` 增加生产绑定与就绪检查，`stop-tunnel.ps1` 统一停止 3000/4173/cloudflared。依赖审计已修复高危 `brace-expansion`，生产审计仅剩 ExcelJS 间接依赖 `uuid` 的 2 个中危项，不使用会降级 ExcelJS 的 `npm audit fix --force`。

- 2026-08-07 部署前完整私有备份位于 `output/deployment-backups/20260807-110721`，包含 `.env`、本地管理员配置、站点/积分配置、识别索引与原图、上传媒体及依赖锁文件；`manifest.json` 共 296 个文件，已逐文件重算字节数与 SHA-256，296/296 通过。识别队列已收口为 10 个 `committed` + 10 个 `discarded`，0 个 `ready/uploaded/failed`；重复、非结算表和无效图片均保留审计证据而不写入积分。最终 `npm test -- --run` 通过 25 个文件、456 项测试，`npm run build` 通过；本机 `/`、`/api/config`、`/admin` 返回 200，公网 `/`、`/api/config` 返回 200，公网 `/api/login`、`/api/admin/config` 返回 404。

- 2026-08-07 首次生产截图识别出现 `第 1 张截图识别失败：Connection error.`，根因是 Node 正常但本机 Ollama 未启动。已启动 `127.0.0.1:11434`并实测 `xingyu-score-recognition` 推理成功；失败批次 `ce5362aa` 已重试并处理 15 张图，人工按原图修正安忆/浪漫/fafa，忽略未在名单内的“暮”/“橘絮”，最终 19 人的 2026-08-06 队内赛积分已提交，批次状态为 `committed`。`start-public.ps1` 已增加 Ollama 自动启动、端口就绪和模型存在性检查，避免电脑重启后再次出现同类连接失败。

- 2026-08-07 已补齐截图识别纠错闭环：AI 提示词会识别并过滤重复出现的车队归属标签，后台支持按单张截图重新识别、按比赛人工补录漏识别成员并删除补录项，服务端同步校验截图/场次、名次唯一性和积分人物有效性；重新识别会清理该图旧审核及人工补录，避免残留错误。首页 Hero 视频改为用户点击后带声音播放，播放期间自动暂停背景音乐，再点视频可暂停；默认 Hero 与失败备用图改用非真人 `/images/album/placeholder-01.jpg`，并删除仓库中的 9 MB 真人合照 `public/images/hero-home.png`，`PRODUCT.md` 已同步素材说明。最终 `npm test -- --run` 通过 25 个测试文件、470 项测试，`npm run build` 通过；生产服务 `/`、`/api/config`、`/admin` 均返回 200，浏览器 390/1280 视口无页面级横向溢出，视频/音乐互斥生效且控制台无警告或错误。
- 2026-08-08 已完成 COS/CDN 公网前端部署链路：新增 `server/lib/cosStorage.js`、`mediaMigration.js`、`mediaVariants.js`、`publicConfigPublisher.js`，后台上传可写入 COS 并生成公开媒体 URL；站点配置保存后可同步发布 `config/site-config.js`；GitHub Actions 工作流位于 `.github/workflows/deploy-pages.yml`，构建时使用 `VITE_PUBLIC_ONLY=true`、`VITE_PUBLIC_CONFIG_SCRIPT_URL`，公开页面不包含后台入口。`.env.example` 已补充 COS 与公网配置变量，`docs/github-pages-deploy.md` 已补充 GitHub Pages、COS/CDN、本机后台和自定义域名说明。COS 未配置时本地开发仍保留本地存储回退。

- 2026-08-08 已修复公网配置首次加载时的首屏竞态：`src/main.jsx` 继续按 `VITE_PUBLIC_ONLY` 选择公开前台，`src/hooks/useSiteConfig.js` 在公网构建中读取 `window.__XINGYU_PUBLIC_CONFIG_SCRIPT_URL__`/`VITE_PUBLIC_CONFIG_SCRIPT_URL`，`vite.config.js` 会把公开配置脚本注入 HTML `head`，因此 React 首次渲染前即可拿到最新配置；公网模式不建立本机 SSE，配置脚本使用时间戳避免缓存。

- 2026-08-08 当前主分支为 `main`，HEAD 为 `97efe42`（`fix: ensure roster portraits load in mobile webviews`），其父提交 `50c6ee2` 为公网配置首屏加载修复；`main` 当前领先 `origin/main` 1 个提交。本轮验证：`npm test -- --run` 通过 30 个测试文件、486 项测试；`npm run build` 通过（主前台 JS gzip 122.58 kB，后台和 ExcelJS 仍为独立 chunk）。

- 2026-08-08 已提交移动 WebView 图片加载修复（`97efe42`）：`src/components/DomeGallery.jsx` 将成员头像从 `loading="lazy"` 改为 `loading="eager"`，避免经过 3D transform 的图片在部分移动 WebView 中不加载；`src/App.test.jsx` 已同步回归断言。该改动已包含在上述 486 项测试和构建中。

- 2026-08-08 微信拦截申诉验证文件已部署并推送，提交为 `6465f59`：`public/89f36bc3e512795deb62700c7e42d531.txt` 内容为微信指定校验串。GitHub Pages 项目地址 `/xingyu-racing-club/89f36bc3e512795deb62700c7e42d531.txt` 已实测 HTTP 200 且内容正确；`wodelaodashicfer.github.io` 域名根目录同名文件仍为 404。若微信按项目路径校验可直接提交；若强制按域名根目录校验，需要绑定独立域名或建立 `wodelaodashicfer.github.io` 用户主页仓库后重新部署文件。

- 2026-08-08 微信实际点击“开始验证”后返回“校验失败，请按要求部署文件及内容”，已确认是上述根目录/项目子路径不匹配，而非 TXT 文件内容错误。当前可行路径：先用“仅提交证明材料”申诉；或提供一个可控制的独立域名，绑定到 GitHub Pages 后把验证文件放在该域名根目录，再重新验证。
- 2026-08-08 已完成媒体变体（media variants）系统：后台上传图片时自动生成三档 WebP 变体（缩略图 thumb 480px、卡片 card 960px、展示 display 1920px），上传视频时通过 ffmpeg 转码为 720p H.264 MP4 并截取中间帧 WebP 海报；`server/lib/mediaVariants.js` 从单变体改为多变体工厂，新增 `server/lib/videoVariants.js`（依赖 `ffmpeg-static`/`ffprobe-static`），`server/index.js` 上传/列表/删除路由同步管理多变体 COS 键，`server/lib/configStore.js` 增加对 originalSrc/posterSrc/thumbSrc/cardSrc 及尺寸时长等可选媒体字段的校验。前端各展示面按场景消费最合适变体：`Roster` 用 avatarThumb、`FeaturedMembers`（DomeGallery）用 avatarCard、`GalleryPreview` 用 cardSrc、`AlbumPage` 用 thumbSrc/coverThumbSrc、`Hero` 视频用 posterSrc 做封面；`Hero`/`VideoModal`/`PhotoModal` 新增查看原图/在线播放原视频外链。后台 `ConfigEditor.jsx` 新增 `applyUploadResult` 将变体写入对应配置字段，`hiddenMediaFields` 在树编辑器中隐藏内部变体字段；`UploadField` 显示原始文件名。截图识别同步优化：AI 提示词补充昵称看不清时不车队标签代替，`scoreRecognitionDraft` 将车队归属标签识别为 `team-label` 而非 `unmatched`，`ScoreRecognition` 错误提示移到预览顶部。新增依赖 `ffmpeg-static@5.3.0`、`ffprobe-static@3.1.0`（仅服务端，不影响前台 bundle）。最终 `npm test -- --run` 通过 31 个测试文件、500 项测试，`npm run build` 通过（前台 JS gzip 123.78 kB，ExcelJS 仍独立）；未留下新的功能风险。

- 2026-08-08 用户提出候选域名 `黄石和园建材.中国`（ASCII/Punycode：`xn--0tr48cxwl51iluvqh7c.xn--fiqs8s`）。当前主域名没有 DNS 解析；`media.` 子域名已有腾讯云 CDN 解析但 HTTPS 证书不匹配。若采用该域名作为公网 H5，应先在 DNS 设置 GitHub Pages 指向（主域名使用 GitHub Pages 要求的 A/ALIAS，或使用 `www` 子域名 CNAME），再在仓库配置 `public/CNAME`、生产构建使用根路径 `/`，确认 HTTPS 后重新验证微信 TXT 文件。

- 2026-08-08 已修复截图识别单张失败拖累全批的问题：`previewBatch` 改为逐张容错，单张识别失败时收集到 `imageErrors` 并继续处理其余截图，至少一张成功即保存部分结果（批次状态 `ready`），全部失败才抛出 422；前端 `ScoreRecognition` 预览区新增黄色警告条提示哪些截图失败并可重试。新增 2 项服务测试（部分成功 + 全部失败）并更新 1 项 API 集成测试；`npm test -- --run` 通过 31 个测试文件、501 项测试，`npm run build` 通过。
- 2026-08-08 积分榜已改为显示全部积分人物（含零分）：`hydrateSiteData` 的排行榜来源从仅当周有成绩的 `weekMembers` 改为全部 `scoreMembers`，同时保留 `totals` 中有成绩但已不在名单的已离开成员；零分成员以 0 分排在末尾。更新 3 条受影响测试断言；`npm test -- --run` 通过 31 个测试文件、501 项测试，`npm run build` 通过。
- 2026-08-08 首页视频已补做 720p 省流版：原片 2560×1180、134MB，上传时因媒体变体系统尚未上线而只存了原始文件。现已用 FFmpeg 转码为 720p H.264 + AAC（带 `+faststart`）、19.8MB（减小 85%），并截取中间帧 WebP 海报，两者均已上传到 COS（`/videos/...--720p.mp4` 和 `/posters/...--poster.webp`）；`site-config.json` 的 `heroMedia.src` 已从 `/originals/` 更新为 `/videos/...--720p.mp4`，API 和 CDN 均确认可访问且支持 byte-range。此后后台重新上传视频会自动生成省流版。

## 当前交接重点
- 公网 H5：GitHub Actions 发布静态前台；媒体与配置脚本依赖 COS/CDN；具体变量见 `.env.example`，发布说明见 `docs/github-pages-deploy.md`。
- 本机后台：`http://127.0.0.1:3000/admin`；公网前台不能访问本机后台 API。截图识别必须在这台 Windows 电脑上运行 Node 服务和 Ollama 模型 `xingyu-score-recognition`。
- 微信域名验证：微信要求在公网域名根目录放置指定 TXT 文件并能通过 HTTPS 直接访问；局域网 `192.168.x.x`、`localhost` 或仅 GitHub Actions 构建目录不能完成该验证。
- 数据安全：`.env`、`server/config/admin.local.json`、运行时 `server/data/site-config.json`、上传媒体和识别原图均不可提交；部署前私有备份位于 `output/deployment-backups/20260807-110721`。
- 识别队列：截至 2026-08-17 为 `29 committed`、`10 discarded`、`4 ready`、`4 failed`、`1 processing`；`processing` 批次自 2026-08-07 起未更新。保留批次和原图作为审计证据，在后台逐条继续审核、重试或明确废弃。
- Pit Wall：仅保留在独立 `codex/pit-wall-ui-redesign` 分支/工作树，当前原版 `main` 不启用，也不添加永久主题切换。

## 继续工作前的核对顺序
1. 先查看 `git status --short --branch`；`main` 已包含 `4381621 fix: keep pinned news first on news page`，以及 2026-08-17 收口的新闻隐藏、审核页显式新增积分人物、上传期间禁止保存、积分表人数显示和本地服务启动脚本，工作区应为干净状态。
2. 修改前先运行 `npm test -- --run`；涉及前台布局或媒体时，再运行 `npm run build` 并做 390/768/1280 视口检查。
3. 需要更新公网内容时，在本机后台保存配置并确认 COS 配置脚本时间戳/内容已更新；不直接编辑 GitHub Pages 产物。
4. 需要截图识别时，先确认 `127.0.0.1:3000` 和 `127.0.0.1:11434` 可用，并确认 Ollama 模型存在。

## 2026-08-09 媒体流与公网发布交接

- 二级媒体预览统一使用 `src/components/MediaStreamViewer.jsx`：入口包括相册文件夹照片/视频流、首页精选照片预览和队员个人视频流；旧 `PhotoModal.jsx`、`VideoModal.jsx` 已删除。
- 竖屏图片和视频统一按比例 `contain` 完整显示，不拉伸、不强行铺满；横屏图片提供“全屏查看”，横屏视频提供“横屏播放”，进入全屏时使用原始媒体比例。
- 媒体流滑到最后一项后继续向下滑会回到第 1 项，形成循环播放；视频切换时必须释放旧资源并保持首项可自动播放，避免 React StrictMode 下误清空 `src`。
- 2026-08-09 已修复成员视频从末项循环到首项时闪烁 1-2 秒的问题：根因为第一条克隆视频刚进入视口便在下一动画帧强制重置滚动位置，导致移动端惯性滚动期间两个视频节点连续暂停/播放；现改为滚动停止 120ms 后再无动画归位，继续滚动或关闭弹窗会取消待执行重置。`src/App.test.jsx` 已增加视频首尾循环回归，390×844 浏览器分别从“车队风采”和“队员阵容”入口验证克隆页先稳定播放、归位后首项继续播放，控制台无新增警告或错误。
- 队员风采和队员阵容二级页面昵称必须显示为 `@昵称`（例如 `@Q3`、`@稳稳`）；个性签名继续使用持续扫光效果，不得删除或改回静态文本。
- 相册视频播放地址优先使用 COS 上的 H.264/AAC 720p 版本：`/videos/fdd27e26-cff6-423b-94cf-a5945745475e--网站首页视频--720p.mp4`；原始 H.265 文件仅作为“原视频链接”保留。后台后续上传视频由媒体变体系统自动生成省流版和海报。
- 本轮验证：`npm test -- --run` 通过 31 个测试文件、506 项测试；`npm run build` 通过；`git diff --check` 通过；390×844 浏览器验证包含竖图完整显示、横图全屏入口、视频可播放、末尾回到首项、昵称 `@` 前缀、签名扫光及无横向溢出。
- 公网发布继续采用 GitHub Pages 静态前台 + 腾讯 COS/CDN 媒体和公开配置脚本；仓库当前归属已重定向为 `xingyuclub/xingyu-racing-club`，推送 `main` 后由 `.github/workflows/deploy-pages.yml` 部署，实际地址为 `https://xingyuclub.github.io/xingyu-racing-club/`。公网前台不得依赖本机 `/api/config`。
- 本机后台仍为 `http://127.0.0.1:3000/admin`，截图识别依赖本机 Ollama 模型 `xingyu-score-recognition`（`127.0.0.1:11434`）；修改服务端或配置加载代码后需重启 Node 服务。
- 发布和提交前禁止纳入 `.env`、`server/config/admin.local.json`、`server/data/site-config.json`、本地上传媒体、识别原图及运行时索引；配置与媒体应通过后台/COS 发布链路更新。

## 2026-08-09 GitHub 组织与 Pages 地址迁移交接

- 已创建 GitHub 免费组织 `xingyuclub`，并将仓库从 `wodelaodashicfer/xingyu-racing-club` 迁移到 `xingyuclub/xingyu-racing-club`；默认分支仍为 `main`，仓库名称和 Pages 项目路径不变。
- 新 GitHub Pages 正式地址为 `https://xingyuclub.github.io/xingyu-racing-club/`；旧仓库地址由 GitHub 重定向到新仓库，但旧 Pages 地址不得继续作为正式分享地址。
- 本地 `origin` 已更新为 `https://github.com/xingyuclub/xingyu-racing-club.git`；后续提交、Actions 和 Pages 发布均以新组织仓库为准。
- `.github/workflows/deploy-pages.yml` 通过 `${{ github.event.repository.name }}` 派生项目路径，不依赖旧用户名；迁移后 `4cea092`、`f3b8849` 两次 Pages 工作流均成功，新地址已返回 HTTP 200。
- COS/CDN 媒体域名与公开配置脚本地址不随 GitHub 组织迁移改变，仍使用 `media.xn--0tr48cxwl51iluvqh7c.xn--fiqs8s`；本机后台、运行时配置和 Ollama 识别链路也不受影响。

## 2026-08-09 二级页面返回位置与新闻详情交接

- 公开前台路由现在只在当前页面实例的内存中保存各页面滚动位置：首页、相册、新闻列表和各新闻详情在网站未关闭时可恢复上次浏览位置；不写入 `sessionStorage` 或 `localStorage`。
- 站内导航通过当前页面实例专属的 `history.state.xingyuNavigationSession` 标记历史项。新闻详情从首页或新闻列表进入时，“返回”使用浏览器历史并恢复上一页位置；刷新、关闭重开或直接打开别人分享的 `#news/<id>` 时，旧标记无效，“返回”会进入 `#news` 且从顶部开始。
- `src/components/NewsDetailPage.jsx` 已移除详情页摘要块及其底部分隔线，正文紧接标题信息区显示；正文不再依赖滚动渐显，避免分享直链在部分浏览器首次打开时正文保持透明。
- `src/components/NewsFeed.jsx` 和 `src/components/NewsPage.jsx` 保留可分享的 hash 链接，同时由 `src/App.jsx` 接管站内点击，以便写入当前页面实例的导航标记并正确恢复滚动位置。
- 回归测试新增：当前页面实例双向恢复位置、分享直链返回新闻列表顶部、站内新闻详情返回新闻列表原位置、详情页不渲染摘要且正文直接跟随标题区。
- 最终验证：`npm test -- --run` 通过 31 个测试文件、509 项测试；`npm run build` 通过；浏览器在 `390×844` 和 `1280×800` 下确认摘要节点为 0、正文默认可见、页面级横向溢出为 0、控制台无警告或错误。
- 公网仍通过 `main` 分支的 `.github/workflows/deploy-pages.yml` 发布到 `https://xingyuclub.github.io/xingyu-racing-club/`，媒体和公开配置脚本继续由 COS/CDN 提供。
- 本轮发布只提交上述公开前端、测试和交接文件；工作区中原有的 `server/index.js`、`server/index.test.js` 未提交改动保持原样，不纳入本次 GitHub Pages 发布提交。

## 2026-08-10 相册视频标识交接

- 相册页和首页精选照片中的视频标识已从“视频”文字改为右上角播放图标，使用 `PlayCircle`，固定为 `30×30px` 圆形按钮视觉，不再参与底部标题蒙版布局。
- `AlbumPage` 的标题信息改用独立 `.album-photo-copy` 类，避免通用 `span` 规则把视频标识误套成整宽底部渐变蒙版；视频卡片与普通照片卡片的底部蒙版高度保持一致。
- 回归测试覆盖首页精选视频和相册文件夹视频：标识不再渲染“视频”文字、包含播放 SVG，并校验右上角定位和固定尺寸；移动端浏览器确认图标位于右上角、三张卡片标题蒙版同高、页面级横向溢出为 0。
- 最终验证：`npm test -- --run` 通过 31 个测试文件、509 项测试；`npm run build` 通过；浏览器控制台无错误或警告。
- 本次公网发布只包含 `src/components/AlbumPage.jsx`、`src/components/GalleryPreview.jsx`、`src/styles/global.css`、对应测试和本交接文档；工作区原有的 `server/index.js`、`server/index.test.js`、`src/admin/RichTextEditor.jsx`、`src/admin/RichTextEditor.test.jsx` 未提交改动保持原样。

## 2026-08-10 公网媒体占位符修复交接

- 公网媒体本身未丢失；根因是 Node 启动时默认发布公开配置，如果从缺少 `server/data/site-config.json` 的目录或其他工作树启动，`configStore.read()` 会生成种子配置并覆盖 COS 上的生产 `config/site-config.js`。
- 已用当前本机 `server/data/site-config.json` 重新发布 COS 公开配置；回读确认为 12 名阵容成员、45 名积分人物、5 个相册、2 条新闻，占位符计数为 0。覆盖前的错误远程脚本已备份到 `output/site-config.remote-broken-20260810-111821.js`。
- `server/index.js` 已改为默认启动绝不发布公开配置；只有代码显式传入 `publishPublicConfigOnStart: true` 才允许启动发布。后台保存配置和识别提交仍会正常发布。
- `server/index.test.js` 新增“默认启动零发布”和“显式开启才发布”回归，原有“后台保存后发布”回归保持通过。

## 2026-08-10 后台媒体与周末录入收口交接

- 本轮将此前遗留在主工作树的后台改动按功能拆分并提交：`8b6aa96` 为本地 `/uploads` 静态媒体增加一年 `immutable` 缓存；上传文件名包含 UUID，因此不会复用旧 URL 覆盖内容。修改服务端后需要重启 Node 才会应用新的响应头。
- `95be24b` 修复新闻富文本编辑器重新打开已保存文章时丢失 COS/CDN 正文图片的问题：编辑器改为接受普通非 Base64 图片节点，最终保存仍由服务端 `newsRichText` 白名单净化限制允许的本地与 COS/CDN 来源，其他外链不会绕过服务端校验。
- `4352b31` 将周末录入从固定展示本周六、周日两张表改为月历选择单个日期：工作日禁用，可切换月份并打开任意历史或未来的周六/周日；表格继续由 `scoreMembers` 驱动，周六显示上周积分，周日不显示该列，已有数据切换日期后正常回显。
- 周末积分基线继承改为记录最近一个有积分值的周末：如果上一周只有周六记录、周日缺行，下一周六仍会继承该周六积分并将上周积分锁定为只读；周日存在有效积分时仍以周日为最新基线。
- 定向验证：`server/index.test.js` 43 项、`RichTextEditor.test.jsx` 6 项、`scoreLedger.test.js` 与 `WeekendScoreEditor.test.jsx` 合计 23 项全部通过。最终 `npm test -- --run` 通过 31 个测试文件、516 项测试；`npm run build` 通过，ExcelJS 仍为独立动态代码块。
- 本轮未使用或读取本地管理员凭据，因此没有执行登录后的桌面/移动端人工视觉复验；周末月历的交互与数据行为由 12 项组件测试覆盖。旧 `.worktrees/config-admin/agent.md` 仍是 2026-07-28 的用户遗留未提交草稿，内容已经过时，按既有约定保持原样且不得覆盖当前 `AGENTS.md`。

## 2026-08-10 公网媒体反复回退占位数据根因修复交接

- 公网刷新后媒体再次消失并显示“成员 01”等占位数据，根因不是 COS 媒体失效，也不是 GitHub Pages 缓存：`server/index.test.js` 的截图识别测试通过程序化 `createApp()` 创建应用时漏传 `mediaStorage`，而 `createApp()` 会从本机 `.env` 自动连接真实 COS；测试提交种子配置后触发公开配置发布，恰好在全量测试时间把生产 `config/site-config.js` 覆盖成测试数据。这解释了为何问题多次在运行测试后复发。
- `server/index.js` 已调整依赖边界：程序化 `createApp()` 默认 `mediaStorage = null`，不会读取或写入真实 COS；只有直接执行 `node server/index.js` 的 CLI 入口才显式调用 `createCosStorageFromEnv()` 注入生产媒体存储。后台保存配置、媒体上传和识别提交在正常 Node 启动方式下保持原功能。
- 新增回归测试确认未显式传入媒体存储的程序化应用实例，其 `app.locals.mediaStorage` 与 `publishPublicConfig` 均为 `null`；需要验证发布的既有测试继续使用内存假存储。该测试修复前能稳定读到真实 COS 对象并失败，修复后通过。
- 已用本机正确的 `server/data/site-config.json` 重新发布生产配置；回读为 12 名阵容成员、45 名积分人物、5 个相册、2 条新闻，占位成员计数为 0，ETag 为 `99c8a0e2d6302e6597ad5d426240471b`。完整运行 `server/index.test.js` 44 项及全量 31 个测试文件、517 项测试后，远程 ETag 和最后修改时间均未变化，证明测试不再污染生产。
- `npm run build` 通过；临时用真实 CLI 在 `127.0.0.1:3002` 启动并读取 `/api/config` 返回 200，启动前后远程 ETag 不变。公网 GitHub Pages 连续刷新后恢复真实 `ˣʸ༩·Q3` 等成员和 COS 媒体，页面观测到 124 张 COS 图片成功加载、0 张失败、占位成员计数为 0，浏览器控制台无页面错误或警告。

## 2026-08-10 球形阵容与移动端媒体兼容交接

- 队员球形画廊的真实头像卡片新增底部单行昵称遮罩：深色半透明背景、自动省略，避免长昵称换行破坏卡片比例；占位卡片保持原有占位名称样式。
- 移动端视频“横屏播放”优先调用媒体元素的 iOS/微信 `webkitEnterFullscreen` / `webkitEnterFullScreen`，再回退到标准媒体全屏和舞台全屏；原有桌面舞台全屏与横屏锁定逻辑保持不变。
- `siteConfig` 与积分详情日期读取移除 `Object.hasOwn`、`Array.prototype.at`，改用旧浏览器可用写法；新增兼容性回归测试。
- 验证结果：`npm test -- --run` 通过 31 个测试文件、520 项测试；`npm run build` 通过；`git diff --check` 通过；浏览器 390×844、1280×800 均确认页面级横向溢出为 0，移动端视频弹窗可见“横屏播放”按钮，昵称遮罩已渲染。IAB 环境仅有 Motion 减少动态效果提示，无应用错误；iOS/微信媒体 API 调用由单测覆盖。
- 本轮改动随 `main` 分支提交并发布到 GitHub Pages：`https://xingyuclub.github.io/xingyu-racing-club/`。服务端配置、媒体和后台文件未纳入本次公网前端发布。

## 2026-08-11 积分榜独立分享页交接

- 完整积分榜已从首页原地展开改为独立 hash 二级页面 `#leaderboard`；正式分享地址为 `https://xingyuclub.github.io/xingyu-racing-club/#leaderboard`。首页继续只展示前 10 名，“查看完整榜单”改为真实链接，支持浏览器长按、复制链接和直接分享。
- 直接打开积分榜页时只渲染完整榜单、截至日期、“按日期查找”和“返回首页”，不渲染 Hero、成员、资讯、相册或音乐浮窗。真实运行时验收中页面包含 46 条排名，图片、视频、音频 DOM 数量均为 0，避免加载首页媒体流量。
- `src/components/Leaderboard.jsx` 抽出复用的 `LeaderboardList`；新增 `src/components/LeaderboardPage.jsx`；`src/App.jsx` 增加 `leaderboard` 路由。日期查询继续复用原 `ScoreDetailsModal` 和公开配置数据，不新增后台字段或独立数据源。
- 回归测试覆盖：首页链接指向 `#leaderboard`、站内进入显示完整榜单、分享直链不加载首页、返回首页恢复首页。最终 `npm test -- --run` 通过 31 个测试文件、521 项测试，`npm run build` 通过；浏览器在 `390x844`、`1280x800` 下页面级横向溢出为 0，日期查询弹窗可打开，控制台无警告或错误。
- 公网发布仍只需推送 `main`，由 `.github/workflows/deploy-pages.yml` 使用 `VITE_PUBLIC_ONLY=true`、仓库子路径和 COS 公开配置脚本完成。后续积分数据变化只需在本机后台保存并刷新直达页，不需要为数据更新重新构建前端。

## 2026-08-11 音乐压缩与后台音频上传修复交接

- 默认音乐 `public/audio/launch-now.mp3` 已从 320 kbps、7,213,226 字节压缩为 128 kbps、2,885,380 字节，时长保持 180.262 秒；本地未被代码引用且被 `.gitignore` 忽略的 `public/audio/full-heart-departure.flac` 已移除。
- 后台已重新上传压缩成品并保存配置；本机 `server/data/site-config.json`、COS 音乐对象和公开 `config/site-config.js` 均已指向新文件。COS 返回 `Content-Length: 2885380`，本地 MD5 与远程 ETag 同为 `08761e00e8d82bc858a4c81b192483e2`。
- 修复后台音乐文件选择器错误限制为图片的问题：`ConfigEditor` 现在仅对 `music.src` 使用 `allowedTypes={['audio']}`，生成 `accept="audio/*"`；相册图片 `src` 和音乐封面仍保持 `image/*`。新增回归测试覆盖音乐与封面的文件类型边界。
- 使用与 GitHub Actions 相同的公开构建环境验证：新公开产物共 48 个文件、7,597,172 字节（7.25 MiB），其中音乐 2.75 MiB，HTML/JS/CSS 核心文件合计约 426.2 KiB；相同文件集使用旧音乐时约为 11.37 MiB。
- 验证结果：`npm test -- --run` 通过 31 个测试文件、522 项测试；`npm run build` 和公开模式独立构建均通过；真实浏览器确认音乐上传框为 `audio/*`、封面为 `image/*`，控制台无警告或错误。公网仍由推送 `main` 后的 GitHub Pages 工作流发布，COS 运行时配置无需随前端重复提交。

## 2026-08-17 新闻隐藏与后台审核收口交接

- 新闻数据新增可选布尔字段 `hidden`，旧数据自动迁移为 `false`。后台新闻卡片提供“隐藏”开关和收起态标记；公开首页、新闻列表、分类页与详情路由统一过滤隐藏新闻，隐藏记录仍保留在后台，可取消隐藏恢复展示。
- 截图识别继续禁止无人确认时自动创建积分人物；对 `unmatched` 证据，管理员可在审核页明确输入名称并点击“新增积分人物并匹配”。服务端校验名称归一化去重、使用最小未占用正整数 ID、期初积分和胜场均为 0，并重新生成草稿；同批次相同昵称随新人物一起匹配。
- 后台任一配置素材上传期间，“保存全部配置”会禁用并显示等待提示，避免保存旧地址；文件选择器会在开始上传后清空，因此同一个文件可再次选择重传。积分明细表“队员”表头显示当前可见行数。
- 新增 `scripts/start-local-services.ps1`，用于一次启动或复用本机 Ollama、Node `3000` 和 Vite `4173`，后台地址为 `http://127.0.0.1:4173/admin`，日志位于 `%TEMP%\xingyu-local-logs`。
- 识别运行时目录已被 `.gitignore` 忽略，不再跟踪索引大 diff。当前队列不做删除：`29 committed`、`10 discarded`、`4 ready`、`4 failed`、`1 processing`；后续逐条审核、重试或明确废弃。
- 根目录 `agent.md` 已标记为 2026-07-28 历史废弃文档，当前开发和交接只以 `AGENTS.md` 为准。
- 最终验证：`npm test -- --run` 通过 31 个测试文件、534 项测试；`npm run build` 通过；`git diff --check` 和 `scripts/start-local-services.ps1` PowerShell 语法检查通过。构建仅保留 ExcelJS 动态块超过 500 kB 的既有提示。
