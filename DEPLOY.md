# 部署指南 (Deployment Guide)

本项目推荐使用 **Vercel** 进行部署，这是最简单、免费且稳定的方式。

## 使用 Vercel 部署 (推荐)

Vercel 提供了对前端 (React) 和后端 (Node.js/Express) 的完美支持，且对个人开发者永久免费。

### 步骤

1.  **注册 Vercel 账号**
    *   访问 [https://vercel.com](https://vercel.com) 并使用 GitHub 账号登录。

2.  **导入项目**
    *   在 Vercel Dashboard 点击 "Add New..." -> "Project"。
    *   选择你的 `ai-nav` GitHub 仓库并点击 "Import"。

3.  **配置 (通常自动识别)**
    *   **Framework Preset**: Vite
    *   **Root Directory**: `./` (保持默认)
    *   **Build Command**: `cd client && npm install && npm run build` (在 `package.json` 中已配置，Vercel 会自动读取)
    *   **Output Directory**: `public` (已配置)

4.  **配置环境变量 (可选)**
    *   在 "Environment Variables" 部分，添加你的 `DEEPSEEK_API_KEY` (如果你使用了 AI 功能)。
    *   Key: `DEEPSEEK_API_KEY`
    *   Value: `你的API密钥`

5.  **点击 Deploy**
    *   等待构建完成，你将获得一个免费的域名 (如 `https://ai-nav-xxx.vercel.app`)。

### 常见问题

**Q: 为什么 Logo 第一次加载慢？**
A: 服务器需要从互联网下载 Logo 并缓存。在 Vercel 上，由于 Serverless 函数的文件系统是临时的，缓存可能会在一段时间后重置。

**Q: 为什么搜索结果有时会变？**
A: 每日热门工具列表缓存在内存/临时文件中，服务重启（Cold Start）后会重新获取。
