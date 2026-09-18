# 固化功能经验

> 功能收尾时，把这次开发踩过的坑和验证过的做法写进长期记忆、技能库与 AGENTS.md，让下一次开发直接受益。

**技能名**：`solidify-feature-lessons` · 目录内只有 `SKILL.md`

## 什么时候用

- 一个功能开发完成、准备收尾时
- 用户说「记录经验」「固化知识」「更新 AGENTS」
- 本次开发有反复踩的坑，或摸索出值得复用的技巧

## 怎么用

本技能不含命令，靠触发后按 SKILL.md 的 5 步执行。每一步落到不同位置，别写错层：

| 步骤 | 做什么 | 落到哪里 |
| --- | --- | --- |
| 一 | 记录本次关键经验到长期记忆 | `learn` 工具 |
| 二 | 把可复用技巧固化成 managed skill | `manage_skill` → `~/.omp/agent/managed-skills/` |
| 三 | 写项目级经验 | UE 客户端 → `<Project>/AGENTS.md`；.NET 后端 → `<ProjectServer>/AGENTS.md` |
| 四 | 写全局经验 | 用户 `AGENTS.md`（`~/.omp/agent/AGENTS.md`） |
| 五 | 工作流本身有优化空间时自更新 | `add-software-feature` 技能及其子技能 |

出口：所有经验教训已固化到对应位置。

## 前置条件

- `learn`、`manage_skill` 两个工具可用（Step 1、Step 2 依赖它们）
- 已确认本次功能属于哪个项目，才能选对 Step 3 写哪份 AGENTS.md
- Step 5 需要 `add-software-feature` 技能已安装

## 注意事项 / 已知坑

- **落地路径与当前 harness 不一致**：SKILL.md 写的 `~/.omp/agent/...` 是旧 harness 布局，而本仓库技能实际由 `dsh-extensions/install-skill.sh` 软链进 `~/.dsh/skills/`（见 `self-dsh/README.md`）。执行前先确认这些路径在当前环境是否存在，不存在就按当前 harness 的等价位置写，别照抄一个跑不通的路径。
- Step 3 按项目类型分叉（UE 客户端 / .NET 后端），不要两份都写同一处。
- Step 5 是「如有优化」的条件步骤：没有工作流层面的改进就跳过，不必强行产出。
- 本技能只固化经验，不修改业务代码。
- 详细步骤见 SKILL.md。
