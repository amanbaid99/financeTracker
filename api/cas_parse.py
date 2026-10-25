"""POST /api/cas_parse: read a CAS PDF for a signed-in user.

Body: the PDF password, a newline, then the PDF bytes.
Header: Authorization: Bearer <Supabase access token>.
Nothing is stored or logged; the response holds fund-level data only.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _casreader import MAX_PDF_BYTES, ReadError, read_statement, split_body, verify_user


class handler(BaseHTTPRequestHandler):  # noqa: N801 - name required by Vercel
    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802
        auth = self.headers.get("Authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else None
        if not verify_user(token):
            return self._send(401, {"ok": False, "code": "unauthorized", "message": "Please sign in again."})
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_PDF_BYTES + 512:
            return self._send(413, {"ok": False, "code": "too_large", "message": "This file is over 4 MB."})
        password, pdf = split_body(self.rfile.read(length))
        try:
            result = read_statement(pdf, password)
        except ReadError as e:
            return self._send(422, {"ok": False, "code": e.code, "message": e.message})
        return self._send(200, {"ok": True, **result})

    def do_GET(self) -> None:  # noqa: N802
        self._send(405, {"ok": False, "code": "method", "message": "Use POST."})

    def log_message(self, *args) -> None:  # never log requests
        return
