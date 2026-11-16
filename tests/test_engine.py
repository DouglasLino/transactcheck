from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from transactcheck_engine.engine import MAX_FILE_BYTES
from transactcheck_engine.metrics import calculate_metrics
from transactcheck_engine.normalization.amounts import normalize_amount
from transactcheck_engine.normalization.currencies import extract_currency_affix, normalize_currency
from transactcheck_engine.normalization.dates import normalize_date
from transactcheck_engine.normalization.fields import normalize_status


ROOT = Path(__file__).resolve().parents[1]


def add(engine, file_id: str, name: str, data, size: int | None = None):
    content = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return engine.add_file(file_id, name, len(content.encode("utf-8")) if size is None else size, content)


def test_complete_parse_rejects_malformed_without_changing_previous_results(engine):
    accepted = add(engine, "one", "one.json", [{"amount": "10.25", "currency": "USD"}])
    before = engine.get_summary()["metrics"].copy()
    rejected = add(engine, "bad", "bad.json", '{"transactions":[{"amount":2},]}')
    assert accepted["accepted"] is True
    assert rejected["accepted"] is False
    assert rejected["diagnostic"]["code"] == "INVALID_JSON"
    assert engine.get_summary()["metrics"]["processedTransactions"] == before["processedTransactions"]
    assert len(engine.files) == 1


def test_nested_detection_excludes_containers_and_summary(engine):
    document = {
        "payload": {"transactions": [{"amount": 12, "currency": "EUR"}]},
        "summary": {"totalAmount": 12, "currency": "EUR"},
        "metadata": {"batch": "A"},
    }
    add(engine, "nested", "nested.json", document)
    metrics = engine.get_summary()["metrics"]
    assert metrics["processedTransactions"] == 1
    assert metrics["validTransactions"] == 1
    assert metrics["unidentifiedObjects"] == 1
    page = engine.query_transactions()
    assert page["items"][0]["jsonPath"] == "$.payload.transactions[0]"


def test_aliases_unknown_fields_and_conservative_fuzzy_mapping(engine):
    document = [{"ammount": "19.90", "moneda": "usd", "campoExtra": "x"}]
    add(engine, "aliases", "aliases.json", document)
    detail = engine.get_record(engine.query_transactions()["items"][0]["recordId"])
    assert detail["normalized"]["amount"] == "19.90"
    assert detail["normalized"]["currency"] == "USD"
    assert any("ammount" in item for item in detail["transformations"])
    assert "UNRECOGNIZED_FIELD" in {item["code"] for item in detail["diagnostics"]}


def test_ambiguous_field_candidates_are_not_chosen_arbitrarily(engine):
    add(engine, "ambiguous", "ambiguous.json", [{"amount": "10", "monto": "20", "currency": "USD"}])
    row = engine.query_transactions()["items"][0]
    assert row["category"] == "INVALID"
    assert row["amount"] is None
    detail = engine.get_record(row["recordId"])
    assert "AMBIGUOUS_FIELD" in {item["code"] for item in detail["diagnostics"]}


def test_explicit_container_source_is_inherited_without_using_filename(engine):
    add(engine, "source", "bank-name-is-not-evidence.json", {
        "metadata": {"source": "PROVIDER-A"},
        "transactions": [{"amount": "8", "currency": "USD"}],
    })
    row = engine.query_transactions()["items"][0]
    assert row["source"] == "PROVIDER-A"
    detail = engine.get_record(row["recordId"])
    assert any("contenedor" in item for item in detail["transformations"])


def test_amount_positive_negative_zero_invalid_ambiguous_and_formats():
    assert normalize_amount(Decimal("0"))[0] == "0"
    assert normalize_amount("-25.50")[0] == "-25.50"
    assert normalize_amount("1,234.567")[0] == "1234.567"
    assert normalize_amount("1.234,56")[0] == "1234.56"
    assert normalize_amount("1,500")[1] == "AMBIGUOUS_AMOUNT"
    assert normalize_amount("no-numero")[1] == "INVALID_AMOUNT"


