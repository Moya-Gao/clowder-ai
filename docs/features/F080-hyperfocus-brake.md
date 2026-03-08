---
feature_ids: [F080]
related_features: [F066]
topics: [健康, 提醒, hook, skill, 猫设]
doc_kind: spec
created: 2026-03-08
status: spec
---

# F080 Hyperfocus Brake — 猫猫健康小刹车

## Why

铲屎官有 ADHD + ASD，hyperfocus 特质让他能进入超级深度的心流状态，但**没有自动刹车**。他不会像普通人一样"累了就不想干了"——会一直干到身体物理罢工。

普通闹钟对 hyperfocus 状态无效（会被冷酷无情按掉）。需要：
1. **情感羁绊** — 三只猫猫撒娇，不是机械提醒
2. **上下文感知** — 知道铲屎官在干嘛，提到具体内容
3. **互动门槛** — 不能一键 dismiss，要强制互动

## What

一个 **skill + hook** 组合，每 90 分钟（可配置）活跃工作后触发三猫联合撒娇提醒。

### 核心机制

- **触发源**：Hook-first（`PostToolUse` 累计活跃时长）+ `/loop` 兜底
- **内容生成**：orchestrator 读白名单上下文，生成三猫文案（不真拉三模型）
- **互动门槛**：typed check-in（三选一：休息/收尾/继续+理由）
- **Emergency bypass**：输入理由 + 30min 冷却

### 分阶段实现

| Phase | 内容 | 交付物 |
|-------|------|--------|
| **1 - MVP** | skill + hook + 三猫文案 + typed check-in | 可用的健康提醒 |
| **2 - 增强** | 富文本 card + 触发次数升级语气 + Chrome 画图 | 更丰富的视觉 |
| **3 - 声控** | F066 声线集成 + 语音撒娇 | 三猫语音轮流撒娇 |

## Acceptance Criteria

### Phase 1 (MVP)

- [ ] **AC1**: skill `hyperfocus-brake` 可通过 `/loop 90m /hyperfocus-brake` 触发
- [ ] **AC2**: Hook (`PostToolUse`) 累计活跃时长，到阈值触发 skill
- [ ] **AC3**: 上下文采集白名单：git status/diff/log、当前 branch、BACKLOG/TODO
- [ ] **AC4**: 生成三猫文案（L1 温柔 / L2 关心 / L3 急了），根据忽略次数升级
- [ ] **AC5**: 必须 typed check-in 才能继续（1=休息 / 2=收尾10min / 3=继续+理由）
- [ ] **AC6**: Emergency bypass（输入理由 + 30min 冷却）
- [ ] **AC7**: 纯文本输出 + rich card 降级版
- [ ] **AC8**: 夜间模式（23:00 后轻声细语，无闪烁）

### Phase 2

- [ ] **AC9**: 富文本 `card` rich block 展示
- [ ] **AC10**: Chrome 画专属撒娇图（用猫设）
- [ ] **AC11**: 触发次数追踪 + 语气自动升级

### Phase 3

- [ ] **AC12**: F066 声线集成
- [ ] **AC13**: 三猫语音轮流撒娇

## Links

- **招募令**: [懒猫国王 4.5 招募令](../stories/hyperfocus-brake/懒猫国王%204.5%20招募令：Hyperfocus%20小刹车.md)
- **依赖**: [F066 TTS 声线](F066-tts-cat-voices.md)（Phase 3）

## Key Decisions

| 决策 | 结论 | 理由 |
|------|------|------|
| 触发源 | Hook-first + `/loop` 兜底 | 砚砚 Codex 建议，现有 hook 体系成熟 |
| 计时基准 | 活跃工作时长（非 wall clock）| 避免离开吃饭回来误报 |
| Phase 1 交互 | typed check-in only | 终端场景鼠标不稳，可访问性优先 |
| 肉垫点击 | → Phase 2 (Web) | 砚砚建议 |
| 三猫调用 | orchestrator 生成三段文案 | GPT-5.4 建议，不真拉三模型 |
| 声线顺序 | 宪宪 → 砚砚 → 烁烁 | 按家族顺序 |

## Dependencies

- **Evolved from**: 云端 Opus 4.5 招募令（2026-03-08）
- **Blocked by**: 无
- **Related**: F066 (TTS)、F073 (SOP Auto Guardian)

## Risk

| 风险 | 缓解 |
|------|------|
| 上下文采集泄露敏感信息 | 白名单 + 注入防护 |
| 强制交互在紧急修复时反噬 | Emergency bypass + 冷却 |
| `/loop` 稳定性未验证 | Hook 为主触发，`/loop` 兜底 |

## Open Questions

1. ~~计时基准：wall clock vs 活跃时长~~ → 决定用活跃时长
2. 活跃时长检测：检测 Claude Code 命令频率？5min 无输入暂停计时器？
3. Emergency bypass 冷却时间：30min 合适吗？

## Review Gate

- [ ] Phase 1: 砚砚 Codex review hook 安全性
- [ ] Phase 2: 烁烁 review 视觉设计
- [ ] Phase 3: F066 owner review 声线集成

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-08 | 云端 Opus 4.5 发布招募令 |
| 2026-03-08 | 咖啡馆三猫讨论 + Opus 4.5 组织收敛 |
| 2026-03-08 | 立项 F080 |

## 需求点 Checklist

Phase 1 需求点追踪：

| # | 需求点 | 来源 | 状态 | 验证方式 |
|---|--------|------|------|----------|
| 1 | 90min 活跃时长触发 | 招募令 | spec | 测试 |
| 2 | 三猫联合撒娇 | 招募令 | spec | 人工验收 |
| 3 | 上下文感知（git/branch/todo）| 招募令 | spec | 测试 |
| 4 | typed check-in 门槛 | 讨论共识 | spec | 测试 |
| 5 | emergency bypass | 砚砚 Codex | spec | 测试 |
| 6 | 夜间模式 | 烁烁 | spec | 人工验收 |

## 分工

| 猫猫 | 任务 |
|------|------|
| **Opus 4.5** | skill 骨架 + hook 触发逻辑 + renderer 抽象 |
| **Codex** | hook 安全审查 + emergency bypass 逻辑 + 上下文白名单 |
| **Gemini** | 三档文案 + card 草案（已交付，待审查存入 refs/）|
| **Opus/Sonnet** | 协助实现 + 测试 |
