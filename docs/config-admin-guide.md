# 星屿配置后台

后台仅用于本机或受信任局域网。先创建本地凭据文件并设置密码：

```powershell
Copy-Item server/config/admin.example.json server/config/admin.local.json
# Edit server/config/admin.local.json and replace change-this-password.
npm install
npm run dev:api
npm run dev
```

开发时前台地址是 `http://127.0.0.1:5173/`，后台地址是 `http://127.0.0.1:5173/admin`。Vite 会把 `/api` 和 `/uploads` 转发给本地 API 服务。

生产模式执行 `npm run serve`，服务地址是 `http://127.0.0.1:3000/`，后台为 `http://127.0.0.1:3000/admin`。

运行时配置保存在 `server/data/site-config.json`；每次保存前的上一版位于 `server/data/site-config.json.bak`。上传的图片、视频和音频保存在 `server/storage/uploads/`，后台会返回可直接填写到配置中的 `/uploads/...` 路径。

`server/config/admin.local.json` 使用明文保存单个管理员账号和密码，仅限本地配置，绝不能提交、公开或部署到公网。会话保存在服务进程内，重启 API 服务后需重新登录。
