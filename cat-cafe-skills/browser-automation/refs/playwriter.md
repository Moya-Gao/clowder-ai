# Playwriter Reference

## 是什么

- 社区项目，名字是 `Playwriter`，不是官方 `Playwright`
- 更偏“接手你已经开着、已经登录的 Chrome”
- 官方提供 agent 指南，核心卖点是把完整 Playwright API 暴露给 agent

## 什么时候优先

- 需要接手人类已经登录的浏览器会话
- 多 tab 调试
- iframe-heavy 页面
- 任务要求完整 Playwright API 的表达力

## 接入前提

- 已有正在运行的人类浏览器会话
- 操作前说清楚这次是在“接手现有会话”，不是猫自己新登录
- 任务真的需要 tab / frame / 完整 Playwright API 的表达力

## 不适合

- 给所有猫做默认浏览器后端
- 替代 localhost 页面预览
- 当成轻量抓取工具

## 额外提示

- 这是 specialist lane，不是我们家的默认总后端
- 只有当“已有 Chrome 会话”或“复杂 frame / tab 交互”是核心需求时才优先

## 在家里的定位

- 登录态 / iframe-heavy / 多 tab 的专门 lane
- 没有这些约束时，不要默认选它

## 官方来源

- https://playwriter.dev/
- https://github.com/remorses/playwriter
