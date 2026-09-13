---
name: optimize-feature-code
description: 'Optimize code for minimalism / remove over-engineering. Triggers: "优化代码", "极简化", "ponytail优化". Runs ponytail → ponytail-debt → ponytail-review.'
---

# Optimize Feature Code

三阶段极简优化：删除过度工程 → 收集技术债务 → 审查优化结果。

## 流程

### Step 1: 极简化
加载 `ponytail` — 全仓或针对性极简化：
- 删除无用代码、过度抽象
- 用标准库替代自定义实现
- 遵循 YAGNI 原则

### Step 2: 收集技术债务
加载 `ponytail-debt` — 收集所有 `ponytail:` 注释生成技术债务清单。

### Step 3: 过度工程审查
加载 `ponytail-review` — 对优化后的代码进行专门审查，找出遗漏的过度工程。

## 出口
代码最简、技术债务已记录并可见。
