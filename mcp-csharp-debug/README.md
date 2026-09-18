# 本地运行与调试 C# MCP 服务器（mcp-csharp-debug）

> 把 C# MCP server 在本机跑起来，接上 IDE 断点、MCP Inspector、GitHub Copilot Agent Mode 做交互验证，并定位「工具不出现」「stdio 输出乱码」这类问题。

## 什么时候用

第一次在本地把 MCP server 跑起来；配置 VS Code / Visual Studio 调试 MCP server（断点）；用 MCP Inspector 做协议层交互测试；确认工具出现在 GitHub Copilot Agent Mode 里；排查工具没被发现、协议报错、server 崩溃、`mcp.json` 配置问题。

**不适用**：还没有项目（用 `mcp-csharp-create`）、要写自动化测试（用 `mcp-csharp-test`）、生产部署问题（用 `mcp-csharp-publish`）。

## 前置条件

- **项目路径（必填）**：`.csproj` 或项目目录
- **传输类型**：`stdio` 或 `http`；未说明时查 `.csproj` 是否引用 `ModelContextProtocol.AspNetCore`——有则 HTTP，否则 stdio
- **IDE**：VS Code 或 Visual Studio

## 怎么用

### Step 1：本地运行

stdio 与 HTTP 用同一条命令：

```bash
cd <ProjectDir>
dotnet run
```

stdio 进程启动后在 stdin 等 JSON-RPC 消息，**stdout 上没有任何输出才说明它是正常的**；HTTP 监听 `http://localhost:3001`（或配置的端口）。

### Step 2：生成 MCP 配置

VS Code 写 `.vscode/mcp.json`；Visual Studio 写解决方案根目录的 `.mcp.json`（两者 JSON 结构相同）。stdio 条目用 `"type": "stdio"` + `command: "dotnet"` + `args: ["run", "--project", "<path/to/ProjectFile.csproj>"]`；HTTP 条目用 `"type": "http"` + `"url": "http://localhost:3001"`。完整模板见 `SKILL.md` Step 2。

### Step 3：用 MCP Inspector 测

stdio：

```bash
npx @modelcontextprotocol/inspector dotnet run --project <path/to/ProjectFile.csproj>
```

HTTP：先 `dotnet run` 起服务，再 `npx @modelcontextprotocol/inspector`，在 UI 里连到 `http://localhost:3001`。

### Step 4：GitHub Copilot Agent Mode

Copilot Chat 切到 **Agent** 模式 → 点 **Select Tools**（扳手图标）确认 server 与工具在列 → 用应当触发该工具的 prompt 测试 → 弹窗时批准工具执行。工具没出现时先 `dotnet build` 重建再重启 server（陈旧构建是第一大原因）。

### Step 5：断点调试

在 tool 方法里下断点 → VS Code 按 F5（需要 `launch.json`），Visual Studio 按 F5 或右键项目 Debug → Start → 通过 Inspector / Copilot / 测试客户端触发该工具 → 执行停在断点处。**必须用 Debug 配置构建，Release 下断点不命中。**

## 注意事项 / 已知坑

| 坑 | 处理 |
|---|---|
| 工具不出现 / 改完还是旧的 | 先 `dotnet build` 重建再重启 server；仍缺则核对 `[McpServerToolType]`、`[McpServerTool]` 与 `WithTools<T>()`/`WithToolsFromAssembly()` |
| stdio 输出乱码 | `Console.WriteLine()` 或日志写到了 stdout；所有输出必须走 stderr，设 `LogToStandardErrorThreshold = LogLevel.Trace` |
| HTTP 端点返回 404 | Program.cs 缺 `app.MapMcp()` |
| 断点不命中 | 在 Release 下构建了；`dotnet build -c Debug` 后重启 |
| 环境变量没传给 server | 在 `mcp.json` 里加 `"env"` 段；VS Code 里的密钥用 `"${input:var_id}"` 语法 |
| Inspector 连不上 HTTP server | server 没运行或端口不对；看 `dotnet run` 输出里的监听 URL |

工具单跑正常、走 MCP 就失败时：VS Code 里 View → Output → 选中你的 MCP server 名看协议错误与 stderr，接着挂调试器、用 Inspector 单独调、查 stdout 污染、查序列化 / DI 注册 / 参数绑定；需要事后分析就用 `builder.Logging.AddFile("mcp-debug.log")`。

## 参考文件

- `references/ide-config.md`（mcp.json 模板、launch.json、环境变量、条件断点）与 `references/mcp-inspector.md`（Inspector 安装、连接 server、功能走查与排障）
