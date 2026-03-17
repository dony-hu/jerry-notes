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
# type: webslides
# draft: true
---

# 我的新文章
```

说明：

- `slug` 默认来自文件名，例如 `posts/hello-world.md` -> `hello-world`
- `title` 和 `date` 建议必填
- `tags` 可选
- `type: webslides` 时，构建会自动生成 `./<slug>.html`
- `draft: true` 的文章不会进入站点产物
- 没有 front matter 的 Markdown 不会自动发布

## Cloudflare Pages 部署

推荐方式是直接连接 GitHub 或 GitLab 仓库，让 Cloudflare 在每次 push 后自动构建。

Cloudflare Pages 里填写：

- Production branch：你的主分支
- Build command：`npm run build`
- Build output directory：`dist`
- Node version：仓库里已通过 `.node-version` 固定为 `22.16.0`

部署前请确认：

- 这个目录本身是一个独立 Git 仓库
- 远程仓库已经创建完成
- Cloudflare Pages 指向的是这个仓库，而不是上层目录

如果当前目录还不是独立仓库，可以在项目根执行：

```bash
git init
git add .
git commit -m "chore: bootstrap jerry-notes"
```

然后再关联远程仓库。

## 当前约束

- 站点仍然沿用现有的轻量前端，不是 Astro
- 未加 front matter 的 Markdown 可以继续留在仓库里，但不会自动发布
- 浏览器端 Markdown 渲染仍然是轻量自定义实现，后续可再升级为标准库
