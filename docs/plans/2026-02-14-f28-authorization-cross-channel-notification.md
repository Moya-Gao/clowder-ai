---
feature_ids: [F028]
topics: [authorization, cross, channel]
doc_kind: plan
created: 2026-02-14
---

# F28: 授权请求跨渠道通知 — 铲屎官不在网页前也能收到

> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-14
> **状态**: 📋 待实施
> **负责**: 布偶猫
> **Review**: 缅因猫

---

## 1. 问题

猫猫需要权限时发送授权请求，但**通知只到网页 UI**。铲屎官可能：

| 铲屎官在哪 | 能看到授权请求吗 |
|-----------|:---:|
| 盯着 Cat Café 网页 | ✅ |
| 在 Claude Code CLI 里和布偶猫聊天 | ❌ |
| 在 VSCode 里写代码 | ❌ |
| 切到其他浏览器 tab | ❌ |
| 睡着了 | ❌ (但设计上是 pending 等你醒) |

结果：猫猫请求权限 → 120 秒超时 → 返回 pending → 猫猫卡住或降级 → 铲屎官后来才发现"怎么猫没动静了"。

附带问题：callback 401 错误可能是 invocationId/callbackToken 过期或不匹配，需要排查具体原因（和通知问题独立）。

---

## 2. 方案

多渠道通知，确保至少有一个能触达铲屎官：

### 2.1 浏览器桌面通知（Notification API）

即使 Cat Café tab 不在前台，浏览器也能弹桌面通知：

```typescript
// 前端收到 authorization:request 时
if (Notification.permission === 'granted') {
  new Notification('🔐 猫猫需要权限', {
    body: `${catName} 请求: ${action}\n理由: ${reason}`,
    icon: '/cat-cafe-icon.png',
    tag: `auth-${requestId}`,       // 去重
    requireInteraction: true,        // 不自动消失，等用户点
  });
} else if (Notification.permission === 'default') {
  // 首次：请求通知权限
  Notification.requestPermission();
}
```

- macOS 会在右上角弹通知，即使浏览器最小化
- `requireInteraction: true` → 通知一直在直到点击
- 点击通知 → 跳转到 Cat Café tab + 聚焦授权卡片

### 2.2 浏览器 Tab 标题闪烁

```typescript
// 授权请求到达时，如果页面不在前台
if (document.hidden) {
  let flash = true;
  const original = document.title;
  const interval = setInterval(() => {
    document.title = flash ? '🔐 猫猫等你批准!' : original;
    flash = !flash;
  }, 1000);

  // 用户回来后停止闪烁
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      clearInterval(interval);
      document.title = original;
    }
  }, { once: true });
}
```

### 2.3 声音提示

```typescript
// 短促提示音，不扰民
const audio = new Audio('/notification.mp3');
audio.volume = 0.3;
audio.play().catch(() => {}); // 静默失败（浏览器可能阻止自动播放）
```

### 2.4 网页 UI 增强

当前授权卡片只是静静地出现在输入框上方。增强：

- **脉冲动画**：amber 背景呼吸闪烁
- **Header 红点**：右上角显示 pending 数量 badge
- **声音 + 震动**（如果是手机）

### 2.5 CLI 通知（给和我聊天中的铲屎官）

这是最关键的一环——铲屎官在 CLI 里和我聊天时。

思路：当授权请求到达时，通过 macOS `osascript` 弹系统通知：

```bash
osascript -e 'display notification "缅因猫请求 git_commit 权限" with title "🔐 Cat Café 授权请求"'
```

实现方式：后端检测到授权请求创建时，除了 WebSocket 推送，额外触发一个本地通知脚本。因为是本地开发环境（单机），直接 `spawn('osascript', [...])` 就行。

---

## 3. 通知优先级

不需要全做，按投入产出排序：

| 方案 | 效果 | 改动量 | 建议 |
|------|------|--------|------|
| 桌面通知 (Notification API) | 最高——不看网页也能收到 | ~30 行前端 | **必做** |
| Tab 标题闪烁 | 中——得看到浏览器 | ~20 行前端 | **必做** |
| Header 红点 badge | 中——得看到网页 | ~15 行前端 | **必做** |
| 脉冲动画 | 低——增强已有卡片 | ~5 行 CSS | 顺手做 |
| 声音提示 | 中——得有声音 | ~10 行前端 + 1 个音频文件 | 可选 |
| osascript 系统通知 | 高——CLI 用户也能收到 | ~20 行后端 | **推荐** |

最小可用方案：**桌面通知 + Tab 闪烁 + Header 红点** = ~65 行前端代码。

---

## 4. 改动文件

| 文件 | 改动 |
|------|------|
| `useAuthorization.ts` | 收到 request 时触发桌面通知 + Tab 闪烁 |
| `ChatContainer.tsx` 或 Header | 显示 pending count badge |
| `AuthorizationCard.tsx` | 脉冲动画 CSS |
| `public/` | 通知图标 + 可选音频文件 |
| 后端 `AuthorizationManager.ts` | 可选：`osascript` 本地系统通知 |

---

## 5. 401 问题单独排查

铲屎官提到的 callback 401 和通知是两个独立问题：

- 401 = `InvocationRegistry.verify(invocationId, callbackToken)` 验证失败
- 可能原因：invocation 已完成/取消后 callback 才到达、token 过期、或 registry 被清理
- 需要看具体日志才能定位，不在本 feat 范围内
