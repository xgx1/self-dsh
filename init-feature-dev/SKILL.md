---
name: init-feature-dev
description: 'Start a new development session (初始化开发环境/开始新功能开发): sets up skills, issue tracker, triage labels, domain docs, then runs brainstorming and grill-with-docs.'
---

# Init Feature Dev

初始化新功能开发环境：建立技能基础、配置工程基础设施、澄清需求方向。

## 流程

### Step 1: 建立技能基础
加载 `using-superpowers` — 确定如何使用技能系统。

### Step 2: 配置工程基础设施
加载 `setup-matt-pocock-skills` — 执行其中"应当执行的部分"：
- 探索当前仓库状态
- 呈现发现并询问用户
- 确认后写入配置
- 涉及: Issue tracker、Triage labels、Domain docs

### Step 3: 首轮需求澄清
加载 `brainstorming` — 按用户输入进行需求探索、方案构思。

### Step 4: 第二轮深度询问
brainstorming 流程结束后，加载 `grill-with-docs` — 对方案进行深度审视、创建 ADR 和术语表。

## 出口
需求方向清晰，用户意图明确，工程基础设施就绪。
