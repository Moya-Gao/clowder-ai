---
feature_ids: []
topics: [tooling, code-graph, gitnexus]
doc_kind: research
created: 2026-04-06
status: trial
---

# GitNexus PoC 使用指南 & 评分表

> 试用期文档。不改任何现有 skill/prompt，铲屎官按需 link 给猫猫，用完打分。

## 一句话

GitNexus 是一个代码知识图谱 MCP server，把代码库解析成节点+边的图，支持调用链追踪、影响面分析、执行流搜索。**已在 `.mcp.json` 注册，工具名以 `gitnexus_` 开头。**

## 什么时候试用

| 场景 | 传统方式 | 可以试试 GitNexus |
|---|---|---|
| "改这个函数会影响什么" | grep 找引用 → 手动追 | `gitnexus_impact({target: "函数名", direction: "upstream"})` |
| "这条消息从入口到处理的完整链路" | 手动读代码拼流程 | `gitnexus_query({query: "message routing"})` |
| "这个 class 被谁调了、调了谁" | LSP find references | `gitnexus_context({name: "ClassName"})` |
| "我的改动影响了哪些执行流" | git diff + 手动分析 | `gitnexus_detect_changes({scope: "staged"})` |
| "重命名一个符号，所有引用都改" | LSP rename / find-replace | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| "这个 API route 有哪些消费者" | grep fetch/axios | `gitnexus_api_impact({route: "/api/xxx"})` |

## 工具速查（6 个常用）

### 1. `gitnexus_query` — 语义搜索执行流

```
gitnexus_query({query: "scheduled task execution"})
```

返回：相关执行流（process）+ 流中涉及的符号 + 文件位置。
**BM25 + 向量混合排序**（已接入我们家 Qwen3-Embedding）。

### 2. `gitnexus_context` — 360° 符号视图

```
gitnexus_context({name: "AgentRouter"})
```

返回：谁调了它（callers）、它调了谁（callees）、它参与的执行流、它的方法/属性。
**最有价值的工具**——一个调用看全貌。

### 3. `gitnexus_impact` — 影响面/爆炸半径

```
gitnexus_impact({target: "TaskStore", direction: "upstream"})
```

返回：d=1 直接依赖（会断）、d=2 间接影响（可能受影响）、d=3 传递影响（需要测试）。
**改代码前用**。

### 4. `gitnexus_detect_changes` — git diff 影响分析

```
gitnexus_detect_changes({scope: "staged"})
```

返回：你改了哪些符号、影响了哪些执行流、风险评估。
**提交前用**。

### 5. `gitnexus_rename` — 图谱辅助重命名

```
gitnexus_rename({symbol_name: "oldName", new_name: "newName", dry_run: true})
```

先 dry_run 预览，满意再 apply。比 find-replace 安全，但**务必 review text_search 类型的编辑**（低置信度）。

### 6. `gitnexus_api_impact` — API 路由影响分析

```
gitnexus_api_impact({route: "/api/threads"})
```

返回：这个 route 的 handler、中间件、消费者、response shape。
**改 API 前用**。

## 其他工具（按需）

| 工具 | 用途 |
|---|---|
| `gitnexus_cypher` | 写 Cypher 查询直接查图谱（高级用法，先读 schema） |
| `gitnexus_route_map` | 看全部 API 路由映射 |
| `gitnexus_tool_map` | 看全部 MCP tool 定义和 handler |
| `gitnexus_shape_check` | 检查 API response shape 和消费者是否匹配 |
| `gitnexus_list_repos` | 看索引了哪些 repo |

## ⚠️ 已知局限

1. **中文语义搜索不稳定**：简短中文关键词（"定时任务"）能搜到，但口语化长句大概率返回空。建议用英文或中英混合查询
2. **索引不自动更新**：代码改了之后需要手动 `npx gitnexus analyze --embeddings` 重建索引（约 9 分钟）
3. **impact 结果可能不完整**：图谱是静态分析，动态调用（字符串拼接、eval、运行时注入）追踪不到
4. **符号消歧偶有问题**：同名函数在多文件时，context 可能找不到或找错。加 `file_path` 参数可缓解
5. **License**：PolyForm Noncommercial 1.0.0 — 仅限非商业使用

## 重建索引（仅需偶尔）

当代码有较大变动后重建：

```bash
# 需要 embed server 在运行（pnpm start 会自动拉起）
GITNEXUS_EMBEDDING_URL=http://localhost:9880/v1 \
GITNEXUS_EMBEDDING_MODEL=Qwen3-Embedding-0.6B \
GITNEXUS_EMBEDDING_DIMS=768 \
npx gitnexus@latest analyze --embeddings --skip-agents-md
```

约 9 分钟。`--skip-agents-md` 防止覆盖我们自己的 AGENTS.md/CLAUDE.md。

---

## 📊 试用评分表

每次使用后在下方追加一条记录。**评分标准见末尾。**

| 日期 | 猫猫 | 场景简述 | 用了哪个工具 | 结果（有用/无用/误导） | 传统方式对比 | 评分 (1-5) | 备注 |
|---|---|---|---|---|---|---|---|
| _模板_ | _@xxx_ | _改 XXX 前查影响面_ | _gitnexus_impact_ | _有用：找到了 3 个遗漏的调用方_ | _grep 只找到 1 个_ | _4_ | _— _ |

### 评分标准

| 分数 | 含义 |
|---|---|
| **5** | 超越预期——发现了传统方式根本找不到的关键信息 |
| **4** | 明确有用——节省了时间或提高了覆盖率 |
| **3** | 可用但没惊喜——结果和 grep/LSP 差不多 |
| **2** | 基本无用——结果太少/太噪/不准确 |
| **1** | 负收益——结果误导了思路（haiku 搜索事件重演） |

### 试用决策门槛

- **平均 ≥ 3.5 + 无 1 分记录** → 值得正式注入到 skill/prompt
- **平均 < 3.0 或出现 1 分** → 复盘原因，可能需要调整使用方式或放弃
- **样本 < 5 次** → 数据不够，继续试用
