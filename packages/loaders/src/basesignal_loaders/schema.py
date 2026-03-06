"""Normalized analytics taxonomy schema — mirrors @basesignal/core types."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class TaxonomyProperty:
    """A property attached to a taxonomy event."""

    name: str
    type: str
    description: str
    required: bool


@dataclass
class TaxonomyEvent:
    """A single event in the analytics taxonomy."""

    name: str
    description: str
    properties: list[TaxonomyProperty] = field(default_factory=list)
    category: str | None = None
    status: str | None = None
    tags: list[str] = field(default_factory=list)
    volume_last_30d: int | None = None


@dataclass
class TaxonomyMetadata:
    """Platform-level metadata for the taxonomy extraction."""

    loader_version: str | None = None
    extraction_duration_ms: int | None = None
    event_count: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class AnalyticsTaxonomy:
    """Normalized analytics taxonomy extracted from a platform."""

    platform: str
    project_id: str
    extracted_at: str
    events: list[TaxonomyEvent] = field(default_factory=list)
    metadata: TaxonomyMetadata | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a plain dict matching the JSON schema."""
        result: dict[str, Any] = {
            "platform": self.platform,
            "project_id": self.project_id,
            "extracted_at": self.extracted_at,
            "events": [
                {
                    "name": e.name,
                    "description": e.description,
                    "properties": [
                        {
                            "name": p.name,
                            "type": p.type,
                            "description": p.description,
                            "required": p.required,
                        }
                        for p in e.properties
                    ],
                    **({"category": e.category} if e.category is not None else {}),
                    **({"status": e.status} if e.status is not None else {}),
                    "tags": e.tags,
                    **(
                        {"volume_last_30d": e.volume_last_30d}
                        if e.volume_last_30d is not None
                        else {}
                    ),
                }
                for e in self.events
            ],
        }
        if self.metadata is not None:
            meta: dict[str, Any] = {}
            if self.metadata.loader_version is not None:
                meta["loader_version"] = self.metadata.loader_version
            if self.metadata.extraction_duration_ms is not None:
                meta["extraction_duration_ms"] = self.metadata.extraction_duration_ms
            if self.metadata.event_count is not None:
                meta["event_count"] = self.metadata.event_count
            meta.update(self.metadata.extra)
            result["metadata"] = meta
        return result
