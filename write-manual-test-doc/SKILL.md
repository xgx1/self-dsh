---
name: write-manual-test-doc
description: 'Create manual test documentation for QA/developers. Triggers: "写测试文档", "人工测试文档", "QA测试指南". Produces Obsidian doc: test features, procedures, expected results.'
---

# Write Manual Test Doc

编写人工测试文档，告知开发者测试范围和流程。

## 流程

### Step 1: 加载文档规范
加载 `dev-docs`（Docs/ 排版与结构规范）。

### Step 2: 编写测试文档
文档内容必须包含：
- **测试功能清单** — 有哪些功能需要人工测试
- **测试流程** — 每个功能的操作步骤（按顺序）
- **预期结果** — 每一步应该看到什么
- **注意事项** — 前置条件、环境要求、已知限制

## 出口
人工测试文档已生成，开发者可按文档执行测试。
