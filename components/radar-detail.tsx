"use client";

import { useISTDay } from "@/lib/use-ist-day";

import { RadarInsight } from "@/components/radar-insight";
import { LevelChips } from "@/components/radar-levels";
import { experimentalInsight, suggestedLevels } from "@/lib/radar/insight";
import { historyBasisText } from "@/lib/radar/history-policy";
import { RadarHoldingReview } from "@/components/radar-holding-review";
import { positionContext } from "@/lib/radar/holding-review";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import {
  marketPrice,
  assetLabels,
  assetTypes,
  type RadarAsset,
  type RadarSnapshot,
  type WatchItem,
} from "@/lib/radar/contracts";
import { refreshRadar, removeRadar, saveRadarRules } from "@/lib/radar/actions";
import { StockFinancialsView } from "@/components/radar-stock-financials";
import { NavHistoryView } from "@/components/radar-nav-history";
import { RadarResearch } from "@/components/radar-research";
import { automaticResearch } from "@/lib/radar/research";
import { classifyInstrument, needsEtfEvidence } from "@/lib/radar/classification";
import { todayIST } from "@/lib/dates";
import { RadarSignal } from "@/components/radar-signal";
import { ruleSignal, savedRules, etfChecks } from "@/lib/radar/rule-signal";
import { previousCompletedSession } from "@/lib/radar/calendar";
import { formatINR, formatDate } from "@/lib/format";

function PriceChart({ snapshot }: { snapshot: RadarSnapshot }) {
  const candles = snapshot.candles;
  if (candles.length < 2)
    return (
      <p className="text-sm text-muted-foreground">
        More completed sessions are needed for a chart.
      </p>
    );
  const min = Math.min(...candles.map((c) => c.close));
  const max = Math.max(...candles.map((c) => c.close));
  const points = candles
    .map(
      (c, i) =>
        `${8 + (i / (candles.length - 1)) * 304},${112 - ((c.close - min) / (max - min || 1)) * 100}`,
    )
    .join(" ");
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground tabular">
        <span>{marketPrice(min)}</span>
        <span>{marketPrice(max)}</span>
      </div>
      <svg
        role="img"
        aria-label={`Daily closing prices from ${candles[0].date} to ${candles.at(-1)!.date}. Latest ${marketPrice(candles.at(-1)!.close)}. ${historyBasisText(snapshot.analysis.inputs.historyPolicy)}`}
        viewBox="0 0 320 120"
        className="w-full h-36 text-primary"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{formatDate(candles[0].date)}</span>
        <span>{formatDate(candles.at(-1)!.date)}</span>
      </div>
    </div>
  );
}

