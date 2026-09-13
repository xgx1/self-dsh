---
name: tdd-test-feature
description: Use when running tests after code changes or user says 跑测试/TDD测试/验证测试. Runs test-driven-development suite, cleans up outdated test cases.
---

# TDD Test Feature

运行全部测试，确保通过，清理过时用例。

## 流程

### Step 1: 运行测试
加载 `test-driven-development` — 执行全部测试套件。

### Step 2: 清理过时测试
扫描测试文件，**删除过时的测试用例**。

### Step 3: 确认通过
所有测试必须通过。有失败 → 修复 → 重新运行。

## 出口
全部测试通过，测试套件干净。
