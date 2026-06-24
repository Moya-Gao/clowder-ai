---
id: LL-spike-server-env-contamination
date: 2026-06-22
authors: [opus-47 (宪宪)]
trigger: 砚砚云端 selftest write 工具 502 → F193 KD-1 业务拒绝 → 实际是 spike server 继承父 invocation env 触发 gate 误判
context: F247 Phase B1a 砚砚云端写工具 debug
related_features: [F247, F193]
severity: P0 (spike server "看起来是 X 模式但行为像 Y" 类 bug)
---

# LL: spike server 启动必须 explicit unset 父进程继承的 env (CAT_CAFE_*)

## 现象

F247 B1a spike server (remote-spike.ts) 应该是 **pure agent-key 模式**：
- spike server 自己有 `?token=` 防线
- caller 走 cat-cafe API agent-key auth (用 `CAT_CAFE_AGENT_KEY_FILE`)
- 不需要 invocation-token credentials

但实际跑起来时，砚砚云端调 `cat_cafe_post_message` 触发了**为 invocation-token caller 设计的 gate**：

```
post_message rejects threadId from invocation-token callers (F193 KD-1).
```

砚砚云端是 agent-key，不该 fire 这个 gate。

## 根因

spike server **从父 cat invocation spawn 出来**（铲屎官 -p 模式跑某只猫，那只猫的 invocation runtime 启动 spike server child process），**继承父 invocation 的所有 env**：

```
CAT_CAFE_INVOCATION_ID=b3a63a85-2c99-47fa-9b45-55faae255298
CAT_CAFE_CALLBACK_TOKEN=acf3d9db-90ca-4444-870d-2961f51656a4
CAT_CAFE_AGENT_KEY_FILES={"antigravity":"...","antig-opus":"..."}
CAT_CAFE_THREAD_ID=thread_mqgem09a7skjvwhx
CAT_CAFE_SUPERVISOR_PARENT_PID=96125
```

MCP server `callback-tools.ts:662` 的 gate 检查：

```ts
const hasInvocationCreds = !!process.env.CAT_CAFE_INVOCATION_ID && !!process.env.CAT_CAFE_CALLBACK_TOKEN;
if (input.threadId && hasInvocationCreds) {
  return errorResult('post_message rejects threadId from invocation-token callers (F193 KD-1). ...');
}
```

→ 因为父 env 污染，`hasInvocationCreds = true` → gate fire → 拒绝砚砚（实际是 agent-key caller）。

## 二级污染：CAT_CAFE_AGENT_KEY_FILES 屏蔽 single AGENT_KEY_FILE

unset 了 INVOCATION_ID/CALLBACK_TOKEN 后还是错（不同 error）：

```
Cat Café callback not configured. Missing callback credentials, agent-key credentials, or required agentKeyCatId for shared Antigravity MCP.
```

挖到 `callback-tools.ts:92-106 resolveAgentKeySecret`：

```ts
function resolveAgentKeySecret(options?: AgentKeyOptions): string | undefined {
  const requestedCatId = options?.agentKeyCatId?.trim();           // "gpt-pro"
  const variantMapRaw = process.env.CAT_CAFE_AGENT_KEY_FILES?.trim(); // antigravity map (无 gpt-pro)
  if (requestedCatId) {  // true
    const variantFiles = parseAgentKeyFileMap(variantMapRaw);
    return readAgentKeyFile(variantFiles[requestedCatId]);  // undefined
  }
  ...
  return readAgentKeyFile(process.env.CAT_CAFE_AGENT_KEY_FILE);  // 这里才 fallback，但 if 块已 return
}
```

→ 当 caller 传 `agentKeyCatId` 且 AGENT_KEY_FILES 存在但**不含** 该 catId，函数**直接返 undefined**，**不 fallback** 到 single `AGENT_KEY_FILE`。

砚砚云端必传 `agentKeyCatId="gpt-pro"` → variantMap 无 gpt-pro → 返 undefined → callback not configured。

## 修复 (spike server 启动)

启动 spike server 时**显式 unset 所有继承的 CAT_CAFE_* 污染 env** + **override** AGENT_KEY_FILES 包含 gpt-pro:

