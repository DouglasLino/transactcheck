from __future__ import annotations

from typing import Any


def extract_currency_affix(value: Any, currency_config: dict) -> tuple[Any, str | None, str | None]:
    """Separa un alias monetario inequívoco situado al inicio o final de un monto."""
    if not isinstance(value, str):
        return value, None, None
    candidate = value.strip()
    ambiguous = {item.casefold() for item in currency_config["ambiguousSymbols"]}
    matches: list[tuple[str, str]] = []
    for alias, currency in currency_config["aliases"].items():
        if alias.casefold() in ambiguous or alias.isalnum():
            continue
        if candidate.startswith(alias):
            matches.append((currency, candidate[len(alias):].strip()))
        elif candidate.endswith(alias):
            matches.append((currency, candidate[:-len(alias)].strip()))
    unique = {(currency, remainder) for currency, remainder in matches if remainder}
    if len(unique) == 1:
        currency, remainder = next(iter(unique))
        return remainder, currency, None
    if len(unique) > 1:
        return value, None, "El monto contiene más de un alias monetario posible."
    return value, None, None


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

