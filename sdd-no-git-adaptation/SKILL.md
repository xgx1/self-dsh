---
name: sdd-no-git-adaptation
description: 非 git 仓库环境执行 subagent-driven-development（SDD）的适配流程：sdd-workspace/task-brief/review-package 脚本全依赖 git 会挂，需手工提取 brief、reviewer 直接读文件核对、ledger 手工维护
---

# SDD 无 git 环境适配

> **平台约定**：本机主力环境是 Linux（Arch）——命令以 bash 为先、可直接执行；Windows 专属步骤一律收进「Windows（PowerShell）」小节，不在 Linux 段落里混用。

当工作目录不是 git 仓库（git status 报 fatal）时，superpowers:subagent-driven-development 的脚本全部不可用，按此适配：

## 前置检查
- `git status` 报 `fatal: not a git repository` → 适配模式
- 计划/全局约束若已写明"不执行 git 命令"，不要 git init（遵守约束，且 init 改变目录状态需用户同意）

## 不可用的脚本与替代
| 脚本 | 失败原因 | 替代 |
|---|---|---|
| `sdd-workspace` | 依赖 git | 手工 `mkdir -p .superpowers/sdd/<plan-basename>/` |
| `task-brief` | 依赖 git | 手工从计划文件提取任务全文写 brief（write 后必须 ls 验证落盘——write 曾静默失败） |
| `review-package` | 依赖 git diff/log | 无 diff 文件。reviewer 直接读产出文件与 brief 逐字比对 |

## 适配流程（其余照 SDD 标准）
1. ledger：手工建 `.superpowers/sdd/<plan>/progress.md`，首行 `# SDD ledger — plan: <plan path>`
2. 每个任务：brief 文件（含完整代码/命令）→ 派 implementer（照抄 brief 代码）→ implementer 写报告文件 → 派 reviewer（给 brief 路径 + 产出文件路径，验收标准列在 context；不重跑 implementer 已跑的 build/test）→ fix loop（同 agent 或新 agent）→ ledger 记 `Task N: complete (review clean, K minor deferred: ...)`
3. Minor 发现记 ledger 不阻塞；最终全分支审查时把 deferred minors 清单交给 reviewer 裁定
4. fix wave：一次 dispatch 全部 findings；scoped re-review 核对 ADDRESSED + 无新破坏
5. BASE/HEAD 概念不存在：fix round 对比用"上一轮 review 时的文件状态"，re-review 只查 fix 范围 + 抽查功能代码未被改动

## 收尾差异
- 无 git commit/history：**不要删除 .superpowers/ 工作区**（无 git 备份，ledger/report 是唯一记录，保留并向用户说明）
- 无 finishing-a-development-branch 可执行（无分支）；交付总结替代

## 已知坑（本环境实测）
- write 工具静默失败（返回成功但未落盘，发生 2 次）→ 关键文件 write 后必须 bash ls 验证
- reviewer 的 glob 默认不匹配隐藏目录（.superpowers）→ brief 路径直接给全路径，或让 reviewer 用 read
- Vite 8.2.1 新模板：无 public/vite.svg（是 icons/favicon.svg）；dev server 监听 IPv6 [::1]:5173

### Linux（bash）

- npm 命令直接写 `npm`（本机 Arch 上是 `/usr/bin/npm`，没有 `.cmd` 包装器）：`npm run dev`、`npx vite`。

### Windows（PowerShell）

- npm 命令需 npm.cmd（PowerShell）——Windows 上 `.cmd` 才是可执行入口，直接调 `npm` 可能解析失败。
