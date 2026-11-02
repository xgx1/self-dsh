---
name: enable-project-skills
description: "DSH 技能启用规则与自动落层。用户说「启用合适的技能」「开启技能」「这个项目要哪些技能」「自动检测项目并启用相关技能」「把某技能加进来」时必用。规定三层模型、域名→项目层映射、项目类型探测判据、写盘步骤与禁令；含当前各层现状快照，避免重复列举或写错层。"
---

# 技能启用规则（enable-project-skills）

DSH 的技能过滤是白名单制（`packages/skill/skill-filter/src/filter.ts`）。技能装进 `~/.dsh/skills` 只是"可被发现"，**能不能进模型目录由两层 YAML 决定**。本技能规定该放哪一层、怎么探测、怎么落盘。

## 三层模型

| 层 | 文件 | 管什么 | 规则 |
|---|---|---|---|
| 个人层 | `~/.dsh/skill-filter.yaml` | 任何项目都该有的技能 | 手工维护，全局生效 |
| 项目层 | `<项目根>/.dsh/skill-filter.yaml` | 该项目的域名技能 | 与个人层**取并集**——项目层累加，不替换 |
| 项目自带 | `<项目根>/.dsh/skills/`、`.agents/skills/` | 项目自己带的技能 | **过滤器放行**，任何层都不用列举 |

两层都不允许的技能：不进模型目录、不能 `/名称` 调用、不注入上下文。运行中会话的 catalog 是快照，改配置后**新开会话**才刷新（运行时门禁即时生效）。

## 域名 → 层 映射

| 域名 | 探测判据 | 落点与内容 |
|---|---|---|
| UE | 目录树里有 `*.uproject` | 项目层写 `unreal-*` `ue-*` `ue5-*` + 9 个无前缀：`create-editor-plugin` `create-toolset` `plugin-documenter` `read-uasset` `graphics-debug` `renderdoc-gpu-debug` |
| .NET | `*.sln` / `*.csproj` | 项目层写 Blazor/MAUI/Web 27 枚 + rider 三件套（`debugging-code` `refactoring-code` `finding-tests`）。构建/MSBuild 18、测试与质量 25、技能开发 4、杂项 4 已在个人层，并集覆盖，**不要重复列举** |
| REA | REA 仓库（`package.json` + `src/native` + `server.json`） | `<rea>/.dsh/skill-filter.yaml` 写 5 枚：`open-apk` `rea-changelog-update` `rea-tool-design` `reverse-engineer-anything` `wakaru` |
| 本机运维 | 无代码判据，按技能归属 | `ps-tool` 层：`modelscope-daily`；`System` 层：`fcitx-voice-input` `obs-studio-locale-cwd-fix` `local-git-archive-server` `win-install-vs2022-ue` |
| Blender | `dsh-skill-blender-modeling` 仓库 | 该项目层写 `blender-modeling` |
| 项目专属 | 技能目录就在某项目的 `.dsh/skills/` 下 | **什么都不写**——过滤器对 project-dsh / project-agents 源放行 |

## 当前各层现状（2026-11-02）

| 层 | 条数 | 说明 |
|---|---|---|
| 个人层 | 167 | mattpocock 37 + obra 14 + self-dsh 44 + ponytail 6 + find-work 2 + 本机运维/媒体 10 + .NET 测试 25 + 技能开发 4 + 杂项 4 + 构建 18 + 其他 |
| MyAI | 6 | `unreal-*` + REA 5 枚 |
| YellowRiverSluice | 12 | UE 域名 + `scanned-doc-ocr-extraction` `find-work` `update-all` |
| PsShowcaseWeb | 30 | .NET 工作区（无 git，本地文件） |
| XianXiaVS / HydroVault2 / PsShowcase / PicoDamMR / XianXia | 9–27 | UE 域名 |
| ps-tool | 45 | 含 `*`——仍看到全部技能 |
| System | 5 | 含 `*`——仍看到全部技能 |
| find-work / 法律 | 41 / 150 | 含 `*`——仍看到全部技能 |

## 操作步骤

1. **定项目根**：从 cwd 向上找 `.git` / `.uproject` / `.sln`；找不到就认为没有项目层，技能只能进个人层。
2. **读旧层**：`cat <项目根>/.dsh/skill-filter.yaml`；不存在就新建，文件头写清语义注释（并集、不替换、项目自带技能放行）。
3. **探测域名**：按上表判据，一个工作区可命中多个域（如 MyAI = UE + REA）。
4. **合并写盘**：把该域名的技能并进 `allow:`，去重、按字母序；用通配符收拢整族（`unreal-*` 而非 41 个 explicit）。
5. **验证**：用 `~/.dsh/skills/<name>` 是否存在确认技能已安装；不确定时写个临时 tsx 脚本 import `packages/skill/skill-filter/src/filter.ts` + `src/config.ts`，逐 cwd 统计可见数。
6. **提交**：git 仓库就提交并推送；`XianXiaVS`（`.gitignore` 第 2 行是 `*`）、`System`、`PsShowcaseWeb` 不是可提交的落点，只落本地。

## 禁令

- **不写 `allow: ["*"]`**——它让整层变成空操作，工作区等于看到全部技能，整套管理器在该工作区形同不存在。发现别人写了就换成显式清单。
- **不列举项目自带技能**（`.dsh/skills` 下的）——过滤器已放行，列了反而是噪声。
- **迁移/现代化 20 枚与崩溃/性能诊断 5 枚默认不开**：触发词过密（`migrate`、`template`）会抢路由。用户点名再开。
- **不往个人层塞域名技能**——个人层只放"任何项目都该有"的；域名技能一律进项目层。
- **不删用户已安装的技能**来"清理"目录——收窄靠改层，不靠删软链。失效软链（目标 SKILL.md 不存在）才可以删。
