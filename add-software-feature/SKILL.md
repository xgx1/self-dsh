---
name: add-software-feature
description: Add software feature / "add X feature" "implement Y" "create Z module". 17-phase dev workflow for UE5 + .NET. 大型功能（跨子系统/5+文件/新系统）编排；中小改动轻量流。
---

# Add Software Feature

完整的新功能开发工作流，覆盖从需求到交付的全生命周期。

## 总览

17 个阶段，每个阶段有明确的入口条件、执行步骤、出口条件。阶段间有用户审核门禁（标 ⏸️ 的必须等用户确认后才能继续）。

```
初始化 → 功能文档 ⏸️ → 制定计划 ⏸️ → TDD编写 → 执行 → 编译 → TDD测试 → 审查
→ 极简优化 → 再次TDD测试 → 再次审查 → 人工测试文档 → 修复问题 → 更新测试文档 ⏸️
→ [用户测试 → 修复 → 更新文档] 循环 ⏸️ → 记录固化 → 生成总结
```

## 阶段流程

### 阶段 1: 初始化

**入口:** 用户描述需求，准备开始开发。

**执行:** 加载 `init-feature-dev` — 建立技能基础 → 配置工程基础设施 → 需求澄清。

**出口:** 需求方向清晰，用户意图明确。

---

### 阶段 2: 编写功能文档 ⏸️

**入口:** 初始化完成，需求方向明确。

**执行:** 加载 `writing-functional-docs` — 按「规范先行→行为挖掘→缺陷排队」方法论产出功能文档内容；同时加载 `dev-docs` 提供 Obsidian 排版格式。

**出口: 等待用户审核。** 用户告知"通过"则进入下一阶段；有遗漏则用户告知修正内容，修正后再次等待审核。

---

### 阶段 3: 制定计划 ⏸️

**入口:** 功能文档审核通过。

**执行:** 加载 `make-feature-plan` — 生成计划 → 审查循环直到清晰。

**出口: 计划彻底清晰明确，用户确认。**

---

### 阶段 4: TDD 编写

**入口:** 计划确认。

**执行:** 加载 `tdd-write-feature` — 红-绿-重构循环 + 清理过时测试。

**出口:** 测试先行，代码通过测试。

---

### 阶段 5: 执行

**入口:** TDD 编写完成。

**执行:** 加载 `execute-feature-plan` — **自动使用 subagent-driven-development 并行执行，不询问用户选择执行方式。** 若 plan 内任务有严格先后依赖则顺序执行，否则并行派发。

**出口:** 所有代码实现完成。

---

### 阶段 6: 编译

**入口:** 代码实现完成。

**执行:** 加载 `compile-feature` — 运行 unrealcli dev complic，修复所有错误警告直到零错误零警告。

**出口:** 编译零错误零警告。

---

### 阶段 7: TDD 测试

**入口:** 编译通过。

**执行:** 加载 `tdd-test-feature` — 运行全部测试 + 清理过时用例。

**出口:** 全部测试通过。

---

### 阶段 8: 审查

**入口:** 全部测试通过。

**执行:** 加载 `review-feature-code` — Standards + Spec 双轴审查。

**出口:** 审查完成，问题已修复或已记录。

---

### 阶段 9: 极简优化

**入口:** 代码审查完成。

**执行:** 加载 `optimize-feature-code` — ponytail → ponytail-debt → ponytail-review。

**出口:** 代码最简、技术债务已记录。

---

### 阶段 10: 再次 TDD 测试

**入口:** 极简优化完成（代码可能被修改）。

**执行:** 加载 `tdd-test-feature` — 运行全部测试 + 清理过时用例。

**出口:** 优化后全部测试仍通过。

---

### 阶段 11: 再次审查

**入口:** 优化后测试通过。

**执行:** 加载 `review-feature-code` — 对优化后的代码进行最终审查。

**出口:** 审查通过。

---

### 阶段 12: 编写人工测试文档

**入口:** 最终审查通过。

**执行:** 加载 `write-manual-test-doc` — 编写测试功能清单、测试流程、预期结果。

**出口:** 人工测试文档已生成。

---

### 阶段 13: 修复问题

**入口:** 人工测试文档已生成，等待用户反馈。

**执行:** 加载 `fix-feature-issues` — 读取反馈文档 + 日志 → diagnose → systematic-debugging。

**出口:** 所有已知问题已修复。

---

