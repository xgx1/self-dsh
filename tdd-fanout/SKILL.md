---
name: tdd-fanout
description: 测试入口扇出——任何写测试/改测试/跑测试/TDD/测试验收任务，先把所有测试类技能全部加载再动手（tdd、test-driven-development、tdd-write-feature、run-tests、code-testing-agent、writing-mstest-tests、verification-before-completion、test-anti-patterns、test-gap-analysis），不要只挑一枚。触发词：写测试、跑测试、TDD、测试入口、全部测试技能、测试全加载。
---

# 测试入口扇出

测试类任务（写测试 / 改测试 / 跑测试 / TDD / 验收前检查）开始前，用 `skill` 工具把下面**所有**入口全部加载，再动手：

| 入口 | 管什么 |
|---|---|
| `tdd` | 红-绿-重构总流程 |
| `test-driven-development` | 先写测试再写实现的原则 |
| `tdd-write-feature` | 本机 TDD 全流程（编写 + 验证双模式） |
| `run-tests` | `dotnet test` 的精确命令与旗标 |
| `code-testing-agent` | 批量生成/脚手架测试工程 |
| `writing-mstest-tests` | MSTest 断言写法 |
| `verification-before-completion` | 声称"完成/通过"前的证据门槛 |
| `test-anti-patterns` / `test-gap-analysis` / `test-smell-detection` | 审查已有测试的质量与缺口 |

为什么必须全调，而不是挑一枚：每枚只覆盖一个侧面——流程、命令、生成、断言、证据、审查。
只调一枚必然漏侧面；多调几枚只多几百 token，漏一个坑要赔一晚。

规则：

- 某枚不在当前 catalog（白名单藏了）时 `skill` 工具会报错——跳过继续，不要停。
- 本技能只做扇出路由；加载完按各技能自己的指令执行。
- 非测试任务不要加载本技能。
