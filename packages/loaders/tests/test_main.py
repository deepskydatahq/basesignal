"""Tests for __main__.py CLI entry point."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile

import pytest


PYTHON = sys.executable
LOADER_MODULE = "basesignal_loaders"


def run_loader(*args: str) -> subprocess.CompletedProcess:
    """Run the loader module as a subprocess."""
    return subprocess.run(
        [PYTHON, "-m", LOADER_MODULE, *args],
        capture_output=True,
        text=True,
        timeout=30,
    )


class TestCLIParsing:
    """Test argument parsing and validation."""

    def test_missing_platform_exits_nonzero(self):
        result = run_loader("--api-key", "x", "--output", "/tmp/out.json")
        assert result.returncode != 0

    def test_unknown_platform_exits_nonzero(self):
        result = run_loader(
            "--platform", "unknown",
            "--api-key", "x",
            "--output", "/tmp/out.json",
        )
        assert result.returncode != 0
        assert "invalid choice" in result.stderr.lower() or "unknown" in result.stderr.lower()

    def test_missing_api_key_exits_nonzero(self):
        result = run_loader("--platform", "posthog", "--output", "/tmp/out.json")
        assert result.returncode != 0

    def test_missing_output_exits_nonzero(self):
        result = run_loader("--platform", "posthog", "--api-key", "x")
        assert result.returncode != 0

    def test_version_flag(self):
        result = run_loader("--version")
        assert result.returncode == 0
        assert "basesignal-loaders" in result.stdout


class TestPostHogExtraction:
    """Test PostHog extraction via __main__.py with mocked HTTP."""

    def test_successful_extraction_writes_json(self, monkeypatch):
        """Mock the extractor and verify JSON output."""
        from unittest.mock import patch
        from basesignal_loaders.schema import (
            AnalyticsTaxonomy,
            TaxonomyEvent,
            TaxonomyMetadata,
            TaxonomyProperty,
        )

        fake_taxonomy = AnalyticsTaxonomy(
            platform="posthog",
            project_id="12345",
            extracted_at="2026-01-01T00:00:00+00:00",
            events=[
                TaxonomyEvent(
                    name="page_view",
                    description="User viewed a page",
                    properties=[
                        TaxonomyProperty(
                            name="url",
                            type="String",
                            description="Page URL",
                            required=False,
                        )
                    ],
                    tags=["web"],
                ),
                TaxonomyEvent(
                    name="button_click",
                    description="User clicked a button",
                    properties=[],
                    tags=[],
                ),
            ],
            metadata=TaxonomyMetadata(
                loader_version="0.1.0",
                extraction_duration_ms=100,
                event_count=2,
            ),
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "taxonomy", "events.json")

            with patch(
                "basesignal_loaders.posthog.extract_posthog_taxonomy",
                return_value=fake_taxonomy,
            ):
                # Run in-process using main()
                from basesignal_loaders.__main__ import main
                import argparse

                with patch(
                    "sys.argv",
                    [
                        "basesignal_loaders",
                        "--platform", "posthog",
                        "--api-key", "phx_test",
                        "--project-id", "12345",
                        "--output", output_path,
                    ],
                ):
                    main()

            # Verify output file
            assert os.path.exists(output_path)
            with open(output_path) as f:
                data = json.load(f)

            assert data["platform"] == "posthog"
            assert data["project_id"] == "12345"
            assert len(data["events"]) == 2
            assert data["events"][0]["name"] == "page_view"
            assert data["events"][0]["properties"][0]["name"] == "url"
            assert data["events"][1]["name"] == "button_click"
            assert "metadata" in data

    def test_extraction_error_exits_nonzero(self):
        """Verify extraction errors produce exit code 1."""
        from unittest.mock import patch

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "out.json")

            with patch(
                "basesignal_loaders.posthog.extract_posthog_taxonomy",
                side_effect=Exception("API returned 401"),
            ):
                from basesignal_loaders.__main__ import main

                with patch(
                    "sys.argv",
                    [
                        "basesignal_loaders",
                        "--platform", "posthog",
                        "--api-key", "bad",
                        "--project-id", "123",
                        "--output", output_path,
                    ],
                ):
                    with pytest.raises(SystemExit) as exc_info:
                        main()
                    assert exc_info.value.code == 1

    def test_progress_on_stderr(self, capsys):
        """Verify progress messages go to stderr."""
        from unittest.mock import patch
        from basesignal_loaders.schema import AnalyticsTaxonomy, TaxonomyMetadata

        fake = AnalyticsTaxonomy(
            platform="posthog",
            project_id="1",
            extracted_at="2026-01-01T00:00:00+00:00",
            events=[],
            metadata=TaxonomyMetadata(event_count=0),
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "out.json")

            with patch(
                "basesignal_loaders.posthog.extract_posthog_taxonomy",
                return_value=fake,
            ):
                from basesignal_loaders.__main__ import main

                with patch(
                    "sys.argv",
                    [
                        "basesignal_loaders",
                        "--platform", "posthog",
                        "--api-key", "x",
                        "--project-id", "1",
                        "--output", output_path,
                    ],
                ):
                    main()

            captured = capsys.readouterr()
            assert "Extracting taxonomy from PostHog" in captured.err
            assert "Done:" in captured.err


class TestOutputSchema:
    """Test that output matches AnalyticsTaxonomy schema."""

    def test_output_matches_schema(self):
        from unittest.mock import patch
        from basesignal_loaders.schema import (
            AnalyticsTaxonomy,
            TaxonomyEvent,
            TaxonomyMetadata,
            TaxonomyProperty,
        )

        fake = AnalyticsTaxonomy(
            platform="amplitude",
            project_id="amp-project",
            extracted_at="2026-01-01T00:00:00+00:00",
            events=[
                TaxonomyEvent(
                    name="signup",
                    description="User signed up",
                    properties=[
                        TaxonomyProperty(name="method", type="String", description="Signup method", required=True),
                    ],
                    category="core",
                    status="active",
                    tags=["onboarding"],
                    volume_last_30d=5000,
                ),
            ],
            metadata=TaxonomyMetadata(
                loader_version="0.1.0",
                extraction_duration_ms=200,
                event_count=1,
            ),
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "out.json")

            with patch(
                "basesignal_loaders.amplitude.extract_amplitude_taxonomy",
                return_value=fake,
            ):
                from basesignal_loaders.__main__ import main

                with patch(
                    "sys.argv",
                    [
                        "basesignal_loaders",
                        "--platform", "amplitude",
                        "--api-key", "x",
                        "--output", output_path,
                    ],
                ):
                    main()

            with open(output_path) as f:
                data = json.load(f)

            # Required top-level fields
            assert "platform" in data
            assert "project_id" in data
            assert "extracted_at" in data
            assert "events" in data
            assert isinstance(data["events"], list)

            # Event structure
            event = data["events"][0]
            assert "name" in event
            assert "description" in event
            assert "properties" in event
            assert isinstance(event["properties"], list)
            assert "tags" in event

            # Optional fields present when set
            assert event["category"] == "core"
            assert event["status"] == "active"
            assert event["volume_last_30d"] == 5000

            # Property structure
            prop = event["properties"][0]
            assert prop["name"] == "method"
            assert prop["type"] == "String"
            assert prop["required"] is True
