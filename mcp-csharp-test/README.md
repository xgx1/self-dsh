# 测试 C# MCP 服务器（mcp-csharp-test）

> 给 MCP server 补两层测试——单个 tool 方法的单元测试，以及走完整 MCP 协议的集成测试（in-memory / HTTP），外加衡量 LLM 工具使用质量的 evaluations。

## 什么时候用

给 MCP server 加自动化测试、为 MCP server 接 CI 测试流水线；用 mock 依赖测单个 tool 方法；写验证「工具列表 + 工具调用」的协议层集成测试。**不适用**：测 MCP 客户端（本技能只覆盖 server 侧）、压测/性能测试、非 .NET 的 MCP server、排查 server 运行问题（用 `mcp-csharp-debug`）。

## 前置条件

- **MCP server 项目路径（必填）**：被测 server 的 `.csproj`
- **测试框架**：默认 xUnit，也支持 NUnit / MSTest
- **传输类型**：决定集成测试写法（stdio vs HTTP）

## 怎么用

### Step 1：建测试项目

```bash
dotnet new xunit -n <ServerName>.Tests
cd <ServerName>.Tests
dotnet add reference ../<ServerName>/<ServerName>.csproj
dotnet add package ModelContextProtocol
dotnet add package Moq
dotnet add package FluentAssertions
```

### Step 2：写 tool 方法的单元测试

直接调 tool 方法——最快、最隔离。用 `[Fact]` 测正常路径，用 `[Theory]` + `[InlineData]` 测边界（如空串、纯空格）。有 DI 依赖的用 `MockHttpMessageHandler` 造出 `HttpClient` 再传进方法。代码模板见 `SKILL.md` Step 2。

### Step 3：用 MCP client 写集成测试

用 `ModelContextProtocol.Client` 的 `StdioClientTransport` 把被测 server 拉起来，`McpClient.CreateAsync(transport)` 建客户端；然后 `ListToolsAsync()` 验证工具列表、`CallToolAsync()` 验证工具调用与返回内容。代码模板见 `SKILL.md` Step 3。SDK 自带的 `ClientServerTestBase`（in-memory 测试）与用 `WebApplicationFactory` 测 HTTP server 的写法，见 `references/test-patterns.md`。

### Step 4：跑测试

```bash
# 跑全部测试
dotnet test

# 只跑某个测试类
dotnet test --filter "FullyQualifiedName~MyToolTests"

# 带覆盖率
dotnet test --collect:"XPlat Code Coverage"
```

### Step 5：写 evaluations

Evaluations 衡量 LLM 使用你工具的水平。好的 eval 问题应当：**只读且无副作用**（绝不顺带改数据）、**确定性**（有唯一可验证的正确答案）、**多步**（要求 LLM 调多个工具或跨结果推理）。格式、示例问题与详细指引见 `references/evaluations.md`。

## 注意事项 / 已知坑

| 坑 | 处理 |
|---|---|
| 集成测试卡在 `CreateAsync` | server 起不来。先确认 `dotnet build` 成功；stdio 还要确保没有 stdout 日志 |
| `StdioClientTransport` 找不到项目 | 从测试项目目录出发，指向 `.csproj` 的相对路径要写对 |
| 本地通过、CI 失败 | CI 里先跑 `dotnet build` 再执行测试；`--no-build` 只能用在明确的构建步骤之后 |
| mock `HttpClient` 很别扭 | 该 mock 的是 `HttpMessageHandler`，不是 `HttpClient` 本身（见 `references/test-patterns.md`） |
| 全量测试太慢 | 开发期用 `--filter`，只在 CI 验证时跑全量 |

## 参考文件

- `references/test-patterns.md`（`ClientServerTestBase` in-memory 模式、HTTP 的 `WebApplicationFactory`、`MockHttpMessageHandler`、测试分类、覆盖率报告）与 `references/evaluations.md`（evaluation 格式、问题设计原则、示例问题）
