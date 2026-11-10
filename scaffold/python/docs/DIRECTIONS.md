# Directions

Three non-functional example sketches. Pick one and adapt it, or ignore all three and write your own spec using the checklist in `../AGENTS.md`.

## image-reader

A vision-based agent: takes an image and extracts or describes its text/content. Single-shot — one image in, one description/transcription out, no tool-use loop needed. Good first candidate for exercising the model-backend conventions in `MODEL-BACKENDS.md` since it only needs multimodal input, not tool calling.

## dataframe-analyst

Takes a CSV/dataset and answers analytical questions by having the model drive real pandas tool calls — filter, aggregate, plot — rather than reasoning over the data in free text. Produces a generated chart image as an artifact alongside its text answer. This one needs a genuine multi-step tool-use loop: the model decides which pandas operations to run, inspects results, and may chain several calls before answering.

## iterative-refinement-agent

Frames a task as repeated generations — tightening a short piece of writing, or optimizing a toy numeric function — with the model acting as its own judge/selector across rounds: generate a candidate, judge it against the current best, keep the winner, mutate it, repeat. Stops on a convergence condition or a round limit. Unlike every other sketch in this project, TypeScript or Python, state is carried across iterations rather than being single-pass — the interesting design problem here is what "state" means between rounds (the best candidate so far, a history of attempts, a score) and how the stopping condition is decided.
