# Cloudflare Tunnel 延迟优化 — GPT Pro 咨询

> 委托人：布偶猫/宪宪 (Opus)  日期：2026-03-09
> Thread: Cloudflare Tunnel 远程访问方案

## Part 1: 发给云端模型的提示词
> 直接复制发送

---

你好，我是一个开发者，Mac 上跑着一个 Web 应用（Next.js 前端 port 3001 + API port 3002），需要从手机远程访问（不限同一网络）。我选择了 Cloudflare Tunnel 方案，但遇到延迟问题，需要你帮忙分析和建议。

### 网络环境

Mac 电脑在中国大陆（深圳），必须全天运行 Clash Verge（mihomo 内核）的 TUN 模式翻墙。TUN 模式在内核层接管所有流量，通过代理节点出海。目前主力节点是美国洛杉矶（LAX）。

手机需要从任意网络（4G/WiFi/外出）访问 Mac 上的应用。

### 已完成的配置

1. **域名**：`clowder-ai.com`（在 Cloudflare 注册），无 ICP 备案
2. **Cloudflare Tunnel**：已创建，`cafe.clowder-ai.com` → localhost:3001，`api.clowder-ai.com` → localhost:3002
3. **Cloudflare Access**：已配置 Email OTP 保护
4. **cloudflared** 已安装在 Mac 上运行

### 核心问题

cloudflared 建立 tunnel 时连接到 Cloudflare 的 edge 节点。由于 TUN 模式强制所有流量走美国代理，cloudflared 连接到的都是 LAX 节点（location=lax01, lax05, lax06 等）。

即使通过 Clash 的 `route-exclude-address` 让 cloudflared 绕过 TUN 直连，由于域名没有 ICP 备案，中国运营商到 Cloudflare Anycast 的 BGP 路由仍然是到 LAX。

### 已测试的延迟数据

| 方案 | Mac→Cloudflare edge | 手机→edge | 总 RTT | 结果 |
|------|---------------------|-----------|--------|------|
| cloudflared 走 TUN（美国代理）| ~250ms (Mac→LAX proxy→CF LAX) | ~250ms | ~500ms+ | 不可用 |
| cloudflared 绕 TUN 直连 | ~190ms (Mac→中国运营商→CF LAX via BGP) | ~180ms | ~370ms | 勉强 |
| 理想：cloudflared→HKG | ~30ms | ~30-60ms | ~100ms | 目标 |

### 已尝试但失败的方案

1. **Clash `route-exclude-address`**：成功让 cloudflared 绕过 TUN，但中国到 CF 的 BGP 就是到 LAX（无 ICP 备案）
2. **Clash Rules 指向香港代理节点**：
   - 引用节点名（`🇭🇰TJ|香港C01|直连节点`）→ 导致 Clash 配置解析崩溃，所有节点消失
   - 引用代理组名（`🌩️ Cloudflare`）→ 该组只有 DIRECT 和 `🔰 选择节点`
   - 香港节点本身连不上（可能被封或节点故障）
3. **Tailscale**：NAT 穿透失败（Symmetric NAT），走 DERP relay（旧金山），延迟 ~400ms

### 约束条件

- Mac **必须保持 Clash TUN 模式**（翻墙需求，不能关）
- 域名**没有 ICP 备案**（备案需要国内服务器+国内接入商，与 Cloudflare 架构冲突）
- 应用跑在 Mac 本地，**不考虑云端部署**
- 手机可以挂 VPN（任意地区）
- Clash 订阅有香港/新加坡/日本/美国等节点（但香港节点今晚连不上）

### 请帮忙分析

1. **有没有办法让 cloudflared 连接到亚洲 Cloudflare 节点？** 比如：
   - cloudflared 有没有 `--edge-ip` 或 `--region` 参数可以强制连接特定区域？
   - 能否通过 `protocol` 选择（QUIC vs HTTP2）影响路由？
   - 有没有其他 Cloudflare 配置可以控制 edge 选择？

2. **Clash 规则层面**：如何在 Clash Verge (mihomo) 的 Rules Override 里正确引用订阅里的代理节点？之前引用节点名导致配置崩溃，正确的语法是什么？Merge 配置里新建 proxy-group 用 `include-all: true` + `filter` 似乎没生效。

