---
name: fix-feature-issues
description: 修复测试中发现的问题/用户反馈："修复问题"/"修bug"/"处理反馈"。读取反馈文档与 UnrealCli 日志，运行 diagnose + systematic-debugging。
---

# Fix Feature Issues

诊断并修复用户测试中发现的问题。

## 流程

### Step 1: 获取问题清单
- 读取 `Docs/当前反馈问题.md` — 获取用户反馈的问题列表
- 读取由 UnrealCli 生成的最新日志报告

### Step 2: 诊断
对每个问题加载 `diagnose` — 复现 → 缩小范围 → 假设 → 验证。

### Step 3: 修复
对已诊断的问题加载 `systematic-debugging` — 定位根因 → 修复 → 验证。

## 出口
所有已知问题已修复，等待下一轮用户测试验证。
