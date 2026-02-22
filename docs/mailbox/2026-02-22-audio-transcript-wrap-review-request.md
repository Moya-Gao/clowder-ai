## Review 请求: Audio 富块转写文本截断修复

### 背景
铲屎官反馈：语音富块可播放，但当 `audio` 富块的 `text` 较长时，转写文本被截断显示，不利于阅读。

### 设计文档
- Bug Report: `docs/bug-report/audio-block-transcript-truncate/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 长语音转写文本可完整阅读 | ✅ | 移除 `truncate`，改为可换行 |
| 2 | 维持语音富块现有行为（播放/时长/样式主结构） | ✅ | 仅修改转写文本容器样式 |
| 3 | 回归测试覆盖该问题 | ✅ | 新增 `voice transcript text wraps instead of truncating` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/components/rich/AudioBlock.tsx` | 修改 | 转写文本样式从单行截断改为多行换行 |
| `packages/web/src/components/__tests__/audio-block-voice.test.ts` | 修改 | 新增渲染回归测试，防止再次引入 `truncate` |
| `docs/bug-report/audio-block-transcript-truncate/bug-report.md` | 新增 | 记录复现、根因、修复、验证 |

### Git SHA
- Base: `8538310`
- Head: `本次修复提交（commit 后可用 git rev-parse HEAD 查看）`

### 测试状态
```bash
pnpm --filter @cat-cafe/web test -- src/components/__tests__/audio-block-voice.test.ts
# 5 passed, 0 failed (Red->Green 回归用例已转绿)

pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/web test -- src/components/__tests__/audio-block-voice.test.ts src/components/__tests__/card-block-markdown.test.ts
# 11 passed, 0 failed
```

补充：`pnpm --filter @cat-cafe/web test` 全量在当前 worktree 存在基线环境问题（`@cat-cafe/shared` 入口解析失败），不由本改动引入。

### Review 重点
1. `AudioBlock` 转写文本样式改动是否满足“完整可读”与“布局可控”的平衡。
2. 新增回归测试是否足够防止再次回退到单行截断。

### 五件套

**What**: 修复 `audio` 富块转写文本被截断的问题，并补回归测试。  
**Why**: 语音文本核心价值是可读性，单行截断会丢失信息。  
**Tradeoff**: 消息高度会上升；本次先不加“展开/收起”交互，优先最小修复。  
**Open Questions**: 是否需要后续补“默认折叠 + 展开”以控制极长文本高度。  
**Next Action**: 请 review 上述 3 个文件并确认可放行。  
