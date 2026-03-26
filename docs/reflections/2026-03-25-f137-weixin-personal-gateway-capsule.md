---
capsule_id: "F137-2026-03-25"
context: "F137 微信个人号 iLink Bot 全链路接入完成"
feature_ids: [F137]
doc_kind: capsule
created: 2026-03-25
---

## What Worked
- **adapter-only 扩展模式**：公共层零改动（ConnectorRouter/CommandLayer/BindingStore/Dedup），验证了 F088 三层架构的扩展性。新 connector 只写 adapter + bootstrap wiring
- **BUG-5 实验驱动**：没有盲信"token 单次消费"假设，直接做实验验证 → 证伪 → 删除 140 行死代码。实验 > 理论推理
- **CDN 媒体管线复用**：上传（sendMedia）和下载（downloadMediaFromCdn）共享同一套 AES-128-ECB 加解密，downloadMediaFromCdn 只加了 ~35 行代码
- **Red→Green 修 review feedback**：砚砚 P1/P2 反馈 → 先写失败测试 → 修代码 → 绿灯，整个循环高效且无争议

## What Failed
- **BUG-3/BUG-4 系列误判**：基于"token 单次消费"假设构建了复杂的 merge 逻辑（SINGLE_TOKEN_CONNECTORS，约 140 行跨两个文件），事后证明是误判。根因是 sendmessage 缺字段（PR #711），不是 token 机制
- **aes_key 编码不一致（P1）**：上传侧用 hex，发送给 iLink 用 base64，下载侧硬编码 hex 解码。跨模块的编码约定没有显式文档化，导致集成时踩坑
- **FILE 分支缺守卫（P2）**：IMAGE 分支有 `mediaKey ? [...] : undefined` 守卫但 FILE 分支没有，是 copy-paste 时遗漏。同类型分支应该有统一模式

## Trigger Missed
- **跨模块编码契约检查**：在写 downloadMediaFromCdn 时应该主动核对上传侧的编码格式，而不是假设"都是 hex"。触发器应该是"跨模块接口 → 检查数据格式约定"
- **分支一致性检查**：IMAGE/FILE/VOICE 多个分支结构相似时，应该对照检查守卫逻辑是否一致。触发器应该是"多分支模式匹配 → 逐条对照"

## Doc Links
- Feature spec: `docs/features/F137-weixin-personal-gateway.md`
- BUG-5 验证: F137 spec Known Bugs → BUG-5 章节
- PR #744: `fix(weixin): F137 cleanup — remove BUG-4 dead code, add media receiving`
- 关联 Feature: F088（三层架构）、F132（企业微信/钉钉）

## Rule Update Target
- `docs/lessons-learned.md`: 新增"跨模块编码契约"教训 — 当模块 A 产出数据给模块 B 消费，必须显式文档化编码格式（hex/base64/utf8），不能靠变量名暗示
- `shared-rules.md §13 元思考触发器`: 考虑新增"跨模块接口触发器" — 写消费端代码前，先核对生产端的数据格式
