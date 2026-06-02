.PHONY: sync generate hilo-frames test

sync:
	uv sync --all-groups

generate:
	cd woven && uv run antlr4 -Dlanguage=Python3 -visitor Woven.g4

hilo-frames:
	uv run python scripts/build_hilo_frames.py

test:
	uv run pytest -q
