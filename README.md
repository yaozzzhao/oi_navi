# OI 导航

纯前端导航站点，基于 `winterant/oi` 仓库的资料快速检索历年 OI 真题。支持按年份、比赛、级别、轮次筛选，并一键跳转到 GitHub 对应文件/页面，可直接部署到 Vercel。

## 功能

- 实时拉取 `winterant/oi` 仓库文件树（自动识别默认分支）
- 年份/比赛/级别/轮次筛选 + 关键词搜索
- 直接跳转到仓库文件或目录，便于查看题面与资料
- 拉取失败时展示示例数据，提示检查网络

## 开发

```bash
npm install
npm run dev
```

访问 `http://localhost:5173/` 预览。

## 构建与部署

```bash
npm run build
```

将生成的 `dist/` 部署到 Vercel 即可。无需后端，前端直接调用 GitHub API 获取最新数据。

## 代码检查

```bash
npm run lint
```
