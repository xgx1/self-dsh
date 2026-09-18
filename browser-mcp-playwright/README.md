# browser-mcp-playwright —— 浏览器 MCP 实战纪律

> 用 `@playwright/mcp` 操作真实/无头浏览器时的判断与流程层：快照循环、ref 过期、诊断三件套、配置与排障。

## 什么时候用

| 你要做的事 | 用什么 |
|---|---|
| 打开网页、点按钮、填表单、抓内容、截图存档 | 浏览器 MCP |
| 查接口返回、看 console 报错、网络请求诊断 | 浏览器 MCP（network / console 类工具） |
| 借浏览器查引擎文档、在线市场、排错资料 | 浏览器 MCP（引用时把 URL 写进回复） |
| Remote Control 面板、Pixel Streaming / 云渲染页面 | 浏览器 MCP 观察 ↔ UE 端改状态（联动见 `unreal-editor-mcp-ops`） |
| 改编辑器内容、建资产、编译 C++ | **不要用**，走 UE 侧（`unreal-editor-mcp-ops`） |

触发词：操作浏览器、打开网页、网页自动化、抓页面内容、看接口返回、console 报错排查、Pixel Streaming 页面验证。

## 怎么用

核心是**快照循环**：`browser_snapshot`（可访问性树，元素带 ref）→ 按 ref 行动（click / type / fill_form）→ 再 snapshot 验证。

- 工具参数名叫 `target`，值就是快照里的 ref id（形如 `[ref=e12]`）；**iframe 内元素带帧前缀**（如 `[ref=f1e6]`），原样带上。
- 页面每次变化后旧 ref 作废，必须用最新 snapshot 的 ref；找不到元素先 `browser_find` 搜快照。
- 异步加载用 `browser_wait_for`（等文本出现/消失或固定时间），不要睡等。
- 表单优先 `browser_fill_form` 一次填完，下拉用 `browser_select_option`。
- 文件上传两步：**先**点击页面上传控件触发文件选择，**再** `browser_file_upload` 给路径；顺序反了会挂起。
- 弹窗（alert/confirm）会卡住页面，出现后先 `browser_handle_dialog`。
- 诊断三件套：`browser_console_messages` / `browser_network_requests` + `browser_network_request` / `browser_evaluate`；「点了没反应」先看这三样。
- 抓数优先走接口（`browser_network_request` 拿 JSON），静态页才用 snapshot / evaluate。
- 浏览器操作**串行**，不要并行发调用；`browser_run_code_unsafe` 是 RCE 级工具，不拿它替代 `browser_evaluate`。

工具全量清单与参数见 `references/browser-mcp.md`；安装与配置见 `references/setup-mcp.md`。

## 前置条件

- MCP 服务器本体：`npm install -g @playwright/mcp`；`~/.npm-global/bin` 不在 PATH 时建软链：
  ```bash
  ln -sf ~/.npm-global/bin/playwright-mcp ~/.local/bin/playwright-mcp
  ```
- 浏览器二进制，首次安装：
  ```bash
  npx playwright install chromium
  ```
- DSH web 注册片段在 `~/.dsh/profiles/web/cordis.patch.yml`（**改完必须重启 dsh web**）；Claude Code / 项目用 `.mcp.json` 模板。两者原文见 `references/setup-mcp.md` A、B 节。
- 复用真实登录态（已登录网站 / 本地 Edge）：`--user-data-dir <目录>` 持久 profile，或 CDP attach：
  ```bash
  msedge --remote-debugging-port=9222
  # MCP 侧加参数：--cdp-endpoint http://127.0.0.1:9222
  ```
  CDP attach 等于操作用户正在用的浏览器实例，**会在真实会话里点击/提交，任务前先向用户确认范围**。

## 注意事项 / 已知坑

- **Linux 无显示环境必须 `--headless`**；本机无 chrome 渠道，实测必须 `--browser chromium`。
- 截图只用于「看长相」，**不能拿截图当操作依据**；反过来，**UI 视觉验收必须逐张目检截图——只截图不看等于没做视觉测试**。
- 截图全白/黑屏：页面还没渲染完，先 `browser_wait_for` 再截；无显示环境确认用了 `--headless`。
- 排障速查：没有 playwright 工具 → 查是否重启 + `npx -y @playwright/mcp@latest --version`；navigate 报「浏览器不存在」→ 装 chromium；ref 打偏 → 重新 snapshot（确认帧前缀）。
- 版本匹配技巧（避免 playwright-core 与浏览器错配）：
  ```bash
  CLI=$(ls -t ~/.npm/_npx/*/node_modules/playwright-core/cli.js | head -1)
  node "$CLI" install chromium
  ```
- 桌面 Linux 去掉 `--headless` 报缺库时按报错补（Arch：`pacman -S --needed nss gtk3 xdg-utils` 等）。
- 工具清单探测日期 2026-09-06（当日 latest=v0.0.80，24 个工具）；升级后重新探测：
  ```bash
  node <技能目录>/references/probe-mcp.mjs -- playwright-mcp --headless --browser chromium
  ```
- 可用性回归（9 项端到端，约 30 秒；核心 1-8 必须全过，第 9 项视网络）：
  ```bash
  node <技能目录>/references/mcp-e2e-test.mjs
  ```
