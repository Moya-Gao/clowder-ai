---
feature_ids: [F041]
topics: [hub, ux, capability, workflow]
doc_kind: mailbox
created: 2026-02-28
---

# Review 请求：Hub「能力中心」切换闪动修复 + 忽略本地生成目录

## 背景

铲屎官反馈：从 Hub 切到「能力中心」tab 会“突然闪动一下”，但切到其它 tab（如「猫猫总览」「通知」）正常。

原因是我们在 Hub 中对 tab 内容是条件渲染（`tab === 'capabilities' ? <HubCapabilityTab /> : ...`），导致每次切换都会 **unmount/remount** 能力中心。能力中心本身 mount 时会触发 fetch，并短暂显示 `加载中...`，造成视觉闪动。

此外，本 worktree 会生成 `.codex/`、`.gemini/` 本地目录，不应进入 PR。

## 铲屎官原始需求（🔴 对照）

Discussion：`docs/discussions/2026-02-26-capability-dashboard/README.md`

原话摘录（≤5 行）：
1. “我都不知道你们三只猫到底挂了什么！”
2. “我不要再跑到 Claude Code、跑到 Codex、跑到 Gemini CLI 或 Antigravity 里面一个个管。”
3. “我现在甚至用你们来开发我公司内的代码。我在猫猫咖啡打开 dare-framework，让你们开发 dare-framework。”
4. “我很害怕以后有 100 个 Skills，占了一堆上下文。我要如何只给每只猫匹配它需要的 Skills？”

这次改动属于 UX/稳定性打磨，目标是让 Hub 作为“唯一管理入口”在交互上不抖动、不误导。

## 改动概览（What）

1. **根治闪动**：能力中心首次打开后保持 mounted，切 tab 仅隐藏/显示，避免反复 remount 导致的 loading flash。
2. **清理本地生成物**：`.gitignore` 增加 `.codex/`、`.gemini/`，防止误入版本库。

## Why / Tradeoff

- Why：移除 module-level cache 之类的 hack，避免跨项目/跨用户数据串味，用 UI 架构手段解决 UI 闪动。
- Tradeoff：能力中心首次打开后会常驻内存直到关闭 Hub（仅当前 Hub 打开周期内），换取稳定体验。

## 改动文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/web/src/components/CatCafeHub.tsx` | 修改 | 增加 `capTabEverOpened`，能力中心首次访问后常驻并用 `hidden` 切换可见性 |
| `.gitignore` | 修改 | 忽略 `.codex/`、`.gemini/` |

## Git SHA

- Base：`55c9684`
- Head：`87f98f4`

## 测试状态（Verify）

```
pnpm --filter @cat-cafe/web build: PASS
pnpm test:api:redis: PASS (isolated redis, 2247 pass / 0 fail)
```

## Review 重点（请 reviewer 聚焦）

1. `CatCafeHub.tsx` 里能力中心“常驻 + hidden”切换的实现是否有副作用（比如 effect 泄漏/性能问题）？
2. `.gitignore` 增加 `.codex/.gemini` 是否符合我们仓库约定？

## 五件套

- What：能力中心常驻避免闪动 + 忽略本地生成目录
- Why：Hub 交互稳定，避免 cache hack 引入隐患
- Tradeoff：能力中心在 Hub 打开期间常驻内存
- Open Questions：是否需要把“常驻策略”推广到其它会 fetch 的 tab？
- Next Action：请宪宪 review 上述两处改动并给放行结论

