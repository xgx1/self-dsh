---
name: dotnet-backend-tdd
description: Write xUnit + EF Core TDD tests for .NET backend services against real relational databases — SQLite in-memory for fast unit tests, PostgreSQL (Testcontainers or local) for integration tests. Use when adding or fixing backend service logic test-first. NOT for EF Core InMemory provider (removed on purpose).
---

# .NET Backend TDD（SQLite + PostgreSQL）

Test-driven development pattern for .NET backend services. **不用 EF Core InMemory provider**——它与真实关系数据库语义不同（无约束、无 SQL 翻译、无事务行为），测过的代码在 PostgreSQL 上仍可能炸。

## 选哪个数据库载体

| 载体 | 用途 | 代价 |
|---|---|---|
| **SQLite in-memory**（共享连接） | 服务层单测的主力：快、零依赖、每次全新 schema | 少量 PG 专有语法/类型不支持（见下） |
| **PostgreSQL（Testcontainers）** | 集成测试 / 需要 PG 语义（`jsonb`、数组、`ILIKE`、部分索引） | 需要 Docker，启动约 3-10s |
| **PostgreSQL（本机实例 + 临时库）** | 无 Docker 时的替代 | 需要一个可连的本地 PG 与建库权限 |

SQLite 上 **不要**测：`jsonb` 运算、`ILIKE`、`array`、`DateOnly/TimeOnly` 的 PG 映射、`Npgsql` 专有扩展。这些行为放 PG 测试。

## SQLite in-memory fixture（服务层单测）

关键：`DataSource=:memory:` 的库随连接生死，**必须在 fixture 生命周期内保持同一个打开的 `SqliteConnection`**，否则 `EnsureCreated()` 建的表在下一次连接时就没了。

```csharp
public sealed class SqliteDbFixture : IDisposable
{
    private readonly SqliteConnection _connection;

    public AppDbContext Db { get; }

    public SqliteDbFixture()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .EnableSensitiveDataLogging()   // 断言失败时能看到参数值
            .Options;

        Db = new AppDbContext(options);
        Db.Database.EnsureCreated();        // 测试用干净 schema，不走迁移
    }

    public void Dispose()
    {
        Db.Dispose();
        _connection.Dispose();
    }
}

public class MyServiceTests : IClassFixture<SqliteDbFixture>
{
    private readonly AppDbContext _db;
    private readonly MyService _service;

    public MyServiceTests(SqliteDbFixture fixture)
    {
        _db = fixture.Db;
        var logger = new Mock<ILogger<MyService>>().Object;
        _service = new MyService(_db, logger);
    }

    private void SeedEntities()
    {
        // 按业务实体构造并 AddRange 种子数据，然后 SaveChanges
        // 注意关系模型约束：一对一（唯一约束）、多对多、规范对（canonical pair）排序等
    }
}
```

**每个测试之间要隔离**：`IClassFixture` 让同一测试类共享一个库，写入会互相污染。需要隔离时用 `IAsyncLifetime` 在 `InitializeAsync` 里 `EnsureDeleted()` + `EnsureCreated()`，或改成每个测试自己 new 一个 fixture（透明地用 `IDisposable` 而不是 `IClassFixture`）。

## PostgreSQL via Testcontainers（集成测试）

```csharp
public sealed class PostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer _container = null!;
    public AppDbContext Db { get; private set; } = null!;
    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        _container = new PostgreSqlBuilder()
            .WithImage("postgres:17-alpine")     // 与生产同大版本，别用 latest
            .WithDatabase("app_tests")
            .WithUsername("postgres")
            .WithPassword("postgres")
            .Build();

        await _container.StartAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        Db = new AppDbContext(options);
        await Db.Database.MigrateAsync();        // PG 上走真实迁移，顺便验证迁移可跑
    }

    public async Task DisposeAsync()
    {
        await Db.DisposeAsync();
        await _container.DisposeAsync();
    }
}

[CollectionDefinition("pg")]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>;
```

