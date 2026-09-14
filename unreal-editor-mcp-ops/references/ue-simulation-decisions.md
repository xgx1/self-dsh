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

- **PIE 游戏 UMG 拿得到 ref，`Click` 直接生效**（2026-09-14 UE 5.8 实测）：根 `Snapshot`（空 ref）会列出 PIE 浮窗，对它再 `Snapshot` 就能读到游戏按钮/输入框的 ref——干净会话里 3 轮往返 6/6（「本地」↔「退出登录」整页切换）。**返回值不可信**：`Click` 返回 true 也可能什么都没发生；可靠验证是**读控件树看当前页面变了没**（像素对比会被窗口尺寸变化污染）。
- **ref 行带额外标注，解析要容错**：控件行常长这样 `button "退出登录" [focused] [pos=… size=…] [ref=…]`——只认"紧挨 `pos`"的正则会漏掉这类行（踩过：取 ref 静默返回空，现象看起来像"工具集点不动"）。`[disabled]` 的控件点不动，跳过。
- **`Snapshot` 的参数是 `maxDepth`（camelCase，默认 30）**：写成 `max_depth` 会被静默忽略——别拿"树很浅/只有几层 image"下结论。
- **`Click`/`Hover` 会真的挪动系统光标**：内部是 `GetWidgetScreenCenter` + `SetCursorPos`。点完看光标落到哪，可反推它算出的屏幕坐标（实测 Wayland 上确实会移）。它**不受下面"移动与点击必须同一设备"那条约束**——ref 路径的事件是引擎内部合成、不走 SDL/compositor，没有设备混用问题；`SetCursorPos` 只是把物理光标摆到控件上，让 hover 与命中状态一致。两个后果：① 之后若改用系统级注入，别假设光标还在原处，用 `hyprctl cursorpos` 现取再纠偏；② 反向不成立——注入留下的状态污染会让 ref 路径失灵，所以"先 ref、必要时才注入"的顺序不能倒过来用。
- **Type 是追加不是替换**：逐字符键事件直接追加到现有内容。改值前必须 `Click` 输入框（先聚焦）→ `PressKey Ctrl+A` → 再 `Type`；漏掉聚焦那步，`Ctrl+A` 落空、新值直接拼在后面（实测拼出 `TestUserAbc`）。
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
- **从 systemd 用户服务拉起的 shell（如 `dsh-web.service`）env 里连 `DISPLAY`/`WAYLAND_DISPLAY` 都没有**，只有 `XDG_RUNTIME_DIR`：脚本要自己探测补齐——`wayland-*` socket 名、`$XDG_RUNTIME_DIR/hypr/<instance-signature>`。补不齐时 SDL3 会**静默退回 XWayland**：编辑器照常起来，但窗口是 X 客户端，Wayland 那套 hyprctl/ydotool 交互全部对不上（判据只看启动日志里的 `Using SDL video driver '<name>'`）。
- 杀编辑器进程时 `pkill -f "UnrealEditor..."` 会自匹配杀掉自己的 shell（命令行里含同样文字）——用 `[U]nrealEditor` 方括号 trick 破自匹配。
- 启动日志里的 UnrealTraceServer "daemon is exiting" 是 trace 守护进程的噪音，不是编辑器死了；判活只看编辑器进程与本体端口。

## PIE 内交互（2026-09-14 UE 5.8 + Hyprland 原生 Wayland 实测）

**首选：Slate ref 路径**——对 PIE 窗口树取 ref，`Click`/`Type`/`PressKey` 直接用，干净会话实测 3 轮往返 6/6：

- 正确姿势：根 `Snapshot`（空 ref）→ 找到 `window "…[NetMode: Standalone 0]…" [ref=wN]` → `Snapshot {"ref":"wN"}` 读子树里的 `button`/`textbox`。`Windows list` 同样会列 PIE 浮窗（**没列出来通常是 PIE 已经停了**，不是工具集不支持）。
- 页面一换旧 ref 全废，每次动作前重新 Snapshot。
- 验证用"读树判页"（树里有「请输入姓名」= 登录页，有「退出登录」= 模式选择页），不要只看 `Click` 的返回值。

**兜底：系统级注入**——只用于 ref 够不着的地方（3D 视口内的世界坐标点击、拖到世界空间、相机拖拽）。按编辑器跑在哪套图形栈选工具链：

