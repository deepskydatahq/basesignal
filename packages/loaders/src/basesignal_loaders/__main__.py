"""Entry point for subprocess calls: python -m basesignal_loaders."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

from basesignal_loaders import __version__

SUPPORTED_PLATFORMS = ["posthog", "amplitude", "mixpanel"]


def _progress(msg: str) -> None:
    """Write a progress message to stderr."""
    print(msg, file=sys.stderr, flush=True)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="basesignal_loaders",
        description="Extract analytics taxonomy from a platform.",
    )
    parser.add_argument("--version", action="version", version=f"basesignal-loaders v{__version__}")
    parser.add_argument(
        "--platform",
        required=True,
        choices=SUPPORTED_PLATFORMS,
        help=f"Analytics platform to extract from ({', '.join(SUPPORTED_PLATFORMS)})",
    )
    parser.add_argument("--api-key", required=True, help="API key for the analytics platform")
    parser.add_argument("--project-id", default=None, help="Project/workspace ID")
    parser.add_argument("--secret-key", default=None, help="Secret key (for Amplitude/Mixpanel)")
    parser.add_argument("--host", default=None, help="Custom API host (e.g., self-hosted PostHog)")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    return parser


def _extract(args: argparse.Namespace) -> dict:
    """Dispatch to the appropriate extractor and return a dict."""
    platform = args.platform

    if platform == "posthog":
        from basesignal_loaders.posthog import extract_posthog_taxonomy

        kwargs: dict = {"api_key": args.api_key}
        if args.project_id:
            kwargs["project_id"] = args.project_id
        else:
            kwargs["project_id"] = "default"
        if args.host:
            kwargs["host"] = args.host

        _progress(f"Extracting taxonomy from PostHog (project: {kwargs['project_id']})...")
        taxonomy = extract_posthog_taxonomy(**kwargs)

    elif platform == "amplitude":
        from basesignal_loaders.amplitude import extract_amplitude_taxonomy

        secret_key = args.secret_key or ""
        _progress("Extracting taxonomy from Amplitude...")
        taxonomy = extract_amplitude_taxonomy(
            api_key=args.api_key,
            secret_key=secret_key,
        )

    elif platform == "mixpanel":
        from basesignal_loaders.mixpanel import extract_mixpanel_taxonomy

        secret = args.secret_key or ""
        project_id = args.project_id or ""
        _progress(f"Extracting taxonomy from Mixpanel (project: {project_id})...")
        taxonomy = extract_mixpanel_taxonomy(
            service_account=args.api_key,
            secret=secret,
            project_id=project_id,
        )

    else:
        # Should not reach here due to argparse choices, but just in case
        print(
            f"Error: Unknown platform '{platform}'. Supported platforms: {', '.join(SUPPORTED_PLATFORMS)}",
            file=sys.stderr,
        )
        sys.exit(1)

    return taxonomy.to_dict()


def main() -> None:
    """CLI entry point."""
    parser = _build_parser()
    args = parser.parse_args()

    start = time.monotonic()

    try:
        result = _extract(args)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    # Ensure output directory exists
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # Write output JSON
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
        f.write("\n")

    duration_ms = int((time.monotonic() - start) * 1000)
    event_count = len(result.get("events", []))
    _progress(f"Done: {event_count} events extracted in {duration_ms}ms")
    _progress(f"Output written to {args.output}")


if __name__ == "__main__":
    main()
