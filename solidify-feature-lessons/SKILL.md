---
name: solidify-feature-lessons
description: Use when completing a feature or user says 记录经验/固化知识/更新AGENTS. Persists lessons to memory, solidifies techniques as skills, updates AGENTS.md.
---

# Solidify Feature Lessons

将开发过程中积累的经验教训固化到长期记忆和技能系统中。

## 流程

### Step 1: 记录到长期记忆
通过 `learn` 将本次开发中学到的关键经验记录到长期记忆（`learn` 工具）。

### Step 2: 固化可复用技巧
将可复用的技巧通过 `manage_skill` 固化为 managed skill（`~/.omp/agent/managed-skills/`）。

### Step 3: 更新项目 AGENTS.md
项目级更新写入项目 `AGENTS.md`：
- UE 客户端 → `<Project>/AGENTS.md`
- .NET 后端 → `<ProjectServer>/AGENTS.md`

### Step 4: 更新用户 AGENTS.md
全局更新写入用户 `AGENTS.md`（`~/.omp/agent/AGENTS.md`）。

### Step 5: 自更新（如有优化）
如果本次开发中发现本工作流有优化空间 → 同步更新 `add-software-feature` 技能及相关子技能。

## 出口
所有经验教训已固化到对应位置。
