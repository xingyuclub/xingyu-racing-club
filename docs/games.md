# 小游戏入口

更新日期：2026-10-02。

- 底部主导航顺序：首页、资讯、积分榜、相册、小游戏。
- 小游戏使用独立 `#games` 页面，不在首页展示，不加载第三方游戏脚本或 iframe。
- 点击游戏图标或名称，在新页面直接打开第三方游戏；本页不提供游戏账号、成绩或实名绕过。
- 页面顶部有一行提示条：“小游戏需跳转到第三方网站”，副文案说明点击后会在新页面打开，微信内打不开时可点右上角「···」选择「在浏览器中打开」；没有任何上架游戏时该提示不显示。提示条为图标与标题同行的紧凑卡片，正文与标题左边缘对齐，上下留白等宽。
- 手机端（≤480px）为两列网格：图标按列宽等比铺满，行内间距 16px，与页面左右 16px 留白保持一致，不再出现两列之间的大空隙。宽屏（>480px）仍是原有多列自适应排列。
- 小游戏页左右留白为 20px，与顶部品牌栏的内容内边距一致，因此提示条、游戏网格和品牌栏内容左边缘对齐；该覆盖只作用于 `#games` 页，相册页仍是 16px。
- 品牌栏到提示条、提示条到游戏网格的两段竖向留白均为 22px；改动页面的 `padding-top` 时需同步提示条的下外边距，避免两段间距不等。
- 2026-10-03 扩充到 54 款，全部免登录、免实名，链接统一为 Poki 游戏页（`https://poki.com/zh/g/<slug>`）；抓大鹅仍为小程序入口页，`Tiny Fishing`、`Fishing World`、`Game of Farmers` 沿用原有 Poki 链接。
- 分类为 6 类：竞速 9、动作 9、益智 9、休闲 12、经营 7、体育对战 8。前台 Tab 顺序为「竞速 / 动作 / 益智 / 休闲 / 经营 / 体育对战 / 全部」，默认选中「竞速」，`全部` 固定排最后。
- 每个游戏条目新增 `category` 字段（`racing` / `action` / `puzzle` / `casual` / `sim` / `sports`）；旧配置缺失或非法时回退 `casual`，后台“小游戏管理”提供分类下拉。
- 非微信环境不显示任何提示条、也不弹层，页面只有分类 Tab 和游戏网格，点击图标在新页面打开。
- 微信内（UA 含 `MicroMessenger`）才显示提示条（`请先「在浏览器中打开」再开始游戏` / `微信内置浏览器无法打开游戏，请点右上角「···」，选「在浏览器中打开」，再挑游戏。`），并**立即弹出**「请先换到浏览器」引导层（提供复制本页链接），用户在挑游戏之前就被引导去外部浏览器；关闭引导层后点击任意图标会再次弹出，作为兜底，避免直接用微信内置浏览器打开游戏导致卡死。
- 游戏目录与图标由 `scripts/import-games-catalog.js` 生成：抓取 Poki `og:image`、缩放 256×256、转为 WebP 上传 COS（`games/icons/<SHA-256 前 16 位>-<id>.webp`）。46 张新图标合计约 0.5 MB，另 8 张复用既有对象。
- 后台“小游戏管理”支持名称、链接、图标上传、上架开关、新增、删除和排序；保存使用原有配置 API 与公开配置发布链路。
- 老配置缺少 `games` 时补齐 8 款默认游戏；明确保存 `games: []` 时保持空列表。
- 只接受无账号密码的绝对 HTTP(S) 链接；下架项不显示，图标失败时显示通用游戏图标。
- 免登录、广告、国内网络及微信内访问体验由第三方决定，需要定期用实际手机复查。

## 图标来源

入口图标来自对应游戏页面的官方分享图或官方素材，仅作为跳转入口缩略图，游戏及图像权利属于其各自权利人；可在后台替换为已获许可的自有素材。

- `public/images/games/hill-climb-racing.png`：https://poki.com/zh/g/hill-climb-racing-lite
- `public/images/games/blocky-blast-puzzle.png`：https://poki.com/zh/g/blocky-blast-puzzle
- `public/images/games/tiny-fishing.jpg`：https://poki.com/en/g/tiny-fishing
- `public/images/games/fishing-world.jpg`：https://poki.com/en/g/fishing-world
- `public/images/games/game-of-farmers.jpg`：https://poki.com/en/g/game-of-farmers
- `public/images/games/fruit-ninja.jpg`：https://poki.com/zh/g/fruit-ninja
- `public/images/games/zhuadae.jpg`：https://kunpo.cc/game-detail.html?id=2
- `public/images/games/monkey-mart.jpg`：https://poki.com/en/g/monkey-mart

新增 6 张 JPEG 已缩放为 256×256；抓大鹅使用官方 `images/game-zhuadae/logo.png`，其余使用游戏页的 `og:image`。

抓大鹅的官方入口页提供微信/抖音小程序体验，不等同于普通网页 HTML5 游戏；其余新增入口为 Poki 游戏页。是否需要登录、广告是否影响体验、国内网络和微信内核是否稳定，仍需用实际手机复测。

## 腾讯云图标

- 8 张图标已迁移到现有 COS/CDN，当前配置与默认数据中的 `iconSrc` 均使用 CDN 绝对地址；页面仍由 GitHub Pages 托管。
- 对象键为 `games/icons/<SHA-256 前 16 位>-<原文件名>`，缓存头为 `public, max-age=31536000, immutable`。替换图标时必须使用新内容哈希或后台上传的新地址，不覆盖旧缓存地址。
- `public/images/games/` 的原图继续保留作备份，图标失败时仍显示通用游戏图标。
- 迁移只改变图标地址，不修改游戏链接、排序或上架状态；当前抓大鹅下架、其余 7 款上架。
- 后续从后台“游戏图标上传”选择图片，会自动上传腾讯云并填入 CDN 地址；保存全部配置即可发布，无需再次迁移。正式服务不允许因 COS 配置缺失回退到本地上传。
