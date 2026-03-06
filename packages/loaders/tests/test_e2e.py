"""End-to-end tests: mock HTTP API -> extractor -> __main__ -> JSON file."""

from __future__ import annotations

import json
import os
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

import pytest


# ---------------------------------------------------------------------------
# Mock PostHog HTTP server
# ---------------------------------------------------------------------------

POSTHOG_EVENTS = {
    "results": [
        {
            "name": "page_view",
            "description": "User viewed a page",
            "tags": ["web"],
            "volume_30_day": 15000,
        },
        {
            "name": "button_click",
            "description": "User clicked a button",
            "tags": ["interaction"],
            "volume_30_day": 5000,
        },
        {
            "name": "signup_completed",
            "description": "User completed signup",
            "tags": ["onboarding", "conversion"],
            "volume_30_day": 800,
        },
    ],
    "next": None,
}

POSTHOG_PROPERTIES = {
    "results": [
        {
            "name": "$current_url",
            "property_type": "String",
            "description": "Current page URL",
        },
        {
            "name": "$browser",
            "property_type": "String",
            "description": "Browser name",
        },
    ],
    "next": None,
}


class MockPostHogHandler(BaseHTTPRequestHandler):
    """Handle mock PostHog API requests."""

    def do_GET(self):
        if "event_definitions" in self.path:
            self._json_response(POSTHOG_EVENTS)
        elif "property_definitions" in self.path:
            self._json_response(POSTHOG_PROPERTIES)
        else:
            self.send_error(404)

    def _json_response(self, data: dict):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        """Suppress request logging in test output."""
        pass


@pytest.fixture()
def mock_posthog_server():
    """Start a mock PostHog HTTP server on a random port."""
    server = HTTPServer(("127.0.0.1", 0), MockPostHogHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


# ---------------------------------------------------------------------------
# End-to-end tests
# ---------------------------------------------------------------------------


class TestPostHogE2E:
    """Full flow: mock PostHog API -> extractor -> taxonomy JSON."""

    def test_extract_posthog_via_main(self, mock_posthog_server):
        """Run __main__.py against mock PostHog server and verify output."""
        from unittest.mock import patch
        from basesignal_loaders.__main__ import main

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "taxonomy", "events.json")

            with patch(
                "sys.argv",
                [
                    "basesignal_loaders",
                    "--platform", "posthog",
                    "--api-key", "phx_test_key_123",
                    "--project-id", "42",
                    "--host", mock_posthog_server,
                    "--output", output_path,
                ],
            ):
                main()

            # Verify file was created
            assert os.path.exists(output_path)

            with open(output_path) as f:
                data = json.load(f)

            # Verify top-level schema
            assert data["platform"] == "posthog"
            assert data["project_id"] == "42"
            assert "extracted_at" in data
            assert isinstance(data["events"], list)

            # Verify events
            assert len(data["events"]) == 3
            event_names = [e["name"] for e in data["events"]]
            assert "page_view" in event_names
            assert "button_click" in event_names
            assert "signup_completed" in event_names

            # Verify properties are attached
            page_view = next(e for e in data["events"] if e["name"] == "page_view")
            assert len(page_view["properties"]) == 2
            prop_names = [p["name"] for p in page_view["properties"]]
            assert "$current_url" in prop_names
            assert "$browser" in prop_names

            # Verify tags
            assert page_view["tags"] == ["web"]
            signup = next(e for e in data["events"] if e["name"] == "signup_completed")
            assert "onboarding" in signup["tags"]

            # Verify volume
            assert page_view.get("volume_last_30d") == 15000

            # Verify metadata
            assert "metadata" in data
            assert data["metadata"]["event_count"] == 3

    def test_extract_posthog_directly(self, mock_posthog_server):
        """Test the extractor function directly against mock server."""
        from basesignal_loaders.posthog import extract_posthog_taxonomy

        taxonomy = extract_posthog_taxonomy(
            api_key="phx_test",
            project_id="42",
            host=mock_posthog_server,
        )

        assert taxonomy.platform == "posthog"
        assert taxonomy.project_id == "42"
        assert len(taxonomy.events) == 3
        assert taxonomy.events[0].name == "page_view"
        assert len(taxonomy.events[0].properties) == 2
        assert taxonomy.metadata is not None
        assert taxonomy.metadata.event_count == 3

    def test_bad_api_key_returns_error(self):
        """Verify that a connection error is handled gracefully."""
        from unittest.mock import patch
        from basesignal_loaders.__main__ import main

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "out.json")

            # Use a non-routable host to trigger connection error
            with patch(
                "sys.argv",
                [
                    "basesignal_loaders",
                    "--platform", "posthog",
                    "--api-key", "bad-key",
                    "--project-id", "1",
                    "--host", "http://127.0.0.1:1",  # port 1 = unlikely to be open
                    "--output", output_path,
                ],
            ):
                with pytest.raises(SystemExit) as exc_info:
                    main()
                assert exc_info.value.code == 1

            # Output file should NOT exist on error
            assert not os.path.exists(output_path)


class TestOutputFileCreation:
    """Test that output directories are created as needed."""

    def test_creates_nested_output_directories(self, mock_posthog_server):
        """Verify deeply nested output paths are created."""
        from unittest.mock import patch
        from basesignal_loaders.__main__ import main

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, "a", "b", "c", "events.json")

            with patch(
                "sys.argv",
                [
                    "basesignal_loaders",
                    "--platform", "posthog",
                    "--api-key", "phx_test",
                    "--project-id", "1",
                    "--host", mock_posthog_server,
                    "--output", output_path,
                ],
            ):
                main()

            assert os.path.exists(output_path)
            with open(output_path) as f:
                data = json.load(f)
            assert data["platform"] == "posthog"
