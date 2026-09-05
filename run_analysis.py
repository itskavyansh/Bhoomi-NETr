"""CLI entry point for running subsidence risk analysis on sensor reading JSON files."""

import argparse
import json
from pathlib import Path
import sys

from engine.risk import analyze_reading


def main():
    parser = argparse.ArgumentParser(
        description="Run mine subsidence analysis on a sensor reading JSON file."
    )
    parser.add_argument(
        "file_path",
        type=str,
        help="Path to the sensor reading JSON file to analyze.",
    )
    parser.add_argument(
        "--baseline",
        type=float,
        default=None,
        help="Optional baseline distance in cm (defaults to DEFAULT_BASELINE_DISTANCE).",
    )
    args = parser.parse_args()

    target_path = Path(args.file_path)
    if not target_path.is_file():
        print(f"Error: File not found: {args.file_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as exc:
        print(f"Error: Malformed JSON in file '{args.file_path}': {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"Error reading file '{args.file_path}': {exc}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(data, dict):
        print(
            f"Error: Expected JSON object in '{args.file_path}', got {type(data).__name__}",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        if args.baseline is not None:
            result = analyze_reading(data, baseline_distance=args.baseline)
        else:
            result = analyze_reading(data)
    except (KeyError, ValueError) as exc:
        print(f"Error analyzing reading: {exc}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
