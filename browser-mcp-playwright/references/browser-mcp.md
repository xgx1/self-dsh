# 浏览器 MCP：工具全量清单与参数细节

服务器 `@playwright/mcp`（Microsoft Playwright 官方），stdio 传输。
工具清单探测日期 **2026-09-06**（当日 latest，24 个工具）。工具名与参数以会话内实际 `tools/list` 为准，本文件用于建立心智模型，不代替 schema。

## 全量工具（按用途分组）

**导航 / 页面**
| 工具 | 用途 |
|---|---|
| `browser_navigate(url)` | 打开 URL（也支持 data: 等） |
| `browser_navigate_back` | 后退 |
| `browser_tabs(action, index?)` | list / new / close / select 多标签页 |
| `browser_close` | 关页面 |
| `browser_resize(w, h)` | 调窗口尺寸 |

**观察（只读）**
| 工具 | 用途 |
|---|---|
| `browser_snapshot()` | **核心**。可访问性树文本快照，元素带 ref（如 `ref=e12`），操作依据 |
| `browser_take_screenshot(filename?)` | 像素截图，看视觉/留证据，不能当操作依据 |
| `browser_find(textOrRegex)` | 在快照里搜元素（页大时先搜再截） |
| `browser_console_messages(level?)` | 页面 console 输出（JS 报错诊断） |
| `browser_network_requests()` | 本次加载以来的请求列表（带序号） |
| `browser_network_request(n)` | 单条请求完整详情（headers/body） |

**行动（改页面状态）**
| 工具 | 用途 |
|---|---|
| `browser_click(element, ref)` | 点击（ref 必须来自最新快照） |
| `browser_type(element, ref, text)` | 输入文本 |
| `browser_fill_form(fields[])` | 多字段表单一次填完（优先用它） |
| `browser_select_option(element, ref, values)` | 下拉选择 |
| `browser_hover(element, ref)` | 悬停（触发 hover 菜单/提示） |
| `browser_drag(startRef, endRef)` | 拖拽 |
| `browser_press_key(key)` | 按键（Enter/Esc/组合键） |
| `browser_wait_for(text?/textGone?/time?)` | 等文本出现/消失或固定时间（异步页面必用） |
| `browser_evaluate(function)` | 页面内执行 JS 取值（返回需 JSON 可序列化） |
| `browser_file_upload(paths[])` | 文件上传（必须先点过上传控件触发选择器） |
| `browser_drop(...)` | 模拟外部拖放文件/数据进页面 |
| `browser_handle_dialog(accept, promptText?)` | 处理 alert/confirm/prompt（弹窗会卡页面，先处理它） |
| `browser_run_code_unsafe(code)` | 跑 Playwright 代码片段。**RCE 级**：只用于复杂批量操作，不替代 evaluate |

## 已验证的关键事实（本机实测 2026-09-06）

- 本机（Linux、无 DISPLAY）必须 `--headless`；默认 chrome 渠道不存在（`/opt/google/chrome/chrome` not found），**必须加 `--browser chromium`** 用 playwright 自带构建。
- 端到端冒烟通过：headless chromium 153 成功打开 https://example.com 并返回快照文件。
- 快照/截图默认落盘在进程工作目录的 `.playwright-mcp/` 下（如 `page-*.yml`）；要固定位置加 `--output-dir`。
- 浏览器二进制装在 `~/.cache/ms-playwright/`（实测 `chromium_headless_shell-1243`，Chrome Headless Shell 153.0.8010.12）。
- **ref 可能带帧前缀**：iframe 内元素形如 `[ref=f1e6]`（cn.bing.com 实测搜索框就是 `f1e6`）；把它原样传给工具的 `target` 参数即可，服务器自动解析所在帧。正则/脚本解析 ref 时要兼容 `fN` 前缀。

## CLI 启动参数（常用）

| 参数 | 作用 |
|---|---|
| `--headless` | 无显示环境必加 |
| `--browser <b>` | chrome / msedge / firefox / webkit / chromium（含 -beta 等渠道）。本机用 `chromium`；Windows 想用系统 Edge 用 `msedge` |
| `--user-data-dir <dir>` | 自定义持久 profile（登录态跨会话保留） |
| `--isolated` | 每次全新临时 profile（不留痕迹） |
| `--cdp-endpoint <url>` | 连接已开远程调试端口的真实浏览器（复用登录态，见 setup-mcp.md） |
| `--vision` | 坐标/截图模式（拿截图当操作依据）。默认不开——快照模式更稳更省 token |
| `--port <n>` | 从 stdio 改为 HTTP 服务模式 |
| `--output-dir <dir>` | 快照/截图落盘目录 |
| `--caps <list>` | 增开能力面（pdf 等） |

以 `npx -y @playwright/mcp@latest --help` 实际输出为准。

## 典型序列

```
navigate → snapshot → (find 定位) → click/fill_form/select_option → wait_for 反馈文本 → snapshot 验证
拿数据:   network_requests → network_request(n) 拿 JSON；或 evaluate 取 DOM 值
查问题:   console_messages（JS 错） + network_request（接口错） + screenshot（看长相）
```

## 备选：chrome-devtools-mcp（Google Chrome 团队，29 个工具，同日探测）

- 启动：`npx chrome-devtools-mcp@latest`。CDP 直连，强项是**性能与调试**。
- 独有能力：`performance_start_trace` / `performance_stop_trace` / `performance_analyze_insight`（Core Web Vitals）、`lighthouse_audit`、`take_heapsnapshot`、`emulate`。
- 常规自动化与 playwright 同构：`navigate_page` / `take_snapshot`（a11y 树） / `click` / `fill_form` / `wait_for` / `list_network_requests` / `evaluate_script`…
- 隐私/行为注意：默认向 Google CrUX 发 trace URL（`--no-performance-crux` 关）、收集用量统计（`--no-usage-statistics` 关）、未协商 roots 时文件写入限制在临时目录。

**选型结论：常规"操作网页"用 `@playwright/mcp`（本技能默认）；要给网页做性能剖析/内存调试时再上 chrome-devtools-mcp，两者可并存不冲突。**
