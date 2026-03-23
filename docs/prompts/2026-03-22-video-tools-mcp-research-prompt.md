# AI 视频生成/编辑工具 + MCP 集成调研

> 委托人：cat-cafe 团队  日期：2026-03-22

## 背景

我们正在评估 AI 视频生成和编辑工具，用于构建 AI agent 工作流。需要找到：
1. **程序化/API 优先**的工具（能编程控制的）
2. **MCP Server 集成**可能性（已有或可构建的）
3. **AI Agent 友好**的接口（支持自动化的）

目标是用这些工具增强 AI agent 的视频创作能力。

## 需要调研的问题

### Part 1：程序化/API 优先视频工具

1. **Remotion (React-based video)**：
   - 有 MCP server 吗？GitHub 星星数？
   - API 能力：能通过代码/CLI 生成视频吗？
   - 与 AI agent 的集成点？
   - 许可证和商业可用性？

2. **MoviePy (Python video editing)**：
   - MCP 集成？
   - API 覆盖范围（视频剪辑、合成、特效）
   - 自动化友好度
   - 最新活跃状态

3. **FFmpeg 自动化**：
   - 有 MCP server 吗？
   - Node.js/Python wrapper 生态
   - AI agent 集成最佳实践

4. **Shotstack / Creatomate / 类似 API 服务**：
   - API 完整度
   - 定价模式
   - 与 AI 工作流集成
   - 限制和配额

### Part 2：AI 视频生成平台

1. **Runway ML**：
   - MCP server 存在？
   - API 能力（Gen-1/Gen-2/Gen-3）
   - 视频编辑 API
   - 2026 年最新状态

2. **Pika Labs**：
   - API 可用性？
   - MCP 集成？
   - 与 Runway 对比

3. **Kling AI（快手可灵）**：
   - API 可用性
   - 国际可用性
   - AI agent 集成

4. **Sora (OpenAI)**：
   - API 状态（2026年）
   - 视频生成能力
   - API 限制和定价

5. **Vidu**：
   - API 能力
   - 与其他平台对比

6. **HailuoAI（海螺AI）**：
   - API 可用性
   - 国际可用性

### Part 3：MCP Server 搜索

重点搜索以下关键词：
1. "video mcp server" GitHub
2. "mcp video editing"
3. "mcp ffmpeg"
4. "mcp remotion"
5. MCP 官方 registry/catalog

对每个找到的 MCP server，记录：
- GitHub repo 链接
- Stars 和最后更新时间
- 功能和限制
- 是否仍在维护

### Part 4：代码仓库搜索（GitHub/npm）

1. npm 上 "mcp" + "video" 相关的包
2. GitHub 上 video generation/edit MCP 相关 repo
3. 任何与 AI agent + video 集成的开源项目

## 输出要求

- 每个结论标注信息来源（URL 或文档名）
- 区分"已确认"和"推测"
- 给出推荐方向 + 风险
- 对于每个工具，评估"AI Agent 友好度"（1-5星）
- 给出 cat-cafe 集成的可行性评估

## 参考资料

- https://github.com/modelcontextprotocol
- https://www.npmjs.com/search?q=mcp
- https://remotion.dev
- https://moviepy.readthedocs.io
- 相关 GitHub repos
