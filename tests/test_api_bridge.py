from __future__ import annotations

import json
from pathlib import Path

from transactcheck_engine.api import initialize, process_request


ROOT = Path(__file__).resolve().parents[1]


def request(action: str, payload: dict | None = None) -> dict:
    return json.loads(process_request(json.dumps({"action": action, "payload": payload or {}})))


def test_worker_camel_case_query_returns_loaded_transactions():
    initialize(ROOT / "config")
    content = json.dumps([
        {"transactionId": "TX-1", "amount": "10.25", "currency": "USD"},
        {"transactionId": "TX-2", "amount": "5", "currency": "EUR"},
    ])
    added = request("addFile", {
        "fileId": "bridge",
        "name": "bridge.json",
        "size": len(content.encode("utf-8")),
        "content": content,
    })
    assert added["accepted"] is True

    result = request("queryTransactions", {
        "filters": {},
        "sortField": "amount",
        "sortOrder": -1,
        "page": 0,
        "pageSize": 20,
    })
    assert result["total"] == 2
    assert [item["transactionId"] for item in result["items"]] == ["TX-1", "TX-2"]

    diagnostics = request("queryDiagnostics", {"page": 0, "pageSize": 25})
    assert diagnostics["total"] >= 2

    dashboard = request("getDashboard", {
        "filters": {"currency": "USD"},
        "temporalGrouping": "day",
    })
    assert dashboard["globalMetrics"]["processedTransactions"] == 2
    assert dashboard["filteredMetrics"]["processedTransactions"] == 1

    unidentified = request("queryUnidentified", {"page": 0, "pageSize": 10})
    assert unidentified["total"] == 0

    duplicates = request("queryDuplicateGroups", {"filters": {}, "page": 0, "pageSize": 10})
    assert duplicates["total"] == 0
