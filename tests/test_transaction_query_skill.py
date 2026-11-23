from __future__ import annotations

import json


def add(engine, file_id: str, records: list[dict]) -> None:
    content = json.dumps({"transactions": records})
    result = engine.add_file(file_id, f"{file_id}.json", len(content.encode()), content)
    assert result["accepted"] is True


def query(engine, operation: str, arguments: dict | None = None) -> dict:
    return engine.execute_transaction_query(operation, arguments)


def test_summary_and_counts_match_session_metrics(engine):
    add(engine, "a", [
        {"id": "a1", "amount": "10", "currency": "USD", "status": "APPROVED", "source": "BANK_A"},
        {"id": "a2", "amount": "0", "currency": "EUR", "status": "PENDING", "source": "BANK_A"},
        {"id": "a3", "amount": "bad", "currency": "USD", "status": "FAILED", "source": "BANK_B"},
    ])
    metrics = engine.get_summary()["metrics"]
    result = query(engine, "summary")["result"]
    assert result == {key: metrics[key] for key in result}
    assert query(engine, "count_by", {"groupBy": "status"})["result"]["counts"]["APPROVED"] == 1
    assert query(engine, "count_by", {"groupBy": "source"})["result"]["counts"] == {"BANK_A": 2, "BANK_B": 1}
    assert query(engine, "count_by", {"groupBy": "currency"})["result"]["counts"] == {"EUR": 1, "USD": 1}


def test_extremes_are_separated_by_currency_and_preserve_ties_and_sign(engine):
    add(engine, "amounts", [
        {"id": "u1", "amount": "-5.000", "currency": "USD"},
        {"id": "u2", "amount": "10.123456789012345678", "currency": "USD"},
        {"id": "u3", "amount": "10.123456789012345678", "currency": "USD"},
        {"id": "e1", "amount": "0", "currency": "EUR"},
        {"id": "e2", "amount": "20", "currency": "EUR"},
        {"id": "bad", "amount": "1,500", "currency": "USD"},
    ])
    maximum = query(engine, "extreme_amount", {"direction": "maximum"})["result"]
    assert [(item["currency"], item["amount"]) for item in maximum["groups"]] == [
        ("EUR", "20"), ("USD", "10.123456789012345678")
    ]
    assert maximum["groups"][1]["tieCount"] == 2
    minimum = query(engine, "extreme_amount", {"direction": "minimum", "currency": "usd"})["result"]
    assert minimum["groups"][0]["amount"] == "-5.000"
    assert minimum["excludedInvalidRecords"] == 1


def test_duplicates_diagnostics_identifier_and_file_removal(engine):
    record = {"id": "same", "amount": "5", "currency": "USD", "source": "BANK_A"}
    add(engine, "first", [record, {"id": "other", "amount": "bad", "currency": "USD"}])
    add(engine, "second", [record])
    duplicates = query(engine, "duplicate_groups")["result"]
    assert duplicates["groupCount"] >= 1
    assert query(engine, "find_by_transaction_id", {"transactionId": "same"})["result"]["matchCount"] == 2
    frequent = query(engine, "frequent_inconsistencies", {"limit": 3})["result"]
    assert frequent["totalDiagnostics"] > 0
    invalid_match = query(engine, "find_by_transaction_id", {"transactionId": "other"})["result"]["records"][0]
    assert invalid_match["category"] == "INVALID"
    assert invalid_match["diagnostics"]
    engine.remove_file("second")
    assert query(engine, "duplicate_groups")["result"]["groupCount"] == 0
    assert query(engine, "find_by_transaction_id", {"transactionId": "same"})["result"]["matchCount"] == 1


def test_rejects_unknown_invalid_and_empty_queries(engine):
    assert query(engine, "summary")["error"]["code"] == "NO_ACTIVE_DATA"
    assert query(engine, "unknown")["error"]["code"] == "UNKNOWN_OPERATION"
    add(engine, "valid", [{"id": "x", "amount": "1", "currency": "USD"}])
    assert query(engine, "count_by", {"groupBy": "date"})["error"]["code"] == "INVALID_ARGUMENTS"
    assert query(engine, "extreme_amount", {"direction": "maximum", "currency": "US"})["error"]["code"] == "INVALID_ARGUMENTS"
    assert query(engine, "find_by_transaction_id", {})["error"]["code"] == "INVALID_ARGUMENTS"


def test_large_matches_keep_totals_and_limit_transferred_details(engine):
    add(engine, "many", [
        {"id": "TIED", "amount": "9.99", "currency": "USD", "description": f"item {index}"}
        for index in range(25)
    ])
    extreme = query(engine, "extreme_amount", {"direction": "maximum", "currency": "USD"})["result"]["groups"][0]
    assert extreme["tieCount"] == 25
    assert len(extreme["records"]) == 20
    assert extreme["truncated"] is True
    matches = query(engine, "find_by_transaction_id", {"transactionId": "TIED"})["result"]
    assert matches["matchCount"] == 25
    assert len(matches["records"]) == 20
    assert matches["truncated"] is True
