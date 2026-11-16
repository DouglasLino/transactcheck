from __future__ import annotations

from collections import Counter
from decimal import Decimal

from ..models import Diagnostic, RecordResult


def _decimal_text(value: Decimal) -> str:
    return format(value, "f")


def calculate_metrics(records: list[RecordResult], file_diagnostics: list[Diagnostic] | None = None) -> dict:
    transactions = [item for item in records if item.category in ("VALID", "INVALID")]
    valid = [item for item in transactions if item.category == "VALID"]
    invalid = [item for item in transactions if item.category == "INVALID"]
    unidentified = [item for item in records if item.category == "UNIDENTIFIED"]
    status_counts = Counter({status: 0 for status in ("APPROVED", "REJECTED", "PENDING", "FAILED", "CANCELLED", "REFUNDED", "UNKNOWN")})
    status_counts.update((item.normalized or {}).get("status", "UNKNOWN") for item in transactions)
    source_counts = Counter((item.normalized or {}).get("source", "UNKNOWN") for item in transactions)
    type_counts = Counter((item.normalized or {}).get("transactionType") or "SIN_TIPO" for item in transactions)
    currency_totals: dict[str, dict[str, Decimal | int]] = {}
    for item in valid:
        normalized = item.normalized or {}
        currency = normalized["currency"]
        amount = Decimal(normalized["amount"])
        bucket = currency_totals.setdefault(currency, {
            "count": 0,
            "positiveCount": 0,
            "negativeCount": 0,
            "zeroCount": 0,
            "positive": Decimal("0"),
            "negative": Decimal("0"),
            "net": Decimal("0"),
        })
        bucket["count"] += 1
        bucket["net"] += amount
        if amount > 0:
            bucket["positiveCount"] += 1
            bucket["positive"] += amount
        elif amount < 0:
            bucket["negativeCount"] += 1
            bucket["negative"] += amount
        else:
            bucket["zeroCount"] += 1

    record_diagnostics = [diagnostic for item in records for diagnostic in item.diagnostics]
    diagnostics = record_diagnostics + list(file_diagnostics or [])
    severity_counts = Counter(item.severity for item in diagnostics)
    code_counts = Counter(item.code for item in diagnostics)
    processed = len(transactions)
    return {
        "processedTransactions": processed,
        "validTransactions": len(valid),
        "invalidTransactions": len(invalid),
        "unidentifiedObjects": len(unidentified),
        "validPercentage": _decimal_text((Decimal(len(valid)) * Decimal("100") / Decimal(processed)).quantize(Decimal("0.01"))) if processed else "0.00",
        "statusCounts": dict(status_counts),
        "sourceCounts": dict(source_counts),
        "typeCounts": dict(type_counts),
        "currencyTotals": {
            currency: {
                "count": values["count"],
                "positiveCount": values["positiveCount"],
                "negativeCount": values["negativeCount"],
                "zeroCount": values["zeroCount"],
                "positive": _decimal_text(values["positive"]),
                "negative": _decimal_text(values["negative"]),
                "net": _decimal_text(values["net"]),
            }
            for currency, values in currency_totals.items()
        },
        "diagnosticSeverityCounts": dict(severity_counts),
        "diagnosticCodeCounts": dict(code_counts),
        "recordDiagnosticCount": len(record_diagnostics),
        "fileDiagnosticCount": len(file_diagnostics or []),
        "unrecognizedFieldCount": code_counts.get("UNRECOGNIZED_FIELD", 0),
    }
