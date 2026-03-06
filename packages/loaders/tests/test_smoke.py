"""Smoke tests for basesignal-loaders package."""

import json

from basesignal_loaders import __version__
from basesignal_loaders.schema import (
    AnalyticsTaxonomy,
    TaxonomyEvent,
    TaxonomyMetadata,
    TaxonomyProperty,
)


def test_version_exists():
    """Package exposes a version string."""
    assert isinstance(__version__, str)
    assert len(__version__) > 0


def test_taxonomy_property_fields():
    """TaxonomyProperty has name, type, description, required."""
    prop = TaxonomyProperty(
        name="user_id", type="string", description="Unique user ID", required=True
    )
    assert prop.name == "user_id"
    assert prop.type == "string"
    assert prop.description == "Unique user ID"
    assert prop.required is True


def test_taxonomy_event_required_fields():
    """TaxonomyEvent works with only required fields."""
    event = TaxonomyEvent(name="signup", description="User signed up")
    assert event.name == "signup"
    assert event.properties == []
    assert event.category is None
    assert event.status is None
    assert event.tags == []
    assert event.volume_last_30d is None


def test_taxonomy_event_all_fields():
    """TaxonomyEvent accepts all optional fields."""
    prop = TaxonomyProperty(
        name="method", type="string", description="Signup method", required=True
    )
    event = TaxonomyEvent(
        name="signup",
        description="User signed up",
        properties=[prop],
        category="onboarding",
        status="active",
        tags=["core"],
        volume_last_30d=5000,
    )
    assert event.category == "onboarding"
    assert event.status == "active"
    assert event.tags == ["core"]
    assert event.volume_last_30d == 5000
    assert len(event.properties) == 1


def test_analytics_taxonomy_minimal():
    """AnalyticsTaxonomy works with no events."""
    taxonomy = AnalyticsTaxonomy(
        platform="posthog",
        project_id="proj-1",
        extracted_at="2026-03-06T00:00:00Z",
    )
    assert taxonomy.platform == "posthog"
    assert taxonomy.events == []
    assert taxonomy.metadata is None


def test_analytics_taxonomy_with_events_and_metadata():
    """AnalyticsTaxonomy holds events and metadata."""
    taxonomy = AnalyticsTaxonomy(
        platform="amplitude",
        project_id="proj-123",
        extracted_at="2026-03-06T00:00:00Z",
        events=[
            TaxonomyEvent(
                name="button_clicked",
                description="A button was clicked",
                tags=["interaction"],
            )
        ],
        metadata=TaxonomyMetadata(
            loader_version="1.0.0",
            extraction_duration_ms=500,
            event_count=1,
        ),
    )
    assert len(taxonomy.events) == 1
    assert taxonomy.metadata is not None
    assert taxonomy.metadata.loader_version == "1.0.0"


def test_to_dict_roundtrip():
    """to_dict produces valid JSON-serializable output."""
    taxonomy = AnalyticsTaxonomy(
        platform="mixpanel",
        project_id="proj-789",
        extracted_at="2026-03-06T12:00:00Z",
        events=[
            TaxonomyEvent(
                name="page_viewed",
                description="User viewed a page",
                properties=[
                    TaxonomyProperty(
                        name="url",
                        type="string",
                        description="Page URL",
                        required=True,
                    )
                ],
                category="engagement",
                tags=["web"],
                volume_last_30d=10000,
            )
        ],
        metadata=TaxonomyMetadata(event_count=1),
    )
    d = taxonomy.to_dict()

    # Ensure it's JSON-serializable
    json_str = json.dumps(d)
    parsed = json.loads(json_str)

    assert parsed["platform"] == "mixpanel"
    assert parsed["project_id"] == "proj-789"
    assert len(parsed["events"]) == 1
    assert parsed["events"][0]["name"] == "page_viewed"
    assert parsed["events"][0]["properties"][0]["name"] == "url"
    assert parsed["metadata"]["event_count"] == 1


def test_to_dict_omits_none_optional_fields():
    """to_dict does not include None optional fields in events."""
    taxonomy = AnalyticsTaxonomy(
        platform="amplitude",
        project_id="proj-1",
        extracted_at="2026-03-06T00:00:00Z",
        events=[
            TaxonomyEvent(name="test", description="Test event")
        ],
    )
    d = taxonomy.to_dict()
    event_dict = d["events"][0]
    assert "category" not in event_dict
    assert "status" not in event_dict
    assert "volume_last_30d" not in event_dict
    assert "metadata" not in d
