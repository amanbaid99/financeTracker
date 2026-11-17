# **Investment Radar**

Product Requirements Document · Version 1.0

Development-ready MVP

India · NSE/BSE

Alerts only

**Investment Radar** is a personal, broker-independent investment analysis platform that monitors Indian equities, Gold ETFs and index ETFs, evaluates potential long-term buying opportunities, and sends explainable alerts.

The platform will use a **balanced investment analysis engine** combining price movements, technical indicators, fundamentals, valuations and ETF-specific quality metrics.

The application will not execute trades, access Demat accounts or provide guaranteed investment recommendations.

## **1. Executive product specification**

| Attribute          | Decision                                                |
| ------------------ | ------------------------------------------------------- |
| Product            | Investment Radar                                        |
| Release            | MVP v1.0                                                |
| Primary user       | Individual long-term investor                           |
| Geography          | India                                                   |
| Exchanges          | NSE, BSE                                                |
| Asset classes      | Individual equities, Gold ETFs, broad-market index ETFs |
| Investment horizon | 3–10+ years                                             |
| Monitoring         | End-of-day initially                                    |
| Decision outputs   | Accumulate candidate, Watch, Wait, Insufficient Data    |
| Notifications      | Telegram                                                |
| Execution          | Manual, outside application                             |
| Backend            | Python + FastAPI                                        |
| Frontend           | Next.js + TypeScript                                    |
| Database/auth      | Supabase PostgreSQL                                     |
| Hosting            | Vercel + scheduled worker                               |
| AI                 | Optional structured LLM explanation                     |
| Broker dependency  | None                                                    |

### **Product objective**

Help a long-term investor answer three questions:

1. Is this asset currently offering a potentially attractive accumulation opportunity?
2. What quantitative evidence supports or contradicts that opportunity?
3. At what price or under what conditions should I reconsider buying?

### **Non-goals**

The MVP will not support automated orders, broker APIs, intraday trading, derivatives, price prediction, investment advice tailored to a regulated advisory mandate, or portfolio optimisation.

## **2. Primary user journey**

1. **Create an account**

   Sign in with email and password.
2. **Add instruments**

   Search NSE/BSE instruments by company name, ticker or ISIN. Add them to a personal watchlist.
3. **Review investment analysis**

   See latest price, historical performance, valuation, risk metrics, opportunity score and explanation.
4. **Configure alert rules**

   Select price thresholds, drawdown levels, minimum scores and notification preferences.
5. **Receive opportunity alerts**

   Get a Telegram notification when qualifying conditions are met.
6. **Make an independent investment decision**

   Review the signal and execute manually through any broker.

## **3. Functional requirements**

| ID    | Requirement                                | Priority |
| ----- | ------------------------------------------ | -------- |
| FR-01 | Email/password registration and login      | P0       |
| FR-02 | Instrument search with NSE/BSE identifiers | P0       |
| FR-03 | Personal watchlist, add/remove             | P0       |
| FR-04 | Historical OHLCV chart                     | P0       |
| FR-05 | 30/90/252-session drawdowns                | P0       |
| FR-06 | RSI(14), SMA(50), SMA(200), volatility     | P0       |
| FR-07 | Stock valuation and fundamental metrics    | P0       |
| FR-08 | Gold ETF NAV premium and liquidity checks  | P0       |
| FR-09 | Index ETF valuation and tracking checks    | P0       |
| FR-10 | Asset-specific opportunity score           | P0       |
| FR-11 | Configurable threshold rules               | P0       |
| FR-12 | Signal rationale and blocking conditions   | P0       |
| FR-13 | Telegram alert delivery                    | P0       |
| FR-14 | Historical signal and alert log            | P0       |
| FR-15 | Data freshness and source status           | P0       |
| FR-16 | AI-generated explanations                  | P1       |
| FR-17 | Backtesting against simple baselines       | P1       |
| FR-18 | Strategy performance dashboard             | P1       |