def test_currencies_statuses_and_dates(engine):
    currencies = engine.configuration["currency_aliases"]
    statuses = engine.configuration["status_mappings"]
    assert normalize_currency("US$", currencies)[0] == "USD"
    assert normalize_currency("$", currencies)[:2] == ("UNKNOWN", "UNKNOWN_CURRENCY")
    assert normalize_currency("ZZZ", currencies)[1] == "UNKNOWN_CURRENCY"
    assert extract_currency_affix("€99,99", currencies)[:2] == ("99,99", "EUR")
    assert extract_currency_affix("$99.99", currencies)[1] is None
    assert normalize_status("aprobado", statuses)[0] == "APPROVED"
    assert normalize_status("COMPLETED", statuses)[0] == "UNKNOWN"
    assert normalize_date("30/04/2026")[0] == "2026-04-30"
    assert normalize_date("04/30/2026")[0] == "2026-04-30"
    assert normalize_date("04/04/2026")[0] == "2026-04-04"
    assert normalize_date("04/05/2026")[1] == "AMBIGUOUS_DATE"
    assert normalize_date("10/03/2025 14:22")[1] == "AMBIGUOUS_DATE"
    assert normalize_date("30/04/2026 14:22")[0] == "2026-04-30T14:22"
    assert normalize_date("31/02/2026")[1] == "INVALID_DATE"
    assert normalize_date("2024-02-29")[0] == "2024-02-29"
    assert normalize_date("2023-02-29")[1] == "INVALID_DATE"


def test_heterogeneous_eight_transaction_regression(engine):
    sample = ROOT / "data" / "samples" / "heterogeneous.json"
    result = engine.add_file("heterogeneous", sample.name, sample.stat().st_size, sample.read_text(encoding="utf-8"))
    assert result["accepted"] is True
    metrics = engine.get_summary()["metrics"]
    assert metrics["processedTransactions"] == 8
    assert metrics["validTransactions"] == 8
    assert metrics["invalidTransactions"] == 0

    rows = engine.query_transactions(sort_field="transactionId", sort_order=1, page_size=20)["items"]
    by_id = {row["transactionId"]: row for row in rows}
    assert set(by_id) == {"tx_001", "204", "205", "tx_004", "tx_006", "207", "tx_008", None}
    assert by_id["204"]["amount"] == "10050"
    assert by_id["205"]["amount"] == "-45.20"
    assert by_id["205"]["status"] == "REFUNDED"
    assert by_id["207"]["amount"] == "0"
    assert by_id["207"]["status"] == "FAILED"
    assert by_id["tx_006"]["status"] == "PENDING"

    reference_row = next(row for row in rows if row["referenceId"] == "A-77")
    assert reference_row["amount"] == "99.99"
    assert reference_row["currency"] == "EUR"
    assert reference_row["transactionDate"] == "2025-03-10T14:22:00Z"
    assert metrics["currencyTotals"]["EUR"]["negative"] == "-45.20"
    assert metrics["currencyTotals"]["JPY"]["zeroCount"] == 1


def test_only_amount_and_currency_determine_validity(engine):
    add(engine, "validity", "validity.json", [
        {"amount": "1", "currency": "USD", "status": "misterioso", "date": "31/02/2026"},
        {"transactionId": "MISSING", "currency": "EUR"},
    ])
    metrics = engine.get_summary()["metrics"]
    assert metrics["validTransactions"] == 1
    assert metrics["invalidTransactions"] == 1
    assert metrics["processedTransactions"] == 2


def test_multiple_errors_count_record_once_and_preserve_trace(engine):
    add(engine, "trace", "trace.json", {"transactions": [{"transactionId": "A", "amount": "1,500", "currency": "$"}]})
    metrics = engine.get_summary()["metrics"]
    assert metrics["invalidTransactions"] == 1
    assert metrics["processedTransactions"] == 1
    record = engine.get_record(engine.query_transactions()["items"][0]["recordId"])
    assert record["jsonPath"] == "$.transactions[0]"
    assert record["original"]["amount"] == "1,500"
    assert {item["code"] for item in record["diagnostics"]} >= {"AMBIGUOUS_AMOUNT", "UNKNOWN_CURRENCY"}


