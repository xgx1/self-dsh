---
name: browser-unreal-mcp
description: "双 MCP 联动实战指南：浏览器 MCP（Playwright）+ 虚幻官方 MCP（unreal-mcp / ModelContextProtocol）。判断该用哪个 MCP、什么时候才值得在编辑器里模拟点击/模拟操作、如何把浏览器与 UE 串成可验证的闭环。触发词：操作浏览器、打开网页、网页自动化、编辑器自动化、模拟点击、模拟操作、Remote Control、Pixel Streaming、信令页面验证。"
---

# 浏览器 + 虚幻 MCP 联动指南

两套 MCP，一套纪律。本技能回答三个问题：**这次该用哪个 MCP？什么时候才值得"模拟点击"？怎么把两边串成可验证的闭环？**

## 两个 MCP 是什么

| | 浏览器 MCP | 虚幻 MCP |
|---|---|---|
| 服务器 | `@playwright/mcp`（stdio，npx 启动） | UE 官方 `ModelContextProtocol` 插件（HTTP `127.0.0.1:8000/mcp`） |
| 控制对象 | 真实/无头浏览器里的网页 | 正在运行的虚幻编辑器 |
| 发现方式 | `tools/list` 直接给全部工具（约 24 个） | 只有 `list_toolsets` / `describe_toolset` / `call_tool` 三个元工具，按需发现 |
| 状态特性 | 页面随时可变，先快照后行动 | 游戏线程串行执行，改的是活编辑器状态 |
| 细节文档 | `references/browser-mcp.md` | `unreal-mcp` 主技能 + `references/ue-simulation-decisions.md` |

连接不上时的处理（不要硬编）：
- 看不到 playwright 工具 → 按 `references/setup-mcp.md` 检查 DSH patch / `.mcp.json`，确认 npx 可用。
- 看不到 unreal-mcp → 编辑器没开或 MCP 服务没启动。让用户启动编辑器（console 执行 `ModelContextProtocol.StartServer`），或走 `unreal-mcp` 技能的 setup 流程。

## 一、选哪个 MCP：任务 → 工具决策表

| 你要做的事 | 用什么 |
|---|---|
| 打开网页、点按钮、填表单、抓内容、截图存档 | 浏览器 MCP |
| 查接口返回、看 console 报错、网络请求诊断 | 浏览器 MCP（network / console 类工具） |
| 建改资产、蓝图、材质、关卡、Niagara、Sequencer | UE MCP 确定性工具（**绝不模拟点击 UI 菜单来干这事**） |
| 编译 C++ / 查编译错误 | UE MCP 的 LiveCoding 类工具（阻塞到编译结束） |
| 编辑器里没有 API 暴露、只能走 UI 的工作流 | UE MCP 模拟点击（最后手段，见决策树） |
| 验证编辑器 UI 本身（面板、菜单、按钮响应） | UE MCP 模拟点击 + 截图对比（这就是正当用途） |
| PIE 内的游戏交互（角色动、点游戏内按钮） | UE MCP 输入/PIE 类工具或 Python 兜底；浏览器 MCP 无能为力 |
| Remote Control 面板、Pixel Streaming / 云渲染页面 | 两个都用：浏览器观察页面 ↔ UE 端改状态，双向验证 |
| 网页数据 → UE 资产（DataTable / DataAsset） | 浏览器抓 → UE 落库 |

一句话：**改编辑器内容走确定性 API；网页的事走浏览器；只有"必须经过 UI 的人肉路径"或"UI 本身是被测对象"才模拟点击。**

## 二、浏览器 MCP 核心纪律（动手前先读）

1. **快照循环**：`browser_snapshot`（可访问性树，元素带 ref）→ 按 ref 行动（click / type / fill_form）→ 再 snapshot 验证。截图只用于"看长相"，**不能拿截图当操作依据**；反过来，**UI 视觉验收必须逐张目检截图——只截图不看等于没做视觉测试（capture ≠ inspect）**。
   - ref 细节（实测 v0.0.80）：树里形如 `[ref=e12]`；**iframe 内元素带帧前缀**（如 `[ref=f1e6]`）。工具参数名叫 `target`，值就是快照里的 ref id——两个名字是同一个东西，帧前缀原样带上即可。
2. **ref 会过期**：页面每次变化后旧 ref 作废，必须用最新一次 snapshot 里的 ref。找不到元素先 `browser_find` 搜快照，不要盲猜。
3. **等一等**：异步加载用 `browser_wait_for`（等文本出现/消失或固定时间），不要睡等、不要立刻断言失败。
4. **表单优先 fill_form**：多字段一次填完比逐个 type 快且稳；下拉用 `browser_select_option`。
5. **文件上传两步**：先点击页面上的上传控件触发文件选择，再 `browser_file_upload` 给路径；顺序反了会挂起。
6. **诊断三件套**：`browser_console_messages`（JS 报错）、`browser_network_requests` + `browser_network_request`（接口详情）、`browser_evaluate`（页面内取值）。"点了没反应"先看这三样。
7. **`browser_run_code_unsafe` 是 RCE 级工具**：只在确有必要（复杂批量操作）时用，且不拿它替代 `browser_evaluate` 能干的事。
8. 弹窗（alert/confirm）会卡住页面：出现后先 `browser_handle_dialog`。
9. 浏览器操作也串行：同页状态连续变化，不要并行发浏览器调用。

全量工具清单与参数：`references/browser-mcp.md`。

## 三、UE MCP：模拟点击 / 模拟操作决策树

底线原则（与 `unreal-mcp` 主技能一致）：所有调用跑在游戏线程 → **严格串行**；批量改资产前后各保存一次；编译进行中不发调用。

