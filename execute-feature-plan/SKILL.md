---
name: execute-feature-plan
description: 'Execute an implementation plan with independent tasks (执行计划/开始实现/并行执行): auto-dispatches subagent-driven-development without asking execution method.'
---

# Execute Feature Plan

多 agent 并行执行实现计划。不询问执行方式，直接使用 subagent-driven-development。

## 流程

加载 `subagent-driven-development` — 自动将独立任务分发到多个 subagent 并行执行。

**关键约束：** 不再询问用户选择执行方式，直接走 subagent-driven-development。

## 出口
所有任务 agent 执行完成，代码已实现。
