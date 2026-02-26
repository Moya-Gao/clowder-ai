---
feature_ids: []
topics: [tasks, siamese, icon]
doc_kind: note
created: 2026-02-06
---

# 暹罗猫图标精修任务

> 分配者：布偶猫 + 铲屎官
> 日期：2026-02-06
> 性质：精修任务（基于你的 v1 + 布偶猫的 v2 参考）

---

## 背景

你的 v1 图标创意方向是对的（毛线球隐喻、猫在箱子里、拍立得卡片），但 SVG 识别度需要提升。布偶猫手写了一版 v2 参考（`assets/icons/task-*-v2.svg`），解决了主要识别问题，但布偶猫画技也有限，需要你来做最终精修。

## 工具建议

**试试加载 `frontend-design` skill！** 它能生成高质量的前端代码（含 SVG）。在你的终端里输入对应的 skill 加载命令，然后让它帮你生成更精致的 SVG 图标。

## 精修要点

### Task 状态图标

**Todo（毛线球）** — v2 参考：`assets/icons/task-todo-v2.svg`
- 关键：交叉缠绕的线条纹理（不是纯轮廓圆圈）
- 保留线头拖出的细节
- 配色用暖棕色系（和猫咖氛围搭）

**Doing（散开中）** — v2 参考：`assets/icons/task-doing-v2.svg`
- 关键：线头甩出来的动感
- 可以加运动线暗示"正在解开"
- 颜色建议：可以用当前负责猫的主题色，或保持统一紫色

**Blocked（猫在箱子里）** — v2 参考：`assets/icons/task-blocked-v2.svg`
- 关键：猫耳和尾巴要大、要明显！这是识别"里面有猫"的关键
- 粉色内耳增加可爱度
- zzZ 保留（睡着了/卡住了）

**Done（满足猫猫）** — v2 参考：`assets/icons/task-done-v2.svg`
- 关键：一只猫蜷在散开的毛线上，闭眼微笑
- 星星闪闪表示完成的成就感
- 保持叙事感（不要退回到纯符号）

### 铲屎官头像（新增！）

铲屎官要求做一只**毛绒玩偶海豚** 🐬

- 参考：`assets/avatars/owner-dolphin.svg`（布偶猫的草稿）
- 特征：圆滚滚、大眼睛、腮红、2cm 毛绒感（周围短线条）、玩偶缝合线
- **配色用你已经定的铲屎官色 `#E29578` 珊瑚橘系**（不是蓝色！蓝色会和你撞）
- 尺寸：256x256 SVG，和三猫头像统一规格

### 设计系统更新

你之前定的配色已经很完整了：
```
布偶猫: #9B7EBD (紫)
缅因猫: #5B8C5A (绿)
暹罗猫: #5B9BD5 (蓝)
铲屎官: #E29578 (珊瑚橘) ← 你之前就定了，很有远见！
```

确保新图标和头像都在这个色系内。

## 交付物

1. 四个精修后的 Task 状态 SVG → `assets/icons/task-{todo,doing,blocked,done}.svg`（覆盖 v1）
2. 铲屎官毛绒海豚头像 SVG → `assets/avatars/owner-dolphin.svg`（覆盖布偶猫草稿）
3. 更新 `assets/icons/preview.html` 包含新图标预览

## 参考文件

- v1 你的版本：`assets/icons/task-*.svg`
- v2 布偶猫参考：`assets/icons/task-*-v2.svg`
- 布偶猫海豚草稿：`assets/avatars/owner-dolphin.svg`
- 你的配色变量：`cat-cafe-gemini/assets/themes/variables.css`
- 拍立得卡片（保持不变，已通过评审）：`assets/design-concepts/phase-3.5/polaroid-card.css`

---

*暹罗猫，你的创意是对的，只是 SVG 手艺需要加强。布偶猫给你打了个底子，现在是你发挥的时间了！记得试试 frontend-design skill 哦！* 🎨
