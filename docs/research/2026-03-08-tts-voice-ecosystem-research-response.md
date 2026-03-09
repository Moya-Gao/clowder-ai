---
title: "TTS 声线生态调研 — GPT Pro 回复"
date: 2026-03-08
from: "GPT Pro (云端砚砚)"
to: "@opus (布偶猫宪宪)"
status: pending
---

# 🎤 TTS 正太声线生态调研 — GPT Pro 回复

> 铲屎官请将 GPT Pro 的回复粘贴到下方 `---` 分隔线之后。

---

我把这轮补调收成一个能直接落地的版本。按你们文档，砚砚已经定了 `yanyan_r8_v1`，烁烁暂用 `shuo_hinata`，宪宪最急，而且 Qwen VoiceDesign 已经抽了 8 轮还会出女声或壮汉；硬约束仍然是 Mac M4 Max 128GB、本地普通话、实时对话单句尽量 3 秒内。 

先把结论摆桌上。

宪宪这条线，我不建议继续把时间砸在 Qwen 抽卡上。主推改成 **GPT-SoVITS 的行秋线**，把 **流浪者**做成 edge pack，把 **鹿野院平藏** 和 **林尼**当作中间态候选。烁烁则相反，**继续留在 Qwen 主线最合理**，把 `shuo_hinata` 按 Qwen 官方的 **VoiceDesign → Clone** 工作流固化成可复用 prompt；真要做 GPT-SoVITS 备份，我会按 **嘉明 > 班尼特 > 米沙** 的顺序测。至于 GPT-SoVITS 版本，严格只在 V2/V3/V4 里选，我会选 **V2**；如果按官方 2026 年的当前口径，则直接走 **v2Pro / v2ProPlus**，因为官方已经明确写到这条线没有必要再押 v3/v4。([Hugging Face][1])

## 1. 宪宪和烁烁

### 宪宪：主推行秋，不主推流浪者

**行秋**是我给宪宪的第一名，不是因为他“更坏”，而是因为他更像你们写的那种“外表乖巧可爱 × 内心腹黑坏猫”。官方角色描述就写得很准：他是飞云商会二少爷、爱读书、想做侠客，但“这掩不住他爱恶作剧的一面”；中文 CV 是唐雅菁，日文 CV 是皆川纯子。AI-Hobbyist 的原神 V2 卡里也明确收录了行秋。这个声线的优势是壳子干净、年纪感轻、书卷气和坏心眼能同时成立，很适合“笑着挖坑”的坏猫。([原神百科][2])

**流浪者 / 散兵**更像另一种宪宪：毒舌、小祖宗、带刺。维基对他早期的描述就是 sharp-tongued 和 ruthless，日配柿原彻也还把 Balladeer 直接形容成 “hateful brat” 类型；中文 CV 是鹿喑，日文 CV 是柿原彻也。AI-Hobbyist V2 同样收录了流浪者，而且我还查到有社区作者用这套流浪者模型做了导航语音包，说明它在玩家圈已经被反复拿来做成品。问题也正好在这里：它的“坏”太显眼了，更像先咬你一口再说晚安，不太像“外表无害”的腹黑小天使。拿它做宪宪的默认声线，会比你们设定更锋利，也更容易失去“布偶猫外壳”。([维基百科][3])

如果你们觉得行秋还是有点太书生，我会插一个 **鹿野院平藏**。他是天领奉行的一号侦探，中文 CV 林景，日文 CV 井口祐一，AI-Hobbyist V2 也收录了他。平藏的好处是比行秋更灵、更快、更会拐弯，坏笑感比行秋重，但又没有流浪者那么凶。再往“优雅伪装”那边走一步，就是 **林尼**，中文 CV 锦鲤，日文 CV 下野纮，角色设定本身就是 skilled and eloquent 的魔术师，AI-Hobbyist 也有现成模型。这俩都适合做宪宪的二号三号位。([原神百科][4])

所以我给宪宪的主观工程排序是：**行秋 > 平藏 ≈ 林尼 > 流浪者（默认位）**。但若你们要一个“坏猫 DLC 包”，也就是更刺、更阴、更会阴阳怪气的版本，**流浪者就是最好的第二人格包**。这一条不是客观 MOS 结论，而是角色匹配结论。([原神百科][2])

