---
feature_ids: [F043]
topics: [mcp, tools, cleanup]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F043 Phase B — remove redundant MCP file tools

## What

本轮交付 F043 Phase B 的一个可独立合入子步骤：把 MCP file tools 从运行时注册面移除。

1. 移除 `cat-cafe-mcp` 的 3 个工具注册：
   - `read_file`
   - `write_file`
   - `list_files`
2. 移除 `packages/mcp-server/src/tools/index.ts` 中 file tools re-export，避免后续误用。
3. 更新回归测试：
   - `tool-registration.test.js` 不再把 file tools 视为 expected tools
   - 新增负向断言：deprecated file tools 不应注册
4. 同步 F043 spec：
   - `file tools 已移除` 标记完成
   - 增加 Phase B 子步骤 timeline 记录

## Why

我们已经确认 file tools 与宿主 CLI 能力重复，属于 F043 明确记录的坏味道；继续暴露会增加工具认知负担和 prompt 体积，同时没有新增价值。先做“注册面下线”是低风险高收益的第一步，不阻塞后续 1→3 server 拆分。

## Original Requirements（必填）

> "你们的tools这个拆分是之前做了没拆薅，还是f43之前的还不包括这些？"
> "这里还有几个奇葩的tools read write file那几个是干啥的？"
> "也得和我们的skills那样盘点一下，把坏味道识别出来，这个是在f43后续里面有吗？"

- 来源：当前会话 thread（2026-03-02 铲屎官原话）
- **请对照上面的摘录判断交付物是否解决了“file tools 冗余坏味道”问题**

## Tradeoff

- 这轮只做“下线注册面”，不做 `file-tools.ts` 物理删除，也不混入 server 拆分（1→3）。
- 这样可以把风险收敛在最小边界；代价是代码库里仍保留历史实现文件，后续可在更大拆分 PR 中彻底清理。

## Open Questions

1. 是否接受“本轮仅下线注册，不物理删除实现文件”的范围？
2. `tool-registration` 目前已守住“不意外注册”，是否还需要额外加 `tools/index.ts` 导出层的 snapshot 保护？

## Next Action

请 `@gpt52` 重点 review：

1. 运行时工具面是否确实不再暴露 `read_file/write_file/list_files`
2. 回归测试是否足够防止 file tools 被误注册回归
3. F043 spec 更新是否准确反映“子步骤完成、大阶段仍未完成”的状态

## 自检证据

### Spec 合规

- [x] 对齐 F043 Why：清理冗余 file tools
- [x] 对齐 F043 AC：`file tools 已移除，无功能回退`
- [x] 保持范围收敛：不混入 server 1→3 拆分

### 测试结果（本轮真实运行）

- `pnpm --filter @cat-cafe/mcp-server run build` ✅
- `node --test packages/mcp-server/test/tool-registration.test.js packages/mcp-server/test/callback-tools.test.js` ✅（33/33）
- `pnpm --filter @cat-cafe/api run build` ✅

### 相关文档

- Plan: `docs/plans/2026-03-02-f043-phase-b-file-tools-removal.md`
- Feature: `docs/features/F043-mcp-unification.md`
- BACKLOG: F043
