"""CLI entry point: `image-reader path/to/image.png`."""

from __future__ import annotations

import argparse
import sys

from google.genai import errors as genai_errors

from .agent import AgentError, DEFAULT_MODEL, ImageReaderAgent


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="image-reader",
        description="Describe an image and extract its visible text using a Gemini vision model.",
    )
    parser.add_argument("image", help="Path to a local image file (png/jpg/jpeg/webp/heic/heif)")
    parser.add_argument(
        "-p",
        "--prompt",
        default=None,
        help="Optional custom prompt/question about the image (default: describe + extract text)",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Gemini model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="Gemini API key (overrides GEMINI_API_KEY/GOOGLE_API_KEY env vars)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    agent = ImageReaderAgent(model=args.model, api_key=args.api_key)

    try:
        result = agent.run(args.image, prompt=args.prompt)
    except AgentError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except genai_errors.APIError as exc:
        # Auth failures, quota errors, bad model names, etc. come back from
        # the Gemini API as one of these. Surface the message cleanly
        # instead of a raw traceback.
        print(f"Error: Gemini API call failed ({exc.code}): {exc.message}", file=sys.stderr)
        return 1

    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
