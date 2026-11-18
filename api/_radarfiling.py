"""Deterministic NSE Ind-AS print/HTML review. No AI, network access or persistence."""
from __future__ import annotations

import hashlib
import re
from datetime import date
from decimal import Decimal, InvalidOperation, localcontext
from html.parser import HTMLParser

MAX_CHARS = 150_000
SCALES = {"lakhs": ("INR-lakh", Decimal(100_000)), "crores": ("INR-crore", Decimal(10_000_000)), "rupees": ("INR", Decimal(1))}
DATE = re.compile(r"\d{2}-\d{2}-\d{4}")
NUMBER = re.compile(r"(?:-?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?|\((?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?\))")


class FilingError(ValueError):
    pass


def _label(label: str) -> str:
    return r"\s+".join(re.escape(word) for word in label.split())


def _value_lines(text: str, label: str, numeric: bool = False) -> list[str]:
    pattern = re.compile(r"(?im)^(?:(?:[A-D]|\d{1,2}|i{1,3}|\([a-z]\))[ \t]+)?" + _label(label) + r"(?=[ \t\n]|$)")
    result = []
    for match in pattern.finditer(text):
        tail = text[match.end():].splitlines()
        value = next((line.strip() for line in tail[:3] if line.strip()), "")
        # A shorter label must not match a different row such as
        # "Purchase of intangible assets under development".
        if not numeric or not value or re.match(r"[\d(+-]", value):
            result.append(value)
    return result


def _one(text: str, label: str) -> str:
    matches = _value_lines(text, label)
    if len(matches) != 1:
        raise FilingError(f"The {label.lower()} field is missing or ambiguous.")
    return matches[0]


def _date(value: str) -> str:
    if not DATE.fullmatch(value):
        raise FilingError("A reporting date is invalid.")
    try:
        return date.fromisoformat("-".join(reversed(value.split("-")))).isoformat()
    except ValueError:
        raise FilingError("A reporting date is invalid.") from None


def _section(text: str, start: str, end: str) -> str | None:
    begins = list(re.finditer(r"(?im)^" + _label(start) + r"[ \t]*$", text))
    if len(begins) != 1:
        return None
    rest = text[begins[0].end():]
    finish = re.search(r"(?im)^" + _label(end) + r"[ \t]*$", rest)
    return rest[:finish.start()] if finish else None


def _column(section: str, fiscal_start: str, fiscal_end: str, basis: str, point: bool = False) -> tuple[int, int]:
    starts = _one(section, "Date of start of reporting period").split()
    ends = _one(section, "Date of end of reporting period").split()
    audits = _one(section, "Whether results are audited or unaudited").split()
    bases = _one(section, "Nature of report standalone or consolidated").split()
    if not 1 <= len(starts) <= 6 or len({len(starts), len(ends), len(audits), len(bases)}) != 1:
        raise FilingError("Reporting columns could not be aligned.")
    columns = [i for i in range(len(starts)) if _date(starts[i]) == fiscal_start and _date(ends[i]) == fiscal_end and audits[i].lower() == "audited" and bases[i].lower() == basis.lower()]
    if len(columns) != 1 or (point and len(starts) != 1):
        raise FilingError("One matching audited annual column is required.")
    return columns[0], len(starts)


