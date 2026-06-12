#!/usr/bin/env python3
"""
Studium local server — static file server + macOS Keychain helper + AI proxy.

The AI proxy (POST /proxy/<provider>) forwards model calls server-side so:
  - API keys are never sent to the browser
  - OpenAI / OpenAI-compatible calls work (no browser CORS restriction)
  - Access-Control-Allow-Origin wildcard is gone — cross-origin reads are blocked
"""

import http.client
import ipaddress
import json
import os
import socket
import ssl
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 58743
ORIGIN = f"http://{HOST}:{PORT}"
SERVICE = "Studium"

# Cap request bodies so an oversized upload can't exhaust memory (STU-1).
MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MB
# Opt-in escape hatch for users who deliberately run a model server on a LAN
# host (not loopback). Off by default — the proxy refuses private/link-local
# targets so it can't be aimed at cloud metadata (169.254.169.254) or internal
# services.
ALLOW_PRIVATE_PROXY = os.environ.get("STUDIUM_ALLOW_PRIVATE_PROXY") == "1"


def validate_target_url(url: str) -> None:
    """
    SSRF guard for user-supplied proxy targets (STU-1).

    Requires https except for loopback (where http is allowed for local model
    servers). Resolves the host and rejects any private / link-local / reserved
    / multicast address unless STUDIUM_ALLOW_PRIVATE_PROXY=1. Raises ValueError
    on anything disallowed.
    """
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    host = parsed.hostname
    if not host:
        raise ValueError("Invalid target URL")

    try:
        port = parsed.port or (443 if scheme == "https" else 80)
    except ValueError:
        raise ValueError("Invalid target URL port")

    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise ValueError("Could not resolve target host")
    ips = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not ips:
        raise ValueError("Could not resolve target host")

    all_loopback = all(ip.is_loopback for ip in ips)

    if scheme == "http":
        if not all_loopback:
            raise ValueError("http:// is only allowed for localhost targets")
    elif scheme != "https":
        raise ValueError("Target URL must use https")

    if all_loopback:
        return  # local model server (e.g. Ollama) — explicitly allowed
    if ALLOW_PRIVATE_PROXY:
        return

    for ip in ips:
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            raise ValueError(
                "Target host resolves to a private/link-local address — blocked"
            )
KEYCHAIN_FIELDS = (
    "anthropicKey",
    "openaiKey",
    "googleKey",
    "openaiCompatibleKey",
)


def get_user() -> str:
    return os.environ.get("USER") or os.environ.get("USERNAME") or ""


def keychain_name(field: str) -> str:
    return f"{SERVICE}.{field}"


def run_security(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["security", *args], capture_output=True, text=True, check=False)


def keychain_get(field: str):
    user = get_user()
    if not user:
        return None
    result = run_security("find-generic-password", "-s", keychain_name(field), "-a", user, "-w")
    if result.returncode != 0:
        return None
    value = result.stdout.strip()
    return value or None


