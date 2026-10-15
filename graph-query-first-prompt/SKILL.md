---
name: graph-query-first-prompt
description: "用 codebase-memory-mcp 知识图谱优先查询的分析提示词模板——符号定位、影响面、调用链、环路检测；仅在图查不到/字面量/需原始统计时回退 grep/glob。用户要求\"通过查图进行\"时使用。"
---

# 查图优先提示词模板

用户要求"查图进行"/"通过知识图谱分析"时，给完整可粘贴模板（填空 `<项目>` `<目标>`）：

```text
任务：分析 <目标>（例如：XX 系统的架构 / 改动 XX 函数的影响面 / XX 的完整调用链）

方法：以知识图谱（codebase-memory-mcp）查询为主。默认禁止 grep/glob 全文搜索。

【第一步 · 索引就绪】
- index_status 确认 <项目> 已索引；未索引 → index_repository 后再继续。

【第二步 · 符号定位】
- search_graph（query 模式）查目标符号的精确 qualified_name。
- 名字不确定 → search_code 做图增强搜索，让图去重并定位到所在函数。

【第三步 · 结构理解】
- get_architecture 先看全局：clusters（Leiden 聚类）判断模块边界与聚合中心。
- get_code_snippet 读关键符号源码——必须先拿到 qualified_name 再读（只读工具不是搜索工具）。

【第四步 · 关系追踪】
- 影响面 / 调用链 → trace_path（mode=calls），先 callers 后 callees，逐跳记录证据链。
- 数据怎么流 → trace_path（mode=data_flow），记录每跳的参数。
- 跨服务 / HTTP 路由 → trace_path（mode=cross_service）。
- 找环 / 多跳聚合 / 统计 → query_graph 写 Cypher（例：
  MATCH (a)-[:CALLS*1..3]->(b) WHERE b.name = '<目标>' RETURN a.name, count(*)）

【第五步 · 验证收尾】
- query_graph 做聚合核验（入度 top、环检测），结论附证据路径：谁 → 谁 → 谁。

【回退规则 · 仅限以下情况才允许 grep/glob】
1. 图查不到（未索引 / 新文件 / 符号太新）→ 文本搜索补充，结论标注"图未覆盖"。
2. 字面量、字符串、配置值 → grep 直查（图不索引这些）。
3. 需要原始计数 / 自定义统计 → 先说明图模型为何不够，再自写扫描脚本。
```

## 判据（何时倾向图 vs 文本）

- **问"关系"**（谁调谁、影响面、环路、跨服务）→ 图：search_graph / trace_path / query_graph
- **问"文本"**（文件名存在性、字面量、配置值、原始计数）→ glob / grep / 自写脚本
- 图索引是快照：当日新增文件/新符号需重跑 index_repository 才在图里（本机 oh-my-pi 索引 112,421 节点 / 447,892 边，16 秒建成，项目 id 为路径转义形式如 `I-Project-Other-oh-my-pi`）
- 工具调用前先 list_projects 确认项目 id，再 index_status

## 相关背景（2026-08-09 本机实测）

- 用户目的通常是省 token：图查询去重、按结构重要度排序，比 grep 整行命中进上下文省得多
- 模块级 import 权重统计类任务图模型不够（函数/类级节点），自写扫描脚本（0.4s 级）更准
