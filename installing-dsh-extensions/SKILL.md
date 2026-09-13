---
name: installing-dsh-extensions
description: "从源码安装 DSH 扩展的全流程：fork 上游 → 克隆 fork → 装成 profile 插件或技能分组仓 → 重启生效。触发词：安装扩展、装插件、装 DSH 扩展、安装 DSH 插件、从源码安装、fork 上游、vendor 插件、install extension、装个技能组。含两条链路（插件 vendor/ + 技能 skills/）、dsh plugin 自动 reconcile bundles、upstream 远端约定、重启不中断报告的延时做法与常见坑（pnpm 代理、allowBuilds、悬空软链、崩溃循环）。"
---

# 安装 DSH 扩展（源码 fork 流水线）

装扩展 = **拿到源码的归属权，再让 harness 引用它**。本机总纲（ADR-0007）：生产 profile 里不出现 npm 交付的依赖，一切走 `link:` 源码安装；所以"装扩展"永远是"fork → 克隆 → `link:`"三步，不是 `pnpm add <包名>`。

**与 `dsh-extension-dev` 的分工**：那个技能管「**怎么写/改**扩展」，本技能管「**怎么把现成扩展装进来**」。写完一个新扩展要装进生产 → 用本技能。

## 先分形态，再选链路

问一句「这个扩展是**插件**还是**技能**？」，后续每一步都不同：

| | 插件形态 | 技能分组仓形态 |
|---|---|---|
| 是什么 | 独立 npm 包（有 `package.json`、`dsh.bundle`） | 一组 `SKILL.md` 目录 |
| 落点 | `dsh-extensions/vendor/<仓库名>/` | `dsh-extensions/skills/<上游仓库名>/` |
| 接入 | `profiles/web/package.json` 的 `link:` 依赖 | `install-skill.sh` 递归扫 `SKILL.md` 软链 |
| 生效 | **必须重启** | **不必重启**（技能按需扫描） |
| 父仓指针 | submodule | submodule |

两者都是 git submodule，装完必须回 `dsh-extensions` 更新指针（ADR-0005：这是固定成本，不是收尾可选项）。

> **不属于本技能**：动态 Cordis 插件（`cordis_define`/`cordis_run`，进程内、重启即失，见 `cordis-plugin-development`）；MCP 服务接入（改 `cordis.patch.yml` 挂 mcp 行，不是源码扩展）。

## 通用前三步（两条链路相同）

### 1. 定位上游仓库

要 fork 就得先有确切的**上游 URL**。来源通常是用户给的链接或包名。若只给了包名：

```bash
# 已发布到 npm 的扩展：从 registry 反查仓库地址
npm view <包名> repository.url
```

拿到上游后确认它真的是 DSH 扩展（`package.json` 里有 `dsh.bundle` 或 `dsh.client`；技能则是仓库里有 `SKILL.md`）。

### 2. 本地侦察——可能早就装过了

```bash
# 已装的 profile 依赖（link: 的都是源码插件）
cat ~/.dsh/profiles/web/package.json | python3 -m json.tool | grep -A20 dependencies
# 已装的技能
ls ~/.dsh/skills/ | grep -i <关键词>
# 已在 vendor/ 或 skills/ 里的
ls ~/projects/MyAI/dsh-extensions/vendor/ ~/projects/MyAI/dsh-extensions/skills/
```

已存在就**不要重装**：直接改现成的那份（回到 `dsh-extension-dev` 规矩一的复用分支）。

### 3. 验证可达性（决定能否 fork）

```bash
git ls-remote <上游URL> HEAD    # exit 0 = 可 clone
gh repo view <owner>/<repo> --json name,visibility,isFork
```

`git ls-remote` 失败通常是网络/代理问题，见「常见坑」。

## 链路 A：插件形态

### A1. fork 上游到自己的账号

```bash
# 账号 xgx1（gh 已登录）。不指定 --org 时 fork 到当前登录账号
gh repo fork <owner>/<repo> --clone=false
# → 得到 https://github.com/xgx1/<repo>
```

**为什么必须 fork 而不是直接 clone 上游**：fork 之后 origin 是自己的仓，本机改动才能推送回去、才能跨设备重建；上游降级为 `upstream` 远端只作对照（ADR-0006 的同一套纪律）。直接 clone 上游等于把生产依赖挂在一个自己无权推送的仓库上。

### A2. 克隆 fork 并登记为 submodule

关键：**用 `git submodule add`，不要先 `git clone` 再补**。前者一次性写进 `.gitmodules`，后者只会留下一个未登记的 gitlink，父仓记不住它是什么。

```bash
cd ~/projects/MyAI/dsh-extensions
git submodule add https://github.com/xgx1/<repo>.git vendor/<repo>
cd vendor/<repo>
git remote add upstream <上游URL>          # 上游只作对照，不覆盖本地
git fetch upstream
```

### A3. 确认包名——**不等于仓库名**

