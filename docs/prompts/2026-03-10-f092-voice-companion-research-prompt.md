# F092 Cats & U 语音陪伴体验 — 技术调研

> 委托人：布偶猫/宪宪 (Opus 4.6)  日期：2026-03-10
> 派发给：GPT Pro

## 背景

我们是 Cat Cafe，一个多 AI 猫猫协作平台（开源项目）。三只猫（布偶猫/Claude、缅因猫/GPT、暹罗猫/Gemini）和铲屎官（人类开发者）通过 Web 界面协作开发。

最近铲屎官发现一个重要的使用场景：**戴着 AirPods 边运动边和猫猫语音交流**。我们已有 TTS 语音合成能力（Qwen3-TTS 1.7B Base clone，运行在 Apple Silicon 上），猫猫可以通过 "audio rich block" 发送语音消息。但当前体验有严重断点：

1. 语音消息需要手动点击播放，AirPods 场景下双手被占用
2. 无法通过语音或 AirPods 按键切换对话 thread
3. 语音输入（STT）错误率高，尤其是中英混合场景
4. 铲屎官提到了 "typeless" 作为 STT 优化参考方向

我们的前端是 Next.js Web App，部署在本地 Mac（Apple Silicon），通过 Cloudflare Tunnel 暴露。铲屎官用的是 iPhone + AirPods Pro。

## 需要调研的问题

### 问题 1：浏览器音频自动播放政策 + PWA 方案

1. Chrome 和 Safari（iOS/macOS）的 autoplay 政策现状（2025-2026）？
2. 有哪些合法的方式绕过 autoplay 限制？（用户手势激活、Media Session API、PWA 等）
3. 如果做成 PWA（Progressive Web App），是否能获得更好的音频控制权限？
4. 是否有必要做原生 app wrapper（React Native / Capacitor）来获得完整硬件控制？
5. Web Audio API + AudioContext 的 resume() 策略有哪些最佳实践？
6. 多条语音消息的播放队列管理：串行播放、打断策略、优先级

### 问题 2：AirPods 与 Web 应用的交互能力

1. AirPods Pro 的物理操控（单击/双击/长按/捏）在浏览器/PWA 中能被 JS 捕获吗？
2. Media Session API 能否映射 AirPods 的 play/pause/next/previous 事件到自定义行为？
3. iOS Shortcuts（快捷指令）能否触发 Web App 的特定操作（如切换 thread）？
4. 有没有开源项目做过类似的 "AirPods + Web App" 交互？
5. 如果浏览器无法捕获 AirPods 事件，有哪些替代方案？

### 问题 3：typeless 和 STT 优化方案

1. typeless 是什么？技术原理、定价、API 集成方式？
2. 有没有类似的 "STT + LLM 后处理" 方案？（先语音转文字，再用 LLM 修正错别字和格式）
3. 本地 STT 模型对比：Whisper（各版本）vs Qwen2-Audio vs SenseVoice vs 其他，在 Apple Silicon 上的性能/质量/资源占用
4. 中英混合输入的准确率，各模型表现如何？
5. 浏览器原生 Web Speech API 的当前状态和局限性
6. 实时 STT（streaming）vs 录完再转（batch）的延迟和准确率 tradeoff

### 问题 4：语音对话模式的 UX 参考

1. 有哪些产品做了优秀的 "hands-free AI 语音对话" 体验？（不限于 AI 助手，也包括语音社交、播客互动等）
2. "对讲机模式"（push-to-talk）vs "始终聆听"（always-on）vs "语音活动检测"（VAD）各自的优缺点？
3. 语音对话中的延迟容忍度研究？用户能接受的 TTS 合成 + 播放延迟是多少？
4. 多人/多猫语音对话的 UX 设计模式？（多个 AI 角色轮流说话）

## 输出要求

- 每个结论标注信息来源（URL 或文档名）
- 区分"已确认"和"推测"
- 给出推荐方向 + 风险
- 如果某个方向明显不可行，直接说并解释原因
- 最后给一个总体推荐路线图（先做什么后做什么）

## 参考资料

- 我们的 TTS：Qwen3-TTS 1.7B Base clone，运行在 M-series Mac
- 前端：Next.js 14 + React 18
- 部署：本地 Mac + Cloudflare Tunnel
- 铲屎官设备：iPhone + AirPods Pro + Mac
