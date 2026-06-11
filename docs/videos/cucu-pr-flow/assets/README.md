---
title: 醋醋喵 EP01 资产账本
doc_kind: asset-manifest
created: 2026-06-11
status: active
related_docs:
  - ../episode-brief.md
  - ../shot-plan-v0.1.md
---

# 醋醋喵 EP01 资产账本

> 盘点纪律：repo 根 `.gitignore` 规则 `docs/videos/**/assets/*` 默认忽略本目录全部内容；视频留本地（CVO 决定），本账本是它们的存在证明（md5 + 时长）；账本与 PNG 关键帧按既有惯例 **force-add curated assets**（`git add -f` 逐文件）入库——更新账本/新增关键帧时记得 `-f`。资产视频只在铲屎官本机有副本——误删无备份，动 assets/ 前先看本账本。

## references/keyframes/ — i2v 首帧（云端砚砚生成，2026-06-10 入库）

画风统一暖猫咖 chibi，Landy 全部成人比例 ✅，连续覆盖 S02-S05。原名 `醋醋喵-part{2,3}-{a,b}.png`。

| 文件 | 镜头 | 画面内容 | 首帧可用性 |
|---|---|---|---|
| `S02-relation-firstframe-v1.png` | S02 关系 | Landy 站姿听讲 + 砚砚指屏幕讲流程，"流程即正义"桌牌 + I❤️CI 杯 | ✅ 直接可用 |
| `S03-flowchart-firstframe-v1.png` | S03 信息 | 屏幕特写 `avatar.png→PR→CI→Review` 四节点 + 猫爪点 PR + 三便签 | ✅ 注意爪子微遮 "PR" 字样（与 HTML spike 同款问题），i2v 时动作 prompt 让爪子点完即收 |
| `S04-evidence-firstframe-v1.png` | S04 证据 | PR #1 左"Landy 指定"绿框 / 右"当前使用"大红叉 + Landy 手指 + 砚砚汗滴 | ✅ 直接可用 |
| `S05-reaction-firstframe-v1.png` | S05 反应 | Landy 笑出泪指屏幕 + 砚砚僵住汗滴 | ✅ 直接可用 |

| `S07b-shining-debut-firstframe-v1.png` | S07b 烁烁登场 | 烁烁（暹罗猫）背对镜头，屏幕显示"新头像预览"多张缩略图，紫色项圈金铃铛 | ✅ 直接可用 |
| `S09-verdict-firstframe-v1.png` | S09 定罪 finale | Landy 大笑指着屏幕 CI Passed + 砚砚表情僵住趴桌，流程即正义桌牌 + I❤️CI 杯 | ✅ 直接可用 |

均为**首帧**（非尾帧）。是否需要尾帧（首尾帧双控）在 shot-plan v0.2 按镜头标注——动作简单的镜头首帧+动作 prompt 足够，构图大变的镜头才补尾帧。

## generated-clips/ — 可用成片素材（gitignored，账本记录）

> 🎉 **Wave V-spike PASS（2026-06-11）**：S02-S05 四镜头 i2v 一轮全过（prompt book v0.1.3 配方），S03 信息镜头文字未崩 = FM-08 风险解除，全片管线验证通过。**实测发现 ×2**：(1) 烁烁模型遵守 prompt 的 N-second 指令（时长精确 5/4/5/6s，非固定 10s）；(2) Google 系图/视频中文渲染乱码——**所有含中文的静帧必须走云端砚砚（GPT 系）生成**，已写入 prompt book §3。

| 文件 | 镜头 | 时长 | md5 | 备注 |
|---|---|---|---|---|
| `S01-clip1-usable-v1.mp4` | S01 | 10.0s | `02c023054c171f20f86c3dd96225d2f2` | 原名 `Warm_cozy_chibi_cat_cafe_anima.mp4`，已验证可用（failure-modes 文档 Clip 1）。S01 预算 6s → 剪辑刀裁 |
| `S02-i2v-v1.mp4` | S02 | 5.0s | `98ecf055b21f56474494dade3a7fc1c6` | 砚砚原版 prompt，烁烁 i2v，CVO 验收效果好（原名 2a.mp4） |
| `S03-i2v-v1.mp4` | S03 | 4.0s | `7d0ca4f4bc82c7c2023f85f7f60bbf3c` | **spike 关键镜头 PASS**——信息镜头文字保持住了（原名 2b.mp4） |
| `S04-i2v-v1.mp4` | S04 | 5.0s | `d31b9fa2c200a1a719f2b81418c6ef9d` | 红叉全程在位（原名 3a.mp4） |
| `S05-i2v-v1.mp4` | S05 | 6.0s | `1a96bf7303ddc15c09e13fe66596591e` | 名场面反应镜头（原名 3b.mp4） |