def keychain_set(field: str, value: str):
    user = get_user()
    if not user:
        raise RuntimeError("No user account available for Keychain access")
    result = run_security(
        "add-generic-password", "-s", keychain_name(field), "-a", user, "-w", value, "-U",
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Failed to store secret in Keychain")


def keychain_delete(field: str):
    user = get_user()
    if not user:
        raise RuntimeError("No user account available for Keychain access")
    result = run_security("delete-generic-password", "-s", keychain_name(field), "-a", user)
    if result.returncode != 0 and "could not be found" not in result.stderr.lower():
        raise RuntimeError(result.stderr.strip() or "Failed to delete secret from Keychain")


class StudiumHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    # ── Security ─────────────────────────────────────────────────────────────

    def _check_origin(self) -> bool:
        """Reject requests whose Origin header is set but doesn't match our own origin.
        Same-origin browser fetches send no Origin header (GET) or our own origin (POST)."""
        origin = self.headers.get("Origin", "")
        if origin and origin != ORIGIN:
            self._send_json(403, {"error": "Forbidden: cross-origin request rejected"})
            return False
        return True

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _send_json(self, status_code: int, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # Alias kept for any call sites that use the old name
    def send_json(self, status_code, payload, extra_headers=None):
        self._send_json(status_code, payload)

    # ── HTTP verbs ────────────────────────────────────────────────────────────

    def do_OPTIONS(self):
        # OPTIONS is only sent by browsers for cross-origin preflight checks.
        # All requests are same-origin, so we reject them.
        self.send_response(403)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self._check_origin():
            return
        if self.path == "/keychain/status":
            self._send_json(200, {"ok": True})
            return
        if self.path == "/keychain/keys":
            # Return booleans only — the proxy handles keys server-side; the page
            # only needs to know whether a key is saved, never the secret value.
            data = {field: keychain_get(field) is not None for field in KEYCHAIN_FIELDS}
            self._send_json(200, {"keys": data})
            return
        if self.path.startswith("/models/"):
            self._handle_models()
            return
        return super().do_GET()

    def do_POST(self):
        if not self._check_origin():
            return

        if self.path.startswith("/proxy/"):
            self._handle_proxy()
            return

        if not self.path.startswith("/keychain/"):
            self.send_error(404)
            return

        field = self.path.split("/", 2)[-1]
        if field not in KEYCHAIN_FIELDS:
            self._send_json(400, {"error": "Unknown key field"})
            return

        raw = self._read_body_capped()
        if raw is None:
            return  # 413 already sent
        body = raw.decode("utf-8")
        try:
            payload = json.loads(body or "{}")
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON"})
            return

        value = payload.get("value", "")
        if value is None:
            value = ""
        if not isinstance(value, str):
            self._send_json(400, {"error": "value must be a string"})
            return

        try:
            if value == "":
                keychain_delete(field)
            else:
                keychain_set(field, value)
            self._send_json(200, {"ok": True})
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})

    # ── Model-list proxy ──────────────────────────────────────────────────────

    def _handle_models(self):
        """GET /models/<provider> — returns list of valid model IDs for the provider."""
        parts = self.path.split("/", 2)
        if len(parts) < 3 or not parts[2]:
            self._send_json(400, {"error": "Bad /models/<provider> path"})
            return
        provider = parts[2]
        try:
            if provider == "anthropic":
                key = keychain_get("anthropicKey")
                if not key:
                    self._send_json(401, {"error": "No Anthropic key configured"})
                    return
                url = "https://api.anthropic.com/v1/models"
                req_headers = {"x-api-key": key, "anthropic-version": "2023-06-01"}
            elif provider == "openai":
                key = keychain_get("openaiKey")
                if not key:
                    self._send_json(401, {"error": "No OpenAI key configured"})
                    return
                url = "https://api.openai.com/v1/models"
                req_headers = {"Authorization": f"Bearer {key}"}
            elif provider == "google":
                key = keychain_get("googleKey")
                if not key:
                    self._send_json(401, {"error": "No Google key configured"})
                    return
                url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
                req_headers = {}
            else:
                self._send_json(400, {"error": f"Unknown provider: {provider!r}"})
                return

            parsed = urlparse(url)
            is_https = parsed.scheme == "https"
            ctx = ssl.create_default_context() if is_https else None
            ConnClass = http.client.HTTPSConnection if is_https else http.client.HTTPConnection
            conn = ConnClass(parsed.netloc, context=ctx, timeout=15)
            path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
            conn.request("GET", path, headers=req_headers)
            resp = conn.getresponse()
            body = resp.read()
            conn.close()
            data = json.loads(body)
            if provider == "google":
                ids = [m["name"].split("/")[-1] for m in data.get("models", []) if "name" in m]
            else:
                ids = [m["id"] for m in data.get("data", []) if "id" in m]
            self._send_json(200, {"models": ids})
        except Exception as exc:
            self._send_json(502, {"error": str(exc)})

    # ── AI proxy ──────────────────────────────────────────────────────────────

    def _read_body_capped(self):
        """
        Read the request body, rejecting anything over MAX_BODY_BYTES with 413
        (STU-1). Returns the bytes, or None if a 413 was already sent.
        """
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Invalid Content-Length"})
            return None
        if length < 0 or length > MAX_BODY_BYTES:
            self._send_json(413, {"error": "Request body too large"})
            return None
        return self.rfile.read(length)

    def _handle_proxy(self):
        parts = self.path.split("/", 2)
        if len(parts) < 3 or not parts[2]:
            self._send_json(400, {"error": "Bad proxy path — use /proxy/<provider>"})
            return
        provider = parts[2]

        raw_body = self._read_body_capped()
        if raw_body is None:
            return  # 413 already sent
        try:
            payload = json.loads(raw_body or b"{}")
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON"})
            return

        try:
            target_url, target_headers, fwd_body = self._build_target(provider, payload)
        except LookupError as exc:
            self._send_json(401, {"error": str(exc)})
            return
        except (ValueError, KeyError) as exc:
            self._send_json(400, {"error": str(exc)})
            return

        self._forward(target_url, target_headers, fwd_body)

    def _build_target(self, provider, payload):
        """Return (target_url, headers_dict, encoded_body) for the upstream call."""

        if provider == "anthropic":
            key = keychain_get("anthropicKey")
            if not key:
                raise LookupError("No Anthropic API key configured — add it in Settings")
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "Content-Type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "prompt-caching-2024-07-31",
            }
            return url, headers, json.dumps(payload).encode()

        if provider == "openai":
            key = keychain_get("openaiKey")
            if not key:
                raise LookupError("No OpenAI API key configured — add it in Settings")
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            }
            return url, headers, json.dumps(payload).encode()

        if provider == "google":
            key = keychain_get("googleKey")
            if not key:
                raise LookupError("No Google API key configured — add it in Settings")
            model_id = payload.pop("_model", "")
            if not model_id:
                raise ValueError("Missing _model field for Google provider")
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model_id}:generateContent?key={key}"
            )
            return url, {"Content-Type": "application/json"}, json.dumps(payload).encode()

        if provider == "openai-compatible":
            key = keychain_get("openaiCompatibleKey")
            base_url = payload.pop("_base_url", "").rstrip("/")
            if not base_url:
                raise ValueError("Missing _base_url in request body for openai-compatible provider")
            if not base_url.endswith("/chat/completions"):
                base_url += "/chat/completions"
            validate_target_url(base_url)  # SSRF guard (STU-1)
            headers = {"Content-Type": "application/json"}
            if key:
                headers["Authorization"] = f"Bearer {key}"
            return base_url, headers, json.dumps(payload).encode()

        raise ValueError(f"Unknown provider: {provider!r}")

    def _forward(self, target_url, target_headers, fwd_body):
        """Forward fwd_body to target_url; stream SSE, buffer JSON responses."""
        parsed = urlparse(target_url)
        is_https = parsed.scheme == "https"
        host = parsed.netloc
        path = parsed.path + ("?" + parsed.query if parsed.query else "")

        ctx = ssl.create_default_context() if is_https else None
        ConnClass = http.client.HTTPSConnection if is_https else http.client.HTTPConnection

        headers_sent = False
        conn = None
        try:
            conn = ConnClass(host, context=ctx, timeout=120)
            conn.request("POST", path, body=fwd_body, headers=target_headers)
            resp = conn.getresponse()

            status = resp.status
            content_type = resp.getheader("Content-Type", "application/json")
            is_sse = "text/event-stream" in content_type

            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")

            if is_sse:
                # HTTP chunked encoding lets the browser receive SSE events as they arrive.
                self.send_header("Transfer-Encoding", "chunked")
                self.end_headers()
                headers_sent = True
                while True:
                    chunk = resp.read(4096)
                    if not chunk:
                        self.wfile.write(b"0\r\n\r\n")
                        self.wfile.flush()
                        break
                    size_hex = format(len(chunk), "x").encode()
                    self.wfile.write(size_hex + b"\r\n" + chunk + b"\r\n")
                    self.wfile.flush()
            else:
                body = resp.read()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                headers_sent = True
                self.wfile.write(body)
                self.wfile.flush()

        except Exception as exc:
            if not headers_sent:
                try:
                    err = json.dumps({"error": str(exc)}).encode()
                    self.send_response(502)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                except Exception:
                    pass
            else:
                self.close_connection = True  # mid-stream error; close the TCP connection
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    httpd = ThreadingHTTPServer((HOST, PORT), StudiumHandler)
    print(f"Serving Studium on http://{HOST}:{PORT}/", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
