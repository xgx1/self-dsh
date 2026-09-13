---
name: feature-inventory-docs-first
description: 功能盘点→行为文档→新功能设计→审核→计划的文档先行工作流
---

# Feature Inventory + Docs-First Workflow

When user asks to "survey existing features, write docs, then decide what to build":

## Phase 1: 摸底
- 并行派 scout agent 摸客户端/Server/资产现状
- 产出功能盘点（已实现 vs 未实现/缺口清单）

## Phase 2: 规范先行
- 写《功能文档编写规范》让用户确认（写作 用 `dev-docs` 排版、`writing-functional-docs` 内容流程）

## Phase 3: 现状行为文档
- 按规范分批写行为说明书（操作/条件/效果/边界/数值/状态字段，禁 API）
- 深层缺口审计 → 输出缺陷台账

## Phase 4: 选功能
- 从缺口清单选本次开发包

## Phase 5: 新功能设计文档
- 对选中的新功能写前向设计文档（标注「待实现」）
- 区别于现状文档：写目标行为而非当前行为

## Phase 6: 审阅 + 定计划
- 用户审阅设计文档 → 定稿实施计划 → 进入 add-software-feature 开发流程
