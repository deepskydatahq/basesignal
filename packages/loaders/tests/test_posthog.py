"""Tests for PostHog taxonomy extractor."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from basesignal_loaders.posthog import (
    extract_posthog_taxonomy,
    normalize_posthog_events,
    posthog_source,
    posthog_event_definitions,
    _paginate,
)
from basesignal_loaders.schema import AnalyticsTaxonomy, TaxonomyEvent

FIXTURES = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


# ---------- normalize_posthog_events ----------


def test_normalize_posthog_events_basic():
    """normalize_posthog_events converts raw API responses to TaxonomyEvent list."""
    raw_events = _load_fixture("posthog_event_definitions.json")["results"]
    raw_props = _load_fixture("posthog_property_definitions.json")["results"]

    events = normalize_posthog_events(raw_events, raw_props)

    assert len(events) == 3
    assert all(isinstance(e, TaxonomyEvent) for e in events)


def test_normalize_posthog_events_fields():
    """Events have correct names, descriptions, tags, and volumes."""
    raw_events = _load_fixture("posthog_event_definitions.json")["results"]
    raw_props = _load_fixture("posthog_property_definitions.json")["results"]

    events = normalize_posthog_events(raw_events, raw_props)

    pageview = events[0]
    assert pageview.name == "$pageview"
    assert pageview.description == "When a user views a page"
    assert "web" in pageview.tags
    assert pageview.volume_last_30d == 15000

    signup = events[1]
    assert signup.name == "signup"
    assert signup.tags == ["onboarding"]
    assert signup.volume_last_30d == 500

    feature = events[2]
    assert feature.name == "feature_used"
    assert feature.description == ""
    assert feature.volume_last_30d is None


def test_normalize_posthog_events_properties_mapped():
    """Properties from property_definitions are mapped to each event."""
    raw_events = _load_fixture("posthog_event_definitions.json")["results"]
    raw_props = _load_fixture("posthog_property_definitions.json")["results"]

    events = normalize_posthog_events(raw_events, raw_props)

    # All events should have all 4 properties (PostHog props are project-level)
    for ev in events:
        assert len(ev.properties) == 4
        prop_names = [p.name for p in ev.properties]
        assert "$current_url" in prop_names
        assert "signup_method" in prop_names


def test_normalize_posthog_events_property_fields():
    """Each TaxonomyProperty has correct type, description, required."""
    raw_events = _load_fixture("posthog_event_definitions.json")["results"]
    raw_props = _load_fixture("posthog_property_definitions.json")["results"]

    events = normalize_posthog_events(raw_events, raw_props)
    url_prop = next(p for p in events[0].properties if p.name == "$current_url")
    assert url_prop.type == "String"
    assert url_prop.description == "The URL of the current page"
    assert url_prop.required is False


def test_normalize_posthog_events_empty_inputs():
    """Empty inputs produce empty event list."""
    events = normalize_posthog_events([], [])
    assert events == []


# ---------- posthog_source / DLT resource ----------


def test_posthog_source_returns_resources():
    """posthog_source() returns DLT resources for events and properties."""
    source = posthog_source("fake-key", "12345")
    # DLT source should have our two resources
    resource_names = list(source.resources.keys())
    assert "posthog_event_definitions" in resource_names
    assert "posthog_property_definitions" in resource_names


def test_posthog_event_definitions_resource_is_dlt_resource():
    """posthog_event_definitions is a callable DLT resource."""
    resource = posthog_event_definitions("fake-key", "12345")
    # Should have a name attribute from @dlt.resource
    assert hasattr(resource, "name")


# ---------- Pagination ----------


def test_paginate_single_page():
    """_paginate yields one page when next is null."""
    fixture = _load_fixture("posthog_event_definitions.json")
    mock_resp = MagicMock()
    mock_resp.json.return_value = fixture
    mock_resp.raise_for_status = MagicMock()

    with patch("basesignal_loaders.posthog.requests.get", return_value=mock_resp):
        pages = list(_paginate("http://example.com/api", {}))

    assert len(pages) == 1
    assert len(pages[0]) == 3


def test_paginate_multiple_pages():
    """_paginate follows next URLs across multiple pages."""
    page1 = _load_fixture("posthog_event_definitions_page1.json")
    page2 = _load_fixture("posthog_event_definitions_page2.json")

    mock_resp1 = MagicMock()
    mock_resp1.json.return_value = page1
    mock_resp1.raise_for_status = MagicMock()

    mock_resp2 = MagicMock()
    mock_resp2.json.return_value = page2
    mock_resp2.raise_for_status = MagicMock()

    with patch(
        "basesignal_loaders.posthog.requests.get",
        side_effect=[mock_resp1, mock_resp2],
    ):
        pages = list(_paginate("http://example.com/api", {}))

    assert len(pages) == 2
    assert pages[0][0]["name"] == "$pageview"
    assert pages[1][0]["name"] == "signup"


# ---------- extract_posthog_taxonomy ----------


def test_extract_posthog_taxonomy_integration():
    """extract_posthog_taxonomy returns a complete AnalyticsTaxonomy."""
    events_fixture = _load_fixture("posthog_event_definitions.json")
    props_fixture = _load_fixture("posthog_property_definitions.json")

    def mock_get(url, **kwargs):
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        if "event_definitions" in url:
            resp.json.return_value = events_fixture
        else:
            resp.json.return_value = props_fixture
        return resp

    with patch("basesignal_loaders.posthog.requests.get", side_effect=mock_get):
        taxonomy = extract_posthog_taxonomy("fake-key", "proj-123")

    assert isinstance(taxonomy, AnalyticsTaxonomy)
    assert taxonomy.platform == "posthog"
    assert taxonomy.project_id == "proj-123"
    assert len(taxonomy.events) == 3
    assert taxonomy.metadata is not None
    assert taxonomy.metadata.event_count == 3
    assert taxonomy.metadata.loader_version == "0.1.0"
    assert taxonomy.metadata.extraction_duration_ms >= 0

    # Verify serialization
    d = taxonomy.to_dict()
    assert d["platform"] == "posthog"
    assert len(d["events"]) == 3


def test_extract_posthog_taxonomy_custom_host():
    """extract_posthog_taxonomy uses custom host for self-hosted instances."""
    events_fixture = _load_fixture("posthog_event_definitions.json")
    props_fixture = _load_fixture("posthog_property_definitions.json")

    called_urls = []

    def mock_get(url, **kwargs):
        called_urls.append(url)
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        if "event_definitions" in url:
            resp.json.return_value = events_fixture
        else:
            resp.json.return_value = props_fixture
        return resp

    with patch("basesignal_loaders.posthog.requests.get", side_effect=mock_get):
        extract_posthog_taxonomy("key", "proj-1", host="https://ph.example.com")

    assert all("ph.example.com" in url for url in called_urls)
