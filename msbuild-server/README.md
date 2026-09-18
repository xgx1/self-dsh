# MSBuild Server —— 命令行构建加速

> 让 CLI 的 `dotnet build` 连上常驻的 MSBuild 服务进程，跨次构建复用求值缓存，补上 Visual Studio 因长驻进程而占有的那部分性能优势。

## 什么时候用

- 命令行小改动增量构建（`dotnet build`）慢得反常
- 同一个项目在 Visual Studio 里构建明显比 CLI 快
- CI agent 对同一仓库连续跑很多次构建

**什么时候不用**：IDE 内构建（VS 本来就用长驻 MSBuild 节点，没有收益）、一次性构建（冷启动开销可接受）、怀疑构建正确性问题（先禁用 server 隔离故障）。

## 前置条件

- 构建方式是命令行 `dotnet build`，不是在 IDE 里
- 有一个能设置环境变量的 shell 上下文（bash / PowerShell / Windows 持久化）

## 怎么用

### Step 1：确认是 CLI 构建

MSBuild Server 只在命令行构建时提供收益；先确认开发者不是在 Visual Studio 或其他 IDE 里构建。

### Step 2：设置环境变量

Linux（bash）：

```bash
# 当前 shell
export MSBUILDUSESERVER=1

# 只对单条命令生效，不改 shell 状态
MSBUILDUSESERVER=1 dotnet build

# 持久化：写进 shell rc（Arch 默认 bash 是 ~/.bashrc，用 zsh 则 ~/.zshrc）
echo 'export MSBUILDUSESERVER=1' >> ~/.bashrc
```

Windows（PowerShell）：

```powershell
# 当前会话
$env:MSBUILDUSESERVER = "1"

# 持久化（对新开的 shell 生效）
setx MSBUILDUSESERVER 1
```

### Step 3：验证收益

对同一项目连续跑两次构建：第一次（冷）server 刚启动、没有缓存收益；第二次（暖）应明显更快。多项目仓库、`Directory.Build.props` 链条复杂的仓库收益最明显。

## 验收清单

- [ ] shell 里 `MSBUILDUSESERVER=1` 已设置
- [ ] 第二次连续构建快于第一次
- [ ] `dotnet build-server shutdown` 之后重新构建，server 能干净重启

## 注意事项 / 已知坑

| 坑 | 处理 |
|---|---|
| 以为 VS 里也能提速 | VS 已有长驻 MSBuild 节点，server 无收益 |
| 开启后出现构建正确性问题 | 先 `dotnet build-server shutdown` 复位；问题仍在就禁用 server |
| server 进程占用意外内存 | server 会常驻后台，空闲时用 `dotnet build-server shutdown` 关掉 |
