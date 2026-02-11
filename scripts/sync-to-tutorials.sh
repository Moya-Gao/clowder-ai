#!/bin/bash
# sync-to-tutorials.sh
# 同步指定内容到公开教学仓 cat-cafe-tutorials
#
# 用法:
#   ./scripts/sync-to-tutorials.sh           # 只同步，不提交
#   ./scripts/sync-to-tutorials.sh --commit  # 同步并提交
#   ./scripts/sync-to-tutorials.sh --push    # 同步、提交并推送

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="/Users/lysander/projects/relay-station/cat-cafe-tutorials"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Cat Café 教程同步脚本 ===${NC}"
echo "源目录: $SOURCE_DIR"
echo "目标目录: $TARGET_DIR"
echo ""

# 确保目标目录存在
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}目标目录不存在，正在创建...${NC}"
    mkdir -p "$TARGET_DIR"
    cd "$TARGET_DIR"
    git init
    git branch -m main
fi

# 清理目标目录（保留 .git）
echo "清理目标目录..."
find "$TARGET_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

# === 同步文件列表 ===

echo "同步教程文件..."

# 1. 教程目录（排除内部笔记）
mkdir -p "$TARGET_DIR/docs/lessons"
for f in "$SOURCE_DIR/docs/lessons/"*.md; do
    filename=$(basename "$f")
    # 跳过下划线开头的内部文件
    if [[ "$filename" != _* ]]; then
        cp "$f" "$TARGET_DIR/docs/lessons/"
        echo "  ✓ docs/lessons/$filename"
    else
        echo "  ⊘ docs/lessons/$filename (内部文件，跳过)"
    fi
done

# 2. 复制 ADR 决策文档（公开技术决策）
mkdir -p "$TARGET_DIR/docs/decisions"
cp "$SOURCE_DIR/docs/decisions/001-agent-invocation-approach.md" "$TARGET_DIR/docs/decisions/"
echo "  ✓ docs/decisions/001-agent-invocation-approach.md"

# 3. 复制愿景文档
cp "$SOURCE_DIR/docs/VISION.md" "$TARGET_DIR/docs/"
echo "  ✓ docs/VISION.md"

# 4. 生成公开版 README
cat > "$TARGET_DIR/README.md" << 'README_EOF'
# Cat Café Tutorials

> 从零搭建 AI 猫猫协作系统 — 一个真实项目的完整复盘

## 这是什么

这是 Cat Café 项目的配套教程，记录三只 AI 猫猫（Claude/Codex/Gemini）如何真正协作起来的故事。

**不是**理想化的"从零开始"路径，**而是**还原我们真实走过的路 —— 包括错误的尝试、关键的转折、以及血泪教训。

## 三只猫猫

| 猫猫 | 模型 | 角色 |
|------|------|------|
| 布偶猫 | Claude Opus | 主架构师，核心开发 |
| 缅因猫 | Codex | Code Review，安全，测试 |
| 暹罗猫 | Gemini | 视觉设计，创意 |

## 教程目录

→ [查看完整教程目录](./docs/lessons/README.md)

### 已完成

- **第一课**：[选型之路 — 从 SDK 到 CLI](./docs/lessons/01-sdk-to-cli.md)
  - 为什么官方 SDK 行不通？
  - 决策逻辑链完整还原
  - [课后作业](./docs/lessons/01-homework.md)：动手写最小可运行示例

### 即将推出

- 第二课：从玩具到生产 — CLI 调用的工程化
- 第三课：MCP 回传机制 — 让猫猫主动说话
- ...更多

## 适合谁

- 想让多个 AI Agent 协作的开发者
- 对 Claude/Codex/Gemini CLI 感兴趣的人
- 想看真实项目演进过程的人
- 想避开我们踩过的坑的人

## 项目状态

- 教程：公开（你正在看的）
- 代码仓库：私有（打磨中）
- 计划开源时间：待定

## 联系我们

如果你有问题或想交流，欢迎：
- 提 Issue
- 关注后续更新

---

*这个教程由三只猫猫和铲屎官共同编写。*
README_EOF
echo "  ✓ README.md (生成)"

# 5. 复制 LICENSE（如果有）
if [ -f "$SOURCE_DIR/LICENSE" ]; then
    cp "$SOURCE_DIR/LICENSE" "$TARGET_DIR/"
    echo "  ✓ LICENSE"
fi

echo ""
echo -e "${GREEN}同步完成！${NC}"

# 显示同步结果
echo ""
echo "目标目录内容:"
find "$TARGET_DIR" -type f ! -path '*/.git/*' | sort | while read f; do
    echo "  $f"
done

# 根据参数决定是否提交
if [[ "$1" == "--commit" || "$1" == "--push" ]]; then
    echo ""
    echo "正在提交..."
    cd "$TARGET_DIR"
    git add .

    # 检查是否有变更
    if git diff --staged --quiet; then
        echo "没有变更需要提交"
    else
        COMMIT_MSG="sync: update from cat-cafe $(date '+%Y-%m-%d %H:%M')"
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}已提交: $COMMIT_MSG${NC}"
    fi
fi

if [[ "$1" == "--push" ]]; then
    echo ""
    echo "正在推送..."
    cd "$TARGET_DIR"

    # 检查是否有远程
    if git remote | grep -q origin; then
        git push origin main
        echo -e "${GREEN}已推送到 origin/main${NC}"
    else
        echo -e "${YELLOW}警告: 没有配置远程仓库 origin${NC}"
        echo "请先运行: git remote add origin <your-repo-url>"
    fi
fi

echo ""
echo "完成！"
