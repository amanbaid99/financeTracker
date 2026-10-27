"""Plain text from a card's features PDF (key facts, MITC, benefits guide).

Anything that looks personal is masked before the text leaves this module:
card numbers, emails, phone numbers and PAN-like codes. Only the first
pages are read and the text is capped, since feature documents are short.
"""

from __future__ import annotations

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
    # pypdfium2 comes with casparser, so the server already has it.
    import pypdfium2 as pdfium

    if not pdf.startswith(b"%PDF"):
        raise TextError("not_pdf", "This isn't a PDF.")
    try:
        doc = pdfium.PdfDocument(pdf, password=password or None)
    except pdfium.PdfiumError as e:
        if "password" in str(e).lower():
            raise TextError("password", "This PDF needs a password.") from None
        raise TextError("unreadable", "Couldn't read this PDF.") from None
    parts: list[str] = []
    try:
        for i in range(min(len(doc), MAX_PAGES)):
            page = doc[i]
            textpage = page.get_textpage()
            parts.append(textpage.get_text_range() or "")
            textpage.close()
            page.close()
            if sum(len(p) for p in parts) > MAX_CHARS:
                break
    except pdfium.PdfiumError:
        raise TextError("unreadable", "Couldn't read this PDF.") from None
    finally:
        doc.close()
    text = re.sub(r"[ \t]+", " ", "\n".join(parts).replace("\r", "\n"))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 40:
        raise TextError("no_text", "No text found. It may be a scanned image; paste the features instead.")
    return mask(text)[:MAX_CHARS]
