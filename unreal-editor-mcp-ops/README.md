# UE 编辑器 MCP 操作决策与纪律

> 在运行中的虚幻编辑器里用 MCP 动手时，回答「该不该点、按什么顺序点」——确定性工具优先，console/Python 次之，模拟点击是最后手段。

**技能名**：`unreal-editor-mcp-ops` · 目录内含 `SKILL.md` + `references/ue-simulation-decisions.md`（模拟层参数级细节）

## 什么时候用

- 用户说「编辑器自动化」「MCP 改编辑器」「模拟点击」「模拟操作」「Remote Control」「Pixel Streaming」「编辑器 UI 验证」
- 要在运行中的 UE 编辑器里改资产/蓝图/材质/关卡，或要验证编辑器 UI 本身
- 工具级清单见 `unreal-mcp` 主技能、浏览器侧纪律见 `browser-mcp-playwright`——本技能只管**判断与顺序**

## 怎么用

### 一、先选路（命中即停，别跳级）

| 你要做的事 | 用什么 |
| --- | --- |
| 建改资产、蓝图、材质、关卡、Niagara、Sequencer | UE MCP 确定性工具，**绝不模拟点击 UI 菜单** |
| 编译 C++ / 查编译错误 | UE MCP 的 LiveCoding 类工具（阻塞到编译结束） |
| 编辑器里没有 API 暴露、只能走 UI 的工作流 | 模拟点击（最后手段） |
| 验证编辑器 UI 本身（面板、菜单、按钮响应） | 模拟点击 + 截图对比（正当用途） |
| PIE 内游戏交互（点游戏内按钮、填输入框） | **Slate ref 路径**：对 PIE 窗口树 `Snapshot` → 按 ref `Click`/`Type`/`PressKey`（实测干净会话 6/6） |
| 网页相关（打开页面、抓数、看接口） | 交给 `browser-mcp-playwright` |

决策树：① `describe_toolset` 查相关 toolset（actors / blueprints / materials…），有就 `call_tool` → ② 找名字含 Console / Python 的工具（console 命令或 `unreal.*` Python）→ ③ PIE 内交互走 ref → ④ 只剩 UI 路径才模拟点击。

### 二、模拟点击五步（每步不可省）

**先看**（截图确认目标可见无遮挡）→ **定位**（ref 或当下坐标，动过布局就重截）→ **点**（一次一个动作）→ **验**（立刻截图/查询；连错两次降级到 console/Python 并告知用户）→ **记**（回复里写明点了什么、验证了什么）。

不该模拟点击的高频反模式：用点击代替建资产/改属性；用点菜单代替 console 命令；PIE 状态没确认就硬点；不截图先靠猜坐标盲点。

### 三、系统级注入兜底（仅在 ref 够不着时；命令出自 `references/ue-simulation-decisions.md`）

```bash
# 原生 Wayland（Hyprland）：几何/置顶 hyprctl + 鼠标 ydotool + 键盘 wtype + 截图 grim
hyprctl -j clients                 # 取窗口 at/size，每次都现取，禁止硬编码
hyprctl cursorpos                  # 现取光标位置（ref 类工具会真的挪动系统光标）
ydotool click 0xC0                 # 左键单击；0x40 只按下、0x80 只抬起（拖拽用）、0x00 什么都不做
grim -g "<x,y wxh>"                # 抓的矩形与 hyprctl 的 at/size 逐像素一致
hyprctl -j activewindow            # 用 address 做「指针下窗口」守卫
# 置顶/聚焦走 Lua dispatcher（Hyprland 0.55+ 旧 windowraise 语法已废）
hyprctl -q eval '…hl.dsp.focus({window=w})…hl.dsp.window.bring_to_top({window=w})…'
# X11 / XWayland 旧路径：xdotool（对原生 Wayland 客户端无效）
xdotool getwindowgeometry --shell <win>; xdotool getmouselocation --shell | grep WINDOW
```

### 四、服务与联动

- UE MCP 服务启动：编辑器 console 执行 `ModelContextProtocol.StartServer`，HTTP `127.0.0.1:8000/mcp`，需 `Mcp-Session-Id` 头 + `notifications/initialized`。
- DSH web：`~/.dsh/profiles/web/cordis.patch.yml` 已注册 `mcp-ue`（改完需重启 dsh web）；Claude Code 侧由 UE 官方 `ModelContextProtocol.GenerateClientConfig` 写 `.mcp.json`。
- 浏览器联动（Pixel Streaming / Remote Control / 网页数据入资产）统一节奏：**观察 → 一次一步行动 → 再观察验证**；浏览器看到的 ≠ 编辑器真实状态，必须两头验。

## 前置条件

- 编辑器在运行、MCP 服务已起、`list_toolsets` 可用
- 模拟层额外要求：编辑器空闲（无编译/保存）、PIE 状态明确、窗口焦点在编辑器、目标面板可见、已有当下截图作定位基准
- 所有调用跑在游戏线程 → **严格串行**；批量改资产前后各保存一次；编译进行中不发调用
- 从 systemd 用户服务拉起的 shell（如 `dsh-web.service`）env 里没有 `DISPLAY`/`WAYLAND_DISPLAY`，需自行探测补齐，否则 SDL3 会静默退回 XWayland，Wayland 那套交互全部对不上；杀编辑器进程用 `pkill -f "[U]nrealEditor"` 的方括号 trick，否则会自匹配杀掉自己的 shell

## 注意事项 / 已知坑

- **编辑器一重启，旧 `Mcp-Session-Id` 作废**，必须重新 initialize（缓存过 session id 的脚本先清缓存）。
- **`Click` 返回 true ≠ 生效**：验证要「读控件树判当前页面」，别只看返回值；页面一换旧 ref 全废，每次动作前重新 Snapshot。
- **注入会污染 PIE 输入状态**：被系统级注入过一轮后，连 ref 点击都退化成「返回 true 而无效果」，要 StopPIE/StartPIE 才复位——所以顺序只能是「先 ref、必要时才注入」。
- 移动与点击**必须来自同一设备**（都走 ydotool）；混用会隔次丢点击（实测 3/6 → 6/6）。`Escape` 会停掉 PIE，别拿它当「关下拉」。
- 点了没反应**先怀疑坐标**（落在控件缝隙/面板平移），别先怀疑产品；点击后编辑器崩溃先查有没有点到别的窗口。
- `Snapshot` 参数是 `maxDepth`（camelCase），`max_depth` 被静默忽略；`Type` 是追加不是替换，改值前要先聚焦 + `Ctrl+A`。
- 维护约定：UE 侧**故意不写死工具名**（官方 toolset 随版本增减），保持这种写法。
