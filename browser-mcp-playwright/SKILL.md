---
name: browser-mcp-playwright
description: "浏览器 MCP（@playwright/mcp）实战纪律：快照循环、ref 过期、表单/上传/弹窗、诊断三件套、无头与登录态复用、配置与排障。触发词：操作浏览器、打开网页、网页自动化、抓页面内容、看接口返回、console 报错排查、Pixel Streaming 页面验证。"
---

# 浏览器 MCP（Playwright）实战纪律

> **平台约定**：本机主力环境是 Linux（Arch）——命令以 bash 为先、可直接执行；Windows 专属步骤一律收进「Windows（PowerShell）」小节。

浏览器 MCP 服务器是 `@playwright/mcp`（stdio，npx 启动），控制真实/无头浏览器里的网页。工具清单与参数见 `references/browser-mcp.md`，安装与配置见 `references/setup-mcp.md`。

与虚幻编辑器 MCP 的配合（Remote Control / Pixel Streaming / 网页数据→UE 资产）见 `unreal-editor-mcp-ops`。

## 一、什么时候用浏览器 MCP

| 你要做的事 | 用什么 |
|---|---|
| 打开网页、点按钮、填表单、抓内容、截图存档 | 浏览器 MCP |
| 查接口返回、看 console 报错、网络请求诊断 | 浏览器 MCP（network / console 类工具） |
| 借浏览器查引擎文档、在线市场、排错资料 | 浏览器 MCP（引用时把 URL 写进回复） |
| Remote Control 面板、Pixel Streaming / 云渲染页面 | 浏览器 MCP 观察页面 ↔ UE 端改状态，双向验证（联动流程见 `unreal-editor-mcp-ops`） |
| 网页数据 → UE 资产（DataTable / DataAsset） | 浏览器抓数 → UE 侧落库 |
| 改编辑器内容、建资产、编译 C++ | **不要用浏览器 MCP**，走 UE 侧（`unreal-editor-mcp-ops`） |

## 二、核心纪律（动手前先读）

1. **快照循环**：`browser_snapshot`（可访问性树，元素带 ref）→ 按 ref 行动（click / type / fill_form）→ 再 snapshot 验证。截图只用于"看长相"，**不能拿截图当操作依据**；反过来，**UI 视觉验收必须逐张目检截图——只截图不看等于没做视觉测试（capture ≠ inspect）**。
   - ref 细节（实测 v0.0.80）：树里形如 `[ref=e12]`；**iframe 内元素带帧前缀**（如 `[ref=f1e6]`）。工具参数名叫 `target`，值就是快照里的 ref id——两个名字是同一个东西，帧前缀原样带上即可。
2. **ref 会过期**：页面每次变化后旧 ref 作废，必须用最新一次 snapshot 里的 ref。找不到元素先 `browser_find` 搜快照，不要盲猜。
3. **等一等**：异步加载用 `browser_wait_for`（等文本出现/消失或固定时间），不要睡等、不要立刻断言失败。
4. **表单优先 fill_form**：多字段一次填完比逐个 type 快且稳；下拉用 `browser_select_option`。
5. **文件上传两步**：先点击页面上的上传控件触发文件选择，再 `browser_file_upload` 给路径；顺序反了会挂起。
6. **诊断三件套**：`browser_console_messages`（JS 报错）、`browser_network_requests` + `browser_network_request`（接口详情）、`browser_evaluate`（页面内取值）。"点了没反应"先看这三样。
7. **`browser_run_code_unsafe` 是 RCE 级工具**：只在确有必要（复杂批量操作）时用，且不拿它替代 `browser_evaluate` 能干的事。
8. **弹窗（alert/confirm）会卡住页面**：出现后先 `browser_handle_dialog`。
9. **浏览器操作也串行**：同页状态连续变化，不要并行发浏览器调用。
10. **抓数优先走接口**：`browser_network_request` 直接拿 JSON 比解析 DOM 干净；静态页才用 snapshot / evaluate。

全量工具清单与参数：`references/browser-mcp.md`。

## 三、环境与配置速查

- DSH web：`~/.dsh/profiles/web/cordis.patch.yml` 注册浏览器 MCP 的片段见 `references/setup-mcp.md`（改完**必须重启 dsh web**）。
- Claude Code / 项目：`.mcp.json` 里的 playwright 条目模板见 `references/setup-mcp.md`；UE 侧的 `mcp-ue` 条目同样在那份文档的 A/B 节。
- 要操作"真实登录态"的浏览器（已登录网站、用户本地 Edge）：CDP attach 或 user-data-dir 持久 profile，见 setup-mcp.md D 节。
- **Linux 无显示环境必须 `--headless`**；本机无 chrome 渠道，实测必须 `--browser chromium`；Arch 缺系统依赖的补法在 setup-mcp.md C 节。

## 四、排障自检清单

| 症状 | 先查 |
|---|---|
| 没有 playwright 工具 | dsh web 改 patch 后是否重启；`npx -y @playwright/mcp@latest --version` 是否可用 |
| navigate 报"浏览器不存在" | `npx playwright install chromium`（或按 setup-mcp.md 用匹配版本的 playwright-core 装） |
| 点了没反应 | `browser_console_messages` + `browser_network_requests`；是否弹出了新对话框 |
| ref 找不到 / 操作打偏 | 重新 snapshot 拿最新 ref；iframe 内元素确认带了帧前缀 |
| 截图是全白/黑屏 | 页面还没渲染完，先 `browser_wait_for` 再截；无显示环境确认用了 `--headless` |

## 维护提示

- 浏览器工具清单探测日期 2026-09-06（`@playwright/mcp` 当日 latest=v0.0.80，24 个工具）。升级后重新探测并更新 `references/browser-mcp.md`：`node <技能目录>/references/probe-mcp.mjs -- playwright-mcp --headless --browser chromium`。
- 可用性回归测试（9 项端到端：快照→填表→点击→验证→截图→console→真实外网搜索）：`node <技能目录>/references/mcp-e2e-test.mjs`，全程约 30 秒；核心 1-8 必须全过，第 9 项视网络。
- 本文件是"判断与流程"层；参数级细节放 `references/`，主文件别膨胀。
