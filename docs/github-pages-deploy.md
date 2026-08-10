# GitHub Pages 前端部署

## 架构

- GitHub Pages：只托管公开 H5 静态前端。
- COS/CDN：继续托管图片、视频、音乐，以及公开配置脚本。
- 本机 Node：继续运行配置后台、上传接口和积分截图识别。
- 本机 Ollama：继续运行本地识别模型。

GitHub Pages 不会访问本机的 `/api/admin`。公开配置由本机后台保存时同步上传到 COS，前端刷新后读取最新配置。

## 第一次发布

1. 在 GitHub 新建一个 **Public repository**，建议名称填写 `xingyu-racing-club`。不要勾选 README、`.gitignore` 或 License，避免与本地项目冲突。
2. 在项目目录打开 PowerShell：

```powershell
cd C:\Users\Admin\Documents\H5
git add .
git commit -m "deploy public H5 to GitHub Pages"
git branch -M main
git remote add origin https://github.com/你的用户名/xingyu-racing-club.git
git push -u origin main
```

如果提示已经存在 `origin`，改用：

```powershell
git remote set-url origin https://github.com/你的用户名/xingyu-racing-club.git
git push -u origin main
```

`.env`、管理员账号、运行时积分配置、本地媒体和识别截图均被 `.gitignore` 排除，不会随 `git add .` 上传。不要手动强制添加这些文件。

## 开启 Pages

1. 打开 GitHub 仓库的 **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开 **Actions**，等待 `Deploy H5 to GitHub Pages` 完成。
4. 首次地址通常是：

```text
https://你的用户名.github.io/xingyu-racing-club/
```

工作流会自动处理仓库子路径、静态图片路径，并隐藏后台入口。

## 本地后台

后台仍在本机打开：

```text
http://127.0.0.1:3000/admin
```

本机 Node 和 Ollama 必须保持运行，才能使用配置保存、媒体上传和截图识别。保存配置后，后台会自动更新 COS 上的公开配置脚本；公网前端刷新页面即可看到新内容。

Node 启动本身不会发布公开配置。如果公网突然全部显示占位素材，先确认本机 `server/data/site-config.json` 是正确版本，然后在本机后台点击“保存全部配置”重新发布。发布后回读 COS 上的 `config/site-config.js`，确认成员、相册、新闻数量及媒体 URL 与本机一致，再刷新 GitHub Pages。

测试隔离规则：程序化调用 `createApp()` 默认不连接真实 COS，只有 `node server/index.js` 的 CLI 入口会显式注入 COS。新增服务端测试时不得直接使用本机 `.env` 中的生产媒体存储；发布行为必须注入假 `mediaStorage`。如果 COS 配置的最后修改时间恰好与 `npm test` 一致，并且内容变成“成员 01”等种子数据，应立即检查是否有测试绕过了这条隔离边界。

## 后续更新

- 修改网站代码：提交并推送到 `main`，GitHub Actions 会重新部署。
- 修改网站内容：在本机后台保存即可，不需要重新部署 GitHub Pages。
- 不要把 `.env`、`server/config/admin.local.json` 或任何 SecretId/SecretKey 提交到 GitHub。

## 绑定域名

先确认 GitHub Pages 免费地址正常，再在 Pages 设置中添加子域名，并在域名 DNS 中添加 GitHub 要求的 CNAME 记录。绑定域名后，工作流里的 `VITE_BASE_PATH` 需要改为 `/`。
