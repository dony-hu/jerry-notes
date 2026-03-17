# Cloudflare Pages 极短操作单

目标：保留当前 `jerry-notes.pages.dev` 这个 Direct Upload 项目，并让 GitHub 仓库 `dony-hu/jerry-notes` 在每次 push 到 `main` 后自动发布。

## 1. 先确认项目类型

如果部署详情页里能看到：

- `资产已上传`
- 已上传文件列表

那就说明当前项目是 `Direct Upload`，不是 Git 集成。

这时最稳的方案不是重建项目，而是：

- GitHub Actions 负责构建
- Wrangler 把 `dist/` 自动上传到现有 `jerry-notes` 项目

仓库里的自动发布工作流在：

- `.github/workflows/deploy-pages-direct-upload.yml`

## 2. 只需要在 GitHub 配 2 个 Secrets

打开 GitHub 仓库：

1. `Settings`
2. `Secrets and variables`
3. `Actions`
4. 新增：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

## 3. Cloudflare Token 权限

推荐给这个 API Token 至少这些权限：

- `Cloudflare Pages: Edit`
- `Account: Read`

Token 作用域选择当前 Pages 项目所在账号即可。

`CLOUDFLARE_ACCOUNT_ID` 可以在 Cloudflare 账号主页右侧或 Workers & Pages 相关设置里看到。

## 4. 触发一次自动发布

Secrets 配好后，任选其一：

1. 直接向 `main` push 一次提交
2. 到 GitHub Actions 手动运行 `Deploy Pages (Direct Upload)`

工作流会执行：

1. `npm install`
2. `npm run build`
3. `npx wrangler pages deploy dist --project-name=jerry-notes --branch=main`

## 5. 验证

部署完成后检查：

- `https://jerry-notes.pages.dev/posts/posts.json`
- 页面里不应再出现 `2026-w12-weekly-report`
- 页面里应包含 `juhe-api-catalog-full-md`

## 6. 当前已准备好

仓库已经满足自动发布要求：

- 已有 `npm run build`
- 已有 `dist` 输出
- 已有 `_headers`
- 已有 `wrangler.toml`
- 已有 GitHub Actions 自动部署工作流
- 已推送到 GitHub `main`
