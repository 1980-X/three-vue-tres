# Local fork remotes and project agent tooling

> Source: Local git remotes, `gh api repos/1980-X/three-vue-tres`, `.cursor/` tree, `AGENTS.md`, ops-hub Gitea developer install into this repo, conversation install actions on 2026-10-27
> Collected: 2026-10-27
> Published: Unknown

## Git remotes (as configured on gpu001 clone)

- origin: git@github.com:1980-X/three-vue-tres.git (fetch/push)
- joyx: git@joy-x:wilber/three-vue-tres.git (fetch/push)
- upstream: git@github.com:hawk86104/three-vue-tres.git (fetch); push URL DISABLE

## GitHub fork relationship

- 1980-X/three-vue-tres fork: true
- parent: hawk86104/three-vue-tres
- source: hawk86104/three-vue-tres

## joy-x Gitea hosting for this project

- Web: http://192.168.1.84:18600/wilber/three-vue-tres
- SSH: git@joy-x:wilber/three-vue-tres.git (Host joy-x → Port 18622)
- Repo created/pushed 2026-10-27; observed as private in Gitea DB (is_private=t) at creation time
- Project installed gitea-dev skill/rule/hook via ops-hub install-to-project.sh

## Local commits after shared upstream tip a1de5820 (as of 2026-10-27)

- 16bb4e1a Add project-scoped Superpowers skills under .cursor.
- 818e0470 Add joy-x Gitea developer skill, rule, and git shell guard.
- c4072ee4 Add continual-learning and karpathy-llm-wiki project skills.

## AGENTS.md project rules (verbatim themes)

- Prefer simple architecture and small reviewable changes
- After modifying this project: do NOT auto-run build/debug commands (npm run build/dev/serve/preview, Vite, local servers, browser debug/screenshots) unless the user explicitly asks in the current conversation
- When reporting completed work without those checks: state that build/debug verification was skipped due to project rules

## .cursor project skills present (SKILL.md count under .cursor/skills: 17 skill folders including Superpowers set)

Observed skill directories include:

- Superpowers set: brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills
- gitea-dev
- continual-learning
- karpathy-llm-wiki

Also present:

- .cursor/rules/gitea-dev.mdc
- .cursor/agents/agents-memory-updater.md
- hooks: session-start (Superpowers), git-shell-guard.sh (gitea-dev), continual-learning-stop.sh/.ts
- hooks.json merges sessionStart, beforeShellExecution, stop

## Repo-root skills (non-.cursor)

- skills/tvt-js-plugin-builder/ — TvT plugin builder AI skill shipped by upstream project

## Intended dual-remote workflow

- Daily push to joyx and/or origin when user requests 双推
- Fetch upstream for ICEGL updates: git fetch upstream; merge or rebase upstream/master
- Do not push to upstream (push disabled)
