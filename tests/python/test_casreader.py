"""Tests for the CAS reader: normalising, checks, SIPs, privacy and errors."""

import io
import json
import os
import sys
import threading
import urllib.request
from datetime import date
from decimal import Decimal
from http.server import ThreadingHTTPServer
from types import SimpleNamespace as NS

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "api"))

import _casreader as r  # noqa: E402
import cas_parse  # noqa: E402

D = Decimal
PERIOD = NS(**{"from_": "01-Apr-2026", "to": "30-Sep-2026"})
INVESTOR = NS(name="Asha Rao", email="asha@example.com", address="12 MG Road", mobile="9999999999")


def tx(d, t, amount):
    return NS(date=d, type=t, amount=D(amount), units=None, nav=None, balance=None, description="x")


def scheme(name, isin, units, nav, value, txs=(), close_calc=None, kind="EQUITY"):
    return NS(
        scheme=name,
        isin=isin,
        amfi="1",
        type=kind,
        advisor="ARN-1",
        rta_code="X",
        rta="CAMS",
        nominees=["Someone"],
        open=D("0"),
        close=D(str(units)),
        close_calculated=D(str(close_calc if close_calc is not None else units)),
        valuation=NS(date="30-Sep-2026", nav=D(str(nav)), value=D(str(value)), cost=None),
        transactions=list(txs),
    )


def mf_cas(folios, cas_type="DETAILED"):
    return NS(
        statement_period=PERIOD,
        folios=folios,
        investor_info=INVESTOR,
        cas_type=cas_type,
        file_type="CAMS",
        parse_warnings=[],
    )


def folio(num, schemes, amc="Some AMC"):
    return NS(folio=num, amc=amc, PAN="ABCDE1234F", KYC="OK", PANKYC="OK", name="Asha Rao", schemes=schemes)


class TestMutualFundStatement:
    def test_combines_folios_skips_closed_and_finds_sips(self):
        sip_txs = [
            tx(date(2026, 8, 5), "PURCHASE_SIP", "5000"),
            tx(date(2026, 9, 5), "PURCHASE_SIP", "5000"),
            tx(date(2026, 9, 20), "PURCHASE_SIP", "2000"),
            tx(date(2026, 9, 10), "PURCHASE", "10000"),
        ]
        cas = mf_cas(
            [
                folio("123/45", [scheme("Index Fund - Direct Growth", "INF000A01", 100, 150, 15000, sip_txs)]),
                folio("678/90", [scheme("Index Fund - Direct Growth", "INF000A01", 50, 150, 7500)]),
                folio("111", [scheme("Old Fund", "INF000B02", 0, 10, 0)]),
            ]
        )
        out = r.normalise(cas)
        assert out["source"] == "CAMS"
        assert out["detailed"] is True
        assert out["statementDate"] == "2026-09-30"
        assert len(out["holdings"]) == 1
        h = out["holdings"][0]
        assert h["units"] == 150 and h["value"] == 22500 and h["count"] == 2
        assert h["sipMonthly"] == 7000  # two SIPs in September
        assert h["lastSipDate"] == "2026-09-20"
        assert h["issues"] == []
        assert any("no units left" in w for w in out["warnings"])

    def test_flags_values_that_dont_add_up(self):
        cas = mf_cas([folio("1", [scheme("Fund A", "INF1", 10, 100, 1500, close_calc=9)])])
        issues = r.normalise(cas)["holdings"][0]["issues"]
        assert any("units × NAV" in i for i in issues)
        assert any("transactions" in i for i in issues)

    def test_never_returns_personal_details(self):
        cas = mf_cas([folio("123/45", [scheme("Fund A", "INF1", 10, 100, 1000)])])
        text = json.dumps(r.normalise(cas))
        for secret in ("ABCDE1234F", "Asha", "asha@example.com", "MG Road", "9999999999", "123/45", "ARN-1", "Someone"):
            assert secret not in text

    def test_summary_statement_has_no_sips(self):
        cas = mf_cas([folio("1", [scheme("Fund A", "INF1", 10, 100, 1000)])], cas_type="SUMMARY")
        out = r.normalise(cas)
        assert out["detailed"] is False
        assert out["holdings"][0]["sipMonthly"] is None


class TestSipDetection:
    END = date(2026, 9, 30)

    def test_stopped_sip_is_not_counted(self):
        sip, last = r.detect_sip([tx(date(2026, 6, 5), "PURCHASE_SIP", "5000")], self.END)
        assert sip is None and last == "2026-06-05"

    def test_no_sips(self):
        assert r.detect_sip([tx(date(2026, 9, 5), "PURCHASE", "5000")], self.END) == (None, None)


