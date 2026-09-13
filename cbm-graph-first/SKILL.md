---
name: cbm-graph-first
description: "代码检索查图优先（graph-first）：找符号/定义、调用方、调用链、影响面、架构总览、复杂度热点、改动前侦察时，先用 codebase-memory MCP（cbm）查知识图谱，grep/glob 只做兜底。触发：在任何代码库里找代码、分析谁调用谁、评估改动影响、看模块边界、引用「图里没有/代码不存在」类负面结论之前，以及用户说「查图 / 用图谱 / 通过知识图谱」。含工具选型、覆盖核验、索引维护与回退判据。"
---

# 查图优先（graph-first）

codebase-memory MCP（工具前缀 `mcp__cbm__`）把代码库索引成知识图谱。查图比文本扫描省 token：命中去重到函数级、按结构重要度排序、关系类问题直接有边可循。**默认顺序：查图 → 覆盖核验 → 文本兜底。**

## 工具选型（先宽后窄）

| 要什么 | 用什么 |
|---|---|
| 自然语言找符号 | `search_graph`（query 模式，BM25 + camelCase 分词 + 结构加权） |
| 精确名字 / 正则 | `search_graph`（name_pattern / qn_pattern / label / file_pattern） |
| 词不匹配、跨词汇桥接 | `search_graph`（semantic_query，必须是关键词**数组**；需 moderate/full 索引） |
| grep 式文本但只要函数级结果 | `search_code`（对比 total_grep_matches 与 total_results 判断去重/截断） |
| 谁调用它 / 它调用谁 | `trace_path`（mode=calls，direction=inbound/outbound） |
| 数据从哪来、到哪去 | `trace_path`（mode=data_flow） |
| 跨服务 / HTTP 路由 | `trace_path`（mode=cross_service） |
| 改动影响面 | `detect_changes`；多跳聚合用 `query_graph` 写 Cypher |
| 架构总览 / 真实模块边界 | `get_architecture`（aspects=["clusters"] 走 Leiden 社区；cycles 仅显式请求） |
| 读源码 | `get_code_snippet`（先 search_graph 拿 qualified_name 再读；它是读工具不是搜索工具） |
| 找环 / 统计 / 热点 | `query_graph`（Cypher；宽查询自己加 LIMIT，100k 行上限） |

热点信号查询示例：`MATCH (f:Function) WHERE f.transitive_loop_depth >= 3 OR f.linear_scan_in_loop >= 1 RETURN f.qualified_name ORDER BY f.transitive_loop_depth DESC LIMIT 20`

## 流程

1. `list_projects` 确认项目 id；未索引 → `index_repository`（full 模式秒级，类型感知 LSP 解析；跨仓库路由用 cross-repo-intelligence 模式）。
2. `index_status` 看覆盖：`parse_partial` 文件中标注行区间的构造可能缺图，`skipped` 完全没进图——这些文件里的结论必须用 grep 复核。
3. 查图（按上表选型），结论带证据链：qualified_name + 文件:行。
4. 图查不到 → `check_index_coverage`（精确核验涉及的文件）或 `query_graph(graph="missed")`（看漏图文件结构）。
5. 仍无 → 文本兜底（grep/glob/read），结论标注「图未覆盖」。

## 回退判据（仅这些情况允许跳过查图）

- 字面量 / 字符串 / 配置值 / 注释——图不索引。
- 文件名存在性、目录枚举——用 glob。
- 原始计数、模块级 import 权重统计——图是函数/类级节点，自写扫描脚本更准。
- **引用任何「图里没有」「代码不存在」的负面结论前，必须先过流程第 4 步核验**，否则可能把索引缺口当成事实。

## 坑

- `semantic_query` 传数组，不是单个字符串。
- 图是快照：新增文件 / 符号要重跑 `index_repository` 才进图。
- `search_graph` 分页看 `has_more`；`trace_path` 翻页用返回的 `next` 游标原样回传。
- Cypher 宽查询不加 LIMIT 会顶到 100k 行硬上限。
