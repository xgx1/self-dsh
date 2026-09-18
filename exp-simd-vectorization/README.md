# .NET 热路径 SIMD 向量化（exp-simd-vectorization）

> 把 .NET 8+ 的标量热路径循环改写成跨平台 SIMD 内联函数，或用单次 `TensorPrimitives` 调用替掉手写数学循环。

## 什么时候用

- 热路径上是**连续数组 / `Span<T>` 上的标量循环**，元素为 `byte`、`sbyte`、`short`、`ushort`、`int`、`uint`、`long`、`ulong`、`nint`、`nuint`、`float`、`double`（`char` 可重解释为 `ushort`）
- 覆盖场景：字节区间校验、字符计数、批量位运算、跨类型转换、多数组融合计算、float/double 数学运算
- **不适用**：字典查找、树遍历、链表、状态机、字符串格式化、小集合、枚举比较、递归算法、`decimal` 运算 → 技能要求输出 `[NO SIMD OPPORTUNITY]` 并写**一整段**理由，说明是哪条代码特征阻止了向量化（这段解释会被评分）

## 怎么用：四步决策门（按顺序判断，命中即停）

| # | 判断 | 动作 |
|---|---|---|
| 1 | `Span<T>` / `MemoryExtensions` 已有方法（`Contains`、`IndexOf`、`CopyTo`、`SequenceEqual` 等） | 直接用，不加依赖——运行时内部已向量化了很多 |
| 2 | `TensorPrimitives` 有对应 API | 用它替换标量循环后**停止**，不要再手写 Vector128 |
| 3 | 连续数值数组上的标量循环 | 用 `Vector128<T>` / `Vector256<T>` / `Vector512<T>` 内联函数手写 |
| 4 | 没有连续数值数组可处理 | 报告 `[NO SIMD OPPORTUNITY]` + 整段理由 |

走第 2 步时若 `.csproj` 尚未引用该包，加上（或沿用解决方案已有的版本管理方式）：

```xml
<PackageReference Include="System.Numerics.Tensors" />
```

一个操作可由多次调用组合，例如同时求最小与最大值 → `TensorPrimitives.Min(span)` + `TensorPrimitives.Max(span)`。

## 手写 SIMD 的硬性写法

- 导入三条：`System.Runtime.CompilerServices`、`System.Runtime.InteropServices`、`System.Runtime.Intrinsics`
- **三档分派必须全部写出**：`Vector512` → `Vector256` → `Vector128` → 标量兜底，且用 `if / else if`；顺序 `if` 的 fallthrough 会让小输入多走几个可能误预测的分支。`IsHardwareAccelerated` 是 JIT 期常量，死路径在编译期被消除
- 尾部剩余元素分三类处理：幂等操作（校验、搜索）可重叠最后一次向量；聚合操作（求和、计数、最值）必须走标量循环以免重复计数；原地存储用 `ConditionalSelect` 与上一向量合并
- 完整的三档模板、区间校验 / nibble 查表计数 / 跨类型扩宽收窄三种模式、以及 TensorPrimitives 全量 API 表，均在 SKILL.md

## 测试

```bash
dotnet run    # 用 dotnet run，不要用 dotnet test —— xunit.v3 是进程内 runner
```

## 注意事项 / 已知坑

- **保留原方法签名**做 drop-in 替换；**标量代码作为兜底不能删**
- 只用 `Vector128<T>` / `Vector256<T>` / `Vector512<T>`，**禁用 `Vector<T>`**
- 优先跨平台 API；平台专有内联函数（`Avx2`、`Sse42`、`AdvSimd`、`Fma`）只在性能优势显著、值得多维护一条代码路径时才用
- `TensorPrimitives` 是泛型的：`Sum` 等对全部基础数值类型有效，`CosineSimilarity` 等要求 `IRootFunctions<T>`，只支持 `float`/`double`
- `AddMultiply` 与 `MultiplyAdd` 不等价（依赖链分别来自加数/乘数，优化方向不同）；`FusedMultiplyAdd` 才是单次舍入的 IEEE 754 fused 形式
- `Vector128.MultiplyAddEstimate` 是**近似**乘加，需要精确融合语义时改用 `FusedMultiplyAdd`
