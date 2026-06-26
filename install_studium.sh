#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════╗
# ║         Studium — macOS App Installer                ║
# ║  Creates Studium.app and adds it to ~/Applications  ║
# ╚══════════════════════════════════════════════════════╝
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Studium"
# Default install target is ~/Applications. Pass --here to build the bundle into
# this project folder instead (handy for a self-contained, double-click artifact
# you can keep next to the source).
INSTALL_DIR="$HOME/Applications"
if [ "${1:-}" = "--here" ]; then INSTALL_DIR="$SCRIPT_DIR"; fi
APP_PATH="$INSTALL_DIR/$APP_NAME.app"
PORT=58743

echo ""
echo "  Studium Installer"
echo "  ─────────────────────────────────"

# ── 1. Check for required files ──────────────────────
if [ ! -f "$SCRIPT_DIR/studium.html" ]; then
  echo "ERROR: studium.html not found in $SCRIPT_DIR"
  echo "    Place install_studium.sh and studium.html in the same folder."
  exit 1
fi

# ── 2. Create app bundle structure ──────────────────
echo "  → Creating app bundle…"
mkdir -p "$INSTALL_DIR"
rm -rf "$APP_PATH"
mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

# ── 3. Copy HTML and server helper ───────────────────
cp "$SCRIPT_DIR/studium.html" "$APP_PATH/Contents/Resources/index.html"
cp "$SCRIPT_DIR/studium_server.py" "$APP_PATH/Contents/Resources/studium_server.py"

# ── 4. Info.plist ─────────────────────────────────────
cat > "$APP_PATH/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>             <string>Studium</string>
  <key>CFBundleDisplayName</key>      <string>Studium</string>
  <key>CFBundleIdentifier</key>       <string>com.user.studium</string>
  <key>CFBundleVersion</key>          <string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleExecutable</key>       <string>studium</string>
  <key>LSMinimumSystemVersion</key>   <string>10.15</string>
  <key>NSHighResolutionCapable</key>  <true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.education</string>
  <key>NSRequiresAquaSystemAppearance</key><false/>
</dict>
</plist>
PLIST

# ── 5. Launcher script ────────────────────────────────
cat > "$APP_PATH/Contents/MacOS/studium" << 'LAUNCHER'
#!/usr/bin/env bash
RESOURCES="$(cd "$(dirname "$0")/../Resources" && pwd)"
PORT=58743

# ── Find python3 ─────────────────────────────────────
# A GUI-launched .app inherits a minimal PATH (often just /usr/bin:/bin), so a
# bare `python3` can miss a Homebrew-only install. Probe the usual locations
# before giving up, and surface a clear message instead of failing silently.
PY=""
for cand in python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if command -v "$cand" >/dev/null 2>&1; then PY="$cand"; break; fi
done
if [ -z "$PY" ]; then
  osascript -e 'display alert "Studium" message "Python 3 is required but was not found. Install it from python.org or run: brew install python"'
  exit 1
fi

# ── Kill any stale server on this port ──────────────
lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 0.2

# ── Start the local HTTP server ──────────────────────
# Binds 127.0.0.1 only (see studium_server.py) — nothing on the network can
# reach it; the app stays local-only.
cd "$RESOURCES"
"$PY" "$RESOURCES/studium_server.py" >/dev/null 2>&1 &
SERVER_PID=$!

# ── Poll until the server is actually ready ──────────
# (fixes "localhost refused to connect" — don't open the browser
#  until the socket is listening)
READY=0
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -sf --max-time 0.4 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    READY=1; break
  fi
  sleep 0.25
done

if [ "$READY" -eq 0 ]; then
  osascript -e 'display alert "Studium" message "Could not start the local server. Make sure Python 3 is installed (python3 --version)."'
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi

URL="http://localhost:${PORT}/index.html"

# ── Open browser using 'open -a' ─────────────────────
# IMPORTANT: do NOT run the browser binary directly with &
# Chromium-based browsers fork immediately — the tracked PID exits
# in <1s, which would kill the server before the page loads.
# 'open -a' sidesteps this: it returns immediately, and we keep
# the server alive by waiting on SERVER_PID instead.

if [ -d "/Applications/Microsoft Edge.app" ]; then
  open -a "Microsoft Edge" --args --app="$URL" \
    --window-size=1300,860 --no-first-run 2>/dev/null
elif [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" --args --app="$URL" \
    --window-size=1300,860 --no-first-run 2>/dev/null
elif [ -d "/Applications/Chromium.app" ]; then
  open -a "Chromium" --args --app="$URL" \
    --window-size=1300,860 2>/dev/null
else
  open "$URL"
fi

# ── Keep the server alive until this .app process is quit ──
wait "$SERVER_PID"
LAUNCHER

chmod +x "$APP_PATH/Contents/MacOS/studium"

# ── 6. Done ──────────────────────────────────────────
echo "Installed to $APP_PATH"
echo ""
echo "Add to Dock:"
echo "    1. Open Finder window (opening now...)"
echo "    2. Drag Studium.app to your Dock"
echo ""
echo "First launch: enter your API keys once"
echo "    (they are saved in macOS Keychain for future launches)"
echo ""

open "$INSTALL_DIR"
