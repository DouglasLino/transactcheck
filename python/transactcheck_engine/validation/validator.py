from __future__ import annotations

from typing import Any

from ..models import Diagnostic
from ..normalization import FieldResolver, normalize_amount, normalize_currency, normalize_date, normalize_status


def _diagnostic(
    code: str,
    severity: str,
    message: str,
    field: str | None,
    original_value: Any,
    source_file: str,
    json_path: str,
    details: str,
) -> Diagnostic:
    return Diagnostic("RECORD", code, severity, message, field, original_value, source_file, json_path, details)


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (str, int)) and not isinstance(value, bool):
        candidate = str(value).strip()
        return candidate or None
    return None


def normalize_record(
    original: dict[str, Any],
    source_file: str,
    json_path: str,
    resolver: FieldResolver,
    configuration: dict,
    source_hint: Any = None,
) -> tuple[dict[str, Any], str, list[Diagnostic], list[str]]:
    resolved, candidates, fuzzy_notes = resolver.resolve(original)
    diagnostics: list[Diagnostic] = []
    transformations = list(fuzzy_notes)

    for field, keys in candidates.items():
        if len(keys) > 1:
            diagnostics.append(_diagnostic(
                "AMBIGUOUS_FIELD", "ERROR" if field in ("amount", "currency") else "WARNING",
                f"Hay varias claves candidatas para {field}; no se eligió una arbitrariamente.", field,
                {key: original[key] for key in keys}, source_file, json_path,
                f"Claves candidatas: {', '.join(keys)}.",
            ))
            resolved.pop(field, None)

    amount_original = resolved.get("amount")
    amount, amount_error, amount_details = normalize_amount(amount_original)
    if amount_error:
        diagnostics.append(_diagnostic(amount_error, "ERROR", "No fue posible normalizar el monto.", "amount", amount_original, source_file, json_path, amount_details or ""))
    elif amount_original is not None:
        transformations.append(f"amount se normalizó a la representación decimal exacta {amount}.")

    currency_original = resolved.get("currency")
    currency, currency_error, currency_details = normalize_currency(currency_original, configuration["currency_aliases"])
    if currency_error:
        diagnostics.append(_diagnostic(currency_error, "ERROR", "No fue posible reconocer una moneda válida.", "currency", currency_original, source_file, json_path, currency_details or ""))
    elif currency_original is not None and str(currency_original) != currency:
        transformations.append(f"currency se normalizó de {currency_original!s} a {currency}.")

    status_original = resolved.get("status")
    status, status_warning = normalize_status(status_original, configuration["status_mappings"])
    if status_warning:
        diagnostics.append(_diagnostic("UNKNOWN_STATUS", "WARNING", "El estado se conservó como UNKNOWN.", "status", status_original, source_file, json_path, status_warning))
    elif status_original is not None and str(status_original) != status:
        transformations.append(f"status se normalizó de {status_original!s} a {status}.")

    date_original = resolved.get("transactionDate")
    transaction_date, date_warning, date_details = normalize_date(date_original)
    if date_warning:
        diagnostics.append(_diagnostic(date_warning, "WARNING", "La fecha no pudo normalizarse de forma confiable.", "transactionDate", date_original, source_file, json_path, date_details or ""))
    elif date_original is not None and str(date_original) != transaction_date:
        transformations.append(f"transactionDate se normalizó de {date_original!s} a {transaction_date}.")

    source = _optional_string(resolved.get("source")) or _optional_string(source_hint) or "UNKNOWN"
    if resolved.get("source") is None and source_hint is not None and source != "UNKNOWN":
        transformations.append(f"source se obtuvo del contexto explícito del contenedor: {source}.")
    if source == "UNKNOWN":
        diagnostics.append(_diagnostic("UNKNOWN_SOURCE", "WARNING", "No se reconoció una fuente confiable.", "source", resolved.get("source"), source_file, json_path, "El nombre del archivo no se utiliza para inferir la fuente."))

    normalized = {
        "transactionId": _optional_string(resolved.get("transactionId")),
        "source": source,
        "amount": amount,
        "currency": currency,
        "status": status,
        "transactionDate": transaction_date,
        "transactionType": _optional_string(resolved.get("transactionType")),
        "referenceId": _optional_string(resolved.get("referenceId")),
        "description": _optional_string(resolved.get("description")),
    }

    recognized_keys = {key for keys in candidates.values() for key in keys}
    for key in original:
        if key not in recognized_keys and not isinstance(original[key], (dict, list)):
            diagnostics.append(_diagnostic("UNRECOGNIZED_FIELD", "INFO", f"El campo {key} no forma parte del modelo normalizado.", None, original[key], source_file, f"{json_path}.{key}", "El valor permanece disponible en el objeto original."))

    category = "VALID" if amount is not None and currency != "UNKNOWN" else "INVALID"
    if not transformations:
        transformations.append("Los campos reconocidos ya estaban en una representación compatible o no requirieron transformación.")
    return normalized, category, diagnostics, transformations

