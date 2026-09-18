# 新功能开发环境初始化（init-feature-dev）

> 开一个新功能开发会话前先跑它：建立技能基础、配好工程基础设施（issue tracker / triage 标签 / 领域文档），再把需求方向问清楚。

## 什么时候用

- 用户说：**初始化开发环境**、**开始新功能开发**
- 一个仓库第一次进入「需求 → 实现」流程，工程基础设施还没配
- 不适用：只想澄清需求、不碰工程配置 → 直接 `brainstorming`

## 操作流程（四步，顺序固定）

### Step 1：建立技能基础

加载 `using-superpowers` —— 确定如何使用技能系统。

### Step 2：配置工程基础设施

加载 `setup-matt-pocock-skills`，执行其中「应当执行的部分」：

- 探索当前仓库状态
- **呈现发现并询问用户**
- 确认后写入配置
- 覆盖三项：**Issue tracker**、**Triage labels**、**Domain docs**

### Step 3：首轮需求澄清

加载 `brainstorming` —— 按用户输入做需求探索、方案构思。

### Step 4：第二轮深度询问

brainstorming 流程结束后加载 `grill-with-docs` —— 对方案做深度审视，并创建 **ADR** 和**术语表**。

## 出口

需求方向清晰、用户意图明确、工程基础设施就绪。

## 前置条件

- 已安装：`using-superpowers`、`setup-matt-pocock-skills`、`brainstorming`、`grill-with-docs`（本机均已装）
- 在一个 git 仓库里操作（Step 2 要写 issue tracker 与领域文档配置）
- 用户在场：Step 2 要展示发现并等确认，Step 3 / Step 4 都是交互式追问

## 注意事项 / 已知坑

- Step 2 **必须先呈现发现再写配置**，不能探索完直接落盘。
- Step 4 是 Step 3 的**续接**而非替代——brainstorming 跑完才进 grill。
- 本技能不含命令与文件路径；配置写入的具体内容由 `setup-matt-pocock-skills` 决定。SKILL.md 仅 29 行（四步骨架），**详细步骤见 SKILL.md**。
