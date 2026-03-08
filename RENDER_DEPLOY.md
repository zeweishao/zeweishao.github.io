# Render 部署后端（给 GitHub Pages 前端用）

你的前端在 GitHub Pages，`/api/*` 必须由独立后端提供。

## 1. 在 Render 创建 Web Service

1. 打开 Render Dashboard -> `New +` -> `Web Service`
2. 连接仓库：`zeweishao/zeweishao.github.io`
3. 配置：
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: `Starter`（建议，支持持久化磁盘）

## 2. 配置持久化磁盘（关键）

在服务设置里添加 Disk：
- Mount Path: `/var/data`
- Size: `1 GB`（按需）

然后在 Environment 变量里加：
- `DATA_DIR=/var/data`

> 这样留言/评论/视频/照片会写到磁盘，不会因重启丢失。

## 3. 绑定前端到后端

后端部署完成后会得到地址，例如：
`https://isnow-api.onrender.com`

把 `backend-config.js` 改成：

```js
window.ISNOW_API_ORIGIN = "https://isnow-api.onrender.com";
```

并推送到 GitHub。

## 4. 验证

1. 打开 `https://你的后端域名/api/messages`，应返回 JSON 数组。
2. 打开 GitHub Pages 的 `messages.html`，可加载并写入留言。

## 5. 自定义域名（可选）

如果你有域名，可给后端单独配子域名，例如 `api.xxx.com`，
然后把 `backend-config.js` 改成该域名。
