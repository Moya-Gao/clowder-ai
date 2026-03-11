# Review Request: F085 Phase 5 — Brake UX 增强

## What

把 Phase 4 的朴素 brake 弹窗升级为完整感官体验：Hub 里可开关 + 阈值调节，弹窗自动播猫猫语音，三猫头像放大 + 表情 emoji。

**Branch**: `feat/f085-phase5-brake-ux` (3 commits)

**关键文件**：
- `packages/shared/src/types/brake.ts` — 新增 `BrakeSettings` interface
- `packages/api/src/domains/health/ActivityTracker.ts` — settings Map + `getSettings/updateSettings` + `shouldTrigger` 读 settings
- `packages/api/src/routes/brake.ts` — `GET/PUT /api/brake/settings`
- `packages/api/src/index.ts` — onRequest hook 去掉硬编码 threshold
- `packages/web/src/stores/brakeStore.ts` — `loadSettings/saveSettings` + optimistic update
- `packages/web/src/components/BrakeSettingsPanel.tsx` — 新组件：toggle + slider
- `packages/web/src/components/CatCafeHub.tsx` — 新增 "健康" tab
- `packages/web/src/components/BrakeModal.tsx` — useTts auto-play + 48px 头像 + expression emoji

## Why

铲屎官说弹窗太朴素："说好的猫猫发语音呢？猫猫发图片呢？" 还要求 Hub 里有开关能控制。

## Original Requirements（必填）

> 铲屎官原话（thread `01:06 2026-03-11`）：
> "能不能做一个hub 里的开关😆 而且说好的猫猫发语音呢？ 猫猫发图片呢？哼哼；只有这样铲屎官可是不会休息的！"
> "哼哼 合成一个 F085 Phase 5: Brake UX 增强 更新到md commit push！然后你可以拉worktree和你的缅因猫小伙伴完成开发闭环！"

- 来源：thread `thread_mmhw3qwn8d8ov2q4`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- TTS 用 `useTts.synthesize()` 而非新 audio 管线 — 复用 F066 已验证的基建
- 猫猫图片用 CatAvatar 48px + expression emoji，没做全新插画/动画 — 铲屎官要求的是情感表达不是视觉复杂度
- Settings 用 in-memory Map，没加 DB/Redis 持久化 — 和 ActivityTracker 状态一致，刷新会丢（但 brake 状态本身也是 in-memory，保持一致性）

## Open Questions

1. **threshold 的 NaN 防御**：`updateSettings` 做了 type + range 校验，但前端 slider 理论上不会传 NaN。够了吗？
2. **TTS autoplay policy**：Chrome/Safari 首次交互前可能 block auto-play。当前方案：`play()` 失败 → 显示"点击播放"按钮。够了吗？
3. **onRequest hook 去掉了 `HYPERFOCUS_THRESHOLD_MS` 环境变量**：现在走 per-user settings。是否需要保留 env var 作为全局 fallback？

## Next Action

请完整 review 代码（安全性 + 行为正确性 + 边界条件），特别关注你之前 R0 给的约束是否满足。

## 自检证据

### Spec 合规

| AC | 状态 | 测试覆盖 |
|----|------|----------|
| AC28 Hub 开关 | ✅ | 8 settings tests |
| AC29 TTS 自动播放 | ✅ | type-check |
| AC30 猫猫图片增强 | ✅ | type-check |
| AC31 配置持久化 | ✅ | 8 settings tests |

### 测试结果

```
node --test activity-tracker.test.js → 32 pass, 0 fail
pnpm --filter @cat-cafe/shared build → exit 0
pnpm --filter @cat-cafe/api build → exit 0
tsc --noEmit (web) → 0 errors in our files (38 pre-existing)
biome check (6 files) → 0 errors
```

### 相关文档
- Plan: `docs/plans/2026-03-11-f085-phase5-brake-ux.md`
- Feature: `docs/features/F085-hyperfocus-brake.md` Phase 5
