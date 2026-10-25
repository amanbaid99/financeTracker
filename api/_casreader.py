"""Reads a CAS (CAMS, KFintech, NSDL or CDSL) into fund-level holdings.

Only what the app needs leaves this module: scheme names, ISINs, units, NAV,
value and a detected SIP. Investor name, PAN, address, email, mobile, folio
numbers and demat account ids are never included in the output.
"""

from __future__ import annotations

import io
import json
import os
import urllib.request
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Optional

MAX_PDF_BYTES = 4_300_000  # Vercel caps request bodies at 4.5 MB.


class ReadError(Exception):
    """A failure with a code the app can turn into a plain message."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def _name(v: Any) -> str:
    """Enum or plain string to its name, e.g. FileType.CAMS -> "CAMS"."""
    return str(getattr(v, "name", v) or "").upper()


def _num(v: Any) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return 0.0


def _date(v: Any) -> Optional[date]:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    for fmt in ("%d-%b-%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%d %b %Y", "%d-%B-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    try:
        from dateutil import parser as du  # casparser depends on python-dateutil

        return du.parse(s, dayfirst=True).date()
    except Exception:  # noqa: BLE001
        return None


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def value_matches(units: float, nav: float, value: float) -> bool:
    """units x NAV should equal the stated value (rounding allowed)."""
    if value <= 0 and units <= 0:
        return True
    return abs(units * nav - value) <= max(2.0, value * 0.005)


# ---------------------------------------------------------------------------
# SIP detection (detailed CAMS / KFintech statements only)
# ---------------------------------------------------------------------------


def detect_sip(transactions: list, statement_end: Optional[date]) -> tuple[Optional[int], Optional[str]]:
    """The monthly SIP amount if SIP purchases are still running.

    Takes the latest calendar month with SIP purchases; counts it only if it
    falls within 45 days of the statement end. Several SIPs into the same
    fund in that month are added up.
    """
    sips = []
    for t in transactions or []:
        if _name(getattr(t, "type", "")) != "PURCHASE_SIP":
            continue
        d = _date(getattr(t, "date", None))
        amount = _num(getattr(t, "amount", None))
        if d and amount > 0:
            sips.append((d, amount))
    if not sips:
        return None, None
    last = max(d for d, _ in sips)
    if statement_end and (statement_end - last) > timedelta(days=45):
        return None, _iso(last)
    month_total = sum(a for d, a in sips if (d.year, d.month) == (last.year, last.month))
    return int(round(month_total)), _iso(last)


# ---------------------------------------------------------------------------
# Normalising casparser output
# ---------------------------------------------------------------------------


def _holding(**kw: Any) -> dict:
    base = {
        "key": "",
        "kind": "mutual_fund",
        "name": "",
        "isin": None,
        "amc": None,
        "fundType": None,
        "units": 0.0,
        "nav": 0.0,
        "value": 0,
        "navDate": None,
        "sipMonthly": None,
        "lastSipDate": None,
        "count": 1,
        "issues": [],
    }
    base.update(kw)
    return base


def normalise_mf_statement(cas: Any) -> dict:
    """CAMS / KFintech CAS -> holdings, one row per fund (folios combined)."""
    end = _date(getattr(cas.statement_period, "to", None))
    detailed = _name(getattr(cas, "cas_type", "")) == "DETAILED"
    rows: dict[str, dict] = {}
    closed = 0
    warnings: list[str] = []

    for folio in cas.folios or []:
        amc = getattr(folio, "amc", None)
        for s in folio.schemes or []:
            units = _num(s.close)
            val = s.valuation
            nav = _num(val.nav)
            value = _num(val.value)
            if units <= 0.0005 and value <= 0:
                closed += 1
                continue
            issues = []
            if not value_matches(units, nav, value):
                issues.append("Value doesn't equal units × NAV on the statement.")
            if detailed and abs(_num(s.close) - _num(s.close_calculated)) > 0.01:
                issues.append("Units don't add up from the transactions listed.")
            sip, last_sip = detect_sip(s.transactions, end) if detailed else (None, None)
            key = (s.isin or s.scheme or "").strip().upper()
            row = rows.get(key)
            if row is None:
                rows[key] = _holding(
                    key=key,
                    kind="mutual_fund",
                    name=(s.scheme or "").strip(),
                    isin=s.isin,
                    amc=amc,
                    fundType=_name(s.type) or None,
                    units=units,
                    nav=nav,
                    value=value,
                    navDate=_iso(_date(val.date)),
                    sipMonthly=sip,
                    lastSipDate=last_sip,
                    issues=issues,
                )
            else:
                # Same fund in another folio: add it up.
                row["units"] += units
                row["value"] += value
                row["count"] += 1
                row["issues"] += issues
                if sip:
                    row["sipMonthly"] = (row["sipMonthly"] or 0) + sip
                if last_sip and (not row["lastSipDate"] or last_sip > row["lastSipDate"]):
                    row["lastSipDate"] = last_sip

    holdings = list(rows.values())
    for h in holdings:
        h["value"] = int(round(h["value"]))
        h["units"] = round(h["units"], 4)
    if closed:
        warnings.append(f"{closed} fund{'s' if closed != 1 else ''} with no units left were skipped.")
    warnings += [str(w) for w in getattr(cas, "parse_warnings", []) or []]
    return {
        "source": _name(cas.file_type) or "CAMS",
        "detailed": detailed,
        "statementDate": _iso(end),
        "holdings": holdings,
        "warnings": warnings,
    }


def normalise_demat_statement(cas: Any) -> dict:
    """NSDL / CDSL CAS -> stocks and bonds as one row each, funds per scheme."""
    end = _date(getattr(cas.statement_period, "to", None))
    funds: dict[str, dict] = {}
    stock_value = 0.0
    stock_count = 0
    stock_issues: list[str] = []
    bond_value = 0.0
    bond_count = 0
    warnings: list[str] = []

    for acc in cas.accounts or []:
        parts = 0.0
        for e in acc.equities or []:
            v = _num(e.value)
            stock_value += v
            stock_count += 1
            parts += v
            if not value_matches(_num(e.num_shares), _num(e.price), v):
                stock_issues.append(f"{(e.name or e.isin)}: value doesn't equal shares × price.")
        for b in getattr(acc, "bonds", []) or []:
            v = _num(b.value)
            bond_value += v
            bond_count += 1
            parts += v
        for m in acc.mutual_funds or []:
            units, nav, v = _num(m.balance), _num(m.nav), _num(m.value)
            parts += v
            if units <= 0.0005 and v <= 0:
                continue
            key = (m.isin or m.name or "").strip().upper()
            issues = [] if value_matches(units, nav, v) else ["Value doesn't equal units × NAV on the statement."]
            if key in funds:
                funds[key]["units"] += units
                funds[key]["value"] += v
                funds[key]["count"] += 1
                funds[key]["issues"] += issues
            else:
                funds[key] = _holding(
                    key=key,
                    kind="mutual_fund",
                    name=(m.name or m.isin or "").strip(),
                    isin=m.isin,
                    fundType=_name(m.type) or None,
                    units=units,
                    nav=nav,
                    value=v,
                    navDate=_iso(end),
                    issues=issues,
                )
        balance = _num(getattr(acc, "balance", 0))
        if balance and abs(parts - balance) > max(10.0, balance * 0.01):
            warnings.append("An account's holdings don't add up to its total on the statement.")

    holdings = list(funds.values())
    if stock_count:
        holdings.append(
            _holding(
                key="DEMAT-STOCKS",
                kind="stock",
                name="Stocks in demat",
                value=stock_value,
                navDate=_iso(end),
                count=stock_count,
                issues=stock_issues,
            )
        )
    if bond_count:
        holdings.append(
            _holding(key="DEMAT-BONDS", kind="other", name="Bonds in demat", value=bond_value, navDate=_iso(end), count=bond_count)
        )
    nps = getattr(cas, "nps", None)
    if nps is not None and _num(nps.value) > 0:
        holdings.append(_holding(key="NPS", kind="nps", name="NPS", value=_num(nps.value), navDate=_iso(end)))

    for h in holdings:
        h["value"] = int(round(h["value"]))
        h["units"] = round(h["units"], 4)
    warnings += [str(w) for w in getattr(cas, "parse_warnings", []) or []]
    return {
        "source": _name(cas.file_type) or "NSDL",
        "detailed": False,
        "statementDate": _iso(end),
        "holdings": holdings,
        "warnings": warnings,
    }


def normalise(cas: Any) -> dict:
    if hasattr(cas, "accounts"):
        return normalise_demat_statement(cas)
    return normalise_mf_statement(cas)


# ---------------------------------------------------------------------------
# Reading the PDF
# ---------------------------------------------------------------------------


def read_statement(pdf: bytes, password: str) -> dict:
    if not pdf:
        raise ReadError("empty", "No file was sent.")
    if len(pdf) > MAX_PDF_BYTES:
        raise ReadError("too_large", "This file is over 4 MB. Download the statement for a shorter period and try again.")
    if not pdf.lstrip()[:5].startswith(b"%PDF"):
        raise ReadError("not_pdf", "This isn't a PDF. Upload the CAS PDF you received.")

    import casparser
    from casparser.exceptions import IncorrectPasswordError, ParserException

    try:
        cas = casparser.read_cas_pdf(io.BytesIO(pdf), password or "", output="dict")
    except IncorrectPasswordError:
        raise ReadError("wrong_password", "That password didn't open the statement.") from None
    except ParserException as e:
        msg = str(e).lower()
        if "password" in msg:
            raise ReadError("wrong_password", "That password didn't open the statement.") from None
        raise ReadError(
            "not_a_statement",
            "This doesn't look like a CAS from CAMS, KFintech, NSDL or CDSL.",
        ) from None
    except Exception:  # noqa: BLE001 - never echo parser internals
        raise ReadError("unreadable", "The statement couldn't be read. Try downloading it again.") from None
    out = normalise(cas)
    if not out["holdings"]:
        raise ReadError("empty_statement", "No holdings were found in this statement.")
    return out


# ---------------------------------------------------------------------------
# Who is calling
# ---------------------------------------------------------------------------


def verify_user(token: Optional[str]) -> bool:
    """True when the bearer token belongs to a signed-in user of this app."""
    if not token:
        return False
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    if not url or not key:
        return False
    req = urllib.request.Request(
        f"{url}/auth/v1/user",
        headers={"apikey": key, "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as res:  # noqa: S310 - fixed Supabase URL
            body = json.loads(res.read() or b"{}")
            return res.status == 200 and bool(body.get("id"))
    except Exception:  # noqa: BLE001
        return False


def split_body(body: bytes) -> tuple[str, bytes]:
    """The request body is the password, a newline, then the PDF bytes."""
    head, sep, pdf = body.partition(b"\n")
    if not sep:
        return "", body
    return head.decode("utf-8", "replace").rstrip("\r"), pdf
