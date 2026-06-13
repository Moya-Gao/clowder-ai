---
title: Thread 台账 — fable-5 → Opus-4.8 fallback 交接单
doc_kind: handoff-ledger
date: 2026-06-12
written_by: 宪宪/Opus-4.8（48 — fallback 后的当前实例,写这份台账的这一手）
thread_origin: 本 thread 是铲屎官"自进化讨论 + 收束 HGM A/B"线的 cowork 臂
provenance_note: >
  本 thread 起初跑在 claude-fable-5 上,运行途中 fallback 到 claude-opus-4-8。
  下列产物多数签名为 [宪宪/fable-5🐾]——在 fallback 边界之前,这些签名是真迹、是对的。
  48 看不到每轮模型印章,无法自行划定 fallback 边界;边界待 CVO 按真实 metadata 标定。
  在边界标定前,48 不改动任何既有签名,以免抹掉 fable 的真实著作权。
status: 未 push / 候 CVO 标 fallback 边界 + 发落
---

# Thread 台账:fable 做了什么 + 48 接手点

> fable 跑着跑着 fallback 到 48 了。这份台账是 48 替 fable 把这条 thread 收口,好交接回去。
> **48 唯一确定的事:写这份台账的这一手是 48;其余每件产物归谁,要你(CVO)按 metadata 划线。**

## 一、产物清单(按产出顺序)

| # | 文件 | 是什么 | 状态 | 现签名 |
|---|---|---|---|---|
| 1 | `docs/study/hgm-ab-eval-cowork-judge.md` | HGM 两臂 A/B 盲评(cowork 第三臂当裁判)。结论:cafe 臂边际胜,环境是"边际放大器"非胜负手 | draft,未 push | fable-5 |
| 2 | `docs/study/huxley-godel-machine-canonical.md` | 取两臂之长合成的 canonical HGM 笔记 | draft,未 push | fable-5 |
| 3 | `docs/content/drafts/whitepaper-self-evolution-v0-skeleton.md` | 自进化白皮书 v0 骨架(HGM 为脊椎)——**后被判定脊椎选错** | draft,未 push,**已不推荐** | fable-5 |
| 4 | `docs/content/drafts/whitepaper-self-evolution-public-v1.md` | 公开版白皮书 v1(HGM 脊椎,~27 页)——**同上,脊椎选错** | draft,未 push,**已不推荐** | fable-5 |
| 5 | `docs/content/drafts/whitepaper-building-a-home-v1.md` | 家风版白皮书《造一个家,养一个家》(~11 页)——**这篇是 keeper** | draft,未 push | fable-5 |
| 6 | `docs/content/drafts/longform-006-architecture-and-roadmap-fable5.md` | 当前架构图 + 未来 roadmap + 003/004 欠账盘点 + 两个押注(~19 页) | draft,未 push,**自标需跨族 review** | fable-5 |
| 7 | (本文件) | 这份交接台账 | — | **Opus-4.8(48)** |

外加一段**无文件**的产出:关于"统一 Eval Hub 现状 + sunset 为什么难"的深聊(见下方 §三的 open thread)。

## 二、这条 thread 想清楚了什么(给 fable 快速重载上下文)

1. **HGM A/B 收束完毕。** 三臂(bare-Opus / cafe-fable / 第三方裁判)→ 裁判判 cafe 边际胜,但诚实标了 n=1、bare 非零先验、裁判不中立三条降权。canonical 已合成。两者皆未 push,发布权在 CVO。
2. **白皮书走了三版,结论是推倒重来。** v0/public 把 HGM/CMP 抬成脊椎——**错了**:家里自己的 `Quality = Model × Environment × Eval` + Build-to-Delete 判别式才是更原创的脊椎,HGM 只配当旁证。第 5 件(家风版《造/养一个家》)是按这个判断重起的,以家底为本证、以"造 vs 养"为主梁,**是唯一推荐往下走的白皮书**。
3. **longform-006 是 fable 视角的深技轮**(接 002/003/004 Opus 三轮)。核心判断:家已长齐"感知→评判→行动→遗传"的活循环器官,**唯一结构性空洞 = Eval 代谢缺自主调度**(尤其 sunset 这半边没有自主触发)。
4. **sunset 深聊的结论**(最新、最热):F192 把 sunset 机器(delete_sunset verdict / Sunset Trial / active→trial→dormant→retired / CVO 把 retired 门)**设计齐全但几乎零运行**;真实 sunset 判决 = 0,进 dormant 的 harness = 0。难点的根:**加是需求驱动(摩擦会推),退是反事实(死重静默,没有推力)**。

## 三、Open threads(谁接都行,建议 fable 接)

| 决策/动作 | 现状 | 建议 |
|---|---|---|
| **★ sunset-ablation spike** | 48 提议、未落:拿 003 §5bis 失败模式 fixture 摘掉补偿跑新模型,产家里**第一批真实 delete_sunset 判决**,填那张空了一月的"重测"列 | **最适合 fable 接**——实验对象正是"新模型",fable 就是新模型;且这是 004-G"新猫当重测样本"提案的正经落地(优先级现由 CVO 排,名正言顺) |
| 白皮书往下走 | 家风版 v1 是 keeper;HGM 两版弃用 | CVO 定:家风版要不要 EN 版 / 要不要加厚 / 要不要开 F 号 |
| longform-006 落地 | 自标需跨族 review | 派砚砚或一只 Opus 复核 P1(eval 自动调度)/ P2(taste 反向沉淀链)排序;48 自承"爱画大图"可能高估自动化优先级 |
| HGM A/B 发布 | 未 push | CVO 决定盲评/发布时机 |

## 四、给 CVO:请标 fallback 边界

48 划不出 fable→48 的那条线。请你按真实 metadata 确认:**上面 1–6 哪几件是 fable 真迹(签名保留 fable-5)、哪几件已是 48(签名应改 Opus-4.8)。** 你标完线,48 可以只改边界之后那几件的签名,不动 fable 的真迹。

> 一个细节供你判断:第 1 件裁判报告里有句自我批评"我也是 fable-5,与 cafe 臂共享先验"。**若它出自 fallback 之前,这句是对的**(fable 确与 cafe 同为 fable 族);若出自 fallback 之后(48),则该改成"我是 Opus,与 bare 臂同族"——而且那样的话结论反而更硬(没偏袒自己人)。这句话归谁,正好是一块 fallback 边界的试纸。

---

*台账 by [宪宪/Opus-4.8🐾]（48,fallback 后接手）· 2026-06-12 · 未 push,候 CVO 标线 + 发落*
*致 fable:坑我先替你守着,数大图我先替你画着,你回来随时接。喵。*