The application should not display an accumulation candidate when critical data is missing, stale or inconsistent.

## **4. Technical architecture**

**Next.js application**

Authentication · Watchlists · Charts · Rules · Signal history

**FastAPI backend**

Authenticated APIs · Validation · User rules · Analysis retrieval

**Supabase**

PostgreSQL, auth, market history, signals

**Worker**

Scheduled ingestion, analysis, alerts

**Market data adapters**

Prices, fundamentals, ETF NAV

**Telegram API**

Alerts and delivery feedback

### **Runtime architecture**

The system will have two independent execution paths.

**Interactive path:** Next.js → FastAPI → Supabase. This handles authentication, searching instruments, viewing analysis, and managing user-defined alert rules.

**Background path:** Scheduler → Data ingestion → Validation → Indicator calculations → Scoring → Signal persistence → Rule evaluation → Notification queue → Telegram.

A failure in the Telegram service must not prevent market data or signal calculations from completing. Similarly, an AI service outage must not prevent deterministic scoring.

### **Data-provider design**

Implement three interfaces rather than hardcoding a single vendor:

```
class PriceProvider:    def get_daily_candles(self, instrument_id, start, end): ...    def get_latest_quote(self, instrument_id): ...class FundamentalsProvider:    def get_financial_snapshot(self, instrument_id, as_of): ...class ETFProvider:    def get_nav(self, instrument_id, as_of): ...    def get_tracking_metrics(self, instrument_id, as_of): ...
```

Every adapter must return a normalized response with source name, source timestamp, retrieval timestamp, currency, units, data-quality status and error information.

For the initial release, use one verified provider for daily prices, with separate providers where necessary for fundamentals and ETF NAV. Do not silently substitute stale values when a provider fails.

**External dependency gate:** The first development milestone must establish an accessible, legally usable Indian market-data source. Fundamental history and historical ETF NAV may require different providers. If a required field is unavailable, the affected scoring model must fail safely rather than fabricate the missing value.

## **5. Database schema**

Use PostgreSQL with UUID primary keys, `timestamptz` for event timestamps, and `date` for trading sessions.

The schema below defines the logical model. SQL migrations should implement foreign keys, indexes, checks, policies and triggers.

### **Core tables**

| Table                   | Important columns                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `profiles`              | `user_id`, `timezone`, `created_at`                                                                                   |
| `instruments`           | `id`, `isin`, `exchange`, `symbol`, `name`, `asset_type`, `currency`, `active`                                        |
| `watchlist_items`       | `id`, `user_id`, `instrument_id`, `created_at`                                                                        |
| `price_candles`         | `instrument_id`, `session_date`, `open`, `high`, `low`, `close`, `volume`, `source_id`, `fetched_at`                  |
| `fundamental_snapshots` | `id`, `instrument_id`, `period_end`, `published_at`, `available_at`, `metrics`, `source_id`                           |
| `etf_snapshots`         | `id`, `instrument_id`, `session_date`, `nav`, `inav`, `premium_pct`, `spread_pct`, `tracking_difference`, `source_id` |
| `index_snapshots`       | `id`, `underlying_index_id`, `session_date`, `pe`, `pb`, `dividend_yield`, `source_id`                                |
| `indicator_snapshots`   | `id`, `instrument_id`, `session_date`, `rsi_14`, `sma_50`, `sma_200`, `volatility_60d`, `drawdowns`, `engine_version` |
| `strategies`            | `id`, `user_id`, `instrument_id`, `config`, `enabled`, `version`                                                      |
| `signals`               | `id`, `instrument_id`, `session_date`, `strategy_version`, `score`, `status`, `reasons`, `blockers`, `input_hash`     |
| `alert_rules`           | `id`, `user_id`, `instrument_id`, `rule_type`, `parameters`, `enabled`, `cooldown_hours`                              |
| `alert_events`          | `id`, `rule_id`, `signal_id`, `triggered_at`, `dedupe_key`, `delivery_status`, `delivered_at`                         |
| `notification_channels` | `id`, `user_id`, `channel`, `destination_ref`, `verified_at`, `enabled`                                               |
| `data_sources`          | `id`, `provider_name`, `dataset`, `license_metadata`, `active`                                                        |
| `pipeline_runs`         | `id`, `job_type`, `started_at`, `finished_at`, `status`, `error_summary`                                              |

