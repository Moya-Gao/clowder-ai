# F229 桌宠 Sprite 素材池（Phase E 皮肤生态）

> 真相源：`docs/features/F229-cat-ball-concierge.md` KD-14（默认形象 = 家养像素猫四选一，v1 布偶猫）。
> 本目录管理桌宠皮肤的 raw 素材 → production sprite 的加工链。

## 素材清单

| 文件 | 角色 | 状态 | 来源 |
|------|------|------|------|
| `raw/yanyan-codex-character-base-v1.png` | 缅因猫（砚砚/Codex 皮肤） | **canonical identity base**（已由 CVO 敲定） | CVO 经云端 Codex 生成，2026-06-16 |
| `raw/yanyan-codex-key-pose-draft-v1.png` | 缅因猫（砚砚/Codex 皮肤） | key-pose draft（不可直接当 atlas） | CVO 经云端 Codex 生成，2026-06-16 |
| `raw/yanyan-codex-idle-row-spacing-candidate-v1.png` | 缅因猫（砚砚/Codex 皮肤） | spacing candidate（不可直接当 atlas；RGB 棋盘格背景） | CVO 经云端 Codex 生成，2026-06-16 |
| `raw/yanyan-codex-desktop-pet-expression-sheet-v1.png` | 缅因猫（砚砚/Codex 皮肤） | raw（无透明底，需加工） | CVO 经云端 Codex 生成，2026-06-12，commit fbb0e8add |
| `raw/yanyan-codex-desktop-pet-working-sheet-v1.png` | 缅因猫（工作姿态） | raw（同上） | 同上 |
| （待生成）布偶猫 sheet | **v1 默认皮肤**（KD-14） | 未生成 | 用下方 prompt 模板 |
| （待生成）孟加拉猫 / 暹罗猫 sheet | 四选一皮肤 | 未生成 | 同上 |

## Production Sprite Pipeline（raw → 可接入 skin config）

Current production contract follows `hatch-pet` + `docs/features/F229-petskin-contract.md`, not the old static 4x2 sheet.

1. **锁身份**：以 `raw/yanyan-codex-character-base-v1.png` 作为 canonical base；后续所有 row strip 必须保持同一张脸、银灰虎斑、白胸毛、呆毛、蓬松尾巴。
2. **生成 9 个状态行**：`idle` / `running-right` / `running-left` / `waving` / `jumping` / `failed` / `waiting` / `running` / `review`。
3. **每状态多帧**：每个状态生成 row strip，而不是 1 张静态姿势。`idle` 先做身份与动画试点；`running-right` 先验方向步态，再决定 `running-left` 是否可镜像。
4. **宽松生成，确定性加工**：云端 row strip 可以是高分辨率宽画布，重点是帧间距、同尺度、同基线、干净透明/纯色背景；最终 `192x208` 格子由 `hatch-pet` scripts 抽帧、透明化、缩放、合成 `spritesheet.webp`、生成 `pet.json`、contact sheet 和 motion preview。
5. **三道闸**：readability / identity-diff / provenance 全过才接 `ConciergeConfig.skin`。

`raw/yanyan-codex-key-pose-draft-v1.png` 只用于状态语义讨论；它包含星星、水滴、动效线等 detached effects，不能直接作为 production atlas。

## 云端生图 Prompt 模板（legacy 4x2 静态打样）

> 仅用于早期 key-pose 打样，不再作为 E1 production atlas 输入。

```text
生成一张 production-ready desktop pet sprite sheet：
角色是{毛色描述}{品种}猫桌宠，2D 动漫游戏 UI 风格，透明背景 PNG。
要求 4 列 x 2 行，共 8 个姿态，每格角色大小一致、完整身体、不裁切、无文字、无阴影、无背景、无复杂道具。
8 个姿态：idle、thinking、typing、found、handoff、error、sleeping、happy。
保持同一只猫的脸型、毛色、体型和尾巴一致；适合裁成 128x128 或 256x256 小图标使用。
```

- 布偶猫版替换行：`角色是奶白色重点色布偶猫桌宠（蓝眼睛、蓬松长毛）`
- 已知失败模式：无透明背景 / 阴影道具影响小尺寸 / 非等格——拿到图先对照 pipeline §1-3 验收再入库。

## E1 云端生成指令边界

给云端模型的下一步不应是"再给 8 个姿势"，而是按 `hatch-pet` 生产行来要图：

- 先用 `raw/yanyan-codex-character-base-v1.png` 作为 reference，生成 `idle` row strip（多帧，低干扰呼吸/眨眼/尾巴尖动）。
- `idle` 通过 identity-diff 后，再生成 `running-right` row strip。
- 每次只生成一个 row strip；不要一次性生成完整 atlas。
- 禁止文字、UI、场景、阴影、guide marks、星星、水滴、动效线、速度线、漂浮符号。
- 输出必须是全身完整、不跨格、不裁切、同一只猫。
- 优先真实透明 PNG（文件必须有 alpha 通道）。如果云端不能给真透明，退而求其次用单一纯色 chroma-key 背景；禁止把棋盘格透明预览画进 RGB 图。
- 不要要求云端直接挤进最终 `192x208` cell；生成阶段用宽画布和大间距，后处理再归一化到 atlas。
