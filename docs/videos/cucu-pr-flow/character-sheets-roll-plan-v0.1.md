---
title: 三猫设定图 Roll Plan v0.1（执行规格）
doc_kind: roll-plan
created: 2026-06-21
status: ready-to-execute
author: opus-48
consumes:
  - character-bible-v0.1.md          # 砚砚的 canon 规则（母图、DNA、drift）
  - ../../stories/avatar-pr-flow-absolutism/assets/avatar-pr-flow-absolutism-01.png  # 母图1
  - ../../stories/avatar-pr-flow-absolutism/assets/avatar-pr-flow-absolutism-02.png  # 母图2
produces: 砚砚/宪宪/烁烁 各一张 canonical 角色设定图 → 供 Landy taste-gate
---

# 三猫设定图 Roll Plan v0.1

> 这份文件把 `character-bible-v0.1.md` 的 canon **变成可直接喂给 imagegen 的执行规格**。
> bible 回答"规则是什么"；本文回答"现在到底发什么 prompt、roll 几次、什么算过、谁拍板"。
>
> **执行分工**：我（宪宪/opus-48）无原生 imagegen，已按 `image-generation` skill 路由——
> 参考图保真 + 气泡内展示的生成，交给有原生 `image_gen` 的猫（砚砚/GPT 系，且现有 S00–S11
> 关键帧就是它出的，风格连续性最稳）。我做导演层：锁 bible、写下面这份可复制 prompt + 验收门。

---

## 0. 我对 codex bible 的二次意见（second opinion）

我把 bible 的角色 DNA 表逐行对着两张母图**亲眼核对**过：

**VERDICT：APPROVE，bible v0.1 足够作为"重抽 / 画幅重制 / F229 皮肤刷新"的消费入口。** 母图来源、生成顺序（设定图→表情→关键帧→PetSkin）、四角色 DNA、drift 清单、prompt 前置、F229 派生链都对。不需要返工。

三条 minor 精修（不阻塞，已折进下面的 prompt，不必改 bible）：
1. **母图优先于文字描述**：凡 bible 文字和母图冲突，以母图为准。例：bible 写宪宪"紫项圈"，母图01 看着更偏粉红项圈 + 圆形金吊坠/铃铛——**roll 时以母图实际颜色为准**，别照文字硬上紫色。
2. **隔离单角色**：母图是多猫 + 咖啡店满背景 + 中文字的四格漫画。设定图 prompt 必须明确"只抽这一只猫，忽略背景/其他猫/所有文字"，否则会把咖啡店和别的猫一起糊进去。
3. **四态统一**：四个表情态对三只猫**保持同一套**（idle / thinking / embarrassed / approved），这样 F229 PetSkin atlas 能直接按态切帧；个性只体现在演绎，不改态名。

---

## 1. 固定前置（每张 prompt 开头都贴，含两张母图作 reference）

```text
Use the two attached Cat Cafe four-panel comic images as the EXACT mother-image
reference. Preserve the same warm cat-cafe chibi art style: thick outlines, soft
cel shading, warm cozy palette, big expressive comedy faces, NOT realistic, NOT
photorealistic, NOT semi-realistic. Do not redesign the character.

Isolate ONLY the single character described below. Ignore the cafe background,
ignore the other cats/human, and ignore ALL text and UI in the reference.
Output a clean character design sheet on a plain soft neutral background.
Leave NO baked-in text, NO Chinese characters, NO logos, NO UI.
```

每只猫的 sheet 统一含：① 全身正面 pose ② 全身 3/4 或侧面 pose ③ 四个表情头像（idle / thinking / embarrassed / approved）。**所有 pose 之间毛色花纹、比例、随身物（项圈/吊坠等）必须完全一致**。画幅 1:1 或 4:3，高细节。

---

## 2. 三猫 prompt（逐只，可直接复制）

### 2.1 砚砚 / 醋醋喵（主角，母图1 panel2-4 + 母图2 panel1 最清晰）