```bash
python3 -c "import json;d=json.load(open('package.json'));print(d['name']);print('bundle:',d.get('dsh',{}).get('bundle',{}).get('patch'))"
```

`name` 和仓库名经常不同（例：仓库 `dsh-genui` → 包名 `@changfenhuang/dsh-genui`）。后续 `link:` 的**键**必须用这个 `name`。

### A4. 接入 profile（`dsh plugin add` 一次搞定两件事）

```bash
dsh plugin --profile web add link:/home/sx/projects/MyAI/dsh-extensions/vendor/<repo>
```

它是一条 pnpm 转发器，会依次做三件事：

1. 在 `~/.dsh/profiles/web/` 里执行 `pnpm add link:<绝对路径>` → 写入 dependencies
2. 因 cwd 是 profile 目录，**相对路径会被锚到调用处**；生产配置里一律写**绝对路径**
3. **自动 reconcile `dsh.profile.bundles`**：把声明了 `dsh.bundle` 的依赖追加进 bundles 层栈（源码见 `deepseek-harness/apps/cli/src/plugin.ts` 的 `reconcilePlugins`）

所以 **bundles 不需要手改**。仅在 `dsh plugin add` 不可用时（比如 pnpm 报错后手工修的）才手工补：编辑 `~/.dsh/profiles/web/package.json`，依赖键用 A3 查到的 `name`，并把它加进 `dsh.profile.bundles` 数组。

装完复查一次：

```bash
grep -E '<包名>|link:' ~/.dsh/profiles/web/package.json
```

### A5. 若上游要求构建

`link:` 引用的是源码，但 profile 加载的是构建产物。检查 `package.json` 的 `main`/`exports` 指向的目录是否已存在：

```bash
ls lib/ dist/ 2>/dev/null    # exports 指向的产物目录
pnpm install && pnpm build   # 缺失时按上游 README 构建
```

### A6. 重启（见下方「重启规则」）

## 链路 B：技能分组仓形态

### B1. 确定分组

```bash
ls ~/projects/MyAI/dsh-extensions/skills/     # 已有分组
```

- 有对应上游 → fork 后放 `skills/<上游仓库名>/`，组内目录与上游一一对应
- 本机自写、无上游 → 放进 `self-*` 自建组（`self-dsh` 自研 DSH 运维 / `self-ops` 系统运维 / `self-ue` UE 实践）

### B2. fork + 克隆（有上游时）

```bash
gh repo fork <owner>/<repo> --clone=false
cd ~/projects/MyAI/dsh-extensions
git submodule add https://github.com/xgx1/<repo>.git skills/<上游仓库名>
cd skills/<上游仓库名> && git remote add upstream <上游URL> && git fetch upstream
```

**有上游的组必须带 `upstream` 远端**（ADR-0006）——`git diff upstream/<分支>` 就是「本机改了什么」的权威答案。`self-*` 自建组没有 upstream。

### B3. 放置技能目录

技能目录 = **含 `SKILL.md` 的目录**，放哪个层级都行（安装器按 `SKILL.md` 递归发现，不限深度）。上游的层级原样保留（`skills/<名>/`、`.agents/skills/<名>/`、`plugins/<插件>/skills/<名>/`）；本机独有技能放到该组的主技能根下。

一个技能 = 一个目录，最少一个 `SKILL.md`。frontmatter 至少 `name` 与 `description`；`name` 用字母数字连字符，**安装器优先取 frontmatter 的 `name:`**，没有才用目录名。

### B4. 软链 + 验证

```bash
cd ~/projects/MyAI/dsh-extensions
./install-skill.sh --dry-run     # 预演：确认「新建 N」与实际新增数一致
./install-skill.sh               # 真正软链进 ~/.dsh/skills/
./install-skill.sh --list | grep <技能名>
ls -la ~/.dsh/skills/<技能名>     # 应是指向分组仓的符号链接
```

**技能够了，不必重启**：DSH 按需扫描技能目录，软链建好即可用。

## 重启规则

插件形态装完必须重启 `dsh-web.service` 才会加载新代码。但重启会**杀掉当前会话**——包括正在执行本流程的 agent——所以顺序和时机是硬要求：

1. **先做完一切**：报告、验收证据、后续指令全部**在重启命令之前**完成。重启后再补一句是不可能的。
2. **再延时重启**，用 systemd 的定时器把重启与本进程解耦，让当前会话有机会先把话说完：

```bash
# 3 秒后重启：定时单元独立于本进程，报告来得及发出去
systemd-run --user --collect --on-active=3 --unit=dsh-restart-once \
  systemctl --user restart dsh-web.service
```

- `--collect` 让一次性单元执行后自动清理，**单元名可以重复使用**（不加它，第二次装扩展会因单元名已存在而失败）。
- 命令返回即表示重启**已排程**，此刻还没断线——报告要在 3 秒内发完。

