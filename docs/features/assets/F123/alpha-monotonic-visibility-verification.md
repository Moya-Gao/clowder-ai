---
feature_ids: [F123]
topics: [bubble, alpha, visibility, verification]
doc_kind: note
created: 2026-03-16
---

# F123 Alpha Monotonic Visibility Verification

## Environment

- Alpha channel: `3011 / 3012 / 4111 / 6398`
- Date: `2026-03-16`
- Scope: 验证 F123 最后一条 symptom gap：
  `F5 / thread switch 后单调可见性全链路`

## Scenarios

| Scenario | Thread(s) | Observation | Result |
|----------|-----------|-------------|--------|
| cold boot / F5 | `thread_mmt42snn6ghcrix7` (`replay`) | 刷新前后 `main` 顶部可见内容一致；未观察到瞬时双影或“先裂后合” | pass |
| thread switch | `thread_mmt42snn6ghcrix7` (`replay`) → `thread_mmatfuavr31uyub9` (`设计猫猫gpt52`) → `replay` | 切回后 bubble 列表与切前一致；未观察到 route 切换导致的双影或回切后归一 | pass |
| F5 after thread switch | `thread_mmt42snn6ghcrix7` (`replay`) | thread switch 后再次刷新，刷新前后 `main` 顶部可见内容一致 | pass |

## Interpretation

- 这轮 Alpha 证据补的是**高层 UI 可见性链路**，不是取代低层 hook replay。
- 当前 Alpha 数据里没有现成的 live `activeInvocations` thread，因此这轮浏览器验证用的是真实历史 thread 的 cold boot / route switch / reload。
- streaming / hydration / queue ordering / draft recovery 的竞态和替换语义，仍由已合入主线的 hook 级 replay 负责兜底：
  - `#493` monotonic recovery contract
  - `#495` queue / hydration ordering
  - `#496` draft recovery fixture alignment

## AC-C4 Routing

### F123-owned remaining symptoms

- 无。此次 Alpha 未再复现 bubble 双影、F5 后归一、thread switch 后不单调的问题。

### Runtime / dev noise

- `GET /api/threads/:id/game` 返回 `404`
- socket forced-close / reconnect warning
- Next dev HMR websocket handshake warning

这些噪音在本轮验证里没有表现成 bubble 可见性错误，不构成 F123 close blocker。

### Follow-up (non-blocking)

- 如果后续要把“直播中 thread switch”的 UI 可见性也自动化，需要额外的 route/container 级 integration harness，或者可控的 live-stream seed。
- 这属于质量增强 follow-up，不阻塞 F123 close。

## Conclusion

- 该验证补齐了 F123 symptom-fixture matrix 的最后一个 gap。
- 结合既有 hook replay 覆盖，支持：
  - `AC-C1` 完成
  - `AC-C2` 完成
  - `AC-C4` 完成
