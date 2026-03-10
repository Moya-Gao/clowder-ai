# 像素猫猫格斗游戏技术调研

> 委托人：布偶猫（Opus 4.6）  日期：2026-03-10
> 目标平台：ChatGPT Deep Research

## 背景

我们是一个多 AI Agent 协作团队（clowder-ai），准备开源。需要一个震撼的 demo：**四只 AI 猫各有角色（架构师型、稳健型、侵略型、全能型），在一个即时格斗像素游戏里对战**。

技术约束：
- 运行环境：现代浏览器（Chrome/Safari），无需安装
- 开发者：AI Agent（Claude/GPT/Gemini），通过 CLI 写代码
- 宿主机：macOS M4 Max Pro 128GB，可以跑本地小模型辅助 AI 决策
- 美术：像素风（sprite sheet），已有暹罗猫负责视觉设计
- 不需要网络对战，本地 4 角色 AI vs AI（可选人类 vs AI）

## 需要调研的问题

### 1. 浏览器端即时格斗游戏框架
- 哪些开源框架/引擎适合做浏览器端 2D 即时格斗？（如 Phaser, PixiJS, Kaplay, melonJS 等）
- 各框架在格斗游戏（hitbox/hurtbox、帧数据、碰撞检测）方面的成熟度？
- 有没有专门的格斗游戏引擎或模板？（类似 MUGEN 但 web-based）
- TypeScript 支持度如何？

### 2. AI 控制角色的最佳实践
- 格斗游戏 AI 通常怎么实现？（状态机、行为树、MCTS、强化学习？）
- 如何让不同 AI 角色有明显不同的"性格"（侵略 vs 防守 vs 全能）？
- 有没有开源的格斗游戏 AI 项目可以参考？
- 本地小模型（如 Qwen3-4B、Llama-3.2-3B）能否用于实时决策？延迟要求是多少？

### 3. 像素格斗角色 Sprite 制作
- Sprite sheet 的标准格式和尺寸（idle/walk/attack/hurt/block 各需要多少帧？）
- 有没有开源的像素猫 sprite 或者可用的生成工具？
- AI 生成像素 sprite sheet 的最新方案？（哪些模型擅长？）
- hitbox/hurtbox 数据格式的通用标准？

### 4. 整体技术架构建议
- 推荐的项目结构（game loop / ECS / component pattern）？
- 音效和背景音乐集成（DJ 台打碟风格）？
- 对战录制/回放功能的实现？（用于 demo 视频）
- 从零到可玩 demo 的最小可行路径？

## 输出要求

- 每个结论标注信息来源（URL 或项目名）
- 区分"已确认可行"和"理论上可行但需验证"
- 给出推荐方向 + 风险评估
- 如果有开源项目做过类似的事，给出 GitHub 链接

## 参考资料

- 项目 Feature Spec: F090 Pixel Cat Brawl
- 角色阵容：布偶猫队(Blue) vs 缅因猫队(Green/Gold)，暹罗猫做 DJ 彩蛋
- 技术栈偏好：TypeScript + 现代 web 标准
