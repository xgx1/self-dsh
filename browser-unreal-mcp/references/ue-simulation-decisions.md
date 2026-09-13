# UE 编辑器：模拟点击 / 模拟操作 深度决策

前提：本文件**不写死工具名**。官方 toolset 随版本增减，一切以 `list_toolsets` → `describe_toolset` 的当场结果为准。把探测到的临时清单写死进技能，版本一升级就静默失效。

## 三层能力模型（编辑器自动化的现实）

1. **确定性 API 层**：`call_tool` 直接改对象（资产、蓝图、材质、关卡……）。可重复、可断言、不依赖窗口布局。→ 首选。
2. **命令层**：console 命令 / Python（`unreal` 模块）。很多"只有 UI 才有"的开关和批处理其实这一层就能到。→ 次选。
3. **模拟层**：模拟鼠标键盘/点击，走真实 UI 路径。受窗口状态、焦点、DPI、分辨率影响，天然脆弱。→ 仅当 1/2 都到不了，或 UI 本身是被测对象。

## 什么任务真正需要模拟层

- **被测对象就是 UI**：菜单项在不在、按钮点了有没有反应、面板布局对不对（回归验证）。
- **无 API 的编辑器工作流**：个别功能只暴露在菜单/面板上。
- **复现"人的操作"给用户看**（演示型需求）。

其余一律回退到第 1/2 层。

## 模拟层操作规程

前置检查（任一不满足先处理再动手）：

- [ ] 编辑器空闲（无编译、无保存进行中）
- [ ] 明确 PIE 状态——"编辑器 UI 模拟"和"PIE 内游戏模拟"是两个世界，不要混
- [ ] 窗口焦点在编辑器；目标面板可见、没有被其他 dock 挡住
- [ ] 已拿到当下截图/快照作为定位基准

执行：

- 一次一个动作；动作后立刻截图/查询验证。
- 同一动作失败两次 → 降级到命令层（console / Python），并把降级决策告诉用户。
- 全程串行（游戏线程），绝不并行发调用。

验证手段优先级：**状态查询（call_tool 查对象）＞ 截图对比 ＞ "看起来点了"（不算验证）**。

## 常见坑

- **坐标漂移**：窗口布局/DPI/分辨率变过之后旧坐标全部作废，必须重新截图定位。
- **焦点陷阱**：模拟按键落在别的窗口上；点击前确认编辑器在前台。
- **PIE 混淆**：编辑器工具在 PIE 期间行为不同。做编辑器 UI 模拟先退 PIE；做游戏内模拟先确认 PIE 已在跑。
- **异步假象**：点击后 UI 可能要下一帧才更新；验证前先等待/重查一次。
- **不可撤销**：跨编译边界的修改可能无法 Ctrl+Z；批量操作前后各保存一次。

## Playwright 风格 Slate 工具集的实测行为差异（2026-09 实证）

以下是对"快照发引用 + 直接 Slate 事件注入"这类工具集（如官方 SlateInspector）的实测行为结论，按行为描述、与具体版本无关。**在 PIE 内驱动 UMG 时尤其要按此执行：**

- **Click ≠ 触发 OnClicked**：鼠标事件注入对 PIE 内 UMG 按钮经常返回 true 但不触发点击处理（UMG 输入走游戏视口自己的路由，直接 Slate 注入进不去）。可靠组合：`Click`（只为拿焦点）→ `PressKey Enter`（Slate 按钮的键盘触发路径）。
- **Type 是追加不是替换**：逐字符键事件直接追加到现有内容。改值前必须 `Click` 输入框 → `PressKey Ctrl+A` → 再 `Type`，否则新旧拼接（实测曾拼出 16 位"手机号"）。
- **下拉选择工具打不开 PIE 内 ComboBox**（返回 false）：改走键盘——`Click` 聚焦 → `Down` 打开列表 → `Up`/`Down` 移动高亮 → `Enter` 提交。方向键语义是"移动高亮项"而非"展开"，且起始位置随当前选中项变化，**每按一步截图确认高亮再动手**。
- **引用（ref）跨页面切换全部失效**：登录页→模式页这类整体换树之后必须重新 Snapshot；同一页面内布局变化（如下拉展开导致后续控件位移）会让旧 ref 的位置作废但 ref 本身仍可用。
- **可访问性快照只有占位符没有已输入值**：核对输入框实际内容只能靠截图目检。
- **服务端错误文案回显 = 真实 HTTP 往返的证据**：只存在于服务端代码的错误字符串出现在 UI 上，比任何日志都硬。

## UE MCP（HTTP 传输）会话与调用协议

- **会话生命周期**：先 `initialize` 拿响应头 `Mcp-Session-Id` → 发 `notifications/initialized` → 之后所有请求都带该头。**编辑器一重启会话即作废**（表现为全部调用无响应/报错），必须重新 initialize——缓存过 session id 的脚本记得先清缓存。
- **call_tool 的嵌套结构**：官方插件的 `tools/call` 顶层 `name` 固定为元工具 `call_tool`，真正的目标是参数体里的 `toolset_name` / `tool_name` / `arguments`。把 toolset 工具直接当 `tools/call` 的 name 会报 `Expected non-empty 'name' param`。
- **资产对象参数要完整对象路径**：`/Game/UI/WBP_ModeSelect` 不行，要 `/Game/UI/WBP_ModeSelect.WBP_ModeSelect`（资产路径.对象名）；控件则 `...:WidgetTree.控件名`。
- **改 UMG 绑定的正规流程**：先在蓝图里 `RenameWidget` 改控件名 → `CompileWidgetBlueprint` → `save_assets`，C++ 再用新名做 BindWidget（部分控件名与引擎保留名冲突不可用，改完必须编译验证）。

## 无显示环境 / 重启编辑器（Linux）

- 从 agent shell 直接启动 GUI 编辑器会 `InitSDL() failed`：缺图形会话环境。从图形会话进程（Xwayland/plasmashell 等）的 `/proc/<pid>/environ` 提取 `DISPLAY`/`WAYLAND_DISPLAY`/`XDG_SESSION_TYPE`/`DBUS_SESSION_BUS_ADDRESS` 再启动。
- 杀编辑器进程时 `pkill -f "UnrealEditor..."` 会自匹配杀掉自己的 shell（命令行里含同样文字）——用 `[U]nrealEditor` 方括号 trick 破自匹配。
- 启动日志里的 UnrealTraceServer "daemon is exiting" 是 trace 守护进程的噪音，不是编辑器死了；判活只看编辑器进程与本体端口。

## 与浏览器 MCP 的同构性

两个世界的正确姿势是同一个循环：**观察 → 一次一步行动 → 再观察**。把 UE 模拟点击理解为"没有 accessibility tree 的浏览器操作"——正因为缺了那棵树，才要用截图补观察、用降级路线保稳定。
