from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any


PLAIN_DECIMAL = re.compile(r"^[+-]?\d+(?:\.\d+)?$")
COMMA_DECIMAL = re.compile(r"^[+-]?\d+,\d+$")
COMMA_GROUPED = re.compile(r"^[+-]?\d{1,3}(?:,\d{3}){2,}$")
MIXED_US = re.compile(r"^[+-]?\d{1,3}(?:,\d{3})+\.\d+$")
MIXED_EU = re.compile(r"^[+-]?\d{1,3}(?:\.\d{3})+,\d+$")


def _decimal_string(value: Decimal) -> str:
    return format(value, "f")


def normalize_amount(value: Any) -> tuple[str | None, str | None, str | None]:
    """Devuelve (monto, código_error, explicación). Nunca convierte mediante float."""
    if value is None:
        return None, "MISSING_AMOUNT", "El registro no contiene un monto utilizable."
    if isinstance(value, bool):
        return None, "INVALID_AMOUNT", "Un valor booleano no es un monto."
    if isinstance(value, (int, Decimal)):
        return _decimal_string(Decimal(value)), None, None
    if not isinstance(value, str):
        return None, "INVALID_AMOUNT", "El tipo del valor no corresponde a un monto."

    candidate = value.strip().replace("\u00a0", "").replace(" ", "")
    if not candidate:
        return None, "MISSING_AMOUNT", "El monto está vacío."
    normalized = candidate
    if PLAIN_DECIMAL.fullmatch(candidate):
        pass
    elif MIXED_US.fullmatch(candidate):
        normalized = candidate.replace(",", "")
    elif MIXED_EU.fullmatch(candidate):
        normalized = candidate.replace(".", "").replace(",", ".")
    elif COMMA_GROUPED.fullmatch(candidate):
        normalized = candidate.replace(",", "")
    elif COMMA_DECIMAL.fullmatch(candidate):
        integer, fraction = candidate.rsplit(",", 1)
        if len(fraction) == 3 and 1 <= len(integer.lstrip("+-")) <= 3:
            return None, "AMBIGUOUS_AMOUNT", "El separador puede representar miles o decimales y no existe contexto confiable."
        normalized = f"{integer}.{fraction}"
    else:
        return None, "INVALID_AMOUNT", "El formato numérico no coincide con una regla conservadora reconocida."
    try:
        return _decimal_string(Decimal(normalized)), None, None
    except InvalidOperation:
        return None, "INVALID_AMOUNT", "El valor no puede convertirse a Decimal."

