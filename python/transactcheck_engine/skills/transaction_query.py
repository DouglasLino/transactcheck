from __future__ import annotations

from collections import Counter
from decimal import Decimal
from typing import Any

from ..metrics import calculate_metrics
from ..models import Diagnostic, RecordResult


ALLOWED_OPERATIONS = {
    "summary",
    "count_by",
    "extreme_amount",
    "duplicate_groups",
    "frequent_inconsistencies",
    "find_by_transaction_id",
}
ALLOWED_GROUPS = {"status", "currency", "source"}
ALLOWED_DIRECTIONS = {"maximum", "minimum"}
MAX_RESULT_RECORDS = 20
MAX_DUPLICATE_GROUPS = 10


class TransactionQueryError(ValueError):
    """Error seguro y comprensible al validar una consulta de la skill."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _summary(record: RecordResult) -> dict[str, Any]:
    item = record.to_summary()
    return {
        key: item[key]
        for key in (
            "recordId", "sourceFile", "jsonPath", "category", "transactionId",
            "source", "amount", "currency", "status", "transactionDate",
            "transactionType", "referenceId", "description",
        )
    }


def _summary_with_diagnostics(record: RecordResult) -> dict[str, Any]:
    return _summary(record) | {
        "diagnostics": [
            {"code": item.code, "severity": item.severity, "message": item.message, "field": item.field}
            for item in record.diagnostics[:20]
        ],
        "diagnosticCount": len(record.diagnostics),
        "diagnosticsTruncated": len(record.diagnostics) > 20,
    }


def _require_string(arguments: dict[str, Any], name: str) -> str:
    value = arguments.get(name)
    if not isinstance(value, str) or not value.strip():
        raise TransactionQueryError("INVALID_ARGUMENTS", f"El argumento {name} debe ser un texto no vacío.")
    return value.strip()


def _validate_arguments(operation: str, arguments: dict[str, Any]) -> None:
    if operation == "summary" or operation == "duplicate_groups":
        allowed: set[str] = set()
    elif operation == "count_by":
        allowed = {"groupBy"}
        if _require_string(arguments, "groupBy") not in ALLOWED_GROUPS:
            raise TransactionQueryError("INVALID_ARGUMENTS", "groupBy debe ser status, currency o source.")
    elif operation == "extreme_amount":
        allowed = {"direction", "currency"}
        if _require_string(arguments, "direction") not in ALLOWED_DIRECTIONS:
            raise TransactionQueryError("INVALID_ARGUMENTS", "direction debe ser maximum o minimum.")
        currency = arguments.get("currency")
        if currency is not None and (not isinstance(currency, str) or len(currency.strip()) != 3):
            raise TransactionQueryError("INVALID_ARGUMENTS", "currency debe ser un código de tres letras o null.")
    elif operation == "frequent_inconsistencies":
        allowed = {"limit"}
        limit = arguments.get("limit", 5)
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 20:
            raise TransactionQueryError("INVALID_ARGUMENTS", "limit debe ser un entero entre 1 y 20.")
    else:
        allowed = {"transactionId"}
        _require_string(arguments, "transactionId")
    unknown = set(arguments) - allowed
    if unknown:
        raise TransactionQueryError("INVALID_ARGUMENTS", f"Argumentos no admitidos: {', '.join(sorted(unknown))}.")


def _count_by(records: list[RecordResult], group_by: str) -> dict[str, int]:
    transactions = [item for item in records if item.category in ("VALID", "INVALID")]
    if group_by == "currency":
        # Coincide con el dashboard: los conteos monetarios solo incluyen registros VALID.
        transactions = [item for item in transactions if item.category == "VALID"]
    key = {"status": "status", "currency": "currency", "source": "source"}[group_by]
    fallback = "UNKNOWN"
    return dict(sorted(Counter((item.normalized or {}).get(key) or fallback for item in transactions).items()))


def _extreme_amount(records: list[RecordResult], direction: str, currency: str | None) -> dict[str, Any]:
    valid = [
        item for item in records
        if item.category == "VALID" and item.normalized
        and item.normalized.get("amount") is not None
        and item.normalized.get("currency") not in (None, "UNKNOWN")
    ]
    requested_currency = currency.upper() if currency else None
    if requested_currency:
        valid = [item for item in valid if item.normalized["currency"] == requested_currency]
    currencies = sorted({item.normalized["currency"] for item in valid})
    groups = []
    for code in currencies:
        candidates = [item for item in valid if item.normalized["currency"] == code]
        amounts = [Decimal(item.normalized["amount"]) for item in candidates]
        extreme = max(amounts) if direction == "maximum" else min(amounts)
        tied = [item for item in candidates if Decimal(item.normalized["amount"]) == extreme]
        groups.append({
            "currency": code,
            "amount": format(extreme, "f"),
            "records": [_summary(item) for item in tied[:MAX_RESULT_RECORDS]],
            "tieCount": len(tied),
            "truncated": len(tied) > MAX_RESULT_RECORDS,
        })
    return {"direction": direction, "groups": groups, "excludedInvalidRecords": sum(item.category == "INVALID" for item in records)}


def execute_transaction_query(
    records: list[RecordResult],
    file_diagnostics: list[Diagnostic],
    duplicate_groups: list[dict[str, Any]],
    operation: str,
    arguments: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if operation not in ALLOWED_OPERATIONS:
        raise TransactionQueryError("UNKNOWN_OPERATION", f"Operación no admitida: {operation}.")
    if arguments is None:
        arguments = {}
    if not isinstance(arguments, dict):
        raise TransactionQueryError("INVALID_ARGUMENTS", "Los argumentos deben ser un objeto JSON.")
    _validate_arguments(operation, arguments)
    if not records:
        raise TransactionQueryError("NO_ACTIVE_DATA", "No hay archivos procesados con registros disponibles para consultar.")

    if operation == "summary":
        metrics = calculate_metrics(records, file_diagnostics)
        return {key: metrics[key] for key in ("processedTransactions", "validTransactions", "invalidTransactions", "unidentifiedObjects")}
    if operation == "count_by":
        group_by = arguments["groupBy"]
        return {"groupBy": group_by, "counts": _count_by(records, group_by)}
    if operation == "extreme_amount":
        return _extreme_amount(records, arguments["direction"], arguments.get("currency"))
    if operation == "duplicate_groups":
        record_by_id = {item.record_id: item for item in records}
        return {
            "groupCount": len(duplicate_groups),
            "returnedGroupCount": min(len(duplicate_groups), MAX_DUPLICATE_GROUPS),
            "truncated": len(duplicate_groups) > MAX_DUPLICATE_GROUPS,
            "groups": [{
                "groupId": group["groupId"],
                "criterion": group["criterion"],
                "criterionLabel": group["criterionLabel"],
                "recordCount": len(group["recordIds"]),
                "records": [_summary(record_by_id[item]) for item in group["recordIds"][:MAX_RESULT_RECORDS] if item in record_by_id],
                "truncated": len(group["recordIds"]) > MAX_RESULT_RECORDS,
            } for group in duplicate_groups[:MAX_DUPLICATE_GROUPS]],
        }
    if operation == "frequent_inconsistencies":
        limit = arguments.get("limit", 5)
        diagnostics = [item for record in records for item in record.diagnostics] + file_diagnostics
        counts = Counter((item.code, item.severity, item.scope) for item in diagnostics)
        items = sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:limit]
        return {"totalDiagnostics": len(diagnostics), "items": [
            {"code": key[0], "severity": key[1], "scope": key[2], "count": count}
            for key, count in items
        ]}
    requested = arguments["transactionId"]
    matches = [
        _summary_with_diagnostics(item) for item in records
        if item.category in ("VALID", "INVALID")
        and str((item.normalized or {}).get("transactionId") or "") == requested
    ]
    return {
        "transactionId": requested,
        "matchCount": len(matches),
        "records": matches[:MAX_RESULT_RECORDS],
        "truncated": len(matches) > MAX_RESULT_RECORDS,
    }
