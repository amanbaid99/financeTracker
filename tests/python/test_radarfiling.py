import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "api"))
from _radarfiling import FilingError, html_filing, parse_filing_text, pdf_filing

ISIN = "INE000000001"


def sample():
    return f"""Integrated Filing IndAS
General information about company
NSE Symbol SYNTHETIC
ISIN {ISIN}
Date of start of financial year 01-04-2025
Date of end of financial year 31-03-2026
Description of presentation currency INR
Level of rounding used in financial results Lakhs
Nature of report standalone or consolidated Consolidated
Financial Results Ind-AS
Amount in (Lakhs)
A Date of start of reporting period 01-01-2026 01-04-2025
B Date of end of reporting period 31-03-2026 31-03-2026
C Whether results are audited or unaudited Unaudited Audited
D Nature of report standalone or consolidated Consolidated Consolidated
Revenue from operations 10,000.00 50,000.00
16 Total profit (loss) for period 100.00 300.00
Other income 5.00 20.00
(e) Finance costs 10.00 40.00
Exceptional items 0.00 0.00
Basic earnings (loss) per share from continuing and discontinued operations 0.1 0.3
Diluted earnings (loss) per share from
continuing and discontinued operations 0.09 0.29
18/11/26, 8:27 AM
Page 1 of 3
Disclosure of notes on financial results
Notes mention an inventory-led reporting transition.
Revenue from operations 999.00 999.00
Statement of Asset and Liabilities
Amount in (Lakhs)
A Date of start of reporting period 01-04-2025
B Date of end of reporting period 31-03-2026
C Whether results are audited or unaudited Audited
D Nature of report standalone or consolidated Consolidated
Cash and cash equivalents 200.00
Total assets 1,000.00
Disclosure of notes on assets and liabilities
Revenue from operations 777.00 888.00
Cash flow statement, indirect
Amount in (Lakhs)
A Date of start of reporting period 01-04-2025
B Date of end of reporting period 31-03-2026
C Whether results are audited or unaudited Audited
D Nature of report standalone or consolidated Consolidated
Net cash flows from (used in) operating activities 500.00
Purchase of property, plant and equipment 100.00
Proceeds from sales of property, plant and equipment 5.00
Purchase of intangible assets 2.00
Purchase of intangible assets under development 10.00
Cash and cash equivalents cash flow statement at end of period 200.00
Details of Impact of Audit Qualification
"""


def fact(result, metric):
    return next(f for f in result["facts"] if f["metric"] == metric)


def test_annual_columns_units_and_eps_are_separate():
    result = parse_filing_text(sample(), ISIN)
    assert len(result["facts"]) == 14
    assert result["issues"] == []
    assert fact(result, "revenue")["normalizedValue"] == "5000000000.00"
    assert fact(result, "revenue")["periodStart"] == "2025-04-01"
    assert fact(result, "diluted-eps")["normalizedValue"] == "0.29"
    assert fact(result, "diluted-eps")["unit"] == "INR/share"
    assert fact(result, "cash-equivalents")["periodKind"] == "point-in-time"
    assert fact(result, "purchase-intangibles")["reportedValue"] == "2.00"
    assert result["warnings"]
    for flag in ["publicationTimeVerified", "recurringEarningsVerified", "annualComparabilityVerified", "sourceAuthenticityVerified", "valuationReady"]:
        assert result[flag] is False


def test_print_footer_is_not_a_publication_date():
    result = parse_filing_text(sample(), ISIN)
    assert result["publicationTimeVerified"] is False
    assert "publishedAt" not in result
    assert "18/11/26" not in str(result)


def test_annual_column_is_selected_by_dates_even_when_it_is_first():
    text = sample().replace("01-01-2026 01-04-2025", "01-04-2025 01-01-2026").replace("Unaudited Audited", "Audited Unaudited")
    for pair in ["10,000.00 50,000.00", "100.00 300.00", "5.00 20.00", "10.00 40.00", "0.00 0.00", "0.1 0.3", "0.09 0.29"]:
        text = text.replace(pair, " ".join(reversed(pair.split())))
    result = parse_filing_text(text, ISIN)
    assert fact(result, "revenue")["reportedValue"] == "50000.00"
    assert fact(result, "diluted-eps")["reportedValue"] == "0.29"


