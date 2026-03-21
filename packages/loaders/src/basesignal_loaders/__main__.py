"""Entry point for subprocess calls: python -m basesignal_loaders."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

from basesignal_loaders import __version__

SUPPORTED_PLATFORMS = ["posthog", "amplitude", "mixpanel", "snowflake"]


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
    parser.add_argument("--api-key", default=None, help="API key for the analytics platform")
    parser.add_argument("--project-id", default=None, help="Project/workspace ID")
    parser.add_argument("--secret-key", default=None, help="Secret key (for Amplitude/Mixpanel)")
    parser.add_argument("--host", default=None, help="Custom API host (e.g., self-hosted PostHog)")
    parser.add_argument("--output", required=True, help="Output JSON file path")

    # Snowflake-specific arguments
    parser.add_argument("--account", default=None, help="Snowflake account identifier (or SNOWFLAKE_ACCOUNT env)")
    parser.add_argument("--user", default=None, help="Snowflake username (or SNOWFLAKE_USER env)")
    parser.add_argument("--password", default=None, help="Snowflake password (or SNOWFLAKE_PASSWORD env)")
    parser.add_argument("--warehouse", default=None, help="Snowflake warehouse name (or SNOWFLAKE_WAREHOUSE env)")
    parser.add_argument("--database", default=None, help="Snowflake database name (or SNOWFLAKE_DATABASE env)")
    parser.add_argument("--sf-schema", default=None, help="Snowflake schema name (or SNOWFLAKE_SCHEMA env)")
    parser.add_argument("--table", default=None, help="Activity schema table name")
    parser.add_argument("--stats", action="store_true", default=False, help="Include usage stats (counts, first/last seen)")
    return parser


def _extract(args: argparse.Namespace) -> dict:
    """Dispatch to the appropriate extractor and return a dict."""
    platform = args.platform

    # Validate --api-key is provided for non-snowflake platforms
    if platform != "snowflake" and not args.api_key:
        print("Error: --api-key is required for non-snowflake platforms.", file=sys.stderr)
        sys.exit(1)

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

    elif platform == "snowflake":
        from basesignal_loaders.snowflake import extract_snowflake_taxonomy

        account = args.account or os.environ.get("SNOWFLAKE_ACCOUNT", "")
        user = args.user or os.environ.get("SNOWFLAKE_USER", "")
        password = args.password or os.environ.get("SNOWFLAKE_PASSWORD", "")
        warehouse = args.warehouse or os.environ.get("SNOWFLAKE_WAREHOUSE", "")
        database = args.database or os.environ.get("SNOWFLAKE_DATABASE", "")
        sf_schema = args.sf_schema or os.environ.get("SNOWFLAKE_SCHEMA", "")
        table = args.table or ""

        required = {
            "account": account,
            "user": user,
            "password": password,
            "warehouse": warehouse,
            "database": database,
            "sf-schema": sf_schema,
            "table": table,
        }
        missing = [flag for flag, value in required.items() if not value]
        if missing:
            print(
                f"Error: missing required Snowflake options: {', '.join(f'--{flag}' for flag in missing)}",
                file=sys.stderr,
            )
            sys.exit(1)

        _progress(f"Extracting taxonomy from Snowflake ({account}/{database}.{sf_schema}.{table})...")
        taxonomy = extract_snowflake_taxonomy(
            account=account,
            user=user,
            password=password,
            warehouse=warehouse,
            database=database,
            schema=sf_schema,
            table=table,
            stats=args.stats,
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
