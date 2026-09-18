# add-software-feature —— 新功能开发全流程编排

> 把「从需求到交付」拆成 17 个阶段、14 个子技能的编排表，专治大型功能开发漏步骤。

## 什么时候用

- **大型功能**（跨子系统 / 5+ 文件 / 全新系统）走完整 17 阶段流程。
- 触发方式：用户说「加 X 功能」「实现 Y」「创建 Z 模块」，或直接点名本技能。
- 中小改动走轻量流，不必套满 17 阶段。

## 怎么用

本技能自己不写代码，**按阶段加载对应的子技能**，阶段间有强制用户审核门禁（⏸️）：

```
初始化 → 功能文档 ⏸️ → 制定计划 ⏸️ → TDD编写 → 执行 → 编译 → TDD测试 → 审查
→ 极简优化 → 再次TDD测试 → 再次审查 → 人工测试文档 → 修复问题 → 更新测试文档 ⏸️
→ [用户测试 → 修复 → 更新文档] 循环 ⏸️ → 记录固化 → 生成总结
```

阶段与子技能对应（完整表见 SKILL.md「快速参考」）：

| 阶段 | 加载技能 |
|---|---|
| 初始化 | `init-feature-dev` |
| 功能文档 ⏸️ | `writing-functional-docs` + `dev-docs` |
| 制定计划 ⏸️ | `make-feature-plan` |
| TDD 编写 | `tdd-write-feature` |
| 执行 | `execute-feature-plan` |
| 编译 | `compile-feature` |
| TDD 测试 / 再次测试 | `tdd-test-feature` |
| 审查 / 再次审查 | `review-feature-code` |
| 极简优化 | `optimize-feature-code` |
| 人工测试文档 | `write-manual-test-doc` |
| 修复问题 | `fix-feature-issues` |
| 更新测试文档 | `update-manual-test-doc` |
| 记录固化 | `solidify-feature-lessons` |
| 生成总结 | `summarize-feature-work` |

用户测试循环（阶段 15）：用户测试 → 有 新问题则回到阶段 13（修复）→ 阶段 14（更新文档）→ 再回到用户测试；用户确认「所有问题已经修复」才进入阶段 16。

## 前置条件

- 上表 14 个子技能需在本机可用（阶段跳转靠技能名加载）。
- 阶段 6 编译针对 Unreal 项目（`compile-feature` 调 `unrealcli dev complic`）。
- 阶段 5 依赖 subagent 并行执行能力（`subagent-driven-development`）。

## 注意事项 / 已知坑

- ⏸️ 标记的阶段**必须等用户确认**：功能文档与计划未过审不准动代码；有遗漏则修正后再次等审核。
- 阶段 5 **直接使用 subagent-driven-development，不要询问用户选 subagent 还是 inline**；plan 内有严格先后依赖则顺序执行，否则并行派发。
- 编译零错误**零警告**是硬门槛，有警告也要修。
- 每次代码变更（含阶段 9 极简优化）后必须重跑测试。
- 用户测试循环中每次修复后必须更新人工测试文档，不得跳过。
- 阶段 16 记录固化是强制步骤，不固化不算结束。
- 不要跳过初始化直接写代码——避免需求方向没厘清导致返工。
