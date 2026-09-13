# MCP 安装与配置（DSH / Claude Code / 登录态复用）

## A. DSH web 注册

文件：`~/.dsh/profiles/web/cordis.patch.yml`（与 `mcp-cbm` / `mcp-ue` 并列；改完重启 dsh web 生效）。
浏览器 MCP 片段如下（2026-09-06 已按此添加并切换为全局命令；若被移除可照抄恢复）：

```yaml
# ── 用户调整（2026-09-06）：新增 Playwright 浏览器 MCP ──────────────
# 全局安装 npm i -g @playwright/mcp（v0.0.80），软链 ~/.npm-global/bin/playwright-mcp → ~/.local/bin。
# 本机无 DISPLAY 必须 --headless；无 chrome 渠道，实测必须 --browser chromium。
- insert:
    - id: mcp-playwright
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: playwright
        transport: stdio
        command: playwright-mcp
        args:
          - '--headless'
          - '--browser'
          - 'chromium'
        failOnStartupError: false
```

- 全局命令比 `npx -y @playwright/mcp@latest` 启动快且离线可用；升级用 `npm update -g @playwright/mcp`，升级后用 probe-mcp.mjs 重新核对工具清单。
- 不想全局装时，`command: npx` + `args: ['-y','@playwright/mcp@latest','--headless','--browser','chromium']` 也能跑（首次慢、每次启动查 registry）。

- Windows 机器上可把 `chromium` 换成 `msedge`（复用系统 Edge），想去掉 `--headless` 看着浏览器被操作也可以。
- `failOnStartupError: false`：浏览器未装/网络差时只是会话里没有 playwright 工具，不影响 dsh web 启动。

UE 侧（早已存在，此为备忘）：

```yaml
- insert:
    - id: mcp-ue
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: ue
        transport: streamable-http
        url: http://127.0.0.1:8000/mcp
        failOnStartupError: false
```

前置：UE 编辑器在跑 + 项目 `.uproject` 启用 `ModelContextProtocol` 与 `AllToolsets` 插件 + auto-start（首次接线走 `unreal-mcp` 技能的 `references/setup.md` 三步流程）。

## B. Claude Code / 项目 `.mcp.json`

```json
{
  "mcpServers": {
    "unreal-mcp": { "type": "http", "url": "http://127.0.0.1:8000/mcp" },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--headless", "--browser", "chromium"]
    }
  }
}
```

UE 官方入口也可在编辑器 console 跑 `ModelContextProtocol.GenerateClientConfig ClaudeCode` 自动生成/合并 unreal-mcp 条目。

## C. 浏览器二进制与全局安装

- MCP 服务器本体（本机已装）：`npm install -g @playwright/mcp`（v0.0.80）。若 `~/.npm-global/bin` 不在 PATH，软链进已在 PATH 的目录：
  ```bash
  ln -sf ~/.npm-global/bin/playwright-mcp ~/.local/bin/playwright-mcp
  ```
- 首次装浏览器：`npx playwright install chromium`。**版本匹配技巧**：用 MCP 包自带的 playwright-core 装，避免 core 与浏览器版本错配：
  ```bash
  CLI=$(ls -t ~/.npm/_npx/*/node_modules/playwright-core/cli.js | head -1)
  node "$CLI" install chromium
  ```
  （本机 2026-09-06 实测装得 `chromium-1243` + `chromium_headless_shell-1243`，冒烟通过。）
- 无显示环境（本机）：headless shell 即可工作；桌面 Linux 若去掉 `--headless` 启动报缺库，按报错补系统库（Arch：`pacman -S --needed nss gtk3 xdg-utils` 等）。

## D. 复用真实登录态（已登录网站 / 用户本地 Edge）

1. **持久 profile**：`--user-data-dir <目录>` 指一个专用目录，人工登录一次后 MCP 跨会话复用 cookie/localStorage。默认 profile 位置受管；`--isolated` 则每次全新。
2. **CDP attach**：真实浏览器先以远程调试启动，MCP 直连它：
   ```bash
   msedge --remote-debugging-port=9222
   # MCP 侧加参数：
   #   --cdp-endpoint http://127.0.0.1:9222
   ```
   等于直接操作用户正在用的浏览器实例——**会在真实会话里点击/提交，任务前先向用户确认范围**。

## E. 探测 / 自检

```bash
# 浏览器 MCP 工具清单（stdio 通用，升级版本后重新核对）
node <技能目录>/references/probe-mcp.mjs -- npx -y @playwright/mcp@latest --headless --browser chromium
node <技能目录>/references/probe-mcp.mjs -- npx -y chrome-devtools-mcp@latest

# 带 --call 可顺手调用一个工具做冒烟，如：
# ... probe-mcp.mjs --call browser_navigate '{"url":"https://example.com"}' -- npx -y @playwright/mcp@latest --headless --browser chromium
```

- UE 是 **HTTP** MCP（不在本脚本范围）：DSH 会话里看有没有 `mcp__ue__*` 工具、`list_toolsets` 是否返回；或在编辑器 Output Log 看 MCP 启动日志。
- DSH 会话内快速验证：让 AI 调一次 `browser_navigate` 打开 example.com，能返回 Page URL + Snapshot 即链路全通。
