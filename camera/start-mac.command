#!/bin/bash
# Double-click this file in Finder to start CamControl on your Mac.
# Add --demo to try it without the camera:   ./start-mac.command --demo
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then run this again."
  read -n 1 -s -r -p "Press any key to close"
  exit 1
fi
( sleep 2; open "http://localhost:${PORT:-8720}" ) &
exec node server.js "$@"
