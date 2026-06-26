#!/bin/bash
# Double-click this to build a self-contained Studium.app — the app's "container".
#
# What it does: bundles studium.html + studium_server.py into a single
# Studium.app you can double-click (and drag to the Dock). The bundle is
# local-only — the server binds 127.0.0.1, keys live in macOS Keychain, and your
# Quant Prep files stay on this machine. No Docker, no daemon, no network reach.
#
# The .app is built into THIS folder so it's right here, ready to double-click.
cd "$(dirname "$0")" || exit 1
chmod +x ./install_studium.sh 2>/dev/null || true
./install_studium.sh --here
echo ""
echo "Done. Double-click Studium.app in this folder to run it."
echo "(Press any key to close this window.)"
read -n 1 -s
