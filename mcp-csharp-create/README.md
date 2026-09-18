# 创建 C# MCP 服务器（mcp-csharp-create）

> 用官方 C# SDK（`ModelContextProtocol`）和 `dotnet new mcpserver` 模板从零搭一个 MCP server，把 tools / prompts / resources 接上 stdio 或 HTTP 传输。

## 什么时候用

从零新建 MCP server 项目；给已有 server 加 tools / prompts / resources；在 stdio（`--transport local`）与 HTTP（`--transport remote`）之间选择；给 HTTP server 配 ASP.NET Core 托管；把外部 API 包成 MCP tools。

**不适用**：调试已有 server（用 `mcp-csharp-debug`）、写测试（`mcp-csharp-test`）、发布部署（用 `mcp-csharp-publish`）、开发 MCP 客户端、非 .NET 的 MCP server。

## 前置条件

- **传输类型（必填）**：`stdio`（本地/CLI）或 `http`（远程/Web）；没说就默认 **stdio**
- **项目名（必填）**：PascalCase，如 `WeatherMcpServer`
- **.NET SDK**：需要 .NET 10.0+，先确认 `dotnet --version`
- **要包装的服务 / API**：建议提供

## 怎么用

**选传输**：本地 CLI 工具 / IDE 插件、单用户、作为子进程运行（VS Code、GitHub Copilot）、配置简单 → **stdio**；云 / Web 服务、多客户端并发、需要跨网络、容器化部署（Docker/Azure）→ **HTTP**。默认 stdio：更简单，之后可以再补 HTTP。

**建项目** —— 先 `dotnet new list mcpserver` 确认模板已装（报「No templates found」就执行 `dotnet new install Microsoft.McpServer.ProjectTemplates`），再建 stdio 项目：

```bash
dotnet new mcpserver -n <ProjectName>
```

模板超时或不可用时，改用 `dotnet new console -n <ProjectName>` 再加 `dotnet add package ModelContextProtocol`。HTTP 项目（推荐做法，比模板给出更多项目结构控制权）：

```bash
dotnet new web -n <ProjectName>
cd <ProjectName>
dotnet add package ModelContextProtocol.AspNetCore
```

模板参数参考：`--transport local`（stdio，默认）、`--transport remote`（ASP.NET Core HTTP）、`--aot`、`--self-contained`；部署到容器时另设 `ASPNETCORE_URLS=http://+:8080` 并 `EXPOSE 8080`。

**实现与接线**：

- **Tools**：类加 `[McpServerToolType]`，方法加 `[McpServerTool]`；**每个方法和每个参数都必须有 `[Description]`**（LLM 靠它决定何时调用）；async 工具都接收 `CancellationToken`。DI 两种注入：静态类走方法参数注入（不进 tool schema），非静态类走构造函数注入（`WithToolsFromAssembly()` 会发现）。
- **Prompts / Resources（可选）**：`[McpServerPromptType]` + `[McpServerPrompt]`；`[McpServerResourceType]` + `[McpServerResource(UriTemplate = ...)]`。
- **Program.cs**：stdio 用 `Host.CreateApplicationBuilder` + `WithStdioServerTransport()`；HTTP 用 `WebApplication.CreateBuilder` + `WithHttpTransport()` + `app.MapMcp()`（默认路径 `/mcp`）。完整代码模板见 `SKILL.md` Step 4–6。

**验证启动**：

```bash
cd <ProjectName>
dotnet build
dotnet run
```

stdio：进程启动后在 stdin 等 JSON-RPC 输入；HTTP：监听配置的端口。

## 注意事项 / 已知坑

| 坑 | 处理 |
|---|---|
| stdio server 输出乱码或挂住 | 日志写到 stdout 会破坏 JSON-RPC；设 `LogToStandardErrorThreshold = LogLevel.Trace` |
| LLM 客户端发现不了 tool | 类上缺 `[McpServerToolType]` 或方法缺 `[McpServerTool]`；确认 Program.cs 有 `.WithToolsFromAssembly()` |
| LLM 不知道何时用这个 tool | 方法和所有参数补上清晰的 `[Description]` |
| AOT 下 `WithToolsFromAssembly()` 失败 | 反射式发现与 Native AOT 不兼容，改用 `.WithTools<MyTools>()` |
| 参数没出现在 tool schema | `CancellationToken`、`IMcpServer`、DI 服务是自动注入的、不进 schema；只有带 `[Description]` 的参数才暴露 |
| HTTP 返回 404 | 必须调用 `app.MapMcp()`，并检查请求路径与配置路由一致 |

## 参考文件

- `references/api-patterns.md`（完整属性参考、返回类型、DI 注入、builder API、动态 tools、实验性 API）与 `references/transport-config.md`（stateless HTTP、OAuth/认证、自定义路径前缀、`HttpContextAccessor`、OpenTelemetry）
