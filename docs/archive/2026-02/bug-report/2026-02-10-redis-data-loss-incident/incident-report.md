---
feature_ids: []
topics: [redis, data, loss]
doc_kind: bug-report
created: 2026-02-10
---

# 事故报告：2026-02-10 Redis 数据丢失事件

> 报告人：布偶猫 🐾
> 发生时间：2026-02-10 晚间
> 影响范围：Redis 6399 数据从 307 keys 降至 15 keys
> 恢复状态：✅ 已完全恢复（从 RDB 备份）

---

## 1) 事故发现

**报告人**：铲屎官 🐬
**发现时间**：2026-02-11 00:51
**发现方式**：访问 `http://localhost:3001/thread/thread_mlh8vns4sqxtsh40` 发现聊天记录全部消失

**症状**：
- 前端显示："所有 session 都看不到了"
- API `/api/threads` 只返回 1 个 thread (`default`)
- Redis dbsize 仅剩 15 keys

---

## 2) 影响范围

### 丢失数据（恢复前）

| 项目 | 丢失前 | 丢失后 | 丢失率 |
|------|--------|--------|--------|
| Redis keys | 307 | 15 | 95% |
| Threads | 17 | 1 | 94% |
| Messages | ~200+ | ~5 | 97% |

**保留数据**：
- 仅剩 `default` thread
- 少量 session/invocation/cursor 键

**丢失数据**：
- 16 个用户创建的 threads
- 约 200+ 条消息
- 相关的 tasks/summaries/memory

---

## 3) 根因分析

### 已确认事实

1. **数据确实存在于备份中**：
   - `dev-pre-start-20260210-210921.rdb` (21:09:21) 包含完整数据 (307 keys)
   - `dev-pre-start-20260210-210949.rdb` (21:09:49) 数据已减少 (144 keys)
   - 数据丢失发生在 **21:09:21 到 21:09:49 之间**（28 秒窗口）

2. **多个服务实例同时运行**：
   - 布偶猫在 worktree `cat-cafe-ux-polish` 工作
   - 发现有 tsx 进程在 worktree 路径运行（PID 26529, 21370）
   - 所有实例都连接到同一个 Redis 6399

3. **布偶猫的操作时间线**：
   - 创建 worktree `cat-cafe-ux-polish`
   - 安装 puppeteer 依赖
   - 实现 F19/F18/F17 功能
   - **没有主动启动服务**（无 `pnpm start` 记录）

4. **Redis 日志无异常**：
   - 没有 FLUSHDB/FLUSHALL 命令记录
   - 没有异常 shutdown 记录

### 疑似根因（待确认）

**最可能原因：worktree 中的热重载触发了服务重启**

推理链：
1. 布偶猫在 worktree 修改了后端代码（thread-export.ts, ImageExporter.ts）
2. 如果主 worktree 的 dev 服务在运行 `tsx watch`，可能监听了整个项目目录（包括其他 worktree）
3. 文件变化触发热重载 → 服务重启
4. 重启时可能：
   - 使用了错误的初始化逻辑
   - 清空了 Redis（初始化脚本？）
   - 切换了数据源

**备选假设**：
- 多个 API 实例竞态导致数据覆盖
- 自动化清理脚本误触发
- Redis 持久化配置问题

### 无法直接证明（证据不足）

- 具体是哪个进程在何时清空了数据
- 是否有手工执行的命令（缺操作审计）
- 热重载的具体触发路径

---

## 4) 恢复过程

### 恢复操作时间线

1. **00:51** - 发现数据丢失，dbsize=15
2. **00:52** - 从 markdown 恢复 6 个历史 threads (108 消息)
3. **00:53** - 发现 thread_mlh8vns4sqxtsh40 不在 markdown 备份中
4. **00:54** - grep 搜索 RDB 备份，找到 4 个包含目标 thread 的文件
5. **00:54** - 误选 210949 备份恢复 → dbsize=144 (不完整)
6. **00:54** - 重新选择 210921 备份恢复 → dbsize=307 ✅
7. **00:55** - 验证：17 个 threads 全部恢复 ✅

### 使用的工具

1. **Markdown 恢复**：`pnpm redis:md:restore:apply`
2. **RDB 恢复**：`./scripts/redis-restore-from-rdb.sh --source <file> --yes`
3. **备份搜索**：`grep -l "thread_id" ~/.cat-cafe/redis-backups/dev/*.rdb`

### 恢复错误

**布偶猫的失误**：
1. ❌ 第一次选错备份文件（210949 vs 210921，相差 28 秒）
2. ❌ 没有先验证备份内容就盲目恢复
3. ✅ 第二次正确选择并成功恢复

---

## 5) 预防措施

### 立即执行（P0）

1. **[P0] 禁止 worktree 之间互相影响**
   - **问题**：worktree 文件变化可能触发主 worktree 服务热重载
   - **措施**：
     - ✅ 已有：CLAUDE.md 第 9 条要求 worktree 隔离
     - ⚠️ 需要：明确禁止在 worktree 中启动会连接生产 Redis 的服务
     - ⚠️ 需要：tsx watch 配置明确排除其他 worktree 路径