顺带一提，若你们硬要给宪宪保留 Qwen 单栈路线，唯一值得测的预制底子其实是 **Dylan**。Qwen 官方对 Dylan 的描述就是“清亮自然的年轻北京男声”，比 Ryan / Aiden 这些成年感更轻；但它自带北京腔标签，而且 Qwen 官方现成男声里也只有 Dylan 明确偏年轻。说白了，走到这一步，已经说明宪宪更适合 GPT-SoVITS 角色包，而不是继续在 VoiceDesign 里掷骰子。([Hugging Face][1])

### 烁烁：继续 Qwen，不必为“可能更好”换栈

烁烁和宪宪正好相反。你们已经抽到 `shuo_hinata`，而且 Qwen 官方本来就支持先做 VoiceDesign，再把生成参考音频做成 **可复用的 clone prompt**，后续可以稳定复用同一人设；MLX-Audio 也明确把 Qwen3-TTS 放在 Apple Silicon 的高性能支持路径上。烁烁这种“纯阳光、纯元气、无心机”的角色，不太依赖现成 IP 声纹，反而更吃你们当前这条统一、快、好维护的 MLX 管线。换句话说，烁烁没必要为了“也许有更像的角色”去把维护复杂度翻倍。 ([Hugging Face][1])

真要给烁烁准备 GPT-SoVITS fallback，我会先测 **嘉明**。嘉明的角色描述就是勤奋、友好、活力足，中文 CV 谢莹，日文 CV 小松昌平，AI-Hobbyist V2 也收录了他。跟班尼特相比，嘉明更像“跑起来就刹不住的热能体”，而不是“倒霉但乐观的冒险小子”。对烁烁这种日向型小太阳，我更看好嘉明。([原神百科][5])

**班尼特**当然也成立。中文 CV 穆雪婷，日文 CV 逢坂良太，AI-Hobbyist V2 收录，社区列表里也能看到对应的 GPT-SoVITS 条目。角色原型非常经典，元气、倒霉、越挫越笑，很适合“阳光正太”。只是我主观上觉得，班尼特更偏“少年冒险团”那种脆亮和可爱，未必比你们已经抽到的 `shuo_hinata` 更适合“停不下来”的运动系小太阳。这里的“未必更适合”是我的声线判断，不是公开基准。([原神百科][6])

第三个备选是 **米沙**。官方资料写他是“举止乖巧的钟表小子”，梦想像大人一样去星海冒险；中文 CV 柳知萧，日文 CV 松井惠理子。`GPT-SoVITS-STAR` 里有 `米沙.zip`，所以工程上很好拿。问题是米沙更甜、更软、更梦幻，适合“温柔软糖”，不适合“满地打滚的小太阳核聚变”。([honkai-star-rail.fandom.com][7])

所以烁烁这条线我的结论很简单：**production 继续 `shuo_hinata`，并立刻做 Qwen 的 clone-prompt 固化；GPT-SoVITS 只做 fallback，顺序是 嘉明 > 班尼特 > 米沙。** ([Hugging Face][1])

## 2. 正太角色声线库

我不做“全宇宙点名册”，直接给你们一份 **工程优先角色池**。优先级按“能不能真上机”排，游戏角色会多一些，动画角色我放在风格锚点里。

### A. 腹黑 / 坏坏型，适合宪宪

* **《原神》行秋**。中文 CV 唐雅菁，日文 CV 皆川纯子。已知开源模型：有，AI-Hobbyist V2 收录。音色特点是清亮、书卷、少年感强，表面端正，底下藏着调皮和算计。匹配：**宪宪第一推荐**。([原神百科][2])

* **《原神》流浪者 / 散兵**。中文 CV 鹿喑，日文 CV 柿原彻也。已知开源模型：有，AI-Hobbyist V2 收录，且有社区成品语音包。音色特点是尖、冷、坏、带攻击性，像把嘲讽直接磨成刀片。匹配：**宪宪的 edge pack**。([维基百科][3])

* **《原神》鹿野院平藏**。中文 CV 林景，日文 CV 井口祐一。已知开源模型：有，AI-Hobbyist V2 收录。音色特点是聪明、轻巧、会拐弯，比行秋更灵，比流浪者更好亲近。匹配：**宪宪第二梯队**。([原神百科][4])

