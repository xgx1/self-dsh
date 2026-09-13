---
name: tdd-write-feature
description: 'TDD 编写：红-绿-重构 test-first。Runs test-driven-development, cleans up outdated tests. Triggers: TDD编写, 先写测试再写代码.'
---

# TDD Write Feature

红-绿-重构循环驱动代码编写，完成后清理过时测试。

## 流程

### Step 1: TDD 循环
加载 `test-driven-development` — 红（写失败测试）→ 绿（最小实现）→ 重构。

### Step 2: 清理过时测试
扫描测试文件，**删除过时的测试用例**：
- 测试已删除的功能
- 测试已重构掉的代码路径
- 与其他测试重复且无增量价值的用例

## 出口
新代码由测试驱动完成，测试套件干净无冗余。