export function RadarDetail({
  item,
  snapshot,
  connected,
  financialsConfigured = false,
  today: serverDay,
  now,
}: {
  item: WatchItem;
  snapshot: RadarSnapshot | null;
  connected: boolean;
  financialsConfigured?: boolean;
  today: string;
  now: string;
}) {
  const today = useISTDay(serverDay);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState(false);
  const [price, setPrice] = useState(item.priceBelow?.toString() ?? "");
  const [dip, setDip] = useState(item.drawdownPct?.toString() ?? "");
  const [asset, setAsset] = useState<RadarAsset>(item.assetType);
  const [enabled, setEnabled] = useState(item.rules?.rulesEnabled ?? false);
  const [owned, setOwned] = useState(item.rules?.holdingConfirmed ?? false);
  const [upper, setUpper] = useState(item.rules?.sellAbove?.toString() ?? "");
  const [lower, setLower] = useState(item.rules?.sellBelow?.toString() ?? "");
  const router = useRouter();
  const a = snapshot?.analysis;
  const classification = item.classification ?? classifyInstrument(item, a?.etf?.nav);
  const isEtf = needsEtfEvidence(item.assetType, classification);
  const market = a?.market ?? a?.etf;
  const expected = previousCompletedSession(today, item.exchange);
  const research = automaticResearch({
    analysis: a ?? null,
    candles: snapshot?.candles ?? [],
    asset: item.assetType,
    classification:
      item.classification ?? classifyInstrument(item, a?.etf?.nav),
    isin: item.isin,
    exchange: item.exchange,
    today,
    now,
    positionContext: positionContext(item.holdingReview, item.isin, item.holdingContext),
    owned:
      item.ownedInTracker === true || item.rules?.holdingConfirmed === true,
  });
  const insight = experimentalInsight({
    today, exchange: item.exchange,
    analysis: a ?? null,
    owned:
      item.ownedInTracker === true || item.rules?.holdingConfirmed === true,
    stockStudy: research.stockStudy,
  });
  const levels = suggestedLevels(a ?? null, { today, exchange: item.exchange }, snapshot?.candles ?? []);
  const decision = ruleSignal({
    analysis: a ?? null,
    rules: savedRules(item),
    classificationVerified: !classification.needsReview,
    asset: item.assetType,
    evidence: a?.etf,
    expectedSession: expected,
    now,
  });
  const checks = isEtf && a ? etfChecks(a, a.etf, expected, now) : null;
  function refresh() {
    start(async () => {
      setError("");
      setNotice("");
      const result = await refreshRadar(item.id);
      if (!result.ok) setError(result.error ?? "Try again.");
      else {
        setNotice(
          "Research data refreshed. The automatic assessment has been updated.",
        );
        router.refresh();
      }
    });
  }
  const pct = (v: number | null | undefined) =>
    v == null ? "Unavailable" : `${v.toFixed(1)}%`;
  return (
    <div className="space-y-5">
      <RadarInsight insight={insight} />
      <RadarResearch
        result={research}
        onRefresh={refresh}
        pending={pending}
        connected={connected}
      />
      {(item.holdingContext?.matched || item.rules?.holdingConfirmed || item.holdingReview) && (
        <details className="rounded-2xl border bg-card px-4">
          <summary className="min-h-11 flex cursor-pointer items-center font-medium">Your holding</summary>
          <div className="pb-4 space-y-3 text-sm">
            {item.holdingContext?.recordedValue != null ? (
              <dl className="space-y-2">
                <div className="flex flex-wrap justify-between gap-2"><dt>Recorded value</dt><dd className="tabular font-medium">{formatINR(item.holdingContext.recordedValue)}</dd></div>
                {item.holdingContext.trackedSharePct != null && <div className="flex flex-wrap justify-between gap-2"><dt>Share of tracked investments</dt><dd className="tabular font-medium">{item.holdingContext.trackedSharePct.toFixed(1)}%</dd></div>}
              </dl>
            ) : <p>A current matched holding value is unavailable.</p>}
            {((classification.kind === "stock" && !classification.needsReview && item.isin) || item.holdingReview) && <RadarHoldingReview id={item.id} review={item.holdingReview} canSave={classification.kind === "stock" && !classification.needsReview && !!item.isin && (item.ownedInTracker === true || item.rules?.holdingConfirmed === true)} />}
            <p className="text-muted-foreground">Values saved in Tracker, not a live broker balance. This share is not a target allocation. Holding details do not establish a buy, hold or sell recommendation.</p>
          </div>
        </details>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm rounded-xl bg-danger-soft text-danger p-3"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}

      <section className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Last available daily close
            </p>
            <p className="tabular text-3xl font-semibold mt-1">
              {a?.close != null ? marketPrice(a.close) : "Unavailable"}
            </p>
            {a?.asOf && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(a.asOf)} · INDstocks
              </p>
            )}
          </div>

        </div>
        {snapshot && <PriceChart snapshot={snapshot} />}
        <p className="text-xs text-muted-foreground">
          {snapshot
            ? `Fetched ${formatDate(todayIST(new Date(snapshot.fetchedAt)))}. ${a?.sessions ?? 0} sessions. ${historyBasisText(a?.inputs.historyPolicy)}`
            : "Refresh to fetch daily prices. No price or buying signal is assumed."}
        </p>
      </section>
      <section className="rounded-2xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold">{isEtf ? "ETF value and trading checks" : "Trading data"}</h2>
          <dl className="divide-y text-sm">
            {isEtf && <>
            <div className="flex justify-between gap-3 py-2">
              <dt>Official NAV</dt>
              <dd className="tabular text-right">
                {a?.etf?.nav
                  ? `${marketPrice(a.etf.nav.nav)} · ${formatDate(a.etf.nav.date)}`
                  : "Unavailable"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt>Close vs same-day NAV</dt>
              <dd className="tabular">
                {checks?.premiumPct == null
                  ? "Unavailable"
                  : `${checks.premiumPct.toFixed(2)}%`}
              </dd>
            </div>
            </>}
            <div className="flex justify-between gap-3 py-2">
              <dt>Fetched bid-ask spread</dt>
              <dd className="tabular">
                {market?.depth
                  ? `${market.depth.spreadPct.toFixed(2)}%`
                  : market ? "Unavailable" : "Not fetched"}
              </dd>
            </div>
          </dl>
          {isEtf && (a?.etf?.navHistory ? (
            <NavHistoryView history={a.etf.navHistory} candles={snapshot?.candles ?? []} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Historical NAV is not saved for this snapshot. Refresh research to
              fetch it after the official latest NAV is available.
            </p>
          ))}
          {isEtf ? <p className="text-xs text-muted-foreground">
            NAV is matched by ISIN from AMFI. A previous-day NAV is not used as
            a live fair value. Spread freshness is{" "}
            {checks?.spreadFresh ? "verified for this check" : "unverified"}.
          </p> : <p className="text-xs text-muted-foreground">
            Market depth is trading information, not a stock valuation. The REST
            source does not establish a verified book timestamp.
          </p>}
          {market?.depthStatus && (
            <p className="text-xs text-muted-foreground">{market.depthStatus.message}</p>
          )}
          {market?.errors.filter((e) => e !== market.depthStatus?.message).map((e) => (
            <p key={e} className="text-xs text-muted-foreground">
              {e}
            </p>
          ))}
          {isEtf && a?.etf?.nav && (
            <a
              className="inline-flex min-h-11 items-center text-sm text-primary"
              href="https://www.amfiindia.com/net-asset-value/nav-download"
              target="_blank"
              rel="noreferrer"
            >
              View official NAV source
            </a>
          )}
        </section>
      {classification.kind === "stock" && (
        <StockFinancialsView evidence={a?.financials} error={a?.financialsError} configured={financialsConfigured} isin={item.isin} />
      )}
      {a && (
        <section className="rounded-2xl border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Price indicators</h2>
          <dl className="divide-y text-sm">
            {[
              ["Below 30-session high", pct(a.technicals.drawdown30)],
              ["Below 90-session high", pct(a.technicals.drawdown90)],
              ["Below 252-session high", pct(a.technicals.drawdown252)],
              ["RSI (14)", a.technicals.rsi14?.toFixed(1) ?? "Unavailable"],
              [
                "50-session average",
                a.technicals.sma50 == null
                  ? "Unavailable"
                  : marketPrice(a.technicals.sma50),
              ],
              [
                "200-session average",
                a.technicals.sma200 == null
                  ? "Unavailable"
                  : marketPrice(a.technicals.sma200),
              ],
              ["Annualised volatility", pct(a.technicals.volatility60)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between items-baseline gap-3 py-2.5"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular font-medium text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <details
        id="radar-rules"
        className="scroll-mt-16 rounded-2xl border bg-card p-4 space-y-3"
      >
        <summary className="min-h-11 flex items-center cursor-pointer font-semibold">
          Optional price alerts
        </summary>
        {enabled && <RadarSignal signal={decision} />}
        <p className="text-sm text-muted-foreground">
          Choose a price to buy at or below, and if you own it, a price to take
          profit and a price to rethink holding. The suggestions come from this
          stock&apos;s own year of prices: its long-term average, its usual
          swing and its one-year high and low. Pick the one that matches how
          patient you are, then save. No notifications or trades are sent.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError("");
              setNotice("");
              const result = await saveRadarRules({
                id: item.id,
                assetType: asset,
                rulesEnabled: enabled,
                holdingConfirmed: owned,
                sellAbove: owned && upper ? Number(upper) : null,
                sellBelow: owned && lower ? Number(lower) : null,
                priceBelow: price ? Number(price) : null,
                drawdownPct: dip ? Number(dip) : null,
              });
              if (!result.ok) setError(result.error ?? "Try again.");
              else {
                setNotice(
                  "Thresholds saved. Notifications are not enabled yet.",
                );
                router.refresh();
              }
            });
          }}
        >
          {classification.kind === "etf" && !classification.asset ? (
            <p className="text-sm text-muted-foreground">
              This ETF needs its own underlying model. Stock and Gold model
              settings cannot be used to bypass its entry data checks.
            </p>
          ) : <Field
            label="Investment type"
            htmlFor="radar-type"
            hint="Refresh data after changing the type to run its data checks."
          >
            <Select
              id="radar-type"
              value={asset}
              onChange={(e) => setAsset(e.target.value as RadarAsset)}
            >
              {assetTypes.map((t) => (
                <option key={t} value={t}>
                  {assetLabels[t]}
                </option>
              ))}
            </Select>
          </Field>}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Enable manual price alerts</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={owned}
              onChange={(e) => setOwned(e.target.checked)}
            />
            <span>I currently hold this investment</span>
          </label>
          <Field
            label="Buy price at or below (₹, optional)"
            htmlFor="radar-price"
          >
            <Input
              id="radar-price"
              type="number"
              inputMode="decimal"
              min="0.0001"
              max="100000000"
              step="0.0001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <LevelChips
            options={levels.buy}
            onPick={(v) => setPrice(String(v))}
          />
          <Field
            label="Drop from 90-session high (%, optional)"
            htmlFor="radar-dip"
          >
            <Input
              id="radar-dip"
              type="number"
              inputMode="decimal"
              min="1"
              max="80"
              step="0.01"
              value={dip}
              onChange={(e) => setDip(e.target.value)}
            />
          </Field>
          {owned && (
            <div className="space-y-3">
              <Field
                label="Sell price at or above (₹, optional)"
                htmlFor="radar-upper"
              >
                <Input
                  id="radar-upper"
                  type="number"
                  inputMode="decimal"
                  min="0.0001"
                  max="100000000"
                  step="0.0001"
                  value={upper}
                  onChange={(e) => setUpper(e.target.value)}
                />
              </Field>
              <LevelChips
                options={levels.sell}
                onPick={(v) => setUpper(String(v))}
              />
              <Field
                label="Exit price at or below (₹, optional)"
                htmlFor="radar-lower"
              >
                <Input
                  id="radar-lower"
                  type="number"
                  inputMode="decimal"
                  min="0.0001"
                  max="100000000"
                  step="0.0001"
                  value={lower}
                  onChange={(e) => setLower(e.target.value)}
                />
              </Field>
              <LevelChips
                options={levels.exit}
                onPick={(v) => setLower(String(v))}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Changes take effect after you save. Review your absolute price
            thresholds after any split or other corporate action.
          </p>
          <Button type="submit" variant="outline" disabled={pending}>
            Save thresholds
          </Button>
        </form>
      </details>
      <section className="space-y-2">
        {removing ? (
          <div className="rounded-xl border p-4 space-y-3">
            <p className="text-sm">
              Remove this watchlist item and its fetched history? Your actual
              holdings stay as they are.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await removeRadar(item.id);
                    if (!result.ok) setError(result.error ?? "Try again.");
                    else {
                      router.push("/radar");
                      router.refresh();
                    }
                  })
                }
              >
                Yes, remove
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setRemoving(false)}
              >
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setRemoving(true)}>
            Remove from watchlist
          </Button>
        )}
      </section>
    </div>
  );
}