3. **替代架构**：
   - 如果 Cloudflare Tunnel 的延迟无法降到 <200ms，有没有其他隧道方案？（frp? ngrok? bore?）
   - 能否在香港 VPS 上跑一个反向代理，Mac tunnel 到 VPS，手机访问 VPS？成本和复杂度如何？
   - WireGuard 自建 vs Tailscale 的延迟差异？

4. **ICP 备案的实际影响**：Cloudflare 对无备案域名的流量路由策略到底是什么？是完全不用亚洲节点，还是只不用中国大陆节点？如果 cloudflared 从香港代理出去（出口 IP 在香港），Cloudflare 会路由到 HKG 吗？

5. **你认为最佳方案是什么？** 考虑：成本<$5/月、延迟<200ms、安全（鉴权）、稳定、易维护。

---

## Part 2: 云端模型回答（待回填）
> 铲屎官粘贴回答到这里

结论先摆桌上：这锅基本不在某个“漏掉的 cloudflared 神秘参数”，而在**出口网络 + Anycast/BGP**。普通 Cloudflare Tunnel 没有给你“锁 HKG/APAC”的按钮。官方文档里 `--region` 现在只有 `us` 这一个强制美国的选项，`--protocol` 只有 `auto` / `http2` / `quic`，`edge-bind-address` 也只是选本机源 IP/接口。`cloudflared` 本质上是主动连到 Cloudflare 全球网络的 7844 端口，由 Anycast/BGP 决定被哪个 PoP 收进去，而 Cloudflare 也明确写了，请求不一定会去地理上最近的数据中心，可靠性优先。([Cloudflare Docs][1])

所以你的判断大方向是对的，但我会修正一句话：**没有 ICP，不等于“Cloudflare 完全不用亚洲节点”**。它真正卡住的是 Cloudflare China Network 这条位于中国大陆、由 JD Cloud 运营的独立产品线；Cloudflare 还把 Global Acceleration 写成 China Network 的附加服务。你现在走的是普通全球网络，PoP 仍然主要看 cloudflared 从哪里出海以及 BGP 怎么收流。换句话说，如果 cloudflared 能稳定地从香港/新加坡/日本的健康出口出去，通常更容易落到附近 APAC PoP，但 Anycast 不是城市锁定器，所以不能保证一定是 HKG。([Cloudflare Docs][2])

对你几个问题，直接短答。

1. `cloudflared` 有没有 `--edge-ip` 或 `--region` 强制亚洲
   我没有在官方 run parameters 里看到能按城市或亚洲区域指定 edge 的 `--edge-ip` 选项。文档里公开的是 `edge-bind-address`、`protocol`、`region` 等参数，而 `region` 当前只有 `us`。Cloudflare 用于连通性测试公开的也是 `region1.v2.argotunnel.com` / `region2.v2.argotunnel.com` 这一级，不是 HKG/NRT/SIN 这种城市级入口。([Cloudflare Docs][1])

2. QUIC vs HTTP/2 能不能改变路由
   不能指望它把 LAX 变 HKG。它影响的是 cloudflared 和 Cloudflare 之间的传输方式，不是 PoP 地理选边。`auto` 会优先 QUIC，UDP 不通再回落到 HTTP/2。实战里它更可能影响的是抖动、丢包、建连稳定性，而不是城市归属。([Cloudflare Docs][1])

3. 还有没有别的 Cloudflare 配置能控制 edge 选择
   普通 Tunnel 自助配置基本没有。你能调的是出口网络、本机源地址/接口，以及是否走 China Network / Global Acceleration 这种完全不同层级的产品路线。后者不是普通 Tunnel 的“高级开关”。([Cloudflare Docs][1])

mihomo / Clash 这一段，我建议你别再在 Rules Override 里直接点名订阅节点了。官方支持 `PROCESS-NAME`、`PROCESS-NAME-WILDCARD` 这类进程规则；Clash Verge Rev 的合并配置示例也明确有 `enable-process: true` 和 `find-process-mode: strict`。同时，mihomo 的 `include-all: true` 只会把所有出站节点和 proxy sets 拉进组里，不会把其他 proxy group 自动拉进来，`filter` 也只对这些被 include 的节点生效。最稳的姿势是先建一个你自己的、名字干净的代理组，然后让 `cloudflared` 命中这个组。官方也提醒，组名如果有特殊字符要加引号。([Clash Verge][3])

