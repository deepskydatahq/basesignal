"""Mixpanel taxonomy extractor — pulls lexicon schemas via the Mixpanel API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterator

import dlt
import requests

from basesignal_loaders.schema import (
    AnalyticsTaxonomy,
    TaxonomyEvent,
    TaxonomyMetadata,
    TaxonomyProperty,
)

BASE_URL = "https://mixpanel.com"


def _fetch_schemas(
    project_id: str,
    auth: tuple[str, str],
) -> list[dict[str, Any]]:
    """Fetch event schemas from the Mixpanel Lexicon API."""
    url = f"{BASE_URL}/api/app/projects/{project_id}/schemas/events"
    resp = requests.get(url, auth=auth, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("results", [])


@dlt.resource(name="mixpanel_event_schemas", write_disposition="replace")
def mixpanel_event_schemas(
    service_account: str,
    secret: str,
    project_id: str,
) -> Iterator[list[dict[str, Any]]]:
    """DLT resource that yields Mixpanel lexicon event schemas."""
    results = _fetch_schemas(project_id, auth=(service_account, secret))
    if results:
        yield results


@dlt.source(name="mixpanel")
def mixpanel_source(
    service_account: str,
    secret: str,
    project_id: str,
) -> tuple:
    """DLT source for Mixpanel event schemas."""
    return (mixpanel_event_schemas(service_account, secret, project_id),)


def _extract_properties_from_schema(
    schema_json: dict[str, Any] | None,
) -> list[TaxonomyProperty]:
    """Extract TaxonomyProperty list from a Mixpanel schemaJson object."""
    if not schema_json:
        return []

    properties_def = schema_json.get("properties", {})
    required_list = schema_json.get("required", [])

    props: list[TaxonomyProperty] = []
    for prop_name, prop_def in properties_def.items():
        props.append(
            TaxonomyProperty(
                name=prop_name,
                type=prop_def.get("type", "string") or "string",
                description=prop_def.get("description", "") or "",
                required=prop_name in required_list,
            )
        )
    return props


def normalize_mixpanel_events(
    raw_schemas: list[dict[str, Any]],
) -> list[TaxonomyEvent]:
    """Convert Mixpanel Lexicon API response to TaxonomyEvent list.

    Only includes schemas with entityType == "event".
    Maps schemaJson properties to TaxonomyProperty on each event.
    """
    events: list[TaxonomyEvent] = []
    for schema in raw_schemas:
        if schema.get("entityType") != "event":
            continue

        # Derive status from visibility/drop flags
        is_hidden = schema.get("isHidden", False)
        is_dropped = schema.get("isDropped", False)
        if is_dropped:
            status = "dropped"
        elif is_hidden:
            status = "hidden"
        else:
            status = "active"

        properties = _extract_properties_from_schema(schema.get("schemaJson"))

        events.append(
            TaxonomyEvent(
                name=schema.get("name", ""),
                description=schema.get("description", "") or "",
                properties=properties,
                status=status,
            )
        )
    return events


def extract_mixpanel_taxonomy(
    service_account: str,
    secret: str,
    project_id: str,
) -> AnalyticsTaxonomy:
    """Extract a full AnalyticsTaxonomy from Mixpanel.

    Fetches lexicon event schemas, normalizes them, and returns
    a structured AnalyticsTaxonomy object.
    """
    import time

    start = time.monotonic()
    raw_schemas = _fetch_schemas(project_id, auth=(service_account, secret))
    events = normalize_mixpanel_events(raw_schemas)
    duration_ms = int((time.monotonic() - start) * 1000)

    return AnalyticsTaxonomy(
        platform="mixpanel",
        project_id=project_id,
        extracted_at=datetime.now(timezone.utc).isoformat(),
        events=events,
        metadata=TaxonomyMetadata(
            loader_version="0.1.0",
            extraction_duration_ms=duration_ms,
            event_count=len(events),
        ),
    )
