---
name: compile-feature
description: 'Compile project after code changes (编译/构建/build): runs unrealcli dev complic, fixes all compilation errors and warnings.'
---

# Compile Feature

编译项目，零错误零警告硬门槛。

## 流程

### Step 1: 编译
运行 `unrealcli dev complic` — 编译 Unreal 项目。

### Step 2: 修复
**有编译错误或警告 → 全部修复 → 重新编译。** 循环直到零错误零警告。

## 出口
编译通过，零错误零警告。