决策树（从上往下，命中即停）：

1. **有确定性工具吗？** → `describe_toolset` 查相关 toolset（actors / blueprints / materials / …），有就直接 `call_tool`。90% 的"我想在编辑器里点一下"到这一步就终结了。
2. **console / Python 能到吗？** → 找名字含 Console / Python 的工具：console 命令（开关功能、Cheat Manager）或 `unreal.*` Python。比模拟点击稳定一个数量级。
3. **是 PIE 内交互吗？** → 找 Input / PIE / Simulation 相关 toolset 模拟按键鼠标；UMG 按钮点击找 WidgetInteraction / SimulateClick 类能力；没有就 Python 兜底。
4. **只剩 UI 路径了吗？** → 模拟点击编辑器 UI。最后手段，按下面五步走。

**模拟点击五步流程（每步不可省）：**

1. **先看**：截编辑器视口/目标面板 → 确认目标按钮可见、没有遮挡面板。
2. **定位**：用工具返回的元素引用或截图坐标；坐标基于当下布局，**动过布局就重新截**。
3. **点**：一次一个动作。
4. **验**：立刻再截图/查询状态确认效果；没发生 → 回第 1 步重新定位；连错两次 → 降级到 console/Python 路线并告知用户。
5. **记**：把"点了什么、验证了什么"写进回复，模拟类操作必须可追溯。

**不该模拟点击（高频反模式）：** 用点击代替建资产/改属性；用点菜单代替 console 命令；PIE 状态没确认就硬点；不截图先看、靠猜坐标盲点。

深度细节与坑：`references/ue-simulation-decisions.md`。

## 四、双 MCP 联动工作流

通用节奏（两个世界共享）：**观察 → 一次一步行动 → 再观察验证。**

### 4.1 Pixel Streaming / 云渲染页面验证
1. UE 端：call_tool 启动流送（或让用户启动），确认信令服务端口。
2. 浏览器：`browser_navigate` 打开播放页 → snapshot 确认视频元素存在 → 截图核对画面。
3. `browser_network_requests` 查信令 WebSocket；`browser_console_messages` 查前端报错。
4. 闭环：UE 端改（如切关卡）→ 浏览器刷新 → 截图对比。

### 4.2 Remote Control / Web 面板 ↔ 编辑器双向验证
1. 浏览器打开 RC 面板，fill_form / click 改一个值。
2. UE 端：call_tool 查询同一属性是否真的变了（**浏览器看到的 ≠ 编辑器真实状态，必须两头验**）。
3. 反向同样走一遍：UE 端改 → 浏览器刷新确认 UI 同步。

### 4.3 网页数据 → UE 资产
1. 浏览器抓数：优先 `browser_network_request` 直接拿接口 JSON（比解析 DOM 干净）；静态页用 snapshot / evaluate。
2. UE 端：用确定性工具建 DataTable / DataAsset，保存。
3. 回浏览器抽查两条数据核对。

### 4.4 借浏览器查文档/资源
查引擎文档、在线资产市场、排错资料时用浏览器 MCP 直接读，引用时把 URL 写进回复。

## 五、环境与配置速查

- DSH web：`~/.dsh/profiles/web/cordis.patch.yml` 已注册 `mcp-ue`；浏览器 MCP 注册片段见 `references/setup-mcp.md`（改完需重启 dsh web）。
- Claude Code / 项目：UE 官方 `ModelContextProtocol.GenerateClientConfig` 会写 `.mcp.json`；playwright 条目手写（模板在 setup-mcp.md）。
- 要操作"真实登录态"的浏览器（已登录网站、用户本地 Edge）：CDP attach 或 user-data-dir 持久 profile，见 setup-mcp.md。
- Linux 无显示环境必须 `--headless`；Arch 缺系统依赖的补法在 setup-mcp.md。

## 六、排障自检清单

| 症状 | 先查 |
|---|---|
| 没有 playwright 工具 | dsh web 改 patch 后是否重启；`npx -y @playwright/mcp@latest --version` 是否可用 |
| navigate 报"浏览器不存在" | `npx playwright install chromium`（或按 setup-mcp.md 用匹配版本的 playwright-core 装） |
| 看不到 unreal-mcp / list_toolsets 失败 | 编辑器没开 / 服务没起 / 端口被占（`unreal-mcp` 技能 operations.md 矩阵）；**编辑器重启过 → 旧 Mcp-Session-Id 已作废，必须重新 initialize** |
| UE 调用挂住 | 是否在编译/加载/PIE；等结束或先停 PIE |
| 点了没反应（网页） | console_messages + network_requests；是否弹出了新对话框 |
| 点了没反应（UE） | 重新截图确认界面状态；检查焦点窗口；降级到确定性路线 |

## 维护提示（给要改这份模板的你）

- 浏览器工具清单探测日期 2026-09-06（`@playwright/mcp` 当日 latest=v0.0.80，24 个工具）。升级后重新探测并更新 `references/browser-mcp.md`：`node <技能目录>/references/probe-mcp.mjs -- playwright-mcp --headless --browser chromium`。
- 可用性回归测试（9 项端到端：快照→填表→点击→验证→截图→console→真实外网搜索）：`node <技能目录>/references/mcp-e2e-test.mjs`，全程约 30 秒；核心 1-8 必须全过，第 9 项视网络。
- UE 侧**故意不写死工具名**（官方 toolset 随版本增减），写的是发现模式与决策规则——保持这种写法，别把某次探测到的临时清单固化进来。
- 本文件是"判断与流程"层；参数级细节放 references/，主文件别膨胀。
