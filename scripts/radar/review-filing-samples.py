"""Review public CI samples. No network requests, credentials or user records."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "api"))
from _radarfiling import html_filing


def review_samples(folder: Path) -> list[dict]:
    targets = {t["name"]: t for t in json.loads((ROOT / "scripts/radar/source-samples.json").read_text())}
    metadata = json.loads((folder / "probe-result.json").read_text())
    if not isinstance(metadata, list) or len(metadata) != len(targets) or {s.get("name") for s in metadata} != set(targets):
        raise ValueError("Every configured sample must have one retrieval record.")
    summaries = []
    for source in metadata:
        name = source.get("name", "")
        if not re.fullmatch(r"[a-z0-9-]{1,80}", name) or name not in targets or not source.get("ok"):
            raise ValueError("The source sample metadata is invalid.")
        target = targets[name]
        raw = (folder / f"{name}.html").read_bytes()
        if len(raw) > 4_000_000 or hashlib.sha256(raw).hexdigest() != source["sha256"] or source["source"] != target["url"]:
            raise ValueError("The source sample does not match its retrieval provenance.")
        review = html_filing(raw.decode("utf-8"), target["expectedIsin"])
        expected = target.get("expectedReview", {})
        if expected:
            if review["fiscalEnd"] != expected["fiscalEnd"] or review["basis"] != expected["basis"]:
                raise ValueError("The source review period or basis differs from the audited sample.")
            for metric, value in expected["reportedValues"].items():
                facts = [f for f in review["facts"] if f["metric"] == metric]
                if len(facts) != 1 or Decimal(facts[0]["reportedValue"]) != Decimal(value):
                    raise ValueError(f"The audited sample assertion failed for {metric}.")
        references = json.loads((ROOT / "lib/radar/filing-references.json").read_text())
        matched = [r for r in references if r["isin"] == target["expectedIsin"]]
        if len(matched) != 1 or matched[0]["source"] != target["url"] or matched[0]["valuationReady"] is not False:
            raise ValueError("One non-valuation reference must match the source sample.")
        for fact in matched[0]["facts"]:
            actual = [f for f in review["facts"] if f["metric"] == fact["metric"]]
            if len(actual) != 1 or any(actual[0][k] != fact[k] for k in ("periodEnd", "periodKind", "basis", "dimension", "unit")) or any(Decimal(actual[0][k]) != Decimal(fact[k]) for k in ("reportedValue", "normalizedValue")):
                raise ValueError("A reference fact differs from the downloaded public filing.")
        result = {**review, "source": source["source"], "requestStartedAt": source["observedAt"], "sampleAssertionsPassed": bool(expected)}
        (folder / f"{name}.review.json").write_text(json.dumps(result, indent=2))
        summaries.append({"name": name, "parser": review["version"], "factCount": len(review["facts"]),
                          "issues": review["issues"], "sampleAssertionsPassed": bool(expected), "referenceAssertionsPassed": True, "valuationReady": False})
    return summaries


if __name__ == "__main__":
    print(json.dumps(review_samples(Path(sys.argv[1] if len(sys.argv) > 1 else "artifacts/filings"))))
