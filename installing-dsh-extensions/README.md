# 从源码安装 DSH 扩展（installing-dsh-extensions）

> 把现成扩展装进生产：先分形态（插件 / 技能分组仓 / MCP），再走对应链路——插件走「fork → 克隆 → `link:` → 重启」，技能走软链（免重启），MCP 只改 patch 配置。**与 `dsh-extension-dev` 的分工**：那个管「怎么写/改扩展」，本技能管「怎么把现成扩展装进来」。总纲（ADR-0007）：生产 profile 不出现 npm 交付的依赖，一切走 `link:` 源码安装。

## 什么时候用
触发词：安装扩展、装插件、安装 DSH 插件、装 MCP、接入 MCP、安装 mcp server、从源码安装、fork 上游、vendor 插件、install extension、装个技能组。

## 先分形态，再选链路
| | 插件形态 | 技能分组仓形态 | MCP 形态 |
|---|---|---|---|
| 是什么 | 独立 npm 包（有 `package.json`、`dsh.bundle`） | 一组 `SKILL.md` 目录 | 外部 MCP server 的接入配置 |
| 落点 | `dsh-extensions/vendor/<仓库名>/` | `dsh-extensions/skills/<上游仓库名>/` | `~/.dsh/profiles/web/cordis.patch.yml` |
| 接入 | `profiles/web/package.json` 的 `link:` 依赖 | `install-skill.sh` 递归扫 `SKILL.md` 软链 | `insert` 一行 `@deepseek-ai/dsh-mcp-client` |
| 生效 | **必须重启** | **不必重启**（技能按需扫描） | **不必重启**（patch 层热加载） |

前两者都是 git submodule，装完必须回 `dsh-extensions` 更新指针（ADR-0005：固定成本，不是收尾可选项）。

## 通用侦察（MCP 形态只做第 2 步）
```bash
npm view <包名> repository.url                   # 1. 只知道包名时反查上游仓库
cat ~/.dsh/profiles/web/package.json | python3 -m json.tool | grep -A20 dependencies   # 2. 已装 link: 插件
ls ~/.dsh/skills/ | grep -i <关键词>             #    已装技能
grep -n 'serverName' ~/.dsh/profiles/web/cordis.patch.yml ~/.dsh/cordis.patch.yml 2>/dev/null
git ls-remote <上游URL> HEAD                     # 3. exit 0 = 可 clone
gh repo view <owner>/<repo> --json name,visibility,isFork
```

已存在就**不要重装**（重跑 `pnpm install` 会重算 lockfile 引入漂移，且不带来新能力），改成只读巡检：依赖与层栈 / 软链是否真的落在源码上 / 产物新鲜 / submodule 指针已提交 / 无悬空软链（`find ~/projects/MyAI/dsh-extensions -xtype l | wc -l` 期望 0）/ 服务健康。**最强的证据是运行时**：Tool 出没出现在工具表、技能出没出现在会话技能目录。

## 链路 A / B 的命令（C 见下节）
```bash
# 链路 A：插件形态
gh repo fork <owner>/<repo> --clone=false            # 改了源码就必须 fork 才能推
cd ~/projects/MyAI/dsh-extensions
git submodule add https://github.com/xgx1/<repo>.git vendor/<repo>   # 用 submodule add，别先 clone 再补
dsh plugin --profile web add link:/home/sx/projects/MyAI/dsh-extensions/vendor/<repo>
find src -newer lib/index.js -type f                 # 有输出 = 产物陈旧，需 pnpm install && pnpm build

# 链路 B：技能分组仓形态
gh repo fork <owner>/<repo> --clone=false
cd ~/projects/MyAI/dsh-extensions
git submodule add https://github.com/xgx1/<repo>.git skills/<上游仓库名>
cd skills/<上游仓库名> && git remote add upstream <上游URL> && git fetch upstream
cd ~/projects/MyAI/dsh-extensions
./install-skill.sh --dry-run     # 预演：确认「新建 N」与实际新增数一致
./install-skill.sh               # 真正软链进 ~/.dsh/skills/
./install-skill.sh --list | grep <技能名>
```