def parse_filing_text(text: str, expected_isin: str) -> dict:
    if not isinstance(text, str) or len(text) > MAX_CHARS or not re.fullmatch(r"IN[A-Z0-9]{10}", expected_isin):
        raise FilingError("The filing text or expected security identifier is invalid.")
    # Browser print time and page numbers are not publication metadata.
    lines = [re.sub(r"[ \t\u00a0]+", " ", line).strip() for line in text.replace("\r", "\n").replace("\f", "\n").splitlines()]
    text = "\n".join(line for line in lines if line and line != ":" and not re.fullmatch(r"Page \d+ of \d+|\d{1,2}/\d{1,2}/\d{2,4}, \d{1,2}:\d{2} [AP]M", line))
    marker = re.search(r"(?im)^Financial Results Ind-AS$", text)
    if not marker:
        raise FilingError("This is not a supported NSE Ind-AS filing format.")
    header = text[:marker.start()]
    isin = _one(header, "ISIN")
    if isin != expected_isin:
        raise FilingError("The filing does not match the selected security ISIN.")
    currency = _one(header, "Description of presentation currency")
    scale = _one(header, "Level of rounding used in financial results").lower()
    basis = _one(header, "Nature of report standalone or consolidated")
    if currency != "INR" or scale not in SCALES or basis not in ("Consolidated", "Standalone"):
        raise FilingError("The reporting currency, scale or basis is unsupported.")
    fiscal_start = _date(_one(header, "Date of start of financial year"))
    fiscal_end = _date(_one(header, "Date of end of financial year"))
    duration = (date.fromisoformat(fiscal_end) - date.fromisoformat(fiscal_start)).days
    if not 330 <= duration <= 400:
        raise FilingError("A complete annual reporting period is required.")
    facts, issues = [], []
    definitions = [
        ("results", "Financial Results Ind-AS", "Disclosure of notes on financial results", False, [
            ("revenue", "Revenue from operations", False), ("net-profit", "Total profit (loss) for period", False),
            ("other-income", "Other income", False), ("finance-costs", "Finance costs", False),
            ("exceptional-items", "Exceptional items", False),
            ("basic-eps", "Basic earnings (loss) per share from continuing and discontinued operations", True),
            ("diluted-eps", "Diluted earnings (loss) per share from continuing and discontinued operations", True),
        ]),
        ("balance", "Statement of Asset and Liabilities", "Disclosure of notes on assets and liabilities", True, [
            ("cash-equivalents", "Cash and cash equivalents", False), ("total-assets", "Total assets", False),
        ]),
        ("cashflow", "Cash flow statement, indirect", "Details of Impact of Audit Qualification", False, [
            ("operating-cash", "Net cash flows from (used in) operating activities", False),
            ("purchase-ppe", "Purchase of property, plant and equipment", False),
            ("sale-ppe", "Proceeds from sales of property, plant and equipment", False),
            ("purchase-intangibles", "Purchase of intangible assets", False),
            ("closing-cash", "Cash and cash equivalents cash flow statement at end of period", False),
        ]),
    ]
    for kind, begin, end, point, metrics in definitions:
        section = _section(text, begin, end)
        if section is None:
            issues.append(f"The {kind} section was not recognized.")
            continue
        try:
            index, count = _column(section, fiscal_start, fiscal_end, basis, point)
            scales = re.findall(r"(?i)Amount in\s*\(\s*(Lakhs|Crores|Rupees)\s*\)", section)
            if len(scales) != 1 or scales[0].lower() != scale:
                raise FilingError("The section scale is missing or differs from the document scale.")
        except FilingError as error:
            issues.append(f"{kind}: {error}")
            continue
        for metric, label, per_share in metrics:
            values = _value_lines(section, label, numeric=True)
            if len(values) != 1:
                issues.append(f"{metric}: the row is missing or ambiguous.")
                continue
            cells = values[0].split()
            if len(cells) != count or not all(NUMBER.fullmatch(cell) for cell in cells):
                issues.append(f"{metric}: numeric columns could not be verified.")
                continue
            raw = cells[index]
            if sum(character.isdigit() for character in raw) > 24:
                issues.append(f"{metric}: the reported precision exceeds the review limit.")
                continue
            try:
                value = Decimal(raw.replace(",", "").replace("(", "-").replace(")", ""))
            except InvalidOperation:
                issues.append(f"{metric}: the value is invalid.")
                continue
            unit, factor = ("INR/share", Decimal(1)) if per_share else SCALES[scale]
            with localcontext() as context:
                context.prec = 40
                normalized = value * factor
            if not normalized.is_finite() or abs(normalized) > 9_007_199_254_740_991:
                issues.append(f"{metric}: the value exceeds numeric limits.")
                continue
            facts.append({"metric": metric, "section": kind, "periodStart": None if point else fiscal_start,
                          "periodEnd": fiscal_end, "periodKind": "point-in-time" if point else "annual",
                          "basis": basis.lower(), "dimension": "per-share" if per_share else "amount",
                          "unit": unit, "reportedValue": str(value), "normalizedValue": format(normalized, "f"),
                          "roundingStepVerified": False})
    required = {"revenue", "net-profit", "diluted-eps"}
    if not required.issubset({fact["metric"] for fact in facts}):
        raise FilingError("The annual revenue, profit and diluted-EPS rows could not all be verified.")
    warnings = []
    if re.search(r"(?i)inventory[\s-]+led|inventory ownership|change in accounting|restated", text):
        warnings.append("The document mentions a reporting/business change or restatement. Accounting comparability needs review.")
    return {"version": "nse-filing-text-1", "isin": isin, "fiscalStart": fiscal_start, "fiscalEnd": fiscal_end,
            "currency": currency, "basis": basis.lower(), "facts": facts, "issues": issues, "warnings": warnings,
            "publicationTimeVerified": False, "recurringEarningsVerified": False,
            "annualComparabilityVerified": False, "sourceAuthenticityVerified": False, "valuationReady": False}


def pdf_filing(pdf: bytes, expected_isin: str) -> dict:
    import pypdfium2 as pdfium
    if not pdf.startswith(b"%PDF") or len(pdf) > 4_000_000:
        raise FilingError("A PDF under 4 MB is required.")
    try:
        document = pdfium.PdfDocument(pdf)
    except pdfium.PdfiumError:
        raise FilingError("The filing PDF could not be read.") from None
    try:
        if len(document) > 30:
            raise FilingError("The filing exceeds the 30-page review limit.")
        parts = []
        for i in range(len(document)):
            page = document[i]
            textpage = page.get_textpage()
            try:
                parts.append(textpage.get_text_range() or "")
            finally:
                textpage.close()
                page.close()
            if sum(map(len, parts)) > MAX_CHARS:
                raise FilingError("The filing exceeds the text review limit.")
        result = parse_filing_text("\n".join(parts), expected_isin)
        return {**result, "fileSha256": hashlib.sha256(pdf).hexdigest(), "sourceKind": "uploaded-pdf-copy"}
    finally:
        document.close()


class _HtmlText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip = 0
        self.cell_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        if self.skip:
            return
        if tag in ("td", "th"):
            self.cell_depth += 1
        if tag in ("tr", "p", "div", "h1", "h2", "h3", "h4", "br"):
            self.parts.append(" " if self.cell_depth and tag != "tr" else "\n")
        elif tag in ("td", "th"):
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1
        elif not self.skip:
            if tag in ("tr", "p", "div", "h1", "h2", "h3", "h4"):
                self.parts.append(" " if self.cell_depth and tag != "tr" else "\n")
            if tag in ("td", "th"):
                self.cell_depth = max(0, self.cell_depth - 1)

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.parts.append(re.sub(r"\s+", " ", data))
        elif not self.skip and self.cell_depth:
            self.parts.append(" ")


def html_filing(html: str, expected_isin: str) -> dict:
    if len(html) > 4_000_000:
        raise FilingError("The HTML filing exceeds its read limit.")
    parser = _HtmlText()
    parser.feed(html)
    result = parse_filing_text("".join(parser.parts), expected_isin)
    return {**result, "sourceKind": "downloaded-html", "fileSha256": hashlib.sha256(html.encode()).hexdigest()}
