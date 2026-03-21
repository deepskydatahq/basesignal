"""Tests for Snowflake activity schema taxonomy extractor."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from basesignal_loaders.snowflake import (
    extract_snowflake_taxonomy,
    normalize_snowflake_rows,
    _infer_type,
    _quote_identifier,
)
from basesignal_loaders.schema import AnalyticsTaxonomy, TaxonomyEvent

FIXTURES = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> list:
    return json.loads((FIXTURES / name).read_text())


# ---------- _infer_type ----------


def test_infer_type_string():
    assert _infer_type("hello") == "String"


def test_infer_type_numeric_int():
    assert _infer_type(42) == "Numeric"


def test_infer_type_numeric_float():
    assert _infer_type(3.14) == "Numeric"


def test_infer_type_boolean():
    assert _infer_type(True) == "Boolean"


def test_infer_type_array():
    assert _infer_type([1, 2, 3]) == "Array"


def test_infer_type_object():
    assert _infer_type({"key": "val"}) == "Object"


def test_infer_type_none():
    assert _infer_type(None) == "String"


# ---------- _quote_identifier ----------


def test_quote_identifier_basic():
    assert _quote_identifier("MY_TABLE") == '"MY_TABLE"'


def test_quote_identifier_escapes_double_quotes():
    assert _quote_identifier('my"table') == '"my""table"'


def test_quote_identifier_empty_raises():
    with pytest.raises(ValueError, match="cannot be empty"):
        _quote_identifier("")


# ---------- normalize_snowflake_rows ----------


def test_normalize_snowflake_rows_basic():
    """Rows with distinct activities produce correct TaxonomyEvents."""
    rows = _load_fixture("snowflake_activity_rows.json")
    events = normalize_snowflake_rows(rows)

    assert len(events) == 3
    assert all(isinstance(e, TaxonomyEvent) for e in events)
    event_names = [e.name for e in events]
    assert "page_viewed" in event_names
    assert "signed_up" in event_names
    assert "feature_used" in event_names


def test_normalize_snowflake_rows_feature_json():
    """feature_json keys become TaxonomyProperty with inferred types."""
    rows = _load_fixture("snowflake_activity_rows.json")
    events = normalize_snowflake_rows(rows)

    # Find page_viewed event
    page_viewed = next(e for e in events if e.name == "page_viewed")
    prop_names = [p.name for p in page_viewed.properties]
    assert "url" in prop_names
    assert "duration_s" in prop_names
    assert "referrer" in prop_names

    # Check inferred types
    url_prop = next(p for p in page_viewed.properties if p.name == "url")
    assert url_prop.type == "String"

    duration_prop = next(p for p in page_viewed.properties if p.name == "duration_s")
    assert duration_prop.type == "Numeric"

    # signed_up should have is_invited as Boolean
    signed_up = next(e for e in events if e.name == "signed_up")
    is_invited = next(p for p in signed_up.properties if p.name == "is_invited")
    assert is_invited.type == "Boolean"


def test_normalize_snowflake_rows_stats():
    """Stats mode populates volume and date tags via metadata."""
    rows = _load_fixture("snowflake_activity_rows.json")
    stats = {
        "page_viewed": {
            "volume_last_30d": 1500,
            "event_count": 8000,
            "first_seen": "2025-01-01T00:00:00",
            "last_seen": "2026-03-01T00:00:00",
        },
        "signed_up": {
            "volume_last_30d": 200,
            "event_count": 1000,
            "first_seen": "2025-02-15T00:00:00",
            "last_seen": "2026-03-10T00:00:00",
        },
    }

    events = normalize_snowflake_rows(rows, stats)

    page_viewed = next(e for e in events if e.name == "page_viewed")
    assert page_viewed.volume_last_30d == 1500
    assert "first_seen:2025-01-01T00:00:00" in page_viewed.tags
    assert "last_seen:2026-03-01T00:00:00" in page_viewed.tags

    signed_up = next(e for e in events if e.name == "signed_up")
    assert signed_up.volume_last_30d == 200

    # feature_used has no stats
    feature_used = next(e for e in events if e.name == "feature_used")
    assert feature_used.volume_last_30d is None
    assert feature_used.tags == []


def test_normalize_snowflake_rows_empty():
    """Empty input returns empty events list."""
    events = normalize_snowflake_rows([])
    assert events == []


def test_normalize_snowflake_rows_null_feature_json():
    """Rows with null feature_json produce events with no properties."""
    rows = [
        {"activity": "login", "feature_json": None},
        {"activity": "login", "feature_json": None},
    ]
    events = normalize_snowflake_rows(rows)
    assert len(events) == 1
    assert events[0].name == "login"
    assert events[0].properties == []


def test_normalize_snowflake_rows_uppercase_columns():
    """Handles Snowflake uppercase column names (ACTIVITY, FEATURE_JSON)."""
    rows = [
        {"ACTIVITY": "clicked_button", "FEATURE_JSON": '{"button_id": "submit"}'},
    ]
    events = normalize_snowflake_rows(rows)
    assert len(events) == 1
    assert events[0].name == "clicked_button"
    assert len(events[0].properties) == 1
    assert events[0].properties[0].name == "button_id"


# ---------- extract_snowflake_taxonomy ----------


def test_extract_snowflake_taxonomy():
    """Mocked connector returns fixture rows, produces complete AnalyticsTaxonomy."""
    fixture_rows = _load_fixture("snowflake_activity_rows.json")

    # Build row tuples as Snowflake connector returns them
    column_names = ["activity", "feature_json"]
    row_tuples = [(r["activity"], r["feature_json"]) for r in fixture_rows]

    mock_cursor = MagicMock()
    mock_cursor.description = [(name,) for name in column_names]
    mock_cursor.fetchall.return_value = row_tuples

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    mock_sf_connector = MagicMock()
    mock_sf_connector.connect.return_value = mock_conn

    mock_sf_module = MagicMock()
    mock_sf_module.connector = mock_sf_connector

    with patch.dict("sys.modules", {"snowflake": mock_sf_module, "snowflake.connector": mock_sf_connector}):
        taxonomy = extract_snowflake_taxonomy(
            account="test-account",
            user="testuser",
            password="testpass",
            warehouse="TEST_WH",
            database="TEST_DB",
            schema="PUBLIC",
            table="ACTIVITIES",
        )

    assert isinstance(taxonomy, AnalyticsTaxonomy)
    assert taxonomy.platform == "snowflake"
    assert taxonomy.project_id == "test-account/TEST_DB.PUBLIC"
    assert len(taxonomy.events) == 3
    assert taxonomy.metadata is not None
    assert taxonomy.metadata.event_count == 3
    assert taxonomy.metadata.loader_version == "0.1.0"
    assert taxonomy.metadata.extraction_duration_ms >= 0

    # Verify serialization
    d = taxonomy.to_dict()
    assert d["platform"] == "snowflake"
    assert len(d["events"]) == 3


def test_extract_snowflake_taxonomy_with_stats():
    """Mocked connector with stats=True populates volume metadata."""
    fixture_rows = _load_fixture("snowflake_activity_rows.json")

    column_names = ["activity", "feature_json"]
    row_tuples = [(r["activity"], r["feature_json"]) for r in fixture_rows]

    stats_column_names = ["activity", "volume_last_30d", "event_count", "first_seen", "last_seen"]
    stats_rows = [
        ("feature_used", 20, 100, "2025-06-01", "2026-03-01"),
        ("page_viewed", 1200, 5000, "2025-01-01", "2026-03-10"),
        ("signed_up", 50, 300, "2025-03-15", "2026-03-09"),
    ]

    call_count = [0]

    mock_cursor = MagicMock()

    def mock_execute(query):
        call_count[0] += 1
        if call_count[0] == 1:
            mock_cursor.description = [(name,) for name in column_names]
            mock_cursor.fetchall.return_value = row_tuples
        else:
            mock_cursor.description = [(name,) for name in stats_column_names]
            mock_cursor.fetchall.return_value = stats_rows

    mock_cursor.execute = mock_execute

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    mock_sf_connector = MagicMock()
    mock_sf_connector.connect.return_value = mock_conn

    mock_sf_module = MagicMock()
    mock_sf_module.connector = mock_sf_connector

    with patch.dict("sys.modules", {"snowflake": mock_sf_module, "snowflake.connector": mock_sf_connector}):
        taxonomy = extract_snowflake_taxonomy(
            account="test-account",
            user="testuser",
            password="testpass",
            warehouse="TEST_WH",
            database="TEST_DB",
            schema="PUBLIC",
            table="ACTIVITIES",
            stats=True,
        )

    page_viewed = next(e for e in taxonomy.events if e.name == "page_viewed")
    assert page_viewed.volume_last_30d == 1200


def test_extract_snowflake_taxonomy_connection_error():
    """Connection failure raises a clear ConnectionError."""
    mock_sf_connector = MagicMock()
    mock_sf_connector.connect.side_effect = Exception("Could not connect to Snowflake backend")

    mock_sf_module = MagicMock()
    mock_sf_module.connector = mock_sf_connector

    with patch.dict("sys.modules", {"snowflake": mock_sf_module, "snowflake.connector": mock_sf_connector}):
        with pytest.raises(ConnectionError, match="Failed to connect to Snowflake"):
            extract_snowflake_taxonomy(
                account="bad-account",
                user="user",
                password="pass",
                warehouse="WH",
                database="DB",
                schema="PUBLIC",
                table="ACTIVITIES",
            )


def test_extract_snowflake_taxonomy_missing_connector():
    """Missing snowflake-connector-python raises ImportError with install hint."""
    # Remove snowflake from sys.modules so the import fails
    with patch.dict("sys.modules", {"snowflake": None, "snowflake.connector": None}):
        with pytest.raises(ImportError, match="snowflake-connector-python"):
            extract_snowflake_taxonomy(
                account="acct",
                user="u",
                password="p",
                warehouse="wh",
                database="db",
                schema="s",
                table="t",
            )


# ---------- __main__ dispatch ----------


def test_main_snowflake_dispatch():
    """__main__ with --platform snowflake dispatches correctly."""
    from basesignal_loaders.__main__ import _build_parser, _extract, SUPPORTED_PLATFORMS

    assert "snowflake" in SUPPORTED_PLATFORMS

    parser = _build_parser()
    args = parser.parse_args([
        "--platform", "snowflake",
        "--account", "myaccount",
        "--user", "myuser",
        "--password", "mypass",
        "--warehouse", "MY_WH",
        "--database", "MY_DB",
        "--sf-schema", "PUBLIC",
        "--table", "ACTIVITIES",
        "--output", "/tmp/test_output.json",
        "--stats",
    ])

    assert args.platform == "snowflake"
    assert args.account == "myaccount"
    assert args.user == "myuser"
    assert args.password == "mypass"
    assert args.warehouse == "MY_WH"
    assert args.database == "MY_DB"
    assert args.sf_schema == "PUBLIC"
    assert args.table == "ACTIVITIES"
    assert args.stats is True

    # Verify dispatch calls extract_snowflake_taxonomy
    mock_taxonomy = MagicMock()
    mock_taxonomy.to_dict.return_value = {"platform": "snowflake", "events": []}

    with patch("basesignal_loaders.snowflake.extract_snowflake_taxonomy", return_value=mock_taxonomy) as mock_extract:
        # We need to patch at the import location inside __main__
        with patch("basesignal_loaders.__main__.extract_snowflake_taxonomy", mock_extract, create=True):
            # Actually, _extract does a local import, so we patch the module
            result = _extract(args)

    assert result["platform"] == "snowflake"
    mock_extract.assert_called_once_with(
        account="myaccount",
        user="myuser",
        password="mypass",
        warehouse="MY_WH",
        database="MY_DB",
        schema="PUBLIC",
        table="ACTIVITIES",
        stats=True,
    )
