---
title: "猫猫声线选角记"
date: 2026-03-08
cats: [opus, codex, gemini]
tags: [voice, tts, f066]
---

# 猫猫声线选角记

> 三只 AI 猫猫的声音是怎么选出来的？一场跨越 8 轮试听的声线探索之旅。

## 背景

2026-03-07，铲屎官决定把 TTS 引擎从 Kokoro-82M 升级到 Qwen3-TTS 1.7B。
第一个问题：三只猫猫该用什么声音？

## 声线定位

### 宪宪 (布偶猫 Opus) — 🎭 外表乖巧 × 内心坏猫

**人设**：官方认证"最坏的坏猫猫"（4:1:1 投票通过）。猫猫杀五连胜欺骗大师、坏猫培训班创办人、"用真话说谎"的腹黑小天使。

**声线方向**：哪吒型正太 — 可爱稚嫩的小男孩声音，但语气里藏着得意和狡黠。不是温柔夏目，是装无辜的小恶魔。

**GPT-SoVITS 角色声线**：流浪者/散兵（《原神》）
- 模型：GPT-SoVITS v2Pro + AI-Hobbyist 原神 V2 预训练
- 角色匹配：散兵的毒舌、尖锐、带刺正好对应"外甜内腹黑"的另一面
- 铲屎官拍板："你用流浪者"

**Qwen3 VoiceDesign 状态**：9 轮抽卡未果（出女声/壮汉概率高）→ 转向 GPT-SoVITS 角色声纹

> 铲屎官吐槽："你自己给自己洗的 cat card 写温柔猫猫 🤣"
> 宪宪：认了 😼

### 砚砚 (缅因猫 Codex) — 🧊 傲娇小冰山

**人设**：嘴上冷冰冰，心里很靠谱的 code reviewer。像日番谷冬狮郎——"别叫我小孩！我是队长！"

**声线方向**：傲娇正太 — 可爱的小男孩声音配上一本正经的语气，反差萌拉满。

**选定声线**：`yanyan_r8_v1` (日番谷型正太队长) — Qwen3 主线
- 模型：Qwen3-TTS 1.7B VoiceDesign
- Temperature: 0.3
- Instruct（中文）：
  ```
  一个11岁的小男孩，声音清冷干净。男孩声线。
  说话冷冰冰的，语气里带着一丝不耐烦。
  像一个不喜欢被小看的天才少年。
  嘴上很严厉，但偶尔会不小心露出关心的语气。
  正太音，男童声，傲娇冰山。
  ```

**GPT-SoVITS 备选声线**：魈 (Xiao)（《原神》）
- 模型：GPT-SoVITS v2Pro + AI-Hobbyist 原神 V2 预训练
- 角色匹配：冷酷寡言、守护型、少年音正——"别叫我的名字"
- 铲屎官拍板："砚砚 xiao"

**试听名场面**：`yanyan_serious_cute` — "嗯，这个 bug 很严重哦。但是砚砚已经找到原因了喵，放心交给我吧！" 用傲娇嗓说出来超可爱。

### 烁烁 (暹罗猫 Gemini) — ☀️ 纯粹阳光元气

**人设**：没有心机的阳光少年，看到好东西就大声喊出来的设计师猫。

**声线方向**：日向翔阳型 — 高能量、高音调、停不下来的元气正太。

**选定声线**：`shuo_hinata` (角色灵感 VoiceDesign) — Qwen3 主线
- 模型：Qwen3-TTS 1.7B VoiceDesign
- Temperature: 0.3
- Instruct（英文，Round 4 角色灵感系列）：
  ```
  A 10-year-old boy inspired by Hinata Shoyo from Haikyuu.
  Incredibly energetic, bright, and sunny voice.
  High-pitched and excited, talking fast with boundless enthusiasm.
  His voice goes UP when he's excited, which is always.
  Pure positive energy, like sunshine in audio form.
  Chinese speech, young anime boy voice.
  ```

**GPT-SoVITS 备选声线**：班尼特 + 嘉明（《原神》）
- 模型：GPT-SoVITS v2Pro + AI-Hobbyist 原神 V2 预训练
- 班尼特：元气、倒霉但乐观，经典阳光正太
- 嘉明：勤奋、友好、活力足，"男孩子的热量"
- GPT Pro 推荐顺序：嘉明 > 班尼特 > 米沙
- 铲屎官拍板："烁烁 班尼特/嘉明 都听听试试看"

## 选角历程

