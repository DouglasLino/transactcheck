from __future__ import annotations

import json


def add(engine, file_id: str, name: str, data):
    content = json.dumps(data, ensure_ascii=False)
    return engine.add_file(file_id, name, len(content.encode("utf-8")), content)


def test_dashboard_empty_state_is_consistent(engine):
    dashboard = engine.get_dashboard()
    assert dashboard["globalMetrics"]["processedTransactions"] == 0
    assert dashboard["filteredMetrics"]["processedTransactions"] == 0
    assert dashboard["quality"]["totalDiagnostics"] == 0
    assert dashboard["fileAnalysis"] == []
    assert dashboard["temporalDistribution"] == []


def test_dashboard_currency_signs_quality_and_distributions(engine):
    add(engine, "main", "main.json", {
        "source": "PROVIDER-A",
        "transactions": [
            {"transactionId": "A", "amount": "10.25", "currency": "USD", "status": "APPROVED", "transactionType": "SALE", "transactionDate": "2026-01-10"},
            {"transactionId": "B", "amount": "-3.25", "currency": "USD", "status": "PENDING", "transactionType": "REFUND", "transactionDate": "2026-01-11"},
            {"transactionId": "C", "amount": "0", "currency": "USD", "status": "UNKNOWN", "transactionDate": "2026-02-01"},
            {"transactionId": "D", "amount": "2", "currency": "EUR", "status": "REJECTED", "transactionType": "SALE", "transactionDate": "2026-02-01"},
            {"transactionId": "E", "amount": "bad", "currency": "$", "status": "misterioso"},
        ],
        "metadata": {"batch": "B-1"},
    })
    dashboard = engine.get_dashboard()
    usd = dashboard["filteredMetrics"]["currencyTotals"]["USD"]
    assert usd == {
        "count": 3,
        "positiveCount": 1,
        "negativeCount": 1,
        "zeroCount": 1,
        "positive": "10.25",
        "negative": "-3.25",
        "net": "7.00",
    }
    assert dashboard["globalMetrics"]["processedTransactions"] == 5
    assert dashboard["filteredMetrics"]["processedTransactions"] == 5
    assert dashboard["filteredMetrics"]["unidentifiedObjects"] == 1
    assert dashboard["quality"]["recordsWithErrors"] == 1
    assert dashboard["quality"]["recordsWithWarnings"] >= 1
    assert any(item["value"] == "SIN_TIPO" and item["count"] == 2 for item in dashboard["typeDistribution"])
    assert len(dashboard["temporalDistribution"]) == 3
    assert engine.query_transactions(filters={"transactionType": "SIN_TIPO"})["total"] == 2
    assert engine.query_transactions(filters={"incompleteOnly": True})["total"] == 5
    assert engine.query_diagnostics(record_filters={})["total"] == engine.query_diagnostics()["total"]


def test_dashboard_combined_filters_and_file_analysis(engine):
    add(engine, "one", "one.json", {"source": "A", "transactions": [
        {"transactionId": "A-1", "referenceId": "REF-A", "amount": "5", "currency": "USD", "status": "PENDING", "transactionType": "SALE"},
        {"transactionId": "A-2", "amount": "6", "currency": "EUR", "status": "APPROVED", "transactionType": "SALE"},
    ]})
    add(engine, "two", "two.json", {"source": "B", "transactions": [
        {"transactionId": "B-1", "referenceId": "REF-B", "amount": "7", "currency": "USD", "status": "PENDING", "transactionType": "SALE"},
    ]})
    filters = {
        "fileId": "one",
        "status": "PENDING",
        "currency": "USD",
        "transactionType": "SALE",
        "identifierSearch": "REF-A",
        "categories": ["VALID"],
    }
    dashboard = engine.get_dashboard(filters)
    assert dashboard["globalMetrics"]["processedTransactions"] == 3
    assert dashboard["filteredMetrics"]["processedTransactions"] == 1
    assert dashboard["filteredMetrics"]["validTransactions"] == 1
    assert len(dashboard["fileAnalysis"]) == 2
    one = next(item for item in dashboard["fileAnalysis"] if item["fileId"] == "one")
    assert one["processedTransactions"] == 2
    assert one["declaredSources"] == ["A"]
    page = engine.query_transactions(filters=filters)
    assert page["total"] == 1
    assert page["items"][0]["transactionId"] == "A-1"


def test_dashboard_duplicates_unidentified_and_temporal_month(engine):
    transaction = {"transactionId": "DUP", "source": "BANK", "amount": "1", "currency": "USD", "transactionDate": "2026-03-10"}
    add(engine, "a", "a.json", {"transactions": [transaction], "metadata": {"note": "x"}})
    add(engine, "b", "b.json", {"transactions": [transaction]})
    groups = engine.query_duplicate_groups()
    assert groups["total"] >= 1
    assert len(groups["items"][0]["records"]) == 2
    record_id = groups["items"][0]["records"][0]["recordId"]
    detail = engine.get_record(record_id)
    assert detail["possibleDuplicates"]["records"]
    assert detail["possibleDuplicates"]["criteria"]
    unidentified = engine.query_unidentified(file_id="a")
    assert unidentified["total"] == 1
    assert "evidencia suficiente" in unidentified["items"][0]["unidentifiedReason"]
    unidentified_detail = engine.get_record(unidentified["items"][0]["recordId"])
    assert unidentified_detail["original"] == {"note": "x"}
    dashboard = engine.get_dashboard(temporal_grouping="month")
    assert dashboard["temporalDistribution"] == [{
        "period": "2026-03",
        "count": 2,
        "statusCounts": {"UNKNOWN": 2},
    }]


def test_dashboard_exposes_rejected_files_to_diagnostic_filter(engine):
    engine.add_file("bad", "rejected.json", 1, "{")
    assert "rejected.json" in engine.get_summary()["options"]["diagnosticFiles"]
    diagnostics = engine.query_diagnostics(source_file="rejected.json")
    assert diagnostics["total"] == 1
    assert diagnostics["items"][0]["scope"] == "FILE"
