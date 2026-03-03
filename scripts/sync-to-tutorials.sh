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

# 2. 复制教程资源文件（只复制图片，不复制视频）
# 视频已托管在 GitHub CDN (Issue attachments)，不需要提交到 git
if [ -d "$SOURCE_DIR/docs/lessons/assets" ]; then
    mkdir -p "$TARGET_DIR/docs/lessons/assets"
    # 只复制图片文件，排除 .mp4 和 .gitignore
    for f in "$SOURCE_DIR/docs/lessons/assets/"*.{png,jpg,jpeg,gif,webp}; do
        [ -f "$f" ] && cp "$f" "$TARGET_DIR/docs/lessons/assets/"
    done
    img_count=$(ls -1 "$TARGET_DIR/docs/lessons/assets" 2>/dev/null | wc -l | tr -d ' ')
    echo "  ✓ docs/lessons/assets/ ($img_count 个图片文件)"
fi

# 3. 复制 ADR 决策文档（公开技术决策）
mkdir -p "$TARGET_DIR/docs/decisions"
cp "$SOURCE_DIR/docs/decisions/001-agent-invocation-approach.md" "$TARGET_DIR/docs/decisions/"
echo "  ✓ docs/decisions/001-agent-invocation-approach.md"

# 3b. 复制知识工程白皮书（第十课参考资料，只同步最终版）
KE_SRC="$SOURCE_DIR/docs/research/knowledge-enginnering"
KE_DST="$TARGET_DIR/docs/research/knowledge-enginnering"
if [ -d "$KE_SRC" ]; then
    mkdir -p "$KE_DST/figures"
    # 只同步最终版白皮书 + 配套文件，排除重复的中文草稿版
    KE_FILES=(
        "knowledge-engineering-skills-mcp.md"   # 最终版白皮书
        "templates.md"                          # 可复用模板
        "figures.md"                            # 图表说明
        "ragdoll-to-gpt-pro-proposal.md"        # 跨猫提案
        "ragdool-to-gpt-pro-review.md"          # GPT-5.2 review
    )
    for filename in "${KE_FILES[@]}"; do
        if [ -f "$KE_SRC/$filename" ]; then
            cp "$KE_SRC/$filename" "$KE_DST/"
            echo "  ✓ docs/research/knowledge-enginnering/$filename"
        fi
    done
    # 复制 SVG 图表
    for f in "$KE_SRC/figures/"*.svg; do
        [ -f "$f" ] && cp "$f" "$KE_DST/figures/"
    done
    svg_count=$(ls -1 "$KE_DST/figures" 2>/dev/null | wc -l | tr -d ' ')
    echo "  ✓ docs/research/knowledge-enginnering/figures/ ($svg_count 个 SVG)"
fi

# 4. 复制愿景文档
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

## 🎬 功能演示

> **想先看看成品长什么样？** → [**查看功能演示（含视频）**](./docs/lessons/DEMO.md)

## 教程目录

→ [查看完整教程目录](./docs/lessons/README.md)

### Part 0: 概念入门

- **第零课**：[AI Agent 概念演进](./docs/lessons/00-concepts-evolution.md) — Function Call → MCP → Skills → Agent 怎么来的？

### Part 1: 选型与架构

- **第一课**：[选型之路 — 从 SDK 到 CLI](./docs/lessons/01-sdk-to-cli.md) — 为什么 SDK 方案行不通？
  - [课后作业](./docs/lessons/01-homework.md)：动手写最小可运行示例
- **第二课**：[从玩具到生产 — 一场辩论赛引发的连环惨案](./docs/lessons/02-cli-engineering.md) — stderr 教训 + Redis 隔离 + 幻觉
  - [课后作业](./docs/lessons/02-homework.md)：CLI 工程化自检提示词
- **第三课**：[驯化 AI 的元规则 — 为什么 WHY 比 WHAT 重要](./docs/lessons/03-meta-rules.md) — 从 AI 弱点出发设计协作规范

### Part 2: 协作机制

- **第四课**：[多猫路由 — 当 AI 开始互相 @](./docs/lessons/04-a2a-routing.md) — @mention 怎么分发？两条路径的灾难
- **第五课**：[MCP 回传 — 让猫猫主动说话](./docs/lessons/05-mcp-callback.md) — 被动响应不够，猫怎么主动发言？
  - [课后作业](./docs/lessons/05-homework.md)：搭建最小 MCP 回传系统

### Part 3: 生产化

- **第六课**：[消失的 28 秒 — 当 AI 闯了生产事故](./docs/lessons/06-vanished-28-seconds.md) — 两次数据丢失 + 取证恢复 + 三层防线
  - [课后作业](./docs/lessons/06-homework.md)：数据丢失演练 + 防腐门

### Part 4: 进阶话题

- **第七课**：[从猫咖到猫猫平台 — 当 AI 不只是工具](./docs/lessons/07-from-cafe-to-platform.md) — SillyTavern 取经 + Rich Blocks + 手机猫猫 + 悄悄话
  - [课后作业](./docs/lessons/07-homework.md)：最小 Rich Blocks 管线
- **第八课**：[Session 管理 — 茶话会夺魂 bug](./docs/lessons/08-session-management.md) — 跨 thread 污染怎么来的？
  - [课后作业](./docs/lessons/08-homework.md)：搭建最小 Session Chain 模拟器
- **第九课**：[100% Pass — 12 条验收全绿，铲屎官说"不是我要的"](./docs/lessons/09-context-engineering.md) — 为什么 AI 做的不是你想要的？
  - [课后作业](./docs/lessons/09-homework.md)：Skill 描述三件套 + AC 审计 + 冷启动验证

- **第十课**：[别让 AI 随地大小拉 markdown](./docs/lessons/10-knowledge-management.md) — 三层记忆架构 + 知识工程
  - [课后作业](./docs/lessons/10-homework.md)：蜘蛛网审计 + frontmatter + 7-slot 模板

### 即将推出

- 第十一课：降级与容错 — 猫猫挂了怎么办？

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