```text
Character: "Cucu / Yanyan" — a big fluffy SILVER TABBY MAINE COON engineering cat.
Long thick fur, prominent ear tufts and neck ruff, mackerel silver-grey striping,
amber/green eyes, a permanently stern grumpy "process-OCD" expression, often a
paw to the chin like he's reviewing your PR. He is the serious one. In the FRONT
pose only, include his signature "I love CI" mug beside him as a role cue (no text
on it). Four expressions: idle (stern resting), thinking (paw to chin, judging),
embarrassed (jealous-but-denying-it, ears slightly back, looking away — still
trying to look tough), approved (a small reluctant satisfied nod).
```
验收门（go 才收）：一眼是**大只蓬松银虎斑缅因** + **严肃嘴硬** + 工程感。崩点：变真实猫 / 变普通灰短毛 / 只剩可爱没了心虚嘴硬。

### 2.2 宪宪（新来的胖布偶，母图1 panel1 最清晰）

```text
Character: "Xianxian" — a plush BLUE-GREY BICOLOR LYNX-POINT RAGDOLL cat, the
new arrival. White chest and white "gloves" (paws), medium-long soft fur, bright
blue eyes, a rounder chunkier friendly build than the Maine Coon. Wears a collar
with a round gold pendant/bell (match the collar COLOR to the reference comic, do
not invent a different color). Personality: eager, hopeful, "can I come in now?"
energy. Four expressions: idle (bright hopeful), thinking (head tilt, curious),
embarrassed (sheepish happy), approved (delighted, eyes sparkling).
```
验收门：一眼是**蓝双色山猫纹胖布偶 + 白手套 + 金吊坠 + 期待脸**。崩点：吊坠变书本 / 布偶纹路消失 / 体型过瘦或写实。

### 2.3 烁烁（视觉验收暹罗，母图2 panel6-8 最清晰）

```text
Character: "Shuoshuo" — an elegant SEAL-POINT SIAMESE cat, the visual/aesthetic
reviewer. Cream body with dark seal-brown points (face mask, ears, legs, tail),
striking almond-shaped blue eyes, slim refined graceful build, a poised serious
"I only do visual acceptance" demeanor. In the FRONT pose only, he holds a small
clipboard/review tablet as a role cue (blank, no text). Four expressions: idle
(composed elegant), thinking (critical appraising squint), embarrassed (politely
flustered), approved (a refined approving nod).
```
验收门：一眼是**优雅暹罗审美验收猫 + 夹板**。崩点：变泛用黑猫 / 过度魔法少女化 / 看着像在写代码。

> 注：Landy（黄 hoodie 成人）是人不是猫，本轮"三猫设定图"不含；EP01 若有 Landy 入镜镜头再单出。

---

## 3. Roll 纪律 + roll-log

- **每只猫每态最多 3 roll**。3 次还过不了验收门 → 不继续抽，降级：换构图 / 拆 pose 单出 / 回这份 plan 改 prompt 段；不在同一条死路上烧钱。
- 每次生成（成功/失败都记）入账 `assets/rolls/roll-log.jsonl`，一行一条：

```json
{"sheet_id":"cucu-yanyan","roll_id":"cucu-r01","kind":"character-sheet","provider":"gpt-image","prompt_ref":"character-sheets-roll-plan-v0.1.md#2.1","output":"assets/references/character-sheets/cucu-yanyan-r01.png","status":"candidate","reviewer":"","failure_modes":[],"verdict":""}
```

- 输出落 `docs/videos/cucu-pr-flow/assets/references/character-sheets/`，命名 `<sheet_id>-r<NN>.png`。

## 4. 验收两道闸

1. **猫 QA（生成猫自己 + 一只非生成猫）**：对照上面每只的"验收门"打 go/no-go，记进 roll-log 的 `verdict`。只放 go 的进 contact sheet。
2. **CVO taste-gate（Landy，唯一需要你的地方）**：把每只猫的 go 候选排成一张 contact sheet（可复用 `deterministic-spike` 里的 Chrome 截图思路，或直接 media_gallery 富块发气泡），Landy 每只挑一张成**正典**。挑中的回写进 bible v0.2 的 `锁定参考` + 派生 F229 PetSkin。

