# dsh-extension-dev —— DSH 扩展开发元技能

> 给 DSH 加功能前的四条硬规矩：先搜索复用、逐步实现、一个功能只做一个插件、写完传 GitHub。

## 什么时候用

触发词：扩展 DSH、DSH 插件、给 DSH 加功能、开发 DSH 扩展、DSH 扩展开发、DSH 功能扩展。

**动手前先做形态分类**——不同形态的源码格式、装载器、持久模型完全不同，规则不能跨形态混用：

| 形态 | 落点 | 生命周期 | 何时用 |
|---|---|---|---|
| 动态 Cordis 插件 | `cordis_define`/`cordis_run`，会话内 | 当前进程，重启即失 | 临时功能、原型试水、一次性界面 |
| Agent 预设 / 宿主组合 | `~/.dsh/.agent-presets/<id>/cordis.yml` | 持久 | 改会话工具集/人设/模型路由 |
| 技能 | `~/.dsh/skills/<名字>/SKILL.md` | 持久 | 教 agent「怎么做」 |
| 持久安装插件（独立 npm 包） | `exports ./client` + `dsh.client` manifest + `dsh.bundle.patch`；`dsh plugin --profile web add link:<目录>` | 持久跨会话 | 正式功能、Web GUI 扩展 |
| MCP 工具 | 组合里挂 mcp 行 | 持久 | 接入外部工具生态 |

## 怎么用

**规矩一：先搜索与复用（优先级最高）。** 动手前按序排查，并把排查证据写进最终报告：① 本地已装插件（dsh-liangshen、dsh-ssh、dsh-task-board、dsh-aionui-panel、web-ui-all）；② 本地技能与预设 `~/.dsh/skills/`、`~/.dsh/.agent-presets/`；③ 网上（`web_search` + GitHub `packages/`、`docs/` 与社区仓库）。判定：完全符合 → 直接用；大致符合 → clone 后**在其基础上改**，禁止从零重写；没有 → 进入规矩二。**禁止假装搜过**，报告必须写「搜了什么、找到了什么、为什么用/不用」。

**规矩二：逐步实现，先调已有技能。** (a) 已有相关功能 → 先加载 `add-software-feature`，按其流程把功能加到现成插件上，禁止推倒重写；(b) 没有现成功能 → 先加载 `cordis-plugin-development` 新建。两条分支共用：改的是预设/宿主组合 → 加载 `editing-cordis-compositions`；新增插件包 → 放进 `dsh-extensions/plugins/<name>/`，照同目录现有三个插件的结构做（改完在该仓库提交并 `pnpm build`）；**写代码前先描述功能**：一句话目标 + 目标形态（上表五选一）+ 验收标准。

**规矩三：极简原则（硬约束）。** 一个功能 = 一个插件/包/技能，严禁多功能糅合。拆分判据：能否独立启停？能否独立版本升级？能否独立复用？任一为是 → 必须独立。动态插件副作用必须可逆（`ctx.effect()`/`ctx.on()`/官方 disposer），Host/Client 之间只传无损 JSON。

**规矩四：代码托管 GitHub。** 账号 `xgx1`（gh CLI 已登录），统一仓库 `xgx1/dsh-extensions`。流程：本地工作区建目录 → `git init` → commit → `gh repo create xgx1/dsh-extensions --public --source .` → push。默认公开；每个扩展完成即推送，不留本地散件；README 写清功能/用法/出处（复用谁的必须注明）。

完成报告输出：改了什么、落在哪种形态、复用了什么（或为什么没有现成可用）、GitHub 地址、验证方式。

## 前置条件

- 权威资料以当前仓库证据为准，不靠记忆：`~/projects/MyAI/deepseek-harness/docs/cookbook/extension-cookbook.md`、`docs/cordis-primer.md`（有 .zh 中文版）；官方 GitHub `deepseek-ai/deepseek-harness` 的 `docs/` 与 `packages/`。
- 社区参考 `w2112515/dsh-plugin-development` 只借鉴「形态分类 + 证据优先」思路——**它的 dsh.bundle/Loader 内容针对旧版部署，本机不适用，勿照搬**。
- pnpm 在 profiles/web 装 link 包网络失败（`dsh plugin add` 超时 / `fetch failed`）时设代理后重试：

```bash
export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897
```

（本机默认已设，可用 `env | grep -i proxy` 核对。）lockfile 漂移加 `--no-frozen-lockfile`。

## 注意事项 / 已知坑

- 动态插件是进程内扩展，重启即失；要持久必须落到预设/安装插件形态。
- **扩展现成功能 ≠ 改官方源码**：优先独立包/补丁形式覆盖，官方源码改动目标为 0。
- **禁止编辑部署自带的 preset 安装目录**；要改 shipped 预设就复制一份到 `~/.dsh/.agent-presets/` 改副本。
- 插件代码是纯 JS：无 TypeScript/JSX/import；Client 端用 `React.createElement`；先用 `cordis_inspect_*` 查准 API 再写；Inspect 结果只用于确认能力/签名，不能当业务数据缓存。
- **Host 插件读兄弟服务必须用 `ctx.get(name)`**（全局注册表），禁止未声明的 `ctx.xxx` 属性访问——属性代理拓扑敏感，未 inject 的服务会**静默返回 undefined** 导致功能静默失效；懒加载模式照抄 `goalServiceOf`。
- 监听 agent 事件（`agent/status`、`turn-stopping`）在插件 ctx 上可行（事件表全局共享 + scope filter 放行无标签 ctx）。
- 覆盖官方 Web UI 样式不能靠 hashed CSS-module 类名，用官方 DOM 的稳定 data 属性锚（`[data-phase]`、`[data-composer-card]`、`[data-slot='...']`），规则用扩展自己的 `<html>` data 属性门控，关 = 属性移除即还原。
- 无 seat 区域（如侧边栏）挂载：`waitForElement('[data-slot="sidebar.workspaces"]')`（MutationObserver）+ `insertBefore` 锚点 + `createRoot`；折叠检测用 ResizeObserver 看父列宽。
- 独立 client bundle 构建：官方 `clientBundle` 预设只在官方仓库内可用，独立包复制其要点（`window.__ModuleLoader__.load(...)` banner/footer、platform 模块 external、`define` 替换 `process.env`、CSS Modules 用 lightningcss 或内联 style）。
