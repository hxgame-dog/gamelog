# 部署清单

这份清单按 `GitHub -> Neon -> 本地联调 -> Vercel -> 线上验收` 的顺序整理。

## 1. 创建 GitHub 仓库

1. 在 GitHub 新建一个空仓库
2. 仓库名建议与产品名一致，例如 `telemetry-studio`
3. 本地进入项目目录：

```bash
cd /Users/fulei/Gamelog/game-telemetry-hub
```

4. 初始化并推送：

```bash
git init
git add .
git commit -m "Initial OmniLog AI app"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## 2. 创建 Neon 数据库

1. 登录 Neon
2. 创建一个新的 project
3. 创建数据库，例如 `telemetry_studio`
4. 复制连接串
5. 确认连接串里包含 `sslmode=require`

你最终会得到一个类似这样的 `DATABASE_URL`：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/telemetry_studio?sslmode=require"
```

## 3. 本地接入数据库

在项目根目录创建或更新：

- `.env.local`

建议至少填这两个：

```env
DATABASE_URL="your-neon-connection-string"
APP_ENCRYPTION_KEY="replace-with-a-long-random-string"
```

`APP_ENCRYPTION_KEY` 建议：
- 长度至少 32 个字符
- 使用随机字符串
- 本地和线上分别保存，不要提交到 Git

如果你想快速生成一个随机值，可以用：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. 初始化数据库结构

在本地执行：

```bash
npm run db:generate
npm run db:push
```

如果 `db:push` 成功，说明 Prisma 和 Neon 已经接通。

可选检查：

```bash
npm run db:studio
```

## 5. 本地联调清单

启动项目：

```bash
npm run dev
```

建议验收以下路径：

1. `/login`
2. `/projects`
3. `/plans`（方案设计）
4. `/settings/ai`

建议检查：

- 第一个账号可以正常登录
- 能创建项目
- 能创建方案
- 能保存事件和字段
- Gemini Key 可以保存、检测模型、删除
- `/plans` 中 `AI 生成方案` 可以写回数据库

## 6. 在 Vercel 创建项目

1. 登录 Vercel
2. 选择 `Add New Project`
3. 导入刚刚的 GitHub 仓库
4. Framework 保持 Next.js 默认识别

## 7. 配置 Vercel 环境变量

在 Vercel 项目设置里添加：

```env
DATABASE_URL=your-neon-connection-string
APP_ENCRYPTION_KEY=your-random-secret
```

说明：
- 不要把 Gemini Key 提前写进仓库
- Gemini Key 建议部署后通过产品后台 `/settings/ai` 录入
- 如果你后面想固定平台级 Gemini Key，也可以改成 Vercel 环境变量模式，但当前实现更适合后台录入

## 8. 触发首次部署

Vercel 在导入仓库后通常会自动部署。

如果部署前你还没把数据库表结构推到 Neon，先在本地完成：

```bash
npm run db:push
```

当前项目的数据库结构主要由 Prisma 管理，所以最稳妥的方式是：
- 先本地连 Neon 执行 `db:push`
- 再让 Vercel 部署前端和 API

## 9. 线上首次验收

部署成功后，按这个顺序检查：

1. 打开线上地址 `/login`
2. 用第一个账号登录
3. 进入 `/projects` 创建一个测试项目
4. 进入 `/plans` 打开“方案设计”
5. 进入 `/settings/ai` 保存测试用 Gemini Key
6. 点击“检测可用模型”
7. 回到 `/plans` 测试 `AI 生成方案`
8. 测试结束后可删除已保存 Key

## 10. 安全检查

上线前确认：

- `.env.local` 没有提交到 GitHub
- `APP_ENCRYPTION_KEY` 不是示例值
- Gemini Key 没有写入仓库文件
- 只有管理员账号能访问 `/settings/ai`
- 测试完成后可删除平台里已保存的 Gemini Key

## 11. 当前推荐的推进顺序

如果你准备继续做成正式产品，建议下一阶段开发顺序是：

1. 方案设计与方案确认
2. 字段映射和校验
3. 仪表盘真实聚合
4. Gemini 方案诊断
5. AI 报告生成
6. 角色权限完善

## 12. 出问题时先查什么

### 本地没有数据保存

先检查是否配置了 `DATABASE_URL`。如果没有，系统会回退到内存模式。

### AI 设置保存不了

先检查：
- 你是不是第一个登录账号
- `APP_ENCRYPTION_KEY` 是否已配置

### 检测 Gemini 模型失败

先检查：
- Key 是否有效
- 网络是否能访问 Gemini API
- 该 Key 是否有模型访问权限

### 线上部署后数据库连不上

先检查：
- Vercel 的 `DATABASE_URL` 是否正确
- Neon 连接串是否带 `sslmode=require`
