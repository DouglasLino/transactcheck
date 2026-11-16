from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


NORMALIZED_FIELDS = (
    "transactionId",
    "source",
    "amount",
    "currency",
    "status",
    "transactionDate",
    "transactionType",
    "referenceId",
    "description",
)


def json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


@dataclass
class Diagnostic:
    scope: str
    code: str
    severity: str
    message: str
    field: str | None
    original_value: Any
    source_file: str
    json_path: str | None
    details: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "scope": self.scope,
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
            "field": self.field,
            "originalValue": json_safe(self.original_value),
            "sourceFile": self.source_file,
            "jsonPath": self.json_path,
            "details": self.details,
        }


@dataclass
class RecordResult:
    record_id: str
    file_id: str
    source_file: str
    json_path: str
    category: str
    original: dict[str, Any]
    normalized: dict[str, Any] | None
    diagnostics: list[Diagnostic] = field(default_factory=list)
    transformations: list[str] = field(default_factory=list)

    def to_summary(self) -> dict[str, Any]:
        normalized = self.normalized or {}
        return {
            "recordId": self.record_id,
            "sourceFile": self.source_file,
            "jsonPath": self.json_path,
            "category": self.category,
            **{name: normalized.get(name) for name in NORMALIZED_FIELDS},
            "diagnosticCount": len(self.diagnostics),
            "errorCount": sum(item.severity == "ERROR" for item in self.diagnostics),
            "warningCount": sum(item.severity == "WARNING" for item in self.diagnostics),
        }

    def to_detail(self) -> dict[str, Any]:
        return {
            **self.to_summary(),
            "fileId": self.file_id,
            "original": json_safe(self.original),
            "normalized": json_safe(self.normalized),
            "diagnostics": [item.to_dict() for item in self.diagnostics],
            "transformations": self.transformations,
        }

