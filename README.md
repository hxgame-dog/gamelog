# OmniLog AI

面向休闲手游团队的打点方案设计与事件分析平台。

当前已完成的基础能力：
- 登录与会话
- 多项目管理
- 方案设计四步流
- 事件与字段真实保存
- Gemini 配置、模型检测与方案生成
- Neon / Prisma 数据层基础设施

## 本地预览

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制一份环境变量模板：

```bash
cp .env.example .env.local
```

最少需要：

```env
APP_ENCRYPTION_KEY="replace-with-a-long-random-string"
```

如果你暂时还没创建 Neon 数据库，也可以先不填 `DATABASE_URL`。
这时系统会自动进入“内存模式”：
- 可以预览登录、项目、方案编辑、Gemini 配置页
- 数据只保存在当前进程内存中
- 重启 `npm run dev` 后数据会丢失

如果你已经有 Neon 数据库，再补上：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/telemetry_studio?sslmode=require"
```

### 3. 生成 Prisma Client

```bash
npm run db:generate
```

如果已经配置了 `DATABASE_URL`，继续执行：

```bash
npm run db:push
```

### 4. 启动本地开发环境

```bash
npm run dev
```

默认访问：

- `http://localhost:3000/login`

### 5. 本地预览建议路径

按这个顺序最顺：

1. 打开 `/login`
2. 注册并登录第一个账号
3. 进入 `/projects` 创建项目
4. 进入 `/plans` 打开“方案设计”
5. 在方案里新增事件、字段，测试保存
6. 如需测试 Gemini，进入 `/settings/ai`

说明：
- 第一个登录账号会被视为管理员
- 只有管理员能访问 `AI 设置`
- 在“内存模式”下保存 Gemini Key 只存在当前进程，不写数据库
- 你可以在 `AI 设置` 页面随时删除已保存 Key

## Gemini 预览建议

如果你现在只是本地试功能，建议这样做：

1. 使用测试用 Gemini Key，而不是长期生产 Key
2. 在 `/settings/ai` 保存后点击“检测可用模型”
3. 回到 `/plans`，在“方案设计”里使用 `AI 生成方案`
4. 测试结束后回 `/settings/ai`，点击“删除已保存 Key”

## 上线前需要的三个外部资源

### GitHub

用于托管代码并连接 Vercel。

### Neon

用于托管 PostgreSQL 数据库。

### Vercel

用于部署 Next.js 应用。

## 正式部署步骤

详细步骤见：

- [部署清单](./docs/deployment-checklist.md)

## 常用命令

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run db:generate
npm run db:push
npm run db:studio
```

## 当前环境变量

见：

- [`.env.example`](/Users/fulei/Gamelog/game-telemetry-hub/.env.example)

## 已知说明

- 未配置 `DATABASE_URL` 时，系统会回退到内存模式
- 生产环境建议一定要配置 `DATABASE_URL`
- `APP_ENCRYPTION_KEY` 必须自行替换，不要使用示例值
- Gemini 调用只在服务端执行，不会把 Key 下发到前端
- 这个项目在当前沙箱里 `lint` 和 `tsc` 已通过；`next build` 之前在 Next 16 Turbopack 环境下有过卡住情况，建议你本地再跑一次生产构建验证
