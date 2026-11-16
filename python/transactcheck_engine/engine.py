from __future__ import annotations

import json
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .configuration import load_configuration
from .detection import detect_objects
from .metrics import build_dashboard_analytics, calculate_metrics
from .models import Diagnostic, RecordResult, json_safe
from .normalization import FieldResolver
from .validation import normalize_record


MAX_FILES = 3
MAX_FILE_BYTES = 5_242_880
MAX_TOTAL_BYTES = 15_728_640


class SessionEngine:
    def __init__(self, config_dir: str | Path):
        self.configuration = load_configuration(config_dir)
        self.resolver = FieldResolver(self.configuration["field_aliases"])
        self.files: dict[str, dict[str, Any]] = {}
        self.records: list[RecordResult] = []
        self.file_diagnostics: list[Diagnostic] = []
        self.duplicate_groups: list[dict[str, Any]] = []
        self.sequence = 0

    def _file_diagnostic(self, code: str, message: str, source_file: str, details: str) -> dict:
        diagnostic = Diagnostic("FILE", code, "ERROR", message, None, None, source_file, None, details)
        self.file_diagnostics.append(diagnostic)
        return {"accepted": False, "diagnostic": diagnostic.to_dict(), "summary": self.get_summary()}

    def add_file(self, file_id: str, name: str, size: int, content: str) -> dict:
        if not name.lower().endswith(".json"):
            return self._file_diagnostic("INVALID_FILE_TYPE", f"El archivo {name} fue rechazado: solo se admite .json.", name, "La extensión no corresponde al formato permitido en MVP1.")
        if size > MAX_FILE_BYTES:
            return self._file_diagnostic("FILE_TOO_LARGE", f"El archivo {name} supera el máximo de 5 MiB.", name, f"Tamaño recibido: {size} bytes; máximo: {MAX_FILE_BYTES} bytes.")
        if len(self.files) >= MAX_FILES:
            return self._file_diagnostic("FILE_LIMIT_EXCEEDED", f"El archivo {name} fue rechazado: ya hay tres archivos activos.", name, "Los archivos rechazados no consumen cupo.")
        current_size = sum(item["size"] for item in self.files.values())
        if current_size + size > MAX_TOTAL_BYTES:
            return self._file_diagnostic("FILE_LIMIT_EXCEEDED", f"El archivo {name} supera el límite acumulado de 15 MiB.", name, f"Acumulado propuesto: {current_size + size} bytes; máximo: {MAX_TOTAL_BYTES} bytes.")
        try:
            document = json.loads(content, parse_float=Decimal, parse_int=int)
        except json.JSONDecodeError as error:
            details = f"El parser indicó línea {error.lineno}, columna {error.colno}: {error.msg}."
            return self._file_diagnostic("INVALID_JSON", f"El archivo {name} contiene JSON malformado y fue descartado por completo.", name, details)

        try:
            detected = detect_objects(document, self.resolver, self.configuration["detection_rules"])
            new_records: list[RecordResult] = []
            for item in detected:
                self.sequence += 1
                record_id = f"r{self.sequence}"
                if item.is_transaction:
                    normalized, category, diagnostics, transformations = normalize_record(
                        item.value, name, item.json_path, self.resolver, self.configuration, item.source_hint
                    )
                else:
                    normalized = None
                    category = "UNIDENTIFIED"
                    diagnostics = [Diagnostic(
                        "RECORD", "UNIDENTIFIED_OBJECT", "WARNING",
                        "El objeto no contiene evidencia suficiente para reconocerlo como transacción.",
                        None, None, name, item.json_path,
                        "Se conserva separado y no afecta métricas transaccionales ni monetarias.",
                    )]
                    transformations = ["No se aplicaron transformaciones porque el objeto no fue identificado como transacción."]
                new_records.append(RecordResult(record_id, file_id, name, item.json_path, category, item.value, normalized, diagnostics, transformations))
        except Exception as error:
            return self._file_diagnostic("FILE_PROCESSING_ERROR", f"El archivo {name} no pudo procesarse y fue descartado.", name, f"{type(error).__name__}: {error}")

        self.files[file_id] = {"fileId": file_id, "name": name, "size": size, "recordCount": len(new_records), "status": "PROCESSED"}
        self.records.extend(new_records)
        self._recalculate_duplicates()
        return {"accepted": True, "file": self.files[file_id], "summary": self.get_summary()}

    def remove_file(self, file_id: str) -> dict:
        removed = self.files.pop(file_id, None)
        if removed:
            self.records = [item for item in self.records if item.file_id != file_id]
            self._recalculate_duplicates()
        return {"removed": bool(removed), "summary": self.get_summary()}

    def _recalculate_duplicates(self) -> None:
        self.duplicate_groups = []
        for record in self.records:
            record.diagnostics = [item for item in record.diagnostics if item.code != "POSSIBLE_DUPLICATE"]
        transactions = [item for item in self.records if item.category in ("VALID", "INVALID")]
        groups: dict[tuple, list[RecordResult]] = defaultdict(list)
        for record in transactions:
            normalized = record.normalized or {}
            original_key = ("original", json.dumps(json_safe(record.original), ensure_ascii=False, sort_keys=True))
            groups[original_key].append(record)
            transaction_id = normalized.get("transactionId")
            source = normalized.get("source")
            if transaction_id and source and source != "UNKNOWN":
                groups[("id-source", transaction_id, source)].append(record)
            if normalized.get("referenceId") and normalized.get("transactionDate") and normalized.get("amount") and normalized.get("currency") != "UNKNOWN":
                groups[("relevant", normalized["referenceId"], normalized["transactionDate"], normalized["amount"], normalized["currency"])].append(record)
        duplicate_reasons: dict[str, set[str]] = defaultdict(set)
        record_by_id = {item.record_id: item for item in transactions}
        for key, members in groups.items():
            unique = {item.record_id: item for item in members}
            if len(unique) < 2:
                continue
            reason = {
                "original": "objetos originales idénticos",
                "id-source": "mismo identificador y misma fuente",
                "relevant": "misma referencia, fecha, monto y moneda",
            }[key[0]]
            self.duplicate_groups.append({
                "groupId": f"duplicate-{len(self.duplicate_groups) + 1}",
                "criterion": key[0],
                "criterionLabel": reason,
                "recordIds": list(unique),
            })
            for record_id in unique:
                duplicate_reasons[record_id].add(reason)
        for record_id, reasons in duplicate_reasons.items():
            record = record_by_id[record_id]
            record.diagnostics.append(Diagnostic(
                "RECORD", "POSSIBLE_DUPLICATE", "WARNING",
                "El registro coincide con otra transacción y podría estar duplicado.",
                None, None, record.source_file, record.json_path,
                "Coincidencia por " + "; ".join(sorted(reasons)) + ". No se eliminó ni invalidó ningún registro.",
            ))

    def _filtered_transactions(self, filters: dict[str, Any] | None = None) -> list[RecordResult]:
        filters = filters or {}
        records = [item for item in self.records if item.category in ("VALID", "INVALID")]
        search = str(filters.get("search") or "").casefold().strip()
        identifier_search = str(filters.get("identifierSearch") or "").casefold().strip()
        categories = set(filters.get("categories") or [])

        def decimal_filter(value: str | None) -> Decimal | None:
            if value in (None, ""):
                return None
            try:
                return Decimal(str(value))
            except InvalidOperation:
                return None

        minimum = decimal_filter(filters.get("amountMin"))
        maximum = decimal_filter(filters.get("amountMax"))
        selected: list[RecordResult] = []
        for item in records:
            normalized = item.normalized or {}
            if filters.get("fileId") and item.file_id != filters["fileId"]:
                continue
            if categories and item.category not in categories:
                continue
            if filters.get("source") and normalized.get("source") != filters["source"]:
                continue
            if filters.get("status") and normalized.get("status") != filters["status"]:
                continue
            if filters.get("currency") and normalized.get("currency") != filters["currency"]:
                continue
            if filters.get("transactionType"):
                requested_type = filters["transactionType"]
                normalized_type = normalized.get("transactionType") or "SIN_TIPO"
                if normalized_type != requested_type:
                    continue
            transaction_date = normalized.get("transactionDate")
            if filters.get("dateFrom") and (not transaction_date or transaction_date[:10] < filters["dateFrom"]):
                continue
            if filters.get("dateTo") and (not transaction_date or transaction_date[:10] > filters["dateTo"]):
                continue
            amount = Decimal(normalized["amount"]) if normalized.get("amount") is not None else None
            if minimum is not None and (amount is None or amount < minimum):
                continue
            if maximum is not None and (amount is None or amount > maximum):
                continue
            if filters.get("diagnosticSeverity") and not any(
                diagnostic.severity == filters["diagnosticSeverity"] for diagnostic in item.diagnostics
            ):
                continue
            if filters.get("diagnosticCode") and not any(
                diagnostic.code == filters["diagnosticCode"] for diagnostic in item.diagnostics
            ):
                continue
            if filters.get("incompleteOnly") and not any(
                normalized.get(field) in (None, "UNKNOWN") for field in (
                    "transactionId", "source", "status", "transactionDate", "transactionType", "referenceId", "description"
                )
            ):
                continue
            if identifier_search:
                identifiers = " ".join(str(normalized.get(field) or "") for field in ("transactionId", "referenceId")).casefold()
                if identifier_search not in identifiers:
                    continue
            if search:
                searchable = json.dumps(json_safe({"normalized": normalized, "original": item.original}), ensure_ascii=False).casefold()
                if search not in searchable:
                    continue
            selected.append(item)
        return selected

    def query_transactions(self, filters: dict | None = None, sort_field: str = "transactionDate", sort_order: int = -1, page: int = 0, page_size: int = 20) -> dict:
        selected = self._filtered_transactions(filters)
        allowed = {"transactionId", "source", "amount", "currency", "status", "transactionDate", "transactionType", "category", "sourceFile"}
        sort_field = sort_field if sort_field in allowed else "transactionDate"

        def key(item: RecordResult):
            if sort_field == "category":
                value = item.category
            elif sort_field == "sourceFile":
                value = item.source_file
            else:
                value = (item.normalized or {}).get(sort_field)
            if sort_field == "amount":
                return (value is not None, Decimal(value) if value is not None else Decimal("0"))
            return (value is not None, str(value or "").casefold())

        selected.sort(key=key, reverse=sort_order < 0)
        start = max(page, 0) * max(page_size, 1)
        page_items = selected[start : start + page_size]
        return {
            "items": [item.to_summary() for item in page_items],
            "total": len(selected),
            "page": page,
            "pageSize": page_size,
            "filteredMetrics": calculate_metrics(selected, []),
        }

    def query_diagnostics(
        self,
        scope: str | None = None,
        severity: str | None = None,
        code: str | None = None,
        source_file: str | None = None,
        record_filters: dict | None = None,
        page: int = 0,
        page_size: int = 25,
    ) -> dict:
        selected_ids = None
        active_record_filters = {
            key: value for key, value in (record_filters or {}).items()
            if value not in (None, "", [], {})
        }
        if active_record_filters:
            selected_ids = {item.record_id for item in self._filtered_transactions(record_filters)}
            if set(active_record_filters) == {"fileId"}:
                selected_ids.update(
                    item.record_id for item in self.records
                    if item.category == "UNIDENTIFIED" and item.file_id == record_filters["fileId"]
                )
        items = [
            diagnostic.to_dict() | {"recordId": record.record_id}
            for record in self.records
            if selected_ids is None or record.record_id in selected_ids
            for diagnostic in record.diagnostics
        ]
        include_file_diagnostics = True
        file_name_from_filter = None
        if record_filters:
            transaction_filter_keys = {
                key for key, value in record_filters.items()
                if value not in (None, "", [], {}) and key != "fileId"
            }
            if transaction_filter_keys:
                include_file_diagnostics = False
            if record_filters.get("fileId") in self.files:
                file_name_from_filter = self.files[record_filters["fileId"]]["name"]
        if include_file_diagnostics:
            items.extend(
                diagnostic.to_dict() | {"recordId": None}
                for diagnostic in self.file_diagnostics
                if file_name_from_filter is None or diagnostic.source_file == file_name_from_filter
            )
        if scope:
            items = [item for item in items if item["scope"] == scope]
        if severity:
            items = [item for item in items if item["severity"] == severity]
        if code:
            items = [item for item in items if item["code"] == code]
        if source_file:
            items = [item for item in items if item["sourceFile"] == source_file]
        items.sort(key=lambda item: ({"ERROR": 0, "WARNING": 1, "INFO": 2}.get(item["severity"], 3), item["sourceFile"], item.get("jsonPath") or ""))
        start = max(page, 0) * max(page_size, 1)
        return {"items": items[start : start + page_size], "total": len(items), "page": page, "pageSize": page_size}

    def get_record(self, record_id: str) -> dict | None:
        for item in self.records:
            if item.record_id == record_id:
                detail = item.to_detail()
                related_ids = set()
                criteria = []
                for group in self.duplicate_groups:
                    if record_id in group["recordIds"]:
                        related_ids.update(group["recordIds"])
                        criteria.append(group["criterionLabel"])
                related_ids.discard(record_id)
                detail["possibleDuplicates"] = {
                    "criteria": sorted(set(criteria)),
                    "records": [
                        record.to_summary() for record in self.records if record.record_id in related_ids
                    ],
                }
                return detail
        return None

    def query_unidentified(self, file_id: str | None = None, page: int = 0, page_size: int = 10) -> dict:
        items = [
            item for item in self.records
            if item.category == "UNIDENTIFIED" and (file_id is None or item.file_id == file_id)
        ]
        start = max(page, 0) * max(page_size, 1)
        return {
            "items": [
                item.to_summary() | {
                    "unidentifiedReason": next(
                        (diagnostic.message for diagnostic in item.diagnostics if diagnostic.code == "UNIDENTIFIED_OBJECT"),
                        "No existe evidencia suficiente para reconocer el objeto como transacción.",
                    )
                }
                for item in items[start : start + page_size]
            ],
            "total": len(items),
            "page": page,
            "pageSize": page_size,
        }

    def query_duplicate_groups(self, filters: dict | None = None, page: int = 0, page_size: int = 10) -> dict:
        selected_ids = {item.record_id for item in self._filtered_transactions(filters)}
        record_by_id = {item.record_id: item for item in self.records}
        groups = [group for group in self.duplicate_groups if selected_ids.intersection(group["recordIds"])]
        start = max(page, 0) * max(page_size, 1)
        page_groups = []
        for group in groups[start : start + page_size]:
            page_groups.append({
                **group,
                "records": [record_by_id[record_id].to_summary() for record_id in group["recordIds"] if record_id in record_by_id],
            })
        return {"items": page_groups, "total": len(groups), "page": page, "pageSize": page_size}

    def get_dashboard(self, filters: dict | None = None, temporal_grouping: str = "day") -> dict:
        filters = filters or {}
        selected_transactions = self._filtered_transactions(filters)
        selected_unidentified = [
            item for item in self.records
            if item.category == "UNIDENTIFIED" and (not filters.get("fileId") or item.file_id == filters["fileId"])
        ]
        active_filters = {key: value for key, value in filters.items() if value not in (None, "", [], {})}
        selected_file_diagnostics: list[Diagnostic] = []
        if not active_filters:
            selected_file_diagnostics = list(self.file_diagnostics)
        elif set(active_filters) == {"fileId"} and filters["fileId"] in self.files:
            file_name = self.files[filters["fileId"]]["name"]
            selected_file_diagnostics = [item for item in self.file_diagnostics if item.source_file == file_name]
        return build_dashboard_analytics(
            self.records,
            selected_transactions + selected_unidentified,
            self.files,
            self.file_diagnostics,
            selected_file_diagnostics,
            "month" if temporal_grouping == "month" else "day",
        )

    def get_summary(self) -> dict:
        metrics = calculate_metrics(self.records, self.file_diagnostics)
        transactions = [item.normalized or {} for item in self.records if item.category in ("VALID", "INVALID")]
        return {
            "metrics": metrics,
            "files": list(self.files.values()),
            "limits": {
                "maxFiles": MAX_FILES,
                "maxFileBytes": MAX_FILE_BYTES,
                "maxTotalBytes": MAX_TOTAL_BYTES,
                "activeBytes": sum(item["size"] for item in self.files.values()),
            },
            "options": {
                "sources": sorted({item.get("source") for item in transactions if item.get("source")}),
                "statuses": sorted({item.get("status") for item in transactions if item.get("status")}),
                "currencies": sorted({item.get("currency") for item in transactions if item.get("currency")}),
                "transactionTypes": sorted({item.get("transactionType") for item in transactions if item.get("transactionType")}),
                "diagnosticCodes": sorted(metrics["diagnosticCodeCounts"]),
                "diagnosticFiles": sorted({
                    item.source_file for item in self.file_diagnostics
                } | {item["name"] for item in self.files.values()}),
            },
        }

    def get_rules(self) -> dict:
        return self.configuration