class TestDematStatement:
    def test_groups_stocks_and_bonds_keeps_funds_and_nps(self):
        acc = NS(
            name="Some Broker",
            type="CDSL",
            dp_id="IN300000",
            client_id="12345678",
            folios=1,
            balance=D("33500"),
            owners=[NS(name="Asha Rao", PAN="ABCDE1234F")],
            equities=[
                NS(name="Stock A", isin="INE1", num_shares=D("10"), price=D("1000"), value=D("10000")),
                NS(name="Stock B", isin="INE2", num_shares=D("5"), price=D("1000"), value=D("5000")),
            ],
            mutual_funds=[NS(name="ETF Fund", isin="INF9", balance=D("100"), nav=D("135"), value=D("13500"), type="EQUITY")],
            bonds=[NS(name="Bond", isin="INB1", num_bonds=D("5"), value=D("5000"))],
        )
        cas = NS(
            accounts=[acc],
            statement_period=PERIOD,
            investor_info=INVESTOR,
            file_type="CDSL",
            nps=NS(value=D("40000"), pran="xxxx1234", schemes=[]),
            parse_warnings=[],
        )
        out = r.normalise(cas)
        assert out["source"] == "CDSL"
        by_key = {h["key"]: h for h in out["holdings"]}
        assert by_key["DEMAT-STOCKS"]["value"] == 15000 and by_key["DEMAT-STOCKS"]["count"] == 2
        assert by_key["DEMAT-BONDS"]["value"] == 5000
        assert by_key["INF9"]["value"] == 13500
        assert by_key["NPS"]["kind"] == "nps"
        assert out["warnings"] == []
        text = json.dumps(out)
        for secret in ("IN300000", "12345678", "ABCDE1234F", "Asha", "xxxx1234"):
            assert secret not in text


def blank_pdf(password=None) -> bytes:
    from pypdf import PdfWriter

    w = PdfWriter()
    w.add_blank_page(width=200, height=200)
    if password:
        w.encrypt(password)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


class TestReading:
    def test_rejects_non_pdf_and_huge_files(self):
        with pytest.raises(r.ReadError) as e:
            r.read_statement(b"hello", "x")
        assert e.value.code == "not_pdf"
        with pytest.raises(r.ReadError) as e:
            r.read_statement(b"%PDF" + b"0" * r.MAX_PDF_BYTES, "x")
        assert e.value.code == "too_large"

    def test_wrong_password(self):
        with pytest.raises(r.ReadError) as e:
            r.read_statement(blank_pdf("secret"), "nope")
        assert e.value.code == "wrong_password"

    def test_pdf_that_is_not_a_statement(self):
        with pytest.raises(r.ReadError) as e:
            r.read_statement(blank_pdf(), "")
        assert e.value.code in ("not_a_statement", "unreadable")

    def test_split_body(self):
        assert r.split_body(b"PAN1234\n%PDF-1.7 data") == ("PAN1234", b"%PDF-1.7 data")
        assert r.split_body(b"pw\r\n%PDF") == ("pw", b"%PDF")


class TestHandler:
    def serve(self, monkeypatch, signed_in=True, result=None):
        monkeypatch.setattr(cas_parse, "verify_user", lambda t: signed_in and t == "good")
        if result is not None:
            monkeypatch.setattr(cas_parse, "read_statement", lambda pdf, pw: result)
        srv = ThreadingHTTPServer(("127.0.0.1", 0), cas_parse.handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        return srv

    def post(self, srv, body, token="good"):
        req = urllib.request.Request(
            f"http://127.0.0.1:{srv.server_address[1]}/api/cas_parse",
            data=body,
            headers={"Authorization": f"Bearer {token}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as res:
                return res.status, json.loads(res.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_requires_sign_in(self, monkeypatch):
        srv = self.serve(monkeypatch)
        try:
            status, body = self.post(srv, b"pw\n%PDF", token="bad")
            assert status == 401 and body["code"] == "unauthorized"
        finally:
            srv.shutdown()

    def test_returns_errors_and_results(self, monkeypatch):
        srv = self.serve(monkeypatch)
        try:
            status, body = self.post(srv, b"pw\nnot a pdf")
            assert status == 422 and body["code"] == "not_pdf"
        finally:
            srv.shutdown()
        srv = self.serve(monkeypatch, result={"source": "CAMS", "holdings": [{"key": "A"}]})
        try:
            status, body = self.post(srv, b"pw\n%PDF")
            assert status == 200 and body["ok"] is True and body["holdings"][0]["key"] == "A"
        finally:
            srv.shutdown()