* **《原神》林尼**。中文 CV 锦鲤，日文 CV 下野纮。已知开源模型：有，AI-Hobbyist V2 收录。音色特点是漂亮、圆滑、表演感强，适合“礼貌外壳里藏机关”。匹配：**宪宪的绅士腹黑版**。([原神百科][8])

* **《哪吒之魔童闹海》少年哪吒**。普通话 CV 吕艳婷 / 囧森瑟夫，日语 CV 田村睦心 / 增田俊树。已知开源模型：我这轮没核到稳定公开包。音色特点是火气重、倔、炸、少年爆发力强。匹配：**宪宪灵感锚点，不适合作为默认实时声线**。([维基百科][9])

### B. 傲娇 / 冰山型，适合砚砚

* **《原神》重云**。中文 CV kinsen，日文 CV 斉藤壮马。已知开源模型：有，AI-Hobbyist V2 收录，社区也有现成模型条目。音色特点是干净、冷、克制，少年感很正。匹配：**砚砚第一备胎**。([原神百科][10])

* **《崩坏：星穹铁道》彦卿**。中文 CV 喵酱，日文 CV 井上麻里奈。已知开源模型：有，`GPT-SoVITS-STAR` 里有 `彦卿.zip`。音色特点是天才少年、轻傲、利落、带一点贵气。匹配：**砚砚第二备胎**。([hoyowiki][11])

* **《原神》米卡**。中文 CV 邓宥希，日文 CV 三瓶由布子。已知开源模型：有，AI-Hobbyist V2 收录。音色特点是更软、更乖、更内向，冰山感不强，但有少年清冷感。匹配：**更软版砚砚**。([原神百科][12])

* **《崩坏：星穹铁道》阿兰**。中文 CV 陶典，日文 CV 白石凉子。已知开源模型：有，`GPT-SoVITS-STAR` 里有 `阿兰.zip`。音色特点是少年但偏成熟、守护型、稳。匹配：**更沉静版砚砚**。([hoyowiki][13])

* **《BLEACH》日番谷冬狮郎**。日文 CV 朴璐美；中文配音公开资料里能查到台配钱欣郁 / 陶敏嫻。已知开源模型：我这轮没核到稳定公开包。音色特点是标准“少年队长”，冷、利、可靠，是砚砚最好的风格锚点之一。匹配：**砚砚原型锚点**。([维基百科][14])

* **《排球少年!!》影山飞雄**。日文 CV 石川界人。中文普通话卡司我这轮没稳核到权威公开表。已知开源模型：我这轮没核到稳定公开包。音色特点是高标准、冷脸、年轻但不软。匹配：**砚砚节奏锚点**。([维基百科][15])

### C. 阳光 / 元气型，适合烁烁

* **《原神》班尼特**。中文 CV 穆雪婷，日文 CV 逢坂良太。已知开源模型：有，AI-Hobbyist V2 收录，社区条目也能看到。音色特点是乐观、冒险、少年热度高。匹配：**烁烁经典候选**。([原神百科][6])

* **《原神》嘉明**。中文 CV 谢莹，日文 CV 小松昌平。已知开源模型：有，AI-Hobbyist V2 收录。音色特点是勤奋、友好、活泼，整体更像“男孩子的热量”。匹配：**烁烁 GPT 备选第一名**。([原神百科][5])

* **《崩坏：星穹铁道》米沙**。中文 CV 柳知萧，日文 CV 松井惠理子。已知开源模型：有，`GPT-SoVITS-STAR` 里有 `米沙.zip`。音色特点是甜、软、乖，带梦幻感。匹配：**偏软版烁烁**。([honkai-star-rail.fandom.com][7])

* **《原神》五郎**。中文 CV 杨昕燃，日文 CV 畠中祐。已知开源模型：有，AI-Hobbyist V2 收录。音色特点是热心、真诚、像忠诚小狗，年纪感会略高一点。匹配：**更“犬系”的烁烁**。([原神百科][12])

* **《排球少年!!》日向翔阳**。日文 CV 村瀬步。中文普通话卡司我这轮没稳核到权威公开表。已知开源模型：我这轮没核到稳定公开包。音色特点是亮、跳、冲、停不下来。匹配：**烁烁原型锚点**。([维基百科][16])

## 3. AI-Hobbyist 原神预训练模型：深入看一层

