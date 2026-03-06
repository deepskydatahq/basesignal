"""Tests for Amplitude taxonomy extractor."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from basesignal_loaders.amplitude import (
    amplitude_source,
    amplitude_event_types,
    extract_amplitude_taxonomy,
    normalize_amplitude_events,
)
from basesignal_loaders.schema import AnalyticsTaxonomy, TaxonomyEvent

FIXTURES = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


# ---------- normalize_amplitude_events ----------


def test_normalize_amplitude_events_basic():
    """normalize_amplitude_events converts raw API responses to TaxonomyEvent list."""
    raw_events = _load_fixture("amplitude_event_types.json")["data"]
    raw_props = _load_fixture("amplitude_event_properties.json")["data"]

    events = normalize_amplitude_events(raw_events, raw_props)

    assert len(events) == 3
    assert all(isinstance(e, TaxonomyEvent) for e in events)


def test_normalize_amplitude_events_fields():
    """Events have correct names, descriptions, categories, and status."""
    raw_events = _load_fixture("amplitude_event_types.json")["data"]
    raw_props = _load_fixture("amplitude_event_properties.json")["data"]

    events = normalize_amplitude_events(raw_events, raw_props)

    page_viewed = events[0]
    assert page_viewed.name == "page_viewed"
    assert page_viewed.description == "User viewed a page in the app"
    assert page_viewed.category == "engagement"
    assert page_viewed.status == "active"

    purchase = events[2]
    assert purchase.name == "purchase"
    assert purchase.description == ""
    assert purchase.category is None
    assert purchase.status == "inactive"


def test_normalize_amplitude_events_properties_mapped():
    """Properties are correctly mapped to their events by event_type."""
    raw_events = _load_fixture("amplitude_event_types.json")["data"]
    raw_props = _load_fixture("amplitude_event_properties.json")["data"]

    events = normalize_amplitude_events(raw_events, raw_props)

    # page_viewed should have 2 properties
    page_viewed = events[0]
    assert len(page_viewed.properties) == 2
    prop_names = [p.name for p in page_viewed.properties]
    assert "page_url" in prop_names
    assert "referrer" in prop_names

    # signup_completed should have 1 property
    signup = events[1]
    assert len(signup.properties) == 1
    assert signup.properties[0].name == "signup_method"
    assert signup.properties[0].required is True

    # purchase should have 1 property
    purchase = events[2]
    assert len(purchase.properties) == 1
    assert purchase.properties[0].name == "amount"
    assert purchase.properties[0].type == "number"
    assert purchase.properties[0].required is True


def test_normalize_amplitude_events_empty_inputs():
    """Empty inputs produce empty event list."""
    events = normalize_amplitude_events([], [])
    assert events == []


# ---------- amplitude_source / DLT resource ----------


def test_amplitude_source_returns_resources():
    """amplitude_source() returns DLT resources for events and properties."""
    source = amplitude_source("fake-key", "fake-secret")
    resource_names = list(source.resources.keys())
    assert "amplitude_event_types" in resource_names
    assert "amplitude_event_properties" in resource_names


def test_amplitude_event_types_resource_is_dlt_resource():
    """amplitude_event_types is a callable DLT resource."""
    resource = amplitude_event_types("fake-key", "fake-secret")
    assert hasattr(resource, "name")


# ---------- extract_amplitude_taxonomy ----------


def test_extract_amplitude_taxonomy_integration():
    """extract_amplitude_taxonomy returns a complete AnalyticsTaxonomy."""
    events_fixture = _load_fixture("amplitude_event_types.json")
    props_fixture = _load_fixture("amplitude_event_properties.json")

    def mock_get(url, **kwargs):
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        if "taxonomy/event-property" in url:
            resp.json.return_value = props_fixture
        else:
            resp.json.return_value = events_fixture
        return resp

    with patch("basesignal_loaders.amplitude.requests.get", side_effect=mock_get):
        taxonomy = extract_amplitude_taxonomy("fake-key", "fake-secret")

    assert isinstance(taxonomy, AnalyticsTaxonomy)
    assert taxonomy.platform == "amplitude"
    assert len(taxonomy.events) == 3
    assert taxonomy.metadata is not None
    assert taxonomy.metadata.event_count == 3
    assert taxonomy.metadata.loader_version == "0.1.0"

    # Verify serialization
    d = taxonomy.to_dict()
    assert d["platform"] == "amplitude"
    assert len(d["events"]) == 3
