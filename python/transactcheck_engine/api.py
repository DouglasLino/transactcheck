from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .engine import SessionEngine
from .models import json_safe


_engine: SessionEngine | None = None


def initialize(config_dir: str | Path) -> dict[str, Any]:
    global _engine
    _engine = SessionEngine(config_dir)
    return {"ready": True, "summary": _engine.get_summary()}


def _require_engine() -> SessionEngine:
    if _engine is None:
        raise RuntimeError("El motor no ha sido inicializado.")
    return _engine


def dispatch(request: dict[str, Any]) -> Any:
    engine = _require_engine()
    action = request.get("action")
    payload = request.get("payload") or {}
    if action == "summary":
        return engine.get_summary()
    if action == "addFile":
        return engine.add_file(payload["fileId"], payload["name"], payload["size"], payload["content"])
    if action == "removeFile":
        return engine.remove_file(payload["fileId"])
    if action == "queryTransactions":
        return engine.query_transactions(
            filters=payload.get("filters"),
            sort_field=payload.get("sortField", "transactionDate"),
            sort_order=payload.get("sortOrder", -1),
            page=payload.get("page", 0),
            page_size=payload.get("pageSize", 20),
        )
    if action == "queryDiagnostics":
        return engine.query_diagnostics(
            scope=payload.get("scope"),
            severity=payload.get("severity"),
            code=payload.get("code"),
            source_file=payload.get("sourceFile"),
            record_filters=payload.get("recordFilters"),
            page=payload.get("page", 0),
            page_size=payload.get("pageSize", 25),
        )
    if action == "getDashboard":
        return engine.get_dashboard(
            filters=payload.get("filters"),
            temporal_grouping=payload.get("temporalGrouping", "day"),
        )
    if action == "queryUnidentified":
        return engine.query_unidentified(
            file_id=payload.get("fileId"),
            page=payload.get("page", 0),
            page_size=payload.get("pageSize", 10),
        )
    if action == "queryDuplicateGroups":
        return engine.query_duplicate_groups(
            filters=payload.get("filters"),
            page=payload.get("page", 0),
            page_size=payload.get("pageSize", 10),
        )
    if action == "getRecord":
        return engine.get_record(payload["recordId"])
    if action == "getRules":
        return engine.get_rules()
    if action == "executeTransactionQuery":
        return engine.execute_transaction_query(payload.get("operation", ""), payload.get("arguments"))
    raise ValueError(f"Acción no admitida: {action}")


def process_request(request_json: str) -> str:
    return json.dumps(json_safe(dispatch(json.loads(request_json))), ensure_ascii=False, separators=(",", ":"))
