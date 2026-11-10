# image-reader

Toy/demo agent, Python flavor. Takes a local image file, makes one call to a
Gemini vision model, and returns a description of the image plus any text it
can find in it — single-shot, no multi-step tool-use loop.

Standalone Python project, **not** part of the `sdk` Next.js app and not
wired into its browser UI (see `scaffold/python/docs/WORKSPACE.md` for why a
Python agent can't auto-wire into a TypeScript app's routing). Runs locally
from the command line.

**Backend:** plain [`google-genai`](https://github.com/googleapis/python-genai)
(Google's unified Gen AI SDK), not the full `google-adk` package. `google-adk`
was tried first (it's this repo's stated default — see `dasdk/DECISIONS.md`),
installed cleanly, and does work for a single-shot vision call, but it pulls
in a `Runner` + `SessionService` + async-event-stream machinery (plus FastAPI,
Uvicorn, OpenTelemetry, Authlib, cryptography — ~45 transitive packages)
intended for multi-step, stateful agent loops. None of that is needed for one
image-in/one-answer-out call, and under the hood ADK's Gemini calls go through
`google-genai` anyway. This package wraps that same SDK directly in a small
`ImageReaderAgent` class shaped like an ADK agent (model + instruction on the
object, one `.run()` entry point) without the extra weight.

## Install

From this directory (`agents/image-reader/`):

```bash
uv venv
source .venv/bin/activate
uv pip install -e .
```

(or, without `uv`: `python3 -m venv .venv && source .venv/bin/activate && pip install -e .`)

## API key

This agent needs your own Gemini API key — it is never hardcoded or
committed anywhere in this repo.

1. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Set it as an environment variable before running:

   ```bash
   export GEMINI_API_KEY="your-key-here"
   ```

   (`GOOGLE_API_KEY` also works, if you already use that convention.) Or pass
   it per-invocation with `--api-key`, instead of the environment variable.

## Run it

```bash
image-reader path/to/photo.jpg
```

Example output:

```
## Description
A handwritten sticky note on a wooden desk, next to a closed laptop.

## Extracted text
Buy milk
Call Alex re: Thursday
```

Optional flags:

```bash
# Ask a specific question instead of the default describe+extract prompt
image-reader receipt.png --prompt "What is the total amount on this receipt?"

# Use a different Gemini model
image-reader photo.jpg --model gemini-2.5-pro

# Pass the key directly instead of using an env var
image-reader photo.jpg --api-key "your-key-here"
```

Supported image types: `.png`, `.jpg`/`.jpeg`, `.webp`, `.heic`, `.heif`.

## Editorial note

This is a demo/portfolio agent. If its output (description or extracted
text) is ever used in anything published externally, it must be reviewed by
a human first, per Rede Gazeta's AI usage policy — this tool does not verify
or fact-check what it reads out of an image.
