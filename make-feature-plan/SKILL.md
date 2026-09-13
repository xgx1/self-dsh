---
name: make-feature-plan
description: 创建实现计划、生成 TODO 清单："制定计划"/"生成实现方案"/"做TODO清单"。运行 writing-plans、grill-with-docs、brainstorming 迭代至计划清晰。
---

# Make Feature Plan

制定实现计划，通过多轮审查循环确保计划彻底清晰。

## 流程

### Step 1: 生成初始计划
- 加载 `writing-plans` — 生成实现计划
- 生成 TODO 清单（`todo init`）

### Step 2: 审查循环
直到用户确认"计划彻底清晰明确"前，循环执行：

```
┌─ 加载 grill-with-docs — 对计划进行深度询问
│    ↓
│   加载 brainstorming — 第二轮头脑风暴
│    ↓
│   用户审查并反馈
│    ↓
├─ 有模糊点？─→ 回到循环开头
│
└─ 清晰明确？─→ 退出循环
```

## 出口
计划彻底清晰明确，用户确认。TODO 清单已就绪。
