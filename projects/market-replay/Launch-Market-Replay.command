#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null || ! node -e 'process.exit(+process.versions.node.split(".")[0]>=22?0:1)'; then
  echo 'Live mode requires Node.js 22 or later. Opening the saved edition.'
  open Market-Replay.html
  exit
fi
exec node src/local.mjs --open
