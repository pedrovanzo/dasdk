"""image-reader: a single-shot vision agent.

Given an image, makes one call to a Gemini vision model and returns a
description of the image plus any text it can find in it. No tool-use loop,
no multi-step planning — one model call in, one answer out.

This wraps the plain `google-genai` SDK rather than the full `google-adk`
package. See this agent's README for why: short version, ADK's `Agent` +
`Runner` + `SessionService` machinery is built for multi-step tool-use loops
with conversational state, none of which this task needs. The `ImageReaderAgent`
class below is deliberately ADK-flavored (model + instruction declared on the
object, a single `.run()` entry point) without the runtime weight.
"""

from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass
from pathlib import Path

from google import genai
from google.genai import types

DEFAULT_MODEL = "gemini-2.5-flash"

DEFAULT_INSTRUCTION = (
    "You are an image-reading assistant. Given an image, respond with two "
    "clearly labeled sections:\n\n"
    "## Description\n"
    "A concise, factual description of what the image shows.\n\n"
    "## Extracted text\n"
    "Any text visible in the image, transcribed verbatim, preserving line "
    "breaks where meaningful. If there is no visible text, write exactly: "
    "No text detected."
)

# Image types the Gemini API accepts. Anything else (or anything mimetypes
# can't resolve to one of these) is rejected before making a network call.
SUPPORTED_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
}


class AgentError(RuntimeError):
    """Raised for input/config problems: bad path, bad image type, missing key."""


@dataclass
class ImageReaderAgent:
    """Describes an image and extracts its visible text in one model call.

    Usage:
        agent = ImageReaderAgent()
        print(agent.run("photo.jpg"))
    """

    model: str = DEFAULT_MODEL
    instruction: str = DEFAULT_INSTRUCTION
    api_key: str | None = None

    def _client(self) -> genai.Client:
        key = (
            self.api_key
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_API_KEY")
        )
        if not key:
            raise AgentError(
                "No Gemini API key found. Set the GEMINI_API_KEY (or "
                "GOOGLE_API_KEY) environment variable, or pass --api-key. "
                "Get a free key at https://aistudio.google.com/apikey"
            )
        return genai.Client(api_key=key)

    @staticmethod
    def _load_image(image_path: str | Path) -> types.Part:
        path = Path(image_path)
        if not path.is_file():
            raise AgentError(f"Image file not found: {path}")

        mime_type = SUPPORTED_MIME_TYPES.get(path.suffix.lower())
        if mime_type is None:
            guessed, _ = mimetypes.guess_type(str(path))
            if guessed and guessed in SUPPORTED_MIME_TYPES.values():
                mime_type = guessed

        if mime_type is None:
            supported = ", ".join(sorted(SUPPORTED_MIME_TYPES))
            raise AgentError(
                f"Unsupported image type for {path}. Supported extensions: {supported}"
            )

        return types.Part.from_bytes(data=path.read_bytes(), mime_type=mime_type)

    def run(self, image_path: str | Path, prompt: str | None = None) -> str:
        """Describe `image_path` and extract its visible text in one call.

        Raises AgentError for local problems (bad path, unsupported file
        type, missing API key). Network/auth/model errors from the Gemini
        API itself propagate as `google.genai.errors.APIError` subclasses.
        """
        image_part = self._load_image(image_path)
        client = self._client()

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=prompt or "Describe this image and extract any text in it."
                    ),
                    image_part,
                ],
            )
        ]

        response = client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=self.instruction),
        )

        text = getattr(response, "text", None)
        if not text:
            raise AgentError("Model returned no text output.")
        return text
