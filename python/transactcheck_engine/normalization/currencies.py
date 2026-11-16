from __future__ import annotations

from typing import Any


def normalize_currency(value: Any, currency_config: dict) -> tuple[str, str | None, str | None]:
    if value is None or (isinstance(value, str) and not value.strip()):
        return "UNKNOWN", "MISSING_CURRENCY", "El registro no contiene moneda."
    if not isinstance(value, str):
        return "UNKNOWN", "UNKNOWN_CURRENCY", "La moneda debe expresarse como código o alias de texto."
    candidate = value.strip()
    if candidate in currency_config["ambiguousSymbols"]:
        return "UNKNOWN", "UNKNOWN_CURRENCY", "El símbolo de moneda es ambiguo sin contexto confiable."
    aliases = currency_config["aliases"]
    mapped = aliases.get(candidate, aliases.get(candidate.lower()))
    if mapped:
        return mapped, None, None
    code = candidate.upper()
    if code in set(currency_config["catalog"]):
        return code, None, None
    return "UNKNOWN", "UNKNOWN_CURRENCY", "La moneda no pertenece al catálogo ISO 4217 embebido ni a sus alias."