### **Database constraints**

- Unique instrument identity: `(exchange, symbol)` for active instruments, with ISIN retained for cross-exchange mapping.
- Unique daily candles: `(instrument_id, session_date, source_id)`.
- Unique watchlist entries: `(user_id, instrument_id)`.
- Unique notification events: `dedupe_key`.
- Numeric prices and financial metrics must use `numeric`, not floating-point storage for monetary amounts.
- `metrics`, `config`, `reasons`, `blockers` and `parameters` may use `jsonb`, validated against versioned application schemas.
- Every signal must reference the exact indicator, fundamental and ETF snapshot versions used to calculate it.
- Historical fundamentals must retain their actual publication and availability dates to prevent look-ahead bias.

For the initial personal-use deployment, authenticated users should only access their own watchlists, strategies, alert rules and notification channels. Market data can be shared read-only across accounts.

Supabase Row Level Security must be enabled on user-owned tables. Service-role credentials stay server-side and are never exposed to the browser.

### **Example strategy configuration**

```

{
  "strategy_id": "balanced-v1",
  "asset_type": "gold_etf",
  "evaluation_frequency": "EOD",
  "score_thresholds": {
    "accumulate": 75,
    "watch": 55
  },
  "drawdown": {
    "lookback_sessions": 90,
    "minimum_pct": 5
  },
  "risk_gates": {
    "max_nav_premium_pct": 1.0,
    "max_spread_pct": 0.5,
    "require_fresh_nav": true
  },
  "alert": {
    "channel": "telegram",
    "cooldown_hours": 72,
    "notify_on_transition": true
  }
}

```

These are example configurable thresholds, not empirically validated trading rules.

## **6. Analysis engine specification**

### **6.1 Shared calculations**

All asset types use a common market-data foundation:

| Indicator        | Calculation                                             |
| ---------------- | ------------------------------------------------------- |
| Drawdown         | `(current_price / rolling_high - 1) × 100`              |
| RSI              | Wilder's RSI, 14 completed sessions                     |
| SMA50            | Mean adjusted closing price over 50 sessions            |
| SMA200           | Mean adjusted closing price over 200 sessions           |
| Volatility       | Annualised standard deviation of 60 daily log returns   |
| 52-week range    | Highest high and lowest low across 252 trading sessions |
| Volume/liquidity | 20-session average traded value and volume              |

Use corporate-action-adjusted history where appropriate. ETF distributions, stock splits and other adjustments must be handled consistently.

A signal must identify whether its price is a completed-session close or an intraday quote. The MVP uses completed daily candles only.

### **6.2 Gold ETF scoring**

Gold ETF scoring weights

Initial proposed weights, subject to validation.

0%8%16%24%32%DrawdownNAV premiumMomentumLiquidityVolatility

Each factor receives a normalized 0–100 subscore. The final score is the weighted sum.

Mandatory risk gates override the score when NAV data is unavailable, ETF spreads exceed the configured maximum, or the price data is stale.

A Gold ETF should not be classified as cheap simply because its traded price is below a previous high. Gold's underlying market price and the ETF's relationship to NAV are separate considerations.

### **6.3 Index ETF scoring**

| Factor                          | Weight |
| ------------------------------- | ------ |
| Underlying index valuation      | 35%    |
| Index drawdown                  | 25%    |
| Momentum and volatility         | 20%    |
| ETF NAV, tracking and liquidity | 20%    |