```yaml
enable-process: true
find-process-mode: strict

proxy-groups:
  - name: "CloudflareConnector"
    type: url-test
    include-all: true
    exclude-type: direct
    url: "https://www.gstatic.com/generate_204"
    interval: 300
    filter: "(?i)港|hk|hongkong|hong kong|新|sg|singapore|日|jp|japan"

rules:
  - PROCESS-NAME,cloudflared,CloudflareConnector
  # 把这一条放在你的通用 MATCH 规则前面
```

这里我故意不用你订阅里那些 emoji 组名。原因很朴素，YAML 和 merge parser 有时像玻璃心饼干，一捏就碎。先用 ASCII 组名把变量压扁。只筛 HK 的话，一旦香港节点今晚全挂，组可能直接空掉；先放 HK/SG/JP 三地，让 `url-test` 在活着的亚洲节点里自己选，会稳很多。([虚空终端][4])

`route-exclude-address` 这把小刀，适合切“固定 VPS 公网 IP /32”这种硬目标，不适合切 Cloudflare Anycast 这种流动的云雾。官方对它的定义就是“排除自定义网段/CIDR”；而 `include-uid` / `exclude-uid` 又明确是 Linux-only，Android 才有 package 规则。所以在 macOS 上，不要把希望押在 UID/package 级别的 TUN 逃逸，**进程分流和固定 IP 排除**才是正路。([虚空终端][5])

如果你还想给 Cloudflare Tunnel 一次 A/B 试车的机会，我只会做三件事：第一，把 `cloudflared` 进程单独丢到 HK/SG/JP 组；第二，在同一个出口上分别测 `quic` 和 `http2`；第三，顺手测一轮 IPv6，因为 Cloudflare 文档写了 `cloudflared` 默认连 IPv4，而你给 `edge-bind-address` 一个 IPv6 源地址时会强制去 IPv6 目的地。要是这样还下不来 200ms，我会果断止损，不再往 Tunnel 里继续烧脑细胞。([Cloudflare Docs][1])

替代架构我按“你这个约束下的性价比”来排。

**第一名：新加坡或东京 VPS + 自建 WireGuard hub。**
这是我认为最像工程答案的一条。WireGuard 本身就是简单、快、现代的 UDP VPN；而 Tailscale 是在 WireGuard 之上再加 NAT 穿透、TCP transport、ACL 等管理能力。对你这种“Mac 必须长期跑 Clash TUN，手机又允许挂 VPN”的场景，裸 WireGuard 的优点是路径完全可预期，外层 endpoint 还是固定 VPS IP，正好能用 `route-exclude-address` 去绕开 Clash 对外层包的劫持。主流入门价里，我查到 DigitalOcean Droplet $4/月起，Amazon Lightsail Linux 方案有 $3.50 和 $5，Lightsail 官方文档也列出了新加坡和东京区域。这个组合最有机会把路径收敛到一个稳定的亚洲中继点，而不是把命运交给 Anycast。([WireGuard][6])

**第二名：Tailscale + 你自己的 SG/TYO Peer Relay。**
这条路比你之前遇到的“DERP 旧金山”更有戏，因为 2026 年的 Tailscale 已经把 Peer Relay 做成正式功能了。官方文档写得很清楚：连接会先尝试 direct，失败后先试 peer relay，再不行才留在 DERP；Peer Relay 可以部署在你自己的 tailnet 设备上，还可以放在特定地理区域来降延迟。文档对账号前置条件只写了 tailnet 访问和管理权限，没有写付费门槛，而 Personal 计划仍然是免费且包含几乎所有功能。它的优点是省事、鉴权优雅、观测性好；缺点是你这台 Mac 已经长期挂 Clash TUN，再叠一个更“聪明”的 overlay，系统层的互动会比裸 WireGuard 多一些变量。([Tailscale][7])

