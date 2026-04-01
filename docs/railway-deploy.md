# Railway 部署说明

这个项目已经适配 Railway：

- 构建命令由 [railway.json](/E:/vibe/AI_Influencers_X/railway.json) 指向 `npm run build:railway`
- 启动命令是 `npm run start`
- 运行时用 [server.js](/E:/vibe/AI_Influencers_X/server.js) 提供静态站点和 SPA 回退

## 最简单部署

1. 把仓库连接到 Railway
2. Railway 会读取 [railway.json](/E:/vibe/AI_Influencers_X/railway.json)
3. 设置环境变量
4. 点击 Deploy

## 必配环境变量

- `GEMINI_API_KEY`
  只有你还要用 Gemini 扩图功能时才需要

## Shared Following 候选池相关

默认情况下，Railway **不会**在每次部署时重新抓取 shared-following 数据。

也就是说：

- 如果仓库里的 [sharedFollowingData.ts](/E:/vibe/AI_Influencers_X/sharedFollowingData.ts) 已经有内容，部署会直接使用它
- 如果它还是空的，前端会提示你先生成数据

## 如果你想在 Railway 构建时自动生成 shared-following 数据

额外配置下面这些环境变量：

- `GENERATE_SHARED_FOLLOWING=true`
- `XAPI_API_KEY=你的 xapi key`

可选：

- `XAPI_FOLLOWING_PAGE_SIZE=100`
- `XAPI_MAX_FOLLOWING_PAGES=10`

这样 Railway 在 build 阶段会先执行：

```bash
node scripts/prepareSharedFollowingData.js
```

如果 `GENERATE_SHARED_FOLLOWING` 不是 `true`，这个步骤会自动跳过，不会报错。

## 推荐做法

更稳妥的方式是：

1. 本地先跑一次 `npm run generate-shared-following`
2. 确认 [sharedFollowingData.ts](/E:/vibe/AI_Influencers_X/sharedFollowingData.ts) 已经生成
3. 提交到仓库
4. Railway 只负责正常构建和部署

这样可以避免每次 deploy 都重新消耗 XAPI 调用额度。

## 本地模拟 Railway

```bash
npm install
npm run build:railway
npm run start
```

如果你要模拟“构建时自动生成候选池”，再加环境变量：

```bash
GENERATE_SHARED_FOLLOWING=true
XAPI_API_KEY=你的key
```

## 说明

- [scripts/prepareSharedFollowingData.js](/E:/vibe/AI_Influencers_X/scripts/prepareSharedFollowingData.js) 负责决定要不要在 build 前生成数据
- [scripts/generateSharedFollowingData.js](/E:/vibe/AI_Influencers_X/scripts/generateSharedFollowingData.js) 负责真正抓取和写入 shared-following 数据
- [server.js](/E:/vibe/AI_Influencers_X/server.js) 负责 Railway 运行时提供静态页面