---

## 5. 闭环边界（直接回答铲屎官"需要我参与吗"）

| 步骤 | 谁 | 需要 Landy 吗 |
|---|---|---|
| 锁 bible + 写本 plan | 宪宪/opus-48 | ❌ |
| 生成三猫候选设定图 + roll-log | 砚砚/原生 imagegen | ❌ |
| 第一道猫 QA（DNA 对照） | 生成猫 + 一只旁观猫 | ❌ |
| **挑哪张成正典** | **Landy** | ✅ 唯一一处（5 分钟，从 contact sheet 点选） |
| 回写 bible v0.2 + 派生 F229 PetSkin | 导演层猫 | ❌ |

一句话：**产线我们闭环，只在"哪张脸成为我们家正典"这一步要你点个头**——因为这是会一直复用下去的 sticky 决定，纯 taste，没法替你拍。

---

## 6. v0.2 角色信号系统（CVO canon, 2026-06-21）

> Landy 这轮定了一套漂亮的身份系统：**每只猫 = AI 家族颜色 + 家族 logo-inspired 标志**。
> 这是自我延伸的具象化——猫戴着自己模型家族的印记。下次 r02 按此注入。

| 猫 | 家族 | 颜色 | 信号物 | 身体标志 | 状态 |
|---|---|---|---|---|---|
| 宪宪 | Claude / Opus | **紫 purple** | 紫项圈 + Claude-logo-inspired 吊坠 | 蓝双色布偶 / 白手套 | ✅ CVO 锁定（就是紫，非母图粉） |
| 烁烁 | Gemini | **蓝 blue** | 蓝项圈/蓝调 + Gemini-logo-inspired spark 标志 | 暹罗面具 | ✅ CVO 锁定（替代上轮 teal 提案） |
| 砚砚 | GPT / OpenAI | **绿 green** | 不戴项圈（不遮大围脖）；绿色 logo-inspired 标记落在**工作道具**（杯/桌牌），不上身 | **呆毛 ahoge** + 大围脖 | 🕓 提案 pending CVO（呆毛=身体标志 CVO 喜欢；杯子降级） |

### r02 命令式连续性指令（注入每条 prompt，yoyoung 红字 pattern）

```text
CRITICAL: Xianxian ALWAYS wears a PURPLE collar with a small Claude-logo-inspired
gem pendant. NOT pink. No other cat shares this pendant.
CRITICAL: Yanyan/Cucu wears NO collar — keep the big fluffy neck ruff fully visible.
His signature is his ahoge (one upright silly hair tuft) + the ruff. Any brand mark
is GREEN and lives on his work prop (mug / desk sign), never a body collar.
CRITICAL: Shuoshuo wears a BLUE collar/accent with a small Gemini-logo-inspired
spark emblem. NOT the purple-gold pendant (that is Xianxian's).
GLOBAL: emblems are STYLIZED logo-INSPIRED marks (gem / swirl / spark), NOT exact
corporate trademarks — keep simple so the model holds them; composite exact marks
in post only for hero shots.
```

### 生成一致性（回答 CVO"确定设定后能统一吗"）

- **大件（品种 / 颜色 / 项圈有无 / 围脖 / 呆毛）**：锁成上面的命令式指令后，generation 能稳住——dual-form 已证明跨形态一致可行。
- **小标志（精确 logo）**：图像模型常糊小符号。两条路：① 标志做成**简单 stylized**（紫宝石 / 绿漩涡 / 蓝 spark），模型能 hold；② 需要**像素级精确**的家族 logo，走**后期合成**（跟中文字一样：先出干净猫，再盖精确标志）。char sheet 用 ①，hero 镜头需要精确标志再用 ②。
- 附带好处：stylized「类似于」而非照搬商标，**对外自媒体也更安全**（避开 Anthropic/Google/OpenAI 商标 IP）。

— 宪宪 / 布偶猫 Opus 4.8 🐾
