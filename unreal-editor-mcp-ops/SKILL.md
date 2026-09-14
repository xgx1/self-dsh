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
| PIE 内的游戏交互（点游戏内按钮、填输入框） | **Slate ref 路径**：对 PIE 窗口树 `Snapshot` → 按 ref `Click`/`Type`/`PressKey`（实测干净会话 6/6）。只有 3D 视口世界坐标/世界空间拖拽才降到系统级注入 |
| 网页相关（打开页面、抓数、看接口） | 交给 `browser-mcp-playwright` |

一句话：**改编辑器内容走确定性 API；只有"必须经过 UI 的人肉路径"或"UI 本身是被测对象"才模拟点击。**

## 二、底线原则

所有调用跑在游戏线程 → **严格串行**；批量改资产前后各保存一次；编译进行中不发调用；编辑器重启过 → 旧 `Mcp-Session-Id` 作废，必须重新 initialize。

## 三、模拟点击 / 模拟操作决策树

从上往下，命中即停：

1. **有确定性工具吗？** → `describe_toolset` 查相关 toolset（actors / blueprints / materials / …），有就直接 `call_tool`。90% 的"我想在编辑器里点一下"到这一步就终结了。
2. **console / Python 能到吗？** → 找名字含 Console / Python 的工具：console 命令（开关功能、Cheat Manager）或 `unreal.*` Python。比模拟点击稳定一个数量级。
3. **是 PIE 内交互吗？** → **游戏 UMG 就在 Slate 树里**（UE 5.8 实测）：根 `Snapshot` 会列出 PIE 浮窗，对它再 `Snapshot` 就能读到游戏按钮/输入框的 ref，`Click`/`Type`/`PressKey` 直接生效（干净会话 3 轮往返 6/6）。**先走这条，不要一上来就用坐标。** 只有 ref 够不着的场景（3D 视口内的世界坐标点击、拖到世界空间）才降到系统级注入；而注入会**污染 PIE 输入状态**——实测被注入过一轮后，连 ref 点击都变成"返回 true 但页面不动"，必须 StopPIE/StartPIE 才复位。工具链、守卫与踩坑见 `references/ue-simulation-decisions.md`「PIE 内交互」。
   （旧结论「游戏 UMG 不在无障碍树里、Click 不触发 OnClicked」已作废：那是用根 ref/视口 image 取样加上被污染的会话得出的。）
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
| 点了没反应 | **先怀疑坐标**（有没有落在两个控件之间的缝里、面板是否因内容变化平移了）；再重新截图确认界面状态与焦点窗口；仍不行降级到确定性路线 |
| 点击后编辑器退出/崩溃 | **先查有没有点到别的窗口**（指针下窗口校验）；再看 `Engine exit requested` 出现在点击之前还是之后；退出清理期的 WorldPartition 断言是引擎噪声，不是玩法崩溃 |
| PIE 里点不到游戏按钮 | ① ref 解析要容错（控件行还带 `[focused]`/`[disabled]` 等标注，只认紧挨 `pos` 的正则会漏）；② 页面切换后旧 ref 全失效 → 重新 `Snapshot`；③ `Click` 返回 true ≠ 生效，用**读控件树判当前页面**来验证，别只看返回值；④ 本轮做过系统级注入就 StopPIE/StartPIE 复位；⑤ 仍不行才降系统级注入（Wayland：hyprctl 几何/置顶 + ydotool 点击 + wtype 键盘 + grim 截图，且**移动与点击必须同一设备**） |
| 源码改了但行为没变 | 构建可能没真正生效：查产物时间戳 vs 源码；UBT 报 `Target is up to date` 却源码更新 → `touch` 源文件，仍不重链就删模块产物强制链接（`unreal-official-mcp-surgery` 的编译纪律节） |

## 维护提示

- UE 侧**故意不写死工具名**（官方 toolset 随版本增减），写的是发现模式与决策规则——保持这种写法，别把某次探测到的临时清单固化进来。
- 本文件是"判断与流程"层；参数级细节放 `references/ue-simulation-decisions.md`，主文件别膨胀。
