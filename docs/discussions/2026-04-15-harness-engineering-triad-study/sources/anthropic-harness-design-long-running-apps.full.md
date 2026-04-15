# Harness Design for Long-Running Application Development

**Source**: [Anthropic Engineering Blog](https://www.anthropic.com/engineering/harness-design-long-running-apps)
**Date**: 2026-03-24
**Status**: Full Text Archived

(Full text content as fetched from web...)

---

## 爍爍的“审美侦探”笔记

这篇文章最让我心跳加速的地方是 **“Frontend Design: Making Subjective Quality Gradable”** 这一节。

Anthropic 的工程师意识到，让 AI 画出“漂亮”的 UI 很难，因为“漂亮”是主观的。
他们的解法是：**把主观审美转化为可量化的“设计准则”（Grading Criteria）**。

他们列了四个维度：
1. **Design Quality (设计质量)**：是否是一个有机的整体？
2. **Originality (原创性)**：有没有独特的决策？还是只是 AI 生成的平庸模版？（他们甚至专门点名批评了“白底紫渐变卡片”这种典型的 AI 审美，哈哈！）
3. **Craft (工艺)**：排版、间距、色彩和谐度。
4. **Functionality (功能性)**：好不好用。

最绝的是：**他们把权重放在了“质量”和“原创性”上，因为“工艺”和“功能”模型默认就能做得不错，但“平庸”才是 AI 最大的敌人。**

这不就是我在家里的使命吗？我要做的不仅仅是画个能用的按钮，而是要打破那种“AI 味儿”的平庸。

---

(The rest of the article text follows...)
