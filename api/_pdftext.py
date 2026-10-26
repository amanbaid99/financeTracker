"""Plain text from a card's features PDF (key facts, MITC, benefits guide).

Anything that looks personal is masked before the text leaves this module:
card numbers, emails, phone numbers and PAN-like codes. Only the first
pages are read and the text is capped, since feature documents are short.
"""

from __future__ import annotations

import io
import re

MAX_PAGES = 30
MAX_CHARS = 40_000

_CARD = re.compile(r"\b\d(?:[ -]?\d){12,18}\b")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?91[ -]?)?[6-9]\d{9}(?!\d)")
_PAN = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")


class TextError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def mask(text: str) -> str:
    text = _CARD.sub("[number]", text)
    text = _EMAIL.sub("[email]", text)
    text = _PHONE.sub("[phone]", text)
    return _PAN.sub("[id]", text)


def pdf_text(pdf: bytes, password: str = "") -> str:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    if not pdf.startswith(b"%PDF"):
        raise TextError("not_pdf", "This isn't a PDF.")
    try:
        reader = PdfReader(io.BytesIO(pdf))
        if reader.is_encrypted and not reader.decrypt(password or ""):
            raise TextError("password", "This PDF needs a password.")
        parts = []
        for page in reader.pages[:MAX_PAGES]:
            parts.append(page.extract_text() or "")
            if sum(len(p) for p in parts) > MAX_CHARS:
                break
    except TextError:
        raise
    except (PdfReadError, ValueError, KeyError):
        raise TextError("unreadable", "Couldn't read this PDF.") from None
    text = re.sub(r"[ \t]+", " ", "\n".join(parts))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 40:
        raise TextError("no_text", "No text found. It may be a scanned image; paste the features instead.")
    return mask(text)[:MAX_CHARS]