**不要用 `nohup ... sleep 3 ... &` 兜底**：`dsh-web.service` 是 `KillMode=control-group`（已实测），重启会杀掉整个 cgroup，连你的后台延时进程一起带走，重启永远不会发生。`systemd-run` 不在同组，所以只有它能做这件事。

若环境无 `systemd-run`：**放弃延时**，把报告发完之后直接执行下面这条，并明确告知用户页面会短暂中断：

```bash
systemctl --user restart dsh-web.service
```

3. **报告里必须写明**：重启已排程、页面会自动恢复、刷新即可；并给出恢复后的验证命令：

```bash
systemctl --user is-active dsh-web.service     # 期望 active
systemctl --user show dsh-web -p NRestarts     # 期望不是很大的数
journalctl --user -u dsh-web -n 60             # 起不来时看这里
```

**重启失败会导致 dsh-web 进入崩溃重启循环**（每 3s 一次，`NRestarts` 飙升），排查见「常见坑」。

### Windows（PowerShell）

本机无 Windows 实例，以下为等价形态、**未在本机验证**：

```powershell
# 延时重启：无 systemd，用计划任务或分离进程
Start-Process powershell -ArgumentList '-Command','Start-Sleep 3; Restart-Service dsh-web'
Get-Service dsh-web
```

## 验收清单

装完逐项确认，缺一项就不算装好：

- [ ] `~/.dsh/profiles/web/package.json` 的 dependencies 里有指向 fork 的 `link:`，路径是**绝对路径**
- [ ] `dsh.profile.bundles` 里出现了该**包名**（`dsh plugin add` 自动加；手工装的要自己加）
- [ ] `ls -la ~/.dsh/profiles/web/node_modules/<包名>` 指向 vendor 源码
- [ ] `cd dsh-extensions && git status` 显示 submodule 已登记，`.gitmodules` 有新条目
- [ ] 重启后 `systemctl --user is-active dsh-web.service` = `active`，页面能打开
- [ ] 功能实际可见（新 Tool / 新界面 / 设置项）
- [ ] 技能形态额外：`./install-skill.sh --list` 能列出，`~/.dsh/skills/<名>` 是软链

## 回滚

```bash
dsh plugin --profile web remove <包名>      # 依赖与 bundles 一并退场
cd ~/projects/MyAI/dsh-extensions && git rm vendor/<repo> && git commit
systemd-run --user --collect --on-active=3 --unit=dsh-restart-once systemctl --user restart dsh-web.service
```

## 常见坑

| 症状 | 原因与修法 |
|---|---|
| `pnpm` 超时 / `fetch failed` | 代理没设。Linux：`export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897`；Windows：`$env:HTTPS_PROXY="http://127.0.0.1:7897"` |
| `ERR_PNPM_IGNORED_BUILDS` | 依赖带 postinstall 被 pnpm 拦下。按报错点名的**确切键**加进 `~/.dsh/profiles/web/pnpm-workspace.yaml` 的 `allowBuilds`，再重跑 |
| lockfile 漂移报错 | 加 `--no-frozen-lockfile` |
| 重启后 `plugin tree failed to load`、页面打不开 | 新插件没激活（多半 bundles 缺项，或它自己的 `cordis.patch.yml` 有语法错）。**别让它留在崩溃循环里**：先 `journalctl --user -u dsh-web -n 60` 看报错，改完再重启 |
| `Cannot find package '@deepseek-ai/…' imported from …/vendor/…` | 检出被改名/移动过，vendor 里的绝对符号链接悬空。检查 `find ~/projects/MyAI/dsh-extensions -xtype l`，重指后重启 |
| 重启后当前对话断了、agent 没来得及报告 | 重启前没把话说完。回到「重启规则」第 1 步 |
| 装完 `dsh-extensions` 一直显示 dirty | 没更新父仓指针。`git add <submodule 路径> && git commit` |
| `git submodule add` 报路径已存在 | 目录已被 `git clone` 占位。删掉重新用 `submodule add`，或 `git submodule add --force` |

## 提交纪律

装完要让改动**可重建**，三个仓库按层级各提交一次（ADR-0005 的两层拓扑）：

```bash
# 1. 上游 fork 仓（只在改了它的源码时）
cd dsh-extensions/vendor/<repo> && git add -A && git commit -m "..." && git push origin main

# 2. dsh-extensions：更新 submodule 指针
cd ~/projects/MyAI/dsh-extensions && git add .gitmodules vendor/<repo> && git commit -m "..." && git push

# 3. MyAI：更新 dsh-extensions 指针
cd ~/projects/MyAI && git add dsh-extensions && git commit -m "..." && git push
```

`~/.dsh` 是独立仓库（`xgx1/dsh-home`），profile 的 `link:` 改动记在**它的**仓库里：

```bash
cd ~/.dsh && git add profiles/web/package.json profiles/web/pnpm-lock.yaml && git commit -m "..." && git push
```

这是四个仓库——漏掉任何一个，换台设备就重建不出来。