**原生 Wayland（Hyprland）**：`hyprctl` 几何/置顶 + `ydotool` 鼠标 + `wtype` 键盘 + `grim` 截图。

- 窗口几何：`hyprctl -j clients` 按标题匹配取 `at`/`size`。**每次都不同**（实测同一 PIE 浮窗出现过 1272×692 与 1272×1392，位置 (4,44) 与 (1284,744)）→ 一律现取，禁止硬编码。
- **指针移动与点击必须来自同一设备**：移动走 compositor（`hl.dsp.cursor.move`）+ 点击走 uinput（ydotool）时，UE 把两者当不同 pointer，**隔次丢点击**（实测 3/6）；两个都走 ydotool 后 6/6。uinput 相对位移带 ~1.9x 指针加速，要循环纠偏到 ±1px。
- 按键值：`ydotool click 0xC0` 左键单击；`0x40` 只按下、`0x80` 只抬起（拖拽用）；**`0x00` 是"什么都不做"**（man 里明说）。
- 置顶/聚焦用 Lua dispatcher（Hyprland 0.55+ 起旧 `hyprctl dispatch windowraise` 语法已废）：`hyprctl -q eval '…hl.dsp.focus({window=w})…hl.dsp.window.bring_to_top({window=w})…'`；随后用 `hyprctl -j activewindow` 的 address 做"指针下窗口"守卫（`input:follow_mouse=1` 时光标下的窗口就是活动窗口）。
- 键盘：`wtype`（虚拟键盘协议，支持中文）。截图：`grim -g "<x,y wxh>"`，抓的矩形与 `hyprctl` 的 `at`/`size` **逐像素一致**（和点击坐标同一套）。
- **注入会污染 PIE 输入状态**：被注入过一轮之后，连 ref 点击都会退化成"返回 true 而无效果"，StopPIE/StartPIE 才复位。所以——能用 ref 就别注入；注入完还要接着做 UI 交互，先重启 PIE。
- **Escape 会停掉 PIE**，别拿它当"关下拉"。

**X11 / XWayland（旧路径）**：`xdotool`。窗口原点 `xdotool getwindowgeometry --shell <win>` 现取；点前用 `xdotool getmouselocation --shell | grep WINDOW` 校验指针窗口 == PIE 窗口（没有这道守卫时误击别的窗口会被误判成产品 bug）；无 WM 的 XWayland 上抬窗要先 `windowlower 遮挡者` 再 `windowraise PIE`（单独 raise 常无效），且遮挡者会反复浮回来，守卫要常驻；键盘先 `xdotool windowfocus`，`xdotool type` 可送中文。**xdotool 对原生 Wayland 客户端无效**（看不见窗口也点不到），Wayland 会话里别用。

**坐标纪律（两套通用）**：屏幕坐标 = 窗口原点 + 图像坐标；窗口会被重排/改尺寸、面板还会因内容变化整体平移十几像素——**坐标只对"刚截的那张"有效**。按钮小（约 35×29px）时差 20px 就落进缝里：点击无反应**先怀疑坐标，别怀疑产品**。拖拽用 `mousemove → mousedown → 分步 mousemove（每步 sleep 30–50ms）→ mouseup`，步数 12–16，一次跳到终点 UMG 常常不认。

诊断纪律（避免把渲染问题误判成数据问题，反之亦然）：

- 控件"看起来没更新"时，先用 `UE_LOG` 打三件事：**控件树是否建起来（RootWidget/子项数）、文本是否真的设对了（打印字符串本体）、以及是哪个分支在跑**。实测因此把「文本根本没设」与「文本设了但那一层布局不渲染」分开——两者修法完全不同。
- 编辑器在退出清理阶段可能崩在引擎断言（UE 5.8 实测：`Assertion failed: InitState == EWorldPartitionInitState::Uninitialized` @ `WorldPartition.cpp`）。**这是拆除期噪声，不是玩法逻辑崩溃**；判断"是不是我点崩的"要看退出请求（`LogCore: Engine exit requested`）出现在点击之前还是之后。

## 与浏览器 MCP 的同构性

两个世界的正确姿势是同一个循环：**观察 → 一次一步行动 → 再观察**。浏览器有 accessibility tree 可依赖；UE 侧对应的东西是 Slate `Snapshot`——控件树与 ref 都拿得到（**PIE 游戏 UMG 也在内**），真正缺的是"值"：快照只有占位符，输入框里已经输入了什么只能靠截图目检。