### 阶段 14: 更新人工测试文档

**入口:** 问题已修复。

**执行:** 加载 `update-manual-test-doc` — 更新修复清单、重新测试清单、变更流程。

**出口:** 人工测试文档已更新。

---

### 阶段 15: 用户测试循环 ⏸️

**入口:** 人工测试文档已更新。

**循环逻辑:**
```
┌─ 用户测试 ─→ 发现新问题？
│                │
│    ┌─ 是 ──→ 阶段 13（修复问题）
│    │           ↓
│    │         阶段 14（更新测试文档）
│    │           ↓
│    └──────── 回到用户测试
│
└── 否 ──→ 用户确认：所有问题已修复
              ↓
           进入阶段 16
```

**出口: 用户明确告知"所有问题已经修复"。**

---

### 阶段 16: 记录固化

**入口:** 用户确认所有问题已修复。

**执行:** 加载 `solidify-feature-lessons` — learn → manage_skill → 更新 AGENTS.md。

**出口:** 所有经验教训已固化。

---

### 阶段 17: 生成总结

**入口:** 记录固化完成。

**执行:** 加载 `summarize-feature-work` — 编写做了什么/改了什么/生成了什么/学到了什么。

**出口:** 总结文档已生成。整个开发流程完成。

## 快速参考

| 阶段 | 调用技能 | 用户门禁 |
|------|----------|----------|
| 初始化 | `init-feature-dev` | 无 |
| 功能文档 | `writing-functional-docs` + `dev-docs` | ⏸️ 审核 |
| 制定计划 | `make-feature-plan` | ⏸️ 审核 |
| TDD编写 | `tdd-write-feature` | 无 |
| 执行 | `execute-feature-plan` | 无 |
| 编译 | `compile-feature` | 无 |
| TDD测试 | `tdd-test-feature` | 无 |
| 审查 | `review-feature-code` | 无 |
| 极简优化 | `optimize-feature-code` | 无 |
| 再次TDD测试 | `tdd-test-feature` | 无 |
| 再次审查 | `review-feature-code` | 无 |
| 人工测试文档 | `write-manual-test-doc` | 无 |
| 修复问题 | `fix-feature-issues` | 无 |
| 更新测试文档 | `update-manual-test-doc` | 无 |
| 用户测试循环 | 阶段13-14 循环 | ⏸️ 确认 |
| 记录固化 | `solidify-feature-lessons` | 无 |
| 生成总结 | `summarize-feature-work` | 无 |

## 完整子技能清单

14 个子技能，覆盖所有 17 个阶段，每个均可独立调用：

| 子技能 | 覆盖阶段 | 触发条件 |
|--------|----------|----------|
| `init-feature-dev` | 阶段 1 | 初始化开发环境 |
| `make-feature-plan` | 阶段 3 | 制定实现计划 |
| `tdd-write-feature` | 阶段 4 | TDD 编写代码 |
| `execute-feature-plan` | 阶段 5 | 并行执行计划 |
| `compile-feature` | 阶段 6 | 编译项目 |
| `tdd-test-feature` | 阶段 7, 10 | 运行测试+清理 |
| `review-feature-code` | 阶段 8, 11 | 代码审查 |
| `optimize-feature-code` | 阶段 9 | 极简优化 |
| `write-manual-test-doc` | 阶段 12 | 编写测试文档 |
| `fix-feature-issues` | 阶段 13 | 修复问题 |
| `update-manual-test-doc` | 阶段 14 | 更新测试文档 |
| `solidify-feature-lessons` | 阶段 16 | 固化经验 |
| `summarize-feature-work` | 阶段 17 | 生成总结 |

## 常见错误

| 错误 | 正确做法 |
|------|----------|
| 跳过初始化直接写代码 | 初始化厘清需求方向，避免返工 |
| 功能文档跳过用户审核 | ⏸️ 标记的阶段必须等用户确认 |
| 计划不够清晰就执行 | 审查循环必须跑到用户说"清晰" |
| 阶段 5 询问用户选 subagent 还是 inline | **直接使用 subagent-driven-development，不询问** |
| 编译有警告不修复 | 零错误零警告是硬门槛 |
| 优化后不重新测试 | 每次代码变更后必须跑测试 |
| 用户测试循环中跳过文档更新 | 每次修复后必须更新人工测试文档 |
| 不固化经验就结束 | 阶段16是强制步骤 |
