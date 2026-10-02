# 小游戏入口

更新日期：2026-10-02。

- 底部主导航顺序：首页、资讯、积分榜、相册、小游戏。
- 小游戏使用独立 `#games` 页面，不在首页展示，不加载第三方游戏脚本或 iframe。
- 点击游戏图标或名称，在新页面直接打开第三方游戏；本页不提供游戏账号、成绩或实名绕过。
- 当前收录 8 款：登山赛车、方块消除、Tiny Fishing、Fishing World、Game of Farmers、Fruit Ninja、抓大鹅和 Monkey Mart。
- 本轮新增 6 款：Tiny Fishing、Fishing World、Game of Farmers、Fruit Ninja、抓大鹅和 Monkey Mart。
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