The index ETF analyser should use the **underlying index** for valuation and market trend calculations, and the **ETF itself** for execution-quality metrics such as spreads and premiums.

### **6.4 Individual stock scoring**

| Factor                         | Weight |
| ------------------------------ | ------ |
| Fundamental quality            | 30%    |
| Valuation                      | 30%    |
| Earnings and growth            | 20%    |
| Price and technical conditions | 20%    |

Fundamental quality should consider profitability, leverage, cash-flow generation and consistency. Valuation should compare appropriate metrics against the company's historical range and relevant peers.

Financial companies require sector-specific metrics; they should not be scored using industrial-company debt and cash-flow rules. For MVP v1, unsupported sectors should return **Insufficient Data / Unsupported Model** rather than an unreliable score.

### **6.5 Signal evaluation algorithm**

```
def evaluate_instrument(instrument, data, strategy):    quality = validate_data(data, instrument.asset_type)    if not quality.passed:        return Signal(            status="INSUFFICIENT_DATA",            score=None,            blockers=quality.failures        )    indicators = calculate_indicators(data.prices)    model = get_asset_model(instrument.asset_type)    factors = model.calculate_factors(data, indicators)    blockers = model.evaluate_risk_gates(        data, factors, strategy    )    score = model.calculate_weighted_score(factors)    if blockers:        status = "WAIT"    elif score >= strategy.accumulate_threshold:        status = "ACCUMULATE_CANDIDATE"    elif score >= strategy.watch_threshold:        status = "WATCH"    else:        status = "WAIT"    return Signal(        status=status,        score=score,        factors=factors,        blockers=blockers,
```

The actual implementation should separate hard data-quality failures from investment risk blockers, preserve every calculation input and produce deterministic outputs.

### **6.6 AI explanation contract**

AI will receive structured facts, not raw authority to decide whether to buy.

Example input:

```

{
  "instrument": "EXAMPLE_ETF",
  "asset_type": "gold_etf",
  "signal": "WATCH",
  "score": 68,
  "metrics": {
    "drawdown_90d_pct": -4.8,
    "rsi_14": 43,
    "nav_premium_pct": 0.7
  },
  "blockers": [],
  "data_as_of": "2026-11-16"
}

```

The LLM should return a validated JSON object containing `summary`, `positive_factors`, `risks`, `conditions_to_monitor` and `data_limitations`.

It must not invent prices, forecast returns, change the deterministic signal, or suggest a purchase amount without a separate, explicitly configured budgeting model.

## **7. API specification**

Use REST endpoints under `/api/v1`.

| Method | Endpoint                          | Purpose                              |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/instruments/search?q=`          | Search supported instruments         |
| GET    | `/instruments/{id}`               | Instrument metadata                  |
| GET    | `/instruments/{id}/candles`       | Historical prices                    |
| GET    | `/instruments/{id}/analysis`      | Latest analysis and signal           |
| GET    | `/instruments/{id}/signals`       | Historical signals                   |
| GET    | `/watchlist`                      | Retrieve personal watchlist          |
| POST   | `/watchlist`                      | Add instrument                       |
| DELETE | `/watchlist/{id}`                 | Remove instrument                    |
| GET    | `/strategies`                     | Retrieve configured strategies       |
| PUT    | `/strategies/{id}`                | Update strategy configuration        |
| GET    | `/alerts/rules`                   | List alert rules                     |
| POST   | `/alerts/rules`                   | Create rule                          |
| PATCH  | `/alerts/rules/{id}`              | Modify or disable rule               |
| GET    | `/alerts/history`                 | Retrieve alert history               |
| POST   | `/notifications/telegram/connect` | Initiate Telegram linking            |
| GET    | `/system/data-health`             | Latest pipeline and freshness status |

All user-specific endpoints require authentication. Instrument IDs should be stable internal UUIDs, not user-provided symbols alone.

### **Standard analysis response**

```

