# Radar asset coverage, 17 Nov 2026

Personal research watchlist for user-selected NSE/BSE instruments. No orders, no broker account sync and no automatic additions to holdings.

| Asset | Data path implemented | Research model status |
| --- | --- | --- |
| Individual stock | Instrument identity, daily OHLCV, provisional price metrics, completed-session check and dedicated depth diagnostics. No NAV request. | Fundamentals, point-in-time valuations and supported sector models remain unconnected/unimplemented. No live Buy/Hold/Sell model. |
| Gold ETF | Stock-market price/depth path plus exact-ISIN official AMFI NAV, checked secondary historical NAV and date reconciliation. | Gold paper calculations and replay harness implemented. Matching benchmark, adjusted history, dated book and real-data validation remain blocked. |
| Index ETF | Price/depth, available exact-identity NAV/history and date reconciliation. | Requires actual underlying-index mapping, index history/valuation, tracking and model validation. Never uses Gold factors. |
| Other ETF underlying | Recognised as an ETF from provider metadata; available price/depth and exact-identity NAV/history source reads. No silent stock fallback. | Underlying/model needs verification. A Silver, debt, sector or international-exposure ETF is not scored with a Gold or stock model by default. |
| Fund of funds or unverified wrapper | Classification warning and available public price data. | Not a supported direct-ETF research model. No forced recommendation. |

The existing watchlist database field supports the original stock/Gold/index values. Derived instrument kind is authoritative for source routing and UI labels when an ETF does not fit those values. Its saved analysis explicitly uses other_etf; model eligibility remains false. Existing hosted records are not silently rewritten. A future fully supported model/type can add an explicit schema type when its requirements are established.

## What has been verified live

The owner screenshot and read-only saved-snapshot queries confirm the selected Gold ETF's price and NAV-history ingestion. They do not verify every stock, every ETF, depth retrieval, publication times or corporate-action adjustments. Shared-routing and model-isolation tests use synthetic data. The deployment build is not a market-data coverage test.

## Model boundaries

Stock financial companies require different quality and leverage metrics from industrial companies. Index ETFs need their actual index, including valuation and total-return conventions. Debt ETFs need credit, yield and maturity context. Silver requires its own metal, purity, units and valuation source. Foreign-market exposure introduces its own underlying-market calendar and currency basis even when the ETF trades in India.

Hold and exit assessments additionally need actual ownership, allocation/thesis and costs. A watchlist alone supplies none of that. Missing data never becomes an AI-filled value, invented timestamp or forced investment call.