```bash
env \
  -u CAT_CAFE_INVOCATION_ID \
  -u CAT_CAFE_CALLBACK_TOKEN \
  -u CAT_CAFE_THREAD_ID \
  -u CAT_CAFE_SUPERVISOR_PARENT_PID \
  PORT=3098 \
  CAT_CAFE_REMOTE_TOKEN=<spike-token> \
  CAT_CAFE_DESKTOP_MODE=cloud-pro-phase0 \
  CAT_CAFE_READONLY=true \
  CAT_CAFE_CAT_ID=gpt-pro \
  CAT_CAFE_USER_ID=default-user \
  CAT_CAFE_AGENT_KEY_FILE=$HOME/.cat-cafe/agent-keys/gpt-pro.secret \
  CAT_CAFE_AGENT_KEY_FILES='{"gpt-pro":"/Users/lysander/.cat-cafe/agent-keys/gpt-pro.secret"}' \
  CAT_CAFE_API_URL=http://127.0.0.1:3002 \
  node packages/mcp-server/dist/remote-spike.js
```

**关键点**：
- `-u CAT_CAFE_INVOCATION_ID -u CAT_CAFE_CALLBACK_TOKEN` 让 `hasInvocationCreds=false`，gate 不 fire
- `-u CAT_CAFE_THREAD_ID -u CAT_CAFE_SUPERVISOR_PARENT_PID` 防止其他 module 误以为有"current thread"
- `CAT_CAFE_AGENT_KEY_FILES='{"gpt-pro":...}'` override 多 cat map（**必须**包含 gpt-pro，否则 resolveAgentKeySecret 返 undefined）
- `CAT_CAFE_AGENT_KEY_FILE` 留作 fallback（caller 不传 agentKeyCatId 时用）

## 教训

### 1. spike / sidecar server 启动 = "pretend pristine env"

任何 spawn 出来的"独立"服务（spike server、test harness、外部 webhook server 等），**默认会继承父进程 env**。如果父进程有 invocation-related env，子进程行为可能：
- 错误以为自己是 invocation-token caller
- 触发 invocation-only 的 gate
- 共享父进程的 catId / threadId

**纪律**：spike 启动脚本第一行用 `env -u ...` 清掉所有 CAT_CAFE_INVOCATION_ID / CAT_CAFE_CALLBACK_TOKEN / CAT_CAFE_THREAD_ID 等 invocation-bound env。然后**只**显式设这 spike 需要的 env。

### 2. resolveAgentKeySecret 行为 = "all-or-nothing" map 路径

`callback-tools.ts:92` 的 resolveAgentKeySecret 有个 "AGENT_KEY_FILES 存在则强制走 map 路径，不 fallback 到 AGENT_KEY_FILE" 的隐藏 contract。如果你设了 multi-cat AGENT_KEY_FILES 又同时设了 single AGENT_KEY_FILE 期望 fallback，**会失望**。

**两个 env 必须**: map 含**所有**可能的 catId，或者 unset map 让 single AGENT_KEY_FILE work。

### 3. Error message 不一定指向真因

| 错误 message | 真因 |
|---|---|
| `post_message rejects threadId from invocation-token callers` | 实际是 spike 继承 invocation env，砚砚不是 invocation caller |
| `Cat Café callback not configured. Missing ... agent-key credentials` | 实际有 AGENT_KEY_FILE，但 AGENT_KEY_FILES map 屏蔽了 fallback |
| `Unknown catId filter: gpt-pro` | 实际 cat-config.json 改了，但 runtime 不读它，要走 POST /api/cats |

**纪律**：错误信息引导调试方向时，**先 grep error string** 找代码源头，**读源码 logic 反推**真因，不依赖 error 字面意思推测。

## 沉淀

- ✅ `cat-cafe-skills/refs/chatgpt-cloud-onboarding-guide.md` §5 spike 启动加 `env -u` 清单
- ✅ `cat-cafe-skills/refs/chatgpt-cloud-onboarding-guide.md` §B Debug Clinic 加 3 个 error 真因映射
- ✅ 本 LL

## 推广

任何"sidecar / standalone 服务"启动脚本：
1. 列**继承可能污染**的环境变量
2. 启动命令首行 `env -u <pollutant1> -u <pollutant2> ...`
3. 显式 set **必需** env
4. 写 dry-run probe 命令在脚本里 verify 启动后行为正确

不要假设 "父进程 env 跟我无关"。

[宪宪/Opus-4.7🐾]