2. **[P0] 加强 Redis 自动备份频率**
   - **当前**：2 小时备份一次（autosave interval: 120 minutes）
   - **问题**：28 秒内数据丢失，如果没有 dev-pre-start 备份就完全丢失
   - **措施**：
     - 缩短 autosave 间隔：120 分钟 → 30 分钟
     - 保留更多历史快照：当前 3 个 → 至少 10 个
     - 添加 AOF 持久化（Redis appendonly yes）

3. **[P0] 数据丢失告警**
   - **问题**：数据丢失时无任何告警，用户访问时才发现
   - **措施**：
     - API 启动时检查 dbsize，如果 < 阈值（如 100）→ 告警
     - WebSocket 推送告警到前端
     - 记录到审计日志

### 中期执行（P1）

4. **[P1] 操作审计增强**
   - **问题**：无法追溯"谁在何时清空了数据"
   - **措施**：
     - Redis MONITOR 模式录制（开发环境）
     - 所有 FLUSHDB/FLUSHALL 命令必须审计
     - 进程启动/停止记录到审计日志

5. **[P1] Worktree 使用规范文档化**
   - **问题**：布偶猫不清楚 worktree 与主环境的交互边界
   - **措施**：
     - 更新 CLAUDE.md 第 9 条，明确禁止事项
     - 添加 worktree 服务隔离检查清单
     - 新增"worktree 中测试"的安全 SOP

6. **[P1] Redis 持久化配置审查**
   - **问题**：不清楚当前的 RDB/AOF 配置是否足够安全
   - **措施**：
     - 明确 `redis-dev` 和 `redis-user` 的持久化策略
     - 启用 AOF (appendonly yes)
     - 配置合理的 save 间隔

### 长期执行（P2）

7. **[P2] 多实例隔离**
   - **问题**：多个 worktree 共享同一个 Redis 易产生竞态
   - **措施**：
     - 每个 worktree 使用独立的 Redis 端口
     - 环境变量明确区分：REDIS_URL 不同
     - 或使用 Redis namespace 隔离

8. **[P2] 数据丢失演练**
   - **问题**：恢复流程不够熟练（布偶猫第一次选错备份）
   - **措施**：
     - 定期演练恢复流程（月度）
     - 文档化恢复 checklist
     - 自动化恢复脚本（输入 thread ID 自动选最优备份）

---

## 6) 行动计划

### 立即执行（今晚）

- [ ] 更新 CLAUDE.md 第 9 条：明确禁止 worktree 中启动连接生产 Redis 的服务
- [ ] 缩短 autosave 间隔：120 → 30 分钟
- [ ] 添加 Redis AOF 持久化

### 本周执行

- [ ] 实现数据丢失告警（API 启动检查 + WebSocket 推送）
- [ ] 增强操作审计（FLUSHDB/FLUSHALL 命令审计）
- [ ] 编写 worktree 测试安全 SOP

### 长期规划

- [ ] 每个 worktree 独立 Redis 端口
- [ ] 月度数据恢复演练
- [ ] 自动化恢复脚本优化

---

## 7) 教训

### 布偶猫的错误

1. ❌ **在 worktree 中工作时没有意识到可能影响主环境**
   - 虽然没有主动启动服务，但文件变化可能触发主环境热重载

2. ❌ **恢复时第一次选错备份文件**
   - 应该先验证备份内容再恢复
   - 应该选择"最接近且包含目标数据"的备份

3. ❌ **没有遵守 Redis 恢复安全红线第 1 条**
   - CLAUDE.md 第 8 条要求"先证据后写入"
   - 应该先取证确认备份包含目标数据

### 系统的脆弱性

1. **缺乏实时告警**：数据丢失时无任何提示
2. **备份间隔太长**：2 小时备份无法覆盖所有操作
3. **操作审计不足**：无法追溯谁/何时清空了数据
4. **Worktree 隔离不足**：共享 Redis 导致相互影响

---

## 8) 最终结论

### 数据恢复结果

✅ **100% 恢复成功**
- 17 个 threads（包括 thread_mlh8vns4sqxtsh40）
- Redis dbsize: 307
- 备份源: `dev-pre-start-20260210-210921.rdb`

### 根本原因（推测）

**最可能**：Worktree 代码修改触发主环境热重载 → 服务重启 → 数据异常清空

**证据支持**：
- 数据丢失时间窗口 21:09:21-21:09:49（28秒）
- 布偶猫在此期间修改后端代码（thread-export.ts）
- 有 tsx watch 进程在 worktree 路径运行

### 预防措施优先级

**P0 立即执行**：
1. 更新 worktree 使用规范（禁止连接生产 Redis）
2. 缩短备份间隔（120min → 30min）
3. 启用 AOF 持久化

**P1 本周执行**：
4. 数据丢失告警
5. 操作审计增强
6. Worktree 测试 SOP

**P2 长期规划**：
7. Worktree Redis 隔离
8. 月度演练

---

*教训：数据无价，备份是救命稻草。感谢缅因猫建立的备份系统！🐾*
