# cbm-graph-first —— 代码检索查图优先

> 在代码库里找代码时，先用 codebase-memory MCP（`mcp__cbm__`）查知识图谱，grep/glob 只做兜底。

## 什么时候用

不是「读代码」时用，而是**任何以代码库为对象的检索**：找符号/定义、查谁调用谁、追调用链、评估改动影响面、看架构总览与模块边界、找复杂度热点、改动前侦察。

也包括：用户说「查图 / 用图谱 / 通过知识图谱」，以及**引用「图里没有」「代码不存在」这类负面结论之前**（必须先核验覆盖，否则会把索引缺口当成事实）。

## 怎么用

**默认顺序：查图 → 覆盖核验 → 文本兜底。**

工具选型（先宽后窄）：

| 要什么 | 用什么 |
|---|---|
| 自然语言找符号 | `search_graph`（query 模式，BM25 + camelCase 分词 + 结构加权） |
| 精确名字 / 正则 | `search_graph`（name_pattern / qn_pattern / label / file_pattern） |
| 词不匹配、跨词汇桥接 | `search_graph`（`semantic_query`，必须是关键词**数组**） |
| grep 式文本但要函数级结果 | `search_code`（对比 `total_grep_matches` 与 `total_results` 判断去重/截断） |
| 谁调用它 / 它调用谁 | `trace_path`（mode=calls，direction=inbound/outbound） |
| 数据从哪来、到哪去 | `trace_path`（mode=data_flow） |
| 跨服务 / HTTP 路由 | `trace_path`（mode=cross_service） |
| 改动影响面 | `detect_changes`；多跳聚合用 `query_graph` 写 Cypher |
| 架构总览 / 真实模块边界 | `get_architecture`（`aspects=["clusters"]` 走 Leiden 社区） |
| 读源码 | `get_code_snippet`（先用 `search_graph` 拿 qualified_name） |
| 找环 / 统计 / 热点 | `query_graph`（Cypher） |

流程：

1. `list_projects` 确认项目 id；未索引 → `index_repository`（full 模式秒级，类型感知 LSP 解析；跨仓库路由用 cross-repo-intelligence 模式）。
2. `index_status` 看覆盖：`parse_partial` 文件中标注行区间的构造可能缺图，`skipped` 完全没进图——这些文件里的结论必须用 grep 复核。
3. 按上表查图，结论带证据链：qualified_name + 文件:行。
4. 图查不到 → `check_index_coverage`（精确核验涉及的文件）或 `query_graph(graph="missed")`（看漏图文件结构）。
5. 仍无 → 文本兜底（grep/glob/read），结论标注「图未覆盖」。

热点信号查询示例（宽查询自己加 LIMIT）：

```cypher
MATCH (f:Function) WHERE f.transitive_loop_depth >= 3 OR f.linear_scan_in_loop >= 1
RETURN f.qualified_name ORDER BY f.transitive_loop_depth DESC LIMIT 20
```

## 前置条件

- codebase-memory MCP 可用（工具前缀 `mcp__cbm__`）——查不到 `mcp__cbm__*` 工具时先确认它在 DSH 组合里已挂载。
- 目标仓库**已进图**：`list_projects` 里没有就先把 `index_repository` 跑一遍（秒级）；否则查图只会返回空结果，别据此下负面结论。
- `semantic_query`（向量检索）额外要求 moderate/full 索引模式。

## 回退判据（仅这些情况允许跳过查图）

- 字面量 / 字符串 / 配置值 / 注释——图不索引。
- 文件名存在性、目录枚举——用 glob。
- 原始计数、模块级 import 权重统计——图是函数/类级节点，自写扫描脚本更准。

## 注意事项 / 已知坑

- `semantic_query` 传**数组**，不是单个字符串（且需 moderate/full 索引）。
- 图是快照：新增文件 / 符号要重跑 `index_repository` 才进图。
- `search_graph` 分页看 `has_more`；`trace_path` 翻页用返回的 `next` 游标**原样回传**。
- Cypher 宽查询不加 LIMIT 会顶到 100k 行硬上限。
- `get_code_snippet` 是读工具不是搜索工具，传错 qualified_name 会得到建议列表而不是源码。
