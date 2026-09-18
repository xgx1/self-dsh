# Git 合并清理工作流（git-merge-cleanup）

> 把当前分支合并进主分支、推送、再删掉当前分支——含脏工作区的分类处理，以及「已合并就跳过合并」的判断。

## 什么时候用

用户说「**合并到主分支**」「**merge to main**」「**合入并删除分支**」时。

## 怎么用（按步骤执行）

### 0. 处理脏工作区（先分类，再动手）
```bash
git status --short
```

工作区有变更时按类别处理，**禁止直接跳过**：

| 类别 | 识别 | 处理 |
|---|---|---|
| 运行产物 | `Logs/`、`*.log`、`Saved/`、临时输出 | 加入 `.gitignore`，不提交；已被 git 跟踪的用 `git rm -r --cached` 解除跟踪 |
| 项目工作 | 文档、配置、源码（用户未提交的工作） | `git add` 对应文件并提交，信息与分支语义一致（如 `docs: ...`、`chore(config): ...`） |
| 陌生文件 | 无法判断是否该入库（如根目录突然出现 `package.json`） | 列出并**问用户**，不擅自提交或忽略 |

处理完必须再 `git status --short` 确认干净（或仅剩用户明确搁置的项），才继续。

### 1. 检查状态
```bash
git branch --show-current    # 确认当前分支名
git status --short           # 确认工作区干净
```

工作区必须干净（无输出），否则回到第 0 步。

### 2. 确定主分支
```bash
git branch -a
```

主分支通常是 `master` 或 `main`，取存在的那个。

### 3. 检查是否已合并
```bash
git merge-base --is-ancestor <分支> <主分支> && echo MERGED
```

已合并（输出 `MERGED`）→ 跳过合并，直接到第 5 步删分支；未合并 → `git checkout <主分支> && git merge <分支>`。

### 4. 推送
```bash
git remote -v
git rev-list --count origin/<主分支>..<主分支>   # 0 = 已同步，跳过推送
```

有远端且有未推送提交 → `git push origin <主分支>`；无远端或已同步 → 跳过。

### 5. 删除分支
```bash
git branch -d <分支>
git push origin --delete <分支>   # 远端存在同名分支时
```

## 注意事项 / 已知坑

- 合并前**不执行 rebase**，保持提交历史原样。
- Fast-forward 或 merge commit 都可能出现，以 git 实际行为为准。
- 纯本地仓库跳过推送步骤。
- **分支归属判断**：若当前分支已是主分支（`master`/`main`），则目标是另一个待清理分支（如仅剩的 feature 分支）——跳过「切回主分支」，直接对它执行第 3 步起的流程。
- 若仓库只有主分支、没有其他分支可清理：如实报告「无事可做」，但**仍要执行第 0 步**处理脏工作区。
