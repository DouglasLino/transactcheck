from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..normalization.fields import FieldResolver, canonical_key


@dataclass
class DetectedObject:
    value: dict[str, Any]
    json_path: str
    is_transaction: bool
    source_hint: Any = None


def _child_path(parent: str, key: str | int) -> str:
    if isinstance(key, int):
        return f"{parent}[{key}]"
    if key.isidentifier():
        return f"{parent}.{key}"
    escaped = key.replace("'", "\\'")
    return f"{parent}['{escaped}']"


def detect_objects(document: Any, resolver: FieldResolver, detection_config: dict) -> list[DetectedObject]:
    results: list[DetectedObject] = []
    excluded = {canonical_key(item) for item in detection_config["excludedContextNames"]}
    containers = {canonical_key(item) for item in detection_config["transactionContainerNames"]}
    source_metadata_names = {canonical_key(item) for item in detection_config["sourceMetadataNames"]}

    def walk(value: Any, path: str, context_name: str | None = None, inherited_source: Any = None) -> int:
        if isinstance(value, list):
            found = 0
            for index, child in enumerate(value):
                found += walk(child, _child_path(path, index), context_name, inherited_source)
            return found
        if not isinstance(value, dict):
            return 0

        context = canonical_key(context_name or "")
        candidates = resolver.exact_candidates(value)
        local_source = inherited_source
        if len(candidates["source"]) == 1:
            candidate_source = value[candidates["source"][0]]
            if isinstance(candidate_source, (str, int)) and not isinstance(candidate_source, bool):
                local_source = candidate_source
        elif local_source is None:
            metadata_sources = []
            for key, child in value.items():
                if canonical_key(str(key)) not in source_metadata_names or not isinstance(child, dict):
                    continue
                child_candidates = resolver.exact_candidates(child)["source"]
                if len(child_candidates) == 1:
                    candidate_source = child[child_candidates[0]]
                    if isinstance(candidate_source, (str, int)) and not isinstance(candidate_source, bool):
                        metadata_sources.append(candidate_source)
            if len(metadata_sources) == 1:
                local_source = metadata_sources[0]
        resolved_fields, _, _ = resolver.resolve(value)
        has_amount = bool(candidates["amount"])
        has_currency = bool(candidates["currency"])
        has_amount = has_amount or "amount" in resolved_fields
        has_currency = has_currency or "currency" in resolved_fields
        strong_markers = sum(bool(candidates[name]) for name in detection_config["strongMarkerFields"])
        excluded_context = context in excluded
        transaction_context = context in containers
        is_transaction = not excluded_context and (
            (has_amount and has_currency)
            or ((has_amount or has_currency) and (transaction_context or strong_markers >= 1))
            or (transaction_context and strong_markers >= 2)
        )
        if is_transaction:
            source_hint = None if candidates["source"] else local_source
            results.append(DetectedObject(value, path, True, source_hint))
            return 1

        descendant_count = 0
        has_scalar = False
        for key, child in value.items():
            if isinstance(child, (dict, list)):
                descendant_count += walk(child, _child_path(path, str(key)), str(key), local_source)
            else:
                has_scalar = True
        if descendant_count == 0 and has_scalar and not excluded_context:
            results.append(DetectedObject(value, path, False, None))
            return 1
        return descendant_count

    walk(document, "$")
    return results

