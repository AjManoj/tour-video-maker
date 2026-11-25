#!/usr/bin/env bash
# Starts the Day Tour Video Maker laptop server and opens it in your browser.
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  . .venv/bin/activate
  pip install -r requirements.txt
else
  . .venv/bin/activate
fi
( sleep 2; (command -v xdg-open >/dev/null && xdg-open http://localhost:8765/) || (command -v open >/dev/null && open http://localhost:8765/) || true ) &
exec python tour_server.py "$@"
