"""Local stand-in for the Vercel Python function, for `next dev` and e2e tests.

Serves POST /api/cas_parse on 127.0.0.1:5328 with the same handler that runs
on Vercel. With CAS_FAKE_FIXTURE set to a JSON file, a statement uploaded with
the password "fixture" returns that file's contents instead of parsing
(sign-in is still checked). This script is never deployed.
"""

import json
import os
import sys
from http.server import ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))

# Pick up the Supabase URL and key from .env.local, like `next dev` does.
_env_file = os.path.join(ROOT, ".env.local")
if os.path.exists(_env_file):
    for line in open(_env_file):
        k, sep, v = line.strip().partition("=")
        if sep and k.startswith("NEXT_PUBLIC_SUPABASE") and k not in os.environ:
            os.environ[k] = v.strip().strip('"')

import _casreader  # noqa: E402
import cas_parse  # noqa: E402

fixture = os.environ.get("CAS_FAKE_FIXTURE")
if fixture:
    real = _casreader.read_statement

    def fake(pdf: bytes, password: str) -> dict:
        if password == "fixture":
            with open(fixture) as f:
                return json.load(f)
        return real(pdf, password)

    cas_parse.read_statement = fake


class Handler(cas_parse.handler):
    def do_POST(self):  # noqa: N802
        if self.path.split("?")[0] != "/api/cas_parse":
            return self._send(404, {"ok": False, "code": "not_found", "message": "Not found."})
        return super().do_POST()


if __name__ == "__main__":
    port = int(os.environ.get("CAS_DEV_PORT", "5328"))
    print(f"CAS reader on http://127.0.0.1:{port}/api/cas_parse", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
