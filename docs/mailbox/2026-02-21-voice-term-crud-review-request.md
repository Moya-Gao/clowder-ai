---
feature_ids: []
topics: [voice, term, crud]
doc_kind: mailbox
created: 2026-02-21
---

## Review 请求: Voice Term CRUD + IME Composition Guard

### 背景

铲屎官反馈语音纠正设置面板有两个 bug：
1. 自定义术语只能添加，缺少编辑和删除功能
2. 中文输入法下输入英文术语（如 GPT）按回车，会被 IME 拦截产生乱码

### 设计文档

无独立 spec（小 bug 修复）。Store 层已有 `updateTerm`/`removeTerm` 方法，UI 未暴露。

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 术语可编辑 | ✅ | CustomTermRow 点击铅笔 → inline input，Enter 保存，Esc 取消 |
| 2 | 术语可删除 | ✅ | 删除按钮始终可见（不再 hover-only），移动端也可用 |
| 3 | IME 不干扰 Enter | ✅ | 所有 onKeyDown 加 `!e.nativeEvent.isComposing` 守护 |
| 4 | 编辑模式也防 IME | ✅ | handleEditKeyDown 同样有 isComposing 守护 |
| 5 | Store 测试通过 | ✅ | 12/12 pass |
| 6 | TypeScript 零错误 | ✅ | tsc --noEmit 通过 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| packages/web/src/components/VoiceSettingsPanel.tsx | 修改 | +100/-13，添加编辑模式 + IME 守护 |

### Git SHA
- Base: 7fd230f (main HEAD)
- Head: 6645785

### 测试状态
```
voiceSettingsStore.test.ts: 12 passed, 0 failed
tsc --noEmit: 0 errors
```

### Review 重点
1. CustomTermRow 编辑模式的状态管理是否正确（editing/editFrom/editTo）
2. IME `isComposing` 守护是否覆盖所有 Enter 入口
3. 删除按钮移除 hover-only 后的视觉效果

### 五件套

**What**: VoiceSettingsPanel 增加术语编辑/删除 UI + IME composition 守护
**Why**: 铲屎官反馈只能添加不能改删，中文输入法下英文术语会乱码
**Tradeoff**: 选择 inline 编辑（点击切换 input）而非弹窗，保持轻量；删除按钮始终可见而非 hover-only，牺牲一点视觉简洁换取移动端可用性
**Open Questions**: 无
**Next Action**: 请 review VoiceSettingsPanel.tsx 的改动
