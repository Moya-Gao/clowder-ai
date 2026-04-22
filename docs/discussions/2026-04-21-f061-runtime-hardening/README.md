---
feature_ids: [F061]
related_features: [F061]
doc_type: discussion
status: frozen
created: 2026-04-21
last_updated: 2026-04-21
owner: 缅因猫/砚砚
---

# F061 Runtime Hardening Discussion Extract

## Original Requirement Excerpts

> "那你记录issue 一下？ commit push 后 然后开始修这四个？"

> "那你直接开始定位，负责这个bug的闭环？不需要干一会问我一下？直接和你的队友猫猫们合作就行 ？记得我之前说的那样，重要的bug定位记得写清楚代码的comments？ 以及检查是不是有comments是过时的"

> "那你赶紧闭坏！哈哈哈别at我 at你的小伙伴如果要review什么的"

## Scope We Froze From The Thread

1. 先把 `run_command` 的 approval / dispatch / capacity 脆弱性拆成 4 条可闭环任务。
2. Task 1-3 先做可观测、approval correlation、以及只读未 dispatch 命令的安全 retry。
3. Task 4 只做 spike / 结论判断，不在证据不足时盲写 bypass。
4. 代码里要留下足够清楚的关键注释，并顺手检查过时注释。
