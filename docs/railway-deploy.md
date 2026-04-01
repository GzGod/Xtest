# Railway 部署说明

这个项目已经适配 Railway。

关键文件：

- [railway.json](/E:/vibe/AI_Influencers_X/railway.json)
- [server.js](/E:/vibe/AI_Influencers_X/server.js)
- [scripts/prepareSharedFollowingData.js](/E:/vibe/AI_Influencers_X/scripts/prepareSharedFollowingData.js)
- [scripts/generateSharedFollowingData.js](/E:/vibe/AI_Influencers_X/scripts/generateSharedFollowingData.js)

## Railway 默认行为

- Build Command: `npm run build:railway`
- Start Command: `npm run start`

默认部署时：

- 会正常构建前端
- 不会自动抓取 shared-following 候选池
- 不需要 `bun`

注意：现在 xapi 调用已经改成直接走 HTTP API，不再依赖 `xapi-to` 的 bun CLI，所以 Railway 上不会再因为 `/usr/bin/env: bun` 报错。

## 最省心的部署方式

推荐你用这条：

1. 本地先生成 shared-following 数据
2. 把生成后的 [sharedFollowingData.ts](/E:/vibe/AI_Influencers_X/sharedFollowingData.ts) 提交到仓库
3. Railway 只负责 build 和 start

本地命令：

```bash
npm install
npm run generate-shared-following
npm run build:railway
```

这种方式最稳，因为不会在 Railway 每次部署时都重新消耗 XAPI 配额。

## 如果你想让 Railway 在构建时自动生成 shared-following 数据

需要配置这些环境变量：

- `GENERATE_SHARED_FOLLOWING=true`
- `XAPI_API_KEY=你的 xapi key`

可选环境变量：

- `XAPI_FOLLOWING_PAGE_SIZE=100`
- `XAPI_MAX_FOLLOWING_PAGES=10`
- `SHARED_FOLLOWING_SOURCE_LIMIT=20`

其中：

- `SHARED_FOLLOWING_SOURCE_LIMIT` 很适合你不熟时先小范围试跑
- 比如设成 `10` 或 `20`，先确认 Railway 构建链路没问题
- 确认稳定后，再去掉它或者调大

## 推荐的 Railway 试跑顺序

第一次建议这样配：

- `GENERATE_SHARED_FOLLOWING=true`
- `XAPI_API_KEY=你的 key`
- `SHARED_FOLLOWING_SOURCE_LIMIT=10`

这样会只拿前 10 个 Top300 账号去生成 shared-following 候选池，速度更快，也更不容易超时。

如果确认没问题，再逐步提高：

- `20`
- `50`
- 最后再考虑全量 `300`

## 本地模拟 Railway

不生成 shared-following：

```bash
npm install
npm run build:railway
npm run start
```

模拟 Railway 自动生成：

```bash
GENERATE_SHARED_FOLLOWING=true
XAPI_API_KEY=你的key
SHARED_FOLLOWING_SOURCE_LIMIT=10
npm run build:railway
```

## 你现在最该怎么配

如果你只是想先把站部署上去：

- 不要开 `GENERATE_SHARED_FOLLOWING`
- 先直接部署

如果你想连 shared-following 一起上线，但又不想一开始就跑满 300：

- 开 `GENERATE_SHARED_FOLLOWING=true`
- 加 `XAPI_API_KEY`
- 再加 `SHARED_FOLLOWING_SOURCE_LIMIT=10`

这样最稳。
