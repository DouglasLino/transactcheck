from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any


SLASH_DATE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")


def _safe_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def normalize_date(value: Any) -> tuple[str | None, str | None, str | None]:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None, None, None
    if not isinstance(value, str):
        return None, "INVALID_DATE", "La fecha no es una cadena reconocible; no se interpretan timestamps sin configuración."
    candidate = value.strip()
    slash = SLASH_DATE.fullmatch(candidate)
    if slash:
        first, second, year = map(int, slash.groups())
        dmy = _safe_date(year, second, first)
        mdy = _safe_date(year, first, second)
        if dmy and mdy and dmy != mdy:
            return None, "AMBIGUOUS_DATE", "La fecha admite dos interpretaciones de calendario diferentes."
        selected = dmy or mdy
        if selected:
            return selected.isoformat(), None, None
        return None, "INVALID_DATE", "La fecha no existe en el calendario."
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", candidate):
            return date.fromisoformat(candidate).isoformat(), None, None
        iso_candidate = candidate[:-1] + "+00:00" if candidate.endswith("Z") else candidate
        parsed = datetime.fromisoformat(iso_candidate)
        return parsed.isoformat().replace("+00:00", "Z"), None, None
    except ValueError:
        return None, "INVALID_DATE", "La fecha no coincide con ISO 8601 ni representa una fecha válida."

