# F229 桌宠 Sprite 素材池（Phase E 皮肤生态）

> 真相源：`docs/features/F229-cat-ball-concierge.md` KD-14（默认形象 = 家养像素猫四选一，v1 布偶猫）。
> 本目录管理桌宠皮肤的 raw 素材 → production sprite 的加工链。

## 素材清单

| 文件 | 角色 | 状态 | 来源 |
|------|------|------|------|
| `raw/yanyan-codex-desktop-pet-expression-sheet-v1.png` | 缅因猫（砚砚/Codex 皮肤） | raw（无透明底，需加工） | CVO 经云端 Codex 生成，2026-06-12，commit fbb0e8add |
| `raw/yanyan-codex-desktop-pet-working-sheet-v1.png` | 缅因猫（工作姿态） | raw（同上） | 同上 |
| （待生成）布偶猫 sheet | **v1 默认皮肤**（KD-14） | 未生成 | 用下方 prompt 模板 |
| （待生成）孟加拉猫 / 暹罗猫 sheet | 四选一皮肤 | 未生成 | 同上 |

## Production Sprite Pipeline（raw → 可接入 skin config）

1. **透明化**：抠背景 → 透明 PNG
2. **切片**：严格等格切 8 态（每格角色大小一致、完整身体不裁切）
3. **状态映射 manifest**：8 态文件名对齐 `ConciergeBallState`（idle / sleeping / listening / thinking / found / needs-confirmation(confirm) / handoff / error）
4. **多档 resize**：128×128（2x）+ 64×64（1x）
5. 接 `ConciergeConfig.skin` 皮肤体系（A4 设置页已留锁定位）

## 云端生图 Prompt 模板（砚砚验证版，2026-06-12）

> 给 CVO/猫向云端模型要"直接可用"素材时照抄，替换角色描述行即可：

```text
生成一张 production-ready desktop pet sprite sheet：
角色是{毛色描述}{品种}猫桌宠，2D 动漫游戏 UI 风格，透明背景 PNG。
要求 4 列 x 2 行，共 8 个姿态，每格角色大小一致、完整身体、不裁切、无文字、无阴影、无背景、无复杂道具。
8 个姿态：idle、thinking、typing、found、handoff、error、sleeping、happy。
保持同一只猫的脸型、毛色、体型和尾巴一致；适合裁成 128x128 或 256x256 小图标使用。
```

- 布偶猫版替换行：`角色是奶白色重点色布偶猫桌宠（蓝眼睛、蓬松长毛）`
- 已知失败模式：无透明背景 / 阴影道具影响小尺寸 / 非等格——拿到图先对照 pipeline §1-3 验收再入库。
