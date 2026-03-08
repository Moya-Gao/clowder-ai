---
feature_ids: [F084]
topics: [claude, rescue, config-hub, design-gate]
doc_kind: discussion
created: 2026-03-08
---

# 2026-03-08 F084 Design Gate — 布偶猫救援中心

## 背景

`PR #303` 已经把底层急救能力合进了主线：

- runtime 能识别 `Invalid signature in thinking block`
- 有脚本能按单条或批量救活坏掉的 Claude session

但铲屎官的真实目标不是“知道有脚本”，而是“在咱们自己的 Hub 里点一下就能救活布偶猫”。

## 铲屎官确认过的方向

铲屎官明确拍板：

1. 单独 kickoff 新 feat，不继续塞进 `F081`
2. 把“布偶猫救援”的侦探故事、根因、脚本、runtime 提示都挂进新 feat
3. `Config Hub 一键救活布偶猫` 作为第一版目标
4. `F081` 只保留 related link，不扩锅

### 原始需求摘录

> “给‘布偶猫救援’单独 kickoff 一个新 feat”
> “把今天的救援 bug report、脚本、runtime 提示都挂进去”
> “把 Config Hub 一键救活布偶猫 作为这个 feat 的第一版目标”
> “F081 只补一条 related link，不扩锅”

## 多猫讨论结论

### 宪宪（Opus）给出的落点判断

1. **入口位置**：放在 Config Hub 账号配置层，不挂在 F062 provider profile 卡片上
   - 原因：坏 thinking signature 是 **session 级**问题，不是 profile 级配置问题
   - 同一个 provider/profile 下，可能有的 session 正常，有的已坏

2. **结果展示**：第一版用轻量 checklist + toast，不需要 modal
   - 原因：结果是“扫了几只、修了几只、备份了几只”，轻量反馈就足够
   - modal 对这类 maintenance 操作偏重

## 设计决议

### 决议 1：入口承载面

F084 V1 放在 `CatCafeHub -> 账号配置` tab 内，与 provider profiles 同 tab，但作为单独的 rescue section，而不是混入单个 profile item。

### 决议 2：交互形态

第一版走最小闭环：

1. `扫描坏掉的布偶猫`
2. 展示 checklist：
   - session id
   - transcript 文件路径
   - 将被移除的纯 thinking turn 数
3. `一键救活选中布偶猫`
4. toast 汇总结果：
   - 救活了几只
   - 跳过了几只
   - 是否已自动备份

### 决议 3：自动救援边界

不在 V1 默认开启自动救援。  
自动自愈只保留为 V2 方向，且默认关闭。

## 线框（V1）

```text
账号配置
├─ 布偶猫 Provider Profiles
│  └─ 现有 F062 内容
└─ 布偶猫救援中心
   ├─ 说明文案：
   │  检测并修复因 thinking signature 损坏而无法 resume 的 Claude session
   ├─ [扫描坏掉的布偶猫]
   ├─ checklist
   │  ├─ [x] 07bdb2dc-...  125 个坏 thinking turn  ~/.claude/projects/...jsonl
   │  ├─ [ ] b0b6d295-...  200 个坏 thinking turn  ~/.claude/projects/...jsonl
   │  └─ [ ] 8760eebe-...   85 个坏 thinking turn  ~/.claude/projects/...jsonl
   ├─ [一键救活选中布偶猫]
   └─ 最近结果
      - 已备份到 ~/.claude/backups/...
      - 救活 3 只，跳过 1 只
```

## 结论

Design Gate 通过，进入实施计划阶段。

下一步不是继续讨论“要不要做”，而是按 `F084` V1 把：

- 扫描 API
- rescue API
- Config Hub rescue section
- checklist + toast 反馈
- 幂等与误判回归测试

串成完整闭环。
