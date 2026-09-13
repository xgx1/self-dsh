---
name: unreal-editor-mcp-ops
description: "在运行中的虚幻编辑器里通过 MCP 操作时的决策与纪律：确定性工具优先、console/Python 次之、模拟点击是最后手段；含模拟点击五步流程、高频反模式、PIE 交互、与浏览器 MCP 的联动工作流（Remote Control / Pixel Streaming / 网页数据入资产）。触发词：编辑器自动化、MCP 改编辑器、模拟点击、模拟操作、Remote Control、Pixel Streaming、编辑器 UI 验证。"
---

# UE 编辑器 MCP 操作决策与纪律

> **平台约定**：本机主力环境是 Linux（Arch）——命令以 bash 为先、可直接执行；Windows 专属步骤一律收进「Windows（PowerShell）」小节。

这层回答的是「该不该点、按什么顺序点」，不是「有哪些工具」：工具级说明见 `unreal-mcp` 主技能，参数级细节见 `references/ue-simulation-decisions.md`，浏览器侧纪律见 `browser-mcp-playwright`。

## 一、选哪条路：任务 → 能力决策表

| 你要做的事 | 用什么 |
|---|---|
| 建改资产、蓝图、材质、关卡、Niagara、Sequencer | UE MCP 确定性工具（**绝不模拟点击 UI 菜单来干这事**） |
| 编译 C++ / 查编译错误 | UE MCP 的 LiveCoding 类工具（阻塞到编译结束） |
| 编辑器里没有 API 暴露、只能走 UI 的工作流 | 模拟点击（最后手段，见决策树） |
| 验证编辑器 UI 本身（面板、菜单、按钮响应） | 模拟点击 + 截图对比（这就是正当用途） |
| PIE 内的游戏交互（角色动、点游戏内按钮） | UE MCP 输入/PIE 类工具或 Python 兜底 |
| 网页相关（打开页面、抓数、看接口） | 交给 `browser-mcp-playwright` |

一句话：**改编辑器内容走确定性 API；只有"必须经过 UI 的人肉路径"或"UI 本身是被测对象"才模拟点击。**

## 二、底线原则

所有调用跑在游戏线程 → **严格串行**；批量改资产前后各保存一次；编译进行中不发调用；编辑器重启过 → 旧 `Mcp-Session-Id` 作废，必须重新 initialize。

## 三、模拟点击 / 模拟操作决策树

从上往下，命中即停：

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

## 四、与浏览器 MCP 的联动工作流

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

## 五、环境与配置速查

- DSH web：`~/.dsh/profiles/web/cordis.patch.yml` 已注册 `mcp-ue`（改完需重启 dsh web）；浏览器侧注册片段见 `browser-mcp-playwright` 的 `references/setup-mcp.md`。
- Claude Code / 项目：UE 官方 `ModelContextProtocol.GenerateClientConfig` 会写 `.mcp.json`。
- UE MCP 服务启动：编辑器 console 执行 `ModelContextProtocol.StartServer`，HTTP `127.0.0.1:8000/mcp`，需 `Mcp-Session-Id` 头 + `notifications/initialized`。

## 六、排障自检清单

| 症状 | 先查 |
|---|---|
| 看不到 unreal-mcp / list_toolsets 失败 | 编辑器没开 / 服务没起 / 端口被占（`unreal-mcp` 技能 operations.md 矩阵）；**编辑器重启过 → 旧 Mcp-Session-Id 已作废，必须重新 initialize** |
| UE 调用挂住 | 是否在编译/加载/PIE；等结束或先停 PIE |
| 点了没反应 | 重新截图确认界面状态；检查焦点窗口；降级到确定性路线 |
| PIE 注入交互不可靠 | `Click` 对 PIE 内 UMG 按钮返回值真假不定、`OnClicked` 常不触发——交互验收交给用户，AI 只做只读诊断（见 `unreal-official-mcp-surgery`） |

## 维护提示

- UE 侧**故意不写死工具名**（官方 toolset 随版本增减），写的是发现模式与决策规则——保持这种写法，别把某次探测到的临时清单固化进来。
- 本文件是"判断与流程"层；参数级细节放 `references/ue-simulation-decisions.md`，主文件别膨胀。
