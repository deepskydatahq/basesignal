"""PostHog taxonomy extractor — pulls event and property definitions via the PostHog API."""

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

DEFAULT_HOST = "https://app.posthog.com"
PAGE_LIMIT = 100


def _paginate(
    url: str,
    headers: dict[str, str],
    params: dict[str, Any] | None = None,
) -> Iterator[list[dict[str, Any]]]:
    """Paginate through a PostHog API endpoint, yielding pages of results."""
    next_url: str | None = url
    while next_url is not None:
        resp = requests.get(next_url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if results:
            yield results
        next_url = data.get("next")
        # Only pass params on the first request; subsequent URLs include them
        params = None


def _fetch_all(
    url: str,
    headers: dict[str, str],
    params: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Fetch all pages from a paginated PostHog endpoint."""
    all_results: list[dict[str, Any]] = []
    for page in _paginate(url, headers, params):
        all_results.extend(page)
    return all_results


@dlt.resource(name="posthog_event_definitions", write_disposition="replace")
def posthog_event_definitions(
    api_key: str,
    project_id: str,
    host: str = DEFAULT_HOST,
) -> Iterator[list[dict[str, Any]]]:
    """DLT resource that yields PostHog event definitions page by page."""
    url = f"{host.rstrip('/')}/api/projects/{project_id}/event_definitions"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {"limit": PAGE_LIMIT}
    yield from _paginate(url, headers, params)


@dlt.resource(name="posthog_property_definitions", write_disposition="replace")
def posthog_property_definitions(
    api_key: str,
    project_id: str,
    host: str = DEFAULT_HOST,
) -> Iterator[list[dict[str, Any]]]:
    """DLT resource that yields PostHog property definitions page by page."""
    url = f"{host.rstrip('/')}/api/projects/{project_id}/property_definitions"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {"limit": PAGE_LIMIT}
    yield from _paginate(url, headers, params)


@dlt.source(name="posthog")
def posthog_source(
    api_key: str,
    project_id: str,
    host: str = DEFAULT_HOST,
) -> tuple:
    """DLT source combining PostHog event and property definitions."""
    return (
        posthog_event_definitions(api_key, project_id, host),
        posthog_property_definitions(api_key, project_id, host),
    )


def normalize_posthog_events(
    raw_events: list[dict[str, Any]],
    raw_properties: list[dict[str, Any]],
) -> list[TaxonomyEvent]:
    """Convert PostHog API responses into a list of TaxonomyEvent objects.

    Properties are attached to all events since PostHog's property_definitions
    endpoint returns project-level properties (not per-event).
    """
    # Build list of TaxonomyProperty from property definitions
    properties = [
        TaxonomyProperty(
            name=p.get("name", ""),
            type=p.get("property_type", "String") or "String",
            description=p.get("description", "") or "",
            required=False,  # PostHog doesn't mark properties as required
        )
        for p in raw_properties
    ]

    events: list[TaxonomyEvent] = []
    for ev in raw_events:
        tags = ev.get("tags") or []
        events.append(
            TaxonomyEvent(
                name=ev.get("name", ""),
                description=ev.get("description", "") or "",
                properties=list(properties),  # Copy — all properties apply globally
                tags=tags,
                volume_last_30d=ev.get("volume_30_day"),
            )
        )
    return events


def extract_posthog_taxonomy(
    api_key: str,
    project_id: str,
    host: str = DEFAULT_HOST,
) -> AnalyticsTaxonomy:
    """Extract a full AnalyticsTaxonomy from PostHog.

    Fetches event definitions and property definitions, normalizes them,
    and returns a structured AnalyticsTaxonomy object.
    """
    import time

    start = time.monotonic()
    base = host.rstrip("/")
    headers = {"Authorization": f"Bearer {api_key}"}

    raw_events = _fetch_all(
        f"{base}/api/projects/{project_id}/event_definitions",
        headers,
        {"limit": PAGE_LIMIT},
    )
    raw_properties = _fetch_all(
        f"{base}/api/projects/{project_id}/property_definitions",
        headers,
        {"limit": PAGE_LIMIT},
    )

    events = normalize_posthog_events(raw_events, raw_properties)
    duration_ms = int((time.monotonic() - start) * 1000)

    return AnalyticsTaxonomy(
        platform="posthog",
        project_id=project_id,
        extracted_at=datetime.now(timezone.utc).isoformat(),
        events=events,
        metadata=TaxonomyMetadata(
            loader_version="0.1.0",
            extraction_duration_ms=duration_ms,
            event_count=len(events),
        ),
    )
