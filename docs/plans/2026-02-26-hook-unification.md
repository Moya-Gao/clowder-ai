# Hook 归一化 — 跨项目 hook 注入机制

> BACKLOG #99 | 2026-02-26 | 状态：待设计

## 现状

### 三层 hooks

| 级别 | 文件 | 作用域 | 当前用途 |
|------|------|--------|----------|
| User | `~/.claude/settings.json` | 所有项目 | `check-subagent-model.sh`（刚移过去） |
| Project | `$PROJECT/.claude/settings.json` | 仅此项目目录 | F24 session hooks × 3 + post-edit-check |
| Project-local | `$PROJECT/.claude/settings.local.json` | 仅此项目+个人 | permissions（不 check in） |

### 问题

Cat Cafe 的猫猫不只在 `cat-cafe/` 目录工作。铲屎官可能用 Cat Cafe 打开任意项目 X，此时：

1. **F24 hooks 不生效** — session compact/restore 机制失效，猫猫丢失上下文恢复能力
2. **post-edit-check 不生效** — 编辑质量检查缺失
3. **脚本不存在** — project X 没有 `.claude/hooks/` 目录

但这些 hooks 不适合放 user 级，因为它们是 Cat Cafe 特有的（F24 session chain 机制、Cat Cafe 的编辑规范）。

### 核心矛盾

- **User 级**：对所有项目生效，但 Cat Cafe 特有逻辑不该污染其他项目
- **Project 级**：只对当前目录生效，猫猫换了项目就失效

## 铲屎官的想法

> "当你打开那个项目创建那个项目的 claude 文件夹？或者是猫猫咖啡文件夹，hook 丢里面，project 的 hook symlink 那里。"

解读：
1. 猫猫打开项目 X 时，自动创建 `project-X/.claude/` 目录
2. 把 hook 脚本 symlink 到 Cat Cafe 的 `.claude/hooks/`（源码在一处）
3. 项目 X 的 `.claude/settings.json` 里 hook 配置指向 symlink

## 可能的方案

### 方案 A：init 脚本 + symlink（铲屎官方向）

猫猫咖啡提供一个初始化脚本，在目标项目创建 `.claude/` 骨架：

```bash
# cat-cafe/scripts/init-project-hooks.sh <target-project>
TARGET=$1
mkdir -p "$TARGET/.claude/hooks"

# Symlink hook scripts
for hook in f24-pre-compact.sh f24-post-compact-bootstrap.sh f24-guard-post-compact.sh post-edit-check.sh; do
  ln -sf "/Users/lysander/projects/relay-station/cat-cafe/.claude/hooks/$hook" "$TARGET/.claude/hooks/$hook"
done

# Generate settings.json with hook config
cat > "$TARGET/.claude/settings.json" << 'EOF'
{ "hooks": { ... } }
EOF
```

**优点**：
- 脚本源码在 Cat Cafe 一处维护
- 目标项目通过 symlink 获得最新版本
- 显式操作，铲屎官可控

**缺点**：
- 每个新项目都要手动跑一次 init
- symlink 跨磁盘/路径可能有问题
- 目标项目的 `.claude/settings.json` 需要合并（如果已有其他配置）

### 方案 B：User 级 conditional hook

把所有 hooks 放 user 级，脚本内部判断"当前是否在 Cat Cafe 管理的项目中"：

```bash
#!/bin/bash
# 检查当前项目是否由 Cat Cafe 管理
if [ ! -f "$CLAUDE_PROJECT_DIR/.cat-cafe-managed" ]; then
  exit 0  # 非 Cat Cafe 项目，静默跳过
fi
# ... 执行 hook 逻辑
```

**优点**：
- 一处配置，自动生效
- 不需要 symlink
- 新项目只需放一个 `.cat-cafe-managed` 标记文件

**缺点**：
- 所有项目都会触发 hook（即使立即跳过，也有开销）
- User 级 settings 会越来越大
- 标记文件机制不优雅

### 方案 C：Cat Cafe 运行时自动注入

Cat Cafe 的猫猫启动后，通过 MCP / session bootstrap 自动检查并配置目标项目的 hooks：

```
SessionStart → check target project .claude/ → create if missing → symlink hooks
```

**优点**：
- 全自动，无需手动 init
- 与 Cat Cafe 的 session 管理天然集成

**缺点**：
- 需要 Cat Cafe 有权限修改目标项目的 `.claude/` 目录
- 复杂度高
- 需要处理并发/竞态（多猫同时写同一个项目的 `.claude/`）

## 当前决策

**暂缓**。先用方案 A 的思路做最小可行方案（铲屎官手动跑 init 脚本），待确认需求频率后再考虑自动化。

## 待铲屎官确认

1. 方案方向偏好（A/B/C 或其他）？
2. 有多少个外部项目需要 hook 注入？频率高不高？
3. 是否允许 Cat Cafe 自动修改其他项目的 `.claude/` 目录？