- 包名 **≠ 仓库名**：`link:` 的键必须用 `package.json` 的 `name`；生产配置一律写**绝对路径**。`dsh plugin add` 会自动 reconcile `dsh.profile.bundles`（**bundles 不必手改**），仅在该命令不可用时手工补。
- `link:` 引用源码，profile 加载的却是**构建产物**——只检查目录存在不够，源码改过而产物没重建是最隐蔽的失效方式。**运行时依赖还必须能解析**：`lib/*.js` 里 externalize 的 `@deepseek-ai/*` 不会自动看到安装闭包，缺一个就整棵插件树加载失败（dsh-web 崩溃重启循环）；修法是把 `lib/` 里出现的 `@deepseek-ai/*` 声明进 `dependencies`，并让 devDeps 对齐同一生产版本。
- **只有 user patch 层热加载**：新增 bundle、改 bundle 自己的 `cordis.patch.yml`、改 bundle 的 lib 产物，**都必须重启**。
- 技能目录 = **含 `SKILL.md` 的目录**（安装器递归发现、不限层级）；有上游的组必须带 `upstream` 远端（`self-*` 自建组没有），装完**不必重启**。

## 链路 C：MCP 形态
**MCP 是配置层不是依赖层**：不 fork、不 `git submodule add`、不改 `package.json`，只在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加**一个 server 一个 `insert` 块**（`id` 与 `serverName` 都要唯一；`transport` 只有 `stdio` / `streamable-http`）。先确认 server 本体可用（`command -v <command>` / `curl -sS -o /dev/null -w '%{http_code}\n' <url>`），首次接入**保持 `failOnStartupError` 默认 true**——写成 `false` 且命令不存在 / 端口没服务时配置会**静默消失**。该 patch 属 user patch 层，**热加载不用重启**；写坏致崩溃循环就在块里加 `disabled: true` 或删掉该块。

## 重启规则（插件形态必读）
重启会**杀掉当前会话**（含正在执行本流程的 agent），顺序是硬要求：**先把报告、验收证据、后续指令全部说完**，再用定时器把重启与本进程解耦：

```bash
systemd-run --user --collect --on-active=10 --unit=dsh-restart-once systemctl --user restart dsh-web.service
```

`--collect` 让一次性单元执行后自动清理、**单元名可重复使用**（不加它第二次装扩展会因单元名已存在而失败），延迟窗口内仍可 `systemctl --user stop dsh-restart-once.timer` 撤销。命令返回＝重启**已排程**（此刻还没断线），**本轮最终回复必须在 10 秒内说完**。**不要用 `nohup ... sleep 3 ... &` 兜底**：`dsh-web.service` 是 `KillMode=control-group`，重启会连后台延时进程一起杀掉。若环境无 `systemd-run`：放弃延时，发完报告后直接执行 `systemctl --user restart dsh-web.service` 并告知用户页面会短暂中断。

## 验收 / 回滚 / 常见坑
- 验收与回滚：`git ls-tree HEAD <路径>` 返回 `160000 commit …`（**别用 `git status` 判断指针是否登记**，它区分不出「已提交」与「根本没登记」）；`dsh-extensions` 的 `git status` 不再显示该 submodule 为 modified；插件形态另查 `dsh.profile.bundles` 里有该包名、`ls -la ~/.dsh/profiles/web/node_modules/<包名>` 指向 vendor；**功能在运行时真的可见**才算装好。回滚 = `dsh plugin --profile web remove <包名>`（依赖与 bundles 一并退场）→ `git rm vendor/<repo>` → 延时重启。
- 常见坑：`pnpm` 超时 / `fetch failed` = 代理没设（`export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897`）；`ERR_PNPM_IGNORED_BUILDS` = 按报错点名的**确切键**加进 `pnpm-workspace.yaml` 的 `allowBuilds`；`Cannot find package '@deepseek-ai/…' imported from …/vendor/…` = 悬空软链或运行时依赖不可解析；插件通过 `ctx.skills.registerProvider()` 提供的技能**在 `~/.dsh/skills/` 里找不到是正常的**（`install-skill.sh` 不扫 `vendor/`）。
- 提交纪律：四个仓库各提交一次（上游 fork 仓 → `dsh-extensions` 指针 → `MyAI` 指针 → `~/.dsh` 的 profile `link:` 改动），**漏掉任何一个，换台设备就重建不出来**。