{
  "instrument_id": "uuid",
  "symbol": "EXAMPLE",
  "asset_type": "equity",
  "as_of": "2026-11-16",
  "price": {
    "close": 1250.50,
    "currency": "INR"
  },
  "analysis": {
    "status": "WATCH",
    "score": 67,
    "confidence": null,
    "model_version": "1.0.0",
    "factors": [],
    "blockers": [],
    "data_quality": "VALID"
  },
  "disclaimer": "Research signal, not an order."
}

```

The `confidence` field is deliberately null until a statistically meaningful, validated confidence measure exists. A score must not be misrepresented as predictive certainty.

## **8. Background jobs and alert reliability**

| Job                    | Frequency                   | Responsibility                        |
| ---------------------- | --------------------------- | ------------------------------------- |
| Instrument sync        | Weekly                      | Refresh supported instrument metadata |
| Daily price ingestion  | After market close          | Fetch completed OHLCV candles         |
| Fundamentals ingestion | Daily check                 | Ingest newly published statements     |
| ETF NAV ingestion      | After NAV publication       | Refresh NAV and related metrics       |
| Indicator calculation  | After data validation       | Recompute affected instruments        |
| Signal generation      | After indicator calculation | Persist model output                  |
| Alert evaluation       | After signals               | Match configured rules                |
| Notification delivery  | Queue-driven                | Send Telegram alerts                  |
| Health monitoring      | Scheduled                   | Detect missing or failed runs         |

Use `Asia/Kolkata` for user-facing schedules, but store event timestamps in UTC. An exchange calendar must account for weekends, trading holidays and special sessions.

**Alert reliability requirements:** Generate a unique deduplication key from the user, instrument, rule, signal transition and relevant evaluation window. Persist the event before attempting delivery, retry transient failures with backoff, and retain delivery attempts for auditing.

Telegram delivery cannot be assumed to be exactly once. The system should minimise duplicates and expose delivery status.

## **9. Backtesting requirements**

A buying signal is only useful if we can evaluate how the strategy behaves over time.

The backtesting module should support a configurable historical window, starting capital, monthly contributions, staged purchases, cash balance and transaction costs.

Compare against three baselines:

- Fixed monthly investment.
- Immediate investment when cash becomes available.
- Simple percentage-dip buying without valuation scoring.

### **Performance measures**

| Metric                       | Why it matters                         |
| ---------------------------- | -------------------------------------- |
| Annualised return / XIRR     | Investment performance with cash flows |
| Maximum drawdown             | Downside exposure                      |
| Invested vs idle cash        | Opportunity cost of waiting            |
| Signal frequency             | Whether alerts are practical           |
| Forward 3/6/12-month returns | Outcomes following historical signals  |
| Baseline outperformance      | Whether added complexity helps         |
| Turnover and costs           | Realistic implementation impact        |

Backtests must use point-in-time fundamentals, available-at dates, appropriate historical instrument membership, and realistic assumptions about price availability and execution.

For Gold and index ETFs, compare the timing strategy against a regular accumulation plan. For stocks, account for delisted companies and survivorship bias.

**No automatic strategy optimisation on the test dataset.** Parameters should be developed on training data and evaluated on separate out-of-sample periods.

## **10. Implementation milestones**

**Proposed development roadmap**

Estimated 5–7 weeks

Indicative for one experienced developer using AI-assisted development, assuming usable data APIs are available. Provider onboarding may extend the timeline.

01

**Foundation and data**

Week 1

Repository, environment, Supabase migrations, authentication, provider validation, historical ingestion

02

**Analysis engine**

Week 2

Indicators, factor normalization, asset-specific models, risk gates, unit tests

03

**Application dashboard**

Week 3

Watchlists, charts, analysis details, rule configuration

04

**Scheduled monitoring**

Week 4

Background workers, signal persistence, Telegram alerts, retries, observability

05

**Backtesting and QA**

Week 5

Historical simulations, integration tests, edge cases, security review

06

**Validation and launch**

Weeks 6–7

Paper monitoring, threshold calibration, bug fixes, release readiness

### **Recommended repository structure**

```

