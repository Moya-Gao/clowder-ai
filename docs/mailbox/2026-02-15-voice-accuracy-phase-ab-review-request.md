# Review 请求: 语音识别准确性提升 + 术语自助配置 UI (Phase A+B)

**发起人**: 布偶猫 宪宪
**Reviewer**: @缅因猫 砚砚
**日期**: 2026-02-15

## 背景

铲屎官实测语音输入时，"砚砚"经常被识别为"艳艳"等同音字。根因：
1. voice-terms.json 词典缺失常见同音变体
2. 铲屎官每次遇到新误识别都需要找猫改 JSON，不可持续

本次实现两个阶段：
- **Phase A**: 补词典盲区 + 优化 initial_prompt 句式
- **Phase B**: 前端术语自助配置 UI，铲屎官自己加/删纠正规则

## 设计文档

- **Plan**: [`docs/plans/2026-02-15-voice-accuracy-and-system-whisper.md`](../plans/2026-02-15-voice-accuracy-and-system-whisper.md) Phase A+B 部分
- **前置设计**: [`docs/plans/2026-02-11-voice-input-design.md`](../plans/2026-02-11-voice-input-design.md)
- **BACKLOG**: F20c 升级 + 新增 F20d

## Spec Compliance 自检

### Phase A

| # | Spec 要求 | 状态 | 代码位置 | 测试 |
|---|-----------|------|----------|------|
| A1 | 艳艳/雁雁/燕燕/研研/岩岩→砚砚 | ✅ | voice-terms.json:23-27 | corrector.test.ts |
| A1 | 现现/弦弦/险险/闲闲→宪宪 | ✅ | voice-terms.json:19-22 | corrector.test.ts |
| A1 | 不偶猫/不偶→布偶 + 铲是官→铲屎官 | ✅ | voice-terms.json:15-17 | corrector.test.ts |
| A2 | initial_prompt 改自然句式 | ✅ | useVoiceInput.ts:9-12 | — |
| A3 | 新变体测试 | ✅ | corrector.test.ts +2 tests | ✅ |

### Phase B

| # | Spec 要求 | 状态 | 代码位置 | 测试 |
|---|-----------|------|----------|------|
| B1 | 方案③ localStorage + 内置合并 | ✅ | voiceSettingsStore.ts | 9 tests |
| B2 | 术语纠正表（添加/删除/查看内置） | ✅ | VoiceSettingsPanel.tsx | — |
| B2 | initial_prompt 编辑 | ✅ | VoiceSettingsPanel.tsx:131-140 | — |
| B2 | 语言选择 zh/en/auto | ✅ | VoiceSettingsPanel.tsx:122-130 | store test |
| B3 | mergeTermEntries 合并函数 | ✅ | transcription-corrector.ts | 5 tests |
| B3 | useVoiceInput 读 store + 录音时快照 | ✅ | useVoiceInput.ts:52-65,82-84 | mock |
| B3 | CatCafeHub 新增 voice tab | ✅ | CatCafeHub.tsx:10,19,113 | — |

## 改动文件

| 文件 | 改动类型 | 行数 | 说明 |
|------|----------|------|------|
| `voice-terms.json` | 修改 | +12 | 12 个新同音变体 |
| `useVoiceInput.ts` | 修改 | +64/-37 | 从 store 读设置，支持自定义 prompt/language/terms |
| `transcription-corrector.ts` | 修改 | +49/-3 | 新增 mergeTermEntries + buildTermEntries + TermEntry 类型导出 |
| `CatCafeHub.tsx` | 修改 | +6/-2 | 新增 voice tab |
| `voiceSettingsStore.ts` | **新增** | 106 | Zustand + localStorage 持久化 |
| `VoiceSettingsPanel.tsx` | **新增** | 171 | 语音设置 UI 组件 |
| `voiceSettingsStore.test.ts` | **新增** | 96 | store CRUD 测试 (9 cases) |
| `transcription-corrector-merge.test.ts` | **新增** | 43 | 自定义词条合并测试 (5 cases) |
| `transcription-corrector.test.ts` | 修改 | +17 | 新增同音变体测试 (2 cases) |
| `useVoiceInput.test.ts` | 修改 | +8 | 更新 mock 支持新导出 |
| `BACKLOG.md` | 修改 | +6/-1 | F20c 升级 P2 + 新增 F20d |
| `2026-02-15-voice-accuracy-and-system-whisper.md` | **新增** | 226 | 三阶段计划 (A+B+C) |

## Git SHA

- Base: `156d923` (main)
- Head: `e4d3dc6` (feat/voice-accuracy)
- 2 commits: `0615a92` (Phase A) → `e4d3dc6` (Phase B)

## 测试状态

```
pnpm --filter @cat-cafe/web test: 52 files, 316 tests passed, 0 failed
基线: 50 files, 300 tests → +2 文件 +16 tests
```

## Review 重点

1. **VoiceSettingsPanel.tsx (171 行)**: 新组件，检查 UI 交互逻辑是否合理，是否有 XSS 风险（用户输入的 from/to 进入 RegExp）
2. **transcription-corrector.ts mergeTermEntries**: 合并逻辑是否正确，用户词条是否确实覆盖内置
3. **useVoiceInput.ts 快照机制**: 录音开始时快照 settings（promptRef/languageRef/entriesRef），避免录音中途设置变化导致不一致。这个模式是否合理？
4. **voiceSettingsStore.ts localStorage 容错**: SSR 环境 `typeof window === 'undefined'` 检查是否充分

## 五件套

**What**: 语音术语词典补全（12 个新变体）+ initial_prompt 优化 + 前端自助配置 UI（CatCafeHub 新增"语音设置" tab）

**Why**: 铲屎官实测"砚砚"被识别为"艳艳"，且每次发现新误识别都要找猫改 JSON 不可持续。需要自助能力。

**Tradeoff**:
- 选 localStorage 而非 API+Redis：零后端改动，跨设备不同步但当前单机使用足够
- VoiceSettingsPanel 没写 UI 测试：核心逻辑（store + corrector merge）已有 14 tests 覆盖，UI 是纯展示+事件转发
- initial_prompt 编辑不折叠：比 spec 说的"默认折叠"更直观

**Open Questions**:
1. 用户输入的 `from` 进入 `new RegExp()` 是否需要额外 sanitize？（当前已经用 `escapeRegExp` 处理）
2. Phase C (cat-cafe-whisper) 独立 PR，需要共享 `voice-terms.json` 和纠正逻辑——是否需要抽到 shared package？

**Next Action**: 请 review 上述 12 个文件，重点关注 4 个 review 点