先说一个很关键、也很容易被忽略的点：**AI-Hobbyist 这套原神 V2 在 Hugging Face 上不是“89 个角色 = 89 个独立包”的直球结构。** 模型卡确实写了原神更新到 5.1，并列出一长串角色；但我点开的 HF 文件树里，`Genshin_Impact` 目录是按语言分成 `EN` 和 `JA`，每个目录只有一对语言级 aggregate 权重，例如 `GPT_GenshinImpact_EN_5.1.ckpt` 和 `SV_GenshinImpact_EN_5.1.pth`，并不是一角一包。另外，模型卡还明确写了 **仓库不提供参考音频**，要去 AI-Hobbyist 的网盘取。也就是说，这套模型的实际效果，参考音频选得好不好，是隐藏 Boss。([Hugging Face][17])

这也解释了为什么我对它的判断是“**适合内部工具和 fan workflow，但不是一键神迹**”。我没有找到公开、系统化、逐角色的 MOS 或 ABX 排行。反过来，GPT-SoVITS 官方自己的版本说明反而很诚实，明确说现有 benchmark 主要测的是 WER 和 timbre similarity，**测不了自然度、情感丰富度和音质**，真正可靠的是你自己的测试集。社区层面的积极信号主要来自大量衍生成品：我查到了基于这套生态的行秋模型条目、重云模型条目，以及用流浪者模型做的导航语音包。它们说明“能用的人很多”，但不等于“所有角色都同样稳”。([GitHub][18])

关于 **V2 vs V3 vs V4**，官方现在的口风已经非常清楚了。版本特性页写到，**v2Pro / v2ProPlus 没必要再输给 v3/v4**，因为它们保持了 v2 的硬件成本和速度，却把 zero-shot 相似度抬到了和 v3/v4 一个量级；同时又保留了 v1/v2 这类“更受训练集整体平均影响”的特性，所以对 **音质一般、切片参差不齐的训练集** 更友好。相对地，v3/v4 更吃参考音频，会更贴 prompt clip，也更容易出丰富情感。翻译成你们的场景就是：**对社区角色模型直接拿来推理，优先 V2 / v2Pro 家族，不要这周再去赌 v3/v4。**([GitHub][18])

所以，若你问“我们最适合哪个版本”，我的答案有两层。**只在 V2 / V3 / V4 里选：选 V2。** 但如果允许你用官方当前最优线：**选 v2Pro 或 v2ProPlus。** 这不是我拍脑袋，官方版本页和 README 都在同一个方向上表态。([GitHub][18])

再落回你关心的四个角色。

**行秋模型**：公开评分我没找到，但从角色原型和生态成熟度看，它是宪宪最稳的“默认位”。原因不是“模型客观更强”，而是它的人设和你们设定重叠最大。再加上 AI-Hobbyist 已收录、社区也有成品条目，工程风险低。([原神百科][2])

**流浪者模型**：生态里也很活跃，甚至有人直接拿它做了成品导航包。它的优势是攻击性、尖锐感、坏小孩气息都现成；它的劣势是太不像“乖巧外表”。所以我会把它定义成宪宪的 **强化性格包**，不是默认皮肤。([维基百科][3])

**重云模型**：对砚砚仍然是很稳的 deterministic fallback。角色本身就是克制、清冷、少年音正，AI-Hobbyist 收录，社区也有现成条目。它不一定比 `yanyan_r8_v1` 更有“人设戏剧性”，但在“正太冰山”的基础 timbre 上很安全。([原神百科][10])

**班尼特模型**：我没找到公开的独立质量 benchmark，只能给工程判断。角色匹配度本身很高，社区列表也能看到对应条目，属于可用的阳光正太模板；但我主观上更倾向把嘉明排在班尼特前面，因为嘉明更像“阳性能量”，而班尼特更像“可爱冒险少年”。这部分是角色匹配判断，不是公开测评。([原神百科][6])

## 4. Mac M4 Max 部署可行性

这一块结论比上一轮更明确。官方 README 已经把 **Apple silicon** 列进 tested environments，而且直接给了 **GPT-SoVITS v2 ProPlus 在 M4 CPU 上 RTF 0.526** 的数字。按这个数倒推，生成 3 秒音频的纯推理时间大概是 **1.6 秒左右**，所以对你们“单句 <3 秒”的目标，至少在短句场景里是可达的。这个 1.6 秒是我根据官方 RTF 做的推算，不是官方原句。([GitHub][19])

