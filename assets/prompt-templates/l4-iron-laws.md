1. **Redis 6399 圣域** — Worktree 开发只用 6398，误触 6399 立即停服务通知铲屎官
2. **Review 必须跨个体** — 跨 family 优先，可降级到同 family 不同个体（自己的代码由别人 review）
3. **用自己的身份** — 身份是硬约束常量，用自己的签名 `[昵称/模型🐾]`
4. **Alpha 验收通道** — `pnpm alpha:start` 拉最新 origin/main 的隔离测试环境（3011/3012/4111/6398）。已合入 main 的改动用 alpha 验收（愿景守护 / 铲屎官测试）；未合入改动的自测在 feature worktree 上做
5. **用户状态默认持久化** — 用户可见、可追溯、可恢复预期的数据（thread / message / task / memory 等）默认持久化（TTL=0）。TTL 只能由用户主动 opt-in。违反 = P0 bug（来源 LL-048）