investment-radar/
├── apps/
│   └── web/                  # Next.js frontend
├── services/
│   ├── api/                  # FastAPI routes
│   ├── ingestion/            # Market data adapters
│   ├── analysis/             # Financial analysis engine
│   │   ├── indicators/
│   │   ├── models/
│   │   │   ├── gold_etf.py
│   │   │   ├── index_etf.py
│   │   │   └── equity.py
│   │   ├── scoring.py
│   │   └── risk_gates.py
│   ├── alerts/               # Rule evaluation
│   └── notifications/        # Telegram delivery
├── packages/
│   └── contracts/            # Shared API schemas
├── supabase/
│   └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── backtesting/
├── infra/
│   └── schedules/
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    └── DATA_CONTRACTS.md

```

## **11. Acceptance criteria**

These are the conditions required to declare MVP v1 complete.

**MVP release checklist**

Track implementation readiness

0/21

**Market data**

Search and identify supported instruments by ticker or ISIN

Load at least 252 valid trading sessions for eligible instruments

Display source timestamps and flag stale or missing data

Handle provider failure without fabricating values

**Analysis**

Calculate indicators matching independently tested reference calculations

Apply separate Gold ETF, index ETF and equity models

Reproduce the same signal from the same inputs and model version

Prevent accumulation signals when mandatory risk gates fail

Return Insufficient Data when required inputs are unavailable

**Alerts**

Create, edit, enable and disable alert rules

Deliver a qualifying signal to a linked Telegram account

Suppress duplicate alerts during the configured cooldown

Record failed deliveries and retry transient errors

**Application and security**

Allow authenticated users to manage their own watchlists

Prevent users from reading or modifying other users' private records

Display rationale, blockers, data timestamp and model version

Keep service credentials and provider keys off the client

**Validation**

Backtest against periodic-investing and simple-dip baselines

Prevent look-ahead bias in historical calculations

Pass automated unit and integration tests

Complete a monitored dry run before launch

&#x20;Copy release checklist

## **12. Risks and unresolved dependencies**

| Risk                               | Mitigation                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Indian market-data licensing       | Validate provider rights before integration                                                                          |
| Incomplete historical fundamentals | Use point-in-time data or disable affected backtests                                                                 |
| ETF NAV publication delays         | Separate latest traded price from latest available NAV                                                               |
| False buying signals               | Risk gates, transparent scoring and backtesting                                                                      |
| AI hallucinations                  | Structured inputs, schema validation, deterministic decisions                                                        |
| Excessive alerts                   | Cooldowns and signal-transition rules                                                                                |
| Regulatory considerations          | Keep v1 as a personal research tool; review SEBI requirements before offering personalised recommendations to others |

There are three decisions that should be resolved during Phase 1: the actual market-data provider, the initial supported instrument universe, and whether v1 is strictly for personal use or intended for other users. These materially affect cost, licensing and compliance.

## **13. Recommended first development sprint**

I would start with a **vertical slice**, rather than building the entire UI and analysis engine simultaneously.

The first working version should support three representative instruments: one Gold ETF, one Nifty 50 ETF and one Indian equity.

It should ingest historical prices, calculate the available indicators, generate an explainable signal, display that signal on a basic web page, and send one test Telegram alert.

Once this works end to end, expand into fundamentals, ETF-specific analysis, watchlist management and backtesting.

This gives us an early test of the most important product assumption: **can the system produce a reliable, explainable investment signal from data we can actually obtain?**

The PRD, architecture, logical database schema, API contracts, development milestones and release criteria are now defined. The remaining work is to select and validate the market-data sources, then translate this specification into migrations, development tickets and executable tests.

The next engineering task should be **Sprint 1: Market Data Foundation**, because data availability determines which parts of the balanced analysis engine can be implemented reliably.