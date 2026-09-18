# SDD 无 git 环境适配

> 工作目录不是 git 仓库时，让 `superpowers:subagent-driven-development`（SDD）绕过那些依赖 git 的脚本，把 implementer / reviewer 的流程继续跑完。

## 什么时候用

- `git status` 报 `fatal: not a git repository`，但仍要走 SDD 的派发流程
- 计划或全局约束已写明「不执行 git 命令」——此时**不要** `git init`（遵守约束；init 会改变目录状态，需要用户同意）

## 前置条件

- 已加载 `superpowers:subagent-driven-development`
- 已确认目录确实不是 git 仓库

## 不可用的脚本与替代

| 脚本 | 失败原因 | 替代做法 |
|---|---|---|
| `sdd-workspace` | 依赖 git | 手工建目录：`mkdir -p .superpowers/sdd/<plan-basename>/` |
| `task-brief` | 依赖 git | 手工从计划文件提取任务全文写 brief（write 后必须 `ls` 验证落盘——write 曾静默失败） |
| `review-package` | 依赖 git diff/log | 没有 diff 文件；reviewer 直接读产出文件与 brief 逐字比对 |

## 适配流程（其余照 SDD 标准）

1. **ledger**：手工建 `.superpowers/sdd/<plan>/progress.md`，首行写 `# SDD ledger — plan: <plan path>`
2. **每个任务**：brief 文件（含完整代码/命令）→ 派 implementer（照抄 brief 代码）→ implementer 写报告文件 → 派 reviewer（给 brief 路径 + 产出文件路径，验收标准列在 context；不重跑 implementer 已跑的 build/test）→ fix loop（同 agent 或新 agent）→ ledger 记 `Task N: complete (review clean, K minor deferred: ...)`
3. **Minor 发现**记 ledger 不阻塞；最终全分支审查时把 deferred minors 清单交给 reviewer 裁定
4. **fix wave**：一次 dispatch 全部 findings；scoped re-review 核对 ADDRESSED + 无新破坏
5. **BASE/HEAD 概念不存在**：fix round 对比用「上一轮 review 时的文件状态」，re-review 只查 fix 范围 + 抽查功能代码未被改动

## 收尾差异

- 无 git commit/history：**不要删除 `.superpowers/` 工作区**（没有 git 备份，ledger/report 是唯一记录，保留并向用户说明）
- 无 `finishing-a-development-branch` 可执行（没有分支）；用交付总结替代

## 注意事项 / 已知坑

- **write 工具静默失败**（返回成功但没落盘，本环境实测发生 2 次）→ 关键文件 write 后必须用 bash `ls` 验证
- reviewer 的 glob 默认不匹配隐藏目录（`.superpowers`）→ brief 路径直接给全路径，或让 reviewer 用 read
- Vite 8.2.1 新模板：没有 `public/vite.svg`（是 `icons/favicon.svg`）；dev server 监听 IPv6 `[::1]:5173`

### Linux（bash）

npm 命令直接写 `npm`（本机 Arch 上是 `/usr/bin/npm`，没有 `.cmd` 包装器）：`npm run dev`、`npx vite`。

### Windows（PowerShell）

npm 命令需 `npm.cmd`（PowerShell）——Windows 上 `.cmd` 才是可执行入口，直接调 `npm` 可能解析失败。
