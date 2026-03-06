"""Tests for Mixpanel taxonomy extractor."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from basesignal_loaders.mixpanel import (
    extract_mixpanel_taxonomy,
    mixpanel_source,
    mixpanel_event_schemas,
    normalize_mixpanel_events,
)
from basesignal_loaders.schema import AnalyticsTaxonomy, TaxonomyEvent

FIXTURES = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


# ---------- normalize_mixpanel_events ----------


def test_normalize_mixpanel_events_basic():
    """normalize_mixpanel_events converts raw schemas to TaxonomyEvent list."""
    raw = _load_fixture("mixpanel_schemas.json")["results"]
    events = normalize_mixpanel_events(raw)

    assert len(events) == 3
    assert all(isinstance(e, TaxonomyEvent) for e in events)


def test_normalize_mixpanel_events_fields():
    """Events have correct names, descriptions, and status."""
    raw = _load_fixture("mixpanel_schemas.json")["results"]
    events = normalize_mixpanel_events(raw)

    app_opened = events[0]
    assert app_opened.name == "App Opened"
    assert app_opened.description == "User opened the application"
    assert app_opened.status == "active"

    legacy = events[2]
    assert legacy.name == "Legacy Event"
    assert legacy.description == ""
    assert legacy.status == "dropped"


def test_normalize_mixpanel_events_properties_from_schema():
    """Properties from schemaJson are mapped to TaxonomyProperty on each event."""
    raw = _load_fixture("mixpanel_schemas.json")["results"]
    events = normalize_mixpanel_events(raw)

    # App Opened has 2 properties, "platform" is required
    app_opened = events[0]
    assert len(app_opened.properties) == 2
    prop_names = {p.name for p in app_opened.properties}
    assert "platform" in prop_names
    assert "app_version" in prop_names
    platform_prop = next(p for p in app_opened.properties if p.name == "platform")
    assert platform_prop.required is True
    assert platform_prop.type == "string"

    # Item Purchased has 3 properties, "item_id" and "price" are required
    item_purchased = events[1]
    assert len(item_purchased.properties) == 3
    required_props = [p.name for p in item_purchased.properties if p.required]
    assert "item_id" in required_props
    assert "price" in required_props

    # Legacy Event has no schemaJson, so no properties
    legacy = events[2]
    assert len(legacy.properties) == 0


def test_normalize_mixpanel_events_empty_inputs():
    """Empty inputs produce empty event list."""
    events = normalize_mixpanel_events([])
    assert events == []


# ---------- mixpanel_source / DLT resource ----------


def test_mixpanel_source_returns_resources():
    """mixpanel_source() returns DLT resources for event schemas."""
    source = mixpanel_source("fake-sa", "fake-secret", "12345")
    resource_names = list(source.resources.keys())
    assert "mixpanel_event_schemas" in resource_names


def test_mixpanel_event_schemas_resource_is_dlt_resource():
    """mixpanel_event_schemas is a callable DLT resource."""
    resource = mixpanel_event_schemas("fake-sa", "fake-secret", "12345")
    assert hasattr(resource, "name")


# ---------- extract_mixpanel_taxonomy ----------


def test_extract_mixpanel_taxonomy_integration():
    """extract_mixpanel_taxonomy returns a complete AnalyticsTaxonomy."""
    fixture = _load_fixture("mixpanel_schemas.json")

    def mock_get(url, **kwargs):
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json.return_value = fixture
        return resp

    with patch("basesignal_loaders.mixpanel.requests.get", side_effect=mock_get):
        taxonomy = extract_mixpanel_taxonomy("sa", "secret", "proj-456")

    assert isinstance(taxonomy, AnalyticsTaxonomy)
    assert taxonomy.platform == "mixpanel"
    assert taxonomy.project_id == "proj-456"
    assert len(taxonomy.events) == 3
    assert taxonomy.metadata is not None
    assert taxonomy.metadata.event_count == 3
    assert taxonomy.metadata.loader_version == "0.1.0"

    # Verify serialization
    d = taxonomy.to_dict()
    assert d["platform"] == "mixpanel"
    assert len(d["events"]) == 3