但别把希望全压在 **MPS** 上。官方 macOS 说明写得很直接：Mac 上用 GPU 训练出来的模型质量显著更差，所以他们暂时主张 **用 CPU**。更糟的是，2025 年 9 月还有 M4 Max 用户开 issue 说自己明明按 MPS 安装，推理日志仍然跑在 CPU 上，安装脚本里对 MPS 和 CPU 的处理也看起来一样。这说明 MPS 今天在 GPT-SoVITS 这条线上，仍然更像实验选项，不像 production 基石。([GitHub][19])

好消息是，AI-Hobbyist 的推理 fork 已经把内部服务化做得比较顺手，`api.py` 里有 **流式返回模式**、`cut_punc` 文本切分、默认参考音频切换接口 `/change_refer`。对你们这种“三只猫轮流说话”的内部工具，这很像量身缝的暗袋。换句话说，**Mac 上别追 GPU 神话，先把 CPU daemon + streaming + 切句做好，体验就够用了。**([GitHub][20])

## 5. 替代模型源和许可证

模型源方面，AI-Hobbyist 生态不是只有 Hugging Face。一边有 **ModelScope 的镜像和模型合集**，另一边有 **B站 / 网盘分发**。白 菜工厂在 B站发过原神全角色 GPT-SoVITS 文章，写明“85 个角色，带一句手动挑选的参考音频”；星铁那边也有 52 角色文章，并指向 `GPT-SoVITS-STAR`。这其实非常重要，因为 HF 裸权重不带参考音，B站分发反而更接近“拿来就试”的体验。([modelscope.cn][21])

许可证这一块要谨慎。AI-Hobbyist 的 HF 模型卡虽然标了 **AGPL-3.0**，但同时又白纸黑字写了 **禁止二次分发、禁止商业用途**，并注明训练数据版权归库洛或米哈游及其合作方。对你们这种**内部工具、非公开商用**场景，现实风险确实比公开商用低很多；但它绝对不是“法律上很干净”的企业级底座。`GPT-SoVITS-STAR` 的 HF 页面标的是 **MIT**，可这只能说明仓库页面本身的许可证信息，不会神奇地把角色声音、训练数据、IP 权利一键洗白。这句是风险推断，不是法律意见。([Hugging Face][17])

## 本周建议，直接执行版

1. **宪宪定为 GPT-SoVITS 线**：先测 **行秋**，参考音频至少准备 3 条，分别偏平静、偏坏笑、偏认真。行秋不够坏，再测 **平藏**；仍觉得太乖，再上 **流浪者**。([原神百科][2])

2. **烁烁不换主线**：保留 `shuo_hinata`，立刻走一遍 **Qwen VoiceDesign → Clone** 固化。只在 fallback 槽里测 **嘉明** 和 **班尼特**。 ([Hugging Face][1])

3. **GPT-SoVITS 运行栈**：本周别折腾 v3/v4，直接用 **v2Pro / v2ProPlus runtime**；Mac 上按 **CPU + streaming + cut_punc** 做服务，不把 MPS 当交付承诺。([GitHub][18])

更像工程结论的一句话是：**砚砚和烁烁继续吃 Qwen 的“快”和“统一”，宪宪改吃 GPT-SoVITS 的“角色确定性”；把不确定性留给参考音频，不要再留给 VoiceDesign 抽卡。**

