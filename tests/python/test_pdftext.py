import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "api"))

from _pdftext import TextError, mask, pdf_text  # noqa: E402


def make_pdf(lines: list[str]) -> bytes:
    """A minimal one-page PDF with the given lines of text."""
    ops = ["BT", "/F1 12 Tf", "14 TL", "50 750 Td"]
    for line in lines:
        safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        ops.append(f"({safe}) Tj T*")
    ops.append("ET")
    stream = "\n".join(ops).encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return bytes(out)


def test_reads_text_and_masks_personal_details():
    pdf = make_pdf(
        [
            "TravelOne Credit Card - Key Facts",
            "Annual fee Rs 4,999 waived on spends of Rs 8,00,000 in a card year.",
            "Card 4111 1111 1111 1111 for priya@example.com, call 9876543210, PAN ABCDE1234F",
        ]
    )
    text = pdf_text(pdf)
    assert "Annual fee Rs 4,999" in text
    assert "4111" not in text and "priya@" not in text and "9876543210" not in text
    assert "ABCDE1234F" not in text
    assert "[number]" in text and "[email]" in text and "[phone]" in text


def test_amounts_are_not_masked():
    assert mask("Spend Rs 12,00,000 for 10,000 points") == "Spend Rs 12,00,000 for 10,000 points"


def test_rejects_non_pdf():
    with pytest.raises(TextError) as e:
        pdf_text(b"hello")
    assert e.value.code == "not_pdf"


def test_rejects_pdf_without_text():
    with pytest.raises(TextError) as e:
        pdf_text(make_pdf([]))
    assert e.value.code == "no_text"
