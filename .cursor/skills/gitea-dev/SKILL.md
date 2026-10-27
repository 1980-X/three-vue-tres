---
name: gitea-dev
description: >-
  Use joy-x Gitea on gpu001 for git clone, pull, push over SSH (port 18622).
  Use when the user mentions Gitea, joy-x, git@joy-x, 18622, git remote,
  or hosting code on the local Gitea instance.
---

# joy-x Gitea 开发（业务仓）

## 连接真源

| 项   | 值                                                      |
| ---- | ------------------------------------------------------- |
| Web  | http://192.168.1.84:18600/                              |
| SSH  | `git@joy-x:owner/repo.git`（`Host joy-x` → Port 18622） |
| 用户 | `git`                                                   |

环境配置真源：ops-hub `knowledge/services/gitea/developer/01-git-and-ssh.md`。

## Agent 行为

1. **默认**在业务工程内用 `git`，remote 为 `git@joy-x:…`。
2. **不要**默认 `cd ~/service/gitea` 或对其 `docker compose`（运维用 skill `gitea-ops`）。
3. **不要**把密码、私钥、Deploy Key 写入 Skill/Rule/Git。
4. `git push --force` 到 `main`/`master` 须用户显式确认。

## SSH 速查

```sshconfig
Host joy-x
  HostName 192.168.1.84
  User git
  Port 18622
  IdentityFile ~/.ssh/id_ed25519
```

```bash
ssh -T git@joy-x
git clone git@joy-x:owner/repo.git
git remote set-url origin git@joy-x:owner/repo.git
```

新建仓库：Web http://192.168.1.84:18600/ → 登录 → 「+」→ 新建仓库（自助注册当前可用；须固定 org 时找运维）。见 `01-git-and-ssh.md` §3。

## 常见故障

| 现象                               | 处理                              |
| ---------------------------------- | --------------------------------- |
| `Permission denied (publickey)`    | Web 添加公钥；检查 `IdentityFile` |
| `Could not resolve hostname joy-x` | 补 `~/.ssh/config`                |
| `Connection refused` :18622        | 联系运维确认 Gitea 栈             |

## 详细文档

ops-hub [`knowledge/services/gitea/developer/`](../../README.md)（HANDOFF、01-git-and-ssh）。
