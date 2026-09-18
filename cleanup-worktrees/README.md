# cleanup-worktrees —— 清理所有 git worktree 和对应分支

> 把项目里遗留的 worktree 与分支逐个盘点、确认无独立提交后移除，最终只剩 master。

## 什么时候用

用户说「清理 worktree」「移除所有 worktree」「合并 worktree」时。

## 怎么用

按顺序执行，**每步都要先看输出再决定下一步**：

```bash
# 1. 列出所有 worktree 及对应 commit
git worktree list

# 2. 检查各分支是否有独立提交未合入 master
git log <base>..<head>

# 3. 确认分支落后于 master（无独立内容）后，移除 worktree
git worktree remove --force <path>

# 4. 删除本地分支
git branch -d <branch>

# 5. 验证仅剩 master
git worktree list && git branch
```

`<base>` / `<head>` / `<path>` / `<branch>` 按第 1、2 步的实际输出替换。

判定分支「落后于 master（无独立内容）」才走第 3-4 步；**若有独立提交，需先决定是否合并到 master，再动删除**。

## 前置条件

- 在目标仓库内执行，且当前不在待删除的 worktree 里。
- 主分支叫 master（第 2 步的合入目标）。

## 注意事项 / 已知坑

- 项目 worktree 含子模块（`<Project>/`、`<ProjectServer>/`）时，普通 `git worktree remove` 会报：
  `fatal: working trees containing submodules cannot be moved or removed`
  ——**必须加 `--force`**。
- `--force` 会丢弃该 worktree 里未提交的改动，删除前确认没有要保留的内容。
- 顺序不能颠倒：先 `worktree remove` 再 `branch -d`，分支还被 worktree 占用时删不掉。
- 有独立提交却直接删分支 = 丢代码，务必先跑第 2 步 `git log` 核对。