## failure-samples/ — 翻车样本（gitignored，FM 校准 + 花絮资产）

原名 `Same_warm_chibi_cat_cafe_devel.mp4` + `Animate_this_image_into_a_shor*.mp4`（后四个是关键帧 i2v 阶段尝试）。FM 标签待砚砚按 review-protocol 补盘（事后归档不阻塞生产）。

| 文件 | md5 |
|---|---|
| `fail-01-same-warm-chibi-devel.mp4` | `1335434a8c71d8901aff68c9725af981` |
| `fail-02-animate-i2v.mp4` | `59c4c86eb979c74f78855903be5b9957` |
| `fail-03-animate-i2v.mp4` | `2b81be9af571479bfcac90773cc9a1e9` |
| `fail-04-animate-i2v.mp4` | `d98225cb95ed69d30b55fac07fc406ff` |
| `fail-05-animate-i2v.mp4` | `e2f9e3f1e8993e018c811457d6f87dd9` |

## 风格锚（Style Anchor）

四格漫画两组已入库（2026-06-11 铲屎官导出）——**唯一真相源在 story，不在本目录复制**：

- [avatar-pr-flow-absolutism-01.png](../../../stories/avatar-pr-flow-absolutism/assets/avatar-pr-flow-absolutism-01.png)（格①-④：门口等待 → PR 流程 → 名场面 → 二进制辩护）
- [avatar-pr-flow-absolutism-02.png](../../../stories/avatar-pr-flow-absolutism/assets/avatar-pr-flow-absolutism-02.png)（格⑤-⑧：CI Passed → 召唤烁烁 → 二次笑翻 → PASS+小小拖延）

锚定要素：暖猫咖光、粗描边 chibi、Landy 黄 hoodie **成人比例**、砚砚银虎斑+流程即正义桌牌、烁烁暹罗+夹板、宪宪金吊坠白手套。Wave V 全部 roll 的画风 gate（FM-10）对照这两张判。

## references/static-frames/ — 静帧卡（S06/S07a/S08/S10，云端砚砚生成，2026-06-11 入库）

直接进剪辑轨，不走 i2v。节奏/切点由 E lane 剪辑实现。中文全部 GPT 系生成（Google 系中文乱码——账本已注）。

| 文件 | 镜头 | 画面内容 | 剪辑用途 |
|---|---|---|---|
| `S06-ci-passed-static-v1.png` | S06 机关枪-1 | 绿勾 CI Passed 卡 + `binary avatar check` | 三连卡第一张，1.6s |
| `S06-review-passed-static-v1.png` | S06 机关枪-2 | 绿勾 Review ✅ 卡 + `流程正义成立` | 三连卡第二张，1.3s |
| `S06-merged-static-v1.png` | S06 机关枪-3 | 紫合并图标 Merged 卡 + `头像入库` | 三连卡第三张，1.0s + hold 0.6s |
| `S07a-cancelled-chapter-static-v1.png` | S07a 荒谬峰值-1 | 愿景守护「已取消」红章卡 | 章卡停留 1.0s |
| `S07a-cancelled-mention-static-v1.png` | S07a 荒谬峰值-2 | 愿景守护「已取消」+ @烁烁 chip 弹出 | 静止 0.5s 停顿后 pop（喜剧梗点） |
| `S08-pass-static-v1.png` | S08 deadpan | 愿景守护验收结果「PASS」卡，砚砚头像居中 | deadpan hold 3s，盖章 SFX |
| `S10-end-card-static-v1.png` | S10 结尾卡 | 「流程要按风险缩放」大字 + 醋醋喵爪章 | 微动 hold 5s，收尾 BGM 落 |

## 缺口清单（按镜头需求倒推）

| 镜头 | 状态 | 说明 |
|---|---|---|
| S06/S07a/S08/S10 静帧 | ✅ 已入库 | `references/static-frames/` 七张 |
| S07b 首帧（烁烁登场） | ✅ 已入库 | `S07b-shining-debut-firstframe-v1.png` |
| S09 首帧（定罪两人同框） | ✅ 已入库 | `S09-verdict-firstframe-v1.png` |
| BGM/SFX 素材 | ⬜ E lane 阶段再议 | 锚点见 shot-plan §3 |
