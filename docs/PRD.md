# Jerry Notes 发布系统 PRD

## 1. 背景

当前个人站已经能展示 Markdown 文章，但内容发布流程依赖人工维护 `posts/posts.json`。这会带来两个问题：

- 任意机器上新增文章时，除了写 Markdown 还要手动同步索引，容易漏改
- Cloudflare 托管站点虽然适合静态内容，但仓库内部还没有稳定的“提交即发布”内容流水线

目标是把系统收敛成一个很小、很稳定的静态内容发布系统：任意机器只要能编辑 Markdown 并提交到仓库，就能自动在 Cloudflare Pages 上看到新帖子。

## 2. 目标

### 2.1 核心目标

- Markdown 成为帖子唯一内容源
- 任意机器克隆仓库后，都能直接新增或修改文章
- push 到远程仓库后，Cloudflare Pages 自动构建并发布
- 普通文章和 `webslides` 两种内容类型都能被同一条流程管理

### 2.2 非目标

- 不做后台 CMS
- 不做数据库
- 不做账号体系、评论、搜索
- 不在本期迁移到 Astro/Next 等框架

## 3. 用户与场景

### 3.1 目标用户

- 站点维护者本人
- 拥有仓库写权限的协作者

### 3.2 关键场景

1. 在任意电脑上 clone 仓库
2. 复制文章模板，新建 `posts/<slug>.md`
3. 填写 front matter 和正文
4. 本地预览或直接提交
5. push 到远程仓库
6. Cloudflare Pages 自动构建 `dist/`
7. 个人站展示最新文章

## 4. 需求范围

### 4.1 内容模型

每篇文章以 `posts/<slug>.md` 存储，front matter 至少支持：

- `title`
- `date`
- `tags`
- `type`
- `draft`
- `summary`

说明：

- `slug` 由文件名决定
- `type` 缺省表示普通文章，`webslides` 表示构建时额外生成 `<slug>.html`
- `draft: true` 的内容不进入线上产物

### 4.2 构建能力

系统需要支持：

- 扫描 `posts/*.md`
- 解析 front matter
- 自动生成 `posts/posts.json`
- 输出可部署的 `dist/`
- 自动为 `webslides` 生成 HTML 页面

### 4.3 部署能力

系统需要兼容当前采用的 Cloudflare Pages Direct Upload 模式：

- 仓库 push 后由 GitHub Actions 自动触发构建
- 构建命令固定为 `npm run build`
- 构建产物目录固定为 `dist`
- 构建完成后通过 Wrangler 上传到对应 Pages 项目

### 4.4 运维与稳定性

系统需要做到：

- 内容字段缺失时构建失败并给出错误提示
- 发布文件具有稳定的缓存策略，避免线上长时间展示旧文章列表
- 本地和 Cloudflare 构建结果尽量一致

## 5. 验收标准

满足以下条件视为本期完成：

1. 新建一篇带 front matter 的 Markdown 后，执行 `npm run build` 能自动把它加入首页索引
2. 新建一篇 `type: webslides` 的 Markdown 后，执行 `npm run build` 能自动生成对应 HTML 页面
3. `draft: true` 的文章不会出现在 `dist/posts/posts.json`
4. `posts/posts.json` 不再需要人工编辑
5. Cloudflare Pages 可以直接使用 `npm run build` + `dist` 作为发布配置
6. 仓库内有明确的模板、PRD、Design 和发布说明

## 6. 版本边界

### V1

- front matter 内容源
- 自动索引生成
- Cloudflare Pages 构建产物
- 缓存控制
- 发布文档

### 后续可选

- RSS
- SEO 元标签生成
- 标签页 / 月归档页静态化
- 更完整的 Markdown 渲染器
- Astro 迁移
