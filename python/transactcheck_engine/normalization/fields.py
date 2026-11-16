from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any


def canonical_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def _edit_distance_at_most_one(left: str, right: str) -> bool:
    if abs(len(left) - len(right)) > 1:
        return False
    if left == right:
        return True
    if len(left) == len(right):
        return sum(a != b for a, b in zip(left, right)) <= 1
    short, long = (left, right) if len(left) < len(right) else (right, left)
    for index in range(len(long)):
        if long[:index] + long[index + 1 :] == short:
            return True
    return False


class FieldResolver:
    def __init__(self, field_config: dict):
        self.config = field_config
        self.aliases = {
            field: {canonical_key(alias) for alias in values}
            for field, values in field_config["fields"].items()
        }
        self.forbidden_amount = {canonical_key(item) for item in field_config["forbiddenAmountAliases"]}

    def exact_candidates(self, record: dict[str, Any]) -> dict[str, list[str]]:
        result = {field: [] for field in self.aliases}
        for key in record:
            normalized = canonical_key(str(key))
            for field, aliases in self.aliases.items():
                if normalized in aliases and not (field == "amount" and normalized in self.forbidden_amount):
                    result[field].append(key)
        return result

    def resolve(self, record: dict[str, Any]) -> tuple[dict[str, Any], dict[str, list[str]], list[str]]:
        candidates = self.exact_candidates(record)
        resolved: dict[str, Any] = {}
        fuzzy_notes: list[str] = []
        supporting = sum(bool(values) for values in candidates.values()) >= 1
        for field, keys in candidates.items():
            if len(keys) == 1:
                resolved[field] = record[keys[0]]
        if not self.config["matching"]["fuzzyEnabled"] or not supporting:
            return resolved, candidates, fuzzy_notes
        used_keys = {key for keys in candidates.values() for key in keys}
        proposals: dict[str, list[tuple[str, str]]] = {}
        for key in record:
            if key in used_keys:
                continue
            normalized_key = canonical_key(str(key))
            for field, aliases in self.aliases.items():
                if field == "amount" and normalized_key in self.forbidden_amount:
                    continue
                for alias in aliases:
                    ratio = SequenceMatcher(None, normalized_key, alias).ratio()
                    if ratio >= self.config["matching"]["minimumRatio"] and _edit_distance_at_most_one(normalized_key, alias):
                        proposals.setdefault(field, []).append((key, alias))
        for field, matches in proposals.items():
            if field not in resolved and len(matches) == 1 and not candidates[field]:
                key, alias = matches[0]
                resolved[field] = record[key]
                candidates[field].append(key)
                fuzzy_notes.append(f"{key} se reconoció como {field} por una variación tipográfica mínima de {alias}, respaldada por otro campo transaccional.")
        return resolved, candidates, fuzzy_notes


def normalize_status(value: Any, status_config: dict) -> tuple[str, str | None]:
    if value is None or (isinstance(value, str) and not value.strip()):
        return "UNKNOWN", None
    if not isinstance(value, str):
        return "UNKNOWN", "El estado no es una cadena reconocible."
    mapped = status_config["mappings"].get(value.strip().casefold())
    if mapped:
        return mapped, None
    if value.strip().upper() in status_config["catalog"]:
        return value.strip().upper(), None
    return "UNKNOWN", "El estado no tiene una equivalencia semántica configurada."
