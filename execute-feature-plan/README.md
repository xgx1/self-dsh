# 并行执行实现计划（execute-feature-plan）

> 手上已有写好的实现计划要落地成代码时用它：自动把独立任务分发给多个 subagent 并行执行。

## 什么时候用

- 已有实现计划（含 TODO 清单），现在要开始写代码
- 触发词：**执行计划**、**开始实现**、**并行执行**
- 不适用：计划还没写 → 先用 `make-feature-plan`

## 怎么用

本技能没有命令行，触发方式是「加载技能 → agent 按流程执行」：

1. 计划就绪后提出执行（或直接加载本技能）。
2. 技能加载 `subagent-driven-development`，由它把**独立任务**分发到多个 subagent 并行执行。
3. **关键约束：不再询问用户选择执行方式**——直接走 subagent-driven-development。

> SKILL.md 原文（全文只有「流程」与「出口」两节）：
> 「加载 `subagent-driven-development` — 自动将独立任务分发到多个 subagent 并行执行。」

## 出口

所有任务 agent 执行完成，代码已实现。

## 前置条件

- 一份可执行的实现计划
- 已安装 `subagent-driven-development` 技能（本机已装）

## 注意事项 / 已知坑

- 技能本身不含命令、脚本、参数；并行度与任务拆分规则全部由 `subagent-driven-development` 决定。
- 出口只覆盖「代码已实现」，**不含**测试与代码审查——需要时再触发 `tdd-test-feature` / `review-feature-code`。
- SKILL.md 仅 17 行，信息量有限；详细执行步骤见 SKILL.md（本目录）与 `subagent-driven-development` 的技能文件。
