---
name: agent-teams-orchestration-pitfalls
description: AgentTeams 多智能体编排工程坑与处置（DSH harness 实证 2026-09）：implementation/repair 任务 inScope 必须尾斜杠目录前缀（glob 被完成校验以 undeclared 拒绝）、被取消依赖卡死的任务只能由 owner 自行取消、队长一次只能接管一个任务、自动生成的 repair 契约可能残缺先查再动、成员静默挂死的有界处置、种子任务立即收编。触发：用 AgentTeams 建团队、任务提交被闸门拒绝、任务卡死无法认领/取消、成员长时间无汇报。
---

# AgentTeams 编排工程坑与处置

多智能体团队（agent_teams_* 工具族）真实交付一个双功能迭代后沉淀的工程坑。每条都是实测踩中过的，不是推测。

## 铁律一：任务 inScope 必须用「尾斜杠目录前缀」

- ✅ `["Server/YellowRiverSluiceServer/", "Server/YellowRiverSluiceServer.Tests/"]`
- ❌ `["Server/**"]`、`["Client/Source/App/**"]`

完成校验（update_task status=completed）的 changedPaths 匹配器**只认精确文件路径或尾斜杠目录前缀**，glob（`**`）不匹配任何路径 → 所有改动文件被判 `xxx is undeclared`，任务**永远无法提交完成**。同一实现文件的 glob inScope 任务会连环踩（一次实测连踩三处：手建任务×2 + 系统自动生成的 repair 契约×1）。

**先例**：取消卡死任务 → 重建同内容任务（尾斜杠 inScope，已完成的改动清单原样写进 description），成员认领后立即提交过闸。

## 铁律二：inScope 重叠互斥与串行化

- 两个**未完成** implementation 任务的 inScope 重叠 → 新任务创建被拒："inScope overlaps …; serialize these tasks or split the paths"。
- 出路：给新任务加**依赖**（serialize）即可创建成功——运行时认可「依赖=串行」这条出路（实测：同 scope 新任务带 deps 指向在办任务后创建成功）。
- 设计任务时就分好目录边界（UE 客户端 vs 服务端；同端内按「谁先动树谁先跑」串行），比事后补救省一轮。

## 铁律三：卡死任务只有 owner 能取消

处置树（按序命中即停）：

1. 任务 pending/claimed 且 assignee 非空 → **队长 update_task(cancelled) 会被拒**（"owned by member … call reassign_task first"）。
2. `reassign_task(assignee="captain")` → 队长**同时只能持有一个**未完结接管（"captain is busy"）。
3. 任务被已取消的依赖卡死 → 队长 reassign 也被拒（"blocked by unfinished dependencies"）——**死局**。
4. **唯一出路**：给 owner（成员）发消息，让成员自己 `update_task(task_id, status="cancelled")`——成员对所有者身份的任务可直接取消（attempt 0 无需 attempt_id）。
5. `assignee=""` 移共享池：reassign_task 不接受空值（报错），此路不通。

衍生纪律：取消僵尸任务时把**标准 output 文案**写给成员照抄（原因 + 由哪个重建任务承接），保持任务史可读。

## 铁律四：队长接管与收编顺序

- 收编成员持有的任务：`reassign_task(assignee="captain")` → `update_task(cancelled)`，一次一个（单接管限制）；下一个任务等上一个已 cancelled 后再 reassign。
- 收编成功 = 成员当前 attempt 被吊销并中断（正在干活的会被打断）——先确认成员空闲或其产出已落盘再收。
- 已完成成员交付的产出在收编前**原样转移**（文件清单/验证结论写进重建任务 description），不丢证据。

## 铁律五：自动生成的 repair 契约可能残缺

needs_revision 后系统自动开 repair + 下一轮 review——但自动契约**可能残缺**（实测：inScope 重复列一个文件、漏列验收明确要求的测试文件；甚至与实际工作树范围失配）。纪律：

- 成员开工 repair 前**先读任务契约的 inScope/acceptance**，与实际改动面对不上就停下上报队长，不要修复完硬提交（闸门拒绝 = 白干一轮）。
- 队长重建残缺契约时，acceptance 必须与**当前工作树实况**对齐（不是与最初设想对齐）——中途指令变化后工作树已回退的部分，验收条目要同步删掉。

## 铁律六：needs_revision 是正常回路，不是失败

- review verdict=needs_revision → review 任务 failed + 自动生成 repair/复审任务（新编号）→ 修复 → 增量复审（只审修复面 + 回归确认）。
- review 的 findings 里 low/非阻塞项**不要顺手修**（会扩大复审面、污染增量审查）；除非用户/队长明确扩大范围。队长中途收窄范围后，验收契约必须同步重建。
- 复审重点：修复逐字落实（对照 requiredFix）、回归确认（测试数恰好 +1 之类）、nonGoals 遵守（被取消方案的残留清查）。

## 铁律七：种子任务与静默挂死

- 团队创建时可能自动生成一个**无契约种子任务**（如 t1）——立即 reassign 收编并取消（其目标已被具体任务 DAG 覆盖），否则会被空闲成员认领后自由发挥。
- 成员 turn 静默挂死（状态 running 但文件 mtime 数小时不动、无编译进程、无汇报）：有界侦查（ps/mtime）→ `interrupt_agent` 中断 → 重启消息（盘点式：盘上已有什么、下一步清单、汇报纪律）。
- **汇报纪律写进派活消息**：每阶段（写码/编译/提交）主动简报；被阻塞时有界等待 ≤2 分钟即上报，禁止静默超时。实测能根治 3 小时静默挂死复发。
- 队长派活与成员状态交错时（消息乱序），要求成员「先查状态再动手」——指令与在途契约冲突时停下报告，不盲动。

## 铁律八：并行开发的设计边界

- 两个成员改同一目录树 → 运行时互斥会强制串行（见铁律二）。任务拆分时就按「文件树不相交」划界：如 UE 客户端 UI vs 服务端 API+页面 天然正交；同端内的先后任务用依赖显式串接。
- 上游任务（API 契约）完成时**必须输出契约**（路径/方法/JSON 形状/错误码）到任务 output——下游成员开工前先读上游 output，不擅自定接口。
- 三路触发汇合点（如多种交卷路径）要求去重证据：调用点清单 + 单一提交入口 + 幂等兜底，写进 acceptance 让 reviewer 有据可审。

## 队长行为清单（汇总）

- [ ] 每个实现/修复任务：inScope 尾斜杠前缀、acceptance 可逐条验证、verify 含退出码要求、明确 outOfScope
- [ ] 交付验收：changedPaths=精确文件路径、commandsRun 记录命令与退出码
- [ ] 成员派活消息含：现状指针（读哪个任务的 output）、锁定决策、验证命令、提交规范、汇报纪律
- [ ] 中途改需求：先改契约/发消息，再等成员按新契约重提交——不默认成员能猜到
- [ ] 审查 low 项不顺带修，保持增量复审面最小
