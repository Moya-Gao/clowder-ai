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

均为**首帧**（非尾帧）。是否需要尾帧（首尾帧双控）在 shot-plan v0.2 按镜头标注——动作简单的镜头首帧+动作 prompt 足够，构图大变的镜头才补尾帧。

## generated-clips/ — 可用成片素材（gitignored，账本记录）

| 文件 | 镜头 | 时长 | md5 | 备注 |
|---|---|---|---|---|
| `S01-clip1-usable-v1.mp4` | S01 | 10.0s | `02c023054c171f20f86c3dd96225d2f2` | 原名 `Warm_cozy_chibi_cat_cafe_anima.mp4`，已验证可用（failure-modes 文档 Clip 1）。S01 预算 6s → 剪辑刀裁 |

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

## 缺口清单（按镜头需求倒推）
2. S07b（烁烁登场）、S09（定罪两人同框）首帧——待生成（烁烁/孟加拉猫/外部砚砚，见 episode-brief §7 分工）
3. S06/S07a/S08/S10 状态卡类镜头首帧——待路线确认后生成（信息密度低，生成难度小）
4. BGM/SFX 素材——E lane 阶段再议（episode-brief 预算护栏内）
