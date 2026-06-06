#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")"
PORT=58743
HTML="studium.html"
SERVER_SCRIPT="studium_server.py"
if [ ! -f "$HTML" ]; then
  osascript -e 'display alert "Studium" message "studium.html not found in this folder."'
  exit 1
fi
if [ ! -f "$SERVER_SCRIPT" ]; then
  osascript -e 'display alert "Studium" message "studium_server.py not found in this folder."'
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "Studium" message "Python 3 is required. Install from python.org or run: brew install python"'
  exit 1
fi
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 0.2
python3 "$SERVER_SCRIPT" >/dev/null 2>&1 &
SERVER=$!
READY=0
for i in $(seq 1 20); do
  curl -sf --max-time 0.4 "http://127.0.0.1:$PORT/$HTML" >/dev/null 2>&1 && READY=1 && break
  sleep 0.25
done
if [ "$READY" -eq 0 ]; then
  osascript -e 'display alert "Studium" message "Could not start the local server on port '"$PORT"'."'
  kill "$SERVER" 2>/dev/null || true
  exit 1
fi
URL="http://127.0.0.1:$PORT/$HTML"
if [ -d "/Applications/Microsoft Edge.app" ]; then
  open -a "Microsoft Edge" --args --app="$URL" --window-size=1300,860 --no-first-run 2>/dev/null
elif [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" --args --app="$URL" --window-size=1300,860 --no-first-run 2>/dev/null
else
  open "$URL"
fi
wait "$SERVER"