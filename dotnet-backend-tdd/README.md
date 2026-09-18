# dotnet-backend-tdd —— .NET 后端服务的 TDD 测试写法

> 用 xUnit + EF Core 对着**真实关系数据库**做 test-first：SQLite in-memory 跑服务层单测，PostgreSQL 跑集成测试。

## 什么时候用

以测试先行的方式新增或修复 .NET 后端服务逻辑时。

**明确不用 EF Core InMemory provider**——它与真实关系数据库语义不同（无约束、无 SQL 翻译、无事务行为），在它上面测过的代码到 PostgreSQL 上仍可能炸。

## 怎么用

### 选数据库载体

| 载体 | 用途 | 代价 |
|---|---|---|
| **SQLite in-memory**（共享连接） | 服务层单测主力：快、零依赖、每次全新 schema | 少量 PG 专有语法/类型不支持 |
| **PostgreSQL（Testcontainers）** | 集成测试 / 需要 PG 语义（`jsonb`、数组、`ILIKE`、部分索引） | 需要 Docker，启动约 3-10s |
| **PostgreSQL（本机实例 + 临时库）** | 无 Docker 时的替代 | 需要可连的本地 PG 与建库权限 |

**SQLite 上不要测**：`jsonb` 运算、`ILIKE`、`array`、`DateOnly/TimeOnly` 的 PG 映射、`Npgsql` 专有扩展——这些行为放 PG 测试。

### RED-GREEN 循环

```bash
# 2. 只跑目标测试，确认按预期原因 FAIL
dotnet test <Solution>.slnx --filter "FullyQualifiedName~TestName"

# 5./6. 写最小实现后再跑，确认 PASS；最后跑全量
dotnet test <Solution>.slnx
```

1. 先写失败测试（`[Fact]` + Assert）→ 2. 跑单测 → 3. 确认**按预期原因**失败 → 4. 写最小实现 → 5. 跑单测确认通过 → 6. 跑全量套件。

### 两套 fixture 骨架

- **SQLite in-memory**：`DataSource=:memory:` 的库随连接生死，**必须在 fixture 生命周期内保持同一个打开的 `SqliteConnection`**，否则 `EnsureCreated()` 建的表在下次连接时就没了；`Db.Database.EnsureCreated()` 建干净 schema，不走迁移。
- **Testcontainers PG**：`PostgreSqlBuilder().WithImage("postgres:17-alpine")`（**与生产同大版本，别用 latest**）→ `StartAsync()` → `Db.Database.MigrateAsync()`（走真实迁移，顺便验证迁移可跑）。
- **无 Docker 变体**：每个 fixture 建一次性库（`app_tests_{Guid.NewGuid():N}` 随机后缀避免并行冲突），`DisposeAsync` 里 `DROP DATABASE ... WITH (FORCE)` 收尾——`FORCE` 能踢掉残留连接，否则偶发 `database is being accessed by other users`。

完整代码（`SqliteDbFixture`、`PostgresFixture`、`CustomWebApplicationFactory`）见 SKILL.md。

## 前置条件

- xUnit 测试工程 + `Microsoft.EntityFrameworkCore.Sqlite`、`Npgsql.EntityFrameworkCore.PostgreSQL`、`Testcontainers.PostgreSql`、`Microsoft.AspNetCore.Mvc.Testing`、Moq（或 NSubstitute）。
- 集成测试需 Docker；无 Docker 时用本机 PG 实例变体，或用 `[Trait("Category","Postgres")]` 标记后按 category 过滤 / 跳过。

## 注意事项 / 已知坑

- **测试间要隔离**：`IClassFixture` 让同一测试类共享一个库，写入互相污染——需要隔离时用 `IAsyncLifetime` 在 `InitializeAsync` 里 `EnsureDeleted()` + `EnsureCreated()`，或每个测试自己 new 一个 fixture（用 `IDisposable` 而非 `IClassFixture`）。
- 一个容器给整个测试集合用（`ICollectionFixture`），别每个测试类起一个——`StartAsync()` 是秒级开销。
- 集成测试用 `CustomWebApplicationFactory` 时，**在 `ConfigureServices` 里先 `RemoveAll<DbContextOptions<AppDbContext>>()` 再注册测试库**——只 `AddDbContext` 覆盖不掉已注册的 options。
- `ServiceResult<T>` 断言：用 `result.Error!.StatusCode` 取 HTTP 状态码、`result.Error!.Title` 取错误消息（**不是** `ErrorMessage`，也不在 result 上直接取）。
- 服务构造函数参数个数必须与 DI 容器注册一致，缺参/多参都在构造时报错；测试里传真实 `AppDbContext` + Mock 的 `ILogger<T>`。
- 唯一约束、规范对（`A < B` 排序）等关系语义**只在 SQLite/PG 上真的生效，InMemory 上测不出来**。
- `EnableSensitiveDataLogging()` 让断言失败时能看到参数值。
- 保持 IntegrationTests 与单元测试分开，集成层只验证端到端 HTTP 行为。
