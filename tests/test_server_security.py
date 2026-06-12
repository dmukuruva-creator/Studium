#!/usr/bin/env python3
"""
STU-1 regression tests for the proxy SSRF + body-size guards in studium_server.py.

Run: python3 tests/test_server_security.py
Uses only literal IPs / loopback so it needs no external DNS.
"""
import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("studium_server", os.path.join(ROOT, "studium_server.py"))
ss = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ss)

failures = []


def expect_block(url):
    try:
        ss.validate_target_url(url)
        failures.append(f"expected BLOCK, got ALLOW: {url}")
    except ValueError:
        pass


def expect_allow(url):
    try:
        ss.validate_target_url(url)
    except ValueError as e:
        failures.append(f"expected ALLOW, got BLOCK ({e}): {url}")


# Cloud metadata + private / LAN ranges must be blocked.
expect_block("http://169.254.169.254/latest/meta-data/")   # cloud metadata
expect_block("https://169.254.169.254/x")                  # link-local over https
expect_block("http://10.0.0.1/v1/chat/completions")        # private, http
expect_block("https://10.0.0.1/x")                         # private, https
expect_block("https://192.168.1.5/x")
expect_block("https://172.16.0.9/x")
expect_block("ftp://127.0.0.1/x")                          # non-http(s) scheme

# Local model servers (Ollama etc.) over loopback are allowed.
expect_allow("http://127.0.0.1:11434/v1/chat/completions")
expect_allow("http://localhost:11434/v1/chat/completions")
expect_allow("https://127.0.0.1:11434/v1/chat/completions")

# Body cap sanity.
assert ss.MAX_BODY_BYTES == 10 * 1024 * 1024, "body cap should be 10 MB"

if failures:
    print("FAILED:")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("ALL CHECKS PASSED ✓ (SSRF guard + body cap)")
