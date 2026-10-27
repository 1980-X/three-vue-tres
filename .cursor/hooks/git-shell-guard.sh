#!/usr/bin/env bash
# beforeShellExecution：拦截危险 git / docker 命令（joy-x 业务仓）。
set -euo pipefail

input="$(cat || true)"

deny() {
  local msg="$1"
  printf '{"permission":"deny","user_message":%s}\n' "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$msg")"
  exit 0
}

allow() {
  printf '{"permission":"allow"}\n'
  exit 0
}

cmd="$(
  printf '%s' "$input" | python3 -c '
import json,sys
raw=sys.stdin.read() or "{}"
try:
  d=json.loads(raw)
except Exception:
  print(""); sys.exit(0)
for k in ("command","command_line","cmd"):
  if isinstance(d.get(k), str):
    print(d[k]); sys.exit(0)
ti=d.get("tool_input") or d.get("input") or {}
if isinstance(ti, dict):
  for k in ("command","command_line","cmd"):
    if isinstance(ti.get(k), str):
      print(ti[k]); sys.exit(0)
print("")
' 2>/dev/null || true
)"

[[ -z "$cmd" ]] && allow

# force push to main/master（允许命令含 --i-know 占位表示用户已确认）
if echo "$cmd" | grep -Eqi 'git[[:space:]]+push.*(-f|--force)' \
  && echo "$cmd" | grep -Eqi '(main|master)' \
  && ! echo "$cmd" | grep -q -- '--i-know'; then
  deny "拒绝对 main/master 的 force push。若用户已明确确认，在命令中加入 --i-know 占位后再执行。"
fi

if echo "$cmd" | grep -Eqi 'docker[[:space:]]+system[[:space:]]+prune'; then
  deny "拒绝 docker system prune（会波及其它业务容器）。"
fi

if echo "$cmd" | grep -Eqi 'docker[[:space:]]+compose[[:space:]]+.*down' \
  && echo "$cmd" | grep -Eqi 'service/gitea|~/service/gitea'; then
  deny "拒绝对 Gitea 运维栈 compose down（须用户明确授权且由运维执行）。"
fi

if echo "$cmd" | grep -Eqi 'rm[[:space:]]+-rf[[:space:]]+.*\.git'; then
  deny "拒绝删除 .git 目录的 rm -rf。"
fi

allow