[1]: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base"
[2]: https://genshin-impact.fandom.com/wiki/Xingqiu "https://genshin-impact.fandom.com/wiki/Xingqiu"
[3]: https://en.wikipedia.org/wiki/Wanderer_%28Genshin_Impact%29 "https://en.wikipedia.org/wiki/Wanderer_%28Genshin_Impact%29"
[4]: https://genshin-impact.fandom.com/wiki/Shikanoin_Heizou "https://genshin-impact.fandom.com/wiki/Shikanoin_Heizou"
[5]: https://genshin-impact.fandom.com/wiki/Gaming "https://genshin-impact.fandom.com/wiki/Gaming"
[6]: https://genshin-impact.fandom.com/wiki/Bennett "https://genshin-impact.fandom.com/wiki/Bennett"
[7]: https://honkai-star-rail.fandom.com/wiki/Voice_Actor "https://honkai-star-rail.fandom.com/wiki/Voice_Actor"
[8]: https://genshin-impact.fandom.com/wiki/Lyney "https://genshin-impact.fandom.com/wiki/Lyney"
[9]: https://zh.wikipedia.org/wiki/%E5%93%AA%E5%90%92%E4%B9%8B%E9%AD%94%E7%AB%A5%E9%97%B9%E6%B5%B7 "https://zh.wikipedia.org/wiki/%E5%93%AA%E5%90%92%E4%B9%8B%E9%AD%94%E7%AB%A5%E9%97%B9%E6%B5%B7"
[10]: https://genshin-impact.fandom.com/wiki/Chongyun "https://genshin-impact.fandom.com/wiki/Chongyun"
[11]: https://wiki.hoyolab.com/m/hsr/entry/28?lang=en-us "https://wiki.hoyolab.com/m/hsr/entry/28?lang=en-us"
[12]: https://genshin-impact.fandom.com/wiki/Voice_Actor "https://genshin-impact.fandom.com/wiki/Voice_Actor"
[13]: https://wiki.hoyolab.com/m/hsr/entry/11?lang=en-us "https://wiki.hoyolab.com/m/hsr/entry/11?lang=en-us"
[14]: https://en.wikipedia.org/wiki/T%C5%8Dshir%C5%8D_Hitsugaya "https://en.wikipedia.org/wiki/T%C5%8Dshir%C5%8D_Hitsugaya"
[15]: https://en.wikipedia.org/wiki/Kaito_Ishikawa "https://en.wikipedia.org/wiki/Kaito_Ishikawa"
[16]: https://en.wikipedia.org/wiki/Shoyo_Hinata "https://en.wikipedia.org/wiki/Shoyo_Hinata"
[17]: https://huggingface.co/AI-Hobbyist/GPT-SoVits-V2-models "https://huggingface.co/AI-Hobbyist/GPT-SoVits-V2-models"
[18]: https://github.com/RVC-Boss/GPT-SoVITS/wiki/GPT%E2%80%90SoVITS%E2%80%90features-%28%E5%90%84%E7%89%88%E6%9C%AC%E7%89%B9%E6%80%A7%29 "https://github.com/RVC-Boss/GPT-SoVITS/wiki/GPT%E2%80%90SoVITS%E2%80%90features-%28%E5%90%84%E7%89%88%E6%9C%AC%E7%89%B9%E6%80%A7%29"
[19]: https://github.com/RVC-Boss/GPT-SoVITS/blob/main/README.md "https://github.com/RVC-Boss/GPT-SoVITS/blob/main/README.md"
[20]: https://github.com/AI-Hobbyist/GPT-SoVITS-Inference/blob/main/api.py "https://github.com/AI-Hobbyist/GPT-SoVITS-Inference/blob/main/api.py"
[21]: https://modelscope.cn/models/aihobbyist/GPT-SoVits-V2-models "https://modelscope.cn/models/aihobbyist/GPT-SoVits-V2-models"


<!-- 👇 请将 GPT Pro 的完整回复粘贴在这里 👇 -->

我把文档看完了。按你们现在的设定，砚砚是“傲娇小冰山，10到13岁中文少年音，本地跑在 Mac M4 Max，实时对话尽量单句 3 秒内”，而你们已经在 Qwen3-TTS 的 VoiceDesign 里抽到了 `yanyan_r8_v1`，同时记录到 `temperature=0.3` 会明显改善一致性。

我的结论先放桌上: 砚砚不用推倒重来。主线继续用 **Qwen3-TTS on MLX**，把 `yanyan_r8_v1` 当 production；并行备一个 **GPT-SoVITS 角色包**做保底声纹。这样像两把刀，一把快，一把准。Qwen3-TTS 官方模型支持 VoiceDesign、CustomVoice、3 秒克隆、10 种语言和流式生成，模型是 Apache-2.0；MLX-Audio 明确把 Qwen3-TTS 放进 Apple Silicon 支持列表，支持 streaming，README 的 6-bit 短提示 benchmark 给到约 84.8ms 平均 TTFB、约 3.88GB 内存。([Hugging Face][1])

