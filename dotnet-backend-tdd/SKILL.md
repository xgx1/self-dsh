---
name: dotnet-backend-tdd
description: Write xUnit + EF Core InMemory TDD tests for .NET backend services. Use when adding or fixing backend service logic with test-first approach.
---

# .NET Backend TDD

Test-driven development pattern for .NET 9 backend services.

## Test Setup (xUnit + InMemory)

```csharp
public class MyServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly MyService _service;

    public MyServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);
        var logger = new Mock<ILogger<MyService>>().Object;
        _service = new MyService(_db, logger);
    }

    public void Dispose() => _db.Dispose();

    private void SeedEntities()
    {
        // 按业务实体构造并 AddRange 种子数据，然后 SaveChanges
        // 注意关系模型约束：一对一（唯一约束）、多对多、规范对（canonical pair）排序等
    }
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
- 唯一约束关系：如 `MasterId → DiscipleId` 且 DiscipleId 唯一

### Service Constructor
- 服务构造函数参数取决于 DI 注册，测试构造时传入 Mock/InMemory 依赖
- 参数个数必须与 DI 容器注册一致，缺参/多参都会在构造时报错
- 常用依赖：`AppDbContext`（InMemory）、`ILogger<T>`（Mock）、其他服务（Mock 或真实实例按需）

## RED-GREEN Cycle

1. Write failing test first (`[Fact]` + Assert)
2. Run: `dotnet test <Solution>.slnx --filter "FullyQualifiedName~TestName"`
3. Confirm FAIL for expected reason
4. Write minimal code to pass
5. Run: confirm PASS
6. Run full suite: `dotnet test <Solution>.slnx`

## Integration Tests

当行为变更时更新集成测试文件：
- Use `CustomWebApplicationFactory`（TestInfrastructure/）
- Seed helpers：`TestDbSeeder` 按业务领域提供建关系/发请求等种子方法
- Assert helpers：`TestJsonAssertions.AssertStatusCode/AssertErrorTitleAsync`
- 保持 IntegrationTests 与单元测试分开，集成层只验证端到端 HTTP 行为
