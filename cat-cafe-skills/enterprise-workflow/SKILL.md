---
name: enterprise-workflow
description: >
  企业微信工作流自动化：文档、表格、待办、会议一键创建。
  Use when: 铲屎官要求创建企微文档/表格/待办/会议，或要求一句话生成完整工作流。
  Not for: 普通聊天、消息收发（那是 F088 Transport Plane 的活）。
  Output: 企微资源链接（文档 URL、会议链接等）通过 callback 返回。
triggers:
  - "创建文档"
  - "写个文档"
  - "create doc"
  - "建个表格"
  - "创建表格"
  - "smart table"
  - "建个待办"
  - "创建待办"
  - "todo"
  - "约个会"
  - "创建会议"
  - "create meeting"
  - "整理成文档"
  - "拆成任务"
  - "golden chain"
  - "工作流"
  - "enterprise workflow"
---

# Enterprise Workflow — 企微工作流自动化

F162: 通过企微官方 CLI (`wecom-cli`) 驱动企业操作。
架构决策：ADR-029 — ActionService + CliExecutor + callback route。

## 能力总览

| 操作 | Callback action | 说明 |
|------|----------------|------|
| 创建文档 | `create_doc` | Markdown 文档，可带内容 |
| 创建智能表格 | `create_smart_table` | 自定义字段 + 数据行 |
| 创建待办 | `create_todo` | 分发给指定人员 |
| 创建会议 | `create_meeting` | 预约会议，自动邀请 |
| **黄金链路** | `golden_chain` | 一句话 → 文档 + 表格 + 待办 + 会议 |

## 调用方式

**所有操作必须通过 callback route，不要裸调 CLI。**（ADR-029 Decision 2）

```
POST /api/callbacks/wecom-action
Content-Type: application/json

{
  "invocationId": "<your invocationId>",
  "callbackToken": "<your callbackToken>",
  "action": "<action_name>",
  ...action-specific params
}
```

## 黄金链路（Golden Chain）

铲屎官说一句话，你做这些事：

1. **解析意图**：从铲屎官的话中提取文档名、任务列表、会议时间、参与人
2. **调 callback**：用 `golden_chain` action 一次搞定
3. **回贴结果**：把文档/表格/待办/会议的链接整理好发回去

### golden_chain 参数示例

```json
{
  "action": "golden_chain",
  "docName": "Q2 产品 PRD",
  "docContent": "# Q2 产品规划\n\n## 目标\n...",
  "tableName": "Q2 任务跟踪表",
  "tasks": [
    { "content": "完成 API 设计", "assigneeUserId": "zhangsan", "remindTime": "2026-04-20 09:00:00" },
    { "content": "前端 UI 实现", "assigneeUserId": "lisi" }
  ],
  "meetingTitle": "Q2 PRD 评审会",
  "meetingStart": "2026-04-20 14:00",
  "meetingDurationSeconds": 3600,
  "meetingInviteeUserIds": ["zhangsan", "lisi", "wangwu"]
}
```

### 回贴格式

拿到结果后，组织成简洁的回复：

```
已完成工作流创建：

📄 文档: Q2 产品 PRD — https://doc.weixin.qq.com/xxx
📊 表格: Q2 任务跟踪表 — https://doc.weixin.qq.com/yyy
✅ 待办: 2 条已分发（张三、李四）
🎥 会议: Q2 PRD 评审会 — https://meeting.tencent.com/dm/zzz
```

## 单独操作

### create_doc

```json
{
  "action": "create_doc",
  "docName": "会议纪要",
  "content": "# 会议纪要\n\n## 讨论内容\n..."
}
```

### create_smart_table

```json
{
  "action": "create_smart_table",
  "tableName": "Bug 跟踪表",
  "fields": [
    { "fieldTitle": "Bug", "fieldType": "FIELD_TYPE_TEXT" },
    { "fieldTitle": "优先级", "fieldType": "FIELD_TYPE_SINGLE_SELECT" },
    { "fieldTitle": "负责人", "fieldType": "FIELD_TYPE_TEXT" }
  ],
  "records": [
    { "Bug": "登录超时", "优先级": "P1", "负责人": "张三" }
  ]
}
```

### create_todo

```json
{
  "action": "create_todo",
  "content": "Review Q2 PRD",
  "followerUserIds": ["zhangsan", "lisi"],
  "remindTime": "2026-04-20 09:00:00"
}
```

### create_meeting

```json
{
  "action": "create_meeting",
  "title": "PRD 评审",
  "startDatetime": "2026-04-20 14:00",
  "durationSeconds": 3600,
  "inviteeUserIds": ["zhangsan", "lisi"]
}
```

## 获取用户列表

如果不知道 userId，先让 Hub 查通讯录（这个走 TypeScript import，不走 callback）。
面试 demo 场景下，用铲屎官自己的 userId。

## 注意事项

- **权限**：需要企微应用有对应 API 权限（文档/待办/会议/通讯录）
- **≤10 人企业限制**：部分功能可能受限，遇到时降级处理
- **错误码**：502 = 企微 API 报错，503 = wecom-cli 不可用
- **不要裸调 CLI**：审计链会断裂（ADR-029 Decision 2）
