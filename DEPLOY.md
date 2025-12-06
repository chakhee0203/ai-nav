# 部署指南 (Deployment Guide)

本项目已经配置好 **Vercel** 部署支持，这是最简单且免费的公网部署方式。

## 方法一：使用 Vercel (推荐)

Vercel 提供了对前端 (React) 和后端 (Node.js/Express) 的完美支持，且对个人开发者永久免费。

### 步骤

1.  **注册 Vercel 账号**
    *   访问 [https://vercel.com](https://vercel.com) 并使用 GitHub/GitLab/Bitbucket 账号登录。

2.  **将代码推送到 GitHub**
    *   在 GitHub 上创建一个新的仓库。
    *   将本地代码推送到该仓库。

3.  **在 Vercel 中导入项目**
    *   在 Vercel Dashboard 点击 "Add New..." -> "Project"。
    *   选择你刚刚创建的 GitHub 仓库并点击 "Import"。

4.  **配置环境变量 (可选)**
    *   在 "Environment Variables" 部分，添加你的 `DEEPSEEK_API_KEY` (如果你使用了 AI 功能)。
    *   Key: `DEEPSEEK_API_KEY`
    *   Value: `你的API密钥`

5.  **点击 Deploy**
    *   Vercel 会自动检测 `vercel.json` 配置，分别构建前端和后端。
    *   等待几分钟，构建完成后，你将获得一个免费的 `https://your-project.vercel.app` 域名。

### 注意事项

*   **Logo 和 缓存**：由于 Vercel Serverless 函数的文件系统是临时的（只读，除了 `/tmp`），Logo 缓存和每日热门缓存会在每次函数重新启动时重置。这对于免费演示是可以接受的。
*   **API 延迟**：Vercel 的 Serverless 函数在一段时间不活跃后会进入休眠（Cold Start），再次访问时可能有几秒钟的延迟。

---

## 方法二：使用 Render.com (备选)

如果你希望后端服务保持运行（不休眠）或者需要持久化存储文件，可以考虑 Render。

1.  **前端**：
    *   在 Render 创建 "Static Site"。
    *   Build Command: `cd client && npm install && npm run build`
    *   Publish Directory: `client/dist`
    *   Rewrite Rules: Source `/*`, Destination `/index.html`

2.  **后端**：
    *   在 Render 创建 "Web Service"。
    *   Build Command: `cd server && npm install`
    *   Start Command: `cd server && node index.js`
    *   环境变量: `DEEPSEEK_API_KEY`
    *   **注意**：免费版 Render 会在 15 分钟无请求后休眠，且重启时文件系统会被重置（除非使用付费的 Persistent Disk）。

---

## 常见问题

**Q: 为什么 Logo 第一次加载慢？**
A: 服务器需要从互联网下载 Logo 并缓存。在 Vercel 上，由于缓存是临时的，可能会频繁重新下载。

**Q: 为什么搜索结果有时会变？**
A: 每日热门工具列表缓存在服务器内存/临时文件中，服务重启后会重新向 AI 获取。
