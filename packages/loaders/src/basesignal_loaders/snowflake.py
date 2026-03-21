"""Snowflake activity schema taxonomy extractor.

Connects to a Snowflake warehouse, reads an activity schema table,
and extracts a normalized AnalyticsTaxonomy with activities as events
and feature_json keys as properties.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any

from basesignal_loaders.schema import (
    AnalyticsTaxonomy,
    TaxonomyEvent,
    TaxonomyMetadata,
    TaxonomyProperty,
)


def _quote_identifier(value: str) -> str:
    """Quote a Snowflake identifier to prevent SQL injection.

    Wraps the identifier in double quotes and escapes any embedded
    double-quote characters by doubling them (standard SQL quoting).
    """
    if not value:
        raise ValueError("Snowflake identifier cannot be empty")
    return '"' + value.replace('"', '""') + '"'


def _infer_type(value: Any) -> str:
    """Infer a TaxonomyProperty type string from a Python value."""
    if isinstance(value, bool):
        return "Boolean"
    if isinstance(value, int):
        return "Numeric"
    if isinstance(value, float):
        return "Numeric"
    if isinstance(value, list):
        return "Array"
    if isinstance(value, dict):
        return "Object"
    return "String"


def normalize_snowflake_rows(
    rows: list[dict[str, Any]],
    stats: dict[str, dict[str, Any]] | None = None,
) -> list[TaxonomyEvent]:
    """Convert raw Snowflake activity schema rows into TaxonomyEvent objects.

    Args:
        rows: List of dicts with 'activity' and optionally 'feature_json' keys.
              Each row represents a single record from the activity schema table.
        stats: Optional dict mapping activity name to
               {'event_count': int, 'first_seen': str, 'last_seen': str}.

    Returns:
        List of TaxonomyEvent, one per distinct activity.
    """
    if not rows:
        return []

    # Collect distinct activities and their feature_json keys
    activity_properties: dict[str, dict[str, str]] = {}  # activity -> {key: inferred_type}

    for row in rows:
        activity = row.get("activity") or row.get("ACTIVITY")
        if not activity:
            continue

        if activity not in activity_properties:
            activity_properties[activity] = {}

        # Parse feature_json if present
        feature_json = row.get("feature_json") or row.get("FEATURE_JSON")
        if feature_json:
            if isinstance(feature_json, str):
                try:
                    feature_json = json.loads(feature_json)
                except (json.JSONDecodeError, TypeError):
                    feature_json = None

            if isinstance(feature_json, dict):
                for key, value in feature_json.items():
                    if key not in activity_properties[activity]:
                        activity_properties[activity][key] = _infer_type(value)

    events: list[TaxonomyEvent] = []
    for activity_name in sorted(activity_properties.keys()):
        props = [
            TaxonomyProperty(
                name=key,
                type=prop_type,
                description="",
                required=False,
            )
            for key, prop_type in sorted(activity_properties[activity_name].items())
        ]

        volume = None
        tags: list[str] = []
        if stats and activity_name in stats:
            s = stats[activity_name]
            volume = s.get("volume_last_30d")
            first_seen = s.get("first_seen")
            last_seen = s.get("last_seen")
            if first_seen:
                tags.append(f"first_seen:{first_seen}")
            if last_seen:
                tags.append(f"last_seen:{last_seen}")

        events.append(
            TaxonomyEvent(
                name=activity_name,
                description="",
                properties=props,
                tags=tags,
                volume_last_30d=volume,
            )
        )

    return events


def extract_snowflake_taxonomy(
    account: str,
    user: str,
    password: str,
    warehouse: str,
    database: str,
    schema: str,
    table: str,
    stats: bool = False,
) -> AnalyticsTaxonomy:
    """Extract a full AnalyticsTaxonomy from a Snowflake activity schema table.

    Args:
        account: Snowflake account identifier.
        user: Snowflake username.
        password: Snowflake password.
        warehouse: Snowflake warehouse name.
        database: Snowflake database name.
        schema: Snowflake schema name.
        table: Activity schema table name.
        stats: If True, query aggregated usage stats per activity.

    Returns:
        AnalyticsTaxonomy with platform='snowflake'.

    Raises:
        ConnectionError: If the Snowflake connection fails.
    """
    try:
        import snowflake.connector  # type: ignore[import-untyped]
    except ImportError:
        raise ImportError(
            "snowflake-connector-python is required for the Snowflake loader. "
            "Install it with: pip install snowflake-connector-python"
        )

    start = time.monotonic()
    fqn = ".".join(_quote_identifier(part) for part in (database, schema, table))
    project_id = f"{account}/{database}.{schema}"

    try:
        conn = snowflake.connector.connect(
            account=account,
            user=user,
            password=password,
            warehouse=warehouse,
            database=database,
            schema=schema,
        )
    except Exception as exc:
        raise ConnectionError(
            f"Failed to connect to Snowflake account '{account}': {exc}"
        ) from exc

    try:
        cur = conn.cursor()

        # Fetch all rows with activity and feature_json
        cur.execute(f"SELECT activity, feature_json FROM {fqn}")
        columns = [desc[0] for desc in cur.description]
        raw_rows = [dict(zip(columns, row)) for row in cur.fetchall()]

        # Optionally fetch stats
        stats_dict: dict[str, dict[str, Any]] | None = None
        if stats:
            cur.execute(
                f"SELECT activity, "
                f"COUNT_IF(ts >= DATEADD(day, -30, CURRENT_TIMESTAMP)) AS volume_last_30d, "
                f"COUNT(*) AS event_count, "
                f"MIN(ts) AS first_seen, MAX(ts) AS last_seen "
                f"FROM {fqn} GROUP BY activity"
            )
            stats_dict = {}
            for row in cur.fetchall():
                activity_name = row[0]
                stats_dict[activity_name] = {
                    "volume_last_30d": row[1],
                    "event_count": row[2],
                    "first_seen": str(row[3]) if row[3] else None,
                    "last_seen": str(row[4]) if row[4] else None,
                }
    finally:
        conn.close()

    events = normalize_snowflake_rows(raw_rows, stats_dict)
    duration_ms = int((time.monotonic() - start) * 1000)

    return AnalyticsTaxonomy(
        platform="snowflake",
        project_id=project_id,
        extracted_at=datetime.now(timezone.utc).isoformat(),
        events=events,
        metadata=TaxonomyMetadata(
            loader_version="0.1.0",
            extraction_duration_ms=duration_ms,
            event_count=len(events),
        ),
    )
