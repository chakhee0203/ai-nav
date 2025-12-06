# 部署指南 (Deployment Guide)

本项目已经配置好 **Vercel** 部署支持，这是最简单且免费的公网部署方式。此外，我们还提供了 **Dockerfile**，支持部署到 Hugging Face Spaces、Zeabur、Railway 等任何支持 Docker 的平台。

## 方法一：使用 Vercel (推荐 - 最简单)

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

## 方法三：使用 Hugging Face Spaces (推荐 - AI 友好 & 免费)

Hugging Face Spaces 提供免费的 Docker 容器托管，配置较高（2 vCPU, 16GB RAM），非常适合 AI 应用。

1.  **创建 Space**
    *   访问 [Hugging Face Spaces](https://huggingface.co/spaces)。
    *   点击 "Create new Space"。
    *   输入 Space Name (例如 `ai-nav`)。
    *   **Select Space SDK**: 选择 **Docker**。
    *   License: 选择 MIT 或其他。
    *   Visibility: Public。

2.  **上传代码**
    *   Space 创建后，你会看到一个 Git 仓库地址。
    *   你可以直接在网页上 "Files" 标签页上传文件，或者将你的 GitHub 仓库同步过去。
    *   最简单的方法是：在 Space 设置中 "Settings" -> "Git/Docker" -> 关联你的 GitHub 仓库。

3.  **配置环境变量**
    *   在 Space 的 "Settings" -> "Variables and secrets" 中。
    *   添加 Secret: `DEEPSEEK_API_KEY`，值为你的密钥。

4.  **等待构建**
    *   Hugging Face 会自动检测项目根目录下的 `Dockerfile` 并开始构建。
    *   构建完成后，应用将运行在 `https://huggingface.co/spaces/你的用户名/你的Space名`。

---

## 方法四：使用 Zeabur (开发者友好)

Zeabur 是一个对开发者非常友好的部署平台，支持全栈应用一键部署。

1.  **注册 Zeabur**
    *   访问 [https://zeabur.com](https://zeabur.com)。

2.  **新建项目**
    *   创建一个新项目。
    *   点击 "Deploy New Service" -> "Git"。
    *   选择你的 GitHub 仓库。

3.  **自动部署**
    *   Zeabur 会自动检测到 `Dockerfile` 并使用它进行构建和部署。
    *   或者它也能自动识别 Node.js 项目。建议使用 Docker 模式以获得最佳兼容性。

4.  **配置域名和变量**
    *   在 "Variables" 中添加 `DEEPSEEK_API_KEY`。
    *   在 "Networking" 中生成一个免费域名。

---

## 常见问题

**Q: 为什么 Logo 第一次加载慢？**
A: 服务器需要从互联网下载 Logo 并缓存。在 Vercel/Render 免费版上，由于缓存是临时的，可能会频繁重新下载。在 Hugging Face Spaces 上，只要容器不重启，缓存会保留一段时间。

**Q: 为什么搜索结果有时会变？**
A: 每日热门工具列表缓存在服务器内存/临时文件中，服务重启后会重新向 AI 获取。

**Q: Docker 部署有什么好处？**
A: 使用 `Dockerfile` 部署（方法三、四）可以将前端和后端打包在一个容器中运行，无需分别配置前端和后端服务，部署更简单，且环境一致性更好。
