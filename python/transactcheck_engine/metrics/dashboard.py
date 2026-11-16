from __future__ import annotations

from collections import Counter
from datetime import date
from decimal import Decimal
from typing import Any

from ..models import Diagnostic, RecordResult
from .calculator import calculate_metrics


def _percentage(count: int, total: int) -> str:
    if total == 0:
        return "0.00"
    return format((Decimal(count) * Decimal("100") / Decimal(total)).quantize(Decimal("0.01")), "f")


def _distribution(values: list[str], catalog: list[str] | None = None) -> list[dict[str, Any]]:
    counts = Counter(values)
    if catalog:
        for item in catalog:
            counts.setdefault(item, 0)
    total = len(values)
    return [
        {"value": value, "count": count, "percentage": _percentage(count, total)}
        for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def _temporal_distribution(records: list[RecordResult], grouping: str) -> list[dict[str, Any]]:
    buckets: dict[str, Counter] = {}
    for record in records:
        normalized = record.normalized or {}
        transaction_date = normalized.get("transactionDate")
        if not transaction_date:
            continue
        day = transaction_date[:10]
        try:
            date.fromisoformat(day)
        except ValueError:
            continue
        period = day[:7] if grouping == "month" else day
        bucket = buckets.setdefault(period, Counter())
        bucket["total"] += 1
        bucket[normalized.get("status") or "UNKNOWN"] += 1
    return [
        {
            "period": period,
            "count": counts["total"],
            "statusCounts": {key: value for key, value in counts.items() if key != "total"},
        }
        for period, counts in sorted(buckets.items())
    ]


def build_dashboard_analytics(
    all_records: list[RecordResult],
    selected_records: list[RecordResult],
    files: dict[str, dict[str, Any]],
    all_file_diagnostics: list[Diagnostic],
    selected_file_diagnostics: list[Diagnostic],
    temporal_grouping: str,
) -> dict[str, Any]:
    selected_transactions = [item for item in selected_records if item.category in ("VALID", "INVALID")]
    record_diagnostics = [diagnostic for record in selected_records for diagnostic in record.diagnostics]
    all_selected_diagnostics = record_diagnostics + selected_file_diagnostics
    records_with_warnings = {
        record.record_id for record in selected_transactions
        if any(item.severity == "WARNING" for item in record.diagnostics)
    }
    records_with_errors = {
        record.record_id for record in selected_transactions
        if any(item.severity == "ERROR" for item in record.diagnostics)
    }
    duplicate_records = {
        record.record_id for record in selected_transactions
        if any(item.code == "POSSIBLE_DUPLICATE" for item in record.diagnostics)
    }
    incomplete_records = {
        record.record_id for record in selected_transactions
        if any((record.normalized or {}).get(field) in (None, "UNKNOWN") for field in (
            "transactionId", "source", "status", "transactionDate", "transactionType", "referenceId", "description"
        ))
    }

    file_analysis = []
    for file_id, file_info in files.items():
        records = [item for item in all_records if item.file_id == file_id]
        transactions = [item for item in records if item.category in ("VALID", "INVALID")]
        diagnostics = [diagnostic for item in records for diagnostic in item.diagnostics]
        diagnostics.extend(item for item in all_file_diagnostics if item.source_file == file_info["name"])
        sources = sorted({
            (item.normalized or {}).get("source") or "UNKNOWN" for item in transactions
        })
        file_analysis.append({
            "fileId": file_id,
            "name": file_info["name"],
            "declaredSources": sources,
            "processedTransactions": len(transactions),
            "validTransactions": sum(item.category == "VALID" for item in transactions),
            "invalidTransactions": sum(item.category == "INVALID" for item in transactions),
            "unidentifiedObjects": sum(item.category == "UNIDENTIFIED" for item in records),
            "diagnosticCount": len(diagnostics),
            "possibleDuplicateRecords": sum(
                any(diagnostic.code == "POSSIBLE_DUPLICATE" for diagnostic in item.diagnostics)
                for item in transactions
            ),
        })

    status_catalog = ["APPROVED", "REJECTED", "PENDING", "FAILED", "CANCELLED", "REFUNDED", "UNKNOWN"]
    return {
        "globalMetrics": calculate_metrics(all_records, all_file_diagnostics),
        "filteredMetrics": calculate_metrics(selected_records, selected_file_diagnostics),
        "quality": {
            "recordsWithWarnings": len(records_with_warnings),
            "recordsWithErrors": len(records_with_errors),
            "recordsRequiringReview": len(records_with_warnings | records_with_errors),
            "incompleteRecords": len(incomplete_records),
            "totalDiagnostics": len(all_selected_diagnostics),
            "recordDiagnostics": len(record_diagnostics),
            "fileDiagnostics": len(selected_file_diagnostics),
            "possibleDuplicateRecords": len(duplicate_records),
            "affectedRecords": len({
                record.record_id for record in selected_records if record.diagnostics
            }),
            "affectedFiles": len({item.source_file for item in all_selected_diagnostics}),
        },
        "statusDistribution": _distribution([
            (item.normalized or {}).get("status") or "UNKNOWN" for item in selected_transactions
        ], status_catalog),
        "typeDistribution": _distribution([
            (item.normalized or {}).get("transactionType") or "SIN_TIPO" for item in selected_transactions
        ]),
        "diagnosticCodeDistribution": _distribution([item.code for item in all_selected_diagnostics]),
        "diagnosticSeverityDistribution": _distribution([item.severity for item in all_selected_diagnostics], ["ERROR", "WARNING", "INFO"]),
        "fileAnalysis": file_analysis,
        "temporalDistribution": _temporal_distribution(selected_transactions, temporal_grouping),
    }