- 一个容器给整个测试集合用（`ICollectionFixture`），别每个测试类起一个——`StartAsync()` 是秒级开销。
- `MigrateAsync()` 而不是 `EnsureCreated()`：这样才能测出「迁移与模型不一致」。
- Docker 不可用（CI 无 DinD / 本机没装）时，测试要么跳过要么降级到 SQLite：用 `[Trait("Category","Postgres")]` 标记，CI 里按 category 过滤。

## PostgreSQL 无 Docker 变体（本机实例）

```csharp
// 每个 fixture 建一个一次性库，跑完删掉；库名带随机后缀避免并行冲突
var adminCs = "Host=localhost;Username=postgres;Password=postgres;Database=postgres";
var dbName  = $"app_tests_{Guid.NewGuid():N}";

await using (var admin = new NpgsqlConnection(adminCs))
{
    await admin.OpenAsync();
    await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{dbName}\"", admin);
    await cmd.ExecuteNonQueryAsync();
}

var options = new DbContextOptionsBuilder<AppDbContext>()
    .UseNpgsql($"Host=localhost;Username=postgres;Password=postgres;Database={dbName}")
    .Options;
```

`DisposeAsync` 里 `DROP DATABASE ... WITH (FORCE)` 收尾；`FORCE` 能踢掉残留连接，否则偶发「database is being accessed by other users」。

## 集成测试（WebApplicationFactory）

- 用 `CustomWebApplicationFactory`（TestInfrastructure/），**在 `ConfigureServices` 里先 `RemoveAll<DbContextOptions<AppDbContext>>()` 再注册测试库**——只 `AddDbContext` 覆盖不掉已注册的 options。
- Seed helpers：`TestDbSeeder` 按业务领域提供建关系/发请求等种子方法。
- Assert helpers：`TestJsonAssertions.AssertStatusCode/AssertErrorTitleAsync`。
- 保持 IntegrationTests 与单元测试分开，集成层只验证端到端 HTTP 行为。

```csharp
protected override void ConfigureWebHost(IWebHostBuilder builder)
{
    builder.ConfigureServices(services =>
    {
        services.RemoveAll<DbContextOptions<AppDbContext>>();
        services.RemoveAll<AppDbContext>();
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(_fixture.ConnectionString));
    });
}
```

## Key API Gotchas

### ServiceResult<T>
结果对象模式：`Succeeded` + `Error`（含 `StatusCode`/`Title`）。
- `result.Succeeded` — true = success
- `result.Error!.StatusCode` — HTTP status code（不在 result 上取）
- `result.Error!.Title` — 错误消息字符串（不是 `ErrorMessage`）
- 测试断言失败原因时用 `result.Error` 而非 `result` 本身

### Models
- 业务实体按项目 Model 层定义（注意路径约定，可能与 Data/ 分开）
- 规范对（canonical pair）关系：排序保证 `A < B`，查询/建关系都按此排序
- 单向关系：`InitiatorId → TargetId`，明确方向语义
- 唯一约束关系：如 `MasterId → DiscipleId` 且 DiscipleId 唯一——**唯一约束在 SQLite/PG 上才真的生效，InMemory 上测不出来**

### Service Constructor
- 服务构造函数参数取决于 DI 注册，测试构造时传入真实 `AppDbContext` + Mock 依赖
- 参数个数必须与 DI 容器注册一致，缺参/多参都会在构造时报错
- 常用依赖：`AppDbContext`（真实库）、`ILogger<T>`（Mock）、其他服务（Mock 或真实实例按需）

## RED-GREEN Cycle

1. Write failing test first (`[Fact]` + Assert)
2. Run: `dotnet test <Solution>.slnx --filter "FullyQualifiedName~TestName"`
3. Confirm FAIL for expected reason
4. Write minimal code to pass
5. Run: confirm PASS
6. Run full suite: `dotnet test <Solution>.slnx`

## 常用包

```
Microsoft.EntityFrameworkCore.Sqlite
Npgsql.EntityFrameworkCore.PostgreSQL
Testcontainers.PostgreSql
Microsoft.AspNetCore.Mvc.Testing
Moq（或 NSubstitute）
```
