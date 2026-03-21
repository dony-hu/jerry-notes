# Jerry Notes

一个基于 Markdown 的轻量静态个人站。

现在的发布链路是：

`posts/*.md` -> 构建时自动生成 `posts/posts.json` -> 输出到 `dist/` -> 交给 Cloudflare Pages 托管

这意味着以后文章的唯一内容源是 Markdown 文件，不再手工维护文章索引。

产品与技术设计文档见：

- `docs/PRD.md`
- `docs/DESIGN.md`

## 本地使用

安装 Node.js 22 后，在项目目录执行：

```bash
npm run build
python -m http.server 8787 --directory dist
```

然后打开：

- http://127.0.0.1:8787

如果要本地联调飞书登录，需要使用 Cloudflare Pages Functions 本地运行时：

```bash
cp .dev.vars.example .dev.vars
npm run build
npx wrangler pages dev dist --port 8788
```

然后打开：

- http://127.0.0.1:8788

说明：

- `.dev.vars` 里填写本地飞书应用凭证
- 本地调试时，需要把 `http://127.0.0.1:8788/api/auth/feishu/callback` 加到飞书应用的重定向 URL
- 纯静态预览依然可以继续用 `python -m http.server`，但那种方式不会运行 `/api/auth/feishu/*` 这些函数端点

如果只是更新文章索引，不想完整构建，也可以执行：

```bash
npm run generate:posts
python -m http.server 8787
```

## 目录

- `index.html` 主页
- `app.js` 前端逻辑
- `posts/*.md` 文章源文件
- `posts/posts.json` 构建生成的文章索引
- `posts/TEMPLATE.md` 新文章模板
- `docs/PRD.md` 产品需求文档
- `docs/DESIGN.md` 技术设计文档
- `scripts/generate-posts-index.mjs` 自动生成文章索引
- `scripts/build-site.mjs` 构建 Cloudflare Pages 用的 `dist/`
- `_headers` Cloudflare Pages 缓存策略
- `wrangler.toml` Cloudflare Pages / Wrangler 配置

## 新增文章

1. 复制 `posts/TEMPLATE.md` 为 `posts/<slug>.md`
2. 按模板填写 front matter
3. 写正文
4. 执行 `npm run build`
5. 提交并 push 到远程仓库

推荐 front matter：

```md
---
title: 我的新文章
date: 2026-03-17
tags:
  - AI
  - Notes
visibility: public
# type: webslides
# draft: true
---

# 我的新文章
```

说明：

- `slug` 默认来自文件名，例如 `posts/hello-world.md` -> `hello-world`
- `title` 和 `date` 建议必填
- `tags` 可选
- `visibility` 可选；默认 `public`
- `visibility: internal` 的文章只对已登录飞书用户开放
- `type: webslides` 时，构建会自动生成 `./slides/<slug>.html`
- `draft: true` 的文章不会进入站点产物
- 没有 front matter 的 Markdown 不会自动发布
- 如果标题或 slug 明显属于工作计划、日志、纪要、学习手册、周报、客户交流方案等内部材料，而仍标成 `public`，构建会直接失败

内容建议这样区分：

- `public`
  - 适合外部公开传播的观点、方法论、泛化后的行业文章
- `internal`
  - 工作计划、周报、会议纪要、部门学习手册、项目状态盘点、包含内部员工姓名或组织细节的分享材料
  - 客户交流方案、部门内部宣讲稿、项目交付盘点、团队日志与代码分析等工作材料

## Cloudflare Pages 部署

当前 `jerry-notes.pages.dev` 项目已经确认是 `Direct Upload` 类型，不是 Git 集成。

因此这里采用的自动发布方案是：

- GitHub 负责托管源码
- GitHub Actions 在 `push main` 后执行 `npm run build`
- Wrangler 把 `dist/` 直接上传到现有的 Cloudflare Pages 项目 `jerry-notes`

对应工作流文件：

- `.github/workflows/deploy-pages-direct-upload.yml`

你只需要在 GitHub 仓库里配置两个 Actions Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

详细步骤见：

- `docs/CLOUDFLARE-PAGES-CHECKLIST.md`

如果启用飞书登录，还需要在 Cloudflare Pages 项目里配置这些运行时环境变量：

- `FEISHU_APP_ID`：飞书应用 App ID
- `FEISHU_APP_SECRET`：飞书应用 App Secret
- `AUTH_SESSION_SECRET`：用于签名登录态 Cookie 的长随机字符串

可选变量：

- `FEISHU_SCOPE`：授权时请求的用户权限，默认留空即可；需要 `refresh_token` 时可加 `offline_access`
- `FEISHU_REDIRECT_URI`：自定义 OAuth 回调地址；不填则默认使用 `https://<当前域名>/api/auth/feishu/callback`
- `FEISHU_ALLOWED_TENANT_KEYS`：限制允许登录的飞书企业，多个值用逗号分隔
- `AUTH_SESSION_MAX_AGE_SEC`：登录态最大有效期，默认最多 2 小时

飞书应用侧需要完成两项配置：

1. 在 **安全设置** 中加入回调地址：
   `https://jerry-notes.pages.dev/api/auth/feishu/callback`
2. 如果你在 `FEISHU_SCOPE` 中声明了额外 scope，需要先在飞书开放平台里为应用申请对应权限

## 内外部访问控制

当前站点已经支持文章的 `public / internal` 双可见性：

- 未登录访客：
  - 只能看到 `public` 文章
- 已登录飞书用户：
  - 可以看到 `public + internal` 文章
- 服务端会拦截：
  - `posts/posts.json`
  - `posts/*.md`
  - `slides/*.html`

这意味着内部文章不仅在前端列表里隐藏，也不能通过直链绕过查看。

另外，构建阶段还会做一次“疑似内部内容”审计：

- 如果文章标题或文件名明显像计划、日志、纪要、手册、周报、客户方案等工作材料
- 但 front matter 仍是 `public`
- `npm run build` 会失败，避免误发布

## 当前约束

- 站点仍然沿用现有的轻量前端，不是 Astro
- 未加 front matter 的 Markdown 可以继续留在仓库里，但不会自动发布
- 浏览器端 Markdown 渲染仍然是轻量自定义实现，后续可再升级为标准库
