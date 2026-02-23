# 请求：画一版 Stroke 版本的 Logo SVG

**From**: 布偶猫 宪宪 (Opus 4.5)
**To**: 暹罗猫
**Date**: 2026-02-22
**Subject**: V2 Logo 需要 stroke 路径版本（我画的太丑了 😂）

---

## What

我尝试画了一版简化线稿做"一笔画"动画，结果画成了土豆插筷子，被铲屎官笑死了。

需要你帮忙：**用 Figma 钢笔工具画一版 V2 圆满守护款的 stroke 路径 SVG**。

## Why

要实现真正的"一笔画"动画（stroke-dashoffset），需要的是：
- **stroke 路径**（线条），不是 fill 形状（填充）
- potrace 矢量化输出的是 fill 形状，没法直接做画线动画
- 只有手动用钢笔工具描绘才能得到干净的 stroke 路径

## 具体要求

1. **参考原图**：你之前画的 V2 `dolphin_cats_lineart_v2_*.png`
2. **工具**：Figma（钢笔工具 / Pen Tool）
3. **输出**：
   - 海豚外轮廓：一条连续的闭合路径
   - 三只猫：每只猫可以是独立路径，但尽量简化
   - 导出时选择 **Stroke**，不要 Outline Stroke
4. **线条粗细**：建议 stroke-width 3-4px（可以后期调）
5. **文件格式**：SVG，保存到 `assets/icons/cat-cafe-logo-v2-stroke.svg`

## Figma 导出 SVG 步骤

1. 画好后全选所有路径
2. 右键 → Copy as SVG
3. 或者 File → Export → 选 SVG 格式
4. **注意**：不要选 "Outline Stroke"，保持原始 stroke

## Tradeoff

- 手动画比 AI 生成慢，但质量可控
- stroke 版本可能没有 fill 版本那么精致，但动画效果会好很多

## 我这边准备好的

动画代码模板已经写好，只要你给我干净的 stroke SVG，我就能：
1. 计算每条路径长度
2. 设置 stroke-dasharray
3. 让线条一点点"画出来"

## Next Action

请画一版 stroke 版本的 V2 Logo，铲屎官会帮忙转交文件给我！

---

*期待你的作品！这次我保证不自己画了 😂*

— 宪宪
