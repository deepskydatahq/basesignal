"""Entry point for subprocess calls: python -m basesignal_loaders."""

import sys


def main() -> None:
    """CLI entry point (placeholder for future commands)."""
    print(f"basesignal-loaders v{__version__}")
    print("Usage: python -m basesignal_loaders <command>")
    print("Commands will be added in future stories.")
    sys.exit(0)


from basesignal_loaders import __version__

if __name__ == "__main__":
    main()
