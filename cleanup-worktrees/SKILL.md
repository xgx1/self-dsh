---
name: cleanup-worktrees
description: "清理所有 git worktree 和对应分支。当用户说\"清理worktree\"、\"移除所有worktree\"、\"合并worktree\"时使用。"
---

# 清理 Git Worktrees

## 流程

1. `git worktree list` — 列出所有 worktree 及对应 commit
2. `git log <base>..<head>` — 检查各分支是否有独立提交未合入 master
3. 若分支落后于 master（无独立内容）：
   - `git worktree remove --force <path>` — 子模块会阻止普通 remove，必须加 `--force`
   - `git branch -d <branch>` — 删除本地分支
4. `git worktree list && git branch` — 验证仅剩 master

## 注意

- 项目 worktree 含子模块（<Project>/、<ProjectServer>/），普通 `git worktree remove` 会报 `fatal: working trees containing submodules cannot be moved or removed`，必须 `--force`
- 若有独立提交需先决定是否合并到 master