def test_identity_mismatch_or_ambiguity_stops_extraction():
    for text in [sample().replace(ISIN, "INE000000009"), sample().replace(f"ISIN {ISIN}", f"ISIN {ISIN}\nISIN {ISIN}")]:
        with pytest.raises(FilingError):
            parse_filing_text(text, ISIN)


def test_standalone_basis_is_retained_never_promoted_to_consolidated():
    result = parse_filing_text(sample().replace("Consolidated", "Standalone"), ISIN)
    assert result["basis"] == "standalone"
    assert all(f["basis"] == "standalone" for f in result["facts"])


@pytest.mark.parametrize("change", ["date", "currency", "annual-column", "duplicate-row", "missing-cell", "ambiguous-column", "precision", "basis", "audit"])
def test_unverifiable_required_facts_fail_closed(change):
    text = sample()
    if change == "date":
        text = text.replace("Date of end of financial year 31-03-2026", "Date of end of financial year 31-02-2026")
    if change == "currency":
        text = text.replace("currency INR", "currency USD")
    if change == "annual-column":
        text = text.replace("01-01-2026 01-04-2025", "01-01-2026 01-01-2026")
    if change == "duplicate-row":
        text = text.replace("Revenue from operations 10,000.00 50,000.00", "Revenue from operations 10,000.00 50,000.00\nRevenue from operations 10,000.00 90,000.00")
    if change == "missing-cell":
        text = text.replace("Revenue from operations 10,000.00 50,000.00", "Revenue from operations 10,000.00\n12 Other row 50,000.00")
    if change == "ambiguous-column":
        text = text.replace("01-01-2026 01-04-2025", "01-04-2025 01-04-2025").replace("Unaudited Audited", "Audited Audited")
    if change == "precision":
        text = text.replace("50,000.00", "0.1234567890123456789012345")
    if change == "basis":
        text = text.replace("Consolidated Consolidated", "Consolidated Standalone")
    if change == "audit":
        text = text.replace("Unaudited Audited", "Unaudited Unaudited")
    with pytest.raises(FilingError):
        parse_filing_text(text, ISIN)


def test_inconsistent_cashflow_section_is_not_paired_with_the_annual_results():
    text = sample().replace("Cash flow statement, indirect\nAmount in (Lakhs)", "Cash flow statement, indirect\nAmount in (Crores)")
    result = parse_filing_text(text, ISIN)
    assert not any(f["section"] == "cashflow" for f in result["facts"])
    assert any("scale" in issue for issue in result["issues"])
    assert result["valuationReady"] is False


def test_negative_numbers_are_retained_and_malformed_grouping_rejected():
    result = parse_filing_text(sample().replace("100.00 300.00", "100.00 (300.00)"), ISIN)
    assert fact(result, "net-profit")["reportedValue"] == "-300.00"
    with pytest.raises(FilingError):
        parse_filing_text(sample().replace("50,000.00", "50,00.00"), ISIN)


def test_html_text_extraction_never_executes_scripts_or_uses_notes_as_main_results():
    html = "<html><script>ISIN FAKE</script><style>body{color:red}</style><body>" + "".join(f"<p>{line}</p>" for line in sample().splitlines()) + "</body></html>"
    result = html_filing(html, ISIN)
    assert fact(result, "revenue")["reportedValue"] == "50000.00"
    assert result["sourceKind"] == "downloaded-html"
    assert result["sourceAuthenticityVerified"] is False


def test_html_paragraphs_inside_cells_do_not_split_the_numeric_columns():
    html = "<table>" + "".join(f"<tr><td><p>{line}</p></td></tr>" for line in sample().splitlines()) + "</table>"
    html = html.replace("<td><p>Revenue from operations 10,000.00 50,000.00</p></td>",
                        "<td><p>Revenue from operations</p></td><td><p>10,000.00</p></td><td><p>50,000.00</p></td>")
    html = html.replace("<td>", "\n  <td>\n ").replace("</td>", "\n </td>\n")
    result = html_filing(html, ISIN)
    assert fact(result, "revenue")["reportedValue"] == "50000.00"


def test_bounds_and_unreadable_pdfs():
    with pytest.raises(FilingError):
        parse_filing_text("x" * 150001, ISIN)
    with pytest.raises(FilingError):
        pdf_filing(b"not pdf", ISIN)
    with pytest.raises(FilingError):
        pdf_filing(b"%PDFbroken", ISIN)
