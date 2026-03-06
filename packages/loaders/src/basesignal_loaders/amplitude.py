"""Amplitude taxonomy extractor — pulls event types and properties via the Taxonomy API."""

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

BASE_URL = "https://amplitude.com"


def _fetch_json(
    url: str,
    auth: tuple[str, str],
) -> dict[str, Any]:
    """Fetch JSON from an Amplitude API endpoint using Basic auth."""
    resp = requests.get(url, auth=auth, timeout=30)
    resp.raise_for_status()
    return resp.json()


@dlt.resource(name="amplitude_event_types", write_disposition="replace")
def amplitude_event_types(
    api_key: str,
    secret_key: str,
) -> Iterator[list[dict[str, Any]]]:
    """DLT resource that yields Amplitude event types."""
    data = _fetch_json(f"{BASE_URL}/api/2/taxonomy/event", auth=(api_key, secret_key))
    results = data.get("data", [])
    if results:
        yield results


@dlt.resource(name="amplitude_event_properties", write_disposition="replace")
def amplitude_event_properties(
    api_key: str,
    secret_key: str,
) -> Iterator[list[dict[str, Any]]]:
    """DLT resource that yields Amplitude event properties."""
    data = _fetch_json(
        f"{BASE_URL}/api/2/taxonomy/event-property", auth=(api_key, secret_key)
    )
    results = data.get("data", [])
    if results:
        yield results


@dlt.source(name="amplitude")
def amplitude_source(
    api_key: str,
    secret_key: str,
) -> tuple:
    """DLT source combining Amplitude event types and properties."""
    return (
        amplitude_event_types(api_key, secret_key),
        amplitude_event_properties(api_key, secret_key),
    )


def normalize_amplitude_events(
    raw_events: list[dict[str, Any]],
    raw_properties: list[dict[str, Any]],
) -> list[TaxonomyEvent]:
    """Convert Amplitude Taxonomy API responses to TaxonomyEvent list.

    Properties are matched to events by their event_type field.
    """
    # Group properties by event_type
    props_by_event: dict[str, list[TaxonomyProperty]] = {}
    for p in raw_properties:
        event_type = p.get("event_type", "")
        prop = TaxonomyProperty(
            name=p.get("event_property", ""),
            type=p.get("type", "string") or "string",
            description=p.get("description", "") or "",
            required=bool(p.get("required", False)),
        )
        props_by_event.setdefault(event_type, []).append(prop)

    events: list[TaxonomyEvent] = []
    for ev in raw_events:
        event_type = ev.get("event_type", "")
        category = ev.get("category")
        # Map non_active to status
        is_active = not ev.get("non_active", False)
        status = "active" if is_active else "inactive"

        events.append(
            TaxonomyEvent(
                name=event_type,
                description=ev.get("description", "") or "",
                properties=props_by_event.get(event_type, []),
                category=category,
                status=status,
            )
        )
    return events


def extract_amplitude_taxonomy(
    api_key: str,
    secret_key: str,
) -> AnalyticsTaxonomy:
    """Extract a full AnalyticsTaxonomy from Amplitude.

    Fetches event types and event properties, normalizes them,
    and returns a structured AnalyticsTaxonomy object.
    """
    import time

    start = time.monotonic()
    auth = (api_key, secret_key)

    events_data = _fetch_json(f"{BASE_URL}/api/2/taxonomy/event", auth=auth)
    props_data = _fetch_json(f"{BASE_URL}/api/2/taxonomy/event-property", auth=auth)

    raw_events = events_data.get("data", [])
    raw_properties = props_data.get("data", [])

    events = normalize_amplitude_events(raw_events, raw_properties)
    duration_ms = int((time.monotonic() - start) * 1000)

    return AnalyticsTaxonomy(
        platform="amplitude",
        project_id="default",
        extracted_at=datetime.now(timezone.utc).isoformat(),
        events=events,
        metadata=TaxonomyMetadata(
            loader_version="0.1.0",
            extraction_duration_ms=duration_ms,
            event_count=len(events),
        ),
    )