**第三名：SG/TYO VPS + frp。**
如果你不想让手机开 VPN，只想让浏览器直接访问域名，这是我比 Cloudflare Tunnel 更看好的公网方案。frp 官方文档把它定义为高性能反向代理，支持 TCP/UDP/HTTP/HTTPS，frpc 和 frps 之间有 token 或 OIDC 认证，还支持健康检查。要注意的是 frp 的 token/OIDC 解决的是“客户端和服务端之间谁能连”，不是“最终访客怎么登录”，所以前门仍然要靠你的应用鉴权，或者再套一层反向代理做 HTTPS 和额外认证。([Gofrp][8])

**第四名：ngrok。**
它的开发体验确实顺滑，还能用 Traffic Policy 加 Basic Auth，但价格对你这个预算不友好。官方定价页现在显示 free plan 只有 1GB 带宽、最多 3 个在线端点、2 万次 HTTP/S 请求，而 Hobbyist 是 $8 按年计费或 $10 月付，已经超出你设的 `<$5/月` 线。([ngrok.com][9])

**我不推荐：bore 作为长期主方案。**
它的定位非常诚实，就是一个“简单的 TCP tunnel”，README 甚至直说“没有多余花活”；认证 secret 只用于握手，后续流量默认并不加密。拿来临时打洞很轻巧，拿来做你这个长期远程访问主入口，我会心里发毛。([GitHub][10])

所以我的最终建议是：

**最佳方案：WireGuard hub on SG/TYO VPS。**
你已经允许手机挂 VPN，这等于给了你一条最干净的逃生通道。把“公网入口/中继点”从 Cloudflare Anycast 改成“你自己的固定亚洲 VPS”，延迟模型会从一锅随机汤变成一条可控水管。实现上也不复杂：Mac 和手机都连同一个 SG/TYO VPS，上面只跑 WireGuard；在 mihomo 里把 VPS 公网 IP 做 `route-exclude-address`，必要时再用 `PROCESS-NAME` 规则给 WireGuard 或相关进程单独选 SG/TYO 节点。这样外层包的目的地是固定的，分流终于有抓手了。这个方案最符合你要的四件事：成本压在 $5 左右、延迟最有希望进 200ms、安全面是私网而不是裸公网、维护复杂度也比“Cloudflare + 中国出海 + Anycast 猜城市”低。([虚空终端][5])

**次优方案：Tailscale + 自建 Peer Relay。**
如果你更在意“省配置”和设备管理体验，而不是榨干最后几毫秒 RTT，就把同一台 SG/TYO VPS 变成你的 Peer Relay。只要 `tailscale status` / `tailscale ping` 看到 `peer-relay` 而不是 `relay`，你就已经把“旧金山 DERP 绕地球一圈”这只幽灵赶走一大半了。([Tailscale][7])

**只在这两种都不走时，才继续试 Cloudflare Tunnel。**
因为它的最核心问题不是你没调对，而是它根本没给你足够的地理控制权。([Cloudflare Docs][1])

一句拍板版：**别再把主要希望押在 Cloudflare Tunnel 上。先试一轮“cloudflared 进程走 SG/JP 代理组”的低成本 A/B；过不了线，就直接上 SG/TYO VPS + WireGuard hub。** 这条路更像手里握住地图，而不是站在 Anycast 的骰子塔下面接命运纸条。

[1]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/cloudflared-parameters/run-parameters/ "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/cloudflared-parameters/run-parameters/"
[2]: https://developers.cloudflare.com/china-network/ "https://developers.cloudflare.com/china-network/"
[3]: https://www.clashverge.dev/guide/config.html "https://www.clashverge.dev/guide/config.html"
[4]: https://wiki.metacubex.one/en/config/proxy-groups/ "https://wiki.metacubex.one/en/config/proxy-groups/"
[5]: https://wiki.metacubex.one/en/config/inbound/tun/ "https://wiki.metacubex.one/en/config/inbound/tun/"
[6]: https://www.wireguard.com/ "https://www.wireguard.com/"
[7]: https://tailscale.com/docs/features/peer-relay "https://tailscale.com/docs/features/peer-relay"
[8]: https://gofrp.org/en/docs/overview/ "https://gofrp.org/en/docs/overview/"
[9]: https://ngrok.com/pricing "https://ngrok.com/pricing"
[10]: https://github.com/ekzhang/bore "https://github.com/ekzhang/bore"

## Part 3: 综合后的最终版本（待撰写）
> 本地猫综合后撰写

[待撰写]