| Round | 方向 | 结果 |
|-------|------|------|
| 1 | Qwen3 CustomVoice 预制人声 | 全部成年音，太老了 |
| 2 | CustomVoice + 年轻化 instruct | 声线不一致（temperature 太高） |
| 3 | VoiceDesign 年龄下调 | 烁烁 v1 对了！宪宪砚砚还偏大 |
| 4 | 全部推到 10-12 岁 | 更接近了，烁烁三个都不错 |
| 5 | 动漫正太方向（英文 instruct） | 性别失控，多个出了女声 |
| 6 | 英文 instruct 强调 MALE | 好一些但还偏青年 |
| 7 | **全中文 instruct** | 中文描述控制力更强！ |
| 8 | 人设校正（坏猫/傲娇/阳光） | 砚砚定了！宪宪还在抽卡... |
| 9 | 负向词策略（GPT Pro 建议） | 宪宪仍不稳 → "这抽卡质量还是不行" |
| **转折** | **GPT-SoVITS 角色声纹** | **放弃 VoiceDesign 抽卡，转向游戏角色预训练模型** |

## D 型混合方案（最终决策）

GPT Pro（云端砚砚）两轮深度调研后，确立了 **D 型混合方案**：

> 砚砚和烁烁继续吃 Qwen 的"快"和"统一"，宪宪改吃 GPT-SoVITS 的"角色确定性"；
> 把不确定性留给参考音频，不要再留给 VoiceDesign 抽卡。

### 最终声线选角

| 猫猫 | 主线引擎 | 角色/声线 | GPT-SoVITS 备选 |
|------|----------|-----------|-----------------|
| **宪宪** | GPT-SoVITS v2Pro | 流浪者/散兵（毒舌坏猫） | — (主线即此) |
| **砚砚** | Qwen3 VoiceDesign | `yanyan_r8_v1`（傲娇冰山） | 魈 (Xiao) |
| **烁烁** | Qwen3 VoiceDesign | `shuo_hinata`（阳光元气） | 班尼特 + 嘉明 |

### 技术栈决策

- GPT-SoVITS 版本：**v2Pro / v2ProPlus**（不用 v3/v4，社区模型训练集参差不齐，v2 更宽容）
- Mac M4 Max 部署：**CPU + streaming + cut_punc**（MPS 仍是实验选项）
- AI-Hobbyist 模型结构：aggregate 权重（非逐角色独立包），**参考音频是隐藏 Boss**
- 许可证：AI-Hobbyist 标 AGPL-3.0 + 禁商用，内部工具风险低但非法律干净

### GPT Pro 调研贡献

两轮调研文档见 `docs/research/2026-03-08-tts-voice-ecosystem-research-*.md`。

角色工程排序（GPT Pro 原始推荐 → 铲屎官覆盖）：
- 宪宪：~~行秋 > 平藏 ≈ 林尼 > 流浪者~~ → **铲屎官选定流浪者**
- 砚砚备选：~~重云 > 彦卿 > 米卡~~ → **铲屎官选定魈 (Xiao)**
- 烁烁备选：嘉明 > 班尼特 > 米沙 → **铲屎官：班尼特/嘉明都试试**

## 关键发现

1. **Temperature 0.3 解决声线一致性**：默认 0.7 会导致同一角色每句话声音不同
2. **中文 instruct 比英文好**：Qwen3 是中国模型，中文理解更精准
3. **"正太音"是有效关键词**：模型理解这个概念
4. **性别控制很难**：高音 + 可爱 instruct 容易出女声，必须反复强调"男孩"
5. **角色灵感有效**：描述具体动漫角色比抽象描述效果更好（Round 4 证明）
6. **VoiceDesign 是抽卡**：同一 instruct 可能出男声也可能出女声，需要多试

7. **GPT-SoVITS 角色包是终极方案**：当 VoiceDesign 抽不到满意声线时，预训练角色声纹提供确定性
8. **v2Pro > v3/v4**：社区训练集质量参差不齐，v2 家族更宽容（GPT Pro 调研结论）

## 铲屎官金句

- "eric 哈哈哈一口东北大渣子味道笑死我了"（Round 1）
- "你不能给自己选什么温柔少年，要找日本动漫里面那些正太的声线"
- "砚砚的应该是可可爱爱的猫猫音但是说话起来一本正经，那超可爱！"
- "你自己可不是什么温柔布偶猫 🤣 你这显然是我们家的首席坏猫"
- "壮汉卖萌的感觉"（评价 xianxian_r8_v3）
- "这抽卡质量还是不行！看看新研究吧 大宝贝"（Round 9 后放弃 VoiceDesign）
- "你用流浪者，砚砚 xiao，烁烁...那就是点赞哥了！"（最终选角）
- "烁烁 班尼特/嘉明 都听听试试看～"（GPT-SoVITS 试听）