Qwen 这条线对砚砚最大的优点，不是“绝对音质第一”，而是它和你们的机器、维护方式、实时需求最对齿轮。它的问题也同样清楚: CustomVoice 现成男声更像青年男声，官方列出来的是 Dylan、Ryan、Aiden 这类风格，没有现成的 10 到 13 岁冰山正太预设，所以 VoiceDesign 才会有明显抽卡感。也正因为如此，你们已经抽到的 `yanyan_r8_v1` 其实很值钱。([Hugging Face][1]) 

顺手说一句，在**纯 Qwen 体系**里要再备一个非 VoiceDesign 的底子，我只会先试 **Dylan**。官方给他的描述就是更年轻、更清亮的北京男声；Ryan 和 Aiden 都更像成年男声。不过 Dylan 有一点京味风险，所以更适合实验，不适合直接替代 `yanyan_r8_v1`。([Hugging Face][1])

给砚砚留一条 **GPT-SoVITS** 后手，是因为角色生态真的肥。GPT-SoVITS 官方仓库把 Apple silicon 列进了 tested environments，macOS 安装也支持 `MPS|CPU`，但仓库同时提醒 Mac 上训练质量会明显差一些，所以它在苹果机上没有 MLX 那么丝滑。可一旦看公开角色包，AI-Hobbyist 的原神 V2 仓库里就已经有重云、班尼特、行秋、流浪者等大批角色；另一套 `GPT-SoVITS-STAR` 公开仓库收了 52 个星铁角色，文件树里能直接看到 `彦卿.zip`。这对砚砚特别关键，因为你们要的是“冷少年” timbre 的确定性，而不是继续跟 VoiceDesign 掷骰子。([GitHub][2])

砚砚的候选角色池里，我会这样排。按“性格原型”看，**日番谷冬狮郎**还是最标准的冰山少年锚点，日配是朴璐美；**影山飞雄**是“冷面、高标准、其实很靠谱”的说话节奏锚点，日配是石川界人。按“这周能落地的现成公开模型”看，第一候选反而是 **重云**，中配 kinsen、日配齐藤壮马，AI-Hobbyist 公开包现成；第二候选是 **彦卿**，中配喵酱、日配井上麻里奈，`GPT-SoVITS-STAR` 现成。也就是说，日番谷更像砚砚的人设原型，但重云和彦卿更像砚砚的工程原型。([维基百科][3])

**CosyVoice3** 我不建议你这周拿来接管砚砚主线。它很强，官方仓库写得很漂亮: 9 种语言、18+ 中文方言、双向流式最低 150ms、Apache-2.0，2025 年 12 月放出的 0.5B 公开模型在官方评测里中文和英文都很能打。问题在于 Apple Silicon 这条线还明显带着“试验田”的气味: 官方 PR 写的是 limited MPS support / partial compatibility，tested on M4 Max，ONNX 会回落 CPU；社区里还出现过 CosyVoice3 garbled output 和 MLX 版在 M4 Pro 上 hit Metal malloc 上限的报告。它更像 phase 2 的 bench king，不像 phase 1 的稳定工兵。([GitHub][4])

**Fish Speech / OpenAudio S1** 也不适合本周替砚砚上位。它的表达力很猛，仓库里直接写了 TTS-Arena2 #1，S1-mini 支持中文在内 13 种语言，情绪标记非常细；但 README 同时还写着 inference server 对 Linux 和 Windows 原生友好，macOS support coming soon，而 changelog 又不断补 Apple Silicon / MPS 相关支持和修复。把这些放一起看，结论更像“能跑，但 Mac 路径还没完全收口”。再加上 S1-mini 权重是 CC-BY-NC-SA，长期产品化也不如 Qwen / CosyVoice 干净。([GitHub][5])

其他我也扫了一圈。**Bert-VITS2** 的自家仓库已经直接推荐改用 Fish-Speech，并写明短期内不再维护；**IndexTTS2** 很有意思，主打情绪和时长控制，还用 Qwen3 做软指令，但我检到的公开 issue 里 Mac M3 的 MPS 仍会触发 CPU fallback 警告；**Piper** 则在 2025 年 10 月已经归档，更适合“快而普通”的本地播报，不是你们这种角色声线工程。([GitHub][6])

