# 发布与部署 C# MCP 服务器（mcp-csharp-publish）

> 把 MCP server 发出去：stdio 打成 NuGet tool 包，HTTP 容器化后部署到 Azure，两条路径都可选地登记到官方 MCP Registry。

## 什么时候用

打包 stdio server 到 NuGet；给 HTTP server 写 Dockerfile / 建容器；部署到 Azure Container Apps 或 App Service；发布到官方 MCP Registry（registry.modelcontextprotocol.io）；配 `server.json` 与 CI/CD。选择口径：**stdio → NuGet.org，用户用 `dnx YourPackage@version` 运行**；**HTTP → Docker → Azure，用户拿容器 URL**。**不适用**：普通（非 MCP）NuGet 库（用 `nuget-trusted-publishing`）、与 MCP 无关的通用 Docker 问题、创建新 server（`mcp-csharp-create`）、调试（`mcp-csharp-debug`）、写测试（`mcp-csharp-test`）。

## 前置条件

- **传输类型（必填）**：`stdio` → 走 NuGet；`http` → 走 Docker/Azure。**项目路径（必填）**：`.csproj`
- **目标去处（必填）**：NuGet.org / Docker 镜像仓库 / Azure Container Apps / Azure App Service / MCP Registry；**包 ID 或 server 名**发布时必填

## 怎么用

### Step 2a：NuGet 发布（stdio）

`.csproj` 配好 `<PackAsTool>true</PackAsTool>`、`<ToolCommandName>`、`<PackageId>`、`<Version>`、`<Description>`、`<PackageLicenseExpression>`、`<PackageTags>`、`<PackageReadmeFile>`，并用 `<None Include="README.md" Pack="true" PackagePath="\" />` 把 README 打进包；发布前先本地试装验证（`dotnet tool install --global --add-source bin/Release/ <PackageId>` → `<ToolCommandName> --help` → `dotnet tool uninstall --global <PackageId>`）。

```bash
dotnet build -c Release
dotnet pack -c Release
dotnet nuget push bin/Release/*.nupkg --api-key YOUR_NUGET_API_KEY --source https://api.nuget.org/v3/index.json
```

用户在 `mcp.json` 里配 `"command": "dnx"` + `"args": ["YourUsername.MyMcpServer@1.0.0", "--yes"]` 运行。

### Step 2b：Docker 容器化（HTTP）

多阶段 Dockerfile：SDK 阶段 `dotnet restore` / `publish`，`aspnet:10.0` 运行时阶段 `COPY --from=build /app .`，建非 root 用户，设 `ASPNETCORE_URLS=http://+:8080`、`EXPOSE 8080`、`/health` 的 `HEALTHCHECK`，`ENTRYPOINT ["dotnet", "MyMcpServer.dll"]`（完整 Dockerfile 见 `SKILL.md` Step 2b）。推镜像：Docker Hub 用 `docker tag` + `docker push`；ACR 先 `az acr login --name yourregistry`，再推 `<yourregistry>.azurecr.io/<mymcpserver>:1.0.0`。

```bash
docker build -t mymcpserver:latest .
docker run -d -p 3001:8080 -e API_KEY=test-key --name mymcpserver mymcpserver:latest
curl http://localhost:3001/health
```

### Step 3：部署到 Azure（HTTP）

```bash
az containerapp create --name mymcpserver --resource-group mygroup --environment myenvironment --image <yourregistry>.azurecr.io/<mymcpserver>:1.0.0 --target-port 8080 --ingress external
```

上面是**最小形式**（`--min-replicas` / `--max-replicas` / `--secrets` / `--env-vars` 等参数未展开），与 App Service 变体（`az webapp create` + `--deployment-container-image-name`）见 `SKILL.md` Step 3 与 `references/docker-azure.md`。

### Step 4：发布到 MCP Registry（可选）

```bash
brew install mcp-publisher      # 或从 registry releases 页下载
mcp-publisher login github      # name must be io.github.<username>/... for GitHub auth
mcp-publisher publish
```

`server.json` 写在 `.mcp/server.json`（或 `mcp-publisher init` 生成），schema 见 `references/mcp-registry.md`；验证：`curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.<username>/<servername>"`。

## 注意事项 / 已知坑

| 坑 | 处理 |
|---|---|
| NuGet 包不能作为 tool 运行 | `.csproj` 缺 `<PackAsTool>true</PackAsTool>` |
| `.csproj` 与 `server.json` 版本不一致 | 根 `version`、`packages[].version`、`<Version>` 三者必须同步，否则校验失败或下到错版本 |
| 容器启动即退出 | entrypoint 的 DLL 名要与项目输出一致；`docker logs mymcpserver` 看错误 |
| Azure Container App 返回 502 | `--target-port` 要与容器里的 `ASPNETCORE_URLS` 端口一致 |
| MCP Registry 拒绝发布 | 名称须符合命名空间约定：GitHub 认证用 `io.github.<username>/<name>` |
| API key 泄漏进镜像 | 多阶段构建；绝不 `COPY` `.env`；密钥运行期用 `--env-vars` 传入。生产还要 HTTPS、健康检查、参数校验、限流 |

## 参考文件

- `references/nuget-packaging.md` —— NuGet `.csproj` 完整配置、MCP 的 `server.json`、NuGet.org 推送、`dnx` 测试、版本管理
- `references/docker-azure.md` + `references/mcp-registry.md` —— 生产 Dockerfile、ACR、Azure Container Apps / App Service + Key Vault；`mcp-publisher` 安装、registry schema、命名空间约定、CI/CD 自动化