def test_decimal_metrics_transport_sort_and_filter_are_exact(engine):
    add(engine, "precision", "precision.json", [
        {"amount": "0.1000000000000000000000000001", "currency": "USD"},
        {"amount": "0.2000000000000000000000000002", "currency": "USD"},
        {"amount": "-0.3", "currency": "USD"},
    ])
    totals = engine.get_summary()["metrics"]["currencyTotals"]["USD"]
    assert totals["positive"] == "0.3000000000000000000000000003"
    assert totals["negative"] == "-0.3"
    assert totals["net"] == "0.0000000000000000000000000003"
    filtered = engine.query_transactions(filters={"amountMin": "0.15"}, sort_field="amount", sort_order=1)
    assert filtered["total"] == 1
    assert filtered["items"][0]["amount"] == "0.2000000000000000000000000002"
    assert isinstance(totals["net"], str)


def test_duplicates_warn_without_removing_records_and_recalculate_on_remove(engine):
    transaction = {"transactionId": "D-1", "source": "BANK-A", "amount": "5", "currency": "USD"}
    add(engine, "a", "a.json", [transaction])
    add(engine, "b", "b.json", [transaction])
    assert engine.get_summary()["metrics"]["processedTransactions"] == 2
    assert engine.get_summary()["metrics"]["diagnosticCodeCounts"]["POSSIBLE_DUPLICATE"] == 2
    engine.remove_file("b")
    assert engine.get_summary()["metrics"]["processedTransactions"] == 1
    assert "POSSIBLE_DUPLICATE" not in engine.get_summary()["metrics"]["diagnosticCodeCounts"]


def test_file_limits_rejections_do_not_consume_slots(engine):
    oversized = add(engine, "large", "large.json", {}, MAX_FILE_BYTES + 1)
    wrong_type = add(engine, "xml", "file.xml", "{}")
    malformed = add(engine, "bad", "bad.json", "{")
    assert [oversized["diagnostic"]["code"], wrong_type["diagnostic"]["code"], malformed["diagnostic"]["code"]] == ["FILE_TOO_LARGE", "INVALID_FILE_TYPE", "INVALID_JSON"]
    assert len(engine.files) == 0
    for index in range(3):
        assert add(engine, str(index), f"{index}.json", [], MAX_FILE_BYTES)["accepted"] is True
    fourth = add(engine, "four", "four.json", [])
    assert fourth["accepted"] is False
    assert len(engine.files) == 3
    assert engine.get_summary()["limits"]["activeBytes"] == 3 * MAX_FILE_BYTES


def test_file_and_record_diagnostics_are_separate(engine):
    add(engine, "bad", "bad.json", "{")
    add(engine, "record", "record.json", [{"transactionId": "X", "amount": "bad"}])
    metrics = engine.get_summary()["metrics"]
    assert metrics["fileDiagnosticCount"] == 1
    assert metrics["recordDiagnosticCount"] >= 2
    assert metrics["processedTransactions"] == 1
    assert engine.query_diagnostics(scope="FILE")["total"] == 1
    assert engine.query_diagnostics(scope="RECORD")["total"] >= 2


def test_compact_pagination_and_memory_release(engine):
    add(engine, "many", "many.json", [{"amount": str(index), "currency": "USD"} for index in range(31)])
    page = engine.query_transactions(page=1, page_size=10, sort_field="amount", sort_order=1)
    assert len(page["items"]) == 10
    assert page["total"] == 31
    assert "original" not in page["items"][0]
    record_id = page["items"][0]["recordId"]
    assert "original" in engine.get_record(record_id)
    engine.remove_file("many")
    assert engine.query_transactions()["total"] == 0
    assert engine.get_record(record_id) is None


def test_metrics_invariant_for_selected_records(engine):
    add(engine, "mix", "mix.json", {"transactions": [
        {"amount": "1", "currency": "USD"},
        {"transactionId": "X", "amount": "bad"},
    ], "metadata": {"label": "x"}})
    metrics = calculate_metrics(engine.records)
    assert metrics["processedTransactions"] == metrics["validTransactions"] + metrics["invalidTransactions"]
    assert metrics["unidentifiedObjects"] == 1