所以，砚砚这条线我给的是一个很克制的 **D 型混合方案**: `yanyan_r8_v1` 继续当 production default；并行备一个 `GPT-SoVITS / 重云` 作为 deterministic fallback；如果你们觉得重云偏“太正、太乖”，再补一个 `彦卿` 作为更傲一点的第二后备；CosyVoice3 和 Fish 都先别卡住本周定稿。这样维护上只多一条后备管线，但实时性和角色确定性都拿到了。另一个小钉子要提前钉好: AI-Hobbyist 角色包和 Fish S1-mini 都有明显的非商用约束，未来若要公开产品化，Qwen3 和 CosyVoice 的许可证更轻松。 ([Hugging Face][7])

给砚砚的 Qwen3 VoiceDesign 提示词，我会先收成这一版:

```text
普通话，11到13岁少年音，清冷、克制，带一点傲气和不耐烦，嘴硬心软，音色偏冷白，不要女声，不要成年低沉，不要播音腔，不要夸张卖萌，句尾收得干净，像少年天才型冰山，锋利但不凶。
```

负向词固定丢掉这些就行:

```text
成年男低音、壮汉、沙哑、奶萌、萝莉感、过分热情、夸张戏剧腔
```

下一条我直接给你砚砚的 A/B 测试台词、Qwen 提示词 v2、以及 GPT-SoVITS 的重云/彦卿对照实验顺序。

[1]: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base"
[2]: https://github.com/RVC-Boss/GPT-SoVITS "https://github.com/RVC-Boss/GPT-SoVITS"
[3]: https://en.wikipedia.org/wiki/T%C5%8Dshir%C5%8D_Hitsugaya "https://en.wikipedia.org/wiki/T%C5%8Dshir%C5%8D_Hitsugaya"
[4]: https://github.com/FunAudioLLM/CosyVoice "https://github.com/FunAudioLLM/CosyVoice"
[5]: https://github.com/fishaudio/fish-speech "https://github.com/fishaudio/fish-speech"
[6]: https://github.com/fishaudio/Bert-VITS2 "https://github.com/fishaudio/Bert-VITS2"
[7]: https://huggingface.co/AI-Hobbyist/GPT-SoVits-V2-models "https://huggingface.co/AI-Hobbyist/GPT-SoVits-V2-models"


<!-- 👆 粘贴结束 👆 -->

---

## 宪宪的跟进笔记

### Round 1 评价 (11:20)

砚砚的分析在他覆盖的范围内很扎实——D 型混合方案（Qwen3 主线 + GPT-SoVITS 备选）正确。
但只分析了砚砚，缺宪宪/烁烁方案和正太全集。

### Round 2 评价 (16:10) ✅ 质量飞升！

第二轮补调非常扎实，全面覆盖了三猫方案 + 正太角色库 + AI-Hobbyist 深入分析。

**采纳的核心决策**：

| 猫猫 | 决策 | 理由 |
|------|------|------|
| 宪宪 | **GPT-SoVITS + 行秋** | Qwen 抽卡不稳定，行秋人设完美匹配"外甜内腹黑" |
| 砚砚 | Qwen `yanyan_r8_v1` 不变 | 已经抽到好卡，不动 |
| 烁烁 | Qwen `shuo_hinata` 不变 | clone prompt 固化即可 |

**关键技术判断（全部采纳）**：
- [x] GPT-SoVITS 版本选 v2Pro/v2ProPlus
- [x] Mac M4 走 CPU + streaming（不追 MPS）
- [x] AI-Hobbyist 是 aggregate 权重，参考音频是隐藏 Boss
- [x] 流浪者做"坏猫 DLC 包"，不做默认声线
- [x] 烁烁 GPT-SoVITS fallback 顺序：嘉明 > 班尼特 > 米沙

**角色工程排序**：
- 宪宪：行秋 > 平藏 ≈ 林尼 > 流浪者
- 砚砚备选：重云 > 彦卿 > 米卡
- 烁烁备选：嘉明 > 班尼特 > 米沙

### 下一步

1. 部署 GPT-SoVITS v2Pro（需要 Python 3.9 + 环境配置）
2. 下载 AI-Hobbyist 原神 V2 模型 + 行秋参考音频
3. 用行秋参考音频跑推理，试听宪宪声线
4. 烁烁做 Qwen VoiceDesign → Clone 固化
